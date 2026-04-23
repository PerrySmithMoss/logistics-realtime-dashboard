import { UnauthorisedError } from "@shared/errors/app.errors";
import { InMemoryCache } from "@shared/infrastructure/cache";
import { createMockLogger } from "@shared/testing/test-utils";
import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { StreamTokenService } from "../stream-token.service";

const SECRET = "test_stream_signing_secret_32_chars_long";

const createToken = async (overrides: {
  jti?: string;
  audience?: string;
  expiresInSeconds?: number;
} = {}) => {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(overrides.audience ?? "fleet-stream")
    .setIssuedAt(now)
    .setJti(overrides.jti ?? crypto.randomUUID())
    .setExpirationTime(now + (overrides.expiresInSeconds ?? 30))
    .sign(new TextEncoder().encode(SECRET));
};

describe("StreamTokenService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("accepts a valid token once and rejects a replay", async () => {
    const logger = createMockLogger();
    const cache = new InMemoryCache(logger, {
      defaultTtlMs: 60_000,
      maxEntries: 5_000,
    });
    const service = new StreamTokenService(SECRET, cache, logger);
    const token = await createToken({ jti: "token-1" });

    await expect(service.verify(token, { ip: "127.0.0.1" })).resolves.toBeUndefined();
    await expect(service.verify(token, { ip: "127.0.0.1" })).rejects.toThrow(UnauthorisedError);
  });

  it("rejects tokens with the wrong audience", async () => {
    const logger = createMockLogger();
    const cache = new InMemoryCache(logger);
    const service = new StreamTokenService(SECRET, cache, logger);
    const token = await createToken({ audience: "wrong-audience" });

    await expect(service.verify(token)).rejects.toThrow(UnauthorisedError);
  });

  it("rejects expired tokens", async () => {
    const logger = createMockLogger();
    const cache = new InMemoryCache(logger);
    const service = new StreamTokenService(SECRET, cache, logger);
    const token = await createToken({ expiresInSeconds: 1 });

    await vi.advanceTimersByTimeAsync(7_000);

    await expect(service.verify(token)).rejects.toThrow(UnauthorisedError);
  });
});
