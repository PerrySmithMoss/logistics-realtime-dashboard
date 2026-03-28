import { config } from "@config/index";
import { ILogger } from "@shared/interfaces/logger.interface";
import { LogLevel } from "./logger.types";

export class ConsoleLogger implements ILogger {
  private readonly isDev = config.server.env !== "production";

  constructor(private readonly context: string = "Global") {}

  public withContext(newContext: string): ILogger {
    return new ConsoleLogger(newContext);
  }

  private format(level: LogLevel, message: string, data?: any) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context.toUpperCase(),
      message,
      ...(data && { data }),
    };

    return this.isDev
      ? JSON.stringify(logObject, null, 2)
      : JSON.stringify(logObject);
  }

  public info(message: string, data?: any) {
    console.log(this.format("INFO", message, data));
  }

  public warn(message: string, data?: any) {
    console.warn(this.format("WARN", message, data));
  }

  public error(message: string, data?: any) {
    const errorData =
      data instanceof Error
        ? { message: data.message, stack: data.stack, ...data }
        : data;
    console.error(this.format("ERROR", message, errorData));
  }

  public debug(message: string, data?: any) {
    if (this.isDev) {
      console.debug(this.format("DEBUG", message, data));
    }
  }
}
