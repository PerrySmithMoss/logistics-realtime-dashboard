import { IHealthController } from "@shared/interfaces/health-controller.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { Request, Response } from "express";
import { BaseController } from "./base.controller";

export class HealthController
  extends BaseController
  implements IHealthController
{
  constructor(private readonly lifecycle: ILifecycleManager) {
    super();
  }

  public check = async (_req: Request, res: Response) => {
    // 1. Check if we are in the middle of a graceful shutdown
    if (this.lifecycle.isShuttingDown) {
      return res.status(503).json({
        status: "SHUTTING_DOWN",
        message: "Server is draining existing connections",
      });
    }

    // 2. Check if the app has finished initializing (Buses, DB, etc.)
    if (!this.lifecycle.isReady) {
      return res.status(503).json({
        status: "STARTING",
        message: "Server is warming up",
      });
    }

    // 3. System is healthy
    return this.ok(res, {
      status: "UP",
      timestamp: new Date().toISOString(),
    });
  };
}
