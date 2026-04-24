import { IAppConfig } from "@config/index";
import { ErrorCode } from "@fleet/common/errors";
import { type ApiResponseContext, type ApiResponseOptions } from "@fleet/common/types";
import { AppError } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { createErrorResponse } from "@shared/utils/response.utils";
import { ErrorRequestHandler } from "express";

export const createErrorHandler = (logger: ILogger, config: IAppConfig): ErrorRequestHandler => {
  const options: ApiResponseOptions = {
    apiVersion: config.app.version,
    environment: config.server.env,
    isDev: config.server.isDev,
  };

  return (err, req, res, _next) => {
    const isAppError = err instanceof AppError;
    const error = err instanceof Error ? err : new Error(String(err));

    const statusCode = isAppError ? err.statusCode : 500;
    const code = isAppError ? err.code : ErrorCode.InternalServerError;
    const message = isAppError ? err.message : "Internal Server Error";
    const details = isAppError ? err.details : undefined;
    const retryAfter = isAppError ? err.retryAfterSeconds : undefined;

    const logLevel = !isAppError ? "critical" : statusCode >= 500 ? "error" : "warn";

    const shouldLogStack = config.server.isDev || logLevel === "error" || logLevel === "critical";

    logger[logLevel](`[${code}] ${req.method} ${req.path}`, {
      requestId: req.id ?? req.headers["x-request-id"],
      message: error.message,
      code,
      stack: shouldLogStack ? error.stack : undefined,
      details,
    });

    if (retryAfter) {
      res.setHeader("Retry-After", retryAfter.toString());
    }

    const context: ApiResponseContext = {
      requestId: req.id ?? String(req.headers["x-request-id"] ?? "unknown"),
      path: req.path,
      retryAfter,
    };

    res.status(statusCode).json(
      createErrorResponse(
        {
          message,
          code,
          statusCode,
          details,
          stack: config.server.isDev ? error.stack : undefined,
        },
        context,
        options,
      ),
    );
  };
};
