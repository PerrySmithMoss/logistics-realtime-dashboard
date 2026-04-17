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

  it("retries idempotent server failures and eventually resolves", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const http = createHttpClient({
      baseUrl,
      timeout: 100,
      retries: 1,
      initialRetryDelay: 200,
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "temporarily unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const requestPromise = http.get<{ ok: boolean }>("/health");

    await vi.runOnlyPendingTimersAsync();

    await expect(requestPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-idempotent requests on server failures", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 2 });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "write failed" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      http.post("/api/v1/fleet/vehicles", { id: "VHC-101" }, { label: "Fleet_CreateVehicle" }),
    ).rejects.toMatchObject({
      message: "Fleet_CreateVehicle: write failed",
      status: 503,
    } satisfies Partial<FetchError>);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for no-content responses", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(http.delete("/api/v1/fleet/vehicles/VHC-101")).resolves.toBeNull();
  });

  it("surfaces malformed wrapped responses when transform is requested", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 0 });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        meta: { traceId: "trace-1" },
        data: undefined,
      }),
    });

    await expect(
      http.get("/api/v1/fleet/snapshot", {
        transform: true,
        label: "Fleet_Snapshot",
      }),
    ).rejects.toMatchObject({
      message: "Fleet_Snapshot: Wrapped response missing data field",
      status: 500,
    } satisfies Partial<FetchError>);
  });

  it("passes caller-initiated aborts through without wrapping them", async () => {
    const http = createHttpClient({ baseUrl, timeout: 100, retries: 1 });
    const controller = new AbortController();

    fetchMock.mockImplementationOnce(async (_url, options) => {
      return await new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted by caller", "AbortError"));
        });
      });
    });

    const requestPromise = http.get("/api/v1/fleet/snapshot", {
      signal: controller.signal,
    });

    controller.abort("cancelled");

    await expect(requestPromise).rejects.toMatchObject({
      name: "AbortError",
      message: "Aborted by caller",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
