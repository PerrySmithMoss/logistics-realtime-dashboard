import { describe, expect, it, vi } from "vitest";
import { exponentialBackoff, sleep } from "../promise.utils";

describe("Promise utilities", () => {
  describe("sleep", () => {
    it("should resolve after the specified amount of time", async () => {
      const ms = 1000;
      const promise = sleep(ms);

      vi.advanceTimersByTime(ms);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should not resolve before the time has passed", async () => {
      const ms = 1000;
      const spy = vi.fn();

      sleep(ms).then(spy);

      vi.advanceTimersByTime(500);
      expect(spy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      await Promise.resolve();
      expect(spy).toHaveBeenCalled();
    });

    it("should resolve immediately if ms is 0", async () => {
      const promise = sleep(0);

      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should handle negative numbers by treating them as 0 (setTimeout default)", async () => {
      const promise = sleep(-100);

      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should call setTimeout with the correct duration", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const ms = 500;

      sleep(ms);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), ms);
    });
  });

  describe("exponentialBackoff", () => {
    it("should delay by the correct exponential amount for attempt 0", async () => {
      const delay = 1000;
      const attempt = 0;

      // Start the backoff
      const promise = exponentialBackoff(delay, attempt);

      // Exponential part: 1000 * (2^0) = 1000ms
      // Jitter part: 0-100ms
      // So it should NOT have resolved at 999ms
      await vi.advanceTimersByTimeAsync(999);

      // We use a helper to check if the promise is still pending
      const isResolved = await Promise.race([promise.then(() => true), Promise.resolve(false)]);
      expect(isResolved).toBe(false);

      // Fast-forward past the maximum possible jitter (1000 + 100)
      await vi.advanceTimersByTimeAsync(101);

      // Now it should be resolved
      await expect(promise).resolves.toBeUndefined();
    });

    it("should increase delay exponentially as attempts increase", async () => {
      const delay = 1000;
      const attempt = 2; // 1000 * (2^2) = 4000ms

      const promise = exponentialBackoff(delay, attempt);

      // At 3999ms, it definitely shouldn't be done
      await vi.advanceTimersByTimeAsync(3999);

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      // Past 4100ms (Max jitter), it must be done
      await vi.advanceTimersByTimeAsync(101);
      expect(resolved).toBe(true);
    });

    it("should incorporate a random jitter up to 100ms", async () => {
      // Mock Math.random to return a predictable value (0.5)
      // 0.5 * 100 = 50ms jitter
      const mathSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      const delay = 1000;
      const attempt = 0;
      const promise = exponentialBackoff(delay, attempt);

      // 1000 (base) + 50 (jitter) = 1050ms
      await vi.advanceTimersByTimeAsync(1049);

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(true);

      mathSpy.mockRestore();
    });
  });
});
