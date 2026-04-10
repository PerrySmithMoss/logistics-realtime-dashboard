import { NotFoundError } from "@shared/errors/app.errors";
import { ICommandBusOptions } from "@shared/interfaces/command-bus.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IVehicleStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { VehicleStatus } from "@shared/types/vehicle.types";
import { VehicleEvents } from "../../events/vehicle.events";
import {
  IVehicleReadRepository,
  IVehicleWriteRepository,
} from "../../interfaces";

export class UpdateVehicleLocationCommand {
  static readonly type = "vehicle:update-location" as const;

  constructor(
    public readonly vehicleId: string,
    public readonly lat: number,
    public readonly lng: number,
    public readonly status: VehicleStatus,
  ) {}
}

declare module "@shared/bus/command/command-registry" {
  interface GlobalCommandRegistry {
    [UpdateVehicleLocationCommand.type]: UpdateVehicleLocationCommand;
  }
}

export class UpdateVehicleLocationHandler {
  constructor(
    private readonly repository: IVehicleWriteRepository &
      IVehicleReadRepository,
    private readonly eventBroker: IEventBroker,
  ) {}

  async handle(
    command: UpdateVehicleLocationCommand,
    options?: ICommandBusOptions,
  ): Promise<void> {
    const vehicle = await this.repository.findById(command.vehicleId);

    if (!vehicle) {
      throw new NotFoundError(`Vehicle ${command.vehicleId}`);
    }

    if (options?.signal?.aborted) return;

    vehicle.updatePosition(command.lat, command.lng);
    vehicle.updateStatus(command.status);

    await this.repository.save(vehicle);

    const snapshot = vehicle.toSnapshot();

    const event: IVehicleStatusChangeEvent = {
      vehicleId: snapshot.id,
      plateNumber: snapshot.plateNumber,
      status: snapshot.status,
      lat: snapshot.lat,
      lng: snapshot.lng,
      timestamp: snapshot.lastUpdated,
    };

    this.eventBroker.publish(VehicleEvents.LOCATION_UPDATED, event);
  }
}
