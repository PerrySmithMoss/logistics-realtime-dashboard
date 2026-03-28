import { createErrorHandler, notFoundHandler } from "@api/middleware";
import { createApiRouter } from "api/router";
import express, { Express } from "express";
import { IAppContainer } from "./interfaces/container.interface";

export const createApp = (
  controllers: IAppContainer["controllers"],
  lifecycle: IAppContainer["lifecycle"],
): Express => {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  // app.use(requestIdMiddleware);

  app.use("/api/v1", createApiRouter(controllers));

  app.use(notFoundHandler);
  app.use(createErrorHandler(lifecycle));

  return app;
};
