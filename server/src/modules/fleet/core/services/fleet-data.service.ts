import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import {
  AppError,
  AppErrorCodes,
  InternalServerError,
} from "@shared/errors/app.errors";
import { ILifecycleManager } from "@shared/interfaces";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IOsrmClient } from "@shared/interfaces/osrm-client-interface";
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsProjection } from "../projections/fleet-stats.projection";

export class FleetDataService implements IFleetDataService {
  private _isHydrated = false;

  private readonly HYDRATION_TIMEOUT = 30000;

  private readonly pendingSnaps = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly queryBus: IQueryBus,
    private readonly projection: FleetStatsProjection,
    private readonly osrmClient: IOsrmClient,
    private readonly logger: ILogger,
    private readonly lifecycle: ILifecycleManager,
  ) {
    this.lifecycle.onShutdown(async () => {
      this.clearPendingSnaps();
    });
  }

  public async hydrate(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      this.logger.error("[FleetDataService] Hydration timed out internally");
    }, this.HYDRATION_TIMEOUT);

    this.logger.info("[FleetDataService] Starting hydration process...");

    try {
      // TODO: add abort signal to query bus
      const vehicles = await this.queryBus.ask(ListAllVehiclesQuery.type, {
        // TODO: add support for abort signal
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
      const snapshot = this.projection.getCurrentSnapshot();

      this.logger.info("[FleetDataService] Hydration complete", {
        totalVehicles: snapshot.summary.total,
        active: snapshot.summary.activeCount,
      });
    } catch (err) {
      this._isHydrated = false;
      this.logger.error("[FleetDataService] Hydration failed", err);

      if (err instanceof AppError) throw err;
      throw new InternalServerError("Hydration failed");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public get isHydrated(): boolean {
    return this._isHydrated;
  }

  public async processVehicleMovement(
    event: IStatusChangeEvent,
  ): Promise<void> {
    if (this.lifecycle.isShuttingDown) return;

    const existing = this.pendingSnaps.get(event.vehicleId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      try {
        this.pendingSnaps.delete(event.vehicleId);

        const snapped = await this.snapVehicleToRoad(event);
        this.projection.handleUpdate(snapped);
      } catch (err) {
        this.logger.error(
          `[FleetDataService] Failed to process movement for ${event.vehicleId}:`,
          err,
        );
      }
    }, 200);

    this.pendingSnaps.set(event.vehicleId, timeout);
  }

  public clearPendingSnaps(): void {
    if (this.pendingSnaps.size === 0) return;

    this.logger.info(
      `[FleetDataService] Clearing ${this.pendingSnaps.size} pending snaps...`,
    );

    for (const timeout of this.pendingSnaps.values()) {
      clearTimeout(timeout);
    }

    this.pendingSnaps.clear();
  }

  public async getCurrentSnapshot(): Promise<IFleetSnapshot> {
    return this.projection.getCurrentSnapshot();
  }

  // TODO: batch these into a single OSRM table/nearest request to be more efficient,
  // and/or host a private OSRM instance for production use.
  //   Instead of a setTimeout per vehicle, use a Buffer/Batching strategy:
  // - Collect all moving vehicleIds into a Set.
  // - Every 500ms, take all IDs in the Set and send one batch request to OSRM.
  // This will reduce network traffic, make the app feel faster and less expensive.
  private async snapVehicleToRoad(
    v: IStatusChangeEvent,
  ): Promise<IStatusChangeEvent> {
    try {
      const data = await this.osrmClient.getNearest(v.lat, v.lng, {
        signal: this.lifecycle.getShutdownSignal(),
      });

      if (data?.code === "Ok" && data.waypoints?.length > 0) {
        const [snappedLng, snappedLat] = data.waypoints[0].location;
        return { ...v, lat: snappedLat, lng: snappedLng, isSnapped: true };
      }
    } catch (err) {
      this.logger.warn(
        `OSRM Snapping failed for ${v.vehicleId}, using raw coords.`,
        { err: err.message },
      );
    }

    return { ...v, isSnapped: false };
  }
}
