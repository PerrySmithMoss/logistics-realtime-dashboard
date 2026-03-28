import { Router } from "express";
import { IVehicleController } from "./interfaces/vehicle-controller.interface";

export const createVehicleRoutes = (controller: IVehicleController) => {
  const vehicleRouter = Router();

  // get all vehicle records
  // vehicleRouter.get(
  //   "/",
  //   //     validator(validateGetVehiclesRequest),
  //   controller.getAll,
  // );

  // get a vehicle record
  vehicleRouter.get("/:id", (req, res) => controller.getDetails(req, res));

  // coordinate ingress
  vehicleRouter.patch(
    "/:id/location",
    //     validator(validateUpdateLocationRequest),
    controller.updateLocation,
  );

  // SSE for the real-time updates on vehicles
  // vehicleRouter.get(
  //   "/stats/stream",
  //   //     validator(validateStatsStreamRequest),
  //   controller.streamStats,
  // );

  return vehicleRouter;
};
