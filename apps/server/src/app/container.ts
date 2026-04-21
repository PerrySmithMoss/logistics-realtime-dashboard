import { IAppConfig } from "@config/index";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { FleetModule } from "@modules/fleet/fleet.module";
import { FleetSimulator } from "@modules/fleet/infrastructure/fleet-simulator";
import { seedVehicles } from "@modules/vehicle/data/seed-vehicles";
import { InMemoryVehicleRepository } from "@modules/vehicle/infrastructure/repositories/in-memory-vehicle.repository";
import { VehicleModule } from "@modules/vehicle/vehicle.module";
import { HealthController } from "@shared/api/health.controller";
import { CommandBus } from "@shared/bus/command/command-bus";
import { QueryBus } from "@shared/bus/query/query-bus";
import { InternalServerError } from "@shared/errors/app.errors";
import { InMemoryCache } from "@shared/infrastructure/cache";
import { InMemoryDatabase } from "@shared/infrastructure/database/in-memory-database";
import { InMemoryEventBroker } from "@shared/infrastructure/events/in-memory-event-broker";
import { OpenRouteServiceClient } from "@shared/infrastructure/geo";
import { LifecycleManager } from "@shared/infrastructure/lifecycle/lifecycle-manager";
import { ConsoleLogger } from "@shared/infrastructure/logger";
import { IGeoSnappingService, ILogger } from "@shared/interfaces";
import {
  AppContainerControllers,
  AppContainerLoggers,
  AppContainerOptions,
  IAppContainer,
} from "./interfaces/container.interface";

export class AppContainer implements IAppContainer {
  private constructor(private readonly options: AppContainerOptions) {}

  public get config() {
    return this.options.dependencies.config;
  }

  public get logger() {
    return this.options.dependencies.logger;
  }
  public get commandBus() {
    return this.options.dependencies.commandBus;
  }
  public get queryBus() {
    return this.options.dependencies.queryBus;
  }
  public get database() {
    return this.options.dependencies.database;
  }
  public get cache() {
    return this.options.dependencies.cache;
  }
  public get eventBroker() {
    return this.options.dependencies.eventBroker;
  }
  public get lifecycle() {
    return this.options.dependencies.lifecycle;
  }

  public get appLogger(): ILogger {
    return this.options.loggers.app;
  }

  public get serverLogger(): ILogger {
    return this.options.loggers.server;
  }

  public get errorLogger(): ILogger {
    return this.options.loggers.error;
  }

  public get controllers(): AppContainerControllers {
    return this.options.controllers;
  }

  public get fleetDataService(): IFleetDataService {
    return this.options.fleetDataService;
  }

  public get fleetSimulator(): FleetSimulator | undefined {
    return this.options.fleetSimulator;
  }

  public static async create(
    config: IAppConfig,
    options: {
      geoSnappingService?: IGeoSnappingService;
    } = {},
  ): Promise<AppContainer> {
    const baseLogger = new ConsoleLogger({
      level: config.server.minLogLevel,
      isDev: config.server.isDev,
    });

    const loggers: AppContainerLoggers = {
      app: baseLogger.withContext("App"),
      server: baseLogger.withContext("HttpServer"),
      error: baseLogger.withContext("ErrorHandler"),
    };

    const lifecycleLogger = baseLogger.withContext("LifecycleManager");
    const cacheLogger = baseLogger.withContext("InMemoryCache");
    const vehicleLogger = baseLogger.withContext("Vehicle");
    const fleetLogger = baseLogger.withContext("Fleet");
    const eventBrokerLogger = baseLogger.withContext("InMemoryEventBroker");

    const lifecycle = new LifecycleManager(lifecycleLogger);
    const database = new InMemoryDatabase(lifecycle);
    const cache = new InMemoryCache(cacheLogger);
    const eventBroker = new InMemoryEventBroker(lifecycle, eventBrokerLogger);
    const commandBus = new CommandBus();
    const queryBus = new QueryBus();

    const geoSnappingService =
      options.geoSnappingService ??
      new OpenRouteServiceClient(
        config.modules.fleet.ors.apiKey,
        fleetLogger,
        config.modules.fleet.ors,
      );

    const vehicleController = await VehicleModule.init(
      commandBus,
      queryBus,
      eventBroker,
      database,
      vehicleLogger,
      config.modules.vehicle,
      config,
    );

    const {
      controller: fleetController,
      dataService: fleetDataService,
      simulator: fleetSimulator,
    } = await FleetModule.init(
      config,
      lifecycle,
      commandBus,
      queryBus,
      eventBroker,
      fleetLogger,
      geoSnappingService,
    );

    lifecycle.setReady();

    if (!fleetSimulator && config.modules.fleet.enableFleetSimulator) {
      throw new InternalServerError(
        "AppContainer failed to start: FleetSimulator enabled in config but not returned by Module.",
        undefined,
        false,
      );
    }

    return new AppContainer({
      dependencies: {
        config,
        lifecycle,
        logger: baseLogger,
        commandBus,
        queryBus,
        database,
        cache,
        eventBroker,
      },
      controllers: {
        health: new HealthController(config, lifecycle, fleetDataService),
        fleet: fleetController,
        vehicle: vehicleController,
      },
      loggers,
      fleetDataService,
      fleetSimulator,
    });
  }

  public async resetForTesting(): Promise<void> {
    this.cache.reset?.();
    this.database.reset?.();
    const repository = new InMemoryVehicleRepository(this.database);
    await seedVehicles(repository, this.options.loggers.app.withContext("TestReset"));
    await this.options.fleetDataService.reset();
  }
}
