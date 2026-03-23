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
import { IAppConfig } from "@shared/interfaces/config.interface";
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
  public readonly controllers: {
    health: IHealthController;
    vehicle: IVehicleController;
    fleet: IFleetController;
  };

  constructor(private readonly config: IAppConfig) {
    this.lifecycle = new LifecycleManager();
    this.commandBus = new CommandBus();
    this.queryBus = new QueryBus();

    this.database = new InMemoryDatabase(this.lifecycle);
    this.eventBroker = new InMemoryEventBroker(this.lifecycle);

    this.lifecycle.onShutdown(async () => {
      console.log("Finalising logs...");
    });

    this.controllers = {
      health: new HealthController(this.lifecycle),
      vehicle: VehicleModule.init(
        this.commandBus,
        this.queryBus,
        this.eventBroker,
        this.database,
      ),
      fleet: FleetModule.init(this.queryBus, this.eventBroker),
    };

    this.lifecycle.setReady();
  }
}
