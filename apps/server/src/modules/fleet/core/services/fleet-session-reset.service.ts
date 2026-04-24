import { seedVehicles } from "@modules/vehicle/data/seed-vehicles";
import { InMemoryVehicleRepository } from "@modules/vehicle/infrastructure/repositories/in-memory-vehicle.repository";
import { ICache } from "@shared/interfaces/cache.interface";
import { IDatabase } from "@shared/interfaces/database.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { ISimulator } from "@shared/interfaces/simulator.interface";
import { IFleetDataService } from "../interfaces/fleet-data-service.interface";

export class FleetSessionResetService {
  private resetPromise: Promise<void> | null = null;
  private simulator?: ISimulator;

  constructor(
    private readonly database: IDatabase,
    private readonly cache: ICache,
    private readonly dataService: IFleetDataService,
    private readonly logger: ILogger,
  ) {}

  public setSimulator(simulator: ISimulator): void {
    this.simulator = simulator;
  }

  public waitForIdle(): Promise<void> {
    return this.resetPromise ?? Promise.resolve();
  }

  public scheduleReset(): Promise<void> {
    if (this.resetPromise) {
      return this.resetPromise;
    }

    this.resetPromise = this.runReset().finally(() => {
      this.resetPromise = null;
    });

    return this.resetPromise;
  }

  private async runReset(): Promise<void> {
    this.logger.info("[FleetSessionResetService] Resetting fleet session state.");

    this.simulator?.stop();
    this.simulator?.reset?.();
    this.cache.reset?.();
    this.database.reset?.();

    const repository = new InMemoryVehicleRepository(this.database);
    await seedVehicles(repository, this.logger);
    await this.dataService.reset();

    this.logger.info("[FleetSessionResetService] Fleet session reset complete.");
  }
}
