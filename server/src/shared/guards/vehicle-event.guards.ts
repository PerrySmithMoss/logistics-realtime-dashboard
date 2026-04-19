import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";

export const isStatusChangeEvent = (
  data: unknown, // Change from any to unknown
): data is IVehicleStatusChangeEvent => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.vehicleId === "string" &&
    typeof candidate.plateNumber === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lng) &&
    typeof candidate.timestamp === "string"
  );
};
