import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../http-client";
import { ExternalServiceError, FetchError } from "../../errors";

describe("createHttpClient", () => {
  const baseUrl = "https://fleet.example.com";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns successful non-wrapped JSON payloads", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(http.get<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
  });

  it("transforms wrapped responses and appends query params", async () => {
    const http = createHttpClient({
      baseUrl,
      timeout: 100,
      retries: 0,
      defaultHeaders: { "X-Internal-Secret": "test-key" },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { vehicles: 3 },
          meta: { traceId: "trace-1" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await http.get<{ vehicles: number }>("/api/v1/fleet/snapshot", {
      transform: true,
      params: { status: "delayed" },
    });

    expect(result).toEqual({ vehicles: 3 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fleet.example.com/api/v1/fleet/snapshot?status=delayed",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Internal-Secret": "test-key",
        }),
      }),
    );
  });

  it("throws FetchError when an API wrapper reports failure", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          meta: {},
          error: {
            message: "Snapshot unavailable",
            statusCode: 503,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(http.get("/api/v1/fleet/snapshot", { label: "Fleet_Snapshot" })).rejects.toMatchObject(
      {
        message: "Fleet_Snapshot: Snapshot unavailable",
        status: 503,
      } satisfies Partial<FetchError>,
    );
  });

  it("converts internal abort timeouts into a 504 FetchError", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockImplementationOnce(async (_url, options) => {
      return await new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "AbortError"));
        });
      });
    });

    const requestPromise = http.get("/api/v1/fleet/snapshot", { label: "Fleet_Stream" });
    const expectation = expect(requestPromise).rejects.toMatchObject({
      message: "Fleet_Stream: Gateway Timeout",
      status: 504,
    } satisfies Partial<FetchError>);

    await vi.runOnlyPendingTimersAsync();
    await expectation;
  });

  it("wraps non-http failures as ExternalServiceError", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(http.get("/api/v1/fleet/snapshot", { label: "Fleet_Snapshot" })).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });
});
