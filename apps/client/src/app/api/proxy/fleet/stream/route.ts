import { serverEnv } from "@/config/server-env";
import { createLogger } from "@/shared/infrastructure";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const logger = createLogger("Fleet Stream Proxy");

const STREAM_URL = `${serverEnv.FLEET_API_BASE_URL}/api/v1/fleet/stream`;

export async function GET(req: NextRequest) {
  const userRole = req.headers.get("x-user-role") ?? "viewer";
  const traceId = req.headers.get("x-trace-id") || crypto.randomUUID();

  const upstreamAbortController = new AbortController();

  req.signal.addEventListener("abort", () => upstreamAbortController.abort(req.signal.reason), {
    once: true,
  });

  try {
    const response = await fetch(STREAM_URL, {
      headers: {
        Accept: "text/event-stream",
        "X-Trace-Id": traceId,
        "X-Internal-secret": serverEnv.FLEET_API_INTERNAL_KEY,
        "X-User-Role": userRole,
      },
      cache: "no-store",
      signal: upstreamAbortController.signal,
    });

    if (!response.ok) {
      logger.error("Upstream stream request failed", {
        status: response.status,
        traceId,
        url: STREAM_URL,
      });

      if ([401, 403].includes(response.status)) {
        return new Response("Upstream Error", { status: response.status });
      }

      return new Response("Upstream Error", { status: 502 });
    }

    if (!response.body) {
      return new Response(null, { status: 204 });
    }

    const reader = response.body.getReader();

    let upstreamCancelled = false;

    const cancelUpstream = async () => {
      if (upstreamCancelled) return;
      upstreamCancelled = true;
      upstreamAbortController.abort();
      try {
        await reader.cancel();
      } catch {
        // no-op: upstream may already be closed
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let streamClosed = false;

        const closeStream = () => {
          if (streamClosed) return;
          streamClosed = true;
          controller.close();
        };

        const onAbort = () => void cancelUpstream();
        req.signal.addEventListener("abort", onAbort, { once: true });

        const pump = async () => {
          try {
            while (true) {
              if (req.signal.aborted) {
                await cancelUpstream();
                closeStream();
                return;
              }

              const { done, value } = await reader.read();

              if (done) {
                closeStream();
                return;
              }

              if (value) {
                controller.enqueue(value);
              }
            }
          } catch (error) {
            if (req.signal.aborted || streamClosed) {
              closeStream();
              return;
            }

            streamClosed = true;
            controller.error(error);
          } finally {
            req.signal.removeEventListener("abort", onAbort);
          }
        };
        void pump();
      },
      async cancel() {
        await cancelUpstream();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Trace-Id": traceId,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    logger.error(`Proxy Stream error.`, { error, traceId });
    return new Response("Proxy Stream Failure", { status: 500 });
  }
}
