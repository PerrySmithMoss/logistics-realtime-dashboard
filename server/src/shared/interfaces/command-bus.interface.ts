import { GlobalCommandRegistry } from "../bus/command/command-registry";

export interface ICommandBusOptions {
  signal?: AbortSignal;
}

export interface ICommandBus {
  execute<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    request: GlobalCommandRegistry[K],
    options?: ICommandBusOptions,
  ): Promise<void>;

  register<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    handler: {
      handle(
        command: GlobalCommandRegistry[K],
        options?: ICommandBusOptions,
      ): Promise<void>;
    },
  ): void;
}
