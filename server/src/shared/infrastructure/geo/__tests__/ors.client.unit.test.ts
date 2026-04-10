import { httpClient } from "@shared/lib/http";
import { createMockLogger } from "@shared/test-utils";
import { describe, expect, it, vi } from "vitest";
import { OpenRouteServiceClient } from "../ors.client";

// Mock remains outside as it's a module-level override
vi.mock("@shared/lib/http", () => ({
  httpClient: vi.fn(),
}));

describe("OpenRouteServiceClient", () => {
  const setup = () => {
    const logger = createMockLogger();
    const apiKey = "test-api-key";
    const client = new OpenRouteServiceClient(apiKey, logger);

    const mockHttp = vi.mocked(httpClient);

    return { client, logger, apiKey, mockHttp };
  };

  describe("snapBatch: Happy Paths", () => {
    it("should transform points and return successful snaps", async () => {
      const { client, mockHttp, apiKey } = setup();
      const inputPoints = [{ lat: 10, lng: 20 }];

      mockHttp.mockResolvedValue({
        locations: [{ location: [20.001, 10.001], name: "Main St" }],
      });

      const result = await client.snapBatch(inputPoints);

      // verify that the coordinate flip [lat, lng] -> [lng, lat]
      expect(mockHttp).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ locations: [[20, 10]], radius: 350 }),
          headers: expect.objectContaining({ Authorization: apiKey }),
        }),
      );

      expect(result[0]).toMatchObject({
        lat: 10.001,
        lng: 20.001,
        success: true,
      });
    });

    it("should pass the AbortSignal to the httpClient", async () => {
      const { client, mockHttp } = setup();
      const controller = new AbortController();

      mockHttp.mockResolvedValue({ locations: [] });

      await client.snapBatch([{ lat: 1, lng: 1 }], {
        signal: controller.signal,
      });

      expect(mockHttp).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });

  describe("snapBatch: Edge Cases & Error Handling", () => {
    it("should handle AbortError gracefully", async () => {
      const { client, logger, mockHttp } = setup();
      const abortError = new Error("AbortError");
      abortError.name = "AbortError";

      mockHttp.mockRejectedValue(abortError);

      const result = await client.snapBatch([{ lat: 5, lng: 5 }]);

      expect(result[0].success).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("cancelled"),
      );
    });

    it("should log error and return fallback on generic failure", async () => {
      const { client, logger, mockHttp } = setup();
      const networkError = new Error("Connection Refused");

      mockHttp.mockRejectedValue(networkError);

      const result = await client.snapBatch([{ lat: 5, lng: 5 }]);

      expect(result[0].success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Batch snapping failed"),
        networkError,
      );
    });
  });
});
