import { BaseController } from "@shared/api/base.controller";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { Request, Response } from "express";
import { UpdateVehicleLocationCommand } from "../core/commands/update-location/update-vehicle-location";
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

  public updateLocation = async (req: Request, res: Response) => {
    const { vehicleId, lat, lng, status } = req.body;

    await this.commandBus.execute(UpdateVehicleLocationCommand.type, {
      vehicleId,
      lat,
      lng,
      status,
    });

    this.accepted(res);
  };
}
