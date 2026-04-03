type SseErrorHandler = () => void;

export class SseClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, (event: MessageEvent) => void> = new Map();

  constructor(
    private readonly url: string,
    private readonly onError?: SseErrorHandler,
  ) {}

  private connect() {
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    this.eventSource = new EventSource(this.url);

    this.listeners.forEach((handler, eventName) => {
      this.eventSource?.addEventListener(eventName, handler);
    });

    this.eventSource.onerror = () => {
      console.error("[SseClient] Connection lost. Cleaning up for retry.");
      this.disconnect();
      this.onError?.();
    };
  }

  public subscribe<T>(eventName: string, onData: (data: T) => void): void {
    if (this.listeners.has(eventName)) {
      console.warn(
        `[SseClient] Already subscribed to "${eventName}". Skipping.`,
      );
      return;
    }

    const handler = (event: MessageEvent): void => {
      try {
        onData(JSON.parse(event.data) as T);
      } catch (err) {
        console.error(`[SseClient] Failed to parse event "${eventName}":`, err);
      }
    };

    this.listeners.set(eventName, handler);

    if (this.eventSource) {
      this.eventSource.addEventListener(eventName, handler);
    } else {
      this.connect();
    }
  }

  public disconnect(): void {
    if (!this.eventSource) return;

    this.listeners.forEach((handler, eventName) => {
      this.eventSource!.removeEventListener(eventName, handler);
    });

    this.eventSource.close();
    this.eventSource = null;
  }
}
