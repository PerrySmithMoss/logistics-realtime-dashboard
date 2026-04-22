import { getSecret } from "@shared/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../index";

vi.mock("@shared/utils", () => ({
  getSecret: vi.fn(),
}));

describe("Config Module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should load valid defaults", () => {
    vi.mocked(getSecret).mockImplementation((key) => {
      if (key === "OPEN_ROUTE_SERVICE_API_KEY") return "valid-key";
      return undefined;
    });

    const cfg = createConfig({
      NODE_ENV: "development",
    });

    expect(cfg.server.port).toBe(5570);
    expect(cfg.server.isDev).toBe(true);
    expect(cfg.modules.fleet.ors.apiKey).toBe("valid-key");
  });

  it("should allow missing ORS Key in test environment", () => {
    vi.mocked(getSecret).mockReturnValue(undefined);

    const cfg = createConfig({ NODE_ENV: "test" });
    expect(cfg.modules.fleet.ors.apiKey).toBe("test-key");
  });

  it("should throw if ORS Key is missing in production", () => {
    vi.mocked(getSecret).mockReturnValue(undefined);

    expect(() =>
      createConfig({
        NODE_ENV: "production",
      }),
    ).toThrow(/OPEN_ROUTE_SERVICE_API_KEY/);
  });

  it("should enforce secret length in production", () => {
    vi.mocked(getSecret).mockImplementation((key) => {
      if (key === "fleet_open_route_service_api_key") return "valid-long-api-key";
      if (key === "fleet_internal_auth_secret") return "short"; // Too short for production
      return undefined;
    });

    expect(() =>
      createConfig({
        NODE_ENV: "production",
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
    vi.mocked(getSecret).mockReturnValue("valid-key");

    const cfg = createConfig({
      NODE_ENV: "development",
      ORS_REQUEST_TIMEOUT_MS: "18000",
      ORS_REQUEST_RETRIES: "2",
      ORS_REQUEST_RETRY_DELAY_MS: "500",
      ORS_BATCH_MAX_SIZE: "25",
      ORS_SNAP_RADIUS_METERS: "200",
    });

    expect(cfg.modules.fleet.ors).toMatchObject({
      timeoutMs: 18000,
      retries: 2,
      retryDelayMs: 500,
      batchMaxSize: 25,
      snapRadiusMeters: 200,
    });
  });
});
