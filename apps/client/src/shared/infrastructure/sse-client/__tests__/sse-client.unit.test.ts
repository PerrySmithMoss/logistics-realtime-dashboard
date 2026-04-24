import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
  withContext: vi.fn(),
}));

vi.mock("@/shared/infrastructure/logger", () => ({
  createLogger: () => logger,
}));

import { SseClient } from "../sse-client";

const createEventStreamResponse = (chunks: string[], closeAfter = true) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();

        chunks.forEach((chunk) => {
          controller.enqueue(encoder.encode(chunk));
        });

        if (closeAfter) controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );

describe("SseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses streamed events even when frames are split across chunks", async () => {
    const onData = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockResolvedValueOnce(
        createEventStreamResponse(["event: stats-update\n", 'data: {"vehicles":', "1}\n\n"]),
      ) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream");
    client.subscribe<{ vehicles: number }>("stats-update", onData);

    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith({ vehicles: 1 });
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/fleet/stream-token",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://fleet-api.test/api/v1/fleet/stream?token=signed-stream-token",
      expect.objectContaining({
        headers: { Accept: "text/event-stream" },
      }),
    );
  });

  it("treats an unexpected server disconnect as recoverable", async () => {
    const onError = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockResolvedValueOnce(
        createEventStreamResponse(['event: heartbeat\ndata: "ok"\n\n']),
      ) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ recoverable: true });
    });
  });

  it("logs malformed JSON payloads without crashing subscribers", async () => {
    const onData = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockResolvedValueOnce(
        createEventStreamResponse(['event: stats-update\ndata: {"broken": }\n\n']),
      ) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream");
    client.subscribe("stats-update", onData);

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse "stats-update" payload',
        expect.objectContaining({
          raw: '{"broken": }',
        }),
      );
    });

    expect(onData).not.toHaveBeenCalled();
  });

  it("marks token endpoint 401 responses as non-recoverable", async () => {
    const onError = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ recoverable: false, status: 401 });
    });
  });

  it("treats stream connection failures as recoverable", async () => {
    const onError = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockRejectedValueOnce(new Error("Network timeout")) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ recoverable: true });
    });
  });

  it("marks stream 401 responses as non-recoverable", async () => {
    const onError = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 })) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ recoverable: false, status: 401 });
    });
  });

  it("marks stream 403 responses as non-recoverable", async () => {
    const onError = vi.fn();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 })) as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith({ recoverable: false, status: 403 });
    });
  });

  it("disconnects cleanly without surfacing a recoverable error", async () => {
    const onError = vi.fn();
    let capturedSignal: AbortSignal | undefined;

    const mockedFetch = vi
      .fn()
      .mockImplementationOnce(async () =>
        Response.json({
          token: "signed-stream-token",
        }),
      )
      .mockImplementationOnce(async (_url, options) => {
        capturedSignal = options?.signal;

        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              options?.signal?.addEventListener("abort", () => {
                controller.error(new DOMException("Aborted", "AbortError"));
              });
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      });

    global.fetch = mockedFetch as unknown as typeof fetch;

    const client = new SseClient("http://fleet-api.test/api/v1/fleet/stream", onError);
    client.subscribe("stats-update", vi.fn());

    await vi.waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    client.disconnect();

    await vi.waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
