import { ILogger } from "@shared/interfaces/logger.interface";
import { LOG_LEVEL_PRIORITY, LOGGER_COLORS } from "./logger.constants";
import { ILoggerOptions, LogLevelName } from "./logger.types";

export class ConsoleLogger implements ILogger {
  private readonly minLevelPriority: number;
  private readonly isDev: boolean;

  constructor(
    private readonly options: ILoggerOptions,
    private readonly context: string = "Global",
  ) {
    this.minLevelPriority = LOG_LEVEL_PRIORITY[options.level] ?? 0;
    this.isDev = options.isDev;
  }

  public withContext(newContext: string): ILogger {
    return new ConsoleLogger(this.options, `${this.context}:${newContext}`);
  }

  private write(level: LogLevelName, message: string, data?: unknown) {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevelPriority) return;

    if (!this.isDev && (level === "DEBUG" || level === "INFO")) return;

    const formatted = this.format(level, message, data);

    if (level === "ERROR" || level === "CRITICAL") {
      process.stderr.write(formatted + "\n");
    } else {
      process.stdout.write(formatted + "\n");
    }
  }

  private safeStringify(data: unknown): string {
    try {
      const prepared =
        data instanceof Error
          ? { name: data.name, message: data.message, stack: data.stack }
          : data;
      return this.isDev
        ? JSON.stringify(prepared, null, 2)
        : JSON.stringify(prepared);
    } catch {
      return "[Circular Data or Stringify Error]";
    }
  }

  private format(level: LogLevelName, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const ctx = this.context;

    if (!this.isDev) {
      const logEntry: Record<string, unknown> = {
        ts: timestamp,
        lvl: level,
        ctx: ctx,
        msg: message || "No message provided",
      };

      if (data !== undefined) {
        try {
          logEntry.data = JSON.parse(this.safeStringify(data));
        } catch {
          logEntry.data = "[Circular Data or Stringify Error]";
        }
      }
      return JSON.stringify(logEntry);
    }

    const color = this.getLevelColor(level);
    const header = `${LOGGER_COLORS.dim}${timestamp}${LOGGER_COLORS.reset} ${color}${LOGGER_COLORS.bright}${level.padEnd(5)}${LOGGER_COLORS.reset} ${LOGGER_COLORS.blue}[${ctx}]${LOGGER_COLORS.reset} ${message}`;

    return data !== undefined
      ? `${header}\n${LOGGER_COLORS.dim}${this.safeStringify(data)}${LOGGER_COLORS.reset}`
      : header;
  }

  private getLevelColor(level: LogLevelName): string {
    switch (level) {
      case "DEBUG":
        return LOGGER_COLORS.magenta;
      case "INFO":
        return LOGGER_COLORS.cyan;
      case "WARN":
        return LOGGER_COLORS.yellow;
      case "ERROR":
        return LOGGER_COLORS.red;
      case "CRITICAL":
        // white text on red background
        return LOGGER_COLORS.bgRed + LOGGER_COLORS.bright;
      default:
        return LOGGER_COLORS.reset;
    }
  }

  public debug(message: string, data?: unknown) {
    this.write("DEBUG", message, data);
  }

  public info(message: string, data?: unknown) {
    this.write("INFO", message, data);
  }

  public warn(message: string, data?: unknown) {
    this.write("WARN", message, data);
  }

  public error(message: string, data?: unknown) {
    this.write("ERROR", message, data);
  }

  public critical(message: string, data?: unknown) {
    this.write("CRITICAL", message, data);
  }
}
