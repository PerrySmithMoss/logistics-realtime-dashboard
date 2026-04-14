import { bootstrapE2EApp, forceCloseAllE2EHarnesses } from "@shared/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

describe("Fleet Simulator Idle Shutdown E2E", () => {
  afterAll(async () => {
    await forceCloseAllE2EHarnesses();
  });

  it("stops issuing simulator commands once the dashboard disconnects and remains idle", async () => {
    const harness = await bootstrapE2EApp();
    const commandExecuteSpy = vi.spyOn(harness.app.getContainer().commandBus, "execute");

    try {
      const stream = await harness.openStream({
        forwardedFor: "198.51.100.41",
      });

      await stream.waitForEvent("stats-update");
      await vi.advanceTimersByTimeAsync(harness.config.modules.fleet.simulatorTickInterval * 2);

      expect(commandExecuteSpy.mock.calls.length).toBeGreaterThan(0);

      const callCountBeforeDisconnect = commandExecuteSpy.mock.calls.length;

      await stream.close(true);
      await vi.advanceTimersByTimeAsync(1);
      await stream.waitForClosed();

      await vi.advanceTimersByTimeAsync(
        harness.config.modules.fleet.watchdogTimeout +
          harness.config.modules.fleet.simulatorTickInterval * 2,
      );

      expect(commandExecuteSpy.mock.calls.length).toBe(callCountBeforeDisconnect);
      expect(harness.app.getContainer().fleetSimulator?.["interval"]).toBeNull();
    } finally {
      await harness.close();
    }
  });
});
