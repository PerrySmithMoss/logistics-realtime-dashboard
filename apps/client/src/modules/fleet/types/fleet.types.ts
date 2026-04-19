export type SseConnectionStatus = "connecting" | "connected" | "error";

export type VehicleStatus = "active" | "inactive" | "delayed" | "maintenance";

export interface FleetVehicle {
  id: string;
  plateNumber: string;
  lat: number;
  lng: number;
  status: VehicleStatus;
  lastUpdated: string;
  isSnapped: boolean;
}

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

export interface FleetMapHandle {
  zoomToVehicle: (lng: number, lat: number) => void;
  openPopup: (vehicle: FleetVehicle) => void;
}
