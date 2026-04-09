import { VehicleStatus } from "@shared/types/vehicle.types";

export interface GetVehicleDetailsRequest {
  vehicleId: string;
}

export interface GetVehicleDetailsResponse {
  id: string;
  plateNumber: string;
  status: VehicleStatus;
  lat: number;
  lng: number;
}

export const GET_VEHICLE_DETAILS_QRY = "VEHICLE.GET_DETAILS";

declare module "@shared/bus/query/query-registry" {
  interface GlobalQueryRegistry {
    [GET_VEHICLE_DETAILS_QRY]: {
      request: GetVehicleDetailsRequest;
      response: GetVehicleDetailsResponse;
    };
  }
}
