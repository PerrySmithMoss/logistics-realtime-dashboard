import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

const tsFiles = ["**/*.{ts,tsx,mts,cts}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  prettierConfig,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
