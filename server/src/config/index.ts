import { z } from "zod";
import packageJson from "../../package.json";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(5500),
    HOST: z.string().default("localhost"),
    MIN_LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("DEBUG"),

    INTERNAL_AUTH_SECRET: z.string().optional(),

    ENABLE_FLEET_SIMULATOR: z
      .string()
      .transform((val) => val.toLowerCase() === "true")
      .default(false),

    OPEN_ROUTE_SERVICE_API_KEY: z.string().min(1, "ORS API Key is required"),
    SIMULATOR_TICK_INTERVAL: z.coerce.number().default(2000),
    SIMULATOR_WATCHDOG_TIMEOUT: z.coerce.number().default(30000),
    FLEET_BATCH_INTERVAL_MS: z.coerce.number().default(1000),
    FLEET_HYDRATION_TIMEOUT: z.coerce.number().default(30000),
    FLEET_SSE_MAX_CONCURRENT: z.coerce.number().default(3),
    FLEET_SSE_MIN_RETRY_MS: z.coerce.number().default(2000),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        // check for at least 32 characters to ensure high entropy
        return (
          !!data.INTERNAL_AUTH_SECRET && data.INTERNAL_AUTH_SECRET.length >= 32
        );
      }
      return true;
    },
    {
      message:
        "INTERNAL_AUTH_SECRET must be at least 32 characters in production",
      path: ["INTERNAL_AUTH_SECRET"],
    },
  );

const _env = envSchema.safeParse({
  ...process.env,
  APP_VERSION: packageJson.version,
  APP_NAME: packageJson.name,
});

if (!_env.success) {
  console.error("❌ Invalid Environment Configuration:");
  console.error(JSON.stringify(z.treeifyError(_env.error), null, 2));
  process.exit(1);
}

const env = _env.data;
const internalAuthSecret =
  env.INTERNAL_AUTH_SECRET ?? "random_32_byte_string-do_not_use_in_prod";

export const config = {
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
    minLogLevel: env.MIN_LOG_LEVEL,
    internalAuthSecret,
  },
  modules: {
    vehicle: {
      seedMockData: env.ENABLE_FLEET_SIMULATOR,
    },
    fleet: {
      orsApiKey: env.OPEN_ROUTE_SERVICE_API_KEY,
      enableFleetSimulator: env.ENABLE_FLEET_SIMULATOR,
      simulatorTickInterval: env.SIMULATOR_TICK_INTERVAL,
      watchdogTimeout: env.SIMULATOR_WATCHDOG_TIMEOUT,
      batchIntervalMs: env.FLEET_BATCH_INTERVAL_MS,
      hydrationTimeout: env.FLEET_HYDRATION_TIMEOUT,
      sse: {
        maxConcurrent: env.FLEET_SSE_MAX_CONCURRENT,
        minRetryMs: env.FLEET_SSE_MIN_RETRY_MS,
      },
    },
  },
} as const;

export type IAppConfig = typeof config;
