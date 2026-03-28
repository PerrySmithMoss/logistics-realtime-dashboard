import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";
import { Vehicle } from "../entities/vehicle.entity";
import { GetVehicleDetailsResponse } from "../queries/get-vehicle-details.query";

export interface IVehicleReadRepository {
  findById(id: string): Promise<Vehicle | null>;
  getDetails(id: string): Promise<GetVehicleDetailsResponse | null>;
  listAll(): Promise<VehicleSnapshot[]>;
  listAllActive(): Promise<GetVehicleDetailsResponse[]>;
  exists(id: string): Promise<boolean>;
}
