import { VehicleStatus } from "@shared/types/vehicle.types";

export interface IVehicleStatusChangeEvent {
  readonly vehicleId: string;
  readonly plateNumber: string;
  readonly status: VehicleStatus;
  readonly lat: number;
  readonly lng: number;
  readonly timestamp: string;
  readonly isSnapped?: boolean;
}
