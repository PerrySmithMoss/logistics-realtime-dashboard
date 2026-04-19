import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testState = vi.hoisted(() => ({
  sign: vi.fn(),
  setProtectedHeader: vi.fn(),
  setIssuedAt: vi.fn(),
  setExpirationTime: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(function () {
    return {
      setProtectedHeader: testState.setProtectedHeader.mockReturnThis(),
      setIssuedAt: testState.setIssuedAt.mockReturnThis(),
      setExpirationTime: testState.setExpirationTime.mockReturnThis(),
      sign: testState.sign,
    };
  }),
  jwtVerify: testState.jwtVerify,
}));

describe("session helpers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/config/server-env");
  });

  it("creates a signed session token and verifies the payload", async () => {
    vi.doMock("@/config/server-env", () => ({
      serverEnv: {
        SESSION_SIGNING_SECRET: "test_session_signing_secret_32_chars",
      },
    }));

    const { createSessionToken, verifySessionToken } = await import("../session");
    testState.sign.mockResolvedValueOnce("signed-token");
    testState.jwtVerify.mockResolvedValueOnce({
      payload: { role: "viewer", iat: 123, exp: 456 },
    });

    const token = await createSessionToken({ role: "viewer" });
    const payload = await verifySessionToken(token);

    expect(token).toBe("signed-token");
    expect(testState.setProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
    expect(testState.setIssuedAt).toHaveBeenCalledTimes(1);
    expect(testState.setExpirationTime).toHaveBeenCalledWith("1h");
    expect(payload).toMatchObject({ role: "viewer" });
  });

  it("returns null for malformed tokens", async () => {
    vi.doMock("@/config/server-env", () => ({
      serverEnv: {
        SESSION_SIGNING_SECRET: "test_session_signing_secret_32_chars",
      },
    }));

    const { verifySessionToken } = await import("../session");
    testState.jwtVerify.mockRejectedValueOnce(new Error("bad token"));

    await expect(verifySessionToken("not-a-jwt")).resolves.toBeNull();
  });
});
