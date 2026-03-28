import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IStatusChangeEvent } from "@shared/interfaces/vehicle-status-change-event.interface";
import { VehicleEvents } from "../../events/vehicle.events";
import { IVehicleReadRepository } from "../../interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "../../interfaces/vehicle-write-repository.interface";

export class UpdateVehicleLocationCommand {
  static readonly type = "vehicle:update-location" as const;

  constructor(
    public readonly vehicleId: string,
    public readonly lat: number,
    public readonly lng: number,
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

  async handle(command: UpdateVehicleLocationCommand): Promise<void> {
    const vehicle = await this.repository.findById(command.vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${command.vehicleId} not found`);

    vehicle.updatePosition(command.lat, command.lng);

    await this.repository.save(vehicle);

    const snapshot = vehicle.toSnapshot();

    const event: IStatusChangeEvent = {
      vehicleId: snapshot.id,
      plateNumber: snapshot.plateNumber,
      status: snapshot.status as any,
      lat: snapshot.lat,
      lng: snapshot.lng,
      timestamp: snapshot.lastUpdated,
    };

    this.eventBroker.publish(VehicleEvents.LOCATION_UPDATED, event);
  }
}
