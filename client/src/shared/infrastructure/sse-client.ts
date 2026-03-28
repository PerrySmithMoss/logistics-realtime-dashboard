export class SseClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, (event: MessageEvent) => void> = new Map();

  constructor(
    private readonly url: string,
    private readonly onError?: () => void,
  ) {}

  private connect() {
    if (this.eventSource) return;

    this.eventSource = new EventSource(this.url);

    this.listeners.forEach((wrapper, eventName) => {
      this.eventSource?.addEventListener(eventName, wrapper);
    });

    this.eventSource.onerror = () => {
      console.error("SSE Connection Lost. Cleaning up for retry...");
      this.disconnect();
      this.onError?.();
    };
  }

  public subscribe<T>(eventName: string, onData: (data: T) => void) {
    this.connect();

    const wrapper = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data);
        onData(parsedData);
      } catch (err) {
        console.error(`Failed to parse SSE [${eventName}] data:`, err);
      }
    };

    this.listeners.set(eventName, wrapper);
    this.eventSource?.addEventListener(eventName, wrapper);
  }

  public disconnect() {
    if (this.eventSource) {
      this.listeners.forEach((wrapper, eventName) => {
        this.eventSource?.removeEventListener(eventName, wrapper);
      });
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
