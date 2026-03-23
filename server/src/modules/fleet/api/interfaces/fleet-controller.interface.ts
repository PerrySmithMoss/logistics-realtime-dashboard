import { Request, Response } from "express";

export interface IFleetController {
  stream(req: Request, res: Response): void;
}
