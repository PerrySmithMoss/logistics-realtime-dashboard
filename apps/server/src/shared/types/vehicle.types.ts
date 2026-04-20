import {
  type VehicleStatus as FleetCommonVehicleStatus,
  VehicleStatus as FleetCommonVehicleStatusValues,
} from "@fleet/common/types";

export const VehicleStatus = FleetCommonVehicleStatusValues;
export type VehicleStatus = FleetCommonVehicleStatus;

export interface VehicleProps {
  id: string;
  plateNumber: string;
  lat: number;
  lng: number;
  status: VehicleStatus;
  lastUpdated: Date;
}
