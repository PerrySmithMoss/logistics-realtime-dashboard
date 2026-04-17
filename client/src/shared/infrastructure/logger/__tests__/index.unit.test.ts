import { afterEach, describe, expect, it, vi } from "vitest";

describe("createLogger", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates a client logger in the browser", async () => {
    const clientCtor = vi.fn();
    const serverCtor = vi.fn();

    vi.doMock("../client-console-logger", () => ({
      ClientConsoleLogger: clientCtor,
    }));
    vi.doMock("../server-console-logger", () => ({
      ServerConsoleLogger: serverCtor,
    }));

    const { createLogger } = await import("../index");
    createLogger("Fleet");

    expect(clientCtor).toHaveBeenCalledWith({ isDev: false, level: "WARN" }, "Fleet");
    expect(serverCtor).not.toHaveBeenCalled();
  });

  it("creates a server logger when window is unavailable", async () => {
    const clientCtor = vi.fn();
    const serverCtor = vi.fn();
    const originalWindow = global.window;

    vi.doMock("../client-console-logger", () => ({
      ClientConsoleLogger: clientCtor,
    }));
    vi.doMock("../server-console-logger", () => ({
      ServerConsoleLogger: serverCtor,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).window;

    const { createLogger } = await import("../index");
    createLogger("Fleet");

    expect(serverCtor).toHaveBeenCalledWith({ isDev: false, level: "WARN" }, "Fleet");
    expect(clientCtor).not.toHaveBeenCalled();

    global.window = originalWindow;
  });
});
