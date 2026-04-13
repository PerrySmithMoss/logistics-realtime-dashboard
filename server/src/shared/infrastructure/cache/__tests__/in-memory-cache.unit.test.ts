import { CacheTypeError } from "@shared/errors/app.errors";
import { InMemoryCache } from "@shared/infrastructure/cache";
import { ILogger } from "@shared/interfaces";
import { createMockLogger } from "@shared/testing/test-utils";
import { describe } from "vitest";

const MOCK_DEFAULT_CACHE_TTL_MS = 60_000;
const MOCK_CACHE_CLEANUP_INTERVAL_MS = 1_000;
const MOCK_CACHE_SIZE_THRESHOLD = 5;

const createMockCache = (
  logger = createMockLogger(),
): { cache: InMemoryCache; logger: ILogger } => {
  return {
    cache: new InMemoryCache(logger, {
      cleanupIntervalMs: MOCK_CACHE_CLEANUP_INTERVAL_MS,
      sizeThreshold: MOCK_CACHE_SIZE_THRESHOLD,
      defaultTtlMs: MOCK_DEFAULT_CACHE_TTL_MS,
    }),
    logger,
  };
};

const mockTimerTick = (ms: number) => {
  vi.advanceTimersByTime(ms);
};

describe("InMemoryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("set / get", () => {
    it("returns null for a key that has never been set", async () => {
      const { cache } = createMockCache();
      expect(await cache.get("missing")).toBeNull();
    });

    it("returns stored value immediately after it has been set", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", { lastName: "Morgan" });
      expect(await cache.get<{ lastName: string }>("Dexter")).toEqual({
        lastName: "Morgan",
      });
    });

    it("overwrites and existing entry when set is called again on the same key", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan");
      await cache.set("Dexter", "Mitchell");
      expect(await cache.get<string>("Dexter")).toBe("Mitchell");
    });

    it("stores independent entries under different keys", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan");
      await cache.set("Arthur", "Mitchell");
      expect(await cache.get<string>("Dexter")).toBe("Morgan");
      expect(await cache.get<string>("Arthur")).toBe("Mitchell");
    });

    it("accepts all JSON-serialisable value types", async () => {
      const { cache } = createMockCache();

      const cases: Array<[string, unknown]> = [
        ["num", 42],
        ["str", "hello"],
        ["bool", true],
        ["nil", null],
        ["arr", [1, 2, 3]],
        ["obj", { nested: { deep: true } }],
      ];

      for (const [key, value] of cases) {
        await cache.set(key, value);
        expect(await cache.get(key)).toEqual(value);
      }
    });

    it("respects a custom ttlMs passed to set", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan", 5_000);

      mockTimerTick(4_999);
      expect(await cache.get("Dexter")).toBe("Morgan");

      mockTimerTick(2);
      expect(await cache.get("Dexter")).toBeNull();
    });

    it("uses the default 60 second TTL when none is provided", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan");

      mockTimerTick(MOCK_DEFAULT_CACHE_TTL_MS - 1);
      expect(await cache.get<string>("Dexter")).toBe("Morgan");

      mockTimerTick(2);
      expect(await cache.get<string>("Dexter")).toBeNull();
    });

    it("evicts the entry inline on get if expired has passed", async () => {
      const { cache } = createMockCache();
      cache.set("Dexter", "Morgan", 1_000);

      mockTimerTick(1_001);
      expect(await cache.get<string>("Dexter")).toBeNull();

      // defensive check to make sure a second get call still returns null
      expect(await cache.get<string>("Dexter")).toBeNull();
    });
  });

  describe("delete", () => {
    it("makes a key immediately unavailable", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan");
      await cache.delete("Dexter");
      expect(await cache.get("Dexter")).toBeNull();
    });

    it("does not throw when deleting a key which doesn't exist", async () => {
      const { cache } = createMockCache();
      expect(await cache.delete("never-existed")).toBeUndefined();
    });

    it("does not delete other keys", async () => {
      const { cache } = createMockCache();
      await cache.set("Dexter", "Morgan");
      await cache.set("Arthur", "Mitchell");
      await cache.delete("Dexter");
      expect(await cache.get<string>("Arthur")).toBe("Mitchell");
    });
  });

  describe("increment", () => {
    it("starts at 1 when the key does not exist", async () => {
      const { cache } = createMockCache();
      expect(await cache.increment("counter")).toBe(1);
    });

    it("increments sequentially", async () => {
      const { cache } = createMockCache();
      expect(await cache.increment("c")).toBe(1);
      expect(await cache.increment("c")).toBe(2);
      expect(await cache.increment("c")).toBe(3);
    });

    it("increments a value that was set via set()", async () => {
      const { cache } = createMockCache();
      await cache.set("c", 10);
      expect(await cache.increment("c")).toBe(11);
    });

    it("preserves the original TTL of an existing entry", async () => {
      const { cache } = createMockCache();
      await cache.set("c", 5, 10_000);
      mockTimerTick(5_000);
      await cache.increment("c");

      mockTimerTick(4_999);
      expect(await cache.get("c")).toBe(6);

      mockTimerTick(2);
      expect(await cache.get("c")).toBeNull();
    });

    it("applies a new TTL when the key does not exist", async () => {
      const { cache } = createMockCache();
      await cache.increment("c", 5_000);

      mockTimerTick(4_999);
      expect(await cache.get("c")).toBe(1);

      mockTimerTick(2);
      expect(await cache.get("c")).toBeNull();
    });

    it("throws CacheTypeError when the stored value is not a number", async () => {
      const { cache } = createMockCache();
      await cache.set("c", "not-a-number");
      await expect(cache.increment("c")).rejects.toThrow(CacheTypeError);
    });

    it("throws CacheTypeError with the correct key in the error", async () => {
      const { cache } = createMockCache();
      await cache.set("myKey", true);
      await expect(cache.increment("myKey")).rejects.toThrow(/myKey/);
    });

    it("does NOT throw when a numeric key has expired (treats it as fresh)", async () => {
      const { cache } = createMockCache();
      await cache.set("c", "string-val", 1_000);
      mockTimerTick(1_001);
      // getCacheEntry returns null, so increment should start fresh at 1
      await expect(cache.increment("c")).resolves.toBe(1);
    });
  });

  describe("decrement", () => {
    it("starts at -1 when the key does not exist", async () => {
      const { cache } = createMockCache();
      expect(await cache.decrement("counter")).toBe(-1);
    });

    it("decrements sequentially", async () => {
      const { cache } = createMockCache();
      expect(await cache.decrement("c")).toBe(-1);
      expect(await cache.decrement("c")).toBe(-2);
      expect(await cache.decrement("c")).toBe(-3);
    });

    it("decrements a value that was set via set()", async () => {
      const { cache } = createMockCache();
      await cache.set("c", 10);
      expect(await cache.decrement("c")).toBe(9);
    });

    it("preserves the original TTL of an existing entry", async () => {
      const { cache } = createMockCache();
      await cache.set("c", 5, 10_000);
      mockTimerTick(5_000);
      await cache.decrement("c");

      mockTimerTick(4_999);
      expect(await cache.get("c")).toBe(4);

      mockTimerTick(2);
      expect(await cache.get("c")).toBeNull();
    });

    it("applies a new TTL when the key does not exist", async () => {
      const { cache } = createMockCache();
      await cache.decrement("c", 5_000);

      mockTimerTick(4_999);
      expect(await cache.get("c")).toBe(-1);

      mockTimerTick(2);
      expect(await cache.get("c")).toBeNull();
    });

    it("throws CacheTypeError when the stored value is not a number", async () => {
      const { cache } = createMockCache();
      await cache.set("c", { x: 1 });
      await expect(cache.decrement("c")).rejects.toThrow(CacheTypeError);
    });

    it("does NOT throw when a non-numeric key has expired (treats it as fresh)", async () => {
      const { cache } = createMockCache();
      await cache.set("c", "string-val", 1_000);
      mockTimerTick(1_001);
      await expect(cache.decrement("c")).resolves.toBe(-1);
    });

    it("increment and decrement compose correctly on the same key", async () => {
      const { cache } = createMockCache();
      await cache.increment("c");
      await cache.increment("c");
      await cache.decrement("c");
      await cache.increment("c");
      expect(await cache.get("c")).toBe(2);
    });
  });

  describe("lazyCleanup", () => {
    const populateExpired = async (cache: InMemoryCache, count: number): Promise<void> => {
      for (let i = 0; i < count; i++) {
        await cache.set(`key-${i}`, i, 1);
      }
      mockTimerTick(2);
    };

    it("does NOT log when fewer than SIZE_THRESHOLD entries exist, even after 1 hour", async () => {
      const { cache, logger } = createMockCache();
      await populateExpired(cache, MOCK_CACHE_SIZE_THRESHOLD);
      mockTimerTick(MOCK_CACHE_CLEANUP_INTERVAL_MS + 1);
      await cache.set("trigger", "cleanup");
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("does not log when more than SIZE_THRESHOLD entries exist but less than 1 hour has elapsed", async () => {
      const startTime = new Date("2026-04-13T12:00:00Z");
      vi.setSystemTime(startTime);

      const { cache, logger } = createMockCache();

      for (let i = 0; i < MOCK_CACHE_SIZE_THRESHOLD + 1; i++) {
        await cache.set(`key-${i}`, i, 1);
      }

      mockTimerTick(MOCK_CACHE_CLEANUP_INTERVAL_MS - 1);

      await cache.set("trigger", "cleanup");

      expect(logger.info).not.toHaveBeenCalled();
    });

    it("logs and removes expired entries when both conditions are met", async () => {
      const { cache, logger } = createMockCache();
      await populateExpired(cache, MOCK_CACHE_SIZE_THRESHOLD + 1);
      mockTimerTick(MOCK_CACHE_CLEANUP_INTERVAL_MS + 1);
      await cache.set("trigger", "cleanup");
      expect(logger.info).toHaveBeenCalledOnce();
      expect(vi.mocked(logger.info).mock.calls[0][0]).toMatch(/Lazy cleanup performed/);
    });

    it("does not remove entries that are still live during cleanup", async () => {
      const { cache, logger } = createMockCache();

      for (let i = 0; i < MOCK_CACHE_SIZE_THRESHOLD + 1; i++) {
        await cache.set(`expired-${i}`, i, 1);
      }
      await cache.set("survivor", "alive", MOCK_CACHE_CLEANUP_INTERVAL_MS + 10_000);

      mockTimerTick(2);
      mockTimerTick(MOCK_CACHE_CLEANUP_INTERVAL_MS);

      await cache.set("trigger", "cleanup");

      expect(await cache.get("survivor")).toBe("alive");
      expect(logger.info).toHaveBeenCalledOnce();
    });

    it("resets the cleanup timer so a second set() within the hour does not clean again", async () => {
      const { cache, logger } = createMockCache();
      await populateExpired(cache, MOCK_CACHE_SIZE_THRESHOLD + 1);
      mockTimerTick(MOCK_CACHE_CLEANUP_INTERVAL_MS + 1);

      // trigger cleanup
      await cache.set("first-trigger", "a");

      // should NOT trigger again
      await cache.set("second-trigger", "b");
      expect(logger.info).toHaveBeenCalledOnce();
    });
  });

  describe("TTL edge cases", () => {
    it("a key with ttlMs=0 is immediately expired", async () => {
      const { cache } = createMockCache();
      await cache.set("k", "v", 0);
      mockTimerTick(1);
      expect(await cache.get("k")).toBeNull();
    });

    it("a very large TTL keeps the entry alive for a long time", async () => {
      const { cache } = createMockCache();
      const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;
      await cache.set("k", "v", ONE_YEAR_MS);
      mockTimerTick(ONE_YEAR_MS - 1);
      expect(await cache.get("k")).toBe("v");
    });
  });

  describe("cache entry ordering", () => {
    it("all public methods return Promises", () => {
      const { cache } = createMockCache();
      expect(cache.get("k")).toBeInstanceOf(Promise);
      expect(cache.set("k", 1)).toBeInstanceOf(Promise);
      expect(cache.delete("k")).toBeInstanceOf(Promise);
      expect(cache.increment("k")).toBeInstanceOf(Promise);
      expect(cache.decrement("k")).toBeInstanceOf(Promise);
    });

    it("sequential awaited operations are consistent", async () => {
      const { cache } = createMockCache();
      await cache.set("n", 0);
      const results = await Promise.all([
        cache.increment("n"),
        cache.increment("n"),
        cache.increment("n"),
      ]);
      expect(Math.max(...results)).toBe(3);
    });
  });
});
