import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { AppError, AppErrorCodes } from "@shared/errors/app.errors";
import { AppState } from "@shared/interfaces";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { createMockLifecycleManager, createMockLogger } from "@shared/testing/test-utils";
import { FleetSimulator } from "../fleet-simulator";

interface TestRegistry {
  [UpdateVehicleLocationCommand.type]: UpdateVehicleLocationCommand;
}

describe("FleetSimulator", () => {
  const setup = (state = AppState.READY) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T11:00:00Z"));

    const commandBus: ICommandBus<TestRegistry> = {
      execute: vi.fn().mockResolvedValue(undefined),
      register: vi.fn(),
    };

    const logger = createMockLogger();
    const lifecycle = createMockLifecycleManager(state);

    const simulator = new FleetSimulator(commandBus, logger, lifecycle, {
      tickInterval: 1_000,
      watchdogTimeout: 5_000,
    });

    simulator.initialise(["vehicle-1", "vehicle-2"]);

    return { commandBus, logger, lifecycle, simulator };
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs update failures and stops only for non-operational app errors", async () => {
    const { simulator, commandBus, logger } = setup();

    const recoverableError = new AppError(
      "recoverable",
      AppErrorCodes.InternalServerError,
      500,
      true,
    );

    const fatalError = new AppError("fatal", AppErrorCodes.InternalServerError, 500, false);

    vi.mocked(commandBus.execute)
      .mockRejectedValueOnce(recoverableError)
      .mockRejectedValueOnce(fatalError);

    simulator.heartbeat("PIPELINE_START");

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "[FleetSimulator] Failed to update vehicle vehicle-1",
        recoverableError,
      );
    });

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Stopping"));
  });

  it("manually triggers a tick to verify internal loop logic without type-cheating", async () => {
    const { simulator, commandBus } = setup();

    simulator.heartbeat("TEST");

    await vi.advanceTimersByTimeAsync(0);

    expect(commandBus.execute).toHaveBeenCalledWith(
      UpdateVehicleLocationCommand.type,
      expect.any(UpdateVehicleLocationCommand),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("prevents multiple intervals from being created if start() is called repeatedly", () => {
    const { simulator } = setup();
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    simulator.heartbeat("SOURCE_A");
    simulator.start();
    simulator.heartbeat("SOURCE_B");

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("stops the internal loop immediately if a non-operational error occurs", async () => {
    const { simulator, commandBus } = setup();
    // Ensure we have three vehicles to test the 'break' logic
    simulator.initialise(["v1", "v2", "v3"]);

    const fatalError = new AppError("FATAL", AppErrorCodes.InternalServerError, 500, false);

    vi.mocked(commandBus.execute)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(fatalError);

    simulator.heartbeat("TEST");

    await vi.waitFor(() => {
      expect(commandBus.execute).toHaveBeenCalledTimes(2);
    });

    const calledIds = vi.mocked(commandBus.execute).mock.calls.map((call) => call[1].vehicleId);
    expect(calledIds).not.toContain("v3");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the interval when the lifecycle enters a shutting down state", async () => {
    const { simulator, lifecycle } = setup();

    simulator.start();
    expect(vi.getTimerCount()).toBe(1);

    lifecycle.prepareForShutdown();

    expect(lifecycle.isShuttingDown).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(vi.getTimerCount()).toBe(0);
  });
});
