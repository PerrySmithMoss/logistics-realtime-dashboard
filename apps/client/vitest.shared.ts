import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "vitest/config";

loadEnv({ path: path.resolve(__dirname, ".env.test") });

export const createVitestConfig = (include: string[]) =>
  defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup/vitest.setup.ts"],
      include,
      css: false,
      restoreMocks: true,
      clearMocks: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["src/**/*.{ts,tsx}"],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
          autoUpdate: false,
        },
      },
    },
  });
