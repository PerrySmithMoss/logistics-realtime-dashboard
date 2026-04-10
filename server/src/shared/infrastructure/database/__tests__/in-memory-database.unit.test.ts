import { InternalServerError } from "@shared/errors/app.errors";
import { createMockLifecycleManager } from "@shared/test-utils";
import { VehicleProps } from "@shared/types/vehicle.types";
import { InMemoryDatabase } from "../in-memory-database";

describe("InMemoryDatabase", () => {
  const setup = () => {
    const lifecycle = createMockLifecycleManager();
    const database = new InMemoryDatabase(lifecycle);

    const createMockVehicle = (id: string): VehicleProps => ({
      id,
      plateNumber: "ABC-123",
      status: "active",
      lat: 50,
      lng: 10,
      lastUpdated: new Date(),
    });

    return { lifecycle, database, createMockVehicle };
  };

  describe("Table Access / Querying", () => {
    it("should allow storing and retrieving data from the vehicles table", async () => {
      const { database, createMockVehicle } = setup();
      const vehicle = createMockVehicle("v1");

      const table = database.getTable("vehicles");
      table.set(vehicle.id, vehicle);

      const results = await database.query("vehicles");

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(vehicle);
    });

    it("should return an empty array when querying an empty table", async () => {
      const { database } = setup();
      const results = await database.query("vehicles");
      expect(results).toEqual([]);
    });

    it("should throw InternalServerError when accessing a non-existent table", () => {
      const { database } = setup();

      // cast to any to bypass TS checks for the sake of the runtime test
      expect(() => (database as any).getTable("users")).toThrow(
        InternalServerError,
      );
      expect(() => (database as any).getTable("users")).toThrow(
        /does not exist/,
      );
    });
  });

  describe("Data Integrity", () => {
    it("should maintain reference integrity for stored objects", async () => {
      const { database, createMockVehicle } = setup();
      const vehicle = createMockVehicle("v1");

      database.getTable("vehicles").set(vehicle.id, vehicle);

      const results = await database.query("vehicles");

      expect(results[0]).toBe(vehicle);
    });

    it("should support multiple entries in a table", async () => {
      const { database, createMockVehicle } = setup();

      const table = database.getTable("vehicles");

      table.set("1", createMockVehicle("1"));
      table.set("2", createMockVehicle("2"));

      const results = await database.query("vehicles");
      expect(results).toHaveLength(2);
    });
  });

  describe("Lifecycle integration", () => {
    it("should clear all tables when the lifecycle triggers shutdown", async () => {
      const { database, lifecycle, createMockVehicle } = setup();
      const table = database.getTable("vehicles");

      table.set("v1", createMockVehicle("v1"));
      expect(table.size).toBe(1);

      await lifecycle.triggerShutdown();

      expect(table.size).toBe(0);
      const results = await database.query("vehicles");
      expect(results).toHaveLength(0);
    });
  });
});
