import { sseRateLimiter, verifyServiceSecret } from "@shared/api/middleware";
import { ILogger } from "@shared/interfaces/logger.interface";
import { Router } from "express";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export const createFleetRoutes = (
  controller: IFleetController,
  logger: ILogger,
  config: {
    internalAuthSecret: string;
    maxConcurrent: number;
    minRetryMs: number;
  },
) => {
  const fleetRouter = Router();

  const authGuard = verifyServiceSecret(logger, {
    internalAuthSecret: config.internalAuthSecret,
  });

  const sseShield = sseRateLimiter(logger, {
    maxConcurrent: config.maxConcurrent,
    minRetryMs: config.minRetryMs,
  });

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
    sseShield,
    //   validateFleetStatsStreamRequest,
    controller.stream,
  );

  return fleetRouter;
};
