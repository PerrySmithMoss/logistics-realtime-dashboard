import { Request } from "express";
import { EventEmitter } from "node:events";

export const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  const socket = Object.assign(new EventEmitter(), {
    destroyed: false,
  });

  return Object.assign(new EventEmitter(), {
    id: "test-request-id-123",
    params: {},
    query: {},
    body: {},
    headers: {},
    path: "/test-path",
    method: "GET",
    aborted: false,
    destroyed: false,
    socket,
    ...overrides,
  }) as Request;
};
