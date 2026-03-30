export type LogLevelName = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export const LOG_LEVEL_PRIORITY: Record<LogLevelName, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};
