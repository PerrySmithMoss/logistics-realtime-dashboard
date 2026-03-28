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
    private readonly lifecycle: ILifecycleManager,
    private readonly dataService: IFleetDataService,
  ) {
    super();
  }

  public live = (_req: Request, res: Response) => {
    return this.ok(res, { status: "alive" });
  };

  public ready = async (_req: Request, res: Response) => {
    if (this.lifecycle.isShuttingDown) {
      return res.status(503).json({ status: "SHUTTING_DOWN" });
    }

    if (!this.lifecycle.isReady) {
      return res.status(503).json({ status: "STARTING" });
    }

    if (!this.dataService.isHydrated) {
      return res.status(503).json({
        status: "INITIALIZING",
        reason: "awaiting_hydration",
      });
    }

    return this.ok(res, {
      status: "UP",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };
}
