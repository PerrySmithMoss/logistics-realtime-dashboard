import { RequestHandler, Router } from "express";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export const createFleetRoutes = (
  controller: IFleetController,
  authGuard: RequestHandler,
) => {
  const fleetRouter = Router();

  fleetRouter.get(
    "/snapshot",
    authGuard,
    //  snapshotRateLimit,
    //     validateFleetSnapshotRequest,
    controller.getSnapshot,
  );

  fleetRouter.get(
    "/stats/stream",
    authGuard,
    // streamRateLimit,       // ✅ stop reconnect storms
    //   sseConnectionLimiter,  // ✅ stop tab-farming a single IP
    //   validateFleetStatsStreamRequest,
    controller.stream,
  );

  return fleetRouter;
};
