import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { Response } from "express";
import { FleetStatsUpdatedEvent } from "../events/fleet-events";

import { IBroadcastScheduler, ISimulator } from "@shared/interfaces";
import { IFleetObserverService } from "../interfaces/fleet-observer-service.interface";

interface Observer {
  res: Response;
  callback: (stats: unknown) => void;
}

export class FleetObserverService implements IFleetObserverService {
  private readonly observers = new Map<string, Observer>();
  private reactor?: IBroadcastScheduler;
  private simulator?: ISimulator;

  constructor(private readonly eventBroker: IEventBroker) {}

  public setLiveComponents(
    reactor: IBroadcastScheduler,
    simulator: ISimulator,
  ): void {
    this.reactor = reactor;
    this.simulator = simulator;
  }

  public addObserver(
    id: string,
    res: Response,
    callback: (stats: unknown) => void,
  ): void {
    const isFirst = this.observers.size === 0;
    this.observers.set(id, { callback, res });
    console.log(
      `👤 [FleetObserverService] Observer joined: ${id} | Total: ${this.observers.size}`,
    );

    if (isFirst) this.activateFleetPipeline();
  }

  public removeObserver(id: string): void {
    const existed = this.observers.delete(id);
    if (!existed) return;
    console.log(
      `👤 [FleetObserverService] Observer left: ${id} | Total: ${this.observers.size}`,
    );

    if (this.observers.size === 0) this.deactivateFleetPipeline();
  }

  private broadcastToObservers = (event: FleetStatsUpdatedEvent): void => {
    for (const [id, observer] of this.observers.entries()) {
      if (observer.res.writableEnded || !observer.res.writable) {
        this.removeObserver(id);
        continue;
      }
      observer.callback(event.payload);
    }
  };

  private activateFleetPipeline(): void {
    console.log("⚡ [FleetObserverService] Activating pipeline...");
    this.reactor?.start();
    this.eventBroker.subscribe(
      FleetStatsUpdatedEvent.type,
      this.broadcastToObservers,
    );
    this.simulator?.heartbeat("PIPELINE_START");
  }

  private deactivateFleetPipeline(): void {
    console.log("❄️ [FleetObserverService] Deactivating pipeline...");
    this.reactor?.stop();
    this.eventBroker.unsubscribe(
      FleetStatsUpdatedEvent.type,
      this.broadcastToObservers,
    );
    this.simulator?.stop();
  }
}
