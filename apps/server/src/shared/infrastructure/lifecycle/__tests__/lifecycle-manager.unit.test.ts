import { InternalServerError } from "@shared/errors/app.errors";
import { AppState } from "@shared/interfaces/lifecycle-manager.interface";
import { createMockLogger } from "@shared/testing/test-utils";
import { describe, expect, it, vi } from "vitest";
import { LifecycleManager } from "../lifecycle-manager";

describe("LifecycleManager", () => {
  const setup = () => {
    const logger = createMockLogger();
    const manager = new LifecycleManager(logger);
    return { logger, manager };
  };

  describe("State Transitions", () => {
    it("should start in STARTING state", () => {
      const { manager } = setup();
      expect(manager.state).toBe(AppState.STARTING);
    });

    it("should transition to READY from STARTING", () => {
      const { manager } = setup();
      manager.setReady();
      expect(manager.isReady).toBe(true);
    });

    it("should prevent invalid transition back to READY once already set", () => {
      const { manager } = setup();
      manager.setReady();
      expect(() => manager.setReady()).toThrow(InternalServerError);
    });
  });

  describe("Shutdown Execution Integrity", () => {
    it("should ensure AbortSignal is aborted even if prepareForShutdown is skipped", async () => {
      const { manager } = setup();
      const signal = manager.getShutdownSignal();

      await manager.closeAll();

      expect(signal.aborted).toBe(true);
      expect(manager.state).toBe(AppState.CLOSED);
    });

    it("should handle mixed task types (Sync vs Async)", async () => {
      const { manager } = setup();
      const results: string[] = [];

      manager.onShutdown(async () => {
        results.push("async");
      });
      manager.onShutdown(() => {
        results.push("sync");
        return Promise.resolve();
      });

      await manager.closeAll();
      expect(results).toEqual(["sync", "async"]);
    });

    it("should log specific task names on timeout", async () => {
      vi.useFakeTimers();
      const { manager, logger } = setup();

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
    it("should be idempotent regarding logging transitions", () => {
      const { manager, logger } = setup();

      manager.prepareForShutdown();
      manager.prepareForShutdown();

      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });
});
