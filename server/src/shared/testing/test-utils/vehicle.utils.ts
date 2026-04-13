import { VehicleSnapshot } from "@modules/vehicle/core/dtos";
import { Vehicle } from "@modules/vehicle/core/entities";
import { VehicleStatus } from "@shared/types/vehicle.types";

export const createVehicleSnapshot = (
  overrides: Partial<VehicleSnapshot> = {},
): VehicleSnapshot => ({
  id: "vehicle-1",
  plateNumber: "AB12 CDE",
  status: VehicleStatus.Active,
  lat: 51.5,
  lng: -0.12,
  lastUpdated: new Date("2026-04-12T10:00:00Z").toISOString(),
  isSnapped: false,
  ...overrides,
});

export const createVehicleEntity = (overrides = {}) =>
  Vehicle.create({
    id: "vehicle-1",
    plateNumber: "AB12 CDE",
    lat: 51.5,
    lng: -0.12,
    status: VehicleStatus.Active,
    ...overrides,
  });

export const createVehicleLocationEvent = (overrides = {}) => ({
  vehicleId: "v-1",
  status: VehicleStatus.Active,
  plateNumber: "PLATE",
  lat: 0,
  lng: 0,
  timestamp: new Date().toISOString(),
  ...overrides,
});
