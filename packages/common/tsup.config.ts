import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "errors/index": "src/errors/index.ts",
    "types/index": "src/types/index.ts",
    "utils/index": "src/utils/index.ts",
  },
  format: ["esm"],
  target: "node24",
  dts: true,
  clean: true,
  splitting: true,
  outDir: "dist",
});
