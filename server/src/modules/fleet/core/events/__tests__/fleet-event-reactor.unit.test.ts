import {
  createMockEventBroker,
  createMockFleetDataService,
  createMockLogger,
} from "@shared/testing/test-utils";
import { IFleetSnapshot } from "../../dtos/fleet-snapshot.dto";
import { FleetEventReactor } from "../fleet-event-reactor";

describe("FleetEventReactor", () => {
  const setup = () => {
    vi.useFakeTimers();

    const dataService = createMockFleetDataService(false, {
      getCurrentSnapshot: vi.fn().mockResolvedValue({
        summary: {
          total: 1,
          activeCount: 1,
          delayedCount: 0,
          performancePct: 100,
        },
        vehicles: [],
      }),
    });

    const broker = createMockEventBroker();

    const logger = createMockLogger();

    return {
      dataService,
      broker,
      logger,
      reactor: new FleetEventReactor(dataService, broker, logger),
    };
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("only publishes once per tick even if multiple events occur", async () => {
    const { reactor, dataService, broker } = setup();
    const validEvent = {
      vehicleId: "v1",
      plateNumber: "ABC",
      status: "active",
      lat: 50,
      lng: 0,
      timestamp: new Date().toISOString(),
    };

    reactor.start();

    await reactor.onVehicleLocationChange(validEvent);
    await reactor.onVehicleLocationChange(validEvent);
    await reactor.onVehicleLocationChange(validEvent);

    await vi.advanceTimersByTimeAsync(1000);

    expect(dataService.processVehicleMovement).toHaveBeenCalledTimes(3);
    expect(dataService.getCurrentSnapshot).toHaveBeenCalledTimes(1);
    expect(broker.publish).toHaveBeenCalledTimes(1);
  });

  it("does not publish if no events have occurred (idleness)", async () => {
    const { reactor, dataService, broker } = setup();

    reactor.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(dataService.getCurrentSnapshot).not.toHaveBeenCalled();
    expect(broker.publish).not.toHaveBeenCalled();
  });

  it("stops the recursive timeout chain immediately when stop() is called", async () => {
    const { reactor, dataService } = setup();

    reactor.start();
    await reactor.onVehicleLocationChange({});

    reactor.stop();

    await vi.advanceTimersByTimeAsync(2000);

    expect(dataService.getCurrentSnapshot).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the dirty flag if a broadcast fails, allowing a retry on the next tick", async () => {
    const { reactor, dataService, broker } = setup();
    const validEvent = {
      vehicleId: "v1",
      status: "active",
      plateNumber: "ABC",
      lat: 50,
      lng: 0,
      timestamp: new Date().toISOString(),
    };

    await reactor.onVehicleLocationChange(validEvent);

    dataService.getCurrentSnapshot.mockRejectedValueOnce(new Error("Database Timeout"));

    reactor.start();

    await vi.advanceTimersByTimeAsync(1000);
    vi.runAllTicks();

    expect(broker.publish).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    vi.runAllTicks();

    expect(broker.publish).toHaveBeenCalledTimes(1);
  });

  it("handles concurrent events during a broadcast correctly", async () => {
    const { reactor, dataService, broker } = setup();
    const validEvent = {
      vehicleId: "v1",
      status: "active",
      plateNumber: "ABC",
      lat: 50,
      lng: 0,
      timestamp: new Date().toISOString(),
    };

    const mockSnapshot: IFleetSnapshot = {
      summary: {
        total: 1,
        activeCount: 1,
        delayedCount: 0,
        performancePct: 100,
      },
      vehicles: [],
    };

    let resolveSnapshot: (val: IFleetSnapshot) => void = () => {};

    const slowPromise = new Promise<IFleetSnapshot>((res) => {
      resolveSnapshot = res;
    });

    dataService.getCurrentSnapshot.mockReturnValue(slowPromise);

    reactor.start();

    await reactor.onVehicleLocationChange(validEvent);

    await vi.advanceTimersByTimeAsync(1000);

    await reactor.onVehicleLocationChange(validEvent);

    resolveSnapshot(mockSnapshot);

    await vi.waitFor(() => expect(broker.publish).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1000);
    expect(broker.publish).toHaveBeenCalledTimes(2);
  });

  it("does not allow multiple concurrent broadcast loops", () => {
    const { reactor, logger } = setup();

    reactor.start();
    reactor.start();
    reactor.start();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Activating"));
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});
