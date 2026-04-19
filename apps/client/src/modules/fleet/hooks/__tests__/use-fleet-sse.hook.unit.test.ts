import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FleetSnapshot } from "../../types";

const testState = vi.hoisted(() => {
  const throttleCancel = vi.fn();
  const throttleMock = vi.fn((fn: (data: FleetSnapshot) => void) => {
    const wrapped = ((data: FleetSnapshot) => fn(data)) as ((data: FleetSnapshot) => void) & {
      cancel: () => void;
    };
    wrapped.cancel = throttleCancel;
    return wrapped;
  });

  return {
    throttleCancel,
    throttleMock,
    sseInstances: [] as SseInstance[],
  };
});

type SseErrorDetails = { recoverable: boolean; status?: number };
type SseSubscription = { eventName: string; handler: (data: FleetSnapshot) => void };
type SseInstance = {
  onError?: (details: SseErrorDetails) => void;
  subscriptions: SseSubscription[];
  disconnect: ReturnType<typeof vi.fn>;
};

vi.mock("@/shared/utils", () => ({
  throttle: testState.throttleMock,
}));

vi.mock("@/shared/infrastructure", () => ({
  SseClient: vi.fn().mockImplementation(function (
    _url: string,
    onError?: (details: SseErrorDetails) => void,
  ) {
    const instance: SseInstance = {
      onError,
      subscriptions: [],
      disconnect: vi.fn(),
    };

    testState.sseInstances.push(instance);

    return {
      subscribe: (eventName: string, handler: (data: FleetSnapshot) => void) => {
        instance.subscriptions.push({ eventName, handler });
      },
      disconnect: instance.disconnect,
    };
  }),
}));

import { useFleetSSE } from "../use-fleet-sse.hook";

const snapshot = {
  vehicles: [],
  summary: {
    total: 0,
    activeCount: 0,
    delayedCount: 0,
    performancePct: 0,
  },
} satisfies FleetSnapshot;

describe("useFleetSSE", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    testState.sseInstances.length = 0;
    testState.throttleCancel.mockReset();
    testState.throttleMock.mockClear();
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("subscribes to stats updates and exposes a connected state", () => {
    const onUpdate = vi.fn();

    const { result } = renderHook(() => useFleetSSE(onUpdate));

    expect(result.current.status).toBe("connecting");
    expect(testState.sseInstances).toHaveLength(1);
    expect(testState.sseInstances[0].subscriptions[0]?.eventName).toBe("stats-update");

    act(() => {
      testState.sseInstances[0].subscriptions[0].handler(snapshot);
    });

    expect(result.current.status).toBe("connected");
    expect(onUpdate).toHaveBeenCalledWith(snapshot);
  });

  it("retries recoverable failures with exponential backoff", async () => {
    const onUpdate = vi.fn();

    const { result } = renderHook(() => useFleetSSE(onUpdate));

    act(() => {
      testState.sseInstances[0].onError?.({ recoverable: true, status: 503 });
    });

    expect(result.current.status).toBe("error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(result.current.status).toBe("connecting");
    expect(testState.sseInstances).toHaveLength(2);
  });

  it("does not retry non-recoverable failures", async () => {
    renderHook(() => useFleetSSE(vi.fn()));

    act(() => {
      testState.sseInstances[0].onError?.({ recoverable: false, status: 401 });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(testState.sseInstances).toHaveLength(1);
  });

  it("disconnects the client and cancels the throttle on unmount", () => {
    const { unmount } = renderHook(() => useFleetSSE(vi.fn()));

    unmount();

    expect(testState.sseInstances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(testState.throttleCancel).toHaveBeenCalledTimes(1);
  });
});
