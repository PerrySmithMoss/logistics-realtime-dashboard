// @config/index.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5500),
  HOST: z.string().default("localhost"),
  MIN_LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("DEBUG"),

  ENABLE_FLEET_SIMULATOR: z
    .string()
    .transform((val) => val.toLowerCase() === "true")
    .default(false),

  OPEN_ROUTE_SERVICE_API_KEY: z.string().min(1, "ORS API Key is required"),
  SIMULATOR_TICK_INTERVAL: z.coerce.number().default(2000),
  SIMULATOR_WATCHDOG_TIMEOUT: z.coerce.number().default(30000),
  FLEET_BATCH_INTERVAL_MS: z.coerce.number().default(1000),
  FLEET_HYDRATION_TIMEOUT: z.coerce.number().default(30000),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid Environment Configuration:");
  console.error(JSON.stringify(z.treeifyError(_env.error), null, 2));
  process.exit(1);
}

const env = _env.data;

export const config = {
  server: {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === "production",
    isDev: env.NODE_ENV === "development",
    minLogLevel: env.MIN_LOG_LEVEL,
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
    },
  },
} as const;

export type IAppConfig = typeof config;
