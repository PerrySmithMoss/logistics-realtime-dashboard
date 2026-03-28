import { IEventBroker } from "@shared/interfaces/event-broker.interface";

export interface EventSubscription {
  event: string;
  handler: (data: unknown) => Promise<void>;
}

export class FleetEventSubscriber {
  private readonly registeredHandlers = new Map<
    string,
    (data: unknown) => Promise<void>
  >();

  constructor(
    private readonly broker: IEventBroker,
    private readonly subscriptions: EventSubscription[],
  ) {}

  public subscribe(): void {
    for (const { event, handler } of this.subscriptions) {
      const safeHandler = async (data: unknown) => {
        try {
          await handler(data);
        } catch (err) {
          console.error(`[FleetSubscriber] Failed to process "${event}":`, err);
        }
      };

      this.registeredHandlers.set(event, safeHandler);
      this.broker.subscribe(event, safeHandler);
    }
  }

  public unsubscribe(): void {
    for (const [event, handler] of this.registeredHandlers.entries()) {
      this.broker.unsubscribe(event, handler);
    }
    this.registeredHandlers.clear();
  }
}
