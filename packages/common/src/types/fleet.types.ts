export const VehicleStatus = {
  Active: "active",
  Inactive: "inactive",
  Delayed: "delayed",
  Maintenance: "maintenance",
} as const;

export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export interface VehicleSnapshot {
  readonly id: string;
  readonly plateNumber: string;
  readonly status: VehicleStatus;
  readonly lat: number;
  readonly lng: number;
  readonly lastUpdated: string;
  readonly isSnapped?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export type FleetVehicle = VehicleSnapshot;

export interface FleetSummary {
  total: number;
  activeCount: number;
  delayedCount: number;
  performancePct: number;
}

export interface FleetSnapshot {
  vehicles: FleetVehicle[];
  summary: FleetSummary;
}
