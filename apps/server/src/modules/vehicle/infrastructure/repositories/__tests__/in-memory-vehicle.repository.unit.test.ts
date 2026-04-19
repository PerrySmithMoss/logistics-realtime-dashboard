import { InMemoryDatabase } from "@shared/infrastructure/database/in-memory-database";
import { createMockLifecycleManager, createVehicleEntity } from "@shared/testing/test-utils";
import { VehicleStatus } from "@shared/types/vehicle.types";
import { InMemoryVehicleRepository } from "../in-memory-vehicle.repository";

describe("InMemoryVehicleRepository", () => {
  const setup = () => {
    const database = new InMemoryDatabase(createMockLifecycleManager());
    const repository = new InMemoryVehicleRepository(database);
    const createVehicle = (overrides = {}) => createVehicleEntity(overrides);

    return {
      database,
      repository,
      createVehicle,
    };
  };

  it("saves a defensive copy of the vehicle state", async () => {
    const { repository, database, createVehicle } = setup();
    const vehicle = createVehicle();

    await repository.save(vehicle);
    vehicle.updatePosition(51.6, -0.2);

    const stored = database.getTable("vehicles").get("vehicle-1");
    expect(stored).toMatchObject({
      lat: 51.5,
      lng: -0.12,
    });
  });

  it("hydrates vehicles back from storage and returns null for missing records", async () => {
    const { repository, createVehicle } = setup();
    await repository.save(createVehicle());

    const found = await repository.findById("vehicle-1");
    const missing = await repository.findById("missing");

    expect(found?.toSnapshot()).toMatchObject({
      id: "vehicle-1",
      plateNumber: "AB12 CDE",
    });
    expect(missing).toBeNull();
  });

  it("tracks existence and delete semantics", async () => {
    const { repository, createVehicle } = setup();
    await repository.save(createVehicle());

    await expect(repository.exists("vehicle-1")).resolves.toBe(true);

    await repository.delete("vehicle-1");

    await expect(repository.exists("vehicle-1")).resolves.toBe(false);
  });

  it("returns detail snapshots and lists only active vehicles when requested", async () => {
    const { repository, createVehicle } = setup();
    await repository.save(createVehicle());
    await repository.save(
      createVehicle({
        id: "vehicle-2",
        plateNumber: "ZX98 YTR",
        status: VehicleStatus.Delayed,
      }),
    );

    await expect(repository.getDetails("vehicle-1")).resolves.toMatchObject({
      id: "vehicle-1",
      plateNumber: "AB12 CDE",
      status: VehicleStatus.Active,
    });
    await expect(repository.getDetails("missing")).resolves.toBeNull();
    await expect(repository.listAll()).resolves.toHaveLength(2);
    await expect(repository.listAllActive()).resolves.toEqual([
      expect.objectContaining({
        id: "vehicle-1",
        status: VehicleStatus.Active,
      }),
    ]);
  });

  it("returns a defensive copy on findById so that database state is protected", async () => {
    const { repository, createVehicle } = setup();
    await repository.save(createVehicle({ lat: 50.0, lng: 0.0 }));

    const found = await repository.findById("vehicle-1");
    if (!found) throw new Error("Should have found vehicle");

    found.updatePosition(51.6, -0.2);

    const secondLookup = await repository.findById("vehicle-1");

    expect(secondLookup?.toSnapshot().lat).toBe(50.0);
    expect(secondLookup?.toSnapshot().lat).not.toBe(51.6);
  });

  it("correctly updates an existing record (upsert logic)", async () => {
    const { repository, createVehicle } = setup();
    const vehicle = createVehicle({ plateNumber: "OLD-PLATE" });

    await repository.save(vehicle);

    const updatedVehicle = createVehicle({ plateNumber: "NEW-PLATE" });
    await repository.save(updatedVehicle);

    const result = await repository.findById("vehicle-1");
    expect(result?.toSnapshot().plateNumber).toBe("NEW-PLATE");
    expect(await repository.listAll()).toHaveLength(1); // Should not duplicate
  });

  it("returns an empty array when no vehicles exist", async () => {
    const { repository } = setup();
    await expect(repository.listAll()).resolves.toEqual([]);
    await expect(repository.listAllActive()).resolves.toEqual([]);
  });

  it("shares data across different repository instances using the same database", async () => {
    const { database, createVehicle } = setup();
    const repoA = new InMemoryVehicleRepository(database);
    const repoB = new InMemoryVehicleRepository(database);

    await repoA.save(createVehicle({ id: "shared-1" }));

    const foundByB = await repoB.findById("shared-1");
    expect(foundByB).not.toBeNull();
  });
});
