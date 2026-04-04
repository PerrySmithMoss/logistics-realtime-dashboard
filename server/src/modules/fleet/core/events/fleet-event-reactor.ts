import { isStatusChangeEvent } from "@shared/guards/vehicle-event.guards";
import { IBroadcastScheduler } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";
import { FleetStatsUpdatedEvent } from "./fleet-events";

export class FleetEventReactor implements IBroadcastScheduler {
  private needsPublish = false;
  private publishInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataService: IFleetDataService,
    private readonly broker: IEventBroker,
    private readonly logger: ILogger,
  ) {}

  public async onVehicleLocationChange(data: unknown): Promise<void> {
    try {
      if (!isStatusChangeEvent(data)) {
        this.logger.warn(
          "[FleetEventReactor] Received malformed status change event",
          { data },
        );
        return;
      }

      await this.dataService.processVehicleMovement(data);
      this.needsPublish = true;
    } catch (err) {
      this.logger.error("[FleetEventReactor] Pipeline processing failed", err);
    }
  }

  private async broadcast() {
    if (!this.needsPublish) return;

    try {
      const snapshot = await this.dataService.getCurrentSnapshot();
      this.broker.publish(
        FleetStatsUpdatedEvent.type,
        new FleetStatsUpdatedEvent(snapshot),
      );
      this.needsPublish = false;
    } catch (err) {
      this.logger.error("[FleetEventReactor] Broadcast failed", err);
    }
  }

  public start() {
    if (this.publishInterval) return;

    this.logger.info("[FleetEventReactor] Activating broadcast loop...");

    const run = async () => {
      await this.broadcast();

      if (this.publishInterval) {
        this.publishInterval = setTimeout(run, 1000);
      }
    };

    this.publishInterval = setTimeout(run, 1000);
  }

  public stop(): void {
    if (this.publishInterval) {
      this.logger.info("[FleetEventReactor] Deactivating broadcast loop...");
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
  }
}
