import { Request } from "express";

export const createMockRequest = (
  overrides: Partial<Request> = {},
): Request => {
  return {
    id: "test-request-id-123",
    params: {},
    query: {},
    body: {},
    headers: {},
    path: "/test-path",
    method: "GET",
    ...overrides,
  } as Request;
};
