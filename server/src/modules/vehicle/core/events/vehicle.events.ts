import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";

export const VehicleEvents = {
  LOCATION_UPDATED: "VEHICLE.LOCATION_UPDATED",
  STATUS_CHANGED: "VEHICLE.STATUS_CHANGED",
  MAINTENANCE_STARTED: "VEHICLE.MAINTENANCE_STARTED",
} as const;

export class VehicleLocationUpdatedEvent implements IStatusChangeEvent {
  static readonly type = VehicleEvents.LOCATION_UPDATED;

  constructor(
    public readonly vehicleId: string,
    public readonly status: string,
    public readonly lat: number,
    public readonly lng: number,
  ) {}
}
