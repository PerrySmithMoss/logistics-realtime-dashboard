import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("serverEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("reads valid server environment variables and applies the dev/test fallback secret", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "test",
      FLEET_API_BASE_URL: "http://localhost:4000",
      FLEET_API_INTERNAL_KEY: "internal-key",
    };
    delete process.env.SESSION_SIGNING_SECRET;

    const { serverEnv } = await import("../server-env");

    expect(serverEnv.FLEET_API_BASE_URL).toBe("http://localhost:4000");
    expect(serverEnv.FLEET_API_INTERNAL_KEY).toBe("internal-key");
    expect(serverEnv.SESSION_SIGNING_SECRET).toBe("dev_secret_fallback_32_chars_long_min");
  });

  it("throws when required server env is invalid", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      FLEET_API_BASE_URL: "http://localhost:4000",
      FLEET_API_INTERNAL_KEY: "",
      SESSION_SIGNING_SECRET: "too-short",
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(import("../server-env")).rejects.toThrow("Invalid server environment variables.");
    expect(consoleError).toHaveBeenCalled();
  });
});
