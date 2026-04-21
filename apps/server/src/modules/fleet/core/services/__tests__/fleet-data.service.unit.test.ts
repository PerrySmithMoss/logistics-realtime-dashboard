import {
  ListAllVehiclesQuery,
  ListAllVehiclesResponse,
} from "@modules/vehicle/core/queries/list-all-vehicles.query";
import { AppError, InternalServerError } from "@shared/errors/app.errors";
import { IVehicleStatusChangeEvent, SnapResponse } from "@shared/interfaces";
import {
  createMockFleetProjection,
  createMockLifecycleManager,
  createMockLogger,
  createMockQueryBus,
  createMockSnappingService,
} from "@shared/testing/test-utils";
import { createVehicleSnapshot } from "@shared/testing/test-utils/vehicle.utils";
import { VehicleStatus } from "@shared/types/vehicle.types";
import { FleetDataService } from "../fleet-data.service";

describe("FleetDataService", () => {
  const createMovementEvent = (
    overrides: Partial<IVehicleStatusChangeEvent> = {},
  ): IVehicleStatusChangeEvent => ({
    vehicleId: "vehicle-1",
    plateNumber: "AB12 CDE",
    status: "active",
    lat: 51.5,
    lng: -0.12,
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  const setup = () => {
    vi.useFakeTimers();
    const queryBus = createMockQueryBus();
    const projection = createMockFleetProjection();
    const snappingService = createMockSnappingService();
    const logger = createMockLogger();
    const lifecycle = createMockLifecycleManager();

    const service = new FleetDataService(queryBus, projection, snappingService, logger, lifecycle, {
      hydrationTimeout: 5000,
      batchIntervalMs: 1000,
    });

    return {
      logger,
      queryBus,
      projection,
      snappingService,
      service,
      lifecycle,
    };
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("hydrate", () => {
    it("hydrates the projection from the vehicle query and marks the service as ready", async () => {
      const { service, queryBus, projection, logger } = setup();

      queryBus.ask.mockResolvedValue({
        data: [
          createVehicleSnapshot(),
          createVehicleSnapshot({ id: "vehicle-2", status: "delayed" }),
        ],
        count: 2,
        timestamp: new Date().toISOString(),
      });

      await service.hydrate();

      expect(queryBus.ask).toHaveBeenCalledWith(
        ListAllVehiclesQuery.type,
        {},
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
      expect(projection.handleUpdate).toHaveBeenCalledTimes(2);
      expect(projection.handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: "vehicle-1",
          timestamp: expect.any(String),
          isSnapped: false,
        }),
      );
      expect(service.isHydrated).toBe(true);
      expect(logger.info).toHaveBeenCalledWith("[FleetDataService] Hydration complete");
    });

    it("returns silently when hydration is aborted by global shutdown", async () => {
      const { service, queryBus, lifecycle, logger } = setup();

      lifecycle.prepareForShutdown();

      const abortError = new Error("aborted by shutdown");
      queryBus.ask.mockRejectedValue(abortError);

      await expect(service.hydrate()).resolves.toBeUndefined();

      expect(service.isHydrated).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Hydration cancelled due to service shutdown"),
      );
    });

    it("rethrows known AppError failures and keeps hydration false", async () => {
      const { service, queryBus, logger } = setup();
      const appError = new AppError("Hydration timed out", "HYDRATION_FAILED" as never, 500, false);
      queryBus.ask.mockRejectedValue(appError);

      await expect(service.hydrate()).rejects.toBe(appError);

      expect(service.isHydrated).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Hydration failed", appError);
    });

    it("wraps unexpected hydration failures in an InternalServerError", async () => {
      const { service, queryBus } = setup();

      const originalError = new Error("database unavailable");
      queryBus.ask.mockRejectedValue(originalError);

      try {
        await service.hydrate();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(InternalServerError);
        expect((err as InternalServerError).message).toBe("Fleet hydration failed");
        expect((err as InternalServerError).cause).toBe(originalError);
      }
    });
  });

  describe("batched movement processing", () => {
    it("buffers the latest event per vehicle and publishes snapped coordinates", async () => {
      const { service, snappingService, queryBus } = setup();

      queryBus.ask.mockResolvedValue({
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
      await service.hydrate();

      snappingService.snapBatch.mockResolvedValue([{ lat: 51.501, lng: -0.121, success: true }]);

      await service.processVehicleMovement(
        createMovementEvent({ vehicleId: "vehicle-1", lat: 51.5, lng: -0.12 }),
      );

      await service.processVehicleMovement(
        createMovementEvent({ vehicleId: "vehicle-1", lat: 51.52, lng: -0.13 }),
      );

      await vi.advanceTimersByTimeAsync(1000);

      expect(snappingService.snapBatch).toHaveBeenCalledWith(
        [{ lat: 51.52, lng: -0.13 }],
        expect.any(Object),
      );
    });

    it("logs batch errors and re-buffers events for the next attempt", async () => {
      const { service, snappingService, logger, queryBus } = setup();

      queryBus.ask.mockResolvedValue({
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
      await service.hydrate();

      snappingService.snapBatch.mockRejectedValueOnce(new Error("Network Error"));

      await service.processVehicleMovement(createMovementEvent({ vehicleId: "v1" }));
      await vi.advanceTimersByTimeAsync(1000);

      expect(logger.error).toHaveBeenCalledWith(
        "Batch flush failed. Re-buffering events. Dropping batch to prevent overflow.",
        expect.any(Error),
      );

      snappingService.snapBatch.mockResolvedValue([{ lat: 10, lng: 10, success: true }]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(snappingService.snapBatch).toHaveBeenCalledTimes(2);
    });

    it("ignores movement events after shutdown has started", async () => {
      const { service, lifecycle, snappingService } = setup();
      lifecycle.prepareForShutdown();

      await service.processVehicleMovement({
        vehicleId: "vehicle-1",
        plateNumber: "AB12 CDE",
        status: "active",
        lat: 51.5,
        lng: -0.12,
        timestamp: "2026-04-12T10:00:00.000Z",
      });
      await vi.advanceTimersByTimeAsync(1_000);

      expect(snappingService.snapBatch).not.toHaveBeenCalled();
    });

    it("stops batching and clears buffered events during shutdown", async () => {
      const { service, lifecycle, snappingService } = setup();

      await service.processVehicleMovement({
        vehicleId: "vehicle-1",
        plateNumber: "AB12 CDE",
        status: "active",
        lat: 51.5,
        lng: -0.12,
        timestamp: "2026-04-12T10:00:00.000Z",
      });

      await lifecycle.triggerShutdown();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(snappingService.snapBatch).not.toHaveBeenCalled();
    });
  });

  it("delegates current snapshot reads to the projection", async () => {
    const { service, projection } = setup();
    const snapshot = {
      summary: {
        total: 3,
        activeCount: 2,
        delayedCount: 1,
        performancePct: 66.67,
      },
      vehicles: [{ id: "vehicle-1" }],
    };
    vi.mocked(projection.getCurrentSnapshot).mockReturnValue(snapshot as never);

    await expect(service.getCurrentSnapshot()).resolves.toEqual(snapshot);
  });

  describe("Concurrency / Buffering", () => {
    it("prevents concurrent batch processing", async () => {
      const { service, snappingService, queryBus } = setup();

      queryBus.ask.mockResolvedValue({
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      });
      await service.hydrate();

      let resolveSnapping: (val: SnapResponse[]) => void = () => {};

      snappingService.snapBatch.mockReturnValue(
        new Promise((res) => {
          resolveSnapping = res;
        }),
      );

      await service.processVehicleMovement(createMovementEvent({ vehicleId: "v1" }));

      await vi.advanceTimersByTimeAsync(1000);

      expect(snappingService.snapBatch).toHaveBeenCalledTimes(1);

      await service.processVehicleMovement(createMovementEvent({ vehicleId: "v2" }));

      await vi.advanceTimersByTimeAsync(1000);

      expect(snappingService.snapBatch).toHaveBeenCalledTimes(1);

      resolveSnapping([{ lat: 51.5, lng: -0.1, success: true }]);
    });

    it("buffers movements during hydration and applies them after hydration completes", async () => {
      const { service, queryBus, snappingService } = setup();

      snappingService.snapBatch.mockResolvedValue([{ lat: 52.0, lng: -0.12, success: true }]);

      let resolveHydration: (val: ListAllVehiclesResponse) => void = () => {};

      queryBus.ask.mockReturnValue(new Promise((res) => (resolveHydration = res)));

      const hydrationPromise = service.hydrate();

      const movement = createMovementEvent({
        vehicleId: "v-buffered",
        lat: 52.0,
      });
      await service.processVehicleMovement(movement);

      resolveHydration({
        data: [
          {
            id: "v-buffered",
            plateNumber: "AB12 CDE",
            status: VehicleStatus.Active,
            lat: 51.0,
            lng: -0.12,
            isSnapped: false,
            lastUpdated: new Date().toISOString(),
          },
        ],
        count: 1,
        timestamp: new Date().toISOString(),
      });

      await hydrationPromise;

      await vi.advanceTimersByTimeAsync(1000);

      await Promise.resolve();

      expect(service.isHydrated).toBe(true);

      const snapshot = await service.getCurrentSnapshot();
      const vehicle = snapshot.vehicles.find((v) => v.id === "v-buffered");

      expect(vehicle?.lat).toBe(52.0);
    });
  });
});
