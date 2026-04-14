import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import { bootstrapE2EApp, forceCloseAllE2EHarnesses } from "@shared/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

describe("Fleet Dashboard Lifecycle E2E", () => {
  afterAll(async () => {
    await forceCloseAllE2EHarnesses();
  });

  it("streams the live dashboard lifecycle from initial snapshot through persisted fleet state", async () => {
    const harness = await bootstrapE2EApp({
      configOverrides: {
        modules: {
          vehicle: {
            seedMockData: true,
          },
          fleet: {
            enableFleetSimulator: false,
          },
        },
      },
    });

    try {
      const stream = await harness.openStream({
        forwardedFor: "198.51.100.40",
      });

      expect(stream.statusCode).toBe(200);
      expect(stream.responseHeaders["content-type"]).toContain("text/event-stream");

      const initialEvent = await stream.waitForEvent<IFleetSnapshot>("stats-update");
      expect(initialEvent.data.summary).toEqual({
        total: 5,
        activeCount: 3,
        delayedCount: 2,
        performancePct: 60,
      });

      await stream.waitForHeartbeat(1, 1000);

      const updates = [
        { vehicleId: "V-101", lat: 51.6101, lng: -0.2001, status: "delayed" as const },
        { vehicleId: "V-102", lat: 51.6202, lng: -0.2102, status: "active" as const },
        { vehicleId: "V-103", lat: 51.6303, lng: -0.2203, status: "delayed" as const },
      ];

      for (const update of updates) {
        const response = await harness.requester
          .patch(`/api/v1/vehicles/${update.vehicleId}/location`)
          .set(harness.authHeaders)
          .send(update);

        expect(response.status).toBe(200);
      }

      await vi.advanceTimersByTimeAsync(harness.config.modules.fleet.batchIntervalMs + 10);
      await vi.advanceTimersByTimeAsync(1000);

      const propagatedEvent = await stream.waitForEvent<IFleetSnapshot>(
        "stats-update",
        (snapshot) =>
          updates.every((update) => {
            const vehicle = snapshot.vehicles.find((candidate) => candidate.id === update.vehicleId);
            return (
              vehicle?.lat === update.lat &&
              vehicle.lng === update.lng &&
              vehicle.status === update.status
            );
          }) && snapshot.summary.performancePct === 40,
        1500,
      );

      expect(propagatedEvent.data.summary).toEqual({
        total: 5,
        activeCount: 2,
        delayedCount: 3,
        performancePct: 40,
      });

      const persistedSnapshotResponse = await harness.requester
        .get("/api/v1/fleet/snapshot")
        .set(harness.authHeaders);

      expect(persistedSnapshotResponse.status).toBe(200);
      expect(persistedSnapshotResponse.body.data).toEqual(propagatedEvent.data);

      await stream.close(true);
    } finally {
      await harness.close();
    }
  });
});
