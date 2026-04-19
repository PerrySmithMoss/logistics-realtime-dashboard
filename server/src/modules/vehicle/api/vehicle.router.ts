import { validateRequest, verifyServiceSecret } from "@shared/api/middleware";
import { ILogger } from "@shared/interfaces/logger.interface";
import { Router } from "express";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";
import { updateVehicleLocationSchema } from "./vehicle.schemas";

export const createVehicleRoutes = (
  controller: IVehicleController,
  logger: ILogger,
  config: { internalAuthSecret: string },
) => {
  const vehicleRouter = Router();
  const authGuard = verifyServiceSecret(logger, {
    internalAuthSecret: config.internalAuthSecret,
  });

  vehicleRouter.get("/", authGuard, controller.list);
  vehicleRouter.patch(
    "/:vehicleId/location",
    authGuard,
    validateRequest(updateVehicleLocationSchema),
    controller.updateLocation,
  );

  return vehicleRouter;
};
