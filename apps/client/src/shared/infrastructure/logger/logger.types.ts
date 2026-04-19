export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface ILoggerOptions {
  level: LogLevel;
  isDev: boolean;
}
