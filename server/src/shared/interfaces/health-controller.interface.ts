import { Request, Response } from "express";

export interface IHealthController {
  check(req: Request, res: Response): Promise<void | Response>;
}
