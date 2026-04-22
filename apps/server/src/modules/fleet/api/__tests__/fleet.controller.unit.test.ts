import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import {
  createMockFleetDataService,
  createMockFleetObserverService,
  createMockLifecycleManager,
  createMockSseResponse,
} from "@shared/testing/test-utils";
import { createMockConfig } from "@shared/testing/test-utils/config.utils";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createVehicleSnapshot } from "@shared/testing/test-utils/vehicle.utils";
import { FleetController } from "../fleet.controller";

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "connection-123"),
}));

describe("FleetController", () => {
  const createSnapshot = (): IFleetSnapshot => ({
    summary: {
      total: 1,
      activeCount: 1,
      delayedCount: 0,
      performancePct: 100,
    },
    vehicles: [createVehicleSnapshot({ id: "vehicle-1" })],
  });

  const setup = ({ ready = true }: { ready?: boolean } = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00Z"));

    const observerService = createMockFleetObserverService();
    const dataService = createMockFleetDataService();
    const lifecycle = createMockLifecycleManager();

    if (ready) lifecycle.setReady();

    const req = createMockRequest();
    const res = createMockSseResponse();

    const controller = new FleetController(
      createMockConfig(),
      observerService,
      dataService,
      lifecycle,
      15_000,
    );

    return { observerService, dataService, lifecycle, req, res, controller };
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the current snapshot through the standard success envelope", async () => {
    const { controller, req, res, dataService } = setup();

    const expectedSnapshot = createSnapshot();
    dataService.getCurrentSnapshot.mockResolvedValue(expectedSnapshot);

    await controller.getSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expectedSnapshot,
      }),
    );
  });

  it("opens an SSE stream, sends the initial snapshot, and heartbeats observers while writable", async () => {
    const { controller, dataService, observerService, req, res } = setup();

    const expectedSnapshot = createSnapshot();
    dataService.getCurrentSnapshot.mockResolvedValue(expectedSnapshot);

    await controller.stream(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      }),
    );

    expect(dataService.getCurrentSnapshot).toHaveBeenCalledTimes(1);

    expect(res.write).toHaveBeenCalledWith(
      `event: stats-update\ndata: ${JSON.stringify(expectedSnapshot)}\n\n`,
    );

    expect(observerService.addObserver).toHaveBeenCalledWith(
      "connection-123",
      res,
      expect.any(Function),
    );

    await vi.advanceTimersByTimeAsync(15_000);

    expect(res.write).toHaveBeenCalledWith(":\n\n");
    expect(observerService.keepAlive).toHaveBeenCalledTimes(1);
  });

  it("returns early if the client disconnects before the initial snapshot is ready", async () => {
    const { controller, dataService, observerService, req, res } = setup();

    let resolveSnapshot!: (value: IFleetSnapshot) => void;
    dataService.getCurrentSnapshot.mockReturnValue(
      new Promise<IFleetSnapshot>((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const streamPromise = controller.stream(req, res);

    // Simulate a browser tab closing mid-flight: the controller registered a
    // `close` listener before awaiting the snapshot, so emitting here sets
    // writableEnded and runs cleanup before the fetch completes.
    res.emit("close");

    resolveSnapshot(createSnapshot());

    // Two microtask ticks are needed:
    //   1. The snapshot Promise resolves.
    //   2. The async controller function resumes and hits the writableEnded guard.
    // If the implementation changes and this becomes flaky, revisit whether
    // additional ticks or a structural change to the controller is needed.
    await Promise.resolve();
    await Promise.resolve();

    await streamPromise;

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(observerService.addObserver).not.toHaveBeenCalled();
  });

  it("cleans up observers and closes the response when the shutdown signal aborts", async () => {
    const { controller, observerService, lifecycle, req, res } = setup();

    await controller.stream(req, res);
    lifecycle.prepareForShutdown();

    expect(observerService.removeObserver).toHaveBeenCalledWith("connection-123");
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it("cleans up when a heartbeat write fails", async () => {
    const { controller, observerService, req, res } = setup();

    // First write: the initial SSE snapshot — succeeds.
    // Second write: the heartbeat pulse — fails, triggering cleanup.
    vi.mocked(res.write)
      .mockReturnValueOnce(true) // sendSse("stats-update", ...)
      .mockReturnValueOnce(false); // pulse write

    await controller.stream(req, res);
    await vi.advanceTimersByTimeAsync(15_000);

    expect(observerService.removeObserver).toHaveBeenCalledWith("connection-123");
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it("cleans up resources when the client disconnects (res emits close)", async () => {
    const { controller, observerService, req, res } = setup();

    await controller.stream(req, res);

    res.emit("close");

    expect(observerService.removeObserver).toHaveBeenCalledWith("connection-123");
    expect(res.writableEnded).toBe(true);
  });

  it("cleans up resources when the request closes", async () => {
    const { controller, observerService, req, res } = setup();

    await controller.stream(req, res);

    req.emit("close");

    expect(observerService.removeObserver).toHaveBeenCalledWith("connection-123");
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
