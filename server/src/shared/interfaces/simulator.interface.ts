export interface ISimulator {
  initialise(ids: string[]): void;
  start(): void;
  stop(): void;
  heartbeat(source: string): void;
}
