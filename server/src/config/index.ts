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
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  OPEN_ROUTE_SERVICE_API_KEY: z.string().min(1, "ORS API Key is required"),
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
      enableFleetSimulator: env.ENABLE_FLEET_SIMULATOR,
      orsApiKey: env.OPEN_ROUTE_SERVICE_API_KEY,
    },
  },
} as const;

export type IAppConfig = typeof config;
