import { UnauthorisedError } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { RequestHandler } from "express";

export const verifyServiceSecret = (
  logger: ILogger,
  { internalAuthSecret }: { internalAuthSecret: string },
): RequestHandler => {
  return (req, _res, next) => {
    const incomingSecret = req.headers["x-internal-secret"];

    if (!incomingSecret || incomingSecret !== internalAuthSecret) {
      logger.warn(
        `[Auth] Failed attempt from ${req.ip}. ${!incomingSecret ? "Missing header" : "Invalid value"}`,
      );
      throw new UnauthorisedError();
    }

    next();
  };
};
