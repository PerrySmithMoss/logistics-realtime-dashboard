import { Application } from "@app/application";

const app = new Application();

app.start().catch((err) => {
  console.error("💥 FAILED TO START SERVER:", err);
  process.exit(1);
});

const handleShutdown = (signal: string) => app.shutdown(signal);

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  app.shutdown("REJECTION");
});

process.on("uncaughtException", (error) => {
  console.error("CRITICAL: Uncaught Exception!", error);
  process.exit(1);
});
