import { fc, it as fcIt } from "@fast-check/vitest";
import {
  BadRequestError,
  UnprocessableEntityError,
} from "@shared/errors/app.errors";
import { VehicleProps, VehicleStatus } from "@shared/types/vehicle.types";
import { describe, expect, it, vi } from "vitest";
import { Vehicle } from "../vehicle.entity";

const createVehicleProps = (overrides = {}): VehicleProps => ({
  id: "uuid-123",
  plateNumber: "PLATE-01",
  lat: 40.7128,
  lng: -74.006,
  status: VehicleStatus.Active as VehicleStatus,
  lastUpdated: new Date(),
  ...overrides,
});

const createMockVehicle = (overrides = {}) => {
  return Vehicle.create(createVehicleProps(overrides));
};

describe("Vehicle Entity", () => {
  describe("Entity Creation", () => {
    it("should successfully create a vehicle and set the lastUpdated timestamp", () => {
      const vehicle = createMockVehicle();

      expect(vehicle.id).toBe("uuid-123");
      expect(vehicle.status).toBe(VehicleStatus.Active);
      expect(vehicle.toSnapshot().lastUpdated).toBeDefined();
    });

    it("should throw BadRequestError if plateNumber is less than 5 characters", () => {
      const props = createVehicleProps({ plateNumber: "ABC" });

      expect(() => Vehicle.create(props)).toThrow(BadRequestError);
      expect(() => Vehicle.create(props)).toThrow(/at least 5 characters/);
    });

    it("should be resilient to external mutation of the props object after creation", () => {
      const myProps = createVehicleProps({ lat: 10 });
      const vehicle = Vehicle.create(myProps);

      myProps.lat = 99;

      expect(vehicle.toSnapshot().lat).toBe(10);
    });
  });

  describe("Position Logic & Guard Clauses", () => {
    it("should allow a valid coordinate update", () => {
      const vehicle = createMockVehicle();
      expect(() => vehicle.updatePosition(10, 10)).not.toThrow();
    });

    it("should update coordinates and refresh the lastUpdated timestamp", () => {
      vi.useFakeTimers();
      const vehicle = createMockVehicle();
      const initialTime = vehicle.toSnapshot().lastUpdated;

      vi.advanceTimersByTime(5000);
      vehicle.updatePosition(10.5, 20.5);

      const snapshot = vehicle.toSnapshot();
      expect(snapshot.lat).toBe(10.5);
      expect(snapshot.lng).toBe(20.5);
      expect(new Date(snapshot.lastUpdated).getTime()).toBeGreaterThan(
        new Date(initialTime).getTime(),
      );

      vi.useRealTimers();
    });

    it("should reject non-finite numbers (NaN/Infinity)", () => {
      const vehicle = createMockVehicle();
      expect(() => vehicle.updatePosition(NaN, 0)).toThrow(BadRequestError);
      expect(() => vehicle.updatePosition(Infinity, 0)).toThrow(
        BadRequestError,
      );
    });

    it("should throw UnprocessableEntityError if attempting update while in Maintenance", () => {
      const vehicle = createMockVehicle({ status: VehicleStatus.Maintenance });

      expect(() => vehicle.updatePosition(0, 0)).toThrow(
        UnprocessableEntityError,
      );
      expect(() => vehicle.updatePosition(0, 0)).toThrow(
        "Cannot update location while in maintenance.",
      );
    });

    it.each([
      [90, 180], // Maximum boundaries
      [-90, -180], // Minimum boundaries
      [90.0001, 0], // Just over the edge
      [0, 180.0001], // Just over the edge
    ])("manual boundary check: %f, %f", (lat, lng) => {
      const vehicle = createMockVehicle();
      const isValid = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

      if (isValid) {
        expect(() => vehicle.updatePosition(lat, lng)).not.toThrow();
      } else {
        expect(() => vehicle.updatePosition(lat, lng)).toThrow(BadRequestError);
      }
    });

    fcIt.prop([fc.float(), fc.float()])(
      "should only allow valid lat/lng coordinates and reject all others",
      (lat, lng) => {
        const vehicle = createMockVehicle({ status: VehicleStatus.Active });
        const isValid = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

        if (isValid) {
          expect(() => vehicle.updatePosition(lat, lng)).not.toThrow();
        } else {
          expect(() => vehicle.updatePosition(lat, lng)).toThrow(
            BadRequestError,
          );
        }
      },
    );
  });

  describe("Status Updates", () => {
    it("should allow updating to any valid VehicleStatus", () => {
      const vehicle = createMockVehicle({ status: VehicleStatus.Active });

      const statuses = [
        VehicleStatus.Inactive,
        VehicleStatus.Delayed,
        VehicleStatus.Maintenance,
      ];

      statuses.forEach((s) => {
        vehicle.updateStatus(s);
        expect(vehicle.status).toBe(s);
      });
    });

    it("should throw BadRequestError if an invalid status string is provided", () => {
      const vehicle = createMockVehicle();

      // @ts-expect-error - Testing runtime safety for non-TS consumers
      expect(() => vehicle.updateStatus("destroyed")).toThrow(BadRequestError);
    });
  });

  describe("Snapshot Integrity", () => {
    it("should return a frozen snapshot that protects internal state", () => {
      const vehicle = createMockVehicle({ lat: 40 });
      const snapshot = vehicle.toSnapshot();

      expect(Object.isFrozen(snapshot)).toBe(true);

      vehicle.updatePosition(50, 50);
      expect(snapshot.lat).toBe(40);
      expect(vehicle.toSnapshot().lat).toBe(50);
    });

    it("should correctly format lastUpdated as an ISO string in the snapshot", () => {
      const vehicle = createMockVehicle();
      const snapshot = vehicle.toSnapshot();

      expect(snapshot.lastUpdated).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });
  });
});
