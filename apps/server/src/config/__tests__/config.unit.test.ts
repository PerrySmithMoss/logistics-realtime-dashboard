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
      if (key === "FLEET_STREAM_SIGNING_SECRET") return "valid-stream-signing-secret-32chars";
      return undefined;
    });

    const cfg = createConfig({
      NODE_ENV: "development",
    });

    expect(cfg.server.port).toBe(5570);
    expect(cfg.server.isDev).toBe(true);
    expect(cfg.modules.fleet.ors.apiKey).toBe("valid-key");
    expect(cfg.server.corsAllowedOrigins).toContain("http://localhost:3000");
  });

  it("should allow missing ORS Key in test environment", () => {
    vi.mocked(getSecret).mockReturnValue(undefined);

    const cfg = createConfig({ NODE_ENV: "test" });
    expect(cfg.modules.fleet.ors.apiKey).toBe("test-key");
    expect(cfg.server.streamSigningSecret).toBe("test_stream_signing_secret_32_chars_long");
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

  it("should enforce stream signing secret length in production", () => {
    vi.mocked(getSecret).mockImplementation((key) => {
      if (key === "OPEN_ROUTE_SERVICE_API_KEY") return "valid-long-api-key";
      if (key === "INTERNAL_AUTH_SECRET")
        return "valid_internal_secret_32_chars_long";
      if (key === "FLEET_STREAM_SIGNING_SECRET") return "short";
      return undefined;
    });

    expect(() =>
      createConfig({
        NODE_ENV: "production",
      }),
    ).toThrow(/FLEET_STREAM_SIGNING_SECRET/);
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
    vi.mocked(getSecret).mockImplementation((key) => {
      if (key === "OPEN_ROUTE_SERVICE_API_KEY") return "valid-key";
      if (key === "FLEET_STREAM_SIGNING_SECRET") return "valid-stream-signing-secret-32chars";
      return undefined;
    });

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

  it("should parse comma-separated cors origins", () => {
    vi.mocked(getSecret).mockImplementation((key) => {
      if (key === "OPEN_ROUTE_SERVICE_API_KEY") return "valid-key";
      if (key === "FLEET_STREAM_SIGNING_SECRET") return "valid-stream-signing-secret-32chars";
      return undefined;
    });

    const cfg = createConfig({
      NODE_ENV: "development",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://fleet-dashboard-pied.vercel.app",
    });

    expect(cfg.server.corsAllowedOrigins).toEqual([
      "http://localhost:3000",
      "https://fleet-dashboard-pied.vercel.app",
    ]);
  });
});
