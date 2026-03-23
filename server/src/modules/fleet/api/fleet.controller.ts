import { VehicleLocationUpdatedEvent } from "@modules/vehicle/core/events/vehicle.events";
import { BaseController } from "@shared/api/base.controller";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { Request, Response } from "express";
import { FleetStatsUpdatedEvent } from "../core/events/fleet-events";
import { IFleetController } from "./interfaces/fleet-controller.interface";

export class FleetController
  extends BaseController
  implements IFleetController
{
  constructor(
    private readonly eventBroker: IEventBroker,
    private readonly queryBus: IQueryBus,
  ) {
    super();
  }

  public stream = (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Critical for Nginx/Proxies
    });

    // heartbeat to keep connection alive
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 30000);

    const onStatsUpdate = (event: FleetStatsUpdatedEvent) => {
      res.write(`event: stats-update\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    this.eventBroker.subscribe(VehicleLocationUpdatedEvent.type, onStatsUpdate);

    // cleanup on disconnect to prevent memory leaks
    req.on("close", () => {
      clearInterval(heartbeat);
      this.eventBroker.unsubscribe(
        VehicleLocationUpdatedEvent.type,
        onStatsUpdate,
      );
      res.end();
    });
  };
}
