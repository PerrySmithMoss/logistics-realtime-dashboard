import { config } from "@config/index";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { ILifecycleManager } from "@shared/interfaces";
import { ErrorRequestHandler } from "express";

export const createErrorHandler = (
  lifecycle: ILifecycleManager,
): ErrorRequestHandler => {
  return (err, req, res, _next) => {
    const isOperational = err instanceof AppError;

    if (!isOperational) {
      console.error(`[FATAL] ${req.method} ${req.path} - ${err.stack}`);

      res.status(500).json({
        success: false,
        error: {
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
        },
      });

      lifecycle.prepareForShutdown();
      lifecycle.closeAll().finally(() => process.exit(1));
      return;
    }

    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        ...((err.details?.length ?? 0) > 0 && { details: err.details }),
        ...(config.server.isDev && { stack: err.stack }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  };
};
