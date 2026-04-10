import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";

export type IFleetSnapshot = {
  summary: {
    total: number;
    activeCount: number;
    delayedCount: number;
    performancePct: number;
  };
  vehicles: VehicleSnapshot[];
};
