import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { VehicleStatus } from "@shared/types/vehicle.types";

export const VehicleEvents = {
  LOCATION_UPDATED: "VEHICLE.LOCATION_UPDATED",
} as const;

export class VehicleLocationUpdatedEvent implements IVehicleStatusChangeEvent {
  static readonly type = VehicleEvents.LOCATION_UPDATED;

  constructor(
    public readonly vehicleId: string,
    public readonly status: VehicleStatus,
    public readonly plateNumber: string,
    public readonly lat: number,
    public readonly lng: number,
    public readonly timestamp: string,
  ) {}
}
