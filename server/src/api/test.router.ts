import { Router } from "express";

export const createTestRouter = (handlers: { reset: () => Promise<void> }) => {
  const testRouter = Router();

  testRouter.post("/reset", async (_req, res, next) => {
    try {
      await handlers.reset();
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return testRouter;
};
