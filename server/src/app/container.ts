import { IAppConfig } from "@config/index";
import { IFleetController } from "@modules/fleet/api/interfaces/fleet-controller.interface";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { FleetModule } from "@modules/fleet/fleet.module";
import { IVehicleController } from "@modules/vehicle/api/interfaces/vehicle-controller.interface";
import { VehicleModule } from "@modules/vehicle/vehicle.module";
import { HealthController } from "@shared/api/health.controller";
import { CommandBus } from "@shared/bus/command/command-bus";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { QueryBus } from "@shared/bus/query/query-bus";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { InMemoryEventBroker } from "@shared/infrastructure/events/in-memory-event-broker";
import { LifecycleManager } from "@shared/infrastructure/lifecycle/lifecycle-manager";
import { ConsoleLogger } from "@shared/infrastructure/logger";
import { InMemoryDatabase } from "@shared/infrastructure/persistence/in-memory-database";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IAppContainer } from "./interfaces/container.interface";

export class AppContainer implements IAppContainer {
  private constructor(
    public readonly dependencies: {
      lifecycle: ILifecycleManager;
      commandBus: ICommandBus;
      queryBus: IQueryBus;
      database: IDatabase;
      eventBroker: IEventBroker;
      logger: ILogger;
      config: IAppConfig;
    },
    public readonly controllers: {
      readonly health: IHealthController;
      readonly vehicle: IVehicleController;
      readonly fleet: IFleetController;
    },
    public readonly fleetDataService: IFleetDataService,
    public readonly appLogger: ILogger,
    public readonly serverLogger: ILogger,
    public readonly errorLogger: ILogger,
  ) {}

  public get config() {
    return this.dependencies.config;
  }

  public get logger() {
    return this.dependencies.logger;
  }
  public get commandBus() {
    return this.dependencies.commandBus;
  }
  public get queryBus() {
    return this.dependencies.queryBus;
  }
  public get database() {
    return this.dependencies.database;
  }
  public get eventBroker() {
    return this.dependencies.eventBroker;
  }
  public get lifecycle() {
    return this.dependencies.lifecycle;
  }

  public static async create(config: IAppConfig): Promise<AppContainer> {
    const baseLogger = new ConsoleLogger({
      level: config.server.minLogLevel,
      isDev: config.server.isDev,
    });
    const appLogger = baseLogger.withContext("App");
    const serverLogger = baseLogger.withContext("HttpServer");
    const errorLogger = baseLogger.withContext("ErrorHandler");
    const eventBrokerLogger = baseLogger.withContext("InMemoryEventBroker");
    const vehicleLogger = baseLogger.withContext("Vehicle");
    const fleetLogger = baseLogger.withContext("Fleet");
    const lifecycleLogger = baseLogger.withContext("LifecycleManager");

    const lifecycle = new LifecycleManager(lifecycleLogger);
    const commandBus = new CommandBus();
    const queryBus = new QueryBus();
    const database = new InMemoryDatabase(lifecycle);
    const eventBroker = new InMemoryEventBroker(lifecycle, eventBrokerLogger);

    const vehicleController = VehicleModule.init(
      commandBus,
      queryBus,
      eventBroker,
      database,
      vehicleLogger,
      config.modules.vehicle,
    );

    const { controller: fleetController, dataService: fleetDataService } =
      await FleetModule.init(
        commandBus,
        queryBus,
        eventBroker,
        fleetLogger,
        config.modules.fleet,
        lifecycle,
      );

    const controllers = {
      health: new HealthController(lifecycle, fleetDataService),
      vehicle: vehicleController,
      fleet: fleetController,
    };

    lifecycle.setReady();

    return new AppContainer(
      {
        logger: baseLogger,
        commandBus,
        queryBus,
        database,
        eventBroker,
        lifecycle,
        config,
      },
      controllers,
      fleetDataService,
      appLogger,
      serverLogger,
      errorLogger,
    );
  }
}
