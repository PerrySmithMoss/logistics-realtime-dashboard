import { serverEnv } from "@/config/server-env";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/lib/session";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

const STREAM_TOKEN_SECRET = new TextEncoder().encode(serverEnv.FLEET_STREAM_SIGNING_SECRET);
const STREAM_TOKEN_AUDIENCE = "fleet-stream";
const STREAM_TOKEN_TTL_SECONDS = 30;

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;

  if (!session || typeof session.role !== "string") {
    return Response.json({ message: "Authentication required" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(STREAM_TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setJti(crypto.randomUUID())
    .setExpirationTime(now + STREAM_TOKEN_TTL_SECONDS)
    .sign(STREAM_TOKEN_SECRET);

  return Response.json({ token });
}
