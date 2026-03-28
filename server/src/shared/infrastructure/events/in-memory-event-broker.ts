import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";

type Handler = (data: unknown) => void | Promise<void>;

export class InMemoryEventBroker implements IEventBroker {
  private readonly listeners = new Map<string, Handler[]>();

  constructor(lifecycle: ILifecycleManager) {
    // prevent event handlers from firing during the shutdown drain window
    lifecycle.onShutdown(async () => {
      const count = [...this.listeners.values()].reduce(
        (sum, handlers) => sum + handlers.length,
        0,
      );
      this.listeners.clear();
      console.log(
        `[EventBroker] Cleared ${count} listeners across ${this.listeners.size} events.`,
      );
    });
  }

  public publish(eventName: string, data: unknown): void {
    const handlers = this.listeners.get(eventName) ?? [];
    for (const handler of handlers) {
      Promise.resolve(handler(data)).catch((err) =>
        console.error(
          `[EventBroker] Unhandled error in listener for "${eventName}":`,
          err,
        ),
      );
    }
  }

  public subscribe(eventName: string, handler: Handler): void {
    const current = this.listeners.get(eventName) ?? [];
    this.listeners.set(eventName, [...current, handler]);
  }

  public unsubscribe(eventName: string, handler: Handler): void {
    const current = this.listeners.get(eventName) ?? [];
    this.listeners.set(
      eventName,
      current.filter((fn) => fn !== handler),
    );
  }
}
