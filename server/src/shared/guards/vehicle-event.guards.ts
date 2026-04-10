import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";

export const isStatusChangeEvent = (
  data: any,
): data is IVehicleStatusChangeEvent => {
  return (
    !!data &&
    typeof data.vehicleId === "string" &&
    typeof data.plateNumber === "string" &&
    typeof data.status === "string" &&
    Number.isFinite(data.lat) &&
    Number.isFinite(data.lng) &&
    typeof data.timestamp === "string"
  );
};
