import { IVehicleStatusChangeEvent } from "@shared/interfaces";
import { FleetStatsProjection } from "../fleet-stats.projection";

const createProjection = () => {
  return new FleetStatsProjection();
};

const createVehicleStatusChangeEvent = (
  overrides: Partial<IVehicleStatusChangeEvent> = {},
): IVehicleStatusChangeEvent => {
  return {
    vehicleId: "vehicle-1",
    plateNumber: "AB12 CDE",
    status: "active",
    lat: 51.5074,
    lng: -0.1278,
    timestamp: "2024-01-01T00:00:00.000Z",
    isSnapped: false,
    ...overrides,
  };
};

describe("FleetStatsProjection", () => {
  describe("initial state", () => {
    it("starts with zero totalCount", () => {
      const projection = createProjection();
      expect(projection.totalCount).toBe(0);
    });

    it("returns an empty snapshot with 100% performance before any events", () => {
      const projection = createProjection();
      const snapshot = projection.getCurrentSnapshot();

      expect(snapshot.summary).toEqual({
        total: 0,
        delayedCount: 0,
        activeCount: 0,
        performancePct: 100,
      });
      expect(snapshot.vehicles).toHaveLength(0);
    });
  });

  describe("handleUpdate - new vehicles", () => {
    it("increments totalCount when a vehicle change event is created", () => {
      const projection = createProjection();
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-1" }));
      expect(projection.totalCount).toBe(1);
    });

    it("tracks multiple different vehicles", () => {
      const projection = createProjection();
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-1" }));
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-2" }));
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-3" }));
      expect(projection.totalCount).toBe(3);
    });

    it("does not increment totalCount when an existing vehicle is updated", () => {
      const projection = createProjection();
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-1" }));
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      expect(projection.totalCount).toBe(1);
    });

    it("stores the correct vehicle state in the snapshot", () => {
      const projection = createProjection();
      const event = createVehicleStatusChangeEvent({
        vehicleId: "v-1",
        plateNumber: "XY99 ZZZ",
        status: "active",
        lat: 51.5,
        lng: -0.1,
        isSnapped: true,
        timestamp: "2024-06-01T12:00:00.000Z",
      });

      projection.handleUpdate(event);
      const { vehicles } = projection.getCurrentSnapshot();

      expect(vehicles[0]).toEqual({
        id: "v-1",
        plateNumber: "XY99 ZZZ",
        status: "active",
        lat: 51.5,
        lng: -0.1,
        isSnapped: true,
        lastUpdated: "2024-06-01T12:00:00.000Z",
      });
    });
  });

  describe("handleUpdate — vehicle fields", () => {
    it("keeps the original plateNumber when a subsequent event has falsy value", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          plateNumber: "AB12 CDE",
        }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          plateNumber: undefined,
        }),
      );

      const { vehicles } = projection.getCurrentSnapshot();
      expect(vehicles[0].plateNumber).toBe("AB12 CDE");
    });

    it("falls back to 'Unknown' when plateNumber is missing in first event", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          plateNumber: undefined,
        }),
      );

      const { vehicles } = projection.getCurrentSnapshot();
      expect(vehicles[0].plateNumber).toBe("Unknown");
    });

    it("defaults isSnapped to false when not provided", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          isSnapped: undefined,
        }),
      );

      const { vehicles } = projection.getCurrentSnapshot();
      expect(vehicles[0].isSnapped).toBe(false);
    });

    it("updates lat/lng on each event", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          lat: 51.0,
          lng: -0.1,
        }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          lat: 52.0,
          lng: -0.2,
        }),
      );

      const { vehicles } = projection.getCurrentSnapshot();
      expect(vehicles[0].lat).toBe(52.0);
      expect(vehicles[0].lng).toBe(-0.2);
    });
  });

  describe("handleUpdate — delayed counter", () => {
    it("increments delayedCount when a vehicle transitions to delayed", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(1);
    });

    it("decrements delayedCount when a delayed vehicle returns to active", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(0);
    });

    it("does not increment delayedCount when a delayed vehicle receives another delayed event", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(1);
    });

    it("counts delayedCount correctly when a new vehicle arrives already delayed", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(1);
    });

    it("tracks delayed state correctly across multiple vehicles", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-3", status: "active" }),
      );

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(2);
    });
  });

  describe("getCurrentSnapshot — summary", () => {
    it("calculates activeCount correctly", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-3", status: "delayed" }),
      );

      const { summary } = projection.getCurrentSnapshot();
      expect(summary.activeCount).toBe(2);
    });

    it("returns 100% performancePct when no vehicles exist", () => {
      const projection = createProjection();
      expect(projection.getCurrentSnapshot().summary.performancePct).toBe(100);
    });

    it("returns 100% performancePct when all vehicles are active", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "active" }),
      );

      expect(projection.getCurrentSnapshot().summary.performancePct).toBe(100);
    });

    it("returns 0% performancePct when all vehicles are delayed", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "delayed" }),
      );

      expect(projection.getCurrentSnapshot().summary.performancePct).toBe(0);
    });

    it("calculates performancePct correctly for a mixed fleet", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-3", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-4", status: "delayed" }),
      );

      // 3 / 4 = 75
      expect(projection.getCurrentSnapshot().summary.performancePct).toBe(75);
    });

    it("calculates performancePct correctly for repeating decimals (Precision Fix)", () => {
      const projection = new FleetStatsProjection();

      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-3", status: "delayed" }),
      );

      const { summary } = projection.getCurrentSnapshot();

      expect(summary.performancePct).toBeCloseTo(66.67, 2);
    });

    it("maintains consistent totalCount from Map", () => {
      const projection = new FleetStatsProjection();
      const event = createVehicleStatusChangeEvent({ vehicleId: "v-1" });

      // same event twice
      projection.handleUpdate(event);
      projection.handleUpdate(event);

      const snapshot = projection.getCurrentSnapshot();

      expect(snapshot.summary.total).toBe(1);
      expect(snapshot.vehicles.length).toBe(1);
    });

    it("snapshot vehicles array contains all registered vehicles", () => {
      const projection = createProjection();
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-1" }));
      projection.handleUpdate(createVehicleStatusChangeEvent({ vehicleId: "v-2" }));

      const { vehicles } = projection.getCurrentSnapshot();
      expect(vehicles).toHaveLength(2);
      expect(vehicles.map((v) => v.id)).toEqual(expect.arrayContaining(["v-1", "v-2"]));
    });
  });

  describe("event sequencing", () => {
    it("calculates the correct state after multiple updates to the same vehicle", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "active",
          lat: 51.0,
        }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "delayed",
          lat: 51.5,
        }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "active",
          lat: 52.0,
        }),
      );

      const { vehicles, summary } = projection.getCurrentSnapshot();
      expect(vehicles[0].status).toBe("active");
      expect(vehicles[0].lat).toBe(52.0);
      expect(summary.delayedCount).toBe(0);
      expect(summary.total).toBe(1);
    });

    it("handles events across multiple vehicles correctly", () => {
      const projection = createProjection();
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "active" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-2", status: "delayed" }),
      );
      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-1", status: "active" }),
      );

      const { summary } = projection.getCurrentSnapshot();
      expect(summary.total).toBe(2);
      expect(summary.delayedCount).toBe(1);
      expect(summary.activeCount).toBe(1);
    });

    it("handles out-of-order timestamps correctly", () => {
      const projection = new FleetStatsProjection();

      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "active",
          timestamp: "2024-01-01T12:00:00Z",
        }),
      );

      // old event arrives late
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "delayed",
          timestamp: "2024-01-01T11:00:00Z",
        }),
      );

      const snapshot = projection.getCurrentSnapshot();

      expect(snapshot.vehicles[0].status).toBe("active");
      expect(snapshot.summary.delayedCount).toBe(0);
    });

    it("ignores events that arrive out of chronological order", () => {
      const projection = createProjection();

      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "active",
          timestamp: "2024-01-01T10:00:00Z",
        }),
      );

      // older event arrives second
      projection.handleUpdate(
        createVehicleStatusChangeEvent({
          vehicleId: "v-1",
          status: "delayed",
          timestamp: "2024-01-01T09:00:00Z",
        }),
      );

      const snapshot = projection.getCurrentSnapshot();
      expect(snapshot.vehicles[0].status).toBe("active");
      expect(snapshot.summary.delayedCount).toBe(0);
    });
  });

  describe("edge cases and robustness", () => {
    it("handles non-integer performance percentages gracefully", () => {
      const projection = createProjection();

      ["v-1", "v-2"].forEach((id) =>
        projection.handleUpdate(
          createVehicleStatusChangeEvent({ vehicleId: id, status: "active" }),
        ),
      );

      projection.handleUpdate(
        createVehicleStatusChangeEvent({ vehicleId: "v-3", status: "delayed" }),
      );

      const { summary } = projection.getCurrentSnapshot();
      expect(summary.performancePct).toBeCloseTo(66.666, 2);
    });

    it("protects against duplicate events to maintain idempotency", () => {
      const projection = createProjection();
      const event = createVehicleStatusChangeEvent({
        vehicleId: "v-1",
        status: "delayed",
      });

      projection.handleUpdate(event);
      projection.handleUpdate(event);

      expect(projection.getCurrentSnapshot().summary.delayedCount).toBe(1);
      expect(projection.totalCount).toBe(1);
    });
  });
});
