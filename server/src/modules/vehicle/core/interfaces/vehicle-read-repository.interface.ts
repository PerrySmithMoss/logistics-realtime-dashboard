import { Vehicle } from "../entities/vehicle.entity";
import { GetVehicleDetailsResponse } from "../queries/get-vehicle-details.query";

export interface IVehicleReadRepository {
  findById(id: string): Promise<Vehicle | null>;
  getDetails(id: string): Promise<GetVehicleDetailsResponse | null>;
  listAllActive(): Promise<GetVehicleDetailsResponse[]>;
  exists(id: string): Promise<boolean>;
}
