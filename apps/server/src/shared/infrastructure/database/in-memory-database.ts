import { InternalServerError } from "@shared/errors/app.errors";
import { IDatabase } from "@shared/interfaces/database.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { DatabaseSchema } from "./database.schema";

export class InMemoryDatabase implements IDatabase {
  private readonly storage: {
    [K in keyof DatabaseSchema]: Map<string, DatabaseSchema[K]>;
  } = {
    vehicles: new Map(),
  };

  constructor(private readonly lifecycle: ILifecycleManager) {
    this.lifecycle.onShutdown(async () => {
      this.storage.vehicles.clear();
    });
  }

  public getTable<K extends keyof DatabaseSchema>(tableName: K): Map<string, DatabaseSchema[K]> {
    const table = this.storage[tableName];

    if (!table) {
      throw new InternalServerError(
        `Table "${tableName}" does not exist in InMemoryDatabase.`,
        false,
      );
    }

    return table;
  }

  public async query<K extends keyof DatabaseSchema>(tableName: K): Promise<DatabaseSchema[K][]> {
    const table = this.getTable(tableName);
    return Array.from(table.values());
  }

  public reset(): void {
    Object.values(this.storage).forEach((table) => table.clear());
  }
}
