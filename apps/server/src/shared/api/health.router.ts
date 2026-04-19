import { IHealthController } from "@shared/interfaces";
import { Router } from "express";

export const createHealthRouter = (controller: IHealthController): Router => {
  const healthRouter = Router();

  healthRouter.get("/live", controller.live);
  healthRouter.get("/ready", controller.ready);

  return healthRouter;
};
