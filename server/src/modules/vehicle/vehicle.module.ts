import { IAppConfig } from "@config/index";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IVehicleController } from "./api/interfaces/vehicle-controller.interface";
import { VehicleController } from "./api/vehicle.controller";
import {
  UpdateVehicleLocationCommand,
  UpdateVehicleLocationHandler,
} from "./core/commands/update-location/update-vehicle-location";
import { Vehicle } from "./core/entities/vehicle.entity";
import { IVehicleReadRepository } from "./core/interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "./core/interfaces/vehicle-write-repository.interface";
import {
  ListAllVehiclesHandler,
  ListAllVehiclesQuery,
} from "./core/queries/list-all-vehicles.query";
import { mockVehicles } from "./data/mock-vehicles";
import { InMemoryVehicleRepository } from "./infrastructure/repositories/in-memory-vehicle.repository";

export class VehicleModule {
  public static init(
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    broker: IEventBroker,
    db: IDatabase,
    config: IAppConfig["modules"]["vehicle"],
  ): IVehicleController {
    const repository = new InMemoryVehicleRepository(db);

    if (config.seedMockData) {
      this.seedRepository(repository);
    }

    this.registerCommands(commandBus, repository, broker);
    this.registerQueries(queryBus, repository);

    return new VehicleController(commandBus, queryBus);
  }

  private static seedRepository(repo: InMemoryVehicleRepository) {
    mockVehicles.forEach((data) => {
      const vehicle = Vehicle.create({
        id: data.id,
        plateNumber: data.plateNumber,
        lat: data.lat,
        lng: data.lng,
        status: data.status as any,
      });

      repo.save(vehicle);
    });

    console.log(`✅ [VehicleModule] Seeded ${mockVehicles.length} vehicles.`);
  }

  private static registerCommands(
    bus: ICommandBus,
    repo: IVehicleWriteRepository & IVehicleReadRepository,
    broker: IEventBroker,
  ) {
    const commandRegistry = [
      {
        type: UpdateVehicleLocationCommand.type,
        handler: new UpdateVehicleLocationHandler(repo, broker),
      },
      // { type: RegisterVehicleCommand.type, handler: new RegisterVehicleHandler(repo, broker) }
    ];

    commandRegistry.forEach(({ type, handler }) => bus.register(type, handler));
  }

  private static registerQueries(bus: IQueryBus, repo: IVehicleReadRepository) {
    const queryRegistry = [
      {
        type: ListAllVehiclesQuery.type,
        handler: new ListAllVehiclesHandler(repo),
      },
    ];

    queryRegistry.forEach(({ type, handler }) => bus.register(type, handler));
  }
}
