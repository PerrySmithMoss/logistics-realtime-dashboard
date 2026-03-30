import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
import { Vehicle } from "@modules/vehicle/core/entities/vehicle.entity";
import { IVehicleReadRepository } from "@modules/vehicle/core/interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "@modules/vehicle/core/interfaces/vehicle-write-repository.interface";
import { GetVehicleDetailsResponse } from "@modules/vehicle/core/queries/get-vehicle-details.query";
import { IDatabase } from "@shared/infrastructure/database/database.interface";

export class InMemoryVehicleRepository
  implements IVehicleReadRepository, IVehicleWriteRepository
{
  private readonly table: Map<string, Vehicle>;

  constructor(private readonly db: IDatabase) {
    this.table = this.db.getTable("vehicles");
  }

  async save(vehicle: Vehicle): Promise<void> {
    this.table.set(vehicle.id, vehicle);
  }

  async delete(id: string): Promise<void> {
    this.table.delete(id);
  }

  async findById(id: string): Promise<Vehicle | null> {
    return this.table.get(id) || null;
  }

  async exists(id: string): Promise<boolean> {
    return this.table.has(id);
  }

  async getDetails(id: string): Promise<GetVehicleDetailsResponse | null> {
    const vehicle = this.table.get(id);
    return vehicle ? vehicle.toSnapshot() : null;
  }

  async listAll(): Promise<VehicleSnapshot[]> {
    return Array.from(this.table.values()).map((v) => v.toSnapshot());
  }

  async listAllActive(): Promise<GetVehicleDetailsResponse[]> {
    return Array.from(this.table.values())
      .filter((v) => v.toSnapshot().status === "active")
      .map((v) => v.toSnapshot());
  }
}
