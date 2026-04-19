import { describe, expect, it, vi } from "vitest";
import { mergeAbortSignals } from "../abort.utils";

describe("mergeAbortSignals", () => {
  it("should abort the merged signal when any input signal aborts", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const mergedSignal = mergeAbortSignals([controller1.signal, controller2.signal]);

    expect(mergedSignal.aborted).toBe(false);

    controller2.abort("Target reason");

    expect(mergedSignal.aborted).toBe(true);
    expect(mergedSignal.reason).toBe("Target reason");
  });

  it("should abort immediately if one of the signals is already aborted", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    controller2.abort("Pre-aborted");

    const mergedSignal = mergeAbortSignals([controller1.signal, controller2.signal]);

    expect(mergedSignal.aborted).toBe(true);
    expect(mergedSignal.reason).toBe("Pre-aborted");
  });

  it("should clean up event listeners on all signals once one aborts", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    // We spy on removeEventListener to ensure the utility is being a good citizen
    const spy1 = vi.spyOn(controller1.signal, "removeEventListener");
    const spy2 = vi.spyOn(controller2.signal, "removeEventListener");

    mergeAbortSignals([controller1.signal, controller2.signal]);

    controller1.abort();

    expect(spy1).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(spy2).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("should work with a single signal", () => {
    const controller = new AbortController();
    const mergedSignal = mergeAbortSignals([controller.signal]);

    controller.abort("Single abort");

    expect(mergedSignal.aborted).toBe(true);
    expect(mergedSignal.reason).toBe("Single abort");
  });

  it("should not abort if no signals are aborted", () => {
    const c1 = new AbortController();
    const c2 = new AbortController();

    const mergedSignal = mergeAbortSignals([c1.signal, c2.signal]);

    expect(mergedSignal.aborted).toBe(false);
  });
});
