import { InternalServerError } from "@shared/errors/app.errors";
import { ICommandHandler } from "@shared/interfaces/command-bus.interface";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandBus } from "../command-bus";

interface TestRegistry {
  "test:command": { payload: string };
  "test:other": { userId: string; action: string };
  "test:empty": Record<string, never>;
  "test:data": { data: string };
}

describe("CommandBus", () => {
  const setup = (handlerResult?: Promise<void>) => {
    const bus = new CommandBus<TestRegistry>();

    const createMockHandler = <K extends keyof TestRegistry>(): ICommandHandler<
      TestRegistry[K]
    > => ({
      handle: vi.fn().mockReturnValue(handlerResult ?? Promise.resolve()),
    });

    return { bus, createMockHandler };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("should allow registering a valid command handler", () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:command">();

      expect(() => bus.register("test:command", handler)).not.toThrow();
    });

    it("should throw InternalServerError if a handler is already registered", () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:command">();

      bus.register("test:command", handler);

      expect(() => bus.register("test:command", handler)).toThrow(InternalServerError);
      expect(() => bus.register("test:command", handler)).toThrow(/already registered/);
    });
  });

  describe("execute", () => {
    it("should successfully route the command to the registered handler", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:other">();
      const payload = { userId: "user-1", action: "update" };

      bus.register("test:other", handler);
      await bus.execute("test:other", payload);

      expect(handler.handle).toHaveBeenCalledWith(payload, {});
    });

    it("should throw InternalServerError if no handler exists for the command", async () => {
      const { bus } = setup();

      await expect(bus.execute("test:data", { data: "raw" })).rejects.toThrow(InternalServerError);
      await expect(bus.execute("test:data", { data: "raw" })).rejects.toThrow(
        /No handler for 'test:data'/,
      );
    });
  });

  describe("Cancellation & Context Propagation", () => {
    it("should fail fast if the AbortSignal is already aborted", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:empty">();
      const controller = new AbortController();
      controller.abort();

      bus.register("test:empty", handler);

      await expect(bus.execute("test:empty", {}, { signal: controller.signal })).rejects.toThrow(
        /cancelled: Signal already aborted/,
      );

      expect(handler.handle).not.toHaveBeenCalled();
    });

    it("should pass the AbortSignal down to the handler options", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:other">();
      const controller = new AbortController();
      const payload = { userId: "u1", action: "save" };

      bus.register("test:other", handler);
      await bus.execute("test:other", payload, { signal: controller.signal });

      expect(handler.handle).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });
});
