import { afterEach, describe, expect, it, vi } from "vitest";
import { throttle } from "./throttle.util";

describe("throttle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires immediately, then emits only the latest trailing call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 500);

    throttled("first");
    throttled("second");
    throttled("third");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenNthCalledWith(1, "first");

    vi.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, "third");
  });

  it("cancels a scheduled trailing invocation", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 500);

    throttled("first");
    throttled("second");
    throttled.cancel();
    vi.advanceTimersByTime(500);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
