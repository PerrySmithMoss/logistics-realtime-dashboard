export default {
  "src/**/*.ts": [
    "prettier --write",
    "eslint --fix",
    () => "npm run type-check",
    () => "npm run type-check:test",
    "vitest related --run",
  ],
};
