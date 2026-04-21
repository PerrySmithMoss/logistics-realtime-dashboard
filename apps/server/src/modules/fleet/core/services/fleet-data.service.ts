import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { AppError, InternalServerError } from "@shared/errors/app.errors";
import { ILifecycleManager } from "@shared/interfaces";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { IFleetStatsProjection } from "../interfaces/fleet-stats-projection.interface";

export class FleetDataService implements IFleetDataService {
  private _isHydrated = false;
  private isProcessing = false;
  private snapBuffer = new Map<string, IVehicleStatusChangeEvent>();
  private preHydrationBuffer = new Map<string, IVehicleStatusChangeEvent>();
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly queryBus: IQueryBus,
    private readonly projection: IFleetStatsProjection,
    private readonly snappingService: IGeoSnappingService,
    private readonly logger: ILogger,
    private readonly lifecycle: ILifecycleManager,
    private readonly settings: {
      hydrationTimeout: number;
      batchIntervalMs: number;
    },
  ) {
    this.lifecycle.onShutdown(async () => {
      this.stopBatching();
    });

    this.startBatching();
  }

  public get isHydrated(): boolean {
    return this._isHydrated;
  }

  public async getCurrentSnapshot(): Promise<IFleetSnapshot> {
    return this.projection.getCurrentSnapshot();
  }

  public async hydrate(): Promise<void> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort(new Error("Hydration timed out"));
    }, this.settings.hydrationTimeout);
    const combinedSignal = this.combineAbortSignals([
      this.lifecycle.getShutdownSignal(),
      timeoutController.signal,
    ]);

    try {
      this.logger.info("[FleetDataService] Starting hydration...");
      const { data: vehicles } = await this.queryBus.ask(
        ListAllVehiclesQuery.type,
        {},
        { signal: combinedSignal },
      );

      for (const v of vehicles) {
        if (combinedSignal.aborted) throw new Error("Hydration Aborted");

        this.projection.handleUpdate({
          ...v,
          vehicleId: v.id,
          timestamp: new Date().toISOString(),
          isSnapped: v.isSnapped ?? false,
        });
      }

      if (this.preHydrationBuffer.size > 0) {
        this.logger.info(
          `[FleetDataService] Applying ${this.preHydrationBuffer.size} buffered movements post-hydration`,
        );
        for (const event of this.preHydrationBuffer.values()) {
          this.snapBuffer.set(event.vehicleId, event);
        }
        this.preHydrationBuffer.clear();
      }

      this._isHydrated = true;
      this.logger.info("[FleetDataService] Hydration complete");
    } catch (err) {
      this._isHydrated = false;

      if (this.lifecycle.isShuttingDown) {
        this.logger.warn(`[FleetDataService] Hydration cancelled due to service shutdown.`);
        return;
      }

      if (combinedSignal.aborted) {
        this.logger.warn(`[FleetDataService] Hydration aborted. Reason: ${combinedSignal.reason}`);
        return;
      }

      this.logger.error("Hydration failed", err);
      if (err instanceof AppError) throw err;

      throw new InternalServerError("Fleet hydration failed", err, false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async reset(): Promise<void> {
    this._isHydrated = false;
    this.snapBuffer.clear();
    this.preHydrationBuffer.clear();
    this.projection.reset();

    await this.hydrate();
  }

  public async processVehicleMovement(event: IVehicleStatusChangeEvent): Promise<void> {
    if (this.lifecycle.isShuttingDown) return;

    //hold events if not hydrated to prevent stale overwrites
    if (!this._isHydrated) {
      this.preHydrationBuffer.set(event.vehicleId, event);
      return;
    }

    this.snapBuffer.set(event.vehicleId, event);
  }

  private async flushSnapBuffer(): Promise<void> {
    if (this.snapBuffer.size === 0 || this.isProcessing) {
      this.scheduleNextBatch();
      return;
    }

    this.isProcessing = true;
    const events = Array.from(this.snapBuffer.values());
    this.snapBuffer.clear();

    try {
      const points = events.map((e) => ({ lat: e.lat, lng: e.lng }));
      const results = await this.snappingService.snapBatch(points, {
        signal: this.lifecycle.getShutdownSignal(),
      });

      events.forEach((event, index) => {
        const snapped = results[index];
        this.projection.handleUpdate({
          ...event,
          lat: snapped.lat,
          lng: snapped.lng,
          isSnapped: snapped.success,
        });
      });
    } catch (err) {
      this.logger.error("Batch flush failed. Dropping batch to prevent overflow.", err);
    } finally {
      this.isProcessing = false;
      this.scheduleNextBatch();
    }
  }

  private startBatching(): void {
    if (this.batchTimeout) return;
    this.batchTimeout = setTimeout(() => this.flushSnapBuffer(), this.settings.batchIntervalMs);
  }

  private scheduleNextBatch(): void {
    if (this.lifecycle.isShuttingDown) return;
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    this.batchTimeout = setTimeout(() => this.flushSnapBuffer(), this.settings.batchIntervalMs);
  }

  private stopBatching(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    const abort = (signal: AbortSignal) => {
      controller.abort(signal.reason);
      signals.forEach((candidate) => {
        candidate.removeEventListener("abort", onAbort);
      });
    };

    const onAbort = (event: Event) => {
      abort(event.target as AbortSignal);
    };

    for (const signal of signals) {
      if (signal.aborted) {
        abort(signal);
        break;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }

    return controller.signal;
  }
}
