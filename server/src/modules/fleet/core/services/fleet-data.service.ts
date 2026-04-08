import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import {
  AppError,
  AppErrorCodes,
  InternalServerError,
} from "@shared/errors/app.errors";
import { ILifecycleManager } from "@shared/interfaces";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsProjection } from "../projections/fleet-stats.projection";

export class FleetDataService implements IFleetDataService {
  private _isHydrated = false;
  private isProcessing = false;
  private snapBuffer = new Map<string, IVehicleStatusChangeEvent>();
  private batchInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly queryBus: IQueryBus,
    private readonly projection: FleetStatsProjection,
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

  public async hydrate(): Promise<void> {
    const globalSignal = this.lifecycle.getShutdownSignal();
    const hydrationController = new AbortController();
    const timeoutId = setTimeout(
      () => hydrationController.abort(),
      this.settings.hydrationTimeout,
    );

    const onAbort = () => hydrationController.abort();
    globalSignal.addEventListener("abort", onAbort);

    try {
      this.logger.info("[FleetDataService] Starting hydration...");

      const vehicles = await this.queryBus.ask(ListAllVehiclesQuery.type, {
        signal: hydrationController.signal,
      });

      for (const v of vehicles) {
        if (hydrationController.signal.aborted) {
          throw new AppError(
            "Hydration timed out",
            AppErrorCodes.HydrationFailed,
            500,
            false,
          );
        }

        this.projection.handleUpdate({
          ...v,
          vehicleId: v.id,
          timestamp: new Date().toISOString(),
          isSnapped: v.isSnapped ?? false,
        } as IVehicleStatusChangeEvent);
      }

      this._isHydrated = true;
      this.logger.info("[FleetDataService] Hydration complete");
    } catch (err) {
      this._isHydrated = false;
      if (err instanceof AppError) throw err;

      throw new InternalServerError("Fleet hydration failed", err, false);
    } finally {
      clearTimeout(timeoutId);
      globalSignal.removeEventListener("abort", onAbort);
    }
  }

  public async processVehicleMovement(
    event: IVehicleStatusChangeEvent,
  ): Promise<void> {
    if (this.lifecycle.isShuttingDown) return;

    this.snapBuffer.set(event.vehicleId, event);
  }

  private async flushSnapBuffer(): Promise<void> {
    if (this.snapBuffer.size === 0 || this.isProcessing) return;

    this.isProcessing = true;

    try {
      const events = Array.from(this.snapBuffer.values());
      this.snapBuffer.clear();

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
      this.logger.error("Batch flush failed:", err);
    } finally {
      this.isProcessing = false;
    }
  }

  private startBatching(): void {
    if (this.batchInterval) return;
    this.batchInterval = setInterval(
      () => this.flushSnapBuffer(),
      this.settings.batchIntervalMs,
    );
  }

  private stopBatching(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
    this.snapBuffer.clear();
  }

  public get isHydrated(): boolean {
    return this._isHydrated;
  }

  public async getCurrentSnapshot(): Promise<IFleetSnapshot> {
    return this.projection.getCurrentSnapshot();
  }
}
