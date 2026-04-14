import { z } from "zod";
import packageJson from "../../package.json";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(5500),
    HOST: z.string().default("localhost"),
    MIN_LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("DEBUG"),
    INTERNAL_AUTH_SECRET: z.string().optional(),

    ENABLE_FLEET_SIMULATOR: z
      .preprocess((val) => val === "true" || val === true, z.boolean())
      .default(false),

    OPEN_ROUTE_SERVICE_API_KEY: z.string().optional(),

    SIMULATOR_TICK_INTERVAL: z.coerce.number().default(2000),
    SIMULATOR_WATCHDOG_TIMEOUT: z.coerce.number().default(30000),
    FLEET_BATCH_INTERVAL_MS: z.coerce.number().default(1000),
    FLEET_HYDRATION_TIMEOUT: z.coerce.number().default(30000),
    FLEET_SSE_MAX_CONCURRENT: z.coerce.number().default(3),
    FLEET_SSE_MIN_RETRY_MS: z.coerce.number().default(2000),
    FLEET_SSE_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        return !!data.INTERNAL_AUTH_SECRET && data.INTERNAL_AUTH_SECRET.length >= 32;
      }
      return true;
    },
    {
      message: "INTERNAL_AUTH_SECRET must be at least 32 characters in production",
      path: ["INTERNAL_AUTH_SECRET"],
    },
  )
  .refine(
    (data) => {
      if (data.NODE_ENV !== "test" && !data.OPEN_ROUTE_SERVICE_API_KEY) {
        return false;
      }
      return true;
    },
    {
      message: "OPEN_ROUTE_SERVICE_API_KEY is required in non-test environments",
      path: ["OPEN_ROUTE_SERVICE_API_KEY"],
    },
  );

export const createConfig = (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  const result = envSchema.safeParse({ ...process.env, ...overrides });

  if (!result.success) {
    if (process.env.NODE_ENV !== "test") {
      console.error("❌ Invalid Environment Configuration:");
      console.error(JSON.stringify(result.error.format(), null, 2));
      process.exit(1);
    }
    throw new Error(`Config validation failed: ${JSON.stringify(result.error.format())}`);
  }

  const env = result.data;

  return {
    app: {
      version: packageJson.version,
      name: packageJson.name,
    },
    server: {
      port: env.PORT,
      host: env.HOST,
      env: env.NODE_ENV,
      isProd: env.NODE_ENV === "production",
      isDev: env.NODE_ENV === "development",
      isTest: env.NODE_ENV === "test",
      minLogLevel: env.MIN_LOG_LEVEL,
      internalAuthSecret: env.INTERNAL_AUTH_SECRET ?? "dev-secret-only-use-locally",
    },
    modules: {
      vehicle: { seedMockData: env.ENABLE_FLEET_SIMULATOR },
      fleet: {
        orsApiKey: env.OPEN_ROUTE_SERVICE_API_KEY ?? "test-key",
        enableFleetSimulator: env.ENABLE_FLEET_SIMULATOR,
        simulatorTickInterval: env.SIMULATOR_TICK_INTERVAL,
        watchdogTimeout: env.SIMULATOR_WATCHDOG_TIMEOUT,
        batchIntervalMs: env.FLEET_BATCH_INTERVAL_MS,
        hydrationTimeout: env.FLEET_HYDRATION_TIMEOUT,
        sse: {
          maxConcurrent: env.FLEET_SSE_MAX_CONCURRENT,
          minRetryMs: env.FLEET_SSE_MIN_RETRY_MS,
          heartbeatIntervalMs: env.FLEET_SSE_HEARTBEAT_INTERVAL_MS,
        },
      },
    },
  } as const;
};

export const config = createConfig();
export type IAppConfig = typeof config;
