import { Application } from "@app/application";
import { consoleLogger } from "@shared/infrastructure/logger";
import { IGeoSnappingService } from "@shared/interfaces";

export const startApplication = async (
  app: Application,
  options: { geoSnappingService?: IGeoSnappingService } = {},
) => {
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await app.shutdown(signal);
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    consoleLogger.error("Unhandled Rejection detected", { reason });
    handleShutdown("UNHANDLED_REJECTION");
  });

  process.on("uncaughtException", (error) => {
    consoleLogger.error("CRITICAL: Uncaught Exception!", {
      message: error.message,
      stack: error.stack,
    });
    handleShutdown("UNCAUGHT_EXCEPTION");
  });

  return await app.start(options);
};
