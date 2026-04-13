import { GlobalCommandRegistry } from "../bus/command/command-registry";

export interface ICommandBusOptions {
  signal?: AbortSignal;
}

export interface ICommandBus<R = GlobalCommandRegistry> {
  register<K extends keyof R>(commandName: K, handler: ICommandHandler<R[K]>): void;

  execute<K extends keyof R>(
    commandName: K,
    request: R[K],
    options?: ICommandBusOptions,
  ): Promise<void>;
}

export interface ICommandHandler<C = unknown> {
  handle(command: C, options?: ICommandBusOptions): Promise<void>;
}
