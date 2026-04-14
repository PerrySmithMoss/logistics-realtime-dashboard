import { verifyServiceSecret } from "@shared/api/middleware";
import { ILogger } from "@shared/interfaces/logger.interface";
import { Router } from "express";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";

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
  vehicleRouter.patch("/:vehicleId/location", authGuard, controller.updateLocation);

  return vehicleRouter;
};
