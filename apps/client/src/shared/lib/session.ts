"server-only";

import { serverEnv } from "@/config/server-env";
import { JWTPayload, SignJWT, jwtVerify } from "jose";

const ALGO = "HS256";
const SECRET = new TextEncoder().encode(
  serverEnv.SESSION_SIGNING_SECRET || "dev_fallback_secret_32_chars_min",
);

export const SESSION_COOKIE_NAME = "fleet_session";

export async function createSessionToken(payload: JWTPayload | undefined) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALGO })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      algorithms: [ALGO],
    });
    return payload;
  } catch {
    // let caller handle malformed token
    return null;
  }
}
