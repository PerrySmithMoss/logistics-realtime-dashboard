import { ICache } from "@shared/interfaces/cache.interface";
import { vi, type Mocked } from "vitest";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

export type MockCache = Mocked<ICache> & {
  seed: (key: string, value: unknown, ttlMs?: number) => void;
  peek: (key: string) => unknown | null;
};

export const createMockCache = (): MockCache => {
  const store = new Map<string, CacheEntry>();

  const readEntry = (key: string): CacheEntry | null => {
    const entry = store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }

    return entry;
  };

  const cache = {
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      return (readEntry(key)?.value as T) ?? null;
    }),
    set: vi.fn(async (key: string, value: unknown, ttlMs = 60_000) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    increment: vi.fn(async (key: string, ttlMs = 60_000) => {
      const entry = readEntry(key);
      const value = typeof entry?.value === "number" ? entry.value + 1 : 1;
      store.set(key, {
        value,
        expiresAt: entry?.expiresAt ?? Date.now() + ttlMs,
      });
      return value;
    }),
    decrement: vi.fn(async (key: string, ttlMs = 60_000) => {
      const entry = readEntry(key);
      const value = typeof entry?.value === "number" ? entry.value - 1 : -1;
      store.set(key, {
        value,
        expiresAt: entry?.expiresAt ?? Date.now() + ttlMs,
      });
      return value;
    }),
    reset: vi.fn(async () => {
      store.clear();
    }),
  } as unknown as MockCache;

  cache.seed = (key: string, value: unknown, ttlMs = 60_000) => {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  };

  cache.peek = (key: string) => readEntry(key)?.value ?? null;

  return cache;
};
