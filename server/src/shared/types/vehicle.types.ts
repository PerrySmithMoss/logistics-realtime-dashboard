export const VehicleStatus = {
  Active: "active",
  Inactive: "inactive",
  Delayed: "delayed",
  Maintenance: "maintenance",
} as const;

export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export interface VehicleProps {
  id: string;
  plateNumber: string;
  lat: number;
  lng: number;
  status: VehicleStatus;
  lastUpdated: Date;
}
