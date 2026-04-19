import { NotFoundError } from "@shared/errors/app.errors";
import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";
import { IVehicleReadRepository } from "../interfaces/vehicle-read-repository.interface";

export class GetVehicleByIdQuery {
  static readonly type = "vehicle:get-by-id" as const;

  constructor(public readonly vehicleId: string) {}
}

export type GetVehicleByIdResponse = {
  data: VehicleSnapshot;
};

export class GetVehicleByIdHandler {
  constructor(private readonly repo: IVehicleReadRepository) {}

  async handle(query: GetVehicleByIdQuery): Promise<GetVehicleByIdResponse> {
    const vehicle = await this.repo.getDetails(query.vehicleId);

    if (!vehicle) {
      throw new NotFoundError(`Vehicle with ID ${query.vehicleId}`);
    }

    return { data: vehicle };
  }
}

declare module "@shared/bus/query/query-registry" {
  interface GlobalQueryRegistry {
    [GetVehicleByIdQuery.type]: {
      request: GetVehicleByIdQuery;
      response: GetVehicleByIdResponse;
    };
  }
}
