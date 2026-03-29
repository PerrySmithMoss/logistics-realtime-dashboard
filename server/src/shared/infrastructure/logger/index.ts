import { config } from "@config/index";
import { ConsoleLogger } from "./console-logger";

export const consoleLogger = new ConsoleLogger({
  level: config.server.minLogLevel,
  isDev: config.server.isDev,
});

export * from "./console-logger";
export * from "./logger.types";
export * from "./no-op-logger";
