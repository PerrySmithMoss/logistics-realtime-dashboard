import { Response } from "express";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

export type MockSseResponse = Response &
  EventEmitter & {
    headersWritten?: Record<string, string | number>;
    writable: boolean;
    writableEnded: boolean;
    destroyed: boolean;
    closed: boolean;
    socket: { destroyed: boolean };
  };

export const createMockSseResponse = (): MockSseResponse => {
  const emitter = new EventEmitter();

  // 1. Keep state in a simple object
  const state = {
    writable: true,
    writableEnded: false,
    destroyed: false,
    closed: false,
    socket: { destroyed: false },
    headersWritten: undefined as Record<string, string | number> | undefined,
  };

  const container = { proxy: {} as MockSseResponse };

  const handlers: Partial<Record<keyof MockSseResponse, unknown>> = {
    status: vi.fn().mockImplementation(() => container.proxy),
    json: vi.fn().mockImplementation(() => container.proxy),
    setHeader: vi.fn().mockImplementation(() => container.proxy),
    writeHead: vi.fn().mockImplementation(function (
      this: MockSseResponse,
      _s: number,
      h: Record<string, string>,
    ) {
      state.headersWritten = h;
      return container.proxy;
    }),
    write: vi.fn().mockReturnValue(true),
    end: vi.fn().mockImplementation(function (this: MockSseResponse) {
      state.writableEnded = true;
      state.writable = false;
      state.destroyed = true;
      state.closed = true;
      state.socket.destroyed = true;
      return container.proxy;
    }),
    flushHeaders: vi.fn(),
  };

  container.proxy = new Proxy(emitter, {
    get(target, prop, receiver) {
      // Avoid Promise/Vitest traps
      if (prop === "then" || prop === "asymmetricMatch" || typeof prop === "symbol") {
        return undefined;
      }

      // 💡 NEW: Self-reference check. If someone asks for the underlying emitter
      if (prop === "getEventEmitter") return target;

      // Check state
      if (Object.prototype.hasOwnProperty.call(state, prop)) {
        return Reflect.get(state, prop);
      }

      // Check handlers
      if (Object.prototype.hasOwnProperty.call(handlers, prop)) {
        return handlers[prop as keyof typeof handlers];
      }

      // Check EventEmitter methods
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(target);
      }

      // 💡 CHANGE: Return a mock that returns the receiver to maintain chaining
      return vi.fn().mockReturnValue(receiver);
    },

    set(target, prop, value, receiver) {
      if (Object.prototype.hasOwnProperty.call(state, prop)) {
        return Reflect.set(state, prop, value);
      }
      return Reflect.set(target, prop, value, receiver);
    },
  }) as unknown as MockSseResponse;

  return container.proxy;
};
