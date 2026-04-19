import { rateLimiter, sseRateLimiter, verifyServiceSecret } from "@shared/api/middleware";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { Router } from "express";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export const createFleetRoutes = (
  controller: IFleetController,
  logger: ILogger,
  cache: ICache,
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

  const snapshotRateLimit = rateLimiter(cache, {
    windowMs: 60000,
    maxRequests: 30,
    keyPrefix: "rl:fleet:snapshot",
  });

  const sseRateLimit = sseRateLimiter(logger, cache, {
    maxConcurrent: config.maxConcurrent,
    minRetryMs: config.minRetryMs,
    errorMessageResponses: {
      concurrencyErrorMessage: "Please close other dashboard tabs to continue.",
    },
  });

  fleetRouter.get("/snapshot", authGuard, snapshotRateLimit, controller.getSnapshot);

  fleetRouter.get("/stream", authGuard, sseRateLimit, controller.stream);

  return fleetRouter;
};
