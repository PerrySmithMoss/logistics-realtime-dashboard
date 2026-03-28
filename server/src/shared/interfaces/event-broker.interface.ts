export interface IEventBroker {
  publish(eventName: string, data: unknown): void;

  subscribe(
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
  ): void;

  unsubscribe(
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
  ): void;
}
