import { Response } from "express";

export interface IFleetObserverService {
  addObserver(id: string, res: Response, callback: (stats: unknown) => void): void;
  removeObserver(id: string): void;
  // called by controller on each heartbeat tick
  keepAlive(): void;
}
