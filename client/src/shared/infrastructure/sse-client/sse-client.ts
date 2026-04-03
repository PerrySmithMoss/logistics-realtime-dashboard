import { createLogger } from "../logger";

type SseErrorHandler = () => void;

const logger = createLogger("SSeClient");

export class SseClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, (event: MessageEvent) => void> = new Map();

  constructor(
    private readonly url: string,
    private readonly onError?: SseErrorHandler,
  ) {}

  private connect() {
    if (this.eventSource) {
      if (
        this.eventSource.readyState === EventSource.OPEN ||
        this.eventSource.readyState === EventSource.CONNECTING
      )
        return;
    }

    logger.debug("Initializing SSE connection", { url: this.url });
    this.eventSource = new EventSource(this.url);

    this.listeners.forEach((handler, eventName) => {
      this.eventSource?.addEventListener(eventName, handler);
    });

    this.eventSource.onopen = () => {
      logger.debug("SSE Connection established");
    };

    this.eventSource.onerror = () => {
      logger.error("SSE Connection error/interruption", {
        readyState: this.eventSource?.readyState,
      });

      this.onError?.();
    };
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

    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      this.eventSource.addEventListener(eventName, handler);
    } else {
      this.connect();
    }
  }

  public disconnect(): void {
    if (!this.eventSource) return;

    logger.debug("Manually closing SSE connection");

    this.listeners.forEach((handler, eventName) => {
      this.eventSource?.removeEventListener(eventName, handler);
    });

    this.eventSource.close();
    this.eventSource = null;
  }
}
