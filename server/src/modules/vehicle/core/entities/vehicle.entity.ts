import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";

export interface VehicleProps {
  id: string;
  plateNumber: string;
  lat: number;
  lng: number;
  status: "active" | "inactive" | "delayed" | "maintenance";
  lastUpdated: Date;
}

export class Vehicle {
  private constructor(private props: VehicleProps) {}

  /**
   * FACTORY METHOD: Entities should usually be created through a static method.
   * This allows for validation before the object even exists.
   */
  public static create(props: Omit<VehicleProps, "lastUpdated">): Vehicle {
    if (!props.plateNumber || props.plateNumber.length < 5) {
      throw new Error("Invalid Plate Number");
    }

    return new Vehicle({
      ...props,
      lastUpdated: new Date(),
    });
  }

  public updatePosition(lat: number, lng: number): void {
    if (lat < -90 || lat > 90) throw new Error("Invalid Latitude");
    if (lng < -180 || lng > 180) throw new Error("Invalid Longitude");

    if (this.props.status === "maintenance") {
      throw new Error("Cannot update location: Vehicle is in maintenance.");
    }

    this.props.lat = lat;
    this.props.lng = lng;
    this.props.lastUpdated = new Date();
  }

  public get id(): string {
    return this.props.id;
  }

  public get status(): string {
    return this.props.status;
  }

  public toSnapshot(): Readonly<VehicleSnapshot> {
    return Object.freeze({
      ...this.props,
      lastUpdated: this.props.lastUpdated.toISOString(),
    });
  }
}
