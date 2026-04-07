import { IAppConfig } from "@config/index";
import { IFleetController } from "@modules/fleet/api/interfaces/fleet-controller.interface";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { FleetModule } from "@modules/fleet/fleet.module";
import { VehicleModule } from "@modules/vehicle/vehicle.module";
import { HealthController } from "@shared/api/health.controller";
import { CommandBus } from "@shared/bus/command/command-bus";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { QueryBus } from "@shared/bus/query/query-bus";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { InMemoryCache } from "@shared/infrastructure/cache/in-memory-cache";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { InMemoryEventBroker } from "@shared/infrastructure/events/in-memory-event-broker";
import { LifecycleManager } from "@shared/infrastructure/lifecycle/lifecycle-manager";
import { ConsoleLogger } from "@shared/infrastructure/logger";
import { InMemoryDatabase } from "@shared/infrastructure/persistence/in-memory-database";
import { ICache } from "@shared/interfaces/cache.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IAppContainer } from "./interfaces/container.interface";

export class AppContainer implements IAppContainer {
  private constructor(
    public readonly dependencies: {
      config: IAppConfig;
      lifecycle: ILifecycleManager;
      commandBus: ICommandBus;
      queryBus: IQueryBus;
      database: IDatabase;
      cache: ICache;
      eventBroker: IEventBroker;
      logger: ILogger;
    },
    public readonly controllers: {
      readonly health: IHealthController;
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
  public get cache() {
    return this.dependencies.cache;
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
    const lifecycleLogger = baseLogger.withContext("LifecycleManager");
    const cacheLogger = baseLogger.withContext("InMemoryCache");
    const serverLogger = baseLogger.withContext("HttpServer");
    const errorLogger = baseLogger.withContext("ErrorHandler");
    const vehicleLogger = baseLogger.withContext("Vehicle");
    const fleetLogger = baseLogger.withContext("Fleet");
    const eventBrokerLogger = baseLogger.withContext("InMemoryEventBroker");

    const lifecycle = new LifecycleManager(lifecycleLogger);
    const database = new InMemoryDatabase(lifecycle);
    const cache = new InMemoryCache(cacheLogger);
    const eventBroker = new InMemoryEventBroker(lifecycle, eventBrokerLogger);
    const commandBus = new CommandBus();
    const queryBus = new QueryBus();

    VehicleModule.init(
      commandBus,
      queryBus,
      eventBroker,
      database,
      vehicleLogger,
      config.modules.vehicle,
    );

    const { controller: fleetController, dataService: fleetDataService } =
      await FleetModule.init(
        config.modules.fleet,
        lifecycle,
        commandBus,
        queryBus,
        eventBroker,
        fleetLogger,
      );

    const controllers = {
      health: new HealthController(lifecycle, fleetDataService),
      fleet: fleetController,
    };

    lifecycle.setReady();

    return new AppContainer(
      {
        config,
        lifecycle,
        logger: baseLogger,
        commandBus,
        queryBus,
        database,
        cache,
        eventBroker,
      },
      controllers,
      fleetDataService,
      appLogger,
      serverLogger,
      errorLogger,
    );
  }
}
