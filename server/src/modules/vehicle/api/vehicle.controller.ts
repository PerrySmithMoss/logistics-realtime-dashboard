import { BaseController } from "@shared/api/base.controller";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { Request, Response } from "express";
import { VehicleCommandType } from "../core/commands/update-location/update-vehicle-location.command";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";

export class VehicleController
  extends BaseController
  implements IVehicleController
{
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus,
  ) {
    super();
  }

  public create = async (req: Request, res: Response) => {
    const { plateNumber } = req.body;
    // await this.commandBus.execute(...)
    this.created(res);
  };

  public getDetails = async (req: Request, res: Response) => {
    const { id } = req.params;
    // const result = await this.queryBus.ask(...)
    this.ok(res, { id });
  };

  public updateLocation = async (req: Request, res: Response) => {
    const { vehicleId, lat, lng } = req.body;

    await this.commandBus.execute(VehicleCommandType.UPDATE_LOCATION, {
      vehicleId,
      coordinates: { lat, lng },
    });

    this.accepted(res);
  };
}
