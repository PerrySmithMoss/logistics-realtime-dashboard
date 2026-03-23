import { GlobalQueryRegistry } from "@shared/bus/query/query-registry";
import { IQueryBus } from "./query-bus.interface";

export class QueryBus implements IQueryBus {
  private handlers: Map<string, any> = new Map();

  register<K extends keyof GlobalQueryRegistry>(
    queryName: K,
    handler: { handle(query: any): Promise<any> },
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
      throw new Error(`No handler registered for query: ${queryName}`);
    }

    console.log(`[QueryBus] 🔍 Executing: ${queryName}`, params);
    return handler.handle(params);
  }
}
