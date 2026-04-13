import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";
import { InternalServerError } from "@shared/errors/app.errors";
import {
  IQueryBus,
  IQueryBusOptions,
  IQueryHandler,
  QueryEntry,
} from "../../interfaces/query-bus.interface";

export class QueryBus<
  R extends Record<keyof R, QueryEntry> = GlobalQueryRegistry,
> implements IQueryBus<R> {
  private readonly handlers = new Map<keyof R, IQueryHandler<unknown, unknown>>();

  public register<K extends keyof R>(
    queryName: K,
    handler: IQueryHandler<R[K]["request"], R[K]["response"]>,
  ): void {
    if (this.handlers.has(queryName)) {
      throw new InternalServerError(
        `Query Handler for ${String(queryName)} is already registered.`,
        false,
      );
    }

    this.handlers.set(queryName, handler);
  }

  public async ask<K extends keyof R>(
    queryName: K,
    params: R[K]["request"],
    options?: IQueryBusOptions,
  ): Promise<R[K]["response"]> {
    if (options?.signal?.aborted) {
      throw new InternalServerError(
        `Query ${String(queryName)} cancelled: Signal already aborted.`,
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

    return handler.handle(params, options ?? {});
  }
}
