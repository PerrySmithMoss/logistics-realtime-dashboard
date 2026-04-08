import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";

export function isStatusChangeEvent(
  data: any,
): data is IVehicleStatusChangeEvent {
  return (
    !!data &&
    typeof data.vehicleId === "string" &&
    typeof data.plateNumber === "string" &&
    typeof data.status === "string" &&
    typeof data.lat === "number" &&
    typeof data.lng === "number" &&
    typeof data.timestamp === "string"
  );
}
