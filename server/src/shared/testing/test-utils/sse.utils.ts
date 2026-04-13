import { Response } from "express";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

export type MockSseResponse = Response & {
  emit: (event: string) => boolean;
  writable: boolean;
  writableEnded: boolean;
  headersWritten?: Record<string, string | number>;
};

export const createMockSseResponse = (): MockSseResponse => {
  const emitter = new EventEmitter();
  const res = {} as MockSseResponse;

  res.writable = true;
  res.writableEnded = false;

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.writeHead = vi.fn().mockImplementation((_status, headers) => {
    res.headersWritten = headers as Record<string, string | number>;
    return res;
  });
  res.write = vi.fn().mockReturnValue(true);
  res.end = vi.fn().mockImplementation(() => {
    res.writableEnded = true;
    res.writable = false;
    return res;
  });
  res.on = vi.fn().mockImplementation((event: string, handler: () => void) => {
    emitter.on(event, handler);
    return res;
  });
  res.emit = (event: string) => emitter.emit(event);

  return res;
};
