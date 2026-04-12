import { Response } from "express";
import { vi } from "vitest";

export const createMockResponse = (): Response => {
  const res = {} as any;

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res as Response;
};
