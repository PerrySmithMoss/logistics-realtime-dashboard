import { InternalServerError } from "@shared/errors/app.errors";
import { ICommandBus } from "./command-bus.interface";
import { GlobalCommandRegistry } from "./command-registry";

type AnyCommandHandler = { handle(command: unknown): Promise<void> };

export class CommandBus implements ICommandBus {
  private readonly handlers = new Map<
    keyof GlobalCommandRegistry,
    AnyCommandHandler
  >();

  public register<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    handler: { handle(command: GlobalCommandRegistry[K]): Promise<void> },
  ): void {
    if (this.handlers.has(commandName)) {
      throw new InternalServerError(
        `Handler for command ${String(commandName)} is already registered.`,
        false,
      );
    }
    this.handlers.set(commandName, handler);
  }

  public async execute<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    request: GlobalCommandRegistry[K],
  ): Promise<void> {
    const handler = this.handlers.get(commandName);
    if (!handler) {
      throw new InternalServerError(
        `No handler registered for ${commandName}`,
        false,
      );
    }
    await handler.handle(request);
  }
}
