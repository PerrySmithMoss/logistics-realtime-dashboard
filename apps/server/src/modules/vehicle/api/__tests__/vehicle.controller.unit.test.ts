import { GetVehicleByIdQuery } from "@modules/vehicle/core/queries/get-vehicle-by-id.query";
import { ListAllVehiclesQuery } from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { InternalServerError } from "@shared/errors/app.errors";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { createMockConfig } from "@shared/testing/test-utils/config.utils";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { createVehicleSnapshot } from "@shared/testing/test-utils/vehicle.utils";
import { VehicleStatus } from "@shared/types/vehicle.types";
import { Mocked, vi } from "vitest";
import { VehicleController } from "../vehicle.controller";

const createMockCommandBus = (): Mocked<ICommandBus> => ({
  execute: vi.fn().mockResolvedValue(undefined),
  register: vi.fn(),
});

const createMockQueryBus = (): Mocked<IQueryBus> => ({
  ask: vi.fn().mockResolvedValue({
    data: [],
    count: 0,
    timestamp: new Date().toISOString(),
  }),
  register: vi.fn(),
});

describe("VehicleController", () => {
  const setup = () => {
    const commandBus = createMockCommandBus();
    const queryBus = createMockQueryBus();
    const controller = new VehicleController(createMockConfig(), commandBus, queryBus);

    return {
      commandBus,
      queryBus,
      controller,
      req: createMockRequest(),
      res: createMockResponse(),
    };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the list of vehicles using the standard success envelope", async () => {
    const { controller, queryBus, req, res } = setup();
    const vehicles = [createVehicleSnapshot({ id: "V-101" })];

    queryBus.ask.mockResolvedValueOnce({
      data: vehicles,
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await controller.list(req, res);

    expect(queryBus.ask).toHaveBeenCalledWith(
      ListAllVehiclesQuery.type,
      expect.any(ListAllVehiclesQuery),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: vehicles,
      }),
    );
  });

  it("updates a vehicle using middleware-validated params and body data", async () => {
    const { controller, commandBus, queryBus, res } = setup();
    const req = createMockRequest({
      validated: {
        params: { vehicleId: "V-101" },
        body: {
          lat: 51.61,
          lng: -0.2,
          status: VehicleStatus.Delayed,
        },
      },
    });

    const updatedVehicle = createVehicleSnapshot({
      id: "V-101",
      lat: 51.61,
      lng: -0.2,
      status: VehicleStatus.Delayed,
    });

    queryBus.ask.mockResolvedValueOnce({
      data: updatedVehicle,
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await controller.updateLocation(req, res);

    expect(commandBus.execute).toHaveBeenCalledWith(
      "vehicle:update-location",
      expect.objectContaining({
        vehicleId: "V-101",
        lat: 51.61,
        lng: -0.2,
        status: VehicleStatus.Delayed,
      }),
    );
    expect(queryBus.ask).toHaveBeenCalledWith(
      GetVehicleByIdQuery.type,
      new GetVehicleByIdQuery("V-101"),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("throws when validated data is missing from the request", async () => {
    const { controller, req, res } = setup();

    await expect(controller.updateLocation(req, res)).rejects.toThrow(InternalServerError);
  });

  it("uses the validated request helper rather than reading raw req.body or req.params", async () => {
    const { controller, res, commandBus, queryBus } = setup();
    const req = createMockRequest({
      params: { vehicleId: "raw-param-should-not-be-used" },
      body: {
        lat: 0,
        lng: 0,
        status: VehicleStatus.Active,
      },
      validated: {
        params: { vehicleId: "V-202" },
        body: {
          lat: 52.1,
          lng: -0.44,
          status: VehicleStatus.Active,
        },
      },
    });

    queryBus.ask.mockResolvedValueOnce({
      data: createVehicleSnapshot({ id: "V-202" }),
      count: 1,
      timestamp: new Date().toISOString(),
    });

    await controller.updateLocation(req, res);

    expect(commandBus.execute).toHaveBeenCalledWith(
      "vehicle:update-location",
      expect.objectContaining({
        vehicleId: "V-202",
        lat: 52.1,
        lng: -0.44,
      }),
    );
  });
});
