import { GlobalCommandRegistry } from "./command-registry";

export interface ICommandBus {
  execute<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    request: GlobalCommandRegistry[K],
  ): Promise<void>;

  register<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    handler: { handle(command: GlobalCommandRegistry[K]): Promise<void> },
  ): void;
}
