import { IGeoSnappingService } from "@shared/interfaces";
import { Mocked } from "vitest";

export const createMockSnappingService = (): Mocked<IGeoSnappingService> => ({
  snapBatch: vi.fn().mockResolvedValue([]),
});
