import { IAppContainer } from "@app/interfaces/container.interface";
import { createVehicleRoutes } from "@modules/vehicle/api/vehicle.router";
import { Router } from "express";

export const createApiRouter = (
  controllers: IAppContainer["controllers"],
): Router => {
  const rootRouter = Router();

  rootRouter.get("/health", controllers.health.check);

  rootRouter.use("/vehicles", createVehicleRoutes(controllers.vehicle));

  return rootRouter;
};
