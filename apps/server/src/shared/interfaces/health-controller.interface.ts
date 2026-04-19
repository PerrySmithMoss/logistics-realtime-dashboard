import { Request, Response } from "express";

export interface IHealthController {
  live(req: Request, res: Response): Promise<Response | void> | Response | void;
  ready(req: Request, res: Response): Promise<Response | void> | Response | void;
}
