export interface ILogger {
  withContext(newContext: string): ILogger;
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  critical(message: string, data?: unknown): void;
}
