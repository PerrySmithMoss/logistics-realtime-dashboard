import { LogLevelName } from "./logger.types";

export const LOG_LEVEL_PRIORITY: Record<LogLevelName, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

export const LOGGER_COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bgRed: "\x1b[41m",
};
