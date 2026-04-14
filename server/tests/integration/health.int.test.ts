import { bootstrapIntegrationApp } from "@shared/testing";
import { ApiResponseErrorDetails } from "@shared/types/response.types";
import { describe, expect, it, vi } from "vitest";

describe("Health Integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should return 200 OK for liveness regardless of system state", async () => {
    const harness = await bootstrapIntegrationApp();
    try {
      const res = await harness.requester.get("/health/live");
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ALIVE");
    } finally {
      await harness.close();
    }
  });

  it("should return 503 Service Unavailable when the system is not yet ready", async () => {
    const harness = await bootstrapIntegrationApp();
    const lifecycle = harness.app.getContainer().lifecycle;

    vi.spyOn(harness.app.getContainer().errorLogger, "error").mockImplementation(() => {});
    vi.spyOn(lifecycle, "isReady", "get").mockReturnValue(false);

    try {
      const res = await harness.requester.get("/health/ready");
      expect(res.status).toBe(503);

      const statusDetail = res.body.error.details.find(
        (d: ApiResponseErrorDetails) => d.path === "status",
      );
      expect(statusDetail.value).toBe("STARTING");
    } finally {
      await harness.close();
    }
  });

  it("should return 503 when fleet data is not yet hydrated", async () => {
    const harness = await bootstrapIntegrationApp();
    const dataService = harness.app.getContainer().fleetDataService;

    vi.spyOn(harness.app.getContainer().errorLogger, "error").mockImplementation(() => {});
    vi.spyOn(dataService, "isHydrated", "get").mockReturnValue(false);

    try {
      const res = await harness.requester.get("/health/ready");
      expect(res.status).toBe(503);

      const statusDetail = res.body.error.details.find(
        (d: ApiResponseErrorDetails) => d.path === "status",
      );
      expect(statusDetail.value).toBe("INITIALISING");
    } finally {
      await harness.close();
    }
  });

  it("should return 503 when the application is shutting down", async () => {
    const harness = await bootstrapIntegrationApp();
    const lifecycle = harness.app.getContainer().lifecycle;

    vi.spyOn(harness.app.getContainer().errorLogger, "error").mockImplementation(() => {});

    lifecycle.prepareForShutdown();

    try {
      const res = await harness.requester.get("/health/ready");
      expect(res.status).toBe(503);

      const statusDetail = res.body.error.details.find(
        (d: ApiResponseErrorDetails) => d.path === "status",
      );
      expect(statusDetail.value).toBe("SHUTTING_DOWN");
    } finally {
      await harness.close();
    }
  });
});
