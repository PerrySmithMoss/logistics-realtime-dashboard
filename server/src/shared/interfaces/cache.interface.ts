export interface ICache {
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlMs?: number): Promise<number>;
  decrement(key: string, ttlMs?: number): Promise<number>;
}
