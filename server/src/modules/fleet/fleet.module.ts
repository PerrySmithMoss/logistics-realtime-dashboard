import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { FleetController } from "./api/fleet.controller";
import { IFleetController } from "./api/interfaces/fleet-controller.interface";

export class FleetModule {
  public static init(
    queryBus: IQueryBus,
    eventBroker: IEventBroker,
  ): IFleetController {
    return new FleetController(eventBroker, queryBus);
  }
}
