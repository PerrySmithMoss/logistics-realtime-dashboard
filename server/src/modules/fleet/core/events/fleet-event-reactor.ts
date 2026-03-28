import { isStatusChangeEvent } from "@shared/guards/vehicle-event.guards";
import { IBroadcastScheduler } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsUpdatedEvent } from "./fleet-events";

export class FleetEventReactor implements IBroadcastScheduler {
  private needsPublish = false;
  private publishInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataService: IFleetDataService,
    private readonly broker: IEventBroker,
  ) {}

  public async onVehicleLocationChange(data: unknown): Promise<void> {
    try {
      if (!isStatusChangeEvent(data)) {
        console.error(
          "[FleetEventReactor] onVehicleLocationChange malformed data: ",
          data,
        );
        return;
      }

      await this.dataService.processVehicleMovement(data);
      this.needsPublish = true;
    } catch (err) {
      console.error("[FleetEventReactor] Error:", err);
    }
  }

  public start() {
    if (this.publishInterval) return;

    console.log("🚀 [FleetReactor] Activating broadcast loop...");
    this.publishInterval = setInterval(async () => {
      if (!this.needsPublish) return;

      const snapshot = await this.dataService.getCurrentSnapshot();
      this.broker.publish(
        FleetStatsUpdatedEvent.type,
        new FleetStatsUpdatedEvent(snapshot),
      );

      this.needsPublish = false;
    }, 1000);
  }

  public stop(): void {
    if (this.publishInterval) {
      console.log("💤 [FleetReactor] Deactivating broadcast loop...");
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
  }
}
