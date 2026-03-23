import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { VehicleEvents } from "../../events/vehicle.events";
import { IVehicleReadRepository } from "../../interfaces/vehicle-read-repository.interface";
import { IVehicleWriteRepository } from "../../interfaces/vehicle-write-repository.interface";
import { UpdateVehicleLocationCommand } from "./update-vehicle-location.command";

export class UpdateVehicleLocationHandler {
  constructor(
    private readonly repository: IVehicleWriteRepository &
      IVehicleReadRepository,
    private readonly eventBroker: IEventBroker,
  ) {}

  async handle(command: UpdateVehicleLocationCommand): Promise<void> {
    const vehicle = await this.repository.findById(command.vehicleId);
    if (!vehicle) throw new Error("Vehicle not found");

    vehicle.updatePosition(command.lat, command.lng);

    await this.repository.save(vehicle);

    this.eventBroker.publish(
      VehicleEvents.LOCATION_UPDATED,
      vehicle.toSnapshot(),
    );
  }
}
