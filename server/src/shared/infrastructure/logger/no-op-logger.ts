import { ILogger } from "@shared/interfaces/logger.interface";

// useful for mocking the logger in tests, to prevent noisy logs in tests
export class NoOpLogger implements ILogger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
  withContext(): ILogger {
    return this;
  }
}
