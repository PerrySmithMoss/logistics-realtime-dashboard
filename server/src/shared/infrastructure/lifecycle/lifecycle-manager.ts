import { InternalServerError } from "@shared/errors/app.errors";
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
      throw new InternalServerError(
        `Cannot transition to READY from ${this._state}`,
        false,
      );
    }
    this._state = AppState.READY;
  }

  public prepareForShutdown(): void {
    if (
      this._state === AppState.SHUTTING_DOWN ||
      this._state === AppState.CLOSED
    )
      return;

    this.logger.info(
      `Transitioning state: ${this._state} -> ${AppState.SHUTTING_DOWN}`,
    );
    this._state = AppState.SHUTTING_DOWN;

    this.abortController.abort();
  }

  public onShutdown(task: () => Promise<void>): void {
    this.shutdownTasks.push(task);
  }

  public async closeAll(): Promise<void> {
    if (this._state !== AppState.SHUTTING_DOWN) {
      this.prepareForShutdown();
    }

    this._state = AppState.CLOSED;
    this.abortController.abort();

    // run tasks in reverse order of registration,
    // as we usually register infra first and services last.
    const tasks = [...this.shutdownTasks].reverse();
    const TASK_TIMEOUT = 5000;

    this.logger.info(`Executing ${tasks.length} shutdown tasks...`);

    for (const task of tasks) {
      try {
        await Promise.race([
          task(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error(`Timeout: ${task.name || "anonymous task"}`)),
              TASK_TIMEOUT,
            ),
          ),
        ]);
      } catch (err) {
        this.logger.error("Shutdown task failed or timed out:", err);
      }
    }
  }
}
