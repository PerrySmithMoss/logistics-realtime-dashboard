import {
  BadRequestError,
  UnprocessableEntityError,
} from "@shared/errors/app.errors";
import { VehicleProps, VehicleStatus } from "@shared/types/vehicle.types";
import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";

export class Vehicle {
  private constructor(private props: VehicleProps) {}

  public get id(): string {
    return this.props.id;
  }

  public get status(): string {
    return this.props.status;
  }

  public static create(props: Omit<VehicleProps, "lastUpdated">): Vehicle {
    if (!props.plateNumber || props.plateNumber.length < 5) {
      throw new BadRequestError("Plate number must be at least 5 characters.");
    }
    return new Vehicle({ ...props, lastUpdated: new Date() });
  }

  public static hydrate(props: VehicleProps): Vehicle {
    return new Vehicle(props);
  }

  public getProps(): VehicleProps {
    return { ...this.props };
  }

  public updatePosition(lat: number, lng: number): void {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestError("Coordinates must be finite numbers.");
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestError("Invalid lat or lng coordinates provided.");
    }

    if (this.props.status === "maintenance") {
      throw new UnprocessableEntityError(
        "Cannot update location while in maintenance.",
      );
    }

    this.props.lat = lat;
    this.props.lng = lng;
    this.props.lastUpdated = new Date();
  }

  public updateStatus(status: VehicleProps["status"]): void {
    if (!Object.values(VehicleStatus).includes(status)) {
      throw new BadRequestError(`Invalid status: ${status}`);
    }

    this.props.status = status;
    this.props.lastUpdated = new Date();
  }

  public toSnapshot(): Readonly<VehicleSnapshot> {
    return Object.freeze({
      ...this.props,
      lastUpdated: this.props.lastUpdated.toISOString(),
    });
  }
}
