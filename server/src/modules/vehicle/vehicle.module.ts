import { IAppConfig } from "@config/index";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IDatabase } from "@shared/interfaces/database.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { VehicleController } from "./api/vehicle.controller";
import { IVehicleController } from "./api/interfaces/vehicle-controller.interface";
import {
  UpdateVehicleLocationCommand,
  UpdateVehicleLocationHandler,
} from "./core/commands/update-location/update-vehicle-location";
import { IVehicleReadRepository, IVehicleWriteRepository } from "./core/interfaces";
import { GetVehicleByIdHandler, GetVehicleByIdQuery } from "./core/queries/get-vehicle-by-id.query";
import {
  ListAllVehiclesHandler,
  ListAllVehiclesQuery,
} from "./core/queries/list-all-vehicles.query";
import { seedVehicles } from "./data/seed-vehicles";
import { InMemoryVehicleRepository } from "./infrastructure/repositories/in-memory-vehicle.repository";

export class VehicleModule {
  public static async init(
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    broker: IEventBroker,
    db: IDatabase,
    logger: ILogger,
    config: IAppConfig["modules"]["vehicle"],
    appConfig: IAppConfig,
  ): Promise<IVehicleController> {
    const repository = new InMemoryVehicleRepository(db);

    if (config.seedMockData) {
      await seedVehicles(repository, logger);
    }

    this.registerCommands(commandBus, repository, broker);
    this.registerQueries(queryBus, repository);

    return new VehicleController(appConfig, commandBus, queryBus);
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
    ];

    commandRegistry.forEach(({ type, handler }) => bus.register(type, handler));
  }

  private static registerQueries(bus: IQueryBus, repo: IVehicleReadRepository) {
    const queryRegistry = [
      {
        type: ListAllVehiclesQuery.type,
        handler: new ListAllVehiclesHandler(repo),
      },
      {
        type: GetVehicleByIdQuery.type,
        handler: new GetVehicleByIdHandler(repo),
      },
    ];

    queryRegistry.forEach(({ type, handler }) => bus.register(type, handler));
  }
}
