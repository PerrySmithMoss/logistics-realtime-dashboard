import { mergeAbortSignals } from "../abort.utils";

describe("mergeAbortSignals", () => {
  it("aborts when any source signal aborts", () => {
    const controllerA = new AbortController();
    const controllerB = new AbortController();
    const merged = mergeAbortSignals([controllerA.signal, controllerB.signal]);

    controllerB.abort("stopped");

    expect(merged.aborted).toBe(true);
    expect(merged.reason).toBe("stopped");
  });
});
