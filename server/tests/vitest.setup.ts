import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection at:", reason);
  process.exit(1);
});
