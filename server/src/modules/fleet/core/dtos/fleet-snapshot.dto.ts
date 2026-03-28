import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";

export interface IFleetSnapshot {
  summary: {
    total: number;
    activeCount: number;
    delayedCount: number;
    performancePct: number;
  };
  vehicles: VehicleSnapshot[];
}
