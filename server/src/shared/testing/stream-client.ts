import { IncomingMessage, request as httpRequest } from "node:http";
import { vi } from "vitest";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sleepOrAdvance = async (ms: number) => {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(ms);
    return;
  }

  await sleep(ms);
};

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
}

export interface StreamClientOptions {
  baseUrl: string;
  path?: string;
  headers?: Record<string, string>;
  forwardedFor?: string;
}

export class StreamClient {
  private readonly events: SseEvent[] = [];
  private readonly closeListeners = new Set<() => void>();
  private readonly requestHeaders: Record<string, string>;

  private req: ReturnType<typeof httpRequest> | null = null;
  private res: IncomingMessage | null = null;
  private buffer = "";
  private bodyBuffer = "";
  private heartbeatCount = 0;
  private closed = false;

  public statusCode?: number;
  public responseHeaders: Record<string, string | string[] | undefined> = {};

  constructor(private readonly options: StreamClientOptions) {
    this.requestHeaders = { ...(options.headers ?? {}) };

    if (options.forwardedFor) {
      this.requestHeaders["x-forwarded-for"] = options.forwardedFor;
    }
  }

  public get parsedEvents() {
    return [...this.events];
  }

  public get heartbeats() {
    return this.heartbeatCount;
  }

  public get responseBody() {
    return this.bodyBuffer;
  }

  public async open(): Promise<void> {
    if (this.req) return;

    await new Promise<void>((resolve, reject) => {
      const targetUrl = new URL(this.options.path ?? "/api/v1/fleet/stream", this.options.baseUrl);

      this.req = httpRequest(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          method: "GET",
          headers: this.requestHeaders,
        },
        (res) => {
          this.res = res;
          this.statusCode = res.statusCode;
          this.responseHeaders = res.headers;
          res.setEncoding("utf8");

          res.on("data", (chunk: string) => {
            if (res.statusCode !== 200) {
              this.bodyBuffer += chunk;
              return;
            }

            this.buffer += chunk;
            this.drainFrames();
          });

          res.once("close", () => {
            this.markClosed();
          });

          resolve();
        },
      );

      this.req.once("error", reject);
      this.req.end();
    });
  }

  public async waitForEvent<T = unknown>(
    eventName: string,
    predicate: (data: T) => boolean = () => true,
    timeoutMs = 2000,
  ): Promise<SseEvent<T>> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      for (const event of this.events) {
        if (event.event !== eventName) continue;
        if (!predicate(event.data as T)) continue;

        return event as SseEvent<T>;
      }

      await sleepOrAdvance(10);
    }

    throw new Error(`Timed out waiting for SSE event "${eventName}"`);
  }

  public async waitForHeartbeat(minCount = 1, timeoutMs = 2000): Promise<number> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.heartbeatCount >= minCount) {
        return this.heartbeatCount;
      }

      await sleepOrAdvance(10);
    }

    throw new Error(`Timed out waiting for ${minCount} heartbeat frame(s)`);
  }

  public async waitForClosed(timeoutMs = 1000): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.closed) {
        return;
      }

      await sleepOrAdvance(10);
    }

    throw new Error("Timed out waiting for stream closure");
  }

  public onClose(listener: () => void) {
    this.closeListeners.add(listener);
  }

  public async close(force = false): Promise<void> {
    if (this.closed) return;

    if (force) {
      this.req?.destroy();
      this.res?.destroy();
    } else {
      this.req?.destroy();
    }

    this.markClosed();
  }

  private markClosed() {
    if (this.closed) return;
    this.closed = true;

    for (const listener of this.closeListeners) {
      listener();
    }

    this.closeListeners.clear();
  }

  private drainFrames() {
    const normalised = this.buffer.replace(/\r\n/g, "\n");
    if (normalised !== this.buffer) {
      this.buffer = normalised;
    }

    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      if (frame === ":") {
        this.heartbeatCount++;
        boundary = this.buffer.indexOf("\n\n");
        continue;
      }

      const lines = frame.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines.filter((line) => line.startsWith("data:"));

      if (eventLine && dataLines.length > 0) {
        this.events.push({
          event: eventLine.slice("event:".length).trim(),
          data: JSON.parse(dataLines.map((line) => line.slice("data:".length).trim()).join("\n")),
        });
      }

      boundary = this.buffer.indexOf("\n\n");
    }
  }
}
