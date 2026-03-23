import { VehicleEvents } from "@modules/vehicle/core/events/vehicle.events";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { FleetStatsUpdatedEvent } from "../events/fleet-events";
import { FleetStatsProjection } from "../projections/fleet-stats.projection";

export class FleetStatsService {
  private readonly projection = new FleetStatsProjection();

  private readonly relevantEvents = [
    VehicleEvents.LOCATION_UPDATED,
    // VehicleEvents.STATUS_CHANGED,
    // etc.
  ];

  constructor(private readonly broker: IEventBroker) {
    this.setupListeners();
  }

  private setupListeners() {
    this.relevantEvents.forEach((topic) => {
      this.broker.subscribe<IStatusChangeEvent>(topic, (event) => {
        this.processUpdate(event);
      });
    });
  }

  private processUpdate(event: any) {
    const { vehicleId, status } = event;

    this.projection.handleUpdate(vehicleId, status);

    this.broker.publish(
      FleetStatsUpdatedEvent.type,
      new FleetStatsUpdatedEvent(this.projection.getGlobalStats()),
    );
  }
}
