"use server";

import { fleetService } from "../services/fleet.service";
import { FleetSnapshot } from "../types";

export const getSnapshotAction = async (): Promise<FleetSnapshot> => {
  return fleetService.getSnapshot();
};

export const getVehicleAction = async (vehicleId: string) => {
  return fleetService.getVehicleById(vehicleId);
};
