import { IAppConfig } from "@config/index";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { Request, Response } from "express";
import { BaseController } from "./base.controller";

export class HealthController
  extends BaseController
  implements IHealthController
{
  constructor(
    readonly config: IAppConfig,
    private readonly lifecycle: ILifecycleManager,
    private readonly dataService: IFleetDataService,
  ) {
    super({
      apiVersion: config.app.version,
      environment: config.server.env,
      isDev: config.server.isDev,
    });
  }

  public live = (req: Request, res: Response) => {
    return this.ok(req, res, { status: "ALIVE" });
  };

  public ready = async (req: Request, res: Response) => {
    if (this.lifecycle.isShuttingDown) {
      return this.serviceUnavailable({ status: "SHUTTING_DOWN" });
    }

    if (!this.lifecycle.isReady) {
      return this.serviceUnavailable({ status: "STARTING" });
    }

    if (!this.dataService.isHydrated) {
      return this.serviceUnavailable({
        status: "INITIALISING",
        reason: "Awaiting Hydration",
      });
    }

    return this.ok(req, res, {
      status: "UP",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };
}
