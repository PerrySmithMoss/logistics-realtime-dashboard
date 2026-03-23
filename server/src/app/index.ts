import { config } from "@config/index";
import { createApp } from "./app";
import { AppContainer } from "./container";
import { HttpServer } from "./server";

const bootstrap = async () => {
  try {
    const container = new AppContainer(config);

    const app = createApp(container.controllers);

    const server = new HttpServer(app);

    const { port, env, host, isDev } = config.server;

    if (server.isRunning) {
      const protocol = isDev ? "http" : "https";
      const systemHost = host || "localhost";

      console.log(`
        🚀 System Online | PID: ${process.pid}
        URL:      ${protocol}://${systemHost}:${port}
        Env:      ${env.toUpperCase()}
        Status:   Ready
      `);
    }

    const handleShutdown = async (signal: string) => {
      container.lifecycle.prepareForShutdown();

      console.log(`\n[${signal}] Initiating graceful shutdown...`);

      // DRAIN PERIOD (3 seconds)
      // Allows Load Balancers to detect 503s from /health and stop traffic
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Ensure we exit even if cleanup hangs
      const forceExit = setTimeout(() => {
        console.error("Cleanup hung. Forcing exit.");
        process.exit(1);
      }, 10000);

      try {
        await server.stop();
        await container.lifecycle.closeAll(); // Close DBs, Brokers, etc.

        clearTimeout(forceExit);
        console.log("Cleanup complete.");
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Rejection:", reason);
      handleShutdown("UNHANDLED_REJECTION");
    });

    process.on("uncaughtException", (error) => {
      console.error("CRITICAL: Uncaught Exception! Process state corrupted.");
      console.error(error.stack);
      // Fail fast on uncaught exceptions
      setTimeout(() => process.exit(1), 500);
    });
  } catch (error) {
    console.error("💥 STARTUP FAILURE:", error);
    process.exit(1);
  }
};

bootstrap();
