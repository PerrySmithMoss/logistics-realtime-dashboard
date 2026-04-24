import { InMemoryVehicleRepository } from "@modules/vehicle/infrastructure/repositories/in-memory-vehicle.repository";
import { InMemoryDatabase } from "@shared/infrastructure/database/in-memory-database";
import {
  createMockCache,
  createMockFleetDataService,
  createMockLifecycleManager,
  createMockLogger,
  createMockFleetSimulator,
} from "@shared/testing/test-utils";
import { FleetSessionResetService } from "../fleet-session-reset.service";

describe("FleetSessionResetService", () => {
  it("stops and resets the simulator, reseeds the database, and rehydrates fleet data", async () => {
    const lifecycle = createMockLifecycleManager();
    const database = new InMemoryDatabase(lifecycle);
    const cache = createMockCache();
    const dataService = createMockFleetDataService();
    const logger = createMockLogger();
    const simulator = createMockFleetSimulator();
    const service = new FleetSessionResetService(database, cache, dataService, logger);

    service.setSimulator(simulator);

    const repository = new InMemoryVehicleRepository(database);
    await repository.delete("V-101");

    await service.scheduleReset();

    expect(cache.reset).toHaveBeenCalledTimes(1);
    expect(simulator.stop).toHaveBeenCalledTimes(1);
    expect(simulator.reset).toHaveBeenCalledTimes(1);
    expect(dataService.reset).toHaveBeenCalledTimes(1);
    await expect(repository.exists("V-101")).resolves.toBe(true);
  });

  it("deduplicates concurrent reset requests", async () => {
    const service = new FleetSessionResetService(
      new InMemoryDatabase(createMockLifecycleManager()),
      createMockCache(),
      createMockFleetDataService(),
      createMockLogger(),
    );

    const first = service.scheduleReset();
    const second = service.scheduleReset();

    expect(first).toBe(second);

    await Promise.all([first, second]);
  });
});
