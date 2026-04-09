import { VehicleStatus } from "@shared/types/vehicle.types";

export interface VehicleSnapshot {
  readonly id: string;
  readonly plateNumber: string;
  readonly status: VehicleStatus;
  readonly lat: number;
  readonly lng: number;
  readonly lastUpdated: string;
  readonly isSnapped?: boolean;
  readonly metadata?: Record<string, any>;
}
