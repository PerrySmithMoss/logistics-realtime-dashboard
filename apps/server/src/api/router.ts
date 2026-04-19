import { IAppContainer } from "@app/interfaces/container.interface";
import { createFleetRoutes } from "@modules/fleet/api/fleet.router";
import { createVehicleRoutes } from "@modules/vehicle/api/vehicle.router";
import { Router } from "express";

export const createApiRouter = (appContainer: IAppContainer): Router => {
  const rootRouter = Router();

  const { controllers, logger, cache, config } = appContainer;

  rootRouter.use(
    "/fleet",
    createFleetRoutes(controllers.fleet, logger, cache, {
      internalAuthSecret: config.server.internalAuthSecret,
      maxConcurrent: config.modules.fleet.sse.maxConcurrent,
      minRetryMs: config.modules.fleet.sse.minRetryMs,
    }),
  );

  rootRouter.use(
    "/vehicles",
    createVehicleRoutes(controllers.vehicle, logger, {
      internalAuthSecret: config.server.internalAuthSecret,
    }),
  );

  return rootRouter;
};
