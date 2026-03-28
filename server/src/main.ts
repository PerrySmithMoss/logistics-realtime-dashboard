import { config } from "@config/index";
import { createApp } from "./app/app.js";
import { AppContainer } from "./app/container.js";
import { HttpServer } from "./app/server.js";

export const bootstrap = async () => {
  const container = await AppContainer.create(config);
  const app = createApp(container.controllers, container.lifecycle);
  const server = new HttpServer(app);

  await server.start(config.server);

  return { server, container };
};
