import { InternalServerError } from "@shared/errors/app.errors";
import { describe, expect, it, vi } from "vitest";
import { CommandBus } from "../command-bus";

describe("CommandBus", () => {
  const setup = () => {
    const bus = new CommandBus();
    const TEST_COMMAND = "test.command" as any;

    const mockHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    return { bus, mockHandler, TEST_COMMAND };
  };

  describe("Registration", () => {
    it("should allow registering a valid command handler", () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();

      expect(() => bus.register(TEST_COMMAND, mockHandler)).not.toThrow();
    });

    it("should throw InternalServerError if a handler is already registered for a command", () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();

      bus.register(TEST_COMMAND, mockHandler);

      expect(() => bus.register(TEST_COMMAND, mockHandler)).toThrow(
        InternalServerError,
      );
      expect(() => bus.register(TEST_COMMAND, mockHandler)).toThrow(
        /already registered/,
      );
    });
  });

  describe("Execution (execute)", () => {
    it("should successfully route the command to the registered handler", async () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();
      const payload = { userId: "user-1", action: "update" };

      bus.register(TEST_COMMAND, mockHandler);
      await bus.execute(TEST_COMMAND, payload);

      expect(mockHandler.handle).toHaveBeenCalledWith(payload, {});
    });

    it("should throw InternalServerError if no handler exists for the command", async () => {
      const { bus, TEST_COMMAND } = setup();

      await expect(bus.execute(TEST_COMMAND, { data: "raw" })).rejects.toThrow(
        InternalServerError,
      );

      await expect(bus.execute(TEST_COMMAND, { data: "raw" })).rejects.toThrow(
        /No handler registered/,
      );
    });
  });

  describe("Cancellation & Context Propagation", () => {
    it("should fail fast if the AbortSignal is already aborted before execution", async () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();
      const controller = new AbortController();
      controller.abort();

      bus.register(TEST_COMMAND, mockHandler);

      await expect(
        bus.execute(TEST_COMMAND, {}, { signal: controller.signal }),
      ).rejects.toThrow(/cancelled: Signal already aborted/);

      expect(mockHandler.handle).not.toHaveBeenCalled();
    });

    it("should pass the AbortSignal down to the handler options", async () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();
      const controller = new AbortController();
      const signal = controller.signal;
      const payload = { amount: 100 };

      bus.register(TEST_COMMAND, mockHandler);

      await bus.execute(TEST_COMMAND, payload, { signal });

      expect(mockHandler.handle).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ signal }),
      );
    });

    it("should default to an empty object if no options are provided", async () => {
      const { bus, mockHandler, TEST_COMMAND } = setup();

      bus.register(TEST_COMMAND, mockHandler);
      await bus.execute(TEST_COMMAND, {});

      expect(mockHandler.handle).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});
