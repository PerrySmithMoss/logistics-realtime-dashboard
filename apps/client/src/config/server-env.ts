"server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SESSION_SIGNING_SECRET: z.string().optional(),
    FLEET_API_BASE_URL: z
      .url({ error: "FLEET_API_BASE_URL must be a valid URL" })
      .default("http://localhost:5570"),
    FLEET_API_INTERNAL_KEY: z.string().min(1, "FLEET_API_INTERNAL_KEY is required"),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        // check for at least 32 characters to ensure high entropy
        return !!data.SESSION_SIGNING_SECRET && data.SESSION_SIGNING_SECRET.length >= 32;
      }
      return true;
    },
    {
      message: "SESSION_SIGNING_SECRET must be at least 32 characters in production",
      path: ["SESSION_SIGNING_SECRET"],
    },
  );

const parsed = serverEnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET,
  FLEET_API_BASE_URL: process.env.FLEET_API_BASE_URL,
  FLEET_API_INTERNAL_KEY: process.env.FLEET_API_INTERNAL_KEY,
});

if (!parsed.success) {
  console.error("Invalid server environment configuration.", z.prettifyError(parsed.error));
  throw new Error("Invalid server environment variables.");
}

const data = parsed.data;

export const serverEnv = {
  ...data,
  // use fallback only for dev/test
  SESSION_SIGNING_SECRET: data.SESSION_SIGNING_SECRET ?? "dev_secret_fallback_32_chars_long_min",
} as const;

export type IServerEnv = typeof serverEnv;
