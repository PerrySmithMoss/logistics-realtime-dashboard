import { httpClient } from "@shared/lib/http";
import { createMockLogger } from "@shared/testing/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouteServiceClient } from "../ors.client";

// Mock remains outside as it's a module-level override
vi.mock("@shared/lib/http", () => ({
  httpClient: vi.fn(),
}));

describe("OpenRouteServiceClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => {
    const logger = createMockLogger();
    const apiKey = "test-api-key";
    const client = new OpenRouteServiceClient(apiKey, logger, {
      timeoutMs: 15000,
      retries: 1,
      retryDelayMs: 750,
      batchMaxSize: 2,
      snapRadiusMeters: 350,
    });

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
          timeout: 15000,
          retries: 1,
          allowRetry: true,
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

    it("chunks larger point arrays into multiple ORS requests", async () => {
      const { client, mockHttp } = setup();

      mockHttp
        .mockResolvedValueOnce({
          locations: [
            { location: [20.001, 10.001] },
            { location: [21.001, 11.001] },
          ],
        })
        .mockResolvedValueOnce({
          locations: [{ location: [22.001, 12.001] }],
        });

      const result = await client.snapBatch([
        { lat: 10, lng: 20 },
        { lat: 11, lng: 21 },
        { lat: 12, lng: 22 },
      ]);

      expect(mockHttp).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3);
      expect(mockHttp).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            locations: [
              [20, 10],
              [21, 11],
            ],
            radius: 350,
          }),
        }),
      );
      expect(mockHttp).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            locations: [[22, 12]],
            radius: 350,
          }),
        }),
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
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
    });

    it("should log error and return fallback on generic failure", async () => {
      const { client, logger, mockHttp } = setup();
      const networkError = new Error("Connection Refused");

      mockHttp.mockRejectedValue(networkError);

      const result = await client.snapBatch([{ lat: 5, lng: 5 }]);

      expect(result[0].success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Batch snapping failed"),
        expect.objectContaining({
          error: networkError,
          pointCount: 1,
        }),
      );
    });
  });
});
