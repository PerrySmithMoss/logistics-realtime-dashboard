import { serverEnv } from "@/config/server-env";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const STREAM_URL = `${serverEnv.FLEET_API_BASE_URL}/api/v1/fleet/stats/stream`;

export async function GET(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") || crypto.randomUUID();

  try {
    const response = await fetch(STREAM_URL, {
      headers: {
        Accept: "text/event-stream",
        "X-Trace-Id": traceId,
        // "Authorization": `Bearer ${serverEnv.INTERNAL_FLEET_API_TOKEN}`,
      },
      cache: "no-store",
      signal: req.signal,
    });

    if (!response.ok) {
      console.error(
        `[SSE Proxy] Backend Error: ${response.status} | Trace: ${traceId}`,
      );
      return new Response("Upstream Fleet Service Error", { status: 502 });
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

    console.error(`[SSE Proxy Critical] Trace: ${traceId}`, error);
    return new Response("Stream Proxy Failure", { status: 500 });
  }
}
