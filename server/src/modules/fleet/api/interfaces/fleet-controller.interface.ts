import { Request, Response } from "express";

export interface IFleetController {
  getSnapshot(req: Request, res: Response): Promise<Response | void> | Response | void;
  stream(req: Request, res: Response): Promise<Response | void> | Response | void;
}
