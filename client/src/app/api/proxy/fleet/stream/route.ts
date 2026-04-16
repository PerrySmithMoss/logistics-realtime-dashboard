import { serverEnv } from "@/config/server-env";
import { createLogger } from "@/shared/infrastructure";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const logger = createLogger("Fleet Stream Proxy");

const STREAM_URL = `${serverEnv.FLEET_API_BASE_URL}/api/v1/fleet/stream`;

export async function GET(req: NextRequest) {
  const userRole = req.headers.get("x-user-role") ?? "viewer";

  const traceId = req.headers.get("x-trace-id") || crypto.randomUUID();

  try {
    const response = await fetch(STREAM_URL, {
      headers: {
        Accept: "text/event-stream",
        "X-Trace-Id": traceId,
        "X-Internal-secret": serverEnv.FLEET_API_INTERNAL_KEY,
        "X-User-Role": userRole,
      },
      cache: "no-store",
      signal: req.signal,
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
      return new Response("No streamable content found", { status: 204 });
    }

    return new Response(response.body, {
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
