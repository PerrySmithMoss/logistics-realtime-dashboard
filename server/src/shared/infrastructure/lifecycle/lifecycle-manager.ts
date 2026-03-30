import {
  AppState,
  ILifecycleManager,
} from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

export class LifecycleManager implements ILifecycleManager {
  private _state: AppState = AppState.STARTING;
  private readonly shutdownTasks: (() => Promise<void>)[] = [];
  private readonly abortController = new AbortController();

  constructor(private readonly logger: ILogger) {}

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

    // run tasks in reverse order of registration,
    // as we usually register infra first and services last.
    const reversedTasks = [...this.shutdownTasks].reverse();

    for (const task of reversedTasks) {
      try {
        await task();
      } catch (err) {
        this.logger.error("shutdown task failed:", err);
      }
    }
  }
}
