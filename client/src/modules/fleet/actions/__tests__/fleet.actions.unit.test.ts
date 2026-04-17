import { describe, expect, it, vi } from "vitest";
import { initialFleetSnapshot } from "../../../../../tests/mocks/fleet-fixtures";

vi.mock("server-only", () => ({}));

vi.mock("../../services/fleet.service", () => ({
  fleetService: {
    getSnapshot: vi.fn(),
    getVehicleById: vi.fn(),
  },
}));

import { fleetService } from "../../services/fleet.service";
import { getSnapshotAction, getVehicleAction } from "../fleet.actions";

describe("fleet actions", () => {
  it("delegates snapshot loading to the fleet service", async () => {
    vi.mocked(fleetService.getSnapshot).mockResolvedValueOnce(initialFleetSnapshot);

    await expect(getSnapshotAction()).resolves.toEqual(initialFleetSnapshot);
  });

  it("delegates vehicle loading to the fleet service", async () => {
    vi.mocked(fleetService.getVehicleById).mockResolvedValueOnce(initialFleetSnapshot.vehicles[0]);

    await expect(getVehicleAction("VHC-101")).resolves.toEqual(initialFleetSnapshot.vehicles[0]);
    expect(fleetService.getVehicleById).toHaveBeenCalledWith("VHC-101");
  });
});
