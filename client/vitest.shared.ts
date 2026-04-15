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
        reporter: ["text", "html"],
        include: [
          "src/modules/fleet/components/**/*.{ts,tsx}",
          "src/modules/fleet/lib/**/*.ts",
          "src/shared/utils/**/*.ts",
          "src/shared/infrastructure/sse-client/**/*.ts",
        ],
      },
    },
  });
