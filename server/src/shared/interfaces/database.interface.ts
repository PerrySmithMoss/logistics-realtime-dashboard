import { DatabaseSchema } from "@shared/infrastructure/database/database.schema";

export interface IDatabase {
  // returns the raw Map for a specific table
  getTable<K extends keyof DatabaseSchema>(
    tableName: K,
  ): Map<string, DatabaseSchema[K]>;

  // get all items from a table
  query<K extends keyof DatabaseSchema>(
    tableName: K,
  ): Promise<DatabaseSchema[K][]>;
}
