import { AppError, ErrorCode } from "@/shared/errors";

export class FleetSnapshotError extends AppError {
  constructor(cause?: unknown) {
    super("Failed to load fleet snapshot", ErrorCode.ExternalServiceError, 502, true, undefined, {
      cause,
    });
  }
}

export class VehicleNotFoundError extends AppError {
  constructor(vehicleId: string) {
    super(`Vehicle "${vehicleId}" not found`, ErrorCode.NotFound, 404, true);
  }
}
