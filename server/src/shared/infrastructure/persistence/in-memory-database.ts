import { IDatabase } from "@shared/infrastructure/database/database.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";

export class InMemoryDatabase implements IDatabase {
  public readonly vehicles = new Map<string, any>();

  constructor(_lifecycle: ILifecycleManager) {}

  public getTable<K = string, V = any>(name: string): Map<K, V> {
    const tables: Record<string, Map<any, any>> = {
      vehicles: this.vehicles,
    };

    const table = tables[name];

    if (!table) {
      throw new Error(`Table ${name} does not exist in InMemoryDatabase.`);
    }

    return table as Map<K, V>;
  }

  async query<T>(tableName: string): Promise<T[]> {
    // Reuse getTable to keep logic DRY (Don't Repeat Yourself)
    const table = this.getTable<string, T>(tableName);
    return Array.from(table.values());
  }
}
