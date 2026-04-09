import { InternalServerError } from "@shared/errors/app.errors";
import { AppState } from "@shared/interfaces/lifecycle-manager.interface";
import { createMockLogger } from "@shared/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleManager } from "../lifecycle-manager";

describe("LifecycleManager", () => {
  let logger: ReturnType<typeof createMockLogger>;
  let manager: LifecycleManager;

  beforeEach(() => {
    logger = createMockLogger();
    manager = new LifecycleManager(logger);
  });

  describe("State Transitions", () => {
    it("should start in STARTING state", () => {
      expect(manager.state).toBe(AppState.STARTING);
    });

    it("should transition to READY from STARTING", () => {
      manager.setReady();
      expect(manager.isReady).toBe(true);
    });

    it("should prevent invalid transition back to READY once already set", () => {
      manager.setReady();
      expect(() => manager.setReady()).toThrow(InternalServerError);
    });
  });

  describe("Shutdown Execution Integrity", () => {
    it("should ensure AbortSignal is aborted even if prepareForShutdown is skipped and closeAll is called", async () => {
      const signal = manager.getShutdownSignal();
      expect(signal.aborted).toBe(false);

      await manager.closeAll();

      expect(signal.aborted).toBe(true);
      expect(manager.state).toBe(AppState.CLOSED);
    });

    it("should handle mixed task types (Sync vs Async)", async () => {
      const results: string[] = [];
      manager.onShutdown(async () => {
        results.push("async");
      });
      manager.onShutdown(() => {
        results.push("sync");
        return Promise.resolve();
      });

      await manager.closeAll();

      // manager handles shutdown tasks in reverse order
      expect(results).toEqual(["sync", "async"]);
    });

    it("should log specific task names on timeout for easier debugging", async () => {
      vi.useFakeTimers();

      const databaseTask = async () => {
        await new Promise(() => {});
      };
      manager.onShutdown(databaseTask);

      const closePromise = manager.closeAll();
      await vi.advanceTimersByTimeAsync(5001);
      await closePromise;

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Shutdown task failed"),
        expect.objectContaining({
          message: expect.stringContaining("databaseTask"),
        }),
      );

      vi.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    it("should not crash if closeAll is called with zero tasks registered", async () => {
      await expect(manager.closeAll()).resolves.not.toThrow();
      expect(manager.state).toBe(AppState.CLOSED);
    });

    it("should prevent double-logging transition when already shutting down", () => {
      manager.prepareForShutdown();
      manager.prepareForShutdown();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("STARTING -> SHUTTING_DOWN"),
      );
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });
});
