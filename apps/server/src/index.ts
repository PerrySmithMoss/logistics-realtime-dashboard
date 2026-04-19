import { Application } from "@app/application";
import { config } from "@config/index";
import { startApplication } from "@shared/app";
import { consoleLogger } from "@shared/infrastructure/logger";

const app = new Application(config);

startApplication(app).catch((err) => {
  consoleLogger.error("FAILED TO START TEST SERVER:", err);
  process.exit(1);
});
