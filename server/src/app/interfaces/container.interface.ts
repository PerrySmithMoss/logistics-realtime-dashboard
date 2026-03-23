import { IVehicleController } from "@modules/vehicle/api/interfaces/vehicle-controller.interface";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";

export interface IAppContainer {
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly database: IDatabase;
  readonly eventBroker: IEventBroker;

  readonly controllers: {
    readonly vehicle: IVehicleController;
    readonly health: IHealthController;
  };
}
