import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";

export interface IQueryBusOptions {
  signal?: AbortSignal;
}

export interface IQueryBus {
  ask<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    params: GlobalQueryRegistry[K]["request"],
    options?: { signal?: AbortSignal },
  ): Promise<GlobalQueryRegistry[K]["response"]>;

  register<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    handler: {
      handle(
        query: GlobalQueryRegistry[K]["request"],
        options?: IQueryBusOptions,
      ): Promise<GlobalQueryRegistry[K]["response"]>;
    },
  ): void;
}
