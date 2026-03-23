import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";

type Handler = (data: any) => void | Promise<void>;

export class InMemoryEventBroker implements IEventBroker {
  private listeners: Map<string, Handler[]> = new Map();

  constructor(lifecycle: ILifecycleManager) {}

  async publish(eventName: string, data: any): Promise<void> {
    const handlers = this.listeners.get(eventName) || [];

    console.log(`[EventBroker] 📢 Event ${eventName} published:`, data);

    handlers.forEach((handler) => {
      Promise.resolve(handler(data)).catch((err) => {
        console.error(`[EventBroker] Error in listener for ${eventName}:`, err);
      });
    });
  }

  subscribe(eventName: string, handler: Handler): void {
    const current = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, [...current, handler]);
  }

  public unsubscribe(event: string, callback: Function) {
    const current = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      current.filter((fn) => fn !== callback),
    );
  }
}
