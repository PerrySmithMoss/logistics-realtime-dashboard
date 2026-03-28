import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_SERVICE_URL
  ? `${process.env.BACKEND_SERVICE_URL}/api/v1/fleet/stats/stream`
  : "http://localhost:5500/api/v1/fleet/stats/stream";

export async function GET(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") || crypto.randomUUID();

  try {
    const response = await fetch(BACKEND_URL, {
      headers: {
        Accept: "text/event-stream",
        "X-Trace-Id": traceId,
        // 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`, // Securely injected
      },
      cache: "no-store",
      signal: req.signal,
    });

    if (!response.ok) {
      return new Response("Backend Stream Unavailable", { status: 502 });
    }

    // 2. Pipe the underlying ReadableStream directly to the client
    // This ensures zero-latency and low memory usage on the Next.js server
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Critical for Nginx/Vercel
        "X-Trace-Id": traceId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    console.error(`[Proxy Error] Trace: ${traceId}`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
