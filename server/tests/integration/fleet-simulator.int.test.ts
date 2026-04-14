import { bootstrapIntegrationApp, waitForFleetSnapshot } from "@shared/testing/app-harness";
import { describe, expect, it } from "vitest";

describe("Fleet Simulator Integration", () => {
  it("should wake up on SSE heartbeat and drive location updates to the snapshot", async () => {
    const harness = await bootstrapIntegrationApp();
    try {
      const initialResponse = await harness.requester
        .get("/api/v1/fleet/snapshot")
        .set(harness.authHeaders);

      const initialLat = initialResponse.body.data.vehicles[0].lat;
      const targetId = initialResponse.body.data.vehicles[0].id;

      harness.requester
        .get("/api/v1/fleet/stream")
        .set(harness.authHeaders)
        .end(() => {});

      await vi.advanceTimersByTimeAsync(500);

      await waitForFleetSnapshot(harness.requester, (snapshot) => {
        const vehicle = snapshot.vehicles.find((v) => v.id === targetId);
        return !!(vehicle && vehicle.lat !== initialLat);
      });
    } finally {
      await harness.close();
    }
  });

  it("should stop the simulator automatically when the watchdog timeout is reached", async () => {
    const harness = await bootstrapIntegrationApp();
    const { fleetSimulator } = harness.app.getContainer();

    if (!fleetSimulator) {
      throw new Error("Simulator was expected to be initialized for this test.");
    }

    try {
      fleetSimulator.heartbeat("TEST_SOURCE");
      expect(fleetSimulator["interval"]).not.toBeNull();

      await vi.advanceTimersByTimeAsync(31000);

      expect(fleetSimulator["interval"]).toBeNull();
    } finally {
      await harness.close();
    }
  });

  it("should remain resilient and continue ticking even if a single command fails", async () => {
    const harness = await bootstrapIntegrationApp();
    const { fleetSimulator, commandBus } = harness.app.getContainer();

    if (!fleetSimulator) {
      throw new Error("Simulator was expected to be initialized for this test.");
    }

    try {
      const executeSpy = vi.spyOn(commandBus, "execute");
      executeSpy.mockRejectedValueOnce(new Error("Database Timeout Simulator Test"));

      fleetSimulator.heartbeat("TEST_SOURCE");

      await vi.advanceTimersByTimeAsync(500);

      expect(fleetSimulator["interval"]).not.toBeNull();
      expect(executeSpy).toHaveBeenCalled();
    } finally {
      await harness.close();
    }
  });
});
