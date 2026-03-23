import { ICommandBus } from "./command-bus.interface";
import { GlobalCommandRegistry } from "./command-registry";

export class CommandBus implements ICommandBus {
  private handlers = new Map<string, any>();

  public register<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    handler: any,
  ): void {
    this.handlers.set(commandName as string, handler);
  }

  public async execute<K extends keyof GlobalCommandRegistry>(
    commandName: K,
    request: GlobalCommandRegistry[K],
  ): Promise<void> {
    const handler = this.handlers.get(commandName as string);
    if (!handler) {
      throw new Error(`No handler for ${commandName as string}`);
    }

    await handler.handle(request);
  }
}
