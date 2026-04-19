import { VehicleStatus } from "@shared/types/vehicle.types";
import { z } from "zod";

const vehicleIdSchema = z.string().trim().min(1, {
  message: "Vehicle id is required.",
});

export const updateVehicleLocationSchema = {
  params: z.object({
    vehicleId: vehicleIdSchema,
  }),
  body: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      status: z.enum(VehicleStatus),
    })
    .strict(),
} as const;
