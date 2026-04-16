import { VehicleStatus } from "../types";

const VEHICLE_MARKER_STYLES: Record<VehicleStatus, string> = {
  active: "border-emerald-200 bg-emerald-500 text-emerald-950",
  delayed: "border-red-200 bg-red-500 text-red-950",
  inactive: "border-slate-200 bg-slate-400 text-slate-950",
  maintenance: "border-amber-200 bg-amber-400 text-amber-950",
};

export const getVehicleMarkerStyles = (status: VehicleStatus): string =>
  VEHICLE_MARKER_STYLES[status];

interface VehicleMarkerProps {
  vehicleId: string;
  status: VehicleStatus;
}

export const VehicleMarker = ({ vehicleId, status }: VehicleMarkerProps) => {
  return (
    <span
      role="img"
      aria-label={`${vehicleId} ${status} vehicle marker`}
      data-vehicle-id={vehicleId}
      data-status={status}
      className={`inline-flex h-3.5 w-3.5 rounded-full border-2 ${getVehicleMarkerStyles(status)}`}
      title={`${vehicleId} (${status})`}
    />
  );
};
