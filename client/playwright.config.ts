import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env.test") });

const testEnv = {
  ...process.env,
  FLEET_API_BASE_URL: process.env.FLEET_API_BASE_URL ?? "http://127.0.0.1:4000",
  NEXT_PUBLIC_FLEET_API_BASE_URL:
    process.env.NEXT_PUBLIC_FLEET_API_BASE_URL ?? "http://127.0.0.1:4000",
  FLEET_API_INTERNAL_KEY: process.env.FLEET_API_INTERNAL_KEY ?? "test-internal-key",
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
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run start:backend:test",
      url: "http://127.0.0.1:4000/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: testEnv,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: testEnv,
    },
  ],
});
