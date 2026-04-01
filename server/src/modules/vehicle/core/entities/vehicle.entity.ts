import {
  BadRequestError,
  UnprocessableEntityError,
} from "@shared/errors/app.errors";
import { VehicleSnapshot } from "../dtos/vehicle-snapshot.dto";

export const VehicleStatuses = [
  "active",
  "inactive",
  "delayed",
  "maintenance",
] as const;
export type VehicleStatus = (typeof VehicleStatuses)[number];

export interface VehicleProps {
  id: string;
  plateNumber: string;
  lat: number;
  lng: number;
  status: VehicleStatus;
  lastUpdated: Date;
}

export class Vehicle {
  private constructor(private props: VehicleProps) {}

  public static create(props: Omit<VehicleProps, "lastUpdated">): Vehicle {
    if (!props.plateNumber || props.plateNumber.length < 5) {
      throw new BadRequestError("Plate number must be at least 5 characters.");
    }
    return new Vehicle({ ...props, lastUpdated: new Date() });
  }

  public updatePosition(lat: number, lng: number): void {
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
    const validStatuses: VehicleProps["status"][] = [
      "active",
      "inactive",
      "delayed",
      "maintenance",
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid status: ${status}`);
    }

    this.props.status = status;
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
