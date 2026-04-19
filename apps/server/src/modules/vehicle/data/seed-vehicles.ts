import { ILogger } from "@shared/interfaces/logger.interface";
import { Vehicle } from "../core/entities/vehicle.entity";
import { InMemoryVehicleRepository } from "../infrastructure/repositories/in-memory-vehicle.repository";
import { mockVehicles } from "./mock-vehicles";

export const seedVehicles = async (
  repository: InMemoryVehicleRepository,
  logger: ILogger,
): Promise<void> => {
  const seeds = mockVehicles.map((data) => repository.save(Vehicle.create(data)));

  await Promise.all(seeds);

  logger.info(`[VehicleModule] Seeded ${mockVehicles.length} vehicles.`);
};
