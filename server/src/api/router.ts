import { IAppContainer } from "@app/interfaces/container.interface";
import { createFleetRoutes } from "@modules/fleet/api/fleet.router";
import { createVehicleRoutes } from "@modules/vehicle/api/vehicle.router";
import { verifyServiceSecret } from "@shared/api/middleware";
import { Router } from "express";

export const createApiRouter = (appContainer: IAppContainer): Router => {
  const rootRouter = Router();

  rootRouter.get("/health/live", appContainer.controllers.health.live);
  rootRouter.get("/health/ready", appContainer.controllers.health.ready);

  const authGuard = verifyServiceSecret(appContainer.logger, {
    internalAuthSecret: appContainer.config.server.internalAuthSecret,
  });

  rootRouter.use(
    "/vehicles",
    createVehicleRoutes(appContainer.controllers.vehicle),
  );

  rootRouter.use(
    "/fleet",
    createFleetRoutes(appContainer.controllers.fleet, authGuard),
  );

  return rootRouter;
};
