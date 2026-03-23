export class UpdateVehicleLocationCommand {
  static readonly type = "VEHICLE.UPDATE_LOCATION" as const;
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
