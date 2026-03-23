export interface IServer {
  start(config: { port: number; env: string }): void;
  stop(): Promise<void>;
  readonly isRunning: boolean;
}
