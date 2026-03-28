import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { ILifecycleManager } from "@shared/interfaces";
import { IOsrmClient } from "@shared/interfaces/osrm-client-interface";
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsProjection } from "../projections/fleet-stats.projection";

export class FleetDataService implements IFleetDataService {
  private readonly pendingSnaps = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly queryBus: IQueryBus,
    private readonly projection: FleetStatsProjection,
    private readonly osrmClient: IOsrmClient,
    private readonly lifecycle: ILifecycleManager,
  ) {
    this.lifecycle.onShutdown(async () => {
      this.clearPendingSnaps();
    });
  }

  public async hydrate(): Promise<void> {
    try {
      const vehicles = await this.queryBus.ask(ListAllVehiclesQuery.type, {});
      for (const v of vehicles) {
        this.projection.handleUpdate({
          ...v,
          vehicleId: v.id,
          timestamp: new Date().toISOString(),
          isSnapped: v.isSnapped ?? false,
        } as IStatusChangeEvent);
      }
      console.log(
        `[FleetDataService] Hydrated with ${vehicles.length} vehicles.`,
      );
    } catch (err) {
      console.error("[FleetDataService] Hydration failed:", err);
      throw err;
    }
  }

  public async processVehicleMovement(
    event: IStatusChangeEvent,
  ): Promise<void> {
    const existing = this.pendingSnaps.get(event.vehicleId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      try {
        this.pendingSnaps.delete(event.vehicleId);

        const snapped = await this.snapVehicleToRoad(event);
        this.projection.handleUpdate(snapped);
      } catch (err) {
        console.error(
          `[FleetDataService] Failed to process movement for ${event.vehicleId}:`,
          err,
        );
      }
    }, 200);

    this.pendingSnaps.set(event.vehicleId, timeout);
  }

  public clearPendingSnaps(): void {
    if (this.pendingSnaps.size === 0) return;

    console.log(
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
  // and/or host a private OSRM instance for production use
  private async snapVehicleToRoad(
    v: IStatusChangeEvent,
  ): Promise<IStatusChangeEvent> {
    const data = await this.osrmClient.getNearest(v.lng, v.lat, {
      signal: this.lifecycle.getShutdownSignal(),
    });

    if (data?.code === "Ok" && data.waypoints?.length > 0) {
      const [snappedLng, snappedLat] = data.waypoints[0].location;
      return { ...v, lat: snappedLat, lng: snappedLng, isSnapped: true };
    }

    return { ...v, isSnapped: false };
  }
}
