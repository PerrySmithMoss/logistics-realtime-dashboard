import { Request, Response } from "express";

export interface IFleetController {
  getSnapshot(req: Request, res: Response): void;
  stream(req: Request, res: Response): void;
}
