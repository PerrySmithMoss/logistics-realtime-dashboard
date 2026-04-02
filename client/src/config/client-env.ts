import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FLEET_API_BASE_URL: z
    .url({ error: "NEXT_PUBLIC_FLEET_API_BASE_URL must be a valid URL" })
    .default("http://localhost:5500"),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_FLEET_API_BASE_URL: process.env.NEXT_PUBLIC_FLEET_API_BASE_URL,
});

if (!parsed.success) {
  console.error(
    "[env] Invalid environment configuration:\n",
    z.prettifyError(parsed.error),
  );
  throw new Error("[client-env] Missing or invalid environment variables.");
}

export const clientEnv = parsed.data;
