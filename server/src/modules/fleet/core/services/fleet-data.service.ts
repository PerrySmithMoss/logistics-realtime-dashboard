import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
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
  ) {}

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
        `💧 [FleetDataService] Hydrated with ${vehicles.length} vehicles.`,
      );
    } catch (err) {
      console.error("❌ [FleetDataService] Hydration failed:", err);
      throw err;
    }
  }

  public async processVehicleMovement(
    event: IStatusChangeEvent,
  ): Promise<void> {
    // debounce per vehicle to prevent OSRM from being spammed
    // if a vehicle publishes rapidly.
    const existing = this.pendingSnaps.get(event.vehicleId);
    if (existing) clearTimeout(existing);

    this.pendingSnaps.set(
      event.vehicleId,
      setTimeout(async () => {
        const snapped = await this.snapVehicleToRoad(event);
        this.projection.handleUpdate(snapped);
        this.pendingSnaps.delete(event.vehicleId);
      }, 200),
    );
  }

  public async getCurrentSnapshot(): Promise<IFleetSnapshot> {
    return this.projection.getCurrentSnapshot();
  }

  // TODO: batch these into a single OSRM table/nearest request,
  // or host a private OSRM instance for production use
  private async snapVehicleToRoad(
    v: IStatusChangeEvent,
  ): Promise<IStatusChangeEvent> {
    try {
      const url = `https://router.project-osrm.org/nearest/v1/driving/${v.lng},${v.lat}?number=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code === "Ok" && data.waypoints?.length > 0) {
        const [snappedLng, snappedLat] = data.waypoints[0].location;
        return { ...v, lat: snappedLat, lng: snappedLng, isSnapped: true };
      }
    } catch {
      console.warn(
        `[OSRM] Snapping failed for ${v.vehicleId}, using raw coords.`,
      );
    }
    return v;
  }
}
