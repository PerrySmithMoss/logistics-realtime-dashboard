import { createErrorHandler, notFoundHandler, requestIdMiddleware } from "@api/middleware";
import { createApiRouter } from "@api/router";
import { createTestRouter } from "@api/test.router";
import { IAppConfig } from "@config/index";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { createHealthRouter } from "@shared/api/health.router";
import { rateLimiter } from "@shared/api/middleware";
import { InternalServerError } from "@shared/errors/app.errors";
import { consoleLogger } from "@shared/infrastructure/logger";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import express, { Express } from "express";
import helmet from "helmet";
import { AppContainer } from "./container";
import { IAppContainer } from "./interfaces/container.interface";
import { IServer } from "./interfaces/server.interface";
import { HttpServer } from "./server";

export class Application {
  private server?: IServer;
  private container?: IAppContainer;
  private logger?: ILogger;
  private expressApp?: Express;

  constructor(private readonly config: IAppConfig) {}

  public async bootstrap(options: { geoSnappingService?: IGeoSnappingService } = {}) {
    if (this.container && this.expressApp) return this;

    this.container = await AppContainer.create(this.config, options);
    this.logger = this.container.appLogger;
    this.expressApp = this.buildExpressApp(this.container);

    this.runBackgroundHydration(this.container.fleetDataService);

    return this;
  }

  public async start(options: { geoSnappingService?: IGeoSnappingService } = {}) {
    try {
      await this.bootstrap(options);

      if (!this.expressApp || !this.container) {
        throw new InternalServerError(
          "Application bootstrap failed",
          "this.expressApp or this.container is falsy",
          false,
        );
      }

      this.server = new HttpServer(this.expressApp, this.container.serverLogger);
      await this.server.start(this.config.server);

      this.logStartupStatus();
      return this;
    } catch (err) {
      (this.logger ?? console).error("CRITICAL: Failed to start application:", err);
      process.exit(1);
    }
  }

  public getServer(): Express {
    if (!this.expressApp) {
      throw new InternalServerError(
        "Application has not been bootstrapped",
        "this.expressApp is falsy",
        false,
      );
    }

    return this.expressApp;
  }

  public getContainer(): IAppContainer {
    if (!this.container) {
      throw new InternalServerError(
        "Application has not been bootstrapped",
        "this.container is falsy",
        false,
      );
    }

    return this.container;
  }

  public async dispose(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = undefined;
    }

    if (this.container) {
      await this.container.lifecycle.closeAll();
    }

    this.container = undefined;
    this.logger = undefined;
    this.expressApp = undefined;
  }

  private buildExpressApp(container: IAppContainer): Express {
    const expressApp = express();

    expressApp.use(
      helmet({
        // handled by reverse proxy (traefik)
        strictTransportSecurity: false,
        xFrameOptions: false,
        xContentTypeOptions: false,

        // app specific
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    expressApp.set("trust proxy", true);

    expressApp.use(requestIdMiddleware);
    expressApp.use(express.json({ limit: "1mb" }));

    expressApp.use("/health", createHealthRouter(container.controllers.health));

    const globalRateLimit = rateLimiter(container.cache, {
      windowMs: 60000,
      maxRequests: 100,
      keyPrefix: "rl:global",
    });

    expressApp.use(globalRateLimit);
    expressApp.use("/api/v1", createApiRouter(container));

    if (this.config.server.isTest) {
      const resetFn = container.resetForTesting;

      if (typeof resetFn !== "function") {
        throw new InternalServerError(
          "Test Infrastructure Failure: 'resetForTesting' is missing or not a function",
          "Check container registration inside AppContainer",
          false,
        );
      }

      const testRouter = createTestRouter({
        reset: () => resetFn(),
      });

      expressApp.use("/api/test", testRouter);
    }

    expressApp.use(notFoundHandler);
    expressApp.use(createErrorHandler(container.errorLogger, this.config));

    return expressApp;
  }

  private async runBackgroundHydration(dataService: IFleetDataService) {
    try {
      await dataService.hydrate();
    } catch (err) {
      (this.logger || consoleLogger).critical(
        "Background hydration failed. Initiating shutdown.",
        err,
      );
      await this.shutdown("HYDRATION_FAILURE");
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
      activeLogger.error(`Cleanup timed out after ${forceExitTimeout}ms. Forcing exit.`);
      process.exit(1);
    }, forceExitTimeout);

    if (!this.config.server.isDev) {
      activeLogger.info("Waiting 3s for resources to drain...");
      await new Promise((r) => setTimeout(r, 3000));
    }

    try {
      activeLogger.info("Stopping HTTP server and closing database connections...");

      await Promise.all([this.server.stop(), this.container.lifecycle.closeAll()]);

      clearTimeout(forceExit);
      activeLogger.info("Shutdown successful.");
      process.exit(0);
    } catch (err) {
      activeLogger.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  }
}
