import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";
import { IQueryBus } from "./query-bus.interface";

type AnyHandler = { handle(query: unknown): Promise<unknown> };

export class QueryBus implements IQueryBus {
  private readonly handlers = new Map<keyof GlobalQueryRegistry, AnyHandler>();

  register<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    handler: {
      handle(
        query: GlobalQueryRegistry[K]["request"],
      ): Promise<GlobalQueryRegistry[K]["response"]>;
    },
  ): void {
    if (this.handlers.has(queryName)) {
      throw new Error(`Query Handler for ${queryName} is already registered.`);
    }
    this.handlers.set(queryName, handler);
  }

  async ask<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    params: GlobalQueryRegistry[K]["request"],
  ): Promise<GlobalQueryRegistry[K]["response"]> {
    const handler = this.handlers.get(queryName);

    if (!handler) {
      throw new Error(
        `No handler registered for query: "${String(queryName)}"`,
      );
    }

    return handler.handle(params) as Promise<
      GlobalQueryRegistry[K]["response"]
    >;
  }
}
