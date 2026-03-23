export enum AppState {
  STARTING = "STARTING",
  READY = "READY",
  SHUTTING_DOWN = "SHUTTING_DOWN",
  CLOSED = "CLOSED",
}

export interface ILifecycleManager {
  readonly state: AppState;
  readonly isReady: boolean;
  readonly isShuttingDown: boolean;

  setReady(): void;
  prepareForShutdown(): void;

  onShutdown(task: () => Promise<void>): void;
  closeAll(): Promise<void>;
}
