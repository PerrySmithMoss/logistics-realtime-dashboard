export interface VehicleSnapshot {
  readonly id: string;
  readonly plateNumber: string;
  readonly status: "active" | "inactive" | "delayed" | "maintenance";
  readonly lat: number;
  readonly lng: number;
  readonly lastUpdated: string;
  readonly isSnapped?: boolean;
  readonly metadata?: Record<string, any>;
}
