export type SseConnectionStatus = "connecting" | "connected" | "error";

import type { FleetVehicle } from "@fleet/common/types";

export {
  VehicleStatus,
  type FleetSnapshot,
  type FleetSummary,
  type FleetVehicle,
  type VehicleSnapshot,
} from "@fleet/common/types";

export interface FleetMapHandle {
  zoomToVehicle: (lng: number, lat: number) => void;
  openPopup: (vehicle: FleetVehicle) => void;
}
