import { AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { RequestHandler } from "express";

export const verifyServiceSecret = (
  logger: ILogger,
  { internalAuthSecret }: { internalAuthSecret: string },
): RequestHandler => {
  return (req, res, next) => {
    const incomingSecret = req.headers["x-internal-secret"];

    if (!incomingSecret || incomingSecret !== internalAuthSecret) {
      logger.warn(
        `[verifyServiceSecret] Unauthorised access attempt from ${req.ip}`,
      );

      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: "Unauthorised",
          code: AppErrorCodes.Unauthorised,
          statusCode: 401,
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }

    next();
  };
};
