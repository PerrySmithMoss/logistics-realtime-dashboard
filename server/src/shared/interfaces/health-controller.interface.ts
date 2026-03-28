import { Request, Response } from "express";

export interface IHealthController {
  live(req: Request, res: Response): void | Response;
  ready(req: Request, res: Response): Promise<void | Response>;
}
