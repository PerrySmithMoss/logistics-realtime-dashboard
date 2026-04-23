import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
  withContext: vi.fn(),
}));

vi.mock("@/shared/infrastructure", () => ({
  createLogger: () => logger,
}));

vi.mock("@/config/server-env", () => ({
  serverEnv: {
    FLEET_API_BASE_URL: "http://fleet-api.test",
    FLEET_API_INTERNAL_KEY: "internal-secret",
  },
}));

describe("fleet stream proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("trace-generated");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies the upstream SSE stream with the expected headers", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      },
    });

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    ) as unknown as typeof fetch;

    const req = new Request("http://localhost/api/proxy/fleet/stream", {
      headers: {
        "x-user-role": "operator",
        "x-trace-id": "trace-123",
      },
    });

    const response = await GET(req as never);

    expect(fetch).toHaveBeenCalledWith(
      "http://fleet-api.test/api/v1/fleet/stream",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
        headers: {
          Accept: "text/event-stream",
          "X-Trace-Id": "trace-123",
          "X-Internal-secret": "internal-secret",
          "X-User-Role": "operator",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("X-Trace-Id")).toBe("trace-123");
  });

  it("cancels the upstream stream when the downstream request aborts", async () => {
    let cancelCount = 0;

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      },
      cancel() {
        cancelCount++;
      },
    });

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    ) as unknown as typeof fetch;

    const abortController = new AbortController();
    const req = {
      headers: new Headers(),
      signal: abortController.signal,
    };

    const response = await GET(req as never);
    expect(response.body).toBeTruthy();

    const reader = response.body!.getReader();
    await reader.read();

    abortController.abort();
    await reader.cancel();

    expect(cancelCount).toBeGreaterThan(0);
  });

  it("defaults the user role and generates a trace id when the request lacks them", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const req = new Request("http://localhost/api/proxy/fleet/stream");

    const response = await GET(req as never);

    expect(fetch).toHaveBeenCalledWith(
      "http://fleet-api.test/api/v1/fleet/stream",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Trace-Id": "trace-generated",
          "X-User-Role": "viewer",
        }),
      }),
    );
    expect(response.headers.get("X-Trace-Id")).toBe("trace-generated");
  });

  it.each([401, 403])("passes through upstream auth failures for %s", async (status) => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status })) as unknown as typeof fetch;

    const response = await GET(new Request("http://localhost/api/proxy/fleet/stream") as never);

    expect(response.status).toBe(status);
    expect(await response.text()).toBe("Upstream Error");
    expect(logger.error).toHaveBeenCalledWith(
      "Upstream stream request failed",
      expect.objectContaining({ status }),
    );
  });

  it("maps non-auth upstream failures to 502", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 })) as unknown as typeof fetch;

    const response = await GET(new Request("http://localhost/api/proxy/fleet/stream") as never);

    expect(response.status).toBe(502);
  });

  it("returns 204 when the upstream response has no stream body", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch;

    const response = await GET(new Request("http://localhost/api/proxy/fleet/stream") as never);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns 499 for aborted upstream requests", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abortError) as unknown as typeof fetch;

    const response = await GET(new Request("http://localhost/api/proxy/fleet/stream") as never);

    expect(response.status).toBe(499);
  });

  it("returns 500 and logs unexpected proxy failures", async () => {
    const upstreamError = new Error("socket closed");
    global.fetch = vi.fn().mockRejectedValueOnce(upstreamError) as unknown as typeof fetch;

    const response = await GET(new Request("http://localhost/api/proxy/fleet/stream") as never);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Proxy Stream Failure");
    expect(logger.error).toHaveBeenCalledWith(
      "Proxy Stream error.",
      expect.objectContaining({
        error: upstreamError,
        traceId: "trace-generated",
      }),
    );
  });
});
