import {
  AppState,
  ILifecycleManager,
} from "@shared/interfaces/lifecycle-manager.interface";

export class LifecycleManager implements ILifecycleManager {
  private _state: AppState = AppState.STARTING;
  private readonly shutdownTasks: (() => Promise<void>)[] = [];

  public get state(): AppState {
    return this._state;
  }
  public get isReady(): boolean {
    return this._state === AppState.READY;
  }
  public get isShuttingDown(): boolean {
    return this._state === AppState.SHUTTING_DOWN;
  }

  public setReady(): void {
    if (this._state !== AppState.STARTING) return;
    this._state = AppState.READY;
    console.log("[Lifecycle] 🟢 Application is fully operational.");
  }

  public prepareForShutdown(): void {
    this._state = AppState.SHUTTING_DOWN;
    console.log("[Lifecycle] ⚠️ Shutdown initiated. Draining resources...");
  }

  public onShutdown(task: () => Promise<void>): void {
    this.shutdownTasks.push(task);
  }

  public async closeAll(): Promise<void> {
    this._state = AppState.CLOSED;
    await Promise.all(
      this.shutdownTasks.map((task) => task().catch(console.error)),
    );
  }
}
