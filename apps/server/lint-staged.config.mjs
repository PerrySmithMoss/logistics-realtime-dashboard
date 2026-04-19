export default {
  "src/**/*.ts": [
    "prettier --write",
    "eslint --fix",
    () => "pnpm run type-check",
    () => "pnpm run type-check:test",
    "vitest related --run",
  ],
};
