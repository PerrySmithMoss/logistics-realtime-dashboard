import { Request, Response } from "express";

export interface IVehicleController {
  list(req: Request, res: Response): Promise<Response | void> | Response | void;
  updateLocation(req: Request, res: Response): Promise<Response | void> | Response | void;
}
