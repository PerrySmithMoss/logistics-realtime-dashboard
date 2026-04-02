"server-only";

import { AppError } from "@/shared/errors/app.errors";
import {
  FleetSnapshotError,
  VehicleNotFoundError,
} from "../errors/fleet.errors";
import { fleetRepository } from "../repositories/fleet.repository";
import { FleetSnapshot, FleetVehicle } from "../types";

export const fleetService = {
  getSnapshot: async (): Promise<FleetSnapshot> => {
    try {
      return await fleetRepository.getSnapshot();
    } catch (err) {
      if (AppError.isAppError(err)) throw err;
      throw new FleetSnapshotError(err);
    }
  },

  getVehicleById: async (id: string): Promise<FleetVehicle> => {
    try {
      return await fleetRepository.getVehicleById(id);
    } catch (err) {
      if (AppError.isAppError(err)) throw err;
      throw new VehicleNotFoundError(id);
    }
  },

  getDelayedVehicles: async (): Promise<FleetVehicle[]> => {
    try {
      const { vehicles } = await fleetRepository.getSnapshot();
      return vehicles.filter((v) => v.status === "delayed");
    } catch (err) {
      if (AppError.isAppError(err)) throw err;
      throw new FleetSnapshotError(err);
    }
  },

  getVehicleWithContext: async (id: string) => {
    try {
      const [vehicle, snapshot] = await Promise.all([
        fleetRepository.getVehicleById(id),
        fleetRepository.getSnapshot(),
      ]);

      return {
        vehicle,
        isWorstPerformer:
          snapshot.summary.delayedCount > 0 && vehicle.status === "delayed",
      };
    } catch (err) {
      if (AppError.isAppError(err)) throw err;
      throw new FleetSnapshotError(err);
    }
  },
};
