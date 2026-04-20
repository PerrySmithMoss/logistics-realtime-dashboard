import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  minify: true,
  noExternal: [
    "@fleet/common",
    // other internal packages here
  ],
  external: [
    "express",
    "helmet",
    //other native/platform-specific libs here
  ],
  sourcemap: true,
  outExtension() {
    return {
      js: `.js`,
    };
  },
});
