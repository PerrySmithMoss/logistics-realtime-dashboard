export default {
  "src/**/*.ts": [
    "prettier --write",
    "eslint --fix",
    () => "npm run type-check:test",
    () => "npm run type-check",
    "vitest related --run",
  ],
};
