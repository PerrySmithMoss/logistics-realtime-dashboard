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

    if (!isOperational) {
      logger.error(`[Unexpected Error] ${req.method} ${req.path}`, {
        message: error.message,
        stack: error.stack,
        body: req.body,
      });
    } else {
      logger.warn(`[Operational Error] ${message}`, {
        code,
        path: req.path,
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
        req.path,
      ),
    );
  };
};
