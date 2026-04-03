import { createLogger } from "./shared/infrastructure";

const logger = createLogger("Instrumentation");

export async function register() {
  logger.info("Validating config...");

  await import("@/config/server-env");
  await import("@/config/client-env");

  logger.info("Config validated.");
}
