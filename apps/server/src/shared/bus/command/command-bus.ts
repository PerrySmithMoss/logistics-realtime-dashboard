import { InternalServerError } from "@shared/errors/app.errors";
import {
  ICommandBus,
  ICommandBusOptions,
  ICommandHandler,
} from "../../interfaces/command-bus.interface";
import { GlobalCommandRegistry } from "./command-registry";

export class CommandBus<R = GlobalCommandRegistry> implements ICommandBus<R> {
  private readonly handlers = new Map<keyof R, ICommandHandler<unknown>>();

  public register<K extends keyof R>(commandName: K, handler: ICommandHandler<R[K]>): void {
    if (this.handlers.has(commandName)) {
      throw new InternalServerError(
        `Handler for '${String(commandName)}' is already registered.`,
        false,
      );
    }

    this.handlers.set(commandName, handler as ICommandHandler<unknown>);
  }

  public async execute<K extends keyof R>(
    commandName: K,
    request: R[K],
    options?: ICommandBusOptions,
  ): Promise<void> {
    if (options?.signal?.aborted) {
      throw new InternalServerError(
        `Command ${String(commandName)} cancelled: Signal already aborted.`,
        false,
      );
    }

    const handler = this.handlers.get(commandName);

    if (!handler) {
      throw new InternalServerError(`No handler for '${String(commandName)}'`, false);
    }

    await handler.handle(request, options ?? {});
  }
}
