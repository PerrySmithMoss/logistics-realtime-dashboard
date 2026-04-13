import { InternalServerError, TooManyRequestsError } from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { RequestHandler } from "express";

const DEFAULT_MESSAGES = {
  invalidIp: "Unable to verify client identity. Connection refused.",
  frequency: "Connection attempt throttled. Please wait a moment.",
  concurrency: "Maximum concurrent sessions reached for this resource.",
};

export interface SseRateLimiterOptions {
  maxConcurrent?: number;
  minRetryMs?: number;
  errorMessageResponses?: {
    invalidIp?: string;
    frequencyErrorMessage?: string;
    concurrencyErrorMessage?: string;
  };
}

export const sseRateLimiter = (
  logger: ILogger,
  cache: ICache,
  options: SseRateLimiterOptions = {},
): RequestHandler => {
  const { maxConcurrent = 3, minRetryMs = 2000, errorMessageResponses = {} } = options;

  const freqErrMsg = errorMessageResponses.frequencyErrorMessage ?? DEFAULT_MESSAGES.frequency;
  const concErrMsg = errorMessageResponses.concurrencyErrorMessage ?? DEFAULT_MESSAGES.concurrency;
  const invalidIpErrMsg = errorMessageResponses.invalidIp ?? DEFAULT_MESSAGES.invalidIp;

  return async (req, res, next) => {
    const ip = req.ip;
    if (!ip) throw new InternalServerError(invalidIpErrMsg);

    const countKey = `sse:count:${req.path}:${ip}`;
    const retryKey = `sse:retry:${req.path}:${ip}`;

    // 1. Check frequency (Rate Limit) first - this is still a 'get'
    const isThrottled = await cache.get(retryKey);
    const resetSeconds = Math.ceil(minRetryMs / 1000);

    res.setHeader("X-RateLimit-Limit", maxConcurrent);
    res.setHeader("X-RateLimit-Reset", resetSeconds);

    // frequency check (rate limit)
    if (isThrottled) {
      res.setHeader("X-RateLimit-Remaining", 0);
      throw new TooManyRequestsError(freqErrMsg, resetSeconds);
    }

    // concurrency check (connection limit)
    const currentCount = await cache.increment(countKey, 86400000);

    if (currentCount > maxConcurrent) {
      await cache.decrement(countKey, 86400000);
      res.setHeader("X-RateLimit-Remaining", 0);
      throw new TooManyRequestsError(concErrMsg);
    }

    const remaining = maxConcurrent - currentCount;
    res.setHeader("X-RateLimit-Remaining", remaining);

    await cache.set(retryKey, true, minRetryMs);

    let finished = false;
    const cleanup = async () => {
      if (finished) return;
      finished = true;

      try {
        const remainingAfterDrop = await cache.decrement(countKey, 86400000);
        if (remainingAfterDrop <= 0) {
          await cache.delete(countKey);
        }
      } catch (e) {
        logger.error("SSE Cleanup Error", e);
      }
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);

    next();
  };
};
