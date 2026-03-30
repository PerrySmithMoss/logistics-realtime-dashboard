import { IFleetController } from "@modules/fleet/api/interfaces/fleet-controller.interface";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { IVehicleController } from "@modules/vehicle/api/interfaces/vehicle-controller.interface";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { ILifecycleManager } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

export interface IAppContainer {
  readonly logger: ILogger;
  readonly appLogger: ILogger;
  readonly serverLogger: ILogger;
  readonly errorLogger: ILogger;
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly database: IDatabase;
  readonly eventBroker: IEventBroker;
  readonly lifecycle: ILifecycleManager;
  readonly controllers: {
    readonly health: IHealthController;
    readonly vehicle: IVehicleController;
    readonly fleet: IFleetController;
  };
  readonly fleetDataService: IFleetDataService;
}
