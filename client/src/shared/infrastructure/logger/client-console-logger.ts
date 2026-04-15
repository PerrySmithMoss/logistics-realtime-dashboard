import { ILogger } from "./logger.interface";
import { CONSOLE_LOGGER_MAP, LOG_LEVEL_PRIORITY } from "./logger.constants";
import { ILoggerOptions, LogLevel } from "./logger.types";

export class ClientConsoleLogger implements ILogger {
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
    return new ClientConsoleLogger(
      this.options,
      `${this.context}:${newContext}`,
    );
  }

  private log(level: LogLevel, msg: string, data?: unknown) {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevelPriority) return;

    if (!this.isDev && (level === "DEBUG" || level === "INFO")) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    const processedData =
      data instanceof Error
        ? { ...data, name: data.name, message: data.message, stack: data.stack }
        : data;

    const consoleMethod = CONSOLE_LOGGER_MAP[level];

    if (processedData !== undefined) {
      consoleMethod(prefix, msg, processedData);
    } else {
      consoleMethod(prefix, msg);
    }
  }

  public info(message: string, data?: unknown) {
    this.log("INFO", message, data);
  }
  public warn(message: string, data?: unknown) {
    this.log("WARN", message, data);
  }
  public debug(message: string, data?: unknown) {
    this.log("DEBUG", message, data);
  }
  public error(message: string, data?: unknown) {
    this.log("ERROR", message, data);
  }
  public critical(message: string, data?: unknown) {
    this.log("CRITICAL", message, data);
  }
}
