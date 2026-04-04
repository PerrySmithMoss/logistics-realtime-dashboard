import { Application } from "@app/application";
import { consoleLogger } from "@shared/infrastructure/logger";
import { config } from "./config";

const app = new Application(config);

app.start().catch((err) => {
  consoleLogger.error("FAILED TO START SERVER:", err);
  process.exit(1);
});

const handleShutdown = (signal: string) => app.shutdown(signal);

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

  // let app shutdown handle the exit after cleanup
  handleShutdown("UNCAUGHT_EXCEPTION");
});
