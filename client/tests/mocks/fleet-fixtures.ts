import { FleetSnapshot, FleetVehicle } from "@/modules/fleet/types";

const makeVehicle = (
  overrides: Partial<FleetVehicle> & Pick<FleetVehicle, "id">,
): FleetVehicle => ({
  id: overrides.id,
  plateNumber: overrides.plateNumber ?? `${overrides.id}-PLATE`,
  lat: overrides.lat ?? 51.5074,
  lng: overrides.lng ?? -0.1278,
  status: overrides.status ?? "active",
  lastUpdated: overrides.lastUpdated ?? "2026-04-14T08:00:00.000Z",
  isSnapped: overrides.isSnapped ?? true,
});

export const buildSnapshot = (vehicles: FleetVehicle[]): FleetSnapshot => {
  const delayedCount = vehicles.filter((vehicle) => vehicle.status === "delayed").length;
  const activeCount = vehicles.filter((vehicle) => vehicle.status === "active").length;
  const total = vehicles.length;

  return {
    vehicles,
    summary: {
      total,
      activeCount,
      delayedCount,
      performancePct: total === 0 ? 0 : (activeCount / total) * 100,
    },
  };
};

export const initialFleetSnapshot = buildSnapshot([
  makeVehicle({ id: "VHC-101", status: "active", lat: 51.5074, lng: -0.1278 }),
  makeVehicle({ id: "VHC-202", status: "delayed", lat: 51.5081, lng: -0.1251 }),
  makeVehicle({ id: "VHC-303", status: "active", lat: 51.5094, lng: -0.1299 }),
]);

export const updatedFleetSnapshot = buildSnapshot([
  makeVehicle({ id: "VHC-101", status: "active", lat: 51.5077, lng: -0.1272 }),
  makeVehicle({ id: "VHC-202", status: "delayed", lat: 51.5092, lng: -0.1234 }),
  makeVehicle({ id: "VHC-303", status: "delayed", lat: 51.5106, lng: -0.1315 }),
]);
