import { IAppConfig } from "@config/index";
import { IFleetController } from "@modules/fleet/api/interfaces/fleet-controller.interface";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { FleetSimulator } from "@modules/fleet/infrastructure/fleet-simulator";
import { IVehicleController } from "@modules/vehicle/api/interfaces/vehicle-controller.interface";
import { ILifecycleManager } from "@shared/interfaces";
import { ICache } from "@shared/interfaces/cache.interface";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IDatabase } from "@shared/interfaces/database.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";

export interface IAppContainer {
  readonly config: IAppConfig;
  readonly logger: ILogger;
  readonly appLogger: ILogger;
  readonly serverLogger: ILogger;
  readonly errorLogger: ILogger;
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly database: IDatabase;
  readonly cache: ICache;
  readonly eventBroker: IEventBroker;
  readonly lifecycle: ILifecycleManager;
  readonly controllers: {
    readonly health: IHealthController;
    readonly fleet: IFleetController;
    readonly vehicle: IVehicleController;
  };
  readonly fleetDataService: IFleetDataService;
  readonly fleetSimulator?: FleetSimulator;
  resetForTesting?(): Promise<void>;
}

interface AppContainerDependencies {
  readonly config: IAppConfig;
  readonly lifecycle: ILifecycleManager;
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly database: IDatabase;
  readonly cache: ICache;
  readonly eventBroker: IEventBroker;
  readonly logger: ILogger;
}

interface AppContainerControllers {
  readonly health: IHealthController;
  readonly fleet: IFleetController;
  readonly vehicle: IVehicleController;
}

interface AppContainerLoggers {
  readonly app: ILogger;
  readonly server: ILogger;
  readonly error: ILogger;
}

export interface AppContainerOptions {
  readonly dependencies: AppContainerDependencies;
  readonly controllers: AppContainerControllers;
  readonly loggers: AppContainerLoggers;
  readonly fleetDataService: IFleetDataService;
  readonly fleetSimulator?: FleetSimulator;
}
