import { describe, expect, it } from "vitest";
import { createConfig } from "../index";

describe("Config Module", () => {
  it("should load valid defaults", () => {
    const cfg = createConfig({
      NODE_ENV: "development",
      OPEN_ROUTE_SERVICE_API_KEY: "valid-key",
    });

    expect(cfg.server.port).toBe(5570);
    expect(cfg.server.isDev).toBe(true);
  });

  it("should allow missing ORS Key in test environment", () => {
    const cfg = createConfig({ NODE_ENV: "test" });
    expect(cfg.modules.fleet.ors.apiKey).toBe("test-key");
  });

  it("should throw if ORS Key is missing in production", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        OPEN_ROUTE_SERVICE_API_KEY: "",
      }),
    ).toThrow();
  });

  it("should enforce secret length in production", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        OPEN_ROUTE_SERVICE_API_KEY: "key",
        INTERNAL_AUTH_SECRET: "short",
      }),
    ).toThrow(/INTERNAL_AUTH_SECRET/);
  });

  it("should correctly transform boolean strings", () => {
    const cfg = createConfig({ ENABLE_FLEET_SIMULATOR: "true" });
    expect(cfg.modules.fleet.enableFleetSimulator).toBe(true);
  });

  it("should coerce numeric strings to numbers", () => {
    const cfg = createConfig({ PORT: "8080" });
    expect(cfg.server.port).toBe(8080);
  });

  it("should expose ORS transport tuning config", () => {
    const cfg = createConfig({
      NODE_ENV: "development",
      OPEN_ROUTE_SERVICE_API_KEY: "valid-key",
      ORS_REQUEST_TIMEOUT_MS: "18000",
      ORS_REQUEST_RETRIES: "2",
      ORS_REQUEST_RETRY_DELAY_MS: "500",
      ORS_BATCH_MAX_SIZE: "25",
      ORS_SNAP_RADIUS_METERS: "200",
    });

    expect(cfg.modules.fleet.ors).toEqual({
      timeoutMs: 18000,
      retries: 2,
      retryDelayMs: 500,
      batchMaxSize: 25,
      snapRadiusMeters: 200,
    });
  });
});
