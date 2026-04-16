import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";
import { IFleetStatsProjection } from "../interfaces/fleet-stats-projection.interface";

export class FleetStatsProjection implements IFleetStatsProjection {
  /**
   * Materialised view of the current vehicle states.
   * Maintained incrementally via handleUpdate() as events arrive.
   * In a distributed system this would be replaced by a shared store (e.g. Redis)
   * to allow multiple instances to share projection state.
   */
  private readonly vehicleStates = new Map<string, VehicleSnapshot>();

  private stats = {
    delayedCount: 0,
  };

  public get totalCount(): number {
    return this.vehicleStates.size;
  }

  public handleUpdate(event: IVehicleStatusChangeEvent): void {
    const existing = this.vehicleStates.get(event.vehicleId);

    // guard against any events which have been received out of order
    if (existing && event.timestamp && event.timestamp < existing.lastUpdated) {
      return;
    }

    const wasDelayed = existing?.status === "delayed";
    const isDelayed = event.status === "delayed";

    if (!wasDelayed && isDelayed) {
      this.stats.delayedCount++;
    } else if (wasDelayed && !isDelayed) {
      this.stats.delayedCount--;
    }

    this.vehicleStates.set(event.vehicleId, {
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
    const vehicles = Array.from(this.vehicleStates.values());
    const total = this.totalCount;
    const delayedCount = this.stats.delayedCount;
    const activeCount = this.totalCount - delayedCount;

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

  public reset(): void {
    this.vehicleStates.clear();
    this.stats.delayedCount = 0;
  }
}
