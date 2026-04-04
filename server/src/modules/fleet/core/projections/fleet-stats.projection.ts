import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
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

  private stats = {
    total: 0,
    delayed: 0,
  };

  public get totalCount(): number {
    return this.hotCache.size;
  }

  public handleUpdate(event: IStatusChangeEvent): void {
    const existing = this.hotCache.get(event.vehicleId);

    if (!existing) {
      this.stats.total++;
    }

    // If status changed to delayed => increment,
    // If it was delayed and changed back => decrement.
    if (existing?.status !== "delayed" && event.status === "delayed") {
      this.stats.delayed++;
    } else if (existing?.status === "delayed" && event.status !== "delayed") {
      this.stats.delayed--;
    }

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
    const total = this.stats.total;
    const delayedCount = this.stats.delayed;
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
