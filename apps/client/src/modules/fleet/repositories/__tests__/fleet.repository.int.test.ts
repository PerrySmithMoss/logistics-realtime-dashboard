import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../../../tests/setup/msw-server";
import { initialFleetSnapshot } from "../../../../../tests/mocks/fleet-fixtures";
import { FetchError } from "@/shared/errors";

vi.mock("server-only", () => ({}));

import { fleetRepository } from "../fleet.repository";

describe("fleetRepository integration", () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it("requests the fleet snapshot with the expected contract and unwraps the payload", async () => {
    server.use(
      http.get("http://127.0.0.1:4000/api/v1/fleet/snapshot", ({ request }) => {
        expect(request.headers.get("x-internal-secret")).toBe("test-internal-key");

        return HttpResponse.json({
          success: true,
          data: initialFleetSnapshot,
          meta: { traceId: "trace-1" },
        });
      }),
    );

    await expect(fleetRepository.getSnapshot()).resolves.toEqual(initialFleetSnapshot);
  });

  it("surfaces upstream HTTP failures as FetchError", async () => {
    server.use(
      http.get("http://127.0.0.1:4000/api/v1/fleet/vehicles/:id", () =>
        HttpResponse.json({ message: "Vehicle not found" }, { status: 404 }),
      ),
    );

    await expect(fleetRepository.getVehicleById("VHC-404")).rejects.toMatchObject({
      message: "Fleet_VehicleById: Vehicle not found",
      status: 404,
    } satisfies Partial<FetchError>);
  });
});
