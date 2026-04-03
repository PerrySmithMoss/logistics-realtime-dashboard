export type LogLevelName = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface ILoggerOptions {
  level: LogLevelName;
  isDev: boolean;
}
