import { mockVehicles } from "@modules/vehicle/data/mock-vehicles";
import { bootstrapIntegrationApp, openFleetStream, waitForFleetSnapshot } from "@shared/testing";

describe("Vehicle and Fleet Integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("updates vehicle state through HTTP and reflects the change in the fleet snapshot", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      const initialSnapshot = await harness.requester
        .get("/api/v1/fleet/snapshot")
        .set(harness.authHeaders);

      expect(initialSnapshot.status).toBe(200);

      const vehicleId = "V-101";
      const nextLat = 51.61;
      const nextLng = -0.2;

      const patchResponse = await harness.requester
        .patch(`/api/v1/vehicles/${vehicleId}/location`)
        .set(harness.authHeaders)
        .send({
          lat: nextLat,
          lng: nextLng,
          status: "delayed",
        });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.data).toMatchObject({
        id: vehicleId,
        lat: nextLat,
        lng: nextLng,
        status: "delayed",
      });

      const fleetSnapshot = await waitForFleetSnapshot(harness.requester, (snapshot) => {
        const updatedVehicle = snapshot.vehicles.find((v) => v.id === vehicleId);

        return (
          updatedVehicle?.lat === nextLat &&
          updatedVehicle?.lng === nextLng &&
          updatedVehicle?.status === "delayed"
        );
      });

      expect(fleetSnapshot.summary).toEqual({
        total: mockVehicles.length,
        delayedCount: 3,
        activeCount: 2,
        performancePct: 40,
      });

      const vehiclesResponse = await harness.requester
        .get("/api/v1/vehicles")
        .set(harness.authHeaders);

      expect(vehiclesResponse.status).toBe(200);
      expect(
        vehiclesResponse.body.data.find((vehicle: { id: string }) => vehicle.id === vehicleId),
      ).toMatchObject({
        id: vehicleId,
        lat: nextLat,
        lng: nextLng,
        status: "delayed",
      });
    } finally {
      await harness.close();
    }
  });

  it("rejects unauthenticated fleet requests before the controller and preserves request ids", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      const response = await harness.requester.get("/api/v1/fleet/snapshot");

      expect(response.status).toBe(401);
      expect(response.headers["x-request-id"]).toBeTruthy();
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORISED");
    } finally {
      await harness.close();
    }
  });

  it("enforces the snapshot rate limiter after authenticated requests", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      for (let index = 0; index < 30; index++) {
        const response = await harness.requester
          .get("/api/v1/fleet/snapshot")
          .set(harness.authHeaders);

        expect(response.status).toBe(200);
      }

      const limitedResponse = await harness.requester
        .get("/api/v1/fleet/snapshot")
        .set(harness.authHeaders);

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.headers["x-request-id"]).toBeTruthy();
      expect(limitedResponse.body.error.code).toBe("TOO_MANY_REQUESTS");
    } finally {
      await harness.close();
    }
  });

  it("maps domain and handler errors to consistent HTTP status codes", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      const notFoundResponse = await harness.requester
        .patch("/api/v1/vehicles/does-not-exist/location")
        .set(harness.authHeaders)
        .send({
          lat: 51.5,
          lng: -0.11,
          status: "active",
        });

      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.error.code).toBe("NOT_FOUND");

      const maintenanceResponse = await harness.requester
        .patch("/api/v1/vehicles/V-103/location")
        .set(harness.authHeaders)
        .send({
          lat: 51.52,
          lng: -0.14,
          status: "maintenance",
        });

      expect(maintenanceResponse.status).toBe(200);

      const unprocessableResponse = await harness.requester
        .patch("/api/v1/vehicles/V-103/location")
        .set(harness.authHeaders)
        .send({
          lat: 51.53,
          lng: -0.15,
          status: "active",
        });

      expect(unprocessableResponse.status).toBe(422);
      expect(unprocessableResponse.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    } finally {
      await harness.close();
    }
  });

  it("rejects invalid vehicle update payloads with structured validation details", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      const response = await harness.requester
        .patch("/api/v1/vehicles/V-101/location")
        .set(harness.authHeaders)
        .send({
          lat: 95,
          lng: -0.2,
          status: "teleporting",
          extra: true,
        });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("UNPROCESSABLE_ENTITY");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "body.lat" }),
          expect.objectContaining({ path: "body.status" }),
          expect.objectContaining({ path: "body" }),
        ]),
      );
    } finally {
      await harness.close();
    }
  });

  it("streams the initial fleet snapshot and heartbeat frames over SSE", async () => {
    const harness = await bootstrapIntegrationApp();

    try {
      const streamResult = await openFleetStream(harness.app, 2000);

      expect(streamResult.statusCode).toBe(200);
      expect(streamResult.headers["content-type"]).toContain("text/event-stream");
      expect(streamResult.events[0]).toMatchObject({
        event: "stats-update",
      });
      expect(streamResult.events[0]?.data).toMatchObject({
        summary: {
          total: mockVehicles.length,
        },
      });
      expect(streamResult.heartbeats).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });
});
