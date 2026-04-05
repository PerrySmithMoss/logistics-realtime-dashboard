import { IHealthController } from "@shared/interfaces";
import { Router } from "express";

export const createHealthRouter = (controller: IHealthController) => {
  const healthRouter = Router();

  healthRouter.get("/health/live", controller.live);
  healthRouter.get("/health/ready", controller.ready);

  return healthRouter;
};
