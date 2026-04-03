import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_FLEET_API_BASE_URL: z
    .url({ error: "NEXT_PUBLIC_FLEET_API_BASE_URL must be a valid URL" })
    .default("http://localhost:5500"),
});

const _env = clientEnvSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "Invalid client environment configuration:\n",
    z.prettifyError(_env.error),
  );
  throw new Error("Invalid client environment variables.");
}

const env = _env.data;

export type IClientEnv = typeof env;

export const clientEnv: IClientEnv = {
  NEXT_PUBLIC_NODE_ENV: env.NEXT_PUBLIC_NODE_ENV,
  NEXT_PUBLIC_FLEET_API_BASE_URL: env.NEXT_PUBLIC_FLEET_API_BASE_URL,
} as const;
