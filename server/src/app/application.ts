import { createErrorHandler, notFoundHandler } from "@api/middleware";
import { config } from "@config/index";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { createApiRouter } from "api/router";
import express from "express";
import { AppContainer } from "./container";
import { IAppContainer } from "./interfaces/container.interface";
import { IServer } from "./interfaces/server.interface";
import { HttpServer } from "./server";

export class Application {
  private server?: IServer;
  private container?: IAppContainer;

  public async start() {
    this.container = await AppContainer.create(config);

    const expressApp = express();
    expressApp.use(express.json({ limit: "1mb" }));
    // app.use(requestIdMiddleware);
    expressApp.use("/api/v1", createApiRouter(this.container.controllers));
    expressApp.use(notFoundHandler);
    expressApp.use(createErrorHandler(this.container.lifecycle));

    this.runBackgroundHydration(this.container.fleetDataService);

    this.server = new HttpServer(expressApp);
    await this.server.start(config.server);

    this.logStartupStatus();

    return this;
  }

  private async runBackgroundHydration(dataService: IFleetDataService) {
    const HYDRATION_TIMEOUT = 30000;

    try {
      await Promise.race([
        dataService.hydrate(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Hydration Timeout")),
            HYDRATION_TIMEOUT,
          ),
        ),
      ]);
      console.log("[Application] Hydration successful.");
    } catch (err: any) {
      console.error(`[Application] Hydration failed: ${err.message}`);
    }
  }

  private logStartupStatus() {
    const { port, env, host, isDev } = config.server;
    const protocol = isDev ? "http" : "https";
    console.log(`
      System Online | PID: ${process.pid}
      URL:      ${protocol}://${host || "localhost"}:${port}
      Env:      ${env.toUpperCase()}
      Status:   Ready
    `);
  }

  public async shutdown(signal: string) {
    console.log(`\n[${signal}] Initiating graceful shutdown...`);

    if (!this.container || !this.server) process.exit(0);

    this.container.lifecycle.prepareForShutdown();

    const forceExit = setTimeout(
      () => {
        console.error("Cleanup timed out. Forcing exit.");
        process.exit(1);
      },
      config.server.isDev ? 3000 : 10000,
    );

    if (!config.server.isDev) {
      console.log("Waiting 3s to redirect traffic...");
      await new Promise((r) => setTimeout(r, 3000));
    }

    try {
      await Promise.all([
        this.server.stop(),
        this.container.lifecycle.closeAll(),
      ]);
      clearTimeout(forceExit);
      console.log("[Application] Shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  }
}
