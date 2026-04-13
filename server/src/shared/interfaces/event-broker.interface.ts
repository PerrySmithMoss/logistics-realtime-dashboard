import { EventRegistry } from "./event-registry.interface";

export interface IEventBroker<T = EventRegistry> {
  subscribe<K extends keyof T>(eventName: K, handler: (data: T[K]) => void | Promise<void>): void;

  unsubscribe<K extends keyof T>(eventName: K, handler: (data: T[K]) => void | Promise<void>): void;

  publish<K extends keyof T>(eventName: K, data: T[K]): void;
}
