"server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SESSION_SIGNING_SECRET: z.string().optional(),
    FLEET_API_BASE_URL: z
      .url({ error: "FLEET_API_BASE_URL must be a valid URL" })
      .default("http://localhost:5500"),
    FLEET_API_INTERNAL_KEY: z
      .string()
      .min(1, "FLEET_API_INTERNAL_KEY is required"),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        // check for at least 32 characters to ensure high entropy
        return (
          !!data.SESSION_SIGNING_SECRET &&
          data.SESSION_SIGNING_SECRET.length >= 32
        );
      }
      return true;
    },
    {
      message:
        "SESSION_SIGNING_SECRET must be at least 32 characters in production",
      path: ["SESSION_SIGNING_SECRET"],
    },
  );

const _env = serverEnvSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "Invalid server environment configuration:\n",
    z.prettifyError(_env.error),
  );
  throw new Error("Invalid server environment variables.");
}

const env = _env.data;

// use fallback only for dev/test
const signingSecret =
  env.SESSION_SIGNING_SECRET ?? "random_32_byte_string-do_not_use_in_prod";

export type IServerEnv = typeof env;

export const serverEnv: IServerEnv = {
  NODE_ENV: env.NODE_ENV,
  SESSION_SIGNING_SECRET: signingSecret,
  FLEET_API_BASE_URL: env.FLEET_API_BASE_URL,
  FLEET_API_INTERNAL_KEY: env.FLEET_API_INTERNAL_KEY,
} as const;
