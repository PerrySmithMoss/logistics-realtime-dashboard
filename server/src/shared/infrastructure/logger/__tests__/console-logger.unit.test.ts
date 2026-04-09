import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleLogger } from "../console-logger";

describe("ConsoleLogger", () => {
  let stdoutSpy: any;
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Happy Paths & Level Filtering", () => {
    it("should log to stdout for INFO and stderr for ERROR", () => {
      const logger = new ConsoleLogger({ level: "DEBUG", isDev: true });

      logger.info("informational");
      expect(stdoutSpy).toHaveBeenCalled();

      logger.error("erroneous");
      expect(stderrSpy).toHaveBeenCalled();
    });

    it("should respect the minimum log level priority", () => {
      const logger = new ConsoleLogger({ level: "WARN", isDev: true });

      logger.debug("skipped");
      logger.warn("captured");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stdoutSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("captured"),
      );
    });

    it("should suppress DEBUG/INFO in production even if level is set to DEBUG", () => {
      const logger = new ConsoleLogger({ level: "DEBUG", isDev: false });

      logger.debug("hidden");
      logger.info("hidden");
      logger.warn("visible");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
      expect(output.lvl).toBe("WARN");
    });
  });

  describe("Context and Immutability", () => {
    it("should append context and return a new instance via withContext", () => {
      const logger = new ConsoleLogger({ level: "INFO", isDev: false }, "App");
      const childLogger = logger.withContext("Service");

      childLogger.warn("hello");

      expect(stdoutSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
      expect(output.ctx).toBe("App:Service");
      expect(childLogger).not.toBe(logger);
    });
  });

  describe("Formatting & Serialisation", () => {
    it("should output clean JSON in production mode", () => {
      const logger = new ConsoleLogger({ level: "INFO", isDev: false });
      const data = { userId: 123 };

      logger.warn("test message", data);

      expect(stdoutSpy).toHaveBeenCalled();

      const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
      expect(output).toEqual({
        ts: "2026-04-09T12:00:00.000Z",
        lvl: "WARN",
        ctx: "Global",
        msg: "test message",
        data: { userId: 123 },
      });
    });

    it("should include ANSI colors and pretty-print data in dev mode", () => {
      const logger = new ConsoleLogger({ level: "DEBUG", isDev: true });
      logger.debug("dev log", { foo: "bar" });

      const output = stdoutSpy.mock.calls[0][0];
      // Check for ANSI reset code
      expect(output).toContain("\x1b[0m");
      // check for indentation
      expect(output).toContain('  "foo": "bar"');
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should gracefully handle circular references in data", () => {
      const logger = new ConsoleLogger({ level: "INFO", isDev: false });
      const circular: any = {};
      circular.self = circular;

      logger.warn("oops", circular);

      expect(stdoutSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
      expect(output.data).toBe("[Circular Data or Stringify Error]");
    });

    it("should correctly serialize Error objects", () => {
      const logger = new ConsoleLogger({ level: "ERROR", isDev: false });
      const error = new Error("Database connection failed");

      logger.error("Failure", error);

      const output = JSON.parse(stderrSpy.mock.calls[0][0]);
      expect(output.data).toMatchObject({
        name: "Error",
        message: "Database connection failed",
        stack: expect.any(String),
      });
    });

    it("should handle undefined messages gracefully", () => {
      const logger = new ConsoleLogger({ level: "INFO", isDev: false });

      logger.warn(undefined);

      expect(stdoutSpy).toHaveBeenCalledTimes(1);

      const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
      expect(output.msg).toBe("No message provided");
    });
  });
  it("should format CRITICAL logs with background colors and route to stderr", () => {
    const logger = new ConsoleLogger({ level: "DEBUG", isDev: true });
    logger.critical("system failure");

    const output = stderrSpy.mock.calls[0][0];
    expect(output).toContain("\x1b[41m");
    expect(output).toContain("\x1b[1m");
    expect(output).toContain("CRITICAL");
  });

  it("should handle non-object data types gracefully (Dev Mode)", () => {
    const logger = new ConsoleLogger({ level: "INFO", isDev: true });

    logger.info("status check", 200);
    expect(stdoutSpy).toHaveBeenLastCalledWith(expect.stringContaining("200"));

    logger.info("nothingness", null);
    expect(stdoutSpy).toHaveBeenLastCalledWith(expect.stringContaining("null"));

    logger.info("active status", false);
    expect(stdoutSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("false"),
    );
  });

  it("should not throw when safeStringify fails (Hard Edge Case)", () => {
    const logger = new ConsoleLogger({ level: "INFO", isDev: true });

    const evilObject = {
      get foo() {
        throw new Error("Gotcha");
      },
    };

    // ensure the try/catch in safeStringify actually works
    expect(() => logger.info("testing evil object", evilObject)).not.toThrow();
    expect(stdoutSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("[Circular Data or Stringify Error]"),
    );
  });
});
