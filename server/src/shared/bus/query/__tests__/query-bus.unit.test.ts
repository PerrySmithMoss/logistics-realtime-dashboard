import { InternalServerError } from "@shared/errors/app.errors";
import { describe, expect, it, vi } from "vitest";
import { QueryBus } from "../query-bus";

describe("QueryBus", () => {
  const setup = () => {
    const bus = new QueryBus();

    const TEST_QUERY = "test.query" as any;
    const mockHandler = {
      handle: vi.fn().mockResolvedValue({ data: "success" }),
    };

    return { bus, mockHandler, TEST_QUERY };
  };

  describe("register", () => {
    it("should route the query to the correct handler and return the result", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      const params = { id: "123" };

      bus.register(TEST_QUERY, mockHandler);
      await bus.ask(TEST_QUERY, params);

      expect(mockHandler.handle).toHaveBeenCalledWith(
        params,
        expect.any(Object),
      );
    });

    it("should throw InternalServerError when registering a duplicate handler", () => {
      const { bus, mockHandler, TEST_QUERY } = setup();

      bus.register(TEST_QUERY, mockHandler);

      expect(() => bus.register(TEST_QUERY, mockHandler)).toThrow(
        InternalServerError,
      );
      expect(() => bus.register(TEST_QUERY, mockHandler)).toThrow(
        /already registered/,
      );
    });

    it("should be type-safe within this file only", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();

      bus.register(TEST_QUERY, mockHandler);
      const result = await bus.ask(TEST_QUERY, { id: "123" });

      expect(result.data).toBe("success");
    });
  });

  describe("ask", () => {
    it("should route the query to the correct handler and return the result", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      const params = { id: "123" };

      bus.register(TEST_QUERY, mockHandler);
      const result = await bus.ask(TEST_QUERY, params);

      expect(mockHandler.handle).toHaveBeenCalledWith(
        params,
        expect.any(Object),
      );
      expect(result).toEqual({ data: "success" });
    });

    it("should throw InternalServerError if no handler is registered", async () => {
      const { bus, TEST_QUERY } = setup();

      await expect(bus.ask(TEST_QUERY, { id: "1" })).rejects.toThrow(
        InternalServerError,
      );
    });
  });

  describe("Cancellation & AbortSignal", () => {
    it("should throw InternalServerError if the signal is already aborted", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      const controller = new AbortController();
      controller.abort();

      bus.register(TEST_QUERY, mockHandler);

      await expect(
        bus.ask(TEST_QUERY, { id: "1" }, { signal: controller.signal }),
      ).rejects.toThrow(/cancelled: Signal already aborted/);

      expect(mockHandler.handle).not.toHaveBeenCalled();
    });

    it("should allow the handler itself to handle the signal if passed through", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      bus.register(TEST_QUERY, mockHandler);

      await bus.ask(
        TEST_QUERY,
        { id: "1" },
        { signal: new AbortController().signal },
      );

      expect(mockHandler.handle).toHaveBeenCalled();
    });

    it("should pass the AbortSignal through to the handler's options", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      const controller = new AbortController();
      const signal = controller.signal;
      const params = { id: "1" };

      bus.register(TEST_QUERY, mockHandler);

      await bus.ask(TEST_QUERY, params, { signal });

      expect(mockHandler.handle).toHaveBeenCalledWith(
        params,
        expect.objectContaining({ signal }),
      );
    });

    it("should function correctly when no options/signal are provided", async () => {
      const { bus, mockHandler, TEST_QUERY } = setup();
      bus.register(TEST_QUERY, mockHandler);

      await bus.ask(TEST_QUERY, { id: "1" });

      expect(mockHandler.handle).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});
