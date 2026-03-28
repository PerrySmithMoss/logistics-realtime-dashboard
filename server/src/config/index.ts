import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5500),
  HOST: z.string().default("localhost"),
  ENABLE_FLEET_SIMULATOR: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  OSRM_URL: z.string().default("https://router.project-osrm.org"),
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
  },
  modules: {
    vehicle: {
      seedMockData: env.ENABLE_FLEET_SIMULATOR,
    },
    fleet: {
      enableFleetSimulator: env.ENABLE_FLEET_SIMULATOR,
      osrmUrl: env.OSRM_URL,
    },
  },
} as const;

export type IAppConfig = typeof config;
