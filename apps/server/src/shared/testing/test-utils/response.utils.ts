import { Response } from "express";
import { Mocked, vi } from "vitest";

export const createMockResponse = (): Response => {
  const res = {} as Mocked<Response>;

  res.statusCode = 200;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.getHeader = vi.fn();
  res.removeHeader = vi.fn();
  res.header = vi.fn().mockReturnValue(res);
  res.vary = vi.fn().mockReturnValue(res);

  return res as Response;
};
