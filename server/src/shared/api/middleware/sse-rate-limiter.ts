import { AppErrorCodes } from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { createErrorResponse } from "@shared/utils/response.utils";
import { RequestHandler } from "express";

const DEFAULT_MESSAGES = {
  invalidIp: "Unable to verify client identity. Connection refused.",
  frequency: "Connection attempt throttled. Please wait a moment.",
  concurrency: "Maximum concurrent sessions reached for this resource.",
};

interface SseShieldOptions {
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
  options: SseShieldOptions = {},
): RequestHandler => {
  const {
    maxConcurrent = 3,
    minRetryMs = 2000,
    errorMessageResponses = {},
  } = options;

  const freqErrMsg =
    errorMessageResponses.frequencyErrorMessage ?? DEFAULT_MESSAGES.frequency;
  const concErrMsg =
    errorMessageResponses.concurrencyErrorMessage ??
    DEFAULT_MESSAGES.concurrency;
  const invalidIpErrMsg =
    errorMessageResponses.invalidIp ?? DEFAULT_MESSAGES.invalidIp;

  return async (req, res, next) => {
    const ip = req.ip;

    if (!ip) {
      logger.error(`[sseRateLimiter] Missing IP for ${req.path}`);
      return res.status(500).json(
        createErrorResponse(
          {
            message: invalidIpErrMsg,
            code: AppErrorCodes.InternalServerError,
            statusCode: 500,
          },
          req.path,
        ),
      );
    }

    const countKey = `sse:count:${req.path}:${ip}`;
    const retryKey = `sse:retry:${req.path}:${ip}`;

    const isThrottled = await cache.get(retryKey);
    const currentCount = (await cache.get<number>(countKey)) || 0;

    const remaining = Math.max(0, maxConcurrent - currentCount);

    res.setHeader("X-RateLimit-Limit", maxConcurrent);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(minRetryMs / 1000));

    // frequency check (rate limit)
    if (isThrottled) {
      return res.status(429).json(
        createErrorResponse(
          {
            message: freqErrMsg,
            code: AppErrorCodes.TooManyRequests,
            statusCode: 429,
          },
          req.path,
        ),
      );
    }

    if (currentCount >= maxConcurrent) {
      res.setHeader("X-RateLimit-Remaining", 0);
      return res.status(429).json(
        createErrorResponse(
          {
            message: concErrMsg,
            code: AppErrorCodes.TooManyRequests,
            statusCode: 429,
          },
          req.path,
        ),
      );
    }

    await cache.set(retryKey, true, minRetryMs);
    await cache.increment(countKey, 86400000);

    let finished = false;
    const cleanup = async () => {
      if (finished) return;
      finished = true;
      const remaining = await cache.decrement(countKey, 86400000);
      if (remaining <= 0) await cache.delete(countKey);
    };

    res.on("close", () =>
      cleanup().catch((e) => logger.error("SSE Cleanup Close Error", e)),
    );
    res.on("finish", () =>
      cleanup().catch((e) => logger.error("SSE Cleanup Finish Error", e)),
    );

    next();
  };
};
