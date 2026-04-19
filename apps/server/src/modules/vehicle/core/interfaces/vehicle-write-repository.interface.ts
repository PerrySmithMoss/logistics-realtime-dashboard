import { Vehicle } from "../entities/vehicle.entity";

export interface IVehicleWriteRepository {
  save(vehicle: Vehicle): Promise<void>;
  delete(id: string): Promise<void>;
}
