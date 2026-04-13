import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import { IFleetDataService } from "@modules/fleet/core/interfaces/fleet-data-service.interface";
import { IFleetObserverService } from "@modules/fleet/core/interfaces/fleet-observer-service.interface";
import { IFleetStatsProjection } from "@modules/fleet/core/interfaces/fleet-stats-projection.interface";
import { VehicleSnapshot } from "@modules/vehicle/core/dtos";
import { IBroadcastScheduler, ISimulator } from "@shared/interfaces";
import { vi, type Mocked } from "vitest";
import { createVehicleSnapshot } from "./vehicle.utils";

export const createFleetSnapshot = (overrides: Partial<IFleetSnapshot> = {}): IFleetSnapshot => ({
  summary: {
    total: 1,
    activeCount: 1,
    delayedCount: 0,
    performancePct: 100,
  },
  vehicles: [createVehicleSnapshot()],
  ...overrides,
});

export type MockFleetDataService = Mocked<IFleetDataService> & {
  setHydrated: (val: boolean) => void;
};

export const createMockFleetDataService = (
  initialHydrated = false,
  overrides: Partial<Mocked<IFleetDataService>> = {},
): MockFleetDataService => {
  let hydrated = initialHydrated;

  const mock = {
    hydrate: vi.fn().mockResolvedValue(undefined),
    processVehicleMovement: vi.fn().mockResolvedValue(undefined),
    getCurrentSnapshot: vi.fn().mockResolvedValue(
      createFleetSnapshot({
        summary: {
          total: 0,
          activeCount: 0,
          delayedCount: 0,
          performancePct: 100,
        },
        vehicles: [],
      }),
    ),
    ...overrides,
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

export const createMockFleetReactor = (
  overrides: Partial<Mocked<IBroadcastScheduler>> = {},
): Mocked<IBroadcastScheduler> => ({
  start: vi.fn(),
  stop: vi.fn(),
  ...overrides,
});

export const createMockFleetSimulator = (
  overrides: Partial<Mocked<ISimulator>> = {},
): Mocked<ISimulator> => ({
  heartbeat: vi.fn(),
  stop: vi.fn(),
  start: vi.fn(),
  initialise: vi.fn(),
  ...overrides,
});

export const createMockFleetProjection = (): IFleetStatsProjection & {
  _state: IFleetSnapshot;
} => {
  const state = {
    summary: { total: 0, activeCount: 0, delayedCount: 0, performancePct: 100 },
    vehicles: [] as VehicleSnapshot[],
  };

  const handleUpdate = vi.fn((update) => {
    const index = state.vehicles.findIndex((v) => v.id === (update.vehicleId || update.id));
    const vehicle = { ...update, id: update.vehicleId || update.id };
    if (index > -1) state.vehicles[index] = vehicle;
    else state.vehicles.push(vehicle);
    state.summary.total = state.vehicles.length;
  });

  return {
    handleUpdate,
    getCurrentSnapshot: vi.fn().mockReturnValue(state),
    _state: state,
  };
};

export const createMockFleetObserverService = (): Mocked<IFleetObserverService> => ({
  addObserver: vi.fn(),
  removeObserver: vi.fn(),
  keepAlive: vi.fn(),
});
