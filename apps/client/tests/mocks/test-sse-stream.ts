import { HttpResponse } from "msw";

export class TestSseStream {
  private readonly encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private readonly connected: Promise<void>;
  private resolveConnected!: () => void;

  constructor() {
    this.connected = new Promise<void>((resolve) => {
      this.resolveConnected = resolve;
    });
  }

  public createResponse() {
    return new HttpResponse(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          this.controller = controller;
          controller.enqueue(this.encoder.encode(": connected\n\n"));
          this.resolveConnected();
        },
        cancel: () => {
          this.controller = null;
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
      },
    );
  }

  public async waitUntilConnected() {
    await this.connected;
  }

  public emit(eventName: string, payload: unknown) {
    this.controller?.enqueue(
      this.encoder.encode(
        `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
      ),
    );
  }

  public close() {
    this.controller?.close();
    this.controller = null;
  }
}
