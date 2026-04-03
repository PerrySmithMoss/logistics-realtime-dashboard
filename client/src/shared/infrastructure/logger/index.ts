import { ILogger } from "@/shared/interface";
import { ClientConsoleLogger } from "./client-console-logger";
import { LogLevel } from "./logger.types";
import { ServerConsoleLogger } from "./server-console-logger";

export const createLogger = (context: string): ILogger => {
  const isDev = process.env.NODE_ENV === "development";
  const minLogLevel: LogLevel = isDev ? "DEBUG" : "WARN";

  // server Components / API routes
  if (typeof window === "undefined") {
    return new ServerConsoleLogger({ isDev, level: minLogLevel }, context);
  }

  // browser
  return new ClientConsoleLogger({ isDev, level: minLogLevel }, context);
};
