import { Request, Response } from "express";

export interface IVehicleController {
  list(req: Request, res: Response): Promise<Response>;
  updateLocation(req: Request, res: Response): Promise<Response>;
}
