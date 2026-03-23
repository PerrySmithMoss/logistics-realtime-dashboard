import { GlobalCommandRegistry } from "./command-registry";

export interface ICommandBus {
  /**
   * Executes a command. Commands do not return data (Void).
   */
  execute<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    request: GlobalCommandRegistry[K],
  ): Promise<void>;

  /**
   * Registers a handler for a specific command.
   */
  register<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    handler: { handle(req: GlobalCommandRegistry[K]): Promise<void> },
  ): void;
}
