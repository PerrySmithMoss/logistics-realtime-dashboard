import {
  AppState,
  ILifecycleManager,
} from "@shared/interfaces/lifecycle-manager.interface";
import { vi, type Mocked } from "vitest";

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
    state: currentState,
    isReady: initialState === AppState.READY,
    isShuttingDown: initialState === AppState.SHUTTING_DOWN,

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
  } as Mocked<ILifecycleManager>;

  Object.defineProperties(mock, {
    state: { get: () => currentState, enumerable: true },
    isReady: { get: () => currentState === AppState.READY, enumerable: true },
    isShuttingDown: {
      get: () => currentState === AppState.SHUTTING_DOWN,
      // allow us to see the state props if they're ever console logged
      enumerable: true,
    },
  });

  return {
    ...mock,
    triggerShutdown: async () => {
      if (shutdownTask) await shutdownTask();
    },
  };
};
