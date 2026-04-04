import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";
import { InternalServerError } from "@shared/errors/app.errors";
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
      throw new InternalServerError(
        `Query Handler for ${String(queryName)} is already registered.`,
        false,
      );
    }
    this.handlers.set(queryName, handler);
  }

  async ask<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    params: GlobalQueryRegistry[K]["request"],
    options?: { signal?: AbortSignal },
  ): Promise<GlobalQueryRegistry[K]["response"]> {
    if (options?.signal?.aborted) {
      throw new InternalServerError(
        `Query ${queryName} cancelled: Signal already aborted.`,
        false,
      );
    }

    const handler = this.handlers.get(queryName);

    if (!handler) {
      throw new InternalServerError(
        `Missing Query Handler: No handler registered for "${String(queryName)}"`,
        false,
      );
    }

    return handler.handle(params) as Promise<
      GlobalQueryRegistry[K]["response"]
    >;
  }
}
