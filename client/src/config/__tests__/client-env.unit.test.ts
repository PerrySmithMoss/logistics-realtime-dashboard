import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("clientEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("reads valid client environment variables", async () => {
    process.env.NEXT_PUBLIC_NODE_ENV = "test";
    process.env.NEXT_PUBLIC_FLEET_API_BASE_URL = "http://localhost:4000";

    const { clientEnv } = await import("../client-env");

    expect(clientEnv).toEqual({
      NEXT_PUBLIC_NODE_ENV: "test",
      NEXT_PUBLIC_FLEET_API_BASE_URL: "http://localhost:4000",
    });
  });

  it("throws for invalid client environment variables", async () => {
    process.env.NEXT_PUBLIC_FLEET_API_BASE_URL = "not-a-url";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(import("../client-env")).rejects.toThrow("Invalid client environment variables.");
    expect(consoleError).toHaveBeenCalled();
  });
});
