import { EventRegistry } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

export interface EventSubscription {
  event: keyof EventRegistry;
  handler: (data: unknown) => Promise<void>;
}

export class FleetEventSubscriber {
  private readonly registeredHandlers = new Map<
    keyof EventRegistry,
    (data: unknown) => Promise<void>
  >();

  constructor(
    private readonly broker: IEventBroker,
    private readonly subscriptions: EventSubscription[],
    private readonly logger: ILogger,
  ) {}

  public subscribe(): void {
    for (const { event, handler } of this.subscriptions) {
      // Prevent duplicate subscriptions
      if (this.registeredHandlers.has(event)) continue;

      const safeHandler = async (data: unknown) => {
        try {
          await handler(data);
        } catch (err) {
          this.logger.error(
            `[FleetSubscriber] Failed to process "${event}":`,
            err instanceof Error ? err : new Error(String(err)),
          );
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
