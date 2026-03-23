export interface IEventBroker {
  /**
   * Shouts an event to the rest of the system.
   * @param eventName The unique key (e.g., 'VEHICLE.CREATED')
   * @param data The payload associated with the event
   */
  publish<T>(eventName: string, data: T): Promise<void>;

  /**
   * Registers a listener for a specific event.
   */
  subscribe<T>(
    eventName: string,
    handler: (data: T) => void | Promise<void>,
  ): void;

  /**
   * Removes a listener for a specific event.
   */
  unsubscribe<T>(event: string, callback: (event: T) => void): void;
}
