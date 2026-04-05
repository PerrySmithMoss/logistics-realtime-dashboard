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
    const currentUsage = (await cache.get<number>(key)) || 0;

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - (currentUsage + 1)),
    );

    if (currentUsage >= maxRequests) {
      res.setHeader("X-RateLimit-Remaining", 0);
      throw new TooManyRequestsError(
        "Too many requests. Please slow down.",
        Math.ceil(windowMs / 1000),
      );
    }

    if (currentUsage === 0) {
      await cache.set(key, 1, windowMs);
    } else {
      await cache.increment(key, windowMs);
    }

    next();
  };
};
