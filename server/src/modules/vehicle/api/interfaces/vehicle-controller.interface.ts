import { Request, Response } from "express";

export interface IVehicleController {
  create(req: Request, res: Response): Promise<void | Response>;
  getDetails(req: Request, res: Response): Promise<void | Response>;
  updateLocation(req: Request, res: Response): Promise<void | Response>;
}
