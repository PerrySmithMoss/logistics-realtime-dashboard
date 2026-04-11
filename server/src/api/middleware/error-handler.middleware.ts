import { IAppConfig } from "@config/index";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import {
  ApiResponseContext,
  ApiResponseOptions,
} from "@shared/types/response.types";
import { createErrorResponse } from "@shared/utils/response.utils";
import { ErrorRequestHandler } from "express";

export const createErrorHandler = (
  logger: ILogger,
  config: IAppConfig,
): ErrorRequestHandler => {
  const options: ApiResponseOptions = {
    apiVersion: config.app.version,
    environment: config.server.env,
    isDev: config.server.isDev,
  };

  return (err, req, res, _next) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const isAppError = error instanceof AppError;

    const statusCode = isAppError ? error.statusCode : 500;
    const code = isAppError ? error.code : AppErrorCodes.InternalServerError;
    const message = isAppError ? error.message : "Internal Server Error";

    const details = isAppError ? error.details : undefined;
    const retryAfter = isAppError ? error.retryAfterSeconds : undefined;

    const logLevel = !isAppError || statusCode >= 500 ? "error" : "warn";
    logger[logLevel](`[${code}] ${req.method} ${req.path}`, {
      requestId: req.id,
      message: error.message,
      code,
      stack: error.stack,
      details,
    });

    if (retryAfter) {
      res.setHeader("Retry-After", retryAfter.toString());
    }

    const context: ApiResponseContext = {
      requestId: req.id,
      path: req.path,
      retryAfter,
    };

    return res.status(statusCode).json(
      createErrorResponse(
        {
          message,
          code,
          statusCode,
          details,
          stack: error.stack,
        },
        context,
        options,
      ),
    );
  };
};
