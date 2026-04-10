import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
import { Vehicle } from "@modules/vehicle/core/entities/vehicle.entity";
import { IVehicleReadRepository } from "@modules/vehicle/core/interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "@modules/vehicle/core/interfaces/vehicle-write-repository.interface";
import { GetVehicleDetailsResponse } from "@modules/vehicle/core/queries/get-vehicle-details.query";
import { IDatabase } from "@shared/interfaces/database.interface";
import { VehicleProps } from "@shared/types/vehicle.types";

export class InMemoryVehicleRepository
  implements IVehicleReadRepository, IVehicleWriteRepository
{
  private readonly table: Map<string, VehicleProps>;

  constructor(private readonly db: IDatabase) {
    this.table = this.db.getTable("vehicles");
  }

  async save(vehicle: Vehicle): Promise<void> {
    const data = vehicle.getProps();
    this.table.set(vehicle.id, { ...data });
  }

  async delete(id: string): Promise<void> {
    this.table.delete(id);
  }

  async findById(id: string): Promise<Vehicle | null> {
    const data = this.table.get(id);
    if (!data) return null;

    return Vehicle.hydrate(data);
  }

  async exists(id: string): Promise<boolean> {
    return this.table.has(id);
  }

  async getDetails(id: string): Promise<GetVehicleDetailsResponse | null> {
    const vehicle = this.table.get(id);
    if (!vehicle) return null;

    return Vehicle.hydrate(vehicle).toSnapshot();
  }

  async listAll(): Promise<VehicleSnapshot[]> {
    return Array.from(this.table.values()).map((props) =>
      Vehicle.hydrate(props).toSnapshot(),
    );
  }

  async listAllActive(): Promise<GetVehicleDetailsResponse[]> {
    return Array.from(this.table.values())
      .map((props) => Vehicle.hydrate(props))
      .filter((vehicle) => vehicle.status === "active")
      .map((vehicle) => vehicle.toSnapshot());
  }
}
