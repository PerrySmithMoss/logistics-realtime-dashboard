import { AppState, ILifecycleManager } from "@shared/interfaces";
import { Mocked } from "vitest";

export type MockLifecycleManager = Mocked<ILifecycleManager> & {
  triggerShutdown: () => Promise<void>;
};

export const createMockLifecycleManager = (
  initialState = AppState.STARTING,
): MockLifecycleManager => {
  let currentState = initialState;
  let shutdownTask: (() => Promise<void>) | null = null;
  const abortController = new AbortController();

  const mock = {
    getShutdownSignal: vi.fn().mockReturnValue(abortController.signal),
    setReady: vi.fn().mockImplementation(() => {
      currentState = AppState.READY;
    }),
    prepareForShutdown: vi.fn().mockImplementation(() => {
      currentState = AppState.SHUTTING_DOWN;
      abortController.abort();
    }),
    onShutdown: vi.fn().mockImplementation((task) => {
      shutdownTask = task;
    }),
    closeAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as MockLifecycleManager;

  Object.defineProperties(mock, {
    state: { get: () => currentState, enumerable: true },
    isReady: { get: () => currentState === AppState.READY, enumerable: true },
    isShuttingDown: {
      get: () => currentState === AppState.SHUTTING_DOWN,
      enumerable: true,
    },
  });

  mock.triggerShutdown = async () => {
    if (shutdownTask) await shutdownTask();
  };

  return mock;
};
