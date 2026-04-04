import { AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { RequestHandler } from "express";

interface ClientState {
  readonly count: number;
  readonly lastConnect: number;
}

const clientRegistry = new Map<string, ClientState>();

interface SseShieldOptions {
  maxConcurrent?: number;
  minRetryMs?: number;
}

export const sseRateLimiter = (
  logger: ILogger,
  options: SseShieldOptions = {},
): RequestHandler => {
  const { maxConcurrent = 3, minRetryMs = 2000 } = options;

  return (req, res, next) => {
    const ip = req.ip;

    if (!ip) {
      logger.warn(`Missing IP from ${req.path}`);
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          message: "Source IP could not be identified",
          code: AppErrorCodes.MissingIdentifier,
          statusCode: 400,
        },
        meta: { timestamp: new Date().toISOString(), path: req.path },
      });
    }

    const now = Date.now();
    const data = clientRegistry.get(ip) || { count: 0, lastConnect: 0 };

    // frequency check (rate limit)
    if (now - data.lastConnect < minRetryMs) {
      logger.warn(`Rate limit hit for ${ip}`);
      return res.status(429).json({
        success: false,
        data: null,
        error: {
          message: "Reconnecting too fast. Please wait.",
          code: AppErrorCodes.TooManyRequests,
          statusCode: 429,
        },
        meta: { timestamp: new Date().toISOString(), path: req.path },
      });
    }
    // concurrency check (connection limit)
    if (data.count >= maxConcurrent) {
      logger.warn(`[sseShield] Max connections reached for ${ip}`);
      return res.status(429).json({
        success: false,
        data: null,
        error: {
          message: "Maximum dashboard tabs reached.",
          code: AppErrorCodes.TooManyRequests,
          statusCode: 429,
        },
        meta: { timestamp: new Date().toISOString(), path: req.path },
      });
    }

    clientRegistry.set(ip, {
      count: data.count + 1,
      lastConnect: now,
    });

    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;

      const current = clientRegistry.get(ip);
      if (!current) return;

      if (current.count <= 1) {
        // last connection for this IP
        clientRegistry.delete(ip);
      } else {
        clientRegistry.set(ip, {
          ...current,
          count: current.count - 1,
        });
      }
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);

    next();
  };
};
