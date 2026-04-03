import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_FLEET_API_BASE_URL: z
    .url({ error: "NEXT_PUBLIC_FLEET_API_BASE_URL must be a valid URL" })
    .default("http://localhost:5500"),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_NODE_ENV: process.env.NEXT_PUBLIC_NODE_ENV,
  NEXT_PUBLIC_FLEET_API_BASE_URL: process.env.NEXT_PUBLIC_FLEET_API_BASE_URL,
});

if (!parsed.success) {
  console.error(
    "Invalid client environment configuration",
    z.prettifyError(parsed.error),
  );
  throw new Error("Invalid client environment variables.");
}

export const clientEnv = { ...parsed.data } as const;

export type IClientEnv = typeof clientEnv;
