import { FleetStatsUpdatedEvent } from "@modules/fleet/core/events/fleet-events";
import { VehicleLocationUpdatedEvent } from "@modules/vehicle/core/events/vehicle.events";

export interface EventRegistry {
  [FleetStatsUpdatedEvent.type]: FleetStatsUpdatedEvent;
  [VehicleLocationUpdatedEvent.type]: VehicleLocationUpdatedEvent;
}
