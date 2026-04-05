import { createErrorHandler, notFoundHandler } from "@api/middleware";
import { IAppConfig } from "@config/index";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { createHealthRouter } from "@shared/api/health.router";
import { rateLimiter } from "@shared/api/middleware";
import { consoleLogger } from "@shared/infrastructure/logger";
import { ILogger } from "@shared/interfaces/logger.interface";
import { createApiRouter } from "api/router";
import express from "express";
import { AppContainer } from "./container";
import { IAppContainer } from "./interfaces/container.interface";
import { IServer } from "./interfaces/server.interface";
import { HttpServer } from "./server";

export class Application {
  private server?: IServer;
  private container?: IAppContainer;
  private logger?: ILogger;

  constructor(private readonly config: IAppConfig) {}

  public async start() {
    try {
      this.container = await AppContainer.create(this.config);
      this.logger = this.container.appLogger;

      const expressApp = express();

      expressApp.set("trust proxy", true);
      expressApp.use(express.json({ limit: "1mb" }));

      // TODO: add this middleware
      // app.use(requestIdMiddleware);

      expressApp.use(
        "/health",
        createHealthRouter(this.container.controllers.health),
      );

      const globalRateLimit = rateLimiter(this.container.cache, {
        windowMs: 60000,
        maxRequests: 100,
        keyPrefix: "rl:global",
      });

      expressApp.use(globalRateLimit);

      expressApp.use("/api/v1", createApiRouter(this.container));

      expressApp.use(notFoundHandler);
      expressApp.use(createErrorHandler(this.container.errorLogger));

      this.runBackgroundHydration(this.container.fleetDataService);

      this.server = new HttpServer(expressApp, this.container.serverLogger);
      await this.server.start(this.config.server);

      this.logStartupStatus();
      return this;
    } catch (err) {
      (this.logger ?? console).error(
        "CRITICAL: Failed to start application:",
        err,
      );
      process.exit(1);
    }
  }

  private async runBackgroundHydration(dataService: IFleetDataService) {
    try {
      await dataService.hydrate();
    } catch (err) {
      this.logger.critical(
        "Background Hydration failed. Fleet data will be unavailable.",
        err,
      );
    }
  }

  private logStartupStatus() {
    const { port, env, host, isDev } = this.config.server;
    const protocol = isDev ? "http" : "https";

    (this.logger ?? console).info("System Online:", {
      PID: process.pid,
      URL: `${protocol}://${host}:${port}`,
      ENV: `${env.toUpperCase()}`,
      STATUS: "Ready",
    });
  }

  public async shutdown(signal: string) {
    const activeLogger = this.logger || consoleLogger;

    activeLogger.warn(`Shutdown initiated via ${signal}`);

    if (!this.container || !this.server) {
      activeLogger.info("Services not initialised. Exiting process.");
      process.exit(0);
    }

    this.container.lifecycle.prepareForShutdown();

    const forceExitTimeout = this.config.server.isDev ? 3000 : 10000;
    const forceExit = setTimeout(() => {
      activeLogger.error(
        `Cleanup timed out after ${forceExitTimeout}ms. Forcing exit.`,
      );
      process.exit(1);
    }, forceExitTimeout);

    if (!this.config.server.isDev) {
      activeLogger.info("Waiting 3s for resources to drain...");
      await new Promise((r) => setTimeout(r, 3000));
    }

    try {
      activeLogger.info(
        "Stopping HTTP server and closing database connections...",
      );

      await Promise.all([
        this.server.stop(),
        this.container.lifecycle.closeAll(),
      ]);

      clearTimeout(forceExit);
      activeLogger.info("Shutdown successful.");
      process.exit(0);
    } catch (err) {
      activeLogger.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  }
}
