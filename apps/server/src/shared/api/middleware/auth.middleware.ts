import { UnauthorisedError } from "@shared/errors/app.errors";
import { IStreamTokenService } from "@shared/interfaces";
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

export const verifyStreamToken = (
  logger: ILogger,
  streamTokenService: IStreamTokenService,
): RequestHandler => {
  return async (req, _res, next) => {
    const rawToken = req.query.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token || typeof token !== "string") {
      logger.warn(`[Auth] Failed stream token attempt from ${req.ip}. Missing query token`);
      throw new UnauthorisedError();
    }

    await streamTokenService.verify(token, { ip: req.ip });
    next();
  };
};
