import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  minify: true,
  sourcemap: true,
  outExtensions() {
    return {
      js: `.js`,
    };
  },
  deps: {
    neverBundle: ["express", "helmet"],
    alwaysBundle: [/^@fleet\/common(?:\/.*)?$/],
  },
  dts: false,
});
