import { InternalServerError } from "@shared/errors/app.errors";
import { IBroadcastScheduler, ISimulator } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { Response } from "express";
import { FleetStatsUpdatedEvent } from "../events/fleet-events";
import { IFleetObserverService } from "../interfaces/fleet-observer-service.interface";

interface Observer {
  res: Response;
  callback: (stats: unknown) => void;
}

export class FleetObserverService implements IFleetObserverService {
  private readonly observers = new Map<string, Observer>();
  private reactor?: IBroadcastScheduler;
  private simulator?: ISimulator;

  constructor(
    private readonly eventBroker: IEventBroker,
    private readonly logger: ILogger,
  ) {}

  public setLiveComponents(reactor: IBroadcastScheduler, simulator?: ISimulator): void {
    this.reactor = reactor;
    this.simulator = simulator;
  }

  public addObserver(id: string, res: Response, callback: (stats: unknown) => void): void {
    if (!this.reactor) {
      this.logger.error(
        "[FleetObserverService] Attempted to add observer, but reactor is missing.",
      );
      throw new InternalServerError("Fleet Tracking Pipeline is not initialised.", false);
    }

    if (this.observers.has(id)) return;

    if (this.observers.size === 0) {
      this.activateFleetPipeline();
    }

    this.observers.set(id, { callback, res });

    this.logger.info(
      `[FleetObserverService] Observer joined: ${id} | Total: ${this.observers.size}`,
    );
  }

  public removeObserver(id: string): void {
    const existed = this.observers.delete(id);
    if (!existed) return;
    this.logger.info(`[FleetObserverService] Observer left: ${id} | Total: ${this.observers.size}`);

    if (this.observers.size === 0) this.deactivateFleetPipeline();
  }

  public keepAlive(): void {
    if (this.observers.size > 0) {
      this.simulator?.heartbeat("OBSERVER_KEEP_ALIVE");
    }
  }

  private broadcastToObservers = (event: FleetStatsUpdatedEvent): void => {
    if (this.observers.size === 0) return;

    const observerIds = Array.from(this.observers.keys());

    for (const id of observerIds) {
      const observer = this.observers.get(id);
      if (!observer) continue;

      if (this.isObserverStale(observer.res)) {
        this.observers.delete(id);
        this.logger.debug(`[FleetObserverService] Cleaned up stale observer: ${id}`);
        continue;
      }

      try {
        observer.callback(event.payload);
      } catch (err) {
        this.logger.error(`[FleetObserverService] Failed to send to ${id}:`, err);
        this.observers.delete(id);
      }
    }

    if (this.observers.size === 0) {
      this.deactivateFleetPipeline();
    }
  };

  private activateFleetPipeline(): void {
    this.logger.info("[FleetObserverService] Activating pipeline...");
    this.reactor?.start();
    this.eventBroker.subscribe(FleetStatsUpdatedEvent.type, this.broadcastToObservers);
    this.simulator?.heartbeat("PIPELINE_START");
  }

  private deactivateFleetPipeline(): void {
    this.logger.info("[FleetObserverService] Deactivating pipeline...");
    this.reactor?.stop();
    this.eventBroker.unsubscribe(FleetStatsUpdatedEvent.type, this.broadcastToObservers);
    this.simulator?.stop();
  }

  private isObserverStale(res: Response): boolean {
    return (
      res.writableEnded ||
      !res.writable ||
      res.destroyed ||
      res.closed ||
      res.socket?.destroyed === true
    );
  }
}
