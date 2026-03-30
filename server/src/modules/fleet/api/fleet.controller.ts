import { BaseController } from "@shared/api/base.controller";
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
  ) {
    super();
  }

  public getSnapshot = async (_req: Request, res: Response) => {
    const snapshot = await this.dataService.getCurrentSnapshot();

    return res.status(200).json({
      ...snapshot,
      timestamp: new Date().toISOString(),
    });
  };

  public stream = async (req: Request, res: Response) => {
    const connectionId = randomUUID();
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
      if (!res.writableEnded) res.end();
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);
    req.on("error", cleanup);

    const initialSnapshot = await this.dataService.getCurrentSnapshot();
    sendSse("stats-update", initialSnapshot);

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
