export interface IStatusChangeEvent {
  readonly vehicleId: string;
  readonly plateNumber: string;
  readonly status: "active" | "inactive" | "delayed" | "maintenance";
  readonly lat: number;
  readonly lng: number;
  readonly timestamp: string;
  readonly isSnapped?: boolean;
}
