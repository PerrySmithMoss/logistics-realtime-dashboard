import { VehicleSnapshot } from "@modules/vehicle/core/dtos/vehicle-snapshot.dto";
import { Vehicle } from "@modules/vehicle/core/entities/vehicle.entity";
import { IVehicleReadRepository, IVehicleWriteRepository } from "@modules/vehicle/core/interfaces";
import { IDatabase } from "@shared/interfaces/database.interface";
import { VehicleProps, VehicleStatus } from "@shared/types/vehicle.types";

export class InMemoryVehicleRepository implements IVehicleReadRepository, IVehicleWriteRepository {
  private readonly table: Map<string, VehicleProps>;

  constructor(private readonly db: IDatabase) {
    this.table = this.db.getTable("vehicles");
  }

  async save(vehicle: Vehicle): Promise<void> {
    const data = vehicle.getProps();
    this.table.set(vehicle.id, structuredClone(data));
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

  async getDetails(id: string): Promise<VehicleSnapshot | null> {
    const vehicle = this.table.get(id);
    if (!vehicle) return null;

    return Vehicle.hydrate(vehicle).toSnapshot();
  }

  async listAll(): Promise<VehicleSnapshot[]> {
    return Array.from(this.table.values()).map((props) => Vehicle.hydrate(props).toSnapshot());
  }

  async listAllActive(): Promise<VehicleSnapshot[]> {
    return Array.from(this.table.values())
      .map((props) => Vehicle.hydrate(props))
      .filter((vehicle) => vehicle.status === VehicleStatus.Active)
      .map((vehicle) => vehicle.toSnapshot());
  }
}
