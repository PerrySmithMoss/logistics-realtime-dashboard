import { DatabaseSchema } from "@shared/infrastructure/database/database.schema";

export interface IDatabase {
  getTable<K extends keyof DatabaseSchema>(
    name: K,
  ): Map<string, DatabaseSchema[K]>;

  query<K extends keyof DatabaseSchema>(
    tableName: K,
  ): Promise<DatabaseSchema[K][]>;
}
