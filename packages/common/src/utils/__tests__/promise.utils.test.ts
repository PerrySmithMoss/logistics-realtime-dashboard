import { exponentialBackoff, sleep } from "../promise.utils";

describe("promise utils", () => {
  it("resolves sleep after the requested duration", async () => {
    vi.useFakeTimers();

    const promise = sleep(25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("applies exponential delay with jitter", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const promise = exponentialBackoff(100, 2, 20);
    await vi.advanceTimersByTimeAsync(410);

    await expect(promise).resolves.toBeUndefined();

    vi.restoreAllMocks();
    vi.useRealTimers();
  });
});
