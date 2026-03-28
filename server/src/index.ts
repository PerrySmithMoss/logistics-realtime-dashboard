import { config } from "@config/index";
import { bootstrap } from "./main.js";

async function start() {
  try {
    const { server, container } = await bootstrap();
    const { port, env, host, isDev } = config.server;
    const protocol = isDev ? "http" : "https";

    console.log(`
      System Online | PID: ${process.pid}
      URL:      ${protocol}://${host || "localhost"}:${port}
      Env:      ${env.toUpperCase()}
      Status:   Ready
    `);

    const handleShutdown = async (signal: string) => {
      console.log(`\n[${signal}] Initiating graceful shutdown...`);

      container.lifecycle.prepareForShutdown();

      if (!isDev) {
        console.log("Waiting 3s to redirect traffic...");
        await new Promise((r) => setTimeout(r, 3000));
      }

      const forceExit = setTimeout(
        () => {
          console.error("Cleanup timed out. Forcing exit.");
          process.exit(1);
        },
        isDev ? 3000 : 10000,
      );

      try {
        await server.stop();
        await container.lifecycle.closeAll();
        clearTimeout(forceExit);

        console.log("Shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  } catch (error) {
    console.error("💥 FAILED TO START SERVER:", error);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("CRITICAL: Uncaught Exception!", error);
  process.exit(1);
});

start();
