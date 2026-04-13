import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { Mocked } from "vitest";

export const createMockEventBroker = (
  overrides: Partial<Mocked<IEventBroker>> = {},
): Mocked<IEventBroker> => {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    ...overrides,
  } as Mocked<IEventBroker>;
};
