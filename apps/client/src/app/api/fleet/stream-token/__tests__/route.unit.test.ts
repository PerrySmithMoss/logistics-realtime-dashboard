import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifySessionToken = vi.hoisted(() => vi.fn());
const joseState = vi.hoisted(() => ({
  setProtectedHeader: vi.fn(),
  setAudience: vi.fn(),
  setIssuedAt: vi.fn(),
  setJti: vi.fn(),
  setExpirationTime: vi.fn(),
  sign: vi.fn(),
}));

vi.mock("@/shared/lib/session", () => ({
  SESSION_COOKIE_NAME: "fleet_session",
  verifySessionToken,
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(function () {
    return {
      setProtectedHeader: joseState.setProtectedHeader.mockReturnThis(),
      setAudience: joseState.setAudience.mockReturnThis(),
      setIssuedAt: joseState.setIssuedAt.mockReturnThis(),
      setJti: joseState.setJti.mockReturnThis(),
      setExpirationTime: joseState.setExpirationTime.mockReturnThis(),
      sign: joseState.sign,
    };
  }),
}));

vi.mock("@/config/server-env", () => ({
  serverEnv: {
    FLEET_STREAM_SIGNING_SECRET: "test_stream_signing_secret_32_chars",
  },
}));

import { POST } from "../route";

describe("fleet stream token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-jti");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T10:00:00Z"));
    joseState.sign.mockResolvedValue("signed-stream-token");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("issues a short-lived stream JWT for a valid session", async () => {
    verifySessionToken.mockResolvedValueOnce({ role: "viewer" });

    const req = {
      cookies: {
        get: (name: string) => (name === "fleet_session" ? { value: "session-token" } : undefined),
      },
    };

    const response = await POST(req as never);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string };
    expect(body.token).toBe("signed-stream-token");
    expect(joseState.setProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
    expect(joseState.setAudience).toHaveBeenCalledWith("fleet-stream");
    expect(joseState.setIssuedAt).toHaveBeenCalledWith(Math.floor(Date.now() / 1000));
    expect(joseState.setJti).toHaveBeenCalledWith("test-jti");
    expect(joseState.setExpirationTime).toHaveBeenCalledWith(Math.floor(Date.now() / 1000) + 30);
  });

  it("rejects requests without a valid session", async () => {
    verifySessionToken.mockResolvedValueOnce(null);

    const req = {
      cookies: {
        get: (name: string) => (name === "fleet_session" ? { value: "bad-session" } : undefined),
      },
    };

    const response = await POST(req as never);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Authentication required" });
  });
});
