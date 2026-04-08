import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";

export interface IFleetDataService {
  hydrate(): Promise<void>;
  readonly isHydrated: boolean;
  processVehicleMovement(event: IVehicleStatusChangeEvent): Promise<void>;
  getCurrentSnapshot(): Promise<IFleetSnapshot>;
}
