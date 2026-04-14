import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import { bootstrapE2EApp, forceCloseAllE2EHarnesses } from "@shared/testing";
import { sleep } from "@shared/utils";
import { afterAll, describe, expect, it, vi } from "vitest";

describe("Fleet Pressure E2E", () => {
  afterAll(async () => {
    await forceCloseAllE2EHarnesses();
  }, 20000);

  it("collapses a burst of vehicle updates to the final projected state without snapshot flicker", async () => {
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
      const vehicleId = "V-104";
      const burst = Array.from({ length: 50 }, (_, index) => ({
        lat: 51.7 + index * 0.0001,
        lng: -0.3 - index * 0.0001,
        status: (index === 49 ? "delayed" : "active") as "active" | "delayed",
      }));
      const finalUpdate = burst[burst.length - 1];

      const stream = await harness.openStream({
        forwardedFor: "198.51.100.42",
      });

      await stream.waitForEvent("stats-update");

      await Promise.all(
        burst.map((update) =>
          harness.requester
            .patch(`/api/v1/vehicles/${vehicleId}/location`)
            .set(harness.authHeaders)
            .send(update)
            .expect(200),
        ),
      );

      await vi.advanceTimersByTimeAsync(harness.config.modules.fleet.batchIntervalMs + 10);
      await vi.advanceTimersByTimeAsync(1000);

      const finalEvent = await stream.waitForEvent<IFleetSnapshot>(
        "stats-update",
        (snapshot) => {
          const vehicle = snapshot.vehicles.find((candidate) => candidate.id === vehicleId);
          return (
            vehicle?.lat === finalUpdate.lat &&
            vehicle.lng === finalUpdate.lng &&
            vehicle.status === finalUpdate.status
          );
        },
        1500,
      );

      const propagatedStates = stream.parsedEvents
        .filter((event) => event.event === "stats-update")
        .slice(1)
        .map((event) =>
          (event.data as IFleetSnapshot).vehicles.find((candidate) => candidate.id === vehicleId),
        )
        .filter((vehicle): vehicle is NonNullable<typeof vehicle> => Boolean(vehicle));

      expect(propagatedStates.length).toBeGreaterThan(0);
      expect(
        propagatedStates.every(
          (vehicle) =>
            vehicle.lat === finalUpdate.lat &&
            vehicle.lng === finalUpdate.lng &&
            vehicle.status === finalUpdate.status,
        ),
      ).toBe(true);

      const persistedSnapshot = await harness.waitForFleetSnapshot((snapshot) => {
        const vehicle = snapshot.vehicles.find((candidate) => candidate.id === vehicleId);
        return (
          vehicle?.lat === finalUpdate.lat &&
          vehicle.lng === finalUpdate.lng &&
          vehicle.status === finalUpdate.status
        );
      });

      expect(persistedSnapshot).toEqual(finalEvent.data);

      await stream.close(true);
    } finally {
      await harness.close();
    }
  });

  it("enforces SSE concurrency limits and snapshot rate limits under pressure", async () => {
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
    const forwardedFor = "198.51.100.43";

    try {
      harness.useRealTimers();

      const streams = [];

      for (let index = 0; index < harness.config.modules.fleet.sse.maxConcurrent; index++) {
        const stream = await harness.openStream({ forwardedFor });
        streams.push(stream);
        await stream.waitForEvent("stats-update");
        await sleep(harness.config.modules.fleet.sse.minRetryMs + 10);
      }

      const rejectedStream = await harness.openStream({ forwardedFor });

      expect(rejectedStream.statusCode).toBe(429);
      expect(rejectedStream.responseBody).toContain("TOO_MANY_REQUESTS");

      for (let attempt = 0; attempt < 30; attempt++) {
        const response = await harness.requester
          .get("/api/v1/fleet/snapshot")
          .set(harness.authHeaders);

        expect(response.status).toBe(200);
      }

      const rateLimitedResponse = await harness.requester
        .get("/api/v1/fleet/snapshot")
        .set(harness.authHeaders);

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error.code).toBe("TOO_MANY_REQUESTS");

      await rejectedStream.close(true);
      await Promise.all(streams.map((stream) => stream.close(true)));
    } finally {
      await harness.close();
    }
  }, 15000);
});
