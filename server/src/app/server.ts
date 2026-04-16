import { ILogger } from "@shared/interfaces/logger.interface";
import { Express } from "express";
import { Server } from "http";
import { IServer } from "./interfaces/server.interface";

export interface ServerConfig {
  port: number;
  env: string;
}

export class HttpServer implements IServer {
  private server?: Server;

  constructor(
    private readonly app: Express,
    private readonly logger: ILogger,
  ) {}

  public start(config: ServerConfig): Promise<void> {
    if (this.server) {
      this.logger.warn("Server is already running.");
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(config.port, () => {
        resolve();
      });

      this.server.on("error", (error: NodeJS.ErrnoException) => {
        const messages: Record<string, string> = {
          EADDRINUSE: `Port ${config.port} is already in use.`,
          EACCES: `Insufficient permissions to bind to port ${config.port}.`,
        };

        const message = error.code
          ? (messages[error.code] ?? `Server error: ${error.code}`)
          : "Unknown server error";

        this.logger.error(message, { code: error.code, port: config.port });
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();

      this.logger.info("Shutting down HTTP server...");

      if ("closeIdleConnections" in this.server) {
        this.server.closeIdleConnections();
      }

      this.server.close((err) => {
        if (err) return reject(err);

        this.server = undefined;

        this.logger.info("HTTP server closed.");
        resolve();
      });
    });
  }

  public get isRunning(): boolean {
    return !!this.server && this.server.listening;
  }
}
