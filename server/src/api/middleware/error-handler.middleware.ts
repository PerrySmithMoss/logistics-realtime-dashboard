import { config } from "@config/index";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { ILogger } from "@shared/interfaces/logger.interface";
import { ErrorRequestHandler } from "express";

export const createErrorHandler = (logger: ILogger): ErrorRequestHandler => {
  return (err, req, res, _next) => {
    const isOperational = err instanceof AppError;

    if (!isOperational) {
      logger.error(`Unexpected Error: ${req.method} ${req.path}`, {
        message: err.message,
        stack: err.stack,
      });

      res.status(500).json({
        success: false,
        data: null,
        error: {
          message: "Internal Server Error",
          code: AppErrorCodes.InternalServerError,
          statusCode: 500,
        },
        meta: {
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });

      return;
    }

    logger.warn(`Operational Error: ${err.message}`, {
      code: err.code,
      path: req.path,
    });

    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        ...(err.details?.length && { details: err.details }),
        ...(config.server.isDev && { stack: err.stack }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  };
};
