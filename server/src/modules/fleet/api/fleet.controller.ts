import { BaseController } from "@shared/api/base.controller";
import { ILifecycleManager } from "@shared/interfaces";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { IFleetDataService } from "../core/interfaces/fleet-data-service.interface";
import { IFleetObserverService } from "../core/interfaces/fleet-observer-service.interface";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export class FleetController
  extends BaseController
  implements IFleetController
{
  private readonly HEARTBEAT_INTERVAL = 15000;

  constructor(
    private readonly observerService: IFleetObserverService,
    private readonly dataService: IFleetDataService,
    private readonly lifecycle: ILifecycleManager,
  ) {
    super();
  }

  public getSnapshot = async (_req: Request, res: Response) => {
    const snapshot = await this.dataService.getCurrentSnapshot();
    return this.ok(res, snapshot);
  };

  public stream = async (req: Request, res: Response) => {
    const connectionId = randomUUID();
    const shutdownSignal = this.lifecycle.getShutdownSignal();

    let heartbeatTimer: NodeJS.Timeout | null = null;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const sendSse = (event: string, data: any) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const cleanup = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      this.observerService.removeObserver(connectionId);
      shutdownSignal.removeEventListener("abort", cleanup);
      if (!res.writableEnded) res.end();
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);
    req.on("error", cleanup);

    const initialSnapshot = await this.dataService.getCurrentSnapshot();

    // exit early if the user disconnected while we are getting the snapshot
    if (res.writableEnded) return;

    sendSse("stats-update", initialSnapshot);

    shutdownSignal.addEventListener("abort", cleanup, { once: true });

    this.observerService.addObserver(connectionId, res, (data) => {
      sendSse("stats-update", data);
    });

    heartbeatTimer = setInterval(() => {
      try {
        // keep connection alive
        const canWrite = res.write(":\n\n");
        if (!canWrite) {
          cleanup();
        } else {
          this.observerService.keepAlive();
        }
      } catch {
        cleanup();
      }
    }, this.HEARTBEAT_INTERVAL);
  };
}
