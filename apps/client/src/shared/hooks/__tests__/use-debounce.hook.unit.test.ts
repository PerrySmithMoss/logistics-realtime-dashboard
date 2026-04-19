import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../use-debounce.hook";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it("holds the previous value until the debounce delay elapses", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 150), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    expect(result.current).toBe("initial");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current).toBe("updated");
  });

  it("cancels pending updates when a newer value arrives", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 150), {
      initialProps: { value: "A" },
    });

    rerender({ value: "B" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    rerender({ value: "C" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current).toBe("A");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current).toBe("C");
  });
});
