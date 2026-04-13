import { InternalServerError } from "@shared/errors/app.errors";
import { IQueryHandler } from "@shared/interfaces/query-bus.interface";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryBus } from "../query-bus";

interface TestRegistry {
  "test:get-data": {
    request: { id: string };
    response: { data: string };
  };
  "test:other": {
    request: { filter: string };
    response: string[];
  };
}

describe("QueryBus", () => {
  const setup = (result?: unknown) => {
    const bus = new QueryBus<TestRegistry>();

    const createMockHandler = <K extends keyof TestRegistry>() =>
      ({
        handle: vi.fn().mockResolvedValue(result ?? { data: "success" }),
      }) as IQueryHandler<TestRegistry[K]["request"], TestRegistry[K]["response"]>;

    return { bus, createMockHandler };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("should allow registering a valid query handler", () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:get-data">();

      expect(() => bus.register("test:get-data", handler)).not.toThrow();
    });

    it("should throw InternalServerError when registering a duplicate handler", () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:get-data">();

      bus.register("test:get-data", handler);

      expect(() => bus.register("test:get-data", handler)).toThrow(InternalServerError);
      expect(() => bus.register("test:get-data", handler)).toThrow(/already registered/);
    });
  });

  describe("ask", () => {
    it("should route the query to the correct handler and return the result", async () => {
      const { bus, createMockHandler } = setup({ data: "success" });
      const handler = createMockHandler<"test:get-data">();
      const params = { id: "123" };

      bus.register("test:get-data", handler);
      const result = await bus.ask("test:get-data", params);

      expect(handler.handle).toHaveBeenCalledWith(params, {});
      expect(result).toEqual({ data: "success" });
    });

    it("should throw InternalServerError if no handler is registered", async () => {
      const { bus } = setup();

      await expect(bus.ask("test:get-data", { id: "1" })).rejects.toThrow(InternalServerError);
    });
  });

  describe("Cancellation & AbortSignal", () => {
    it("should throw InternalServerError if the signal is already aborted", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:get-data">();
      const controller = new AbortController();
      controller.abort();

      bus.register("test:get-data", handler);

      await expect(
        bus.ask("test:get-data", { id: "1" }, { signal: controller.signal }),
      ).rejects.toThrow(/cancelled: Signal already aborted/);

      expect(handler.handle).not.toHaveBeenCalled();
    });

    it("should pass the AbortSignal through to the handler's options", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:get-data">();
      const controller = new AbortController();
      const signal = controller.signal;

      bus.register("test:get-data", handler);

      await bus.ask("test:get-data", { id: "1" }, { signal });

      expect(handler.handle).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal }),
      );
    });

    it("should default to an empty object for options", async () => {
      const { bus, createMockHandler } = setup();
      const handler = createMockHandler<"test:get-data">();

      bus.register("test:get-data", handler);
      await bus.ask("test:get-data", { id: "1" });

      expect(handler.handle).toHaveBeenCalledWith(expect.anything(), {});
    });
  });
});
