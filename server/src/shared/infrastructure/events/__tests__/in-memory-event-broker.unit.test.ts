import { FleetStatsUpdatedEvent } from "@modules/fleet/core/events/fleet-events";
import { EventRegistry } from "@shared/interfaces";
import { createMockLifecycleManager, createMockLogger } from "@shared/testing/test-utils";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBroker } from "../in-memory-event-broker";

interface TestEventRegistry {
  FIRST: { id: string };
  SECOND: { ok: boolean };
}

describe("InMemoryEventBroker", () => {
  const setup = <T = EventRegistry>() => {
    const logger = createMockLogger();
    const lifecycle = createMockLifecycleManager();
    const broker = new InMemoryEventBroker<T>(lifecycle, logger);

    const createPayload = () => ({
      summary: {
        total: 1,
        activeCount: 1,
        delayedCount: 0,
        performancePct: 100,
      },
      vehicles: [],
    });

    return { broker, logger, lifecycle, createPayload };
  };

  describe("Subscribing", () => {
    it("should allow multiple handlers to subscribe to the same event", async () => {
      const { broker, createPayload } = setup();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      broker.subscribe(FleetStatsUpdatedEvent.type, handler1);
      broker.subscribe(FleetStatsUpdatedEvent.type, handler2);

      broker.publish(FleetStatsUpdatedEvent.type, new FleetStatsUpdatedEvent(createPayload()));

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalledWith(expect.any(FleetStatsUpdatedEvent));
        expect(handler2).toHaveBeenCalledWith(expect.any(FleetStatsUpdatedEvent));
      });
    });

    it("should correctly unsubscribe a specific handler", async () => {
      const { broker, createPayload } = setup();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      broker.subscribe(FleetStatsUpdatedEvent.type, handler1);
      broker.subscribe(FleetStatsUpdatedEvent.type, handler2);

      broker.unsubscribe(FleetStatsUpdatedEvent.type, handler1);
      broker.publish(FleetStatsUpdatedEvent.type, new FleetStatsUpdatedEvent(createPayload()));

      await vi.waitFor(() => {
        expect(handler2).toHaveBeenCalled();
        expect(handler1).not.toHaveBeenCalled();
      });
    });

    it("should not block fast subscribers with slow ones", async () => {
      const { broker, createPayload } = setup();
      const order: string[] = [];

      broker.subscribe(FleetStatsUpdatedEvent.type, async () => {
        await new Promise((res) => setTimeout(res, 50));
        order.push("slow");
      });

      broker.subscribe(FleetStatsUpdatedEvent.type, () => {
        order.push("fast");
      });

      broker.publish(FleetStatsUpdatedEvent.type, new FleetStatsUpdatedEvent(createPayload()));

      await vi.waitFor(() => {
        expect(order).toEqual(["fast", "slow"]);
      });
    });
  });

  describe("Publishing", () => {
    it("should ensure a failing handler does not prevent others from running", async () => {
      const { broker, logger, createPayload } = setup();
      const error = new Error("Subscriber Failed");

      const faultyHandler = vi.fn().mockImplementation(async () => {
        throw error;
      });
      const healthyHandler = vi.fn();

      broker.subscribe(FleetStatsUpdatedEvent.type, faultyHandler);
      broker.subscribe(FleetStatsUpdatedEvent.type, healthyHandler);

      broker.publish(FleetStatsUpdatedEvent.type, new FleetStatsUpdatedEvent(createPayload()));

      await vi.waitFor(() => {
        expect(healthyHandler).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `[EventBroker] Unhandled error in listener for "${FleetStatsUpdatedEvent.type}"`,
          ),
          error,
        );
      });
    });

    it("should handle nested publishing without deadlocking using a test registry", async () => {
      const { broker } = setup<TestEventRegistry>();
      const results: string[] = [];

      broker.subscribe("FIRST", () => {
        results.push("first-received");
        broker.publish("SECOND", { ok: true });
      });

      broker.subscribe("SECOND", () => {
        results.push("second-received");
      });

      broker.publish("FIRST", { id: "test-v1" });

      await vi.waitFor(() => {
        expect(results).toEqual(["first-received", "second-received"]);
      });
    });
  });

  describe("Lifecycle Integration", () => {
    it("should clear all listeners and log activity on shutdown", async () => {
      const { broker, lifecycle, logger, createPayload } = setup();
      const handler = vi.fn();

      broker.subscribe(FleetStatsUpdatedEvent.type, handler);

      await lifecycle.triggerShutdown();

      broker.publish(FleetStatsUpdatedEvent.type, new FleetStatsUpdatedEvent(createPayload()));

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 1 active stream listeners"),
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it("should log the empty message if no listeners exist on shutdown", async () => {
      const { lifecycle, logger } = setup();

      await lifecycle.triggerShutdown();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("No active stream listeners to clear"),
      );
    });
  });
});
