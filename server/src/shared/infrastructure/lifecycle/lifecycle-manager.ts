import {
  AppState,
  ILifecycleManager,
} from "@shared/interfaces/lifecycle-manager.interface";

export class LifecycleManager implements ILifecycleManager {
  private _state: AppState = AppState.STARTING;
  private readonly shutdownTasks: (() => Promise<void>)[] = [];
  private readonly abortController = new AbortController();

  public get state(): AppState {
    return this._state;
  }
  public get isReady(): boolean {
    return this._state === AppState.READY;
  }
  public get isShuttingDown(): boolean {
    return this._state === AppState.SHUTTING_DOWN;
  }

  public getShutdownSignal(): AbortSignal {
    return this.abortController.signal;
  }

  public setReady(): void {
    if (this._state !== AppState.STARTING) {
      throw new Error(`Cannot transition to READY from ${this._state}`);
    }
    this._state = AppState.READY;
  }

  public prepareForShutdown(): void {
    this._state = AppState.SHUTTING_DOWN;
  }

  public onShutdown(task: () => Promise<void>): void {
    this.shutdownTasks.push(task);
  }

  public async closeAll(): Promise<void> {
    this._state = AppState.CLOSED;

    this.abortController.abort();

    for (const task of this.shutdownTasks) {
      await task().catch(console.error);
    }
  }
}
