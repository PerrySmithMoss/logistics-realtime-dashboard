import { Response } from "express";

export interface IFleetObserverService {
  addObserver(
    id: string,
    res: Response,
    callback: (stats: unknown) => void,
  ): void;
  removeObserver(id: string): void;
}
