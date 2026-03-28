import { Express } from "express";
import { Server } from "http";
import { IServer } from "./interfaces/server.interface";

export interface ServerConfig {
  port: number;
  env: string;
}

export class HttpServer implements IServer {
  private server?: Server;

  constructor(private readonly app: Express) {}

  public start(config: ServerConfig): Promise<void> {
    if (this.server) {
      console.warn("Server is already running.");
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(config.port, () => {
        resolve();
      });

      this.server.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(`❌ Port ${config.port} is already in use.`);
          return reject(error);
        }
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();

      console.log("Shutting down HTTP server...");

      if ("closeIdleConnections" in this.server) {
        this.server.closeIdleConnections();
      }

      this.server.close((err) => {
        if (err) return reject(err);

        this.server = undefined;

        console.log("HTTP server closed.");
        resolve();
      });
    });
  }

  public get isRunning(): boolean {
    return !!this.server && this.server.listening;
  }
}
