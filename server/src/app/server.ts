import { Express } from "express";
import { Server, createServer } from "http";

export interface ServerConfig {
  port: number;
  env: string;
}

export class HttpServer {
  private server?: Server;

  constructor(private readonly app: Express) {}

  public start(config: ServerConfig): void {
    if (this.server) {
      console.warn("Server is already running.");
      return;
    }

    this.server = createServer(this.app);

    this.server = this.app.listen(config.port);

    this.server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${config.port} is already in use.`);
        process.exit(1);
      }
      throw error;
    });
  }

  public get isRunning(): boolean {
    return !!this.server && this.server.listening;
  }

  /**
   * Gracefully closes the server and drains connections
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();

      console.log("Closing HTTP server sockets...");

      if ("closeIdleConnections" in this.server) {
        (this.server as any).closeIdleConnections();
      }

      this.server.close((err) => {
        if (err) {
          console.error("Error closing server:", err);
          return reject(err);
        }

        this.server = undefined;
        console.log("HTTP server closed successfully.");
        resolve();
      });
    });
  }
}
