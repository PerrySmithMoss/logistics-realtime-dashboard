import {
  createMockLifecycleManager,
  createMockLogger,
} from "@shared/test-utils";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBroker } from "../in-memory-event-broker";

describe("InMemoryEventBroker", () => {
  const setup = () => {
    const logger = createMockLogger();
    const lifecycle = createMockLifecycleManager();
    const broker = new InMemoryEventBroker(lifecycle, logger);

    return {
      broker,
      logger,
      lifecycle,
    };
  };

  describe("Subscribing", () => {
    it("should allow multiple handlers to subscribe to the same event", async () => {
      const { broker } = setup();
      const eventName = "test.event";
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      broker.subscribe(eventName, handler1);
      broker.subscribe(eventName, handler2);
      broker.publish(eventName, { foo: "bar" });

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalledWith({ foo: "bar" });
        expect(handler2).toHaveBeenCalledWith({ foo: "bar" });
      });
    });

    it("should correctly unsubscribe a specific handler", async () => {
      const { broker } = setup();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      broker.subscribe("event", handler1);
      broker.subscribe("event", handler2);

      broker.unsubscribe("event", handler1);
      broker.publish("event", {});

      await vi.waitFor(() => {
        expect(handler2).toHaveBeenCalled();
        expect(handler1).not.toHaveBeenCalled();
      });
    });

    it("should not block fast subscribers with slow ones", async () => {
      const { broker } = setup();
      const order: string[] = [];

      broker.subscribe("event", async () => {
        await new Promise((res) => setTimeout(res, 50));
        order.push("slow");
      });

      broker.subscribe("event", () => {
        order.push("fast");
      });

      broker.publish("event", {});

      await vi.waitFor(() => {
        expect(order).toEqual(["fast", "slow"]);
      });
    });
  });

  describe("Publishing", () => {
    it("should ensure a failing handler does not prevent others from running", async () => {
      const { broker, logger } = setup();
      const error = new Error("Subscriber Failed");

      const faultyHandler = vi.fn().mockImplementation(async () => {
        throw error;
      });
      const healthyHandler = vi.fn();

      broker.subscribe("fail.test", faultyHandler);
      broker.subscribe("fail.test", healthyHandler);

      broker.publish("fail.test", {});

      await vi.waitFor(() => {
        expect(healthyHandler).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Unhandled error in listener for "fail.test"',
          ),
          error,
        );
      });
    });

    it("should handle nested publishing without deadlocking", async () => {
      const { broker } = setup();
      const results: string[] = [];

      broker.subscribe("first", () => {
        results.push("first-received");
        broker.publish("second", "payload");
      });

      broker.subscribe("second", () => {
        results.push("second-received");
      });

      broker.publish("first", "start");

      await vi.waitFor(() => {
        expect(results).toEqual(["first-received", "second-received"]);
      });
    });
  });

  describe("Lifecycle Integration", () => {
    it("should clear all listeners and log activity on shutdown", async () => {
      const { broker, lifecycle, logger } = setup();
      const handler = vi.fn();

      broker.subscribe("app.event", handler);

      await lifecycle.triggerShutdown();

      broker.publish("app.event", {});

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 1 active stream listeners"),
      );

      await new Promise((res) => setTimeout(res, 10));
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
