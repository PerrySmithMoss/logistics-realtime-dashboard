import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, ".env.test");

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath, quiet: true });
}

const clientPort = process.env.PLAYWRIGHT_CLIENT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${clientPort}`;
const internalKey = process.env.FLEET_API_INTERNAL_KEY ?? "test-internal-key";

const testEnv = {
  ...process.env,
  FLEET_API_BASE_URL: process.env.FLEET_API_BASE_URL ?? "http://127.0.0.1:4000",
  NEXT_PUBLIC_FLEET_API_BASE_URL:
    process.env.NEXT_PUBLIC_FLEET_API_BASE_URL ?? "http://127.0.0.1:4000",
  FLEET_API_INTERNAL_KEY: internalKey,
  INTERNAL_AUTH_SECRET: internalKey,
  FLEET_STREAM_SIGNING_SECRET:
    process.env.FLEET_STREAM_SIGNING_SECRET ?? "test_stream_signing_secret_32_chars",
  SESSION_SIGNING_SECRET:
    process.env.SESSION_SIGNING_SECRET ?? "test_session_signing_secret_32_chars",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.test.ts",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
      },
    },
  ],
  webServer: [
    {
      command: "pnpm run start:backend:test",
      url: "http://127.0.0.1:4000/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...testEnv, CORS_ALLOWED_ORIGINS: baseURL },
    },
    {
      command: "pnpm run dev --hostname 127.0.0.1",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...testEnv,
        PORT: clientPort,
      },
    },
  ],
});
