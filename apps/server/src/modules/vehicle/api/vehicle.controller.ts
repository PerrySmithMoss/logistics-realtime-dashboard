import { IAppConfig } from "@config/index";
import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { GetVehicleByIdQuery } from "@modules/vehicle/core/queries/get-vehicle-by-id.query";
import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { BaseController } from "@shared/api/base.controller";
import { getValidatedRequestData } from "@shared/api/middleware";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { Request, Response } from "express";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";
import { updateVehicleLocationSchema } from "./vehicle.schemas";

export class VehicleController extends BaseController implements IVehicleController {
  constructor(
    readonly config: IAppConfig,
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus,
  ) {
    super({
      apiVersion: config.app.version,
      environment: config.server.env,
      isDev: config.server.isDev,
    });
  }

  public list = async (req: Request, res: Response) => {
    const result = await this.queryBus.ask(ListAllVehiclesQuery.type, new ListAllVehiclesQuery());

    return this.ok(req, res, result.data);
  };

  public updateLocation = async (req: Request, res: Response) => {
    const { body, params } = getValidatedRequestData<typeof updateVehicleLocationSchema>(req);
    const { vehicleId } = params;
    const { lat, lng, status } = body;

    await this.commandBus.execute(
      UpdateVehicleLocationCommand.type,
      new UpdateVehicleLocationCommand(vehicleId, lat, lng, status),
    );

    const result = await this.queryBus.ask(
      GetVehicleByIdQuery.type,
      new GetVehicleByIdQuery(vehicleId),
    );

    return this.ok(req, res, result.data);
  };
}
