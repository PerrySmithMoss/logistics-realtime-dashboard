import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

type Handler = (data: unknown) => void | Promise<void>;

export class InMemoryEventBroker implements IEventBroker {
  private readonly listeners = new Map<string, Handler[]>();

  constructor(
    private readonly lifecycle: ILifecycleManager,
    private readonly logger: ILogger,
  ) {
    this.lifecycle.onShutdown(async () => {
      const handlerCount = Array.from(this.listeners.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0,
      );

      this.logger.info(
        handlerCount > 0
          ? `Closing Event Broker: Cleared ${handlerCount} active stream listeners.`
          : `Closing Event Broker: No active stream listeners to clear.`,
      );

      this.listeners.clear();
    });
  }

  public subscribe(eventName: string, handler: Handler): void {
    const current = this.listeners.get(eventName) ?? [];
    this.listeners.set(eventName, [...current, handler]);
  }

  public unsubscribe(eventName: string, handler: Handler): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;

    const filtered = handlers.filter((h) => h !== handler);

    if (filtered.length === 0) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.set(eventName, filtered);
    }
  }

  public publish(eventName: string, data: unknown): void {
    const handlers = this.listeners.get(eventName) ?? [];
    for (const handler of handlers) {
      Promise.resolve(handler(data)).catch((err) =>
        this.logger.error(
          `[EventBroker] Unhandled error in listener for "${eventName}":`,
          err,
        ),
      );
    }
  }
}
