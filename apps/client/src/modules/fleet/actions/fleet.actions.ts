"use server";

import { type FleetSnapshot } from "@fleet/common/types";
import { fleetService } from "../services/fleet.service";

export const getSnapshotAction = async (): Promise<FleetSnapshot> => {
  return fleetService.getSnapshot();
};

export const getVehicleAction = async (vehicleId: string) => {
  return fleetService.getVehicleById(vehicleId);
};
