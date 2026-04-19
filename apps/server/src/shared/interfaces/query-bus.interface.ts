import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";

export interface IQueryBusOptions {
  signal?: AbortSignal;
}

export interface IQueryHandler<TReq = unknown, TRes = unknown> {
  handle(query: TReq, options?: IQueryBusOptions): Promise<TRes>;
}

export interface QueryEntry {
  request: unknown;
  response: unknown;
}

export interface IQueryBus<R extends Record<keyof R, QueryEntry> = GlobalQueryRegistry> {
  register<K extends keyof R>(
    queryName: K,
    handler: IQueryHandler<R[K]["request"], R[K]["response"]>,
  ): void;

  ask<K extends keyof R>(
    queryName: K,
    params: R[K]["request"],
    options?: IQueryBusOptions,
  ): Promise<R[K]["response"]>;
}
