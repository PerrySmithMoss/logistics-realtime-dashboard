import { EventRegistry } from "@shared/interfaces";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

type BaseHandler = (data: never) => void | Promise<void>;

export class InMemoryEventBroker<T = EventRegistry> implements IEventBroker<T> {
  private readonly listeners = new Map<keyof T, BaseHandler[]>();

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

  public subscribe<K extends keyof T>(
    eventName: K,
    handler: (data: T[K]) => void | Promise<void>,
  ): void {
    const handlers = this.getHandlersFor(eventName);
    handlers.push(handler);
    this.listeners.set(eventName, handlers);
  }

  public unsubscribe<K extends keyof T>(
    eventName: K,
    handler: (data: T[K]) => void | Promise<void>,
  ): void {
    const handlers = this.getHandlersFor(eventName);
    const filtered = handlers.filter((h) => h !== handler);

    if (filtered.length === 0) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.set(eventName, filtered);
    }
  }

  public publish<K extends keyof T>(eventName: K, data: T[K]): void {
    const handlers = [...this.getHandlersFor(eventName)];

    for (const handler of handlers) {
      Promise.resolve()
        .then(() => handler(data))
        .catch((err) =>
          this.logger.error(
            `[EventBroker] Unhandled error in listener for "${String(eventName)}":`,
            err,
          ),
        );
    }
  }

  public reset(): void {
    this.listeners.clear();
  }

  private getHandlersFor<K extends keyof T>(
    eventName: K,
  ): Array<(data: T[K]) => void | Promise<void>> {
    const handlers = this.listeners.get(eventName) ?? [];
    return handlers as Array<(data: T[K]) => void | Promise<void>>;
  }
}
