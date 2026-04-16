import { IAppConfig } from "@config/index";
import { ServiceUnavailableError } from "@shared/errors/app.errors";
import { AppState } from "@shared/interfaces";
import {
  createMockConfig,
  createMockFleetDataService,
  createMockLifecycleManager,
  createMockRequest,
  createMockResponse,
} from "@shared/testing/test-utils";
import { DeepPartial } from "@shared/types";
import { Request } from "express";
import { HealthController } from "../health.controller";

describe("HealthController", () => {
  const setup = (
    overrides: {
      req?: Partial<Request>;
      config?: DeepPartial<IAppConfig>;
      lifecycleState?: AppState;
      isHydrated?: boolean;
    } = {},
  ) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00Z"));

    const mockConfig = createMockConfig(overrides.config);
    const mockLifecycle = createMockLifecycleManager(overrides.lifecycleState ?? AppState.READY);
    const mockDataService = createMockFleetDataService(overrides.isHydrated ?? true);

    const controller = new HealthController(mockConfig, mockLifecycle, mockDataService);

    return {
      controller,
      mockLifecycle,
      mockDataService,
      mockReq: createMockRequest({
        ...overrides.req,
      }),
      mockRes: createMockResponse(),
    };
  };

  describe("live", () => {
    it("should return 200 OK even if the system is not ready", () => {
      const { controller, mockReq, mockRes } = setup({
        lifecycleState: AppState.STARTING,
        isHydrated: false,
      });

      controller.live(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(vi.mocked(mockRes.json).mock.calls[0][0].data.status).toBe("ALIVE");
    });
  });

  describe("ready", () => {
    it("should return 200 when all systems are go", async () => {
      const { controller, mockReq, mockRes } = setup({
        lifecycleState: AppState.READY,
        isHydrated: true,
      });

      await controller.ready(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(vi.mocked(mockRes.json).mock.calls[0][0].data.status).toBe("UP");
    });

    it("should include correct metadata from config", async () => {
      const { controller, mockReq, mockRes } = setup({
        config: {
          app: { version: "2.0.0", name: "fleet-api" },
          server: { env: "production" },
        },
      });

      await controller.ready(mockReq, mockRes);

      const body = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(body.meta).toMatchObject({
        apiVersion: "2.0.0",
        environment: "production",
      });
    });

    it("should handle uptime correctly", async () => {
      const { controller, mockReq, mockRes } = setup();

      await controller.ready(mockReq, mockRes);

      const { data } = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(data.uptime)).toBe(true);
    });

    it("should prioritise 'STARTING' status over 'INITIALISING'", async () => {
      const { controller, mockReq, mockRes } = setup({
        lifecycleState: AppState.STARTING,
        isHydrated: false,
      });

      const promise = controller.ready(mockReq, mockRes);

      await expect(promise).rejects.toThrow(ServiceUnavailableError);
      await promise.catch((err) => {
        expect(err.details[0].value).toBe("STARTING");
      });
    });

    it("should prioritise SHUTTING_DOWN status over all other states", async () => {
      const { controller, mockReq, mockRes, mockLifecycle } = setup({
        lifecycleState: AppState.READY,
        isHydrated: true,
      });

      mockLifecycle.prepareForShutdown();

      await expect(controller.ready(mockReq, mockRes)).rejects.toThrow(ServiceUnavailableError);
    });

    it("should return a valid ISO timestamp and numeric uptime", async () => {
      const { controller, mockReq, mockRes } = setup();

      await controller.ready(mockReq, mockRes);

      const { data } = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(data.uptime).toBeTypeOf("number");
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it("should return 503 INITIALISING when lifecycle is ready but data is not hydrated", async () => {
      const { controller, mockReq, mockRes } = setup({
        lifecycleState: AppState.READY,
        isHydrated: false,
      });

      const promise = controller.ready(mockReq, mockRes);

      await expect(promise).rejects.toThrow(ServiceUnavailableError);

      await promise.catch((err) => {
        expect(err.details).toContainEqual(
          expect.objectContaining({
            path: "status",
            value: "INITIALISING",
          }),
        );
      });
    });

    it("should return 503 when lifecycle is starting", async () => {
      const { controller, mockReq, mockRes } = setup({
        lifecycleState: AppState.STARTING,
      });

      const promise = controller.ready(mockReq, mockRes);

      await expect(promise).rejects.toThrow(ServiceUnavailableError);

      await promise.catch((err) => {
        expect(err.statusCode).toBe(503);
        expect(err.details).toContainEqual(expect.objectContaining({ value: "STARTING" }));
      });
    });
  });
});
