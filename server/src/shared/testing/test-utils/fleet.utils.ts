import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { vi, type Mocked } from "vitest";

export type MockFleetDataService = Mocked<IFleetDataService> & {
  setHydrated: (val: boolean) => void;
};

export const createMockFleetDataService = (
  initialHydrated = false,
): MockFleetDataService => {
  let hydrated = initialHydrated;

  const mock = {
    hydrate: vi.fn().mockResolvedValue(undefined),
    processVehicleMovement: vi.fn().mockResolvedValue(undefined),
    getCurrentSnapshot: vi.fn().mockResolvedValue({
      totalVehicles: 0,
      activeVehicles: 0,
      timestamp: new Date().toISOString(),
      vehicles: [],
    }),
  } as unknown as MockFleetDataService;

  Object.defineProperty(mock, "isHydrated", {
    get: () => hydrated,
    enumerable: true,
    configurable: true,
  });

  mock.setHydrated = (val: boolean) => {
    hydrated = val;
  };

  return mock;
};
