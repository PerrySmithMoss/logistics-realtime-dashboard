import { IAppConfig } from "@config/index";
import { BaseController } from "@shared/api/base.controller";
import { ILifecycleManager } from "@shared/interfaces";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { IFleetDataService } from "../core/interfaces/fleet-data-service.interface";
import { IFleetObserverService } from "../core/interfaces/fleet-observer-service.interface";
import { FleetSessionResetService } from "../core/services/fleet-session-reset.service";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export class FleetController extends BaseController implements IFleetController {
  constructor(
    readonly config: IAppConfig,
    private readonly observerService: IFleetObserverService,
    private readonly dataService: IFleetDataService,
    private readonly resetService: FleetSessionResetService,
    private readonly lifecycle: ILifecycleManager,
    private readonly heartbeatIntervalMs: number,
  ) {
    super({
      apiVersion: config.app.version,
      environment: config.server.env,
      isDev: config.server.isDev,
    });
  }

  public getSnapshot = async (req: Request, res: Response) => {
    const snapshot = await this.dataService.getCurrentSnapshot();
    return this.ok(req, res, snapshot);
  };

  public stream = async (req: Request, res: Response) => {
    const connectionId = randomUUID();
    const shutdownSignal = this.lifecycle.getShutdownSignal();
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let cleaned = false;
    const socket = req.socket;

    const isConnectionClosed = () =>
      cleaned || req.destroyed || res.destroyed || res.writableEnded || socket.destroyed;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;

      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
        heartbeatTimer = null;
      }

      this.observerService.removeObserver(connectionId);
      shutdownSignal.removeEventListener("abort", cleanup);
      req.removeListener("aborted", cleanup);
      socket.removeListener("close", cleanup);
      socket.removeListener("error", cleanup);

      if (!res.writableEnded) res.end();
    };

    res.once("close", () => {
      cleanup();
    });
    req.once("aborted", cleanup);
    socket.once("close", cleanup);
    socket.once("error", cleanup);

    await this.resetService.waitForIdle();

    const initialSnapshot = await this.dataService.getCurrentSnapshot();

    // exit early if the user disconnected while we are getting the snapshot
    if (isConnectionClosed()) return;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const sendSse = (event: string, data: unknown) => {
      if (isConnectionClosed()) return;
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        cleanup();
      }
    };

    shutdownSignal.addEventListener("abort", cleanup, { once: true });

    sendSse("stats-update", initialSnapshot);

    this.observerService.addObserver(connectionId, res, (data) => {
      sendSse("stats-update", data);
    });

    const pulse = () => {
      if (isConnectionClosed()) return cleanup();
      try {
        const canWrite = res.write(":\n\n");
        if (!canWrite) return cleanup();
        this.observerService.keepAlive();
      } catch {
        cleanup();
        return;
      }
      heartbeatTimer = setTimeout(pulse, this.heartbeatIntervalMs);
    };

    heartbeatTimer = setTimeout(pulse, this.heartbeatIntervalMs);
  };
}
