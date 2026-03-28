import { Router } from "express";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export const createFleetRoutes = (controller: IFleetController) => {
  const fleetRouter = Router();

  fleetRouter.get(
    "/snapshot",
    // authmiddleware
    //  snapshotRateLimit,
    //     validateFleetSnapshotRequest,
    controller.getSnapshot,
  );

  fleetRouter.get(
    "/stats/stream",
    // authmiddleware
    // streamRateLimit,       // ✅ stop reconnect storms
    //   sseConnectionLimiter,  // ✅ stop tab-farming a single IP
    //   validateFleetStatsStreamRequest,
    controller.stream,
  );

  return fleetRouter;
};
