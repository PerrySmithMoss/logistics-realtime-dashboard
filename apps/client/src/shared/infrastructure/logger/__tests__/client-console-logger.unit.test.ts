import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSOLE_LOGGER_MAP } from "../logger.constants";
import { ClientConsoleLogger } from "../client-console-logger";

describe("ClientConsoleLogger", () => {
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const critical = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    CONSOLE_LOGGER_MAP.DEBUG = debug;
    CONSOLE_LOGGER_MAP.INFO = info;
    CONSOLE_LOGGER_MAP.WARN = warn;
    CONSOLE_LOGGER_MAP.ERROR = error;
    CONSOLE_LOGGER_MAP.CRITICAL = critical;
  });

  it("writes logs at or above the configured level", () => {
    const logger = new ClientConsoleLogger({ isDev: true, level: "WARN" }, "Fleet");

    logger.debug("skip");
    logger.info("skip");
    logger.warn("warn");
    logger.error("error");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Fleet]"), "warn");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("[Fleet]"), "error");
  });

  it("suppresses debug and info logs outside development", () => {
    const logger = new ClientConsoleLogger({ isDev: false, level: "DEBUG" }, "Fleet");

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("serialises Error objects and supports nested contexts", () => {
    const logger = new ClientConsoleLogger({ isDev: true, level: "DEBUG" }, "Fleet");
    const childLogger = logger.withContext("Map");

    childLogger.error("boom", new Error("Map failed"));

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[Fleet:Map]"),
      "boom",
      expect.objectContaining({
        name: "Error",
        message: "Map failed",
      }),
    );
  });

  it("serialises nested Error objects inside payloads", () => {
    const logger = new ClientConsoleLogger({ isDev: true, level: "DEBUG" }, "Fleet");

    logger.error("stream failed", {
      error: new Error("socket closed"),
      meta: { attempt: 2 },
    });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[Fleet]"),
      "stream failed",
      expect.objectContaining({
        error: expect.objectContaining({
          name: "Error",
          message: "socket closed",
        }),
        meta: { attempt: 2 },
      }),
    );
  });

  it("guards against circular references while normalising payloads", () => {
    const logger = new ClientConsoleLogger({ isDev: true, level: "DEBUG" }, "Fleet");
    const payload: { self?: unknown; nested?: { loop?: unknown } } = {};
    payload.self = payload;
    payload.nested = { loop: payload };

    logger.error("circular", payload);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[Fleet]"),
      "circular",
      expect.objectContaining({
        self: "[Circular]",
        nested: expect.objectContaining({
          loop: "[Circular]",
        }),
      }),
    );
  });
});
