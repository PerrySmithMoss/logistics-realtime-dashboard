export interface IServer {
  start(config: { port: number; env: string }): Promise<void>;
  stop(): Promise<void>;
  readonly isRunning: boolean;
}
