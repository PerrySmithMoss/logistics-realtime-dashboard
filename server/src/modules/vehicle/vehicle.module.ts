import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IVehicleController } from "./api/interfaces/vehicle-controller.interface";
import { VehicleController } from "./api/vehicle.controller";
import { UpdateVehicleLocationCommand } from "./core/commands/update-location/update-vehicle-location.command";
import { UpdateVehicleLocationHandler } from "./core/commands/update-location/update-vehicle-location.handler";
import { IVehicleReadRepository } from "./core/interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "./core/interfaces/vehicle-write-repository.interface";
import { InMemoryVehicleRepository } from "./infrastructure/repositories/in-memory-vehicle.repository";

export class VehicleModule {
  public static init(
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    broker: IEventBroker,
    db: IDatabase,
  ): IVehicleController {
    const repository = new InMemoryVehicleRepository(db);

    this.registerCommands(commandBus, repository, broker);
    this.registerQueries(queryBus, repository);
    // this.registerEventSubscriptions(broker, repository);

    return new VehicleController(commandBus, queryBus);
  }

  private static registerCommands(
    bus: ICommandBus,
    repo: IVehicleWriteRepository & IVehicleReadRepository,
    broker: IEventBroker,
  ) {
    bus.register(
      UpdateVehicleLocationCommand.type,
      new UpdateVehicleLocationHandler(repo, broker),
    );
  }

  private static registerQueries(bus: IQueryBus, repo: IVehicleReadRepository) {
    // bus.register("GetVehicleById", new GetVehicleByIdHandler(repo));
  }
}
