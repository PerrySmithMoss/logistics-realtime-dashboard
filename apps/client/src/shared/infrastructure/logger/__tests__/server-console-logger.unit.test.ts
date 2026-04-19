import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConsoleLogger } from "../server-console-logger";

describe("ServerConsoleLogger", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it("writes structured JSON outside development", () => {
    const logger = new ServerConsoleLogger({ isDev: false, level: "DEBUG" }, "Fleet");

    logger.warn("stream degraded", { status: 503 });

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const entry = String(stdoutWrite.mock.calls[0][0]).trim();
    expect(entry).toContain('"lvl":"WARN"');
    expect(entry).toContain('"ctx":"FLEET"');
    expect(entry).toContain('"msg":"stream degraded"');
  });

  it("writes pretty output in development and sends errors to stderr", () => {
    const logger = new ServerConsoleLogger({ isDev: true, level: "DEBUG" }, "Fleet");

    logger.error("stream failed", new Error("socket closed"));

    expect(stderrWrite).toHaveBeenCalledTimes(1);
    expect(String(stderrWrite.mock.calls[0][0])).toContain("[FLEET]");
    expect(String(stderrWrite.mock.calls[0][0])).toContain("stream failed");
    expect(String(stderrWrite.mock.calls[0][0])).toContain("socket closed");
  });

  it("returns a nested logger from withContext", () => {
    const logger = new ServerConsoleLogger({ isDev: false, level: "DEBUG" }, "Fleet");
    const childLogger = logger.withContext("Proxy");

    childLogger.warn("upstream slow");

    expect(String(stdoutWrite.mock.calls[0][0])).toContain('"ctx":"FLEET:PROXY"');
  });
});
