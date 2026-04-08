import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { VehicleStatus } from "../entities/vehicle.entity";

export const VehicleEvents = {
  LOCATION_UPDATED: "VEHICLE.LOCATION_UPDATED",
  STATUS_CHANGED: "VEHICLE.STATUS_CHANGED",
  MAINTENANCE_STARTED: "VEHICLE.MAINTENANCE_STARTED",
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
