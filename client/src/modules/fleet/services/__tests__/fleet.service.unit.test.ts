import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors";
import { initialFleetSnapshot } from "../../../../../tests/mocks/fleet-fixtures";
import { FleetSnapshotError, VehicleNotFoundError } from "../../errors/fleet.errors";

vi.mock("server-only", () => ({}));

vi.mock("../../repositories/fleet.repository", () => ({
  fleetRepository: {
    getSnapshot: vi.fn(),
    getVehicleById: vi.fn(),
  },
}));

import { fleetRepository } from "../../repositories/fleet.repository";
import { fleetService } from "../fleet.service";

describe("fleetService", () => {
  it("wraps unexpected snapshot failures in FleetSnapshotError", async () => {
    vi.mocked(fleetRepository.getSnapshot).mockRejectedValueOnce(new Error("upstream down"));

    await expect(fleetService.getSnapshot()).rejects.toBeInstanceOf(FleetSnapshotError);
  });

  it("passes AppError snapshot failures through unchanged", async () => {
    const error = new AppError("Denied", "FORBIDDEN" as never, 403);
    vi.mocked(fleetRepository.getSnapshot).mockRejectedValueOnce(error);

    await expect(fleetService.getSnapshot()).rejects.toBe(error);
  });

  it("filters delayed vehicles from the fleet snapshot", async () => {
    vi.mocked(fleetRepository.getSnapshot).mockResolvedValueOnce(initialFleetSnapshot);

    await expect(fleetService.getDelayedVehicles()).resolves.toEqual([
      initialFleetSnapshot.vehicles[1],
    ]);
  });

  it("returns vehicle context for worst performers", async () => {
    vi.mocked(fleetRepository.getVehicleById).mockResolvedValueOnce(initialFleetSnapshot.vehicles[1]);
    vi.mocked(fleetRepository.getSnapshot).mockResolvedValueOnce(initialFleetSnapshot);

    await expect(fleetService.getVehicleWithContext("VHC-202")).resolves.toEqual({
      vehicle: initialFleetSnapshot.vehicles[1],
      isWorstPerformer: true,
    });
  });

  it("converts unknown vehicle lookup failures into VehicleNotFoundError", async () => {
    vi.mocked(fleetRepository.getVehicleById).mockRejectedValueOnce(new Error("missing"));

    await expect(fleetService.getVehicleById("VHC-404")).rejects.toBeInstanceOf(VehicleNotFoundError);
  });
});
