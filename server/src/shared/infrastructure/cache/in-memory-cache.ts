import { ICache } from "@shared/interfaces/cache.interface";

interface ICacheEntry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryCache implements ICache {
  private readonly cache = new Map<string, ICacheEntry>();

  public async set<T>(
    key: string,
    value: T,
    ttlMs: number = 60000,
  ): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async increment(key: string, ttlMs: number = 60000): Promise<number> {
    const existing = await this.get<number>(key);
    const newValue = (typeof existing === "number" ? existing : 0) + 1;

    await this.set(key, newValue, ttlMs);
    return newValue;
  }

  public async decrement(key: string, ttlMs: number = 60000): Promise<number> {
    const existing = await this.get<number>(key);
    const newValue = (typeof existing === "number" ? existing : 0) - 1;

    await this.set(key, newValue, ttlMs);
    return newValue;
  }

  public async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}
