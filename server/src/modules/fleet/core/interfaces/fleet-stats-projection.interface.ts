import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";

export interface IFleetStatsProjection {
  /**
   * Updates the internal state for a specific vehicle.
   */
  handleUpdate(event: IVehicleStatusChangeEvent): void;

  /**
   * Computes and returns the aggregate stats and vehicle list.
   */
  getCurrentSnapshot(): IFleetSnapshot;
}
