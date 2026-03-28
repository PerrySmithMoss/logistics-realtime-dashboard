import { IAppContainer } from "@app/interfaces/container.interface";
import { createFleetRoutes } from "@modules/fleet/api/fleet.router";
import { createVehicleRoutes } from "@modules/vehicle/api/vehicle.router";
import { Router } from "express";

export const createApiRouter = (
  controllers: IAppContainer["controllers"],
): Router => {
  const rootRouter = Router();

  rootRouter.get("/health/live", controllers.health.live);
  rootRouter.get("/health/ready", controllers.health.ready);

  rootRouter.use("/vehicles", createVehicleRoutes(controllers.vehicle));

  rootRouter.use("/fleet", createFleetRoutes(controllers.fleet));

  return rootRouter;
};
