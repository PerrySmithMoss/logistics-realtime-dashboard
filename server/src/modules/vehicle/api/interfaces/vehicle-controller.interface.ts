import { Request, Response } from "express";

export interface IVehicleController {
  updateLocation(req: Request, res: Response): Promise<void | Response>;
}
