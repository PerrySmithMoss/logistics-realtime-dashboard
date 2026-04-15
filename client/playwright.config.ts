import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env.test") });

const testEnv = {
  ...process.env,
  FLEET_API_BASE_URL: process.env.FLEET_API_BASE_URL ?? "http://127.0.0.1:5500",
  NEXT_PUBLIC_FLEET_API_BASE_URL:
    process.env.NEXT_PUBLIC_FLEET_API_BASE_URL ?? "http://127.0.0.1:5500",
  FLEET_API_INTERNAL_KEY: process.env.FLEET_API_INTERNAL_KEY ?? "test_internal_key",
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
    baseURL: "http://127.0.0.1:3001",
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
      command: "node tests/e2e/mock-fleet-backend.mjs",
      port: 5500,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: testEnv,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: testEnv,
    },
  ],
});

// v2
// import { defineConfig, devices } from '@playwright/test';
// import path from 'path';

// /**
//  * See https://playwright.dev/docs/test-configuration.
//  */
// export default defineConfig({
//   testDir: './tests/e2e',
//   /* Maximum time one test can run for. */
//   timeout: 60 * 1000,
//   expect: {
//     timeout: 10000, // Real-time UI updates might take a second to reflect
//   },
//   /* Run tests in files in parallel */
//   fullyParallel: true,
//   /* Fail the build on CI if you accidentally left test.only in the source code. */
//   forbidOnly: !!process.env.CI,
//   /* Retry on CI only */
//   retries: process.env.CI ? 2 : 0,
//   /* Opt out of parallel tests on CI. */
//   workers: process.env.CI ? 1 : undefined,
//   /* Reporter to use. See https://playwright.dev/docs/test-reporters */
//   reporter: [['html', { open: 'never' }], ['list']],

//   use: {
//     /* Base URL to use in actions like `await page.goto('/')`. */
//     baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
//     /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
//     trace: 'on-first-retry',
//     video: 'on-first-retry',
//     screenshot: 'only-on-failure',
//   },

//   /* Configure projects for major browsers */
//   projects: [
//     {
//       name: 'chromium',
//       use: { ...devices['Desktop Chrome'] },
//     },
//     {
//       name: 'firefox',
//       use: { ...devices['Desktop Firefox'] },
//     },
//     {
//       name: 'webkit',
//       use: { ...devices['Desktop Safari'] },
//     },
//   ],

//   /* 🚀 THE WORLD-CLASS TOUCH: Automatic System Bootstrapping */
//   webServer: [
//     {
//       command: 'npm run start:backend:test', // Ensure your backend has a test mode script
//       url: 'http://localhost:4000/health/ready',
//       reuseExistingServer: !process.env.CI,
//       stdout: 'pipe',
//       stderr: 'pipe',
//     },
//     {
//       command: 'npm run dev:frontend',
//       url: 'http://localhost:3000',
//       reuseExistingServer: !process.env.CI,
//       stdout: 'pipe',
//       stderr: 'pipe',
//     }
//   ],
// });
