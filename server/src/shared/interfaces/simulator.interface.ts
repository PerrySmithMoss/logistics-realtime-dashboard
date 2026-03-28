export interface ISimulator {
  start(): void;
  stop(): void;
  heartbeat(source: string): void;
}
