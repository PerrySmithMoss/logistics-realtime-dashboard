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
  constructor(
    private readonly observerService: IFleetObserverService,
    private readonly dataService: IFleetDataService,
  ) {
    super();
  }

  public getSnapshot = async (_req: Request, res: Response) => {
    const snapshot = await this.dataService.getCurrentSnapshot();

    return res.status(200).json({
      summary: snapshot.summary,
      vehicles: snapshot.vehicles,
      timestamp: new Date().toISOString(),
    });
  };

  public stream = async (req: Request, res: Response) => {
    const connectionId = randomUUID();
    let isCleanedUp = false;

    req.socket.setKeepAlive(true, 1000);
    req.socket.setTimeout(20000);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write("retry: 5000\n\n");
    res.write(": ok\n\n");

    // TODO: once fleet exceeds 50+ vehicles, send only deltas
    // rather than the full snapshot on connect
    const snapshot = await this.dataService.getCurrentSnapshot();
    res.write(`event: stats-update\ndata: ${JSON.stringify(snapshot)}\n\n`);

    this.observerService.addObserver(connectionId, res, (data) => {
      if (!res.writableEnded) {
        res.write(`event: stats-update\ndata: ${JSON.stringify(data)}\n\n`);
      }
    });

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      this.observerService.removeObserver(connectionId);
      clearInterval(heartbeatTimer);

      if (!res.writableEnded) res.end();
    };

    const heartbeatTimer = setInterval(() => {
      try {
        const ok = res.write(":\n\n");
        if (!ok) cleanup();
      } catch {
        cleanup();
      }
    }, 15000);

    res.on("close", cleanup);
    req.on("error", cleanup);
  };
}
