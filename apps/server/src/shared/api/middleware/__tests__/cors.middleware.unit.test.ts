import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { describe, expect, it, vi } from "vitest";
import { corsMiddleware } from "../cors.middleware";

describe("corsMiddleware", () => {
  const allowedOrigins = ["http://localhost:3000"];

  it("sets CORS headers for allowed origins", () => {
    const req = createMockRequest({
      method: "GET",
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    corsMiddleware(allowedOrigins)(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "http://localhost:3000",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Vary", "Origin");
    expect(next).toHaveBeenCalledWith();
  });

  it("does not set CORS headers for disallowed origins", () => {
    const req = createMockRequest({
      method: "GET",
      headers: {
        origin: "https://evil.example",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    corsMiddleware(allowedOrigins)(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(null);
  });

  it("short-circuits OPTIONS preflight requests", () => {
    const req = createMockRequest({
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    corsMiddleware(allowedOrigins)(req, res, next);

    expect(res.statusCode).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Length", "0");
    expect(res.end).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalled();
  });
});
