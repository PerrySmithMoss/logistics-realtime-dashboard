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
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsProjection } from "../projections/fleet-stats.projection";

export class FleetDataService implements IFleetDataService {
  private _isHydrated = false;
  private snapBuffer = new Map<string, IStatusChangeEvent>();
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
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.settings.hydrationTimeout,
    );

    try {
      this.logger.info("[FleetDataService] Starting hydration...");

      const vehicles = await this.queryBus.ask(ListAllVehiclesQuery.type, {
        signal: controller.signal,
      });

      for (const v of vehicles) {
        if (controller.signal.aborted) {
          throw new AppError(
            "Hydration timed out",
            AppErrorCodes.HYDRATION_FAILED,
            500,
            false,
          );
        }

        this.projection.handleUpdate({
          ...v,
          vehicleId: v.id,
          timestamp: new Date().toISOString(),
          isSnapped: v.isSnapped ?? false,
        } as IStatusChangeEvent);
      }

      this._isHydrated = true;
      this.logger.info("[FleetDataService] Hydration complete");
    } catch (err) {
      this._isHydrated = false;
      if (err instanceof AppError) throw err;

      throw new InternalServerError("Fleet hydration failed", err, false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async processVehicleMovement(
    event: IStatusChangeEvent,
  ): Promise<void> {
    if (this.lifecycle.isShuttingDown) return;

    this.snapBuffer.set(event.vehicleId, event);
  }

  private async flushSnapBuffer(): Promise<void> {
    if (this.snapBuffer.size === 0) return;

    const events = Array.from(this.snapBuffer.values());
    this.snapBuffer.clear();

    const points = events.map((e) => ({ lat: e.lat, lng: e.lng }));
    const results = await this.snappingService.snapBatch(points);

    events.forEach((event, index) => {
      const snapped = results[index];
      this.projection.handleUpdate({
        ...event,
        lat: snapped.lat,
        lng: snapped.lng,
        isSnapped: snapped.success,
      });
    });
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
