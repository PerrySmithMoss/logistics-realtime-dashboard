import { ILogger } from "@shared/interfaces/logger.interface";
import { LOG_LEVEL_PRIORITY, LogLevelName } from "./logger.types";

export interface ILoggerOptions {
  level: LogLevelName;
  isDev: boolean;
}

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

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

  private write(level: LogLevelName, message: string, data?: any) {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevelPriority) return;

    const formatted = this.format(level, message, data);

    if (level === "ERROR") {
      process.stderr.write(formatted + "\n");
    } else {
      process.stdout.write(formatted + "\n");
    }
  }

  private safeStringify(data: any): string {
    try {
      return this.isDev ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    } catch {
      return "[Circular Data or Stringify Error]";
    }
  }

  private format(level: LogLevelName, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const ctx = this.context.toUpperCase();

    if (!this.isDev) {
      return JSON.stringify({
        ts: timestamp,
        lvl: level,
        ctx: ctx,
        msg: message || "No message provided",
        ...(data && { data }),
      });
    }

    const color = this.getLevelColor(level);
    const header = `${COLORS.dim}${timestamp}${COLORS.reset} ${color}${COLORS.bright}${level.padEnd(5)}${COLORS.reset} ${COLORS.blue}[${ctx}]${COLORS.reset} ${message}`;

    return data
      ? `${header}\n${COLORS.dim}${this.safeStringify(data)}${COLORS.reset}`
      : header;
  }

  private getLevelColor(level: LogLevelName): string {
    switch (level) {
      case "INFO":
        return COLORS.cyan;
      case "WARN":
        return COLORS.yellow;
      case "ERROR":
        return COLORS.red;
      case "DEBUG":
        return COLORS.magenta;
      default:
        return COLORS.reset;
    }
  }

  public info(message: string, data?: any) {
    this.write("INFO", message, data);
  }

  public warn(message: string, data?: any) {
    this.write("WARN", message, data);
  }

  public debug(message: string, data?: any) {
    this.write("DEBUG", message, data);
  }

  public error(message: string, data?: any) {
    let errorData = data;
    if (data instanceof Error) {
      errorData = {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }
    this.write("ERROR", message, errorData);
  }

  public critical(message: string, data?: any) {
    let errorData = data;
    if (data instanceof Error) {
      errorData = {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }
    this.write("CRITICAL", message, errorData);
  }
}
