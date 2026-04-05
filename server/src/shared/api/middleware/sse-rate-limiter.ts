import { AppErrorCodes } from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { createErrorResponse } from "@shared/utils/response.utils";
import { RequestHandler } from "express";

interface SseShieldOptions {
  maxConcurrent?: number;
  minRetryMs?: number;
  errorMessageResponses?: {
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
    errorMessageResponses = {
      frequencyErrorMessage:
        "Connection attempt throttled. Please wait a moment.",
      concurrencyErrorMessage:
        "Maximum concurrent sessions reached for this resource.",
    },
  } = options;

  return async (req, res, next) => {
    const ip = req.ip;

    if (!ip) {
      logger.error(
        `[sseRateLimiter] Execution blocked: Missing IP for ${req.path}`,
      );
      return res.status(500).json(
        createErrorResponse(
          {
            message: "Unable to verify client identity. Connection refused.",
            code: AppErrorCodes.InternalServerError,
            statusCode: 500,
          },
          req.path,
        ),
      );
    }

    const countKey = `sse:count:${req.path}:${ip}`;
    const retryKey = `sse:retry:${req.path}:${ip}`;

    // frequency check (rate limit)
    const isThrottled = await cache.get(retryKey);
    if (isThrottled) {
      return res.status(429).json(
        createErrorResponse(
          {
            message: errorMessageResponses.frequencyErrorMessage,
            code: AppErrorCodes.TooManyRequests,
            statusCode: 429,
          },
          req.path,
        ),
      );
    }

    // concurrency check (connection limit)
    const currentCount = (await cache.get<number>(countKey)) || 0;
    if (currentCount >= maxConcurrent) {
      return res.status(429).json(
        createErrorResponse(
          {
            message: errorMessageResponses.concurrencyErrorMessage,
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
      cleanup().catch((e) => logger.error("SSE Cleanup Error", e)),
    );
    res.on("finish", () =>
      cleanup().catch((e) => logger.error("SSE Cleanup Error", e)),
    );

    next();
  };
};
