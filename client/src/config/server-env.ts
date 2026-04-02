"server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  FLEET_API_BASE_URL: z.string().min(1, "FLEET_API_BASE_URL is required"),
  // FLEET_INTERNAL_API_KEY: z
  //   .string()
  //   .min(1, "FLEET_INTERNAL_API_KEY is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[server-env] Invalid environment configuration:\n",
    z.prettifyError(parsed.error),
  );
  throw new Error("[server-env] Missing or invalid environment variables.");
}

export const serverEnv = parsed.data;
