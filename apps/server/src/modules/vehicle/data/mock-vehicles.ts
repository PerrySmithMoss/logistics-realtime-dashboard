import { VehicleProps } from "@shared/types/vehicle.types";

export const mockVehicles: VehicleProps[] = [
  {
    id: "V-101",
    plateNumber: "LN66 ABC",
    status: "active",
    lat: 51.5074,
    lng: -0.1278,
    lastUpdated: new Date(),
  },
  {
    id: "V-102",
    plateNumber: "BX12 XYZ",
    status: "delayed",
    lat: 51.5078,
    lng: -0.1285,
    lastUpdated: new Date(),
  },
  {
    id: "V-103",
    plateNumber: "WR77 KJL",
    status: "active",
    lat: 51.5071,
    lng: -0.127,
    lastUpdated: new Date(),
  },
  {
    id: "V-104",
    plateNumber: "KP09 HGT",
    status: "active",
    lat: 51.508,
    lng: -0.1272,
    lastUpdated: new Date(),
  },
  {
    id: "V-105",
    plateNumber: "ZZ22 QWE",
    status: "delayed",
    lat: 51.5065,
    lng: -0.1282,
    lastUpdated: new Date(),
  },
];
