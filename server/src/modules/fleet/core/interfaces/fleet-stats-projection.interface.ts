import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";

export interface IFleetStatsProjection {
  handleUpdate(event: IVehicleStatusChangeEvent): void;
  getCurrentSnapshot(): IFleetSnapshot;
  reset(): void;
}
