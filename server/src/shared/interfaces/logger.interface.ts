export interface ILogger {
  withContext(newContext: string): ILogger;
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  critical(message: string, data?: any): void;
}
