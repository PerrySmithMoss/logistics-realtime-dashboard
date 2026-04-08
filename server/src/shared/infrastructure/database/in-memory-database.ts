import { Vehicle } from "@modules/vehicle/core/entities/vehicle.entity";
import { InternalServerError } from "@shared/errors/app.errors";
import { IDatabase } from "@shared/interfaces/database.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";

export class InMemoryDatabase implements IDatabase {
  public readonly vehicles = new Map<string, Vehicle[]>();

  constructor(_lifecycle: ILifecycleManager) {}

  public getTable<K = string, V = any>(name: string): Map<K, V> {
    const tables: Record<string, Map<any, any>> = {
      vehicles: this.vehicles,
    };

    const table = tables[name];

    if (!table) {
      throw new InternalServerError(
        `Table ${name} does not exist in InMemoryDatabase.`,
        false,
      );
    }

    return table as Map<K, V>;
  }

  async query<T>(tableName: string): Promise<T[]> {
    const table = this.getTable<string, T>(tableName);
    return Array.from(table.values());
  }
}
