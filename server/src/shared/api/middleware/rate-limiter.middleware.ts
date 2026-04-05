import {
  InternalServerError,
  TooManyRequestsError,
} from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { RequestHandler } from "express";

export const rateLimiter = (
  cache: ICache,
  options: { windowMs: number; maxRequests: number; keyPrefix?: string },
): RequestHandler => {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;

  return async (req, res, next) => {
    const ip = req.ip;
    if (!ip) throw new InternalServerError("IP verification failed.");

    const key = `${keyPrefix}:${req.path}:${ip}`;

    const currentUsage = await cache.increment(key, windowMs);

    const resetSeconds = Math.ceil(windowMs / 1000);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Reset", resetSeconds);

    const remaining = Math.max(0, maxRequests - currentUsage);
    res.setHeader("X-RateLimit-Remaining", remaining);

    if (currentUsage > maxRequests) {
      res.setHeader("X-RateLimit-Remaining", 0);
      throw new TooManyRequestsError(
        "Too many requests. Please slow down.",
        resetSeconds,
      );
    }

    next();
  };
};
