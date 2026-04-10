export interface IEventBroker {
  subscribe(
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
  ): void;
  unsubscribe(
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
  ): void;
  publish(eventName: string, data: unknown): void;
}
