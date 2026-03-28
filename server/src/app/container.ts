import { IAppConfig } from "@config/index";
import { IFleetController } from "@modules/fleet/api/interfaces/fleet-controller.interface";
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
import { InMemoryDatabase } from "@shared/infrastructure/persistence/in-memory-database";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { IAppContainer } from "./interfaces/container.interface";

export class AppContainer implements IAppContainer {
  public readonly lifecycle: ILifecycleManager;
  public readonly commandBus: ICommandBus;
  public readonly queryBus: IQueryBus;
  public readonly database: IDatabase;
  public readonly eventBroker: IEventBroker;

  private constructor(
    dependencies: {
      lifecycle: ILifecycleManager;
      commandBus: ICommandBus;
      queryBus: IQueryBus;
      database: IDatabase;
      eventBroker: IEventBroker;
    },
    public readonly controllers: {
      health: IHealthController;
      vehicle: IVehicleController;
      fleet: IFleetController;
    },
  ) {
    this.lifecycle = dependencies.lifecycle;
    this.commandBus = dependencies.commandBus;
    this.queryBus = dependencies.queryBus;
    this.database = dependencies.database;
    this.eventBroker = dependencies.eventBroker;
  }

  public static async create(config: IAppConfig): Promise<AppContainer> {
    const lifecycle = new LifecycleManager();
    const commandBus = new CommandBus();
    const queryBus = new QueryBus();
    const database = new InMemoryDatabase(lifecycle);
    const eventBroker = new InMemoryEventBroker(lifecycle);

    const vehicleController = VehicleModule.init(
      commandBus,
      queryBus,
      eventBroker,
      database,
      config.modules.vehicle,
    );

    const { controller: fleetController, dataService: fleetDataService } =
      await FleetModule.init(
        commandBus,
        queryBus,
        eventBroker,
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
      { lifecycle, commandBus, queryBus, database, eventBroker },
      controllers,
    );
  }
}
