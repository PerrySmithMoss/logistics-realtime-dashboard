import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@config": path.resolve(__dirname, "./src/config"),
    },
  },
  test: {
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.interface.ts",
        "src/**/*.types.ts",
        "src/**/__tests__/**",
        "src/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
