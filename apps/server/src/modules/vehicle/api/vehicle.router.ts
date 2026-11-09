import { validateRequest, verifyServiceSecret } from "@shared/api/middleware";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { json, Router } from "express";
import { STATUS_CODES } from "node:http";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";
import { updateVehicleLocationSchema } from "./vehicle.schemas";

export const createVehicleRoutes = (
  controller: IVehicleController,
  logger: ILogger,
  config: { internalAuthSecret: string },
): Router => {
  const vehicleRouter = Router();
  const authGuard = verifyServiceSecret(logger, {
    internalAuthSecret: config.internalAuthSecret,
  });
  const parseJson = json({ limit: "1mb" });

  vehicleRouter.get("/", authGuard, controller.list);
  vehicleRouter.patch(
    "/:vehicleId/location",
    authGuard,
    (req, res, next) => {
      parseJson(req, res, (error?: { status?: number }) => {
        const status = error?.status;
        if (status && status >= 400 && status < 500) {
          // JSON parser errors may include raw request content in their messages.
          next(
            new AppError(
              STATUS_CODES[status] ?? "Invalid request body",
              AppErrorCodes.BadRequest,
              status,
            ),
          );
          return;
        }
        next(error);
      });
    },
    validateRequest(updateVehicleLocationSchema),
    controller.updateLocation,
  );

  return vehicleRouter;
};
