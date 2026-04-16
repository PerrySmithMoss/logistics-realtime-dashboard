import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { IFleetSnapshot } from "../dtos/fleet-snapshot.dto";

export interface IFleetDataService {
  readonly isHydrated: boolean;
  hydrate(): Promise<void>;
  reset(): Promise<void>;
  processVehicleMovement(event: IVehicleStatusChangeEvent): Promise<void>;
  getCurrentSnapshot(): Promise<IFleetSnapshot>;
}
