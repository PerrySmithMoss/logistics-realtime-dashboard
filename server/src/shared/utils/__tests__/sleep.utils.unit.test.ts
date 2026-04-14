import { describe, expect, it, vi } from "vitest";
import { sleep } from "../promise.utils";

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
});
