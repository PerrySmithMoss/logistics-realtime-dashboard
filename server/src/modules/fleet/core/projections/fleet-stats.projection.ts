import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
import { mockVehicles } from "@modules/vehicle/data/mock-vehicles";
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetStatsProjection } from "../interfaces/fleet-stats-projection.interface";

export class FleetStatsProjection implements IFleetStatsProjection {
  /**
   * The hotCache acts as in in-memory cache.
   * In a distributed system, the map would be replaced by Redis.
   * It provides O(1) access to the latest state of the fleet.
   */
  private readonly hotCache = new Map<string, VehicleSnapshot>();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    mockVehicles.forEach((v) => {
      this.hotCache.set(v.id, {
        ...v,
        lastUpdated: new Date().toISOString(),
        isSnapped: false,
      });
    });
  }

  public handleUpdate(event: IStatusChangeEvent): void {
    const existing = this.hotCache.get(event.vehicleId);

    this.hotCache.set(event.vehicleId, {
      id: event.vehicleId,
      plateNumber: event.plateNumber || existing?.plateNumber || "Unknown",
      status: event.status,
      lat: event.lat,
      lng: event.lng,
      lastUpdated: event.timestamp || new Date().toISOString(),
      isSnapped: event.isSnapped ?? false,
    });
  }

  public getCurrentSnapshot(): IFleetSnapshot {
    const vehicles = Array.from(this.hotCache.values());
    const total = vehicles.length;
    const delayedCount = vehicles.filter((v) => v.status === "delayed").length;
    const activeCount = total - delayedCount;

    return {
      summary: {
        total,
        delayedCount,
        activeCount,
        performancePct: total > 0 ? (activeCount / total) * 100 : 100,
      },
      vehicles,
    };
  }
}
