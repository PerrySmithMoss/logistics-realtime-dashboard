import { ILogger } from "@shared/interfaces/logger.interface";
import { vi } from "vitest";

export const createMockLogger = (): ILogger => {
  return {
    withContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  };
};
