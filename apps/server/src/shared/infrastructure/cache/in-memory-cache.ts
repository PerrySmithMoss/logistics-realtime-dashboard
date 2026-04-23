import { CacheTypeError } from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

interface InMemoryCacheOptions {
  cleanupIntervalMs?: number;
  sizeThreshold?: number;
  defaultTtlMs?: number;
  maxEntries?: number;
}

interface ICacheEntry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryCache implements ICache {
  private readonly cache = new Map<string, ICacheEntry>();

  private lastCleanupTime = Date.now();

  private readonly CLEANUP_INTERVAL_MS: number;
  private readonly SIZE_THRESHOLD: number;
  private readonly DEFAULT_TTL_MS: number;
  private readonly MAX_ENTRIES: number;

  constructor(
    private readonly logger: ILogger,
    options: InMemoryCacheOptions = {},
  ) {
    this.CLEANUP_INTERVAL_MS = options.cleanupIntervalMs ?? 3_600_000;
    this.SIZE_THRESHOLD = options.sizeThreshold ?? 50;
    this.DEFAULT_TTL_MS = options.defaultTtlMs ?? 60_000;
    this.MAX_ENTRIES = options.maxEntries ?? Number.POSITIVE_INFINITY;
  }

  private enforceMaxEntries(nextKey: string): void {
    if (this.cache.has(nextKey) || this.cache.size < this.MAX_ENTRIES) {
      return;
    }

    const oldestKey = this.cache.keys().next().value;

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private lazyCleanup(): void {
    const now = Date.now();

    // only clean if an hour has passed and there is actually data to clean
    if (
      now - this.lastCleanupTime > this.CLEANUP_INTERVAL_MS &&
      this.cache.size > this.SIZE_THRESHOLD
    ) {
      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
      this.lastCleanupTime = now;
      this.logger.info(`Lazy cleanup performed. Current size: ${this.cache.size}`);
    }
  }

  private getCacheEntry<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public async get<T>(key: string): Promise<T | null> {
    return this.getCacheEntry<T>(key);
  }

  public async set<T>(key: string, value: T, ttlMs: number = this.DEFAULT_TTL_MS): Promise<void> {
    this.lazyCleanup();
    this.enforceMaxEntries(key);
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Increments a numeric value in the cache.
   * @param key - The unique identifier for the cache entry.
   * @param ttlMs - Time to live in milliseconds (default 60s).
   * @returns The new incremented value.
   * @throws {CacheTypeError} If the key exists but the value is not a number.
   */
  public async increment(key: string, ttlMs: number = this.DEFAULT_TTL_MS): Promise<number> {
    const existingValue = this.getCacheEntry<unknown>(key);

    if (existingValue !== null && typeof existingValue !== "number") {
      throw new CacheTypeError(key, "number", typeof existingValue);
    }

    const currentValue = (existingValue as number) ?? 0;
    const newValue = currentValue + 1;

    const currentEntry = this.cache.get(key);
    const expiresAt = currentEntry ? currentEntry.expiresAt : Date.now() + ttlMs;

    this.enforceMaxEntries(key);
    this.cache.set(key, { value: newValue, expiresAt });

    return newValue;
  }

  /**
   * Decrements a numeric value in the cache.
   * @param key - The unique identifier for the cache entry.
   * @param ttlMs - Time to live in milliseconds (default 60s).
   * @returns The new decremented value.
   * @throws {CacheTypeError} If the key exists but the value is not a number.
   */
  public async decrement(key: string, ttlMs: number = this.DEFAULT_TTL_MS): Promise<number> {
    const existingValue = this.getCacheEntry<unknown>(key);

    if (existingValue !== null && typeof existingValue !== "number") {
      throw new CacheTypeError(key, "number", typeof existingValue);
    }

    const currentValue = (existingValue as number) ?? 0;
    const newValue = currentValue - 1;

    const currentEntry = this.cache.get(key);
    const expiresAt = currentEntry ? currentEntry.expiresAt : Date.now() + ttlMs;

    this.enforceMaxEntries(key);
    this.cache.set(key, { value: newValue, expiresAt });

    return newValue;
  }

  public async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  public reset(): void {
    this.cache.clear();
    this.lastCleanupTime = Date.now();
  }
}
