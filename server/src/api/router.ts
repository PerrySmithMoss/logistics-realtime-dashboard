import { IAppContainer } from "@app/interfaces/container.interface";
import { createFleetRoutes } from "@modules/fleet/api/fleet.router";
import { Router } from "express";

export const createApiRouter = (appContainer: IAppContainer): Router => {
  const rootRouter = Router();

  rootRouter.get("/health/live", appContainer.controllers.health.live);
  rootRouter.get("/health/ready", appContainer.controllers.health.ready);

  rootRouter.use(
    "/fleet",
    createFleetRoutes(appContainer.controllers.fleet, appContainer.logger, {
      internalAuthSecret: appContainer.config.server.internalAuthSecret,
      maxConcurrent: appContainer.config.modules.fleet.sse.maxConcurrent,
      minRetryMs: appContainer.config.modules.fleet.sse.minRetryMs,
    }),
  );

  return rootRouter;
};
