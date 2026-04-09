import { httpClient } from "@shared/lib/http";
import { createMockLogger } from "@shared/test-utils";
import { OpenRouteServiceClient } from "../ors.client";

vi.mock("@shared/lib/http", () => ({
  httpClient: vi.fn(),
}));

const mockLogger = createMockLogger();
const mockOrsApiKey = "test-api-key";

describe("OpenRouteServiceClient", () => {
  let client: OpenRouteServiceClient;

  beforeEach(() => {
    client = new OpenRouteServiceClient(mockOrsApiKey, mockLogger);
    vi.clearAllMocks();
  });

  describe("snapBatch: Happy Paths", () => {
    it("should transform points and return successful snaps", async () => {
      const inputPoints = [{ lat: 10, lng: 20 }];

      (httpClient as any).mockResolvedValue({
        locations: [
          {
            location: [20.001, 10.001],
            name: "Main St",
          },
        ],
      });

      const result = await client.snapBatch(inputPoints);

      expect(httpClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ locations: [[20, 10]], radius: 350 }),
          headers: expect.objectContaining({ Authorization: mockOrsApiKey }),
        }),
      );

      expect(result[0]).toEqual({
        lat: 10.001,
        lng: 20.001,
        success: true,
        streetName: "Main St",
      });
    });

    it("should mark success as false if the point didn't snap (moved < threshold)", async () => {
      const inputPoints = [{ lat: 10, lng: 20 }];

      (httpClient as any).mockResolvedValue({
        locations: [
          {
            location: [20.000001, 10.000001],
            name: "Unchanged St",
          },
        ],
      });

      const result = await client.snapBatch(inputPoints);
      expect(result[0].success).toBe(false);
    });

    it("should pass the AbortSignal to the httpClient", async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      (httpClient as any).mockResolvedValue({ locations: [] });

      await client.snapBatch([{ lat: 1, lng: 1 }], { signal });

      expect(httpClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal }),
      );
    });
  });

  describe("snapBatch: Edge Cases & Error Handling", () => {
    it("should return fallback points when API returns invalid payload", async () => {
      const inputPoints = [{ lat: 5, lng: 5 }];
      (httpClient as any).mockResolvedValue({ some_other_key: [] });

      const result = await client.snapBatch(inputPoints);

      expect(result[0].success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("empty/invalid payload"),
        expect.any(Object),
      );
    });

    it("should handle AbortError gracefully (from Lifecycle Manager)", async () => {
      const inputPoints = [{ lat: 5, lng: 5 }];
      const abortError = new Error("AbortError");
      abortError.name = "AbortError";

      (httpClient as any).mockRejectedValue(abortError);

      const result = await client.snapBatch(inputPoints);

      expect(result[0].success).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Request cancelled"),
      );
    });

    it("should log error and return fallback when httpClient throws a generic error", async () => {
      const inputPoints = [{ lat: 5, lng: 5 }];
      const networkError = new Error("Connection Refused");

      (httpClient as any).mockRejectedValue(networkError);

      const result = await client.snapBatch(inputPoints);

      expect(result[0].success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Batch snapping failed"),
        networkError,
      );
    });
  });
});
