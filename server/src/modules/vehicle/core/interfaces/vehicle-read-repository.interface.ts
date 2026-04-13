import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";
import { Vehicle } from "../entities/vehicle.entity";

export interface IVehicleReadRepository {
  findById(id: string): Promise<Vehicle | null>;
  getDetails(id: string): Promise<VehicleSnapshot | null>;
  listAll(): Promise<VehicleSnapshot[]>;
  listAllActive(): Promise<VehicleSnapshot[]>;
  exists(id: string): Promise<boolean>;
}
