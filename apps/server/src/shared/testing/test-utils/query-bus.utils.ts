import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { Mocked } from "vitest";

export const createMockQueryBus = (): Mocked<IQueryBus> => ({
  ask: vi.fn().mockResolvedValue({
    data: [],
    count: 0,
    timestamp: new Date().toISOString(),
  }),
  register: vi.fn(),
});
