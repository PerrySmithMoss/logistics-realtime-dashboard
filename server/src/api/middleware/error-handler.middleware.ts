import { config } from "@config/index";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { createErrorResponse } from "@shared/utils/response.utils";
import { ErrorRequestHandler } from "express";

export const createErrorHandler = (logger: ILogger): ErrorRequestHandler => {
  return (err, req, res, _next) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const isOperational = error instanceof AppError;

    const statusCode = isOperational ? error.statusCode : 500;
    const code = isOperational ? error.code : AppErrorCodes.InternalServerError;
    const message = isOperational ? error.message : "Internal Server Error";
    const details = isOperational ? error.details : undefined;
    const retryAfter =
      error instanceof AppError ? error.retryAfterSeconds : undefined;

    if (!isOperational) {
      logger.error(`[Unexpected Error] ${req.method} ${req.path}`, {
        requestId: req.id,
        message: error.message,
        stack: error.stack,
      });
    } else if (statusCode === 429 || statusCode === 403 || statusCode === 401) {
      logger.warn(`[Security/Limit] ${message}`, {
        requestId: req.id,
        code,
        path: req.path,
        ip: req.ip,
      });
    }

    return res.status(statusCode).json(
      createErrorResponse(
        {
          message,
          code,
          statusCode,
          details: details?.length ? details : undefined,
          stack: config.server.isDev ? error.stack : undefined,
        },
        { requestId: req.id, path: req.path, retryAfter },
        config.server.isDev,
      ),
    );
  };
};
