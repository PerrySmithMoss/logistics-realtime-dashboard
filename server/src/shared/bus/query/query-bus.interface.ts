import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";

export interface IQueryBus {
  /**
   * Dispatches a query and returns a typed response.
   */
  ask<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    params: GlobalQueryRegistry[K]["request"],
  ): Promise<GlobalQueryRegistry[K]["response"]>;

  /**
   * Registers a handler for a specific query name.
   */
  register<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    handler: {
      handle(
        query: GlobalQueryRegistry[K]["request"],
      ): Promise<GlobalQueryRegistry[K]["response"]>;
    },
  ): void;
}
