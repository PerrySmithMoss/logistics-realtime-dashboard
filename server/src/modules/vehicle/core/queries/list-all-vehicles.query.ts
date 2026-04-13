import { IQueryBusOptions } from "@shared/interfaces/query-bus.interface";
import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";
import { IVehicleReadRepository } from "../interfaces/vehicle-read-repository.interface";

export class ListAllVehiclesQuery {
  static readonly type = "vehicle:list-all" as const;
}

export type ListAllVehiclesResponse = {
  data: VehicleSnapshot[];
  count: number;
  timestamp: string;
};

export class ListAllVehiclesHandler {
  constructor(private readonly repo: IVehicleReadRepository) {}

  async handle(
    _query: ListAllVehiclesQuery,
    _options?: IQueryBusOptions,
  ): Promise<ListAllVehiclesResponse> {
    const vehicles = await this.repo.listAll();

    return {
      data: vehicles,
      count: vehicles.length,
      timestamp: new Date().toISOString(),
    };
  }
}

declare module "@shared/bus/query/query-registry" {
  interface GlobalQueryRegistry {
    [ListAllVehiclesQuery.type]: {
      request: ListAllVehiclesQuery;
      response: ListAllVehiclesResponse;
    };
  }
}
