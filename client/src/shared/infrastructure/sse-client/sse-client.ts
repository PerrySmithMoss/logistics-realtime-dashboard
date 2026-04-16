import { createLogger } from "../logger";

export interface SseConnectionErrorDetails {
  recoverable: boolean;
  status?: number;
}

type SseErrorHandler = (details: SseConnectionErrorDetails) => void;

class SseConnectionError extends Error {
  constructor(
    message: string,
    public readonly details: SseConnectionErrorDetails,
  ) {
    super(message);
    this.name = "SseConnectionError";
  }
}

const logger = createLogger("SSeClient");

export class SseClient {
  private listeners: Map<string, (event: MessageEvent) => void> = new Map();
  private abortController: AbortController | null = null;
  private streamPromise: Promise<void> | null = null;
  private didDisconnectManually = false;

  constructor(
    private readonly url: string,
    private readonly onError?: SseErrorHandler,
  ) {}

  private dispatchEvent(eventName: string, data: string): void {
    const listener = this.listeners.get(eventName);
    if (!listener) return;

    listener(new MessageEvent(eventName, { data }));
  }

  private parseChunk(buffer: string): string {
    const records = buffer.split(/\r?\n\r?\n/);
    const remainder = records.pop() ?? "";

    records.forEach((record) => {
      if (!record.trim()) return;

      let eventName = "message";
      const dataParts: string[] = [];

      record.split(/\r?\n/).forEach((line) => {
        if (!line || line.startsWith(":")) return;

        const separatorIndex = line.indexOf(":");
        const field =
          separatorIndex === -1 ? line : line.slice(0, separatorIndex);
        const value =
          separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).trimStart();

        if (field === "event") eventName = value || "message";
        if (field === "data") dataParts.push(value);
      });

      if (dataParts.length > 0) {
        this.dispatchEvent(eventName, dataParts.join("\n"));
      }
    });

    return remainder;
  }

  private async connect() {
    if (this.streamPromise) return;

    logger.debug("Initializing SSE connection", { url: this.url });
    this.didDisconnectManually = false;
    this.abortController = new AbortController();

    this.streamPromise = (async () => {
      try {
        const response = await fetch(this.url, {
          headers: {
            Accept: "text/event-stream",
          },
          cache: "no-store",
          signal: this.abortController?.signal,
        });

        if (!response.ok || !response.body) {
          throw new SseConnectionError(
            `SSE request failed with status ${response.status}`,
            {
              recoverable: ![401, 403].includes(response.status),
              status: response.status,
            },
          );
        }

        logger.debug("SSE Connection established");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;
          buffer = this.parseChunk(buffer + decoder.decode(value, { stream: true }));
        }

        buffer += decoder.decode();

        if (buffer.trim()) this.parseChunk(`${buffer}\n\n`);

        if (!this.didDisconnectManually) {
          throw new SseConnectionError("SSE stream closed unexpectedly", {
            recoverable: true,
          });
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError" &&
          this.didDisconnectManually
        ) {
          return;
        }

        logger.error("SSE Connection error/interruption", {
          error,
        });
        this.onError?.(
          error instanceof SseConnectionError
            ? error.details
            : { recoverable: true },
        );
      } finally {
        this.streamPromise = null;
        this.abortController = null;
      }
    })();
  }

  public subscribe<T>(eventName: string, onData: (data: T) => void): void {
    if (this.listeners.has(eventName)) {
      logger.warn(`Already subscribed to "${eventName}".`);
      return;
    }

    const handler = (event: MessageEvent): void => {
      try {
        onData(JSON.parse(event.data) as T);
      } catch (err) {
        logger.error(`Failed to parse "${eventName}" payload`, {
          err,
          raw: event.data,
        });
      }
    };

    this.listeners.set(eventName, handler);
    void this.connect();
  }

  public disconnect(): void {
    if (!this.abortController && !this.streamPromise) return;

    logger.debug("Manually closing SSE connection");
    this.didDisconnectManually = true;
    this.abortController?.abort();
  }
}
