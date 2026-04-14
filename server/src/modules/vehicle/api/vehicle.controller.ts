import { IAppConfig } from "@config/index";
import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { GetVehicleByIdQuery } from "@modules/vehicle/core/queries/get-vehicle-by-id.query";
import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { BaseController } from "@shared/api/base.controller";
import { BadRequestError } from "@shared/errors/app.errors";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { VehicleStatus } from "@shared/types/vehicle.types";
import { Request, Response } from "express";
import { z } from "zod";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";

const updateLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  status: z.nativeEnum(VehicleStatus),
});

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
    const parsed = updateLocationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new BadRequestError("Invalid vehicle location payload");
    }

    const vehicleIdParam = req.params.vehicleId;
    const vehicleId = Array.isArray(vehicleIdParam) ? vehicleIdParam[0] : vehicleIdParam;

    if (!vehicleId) {
      throw new BadRequestError("vehicleId is required");
    }

    const { lat, lng, status } = parsed.data;

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
