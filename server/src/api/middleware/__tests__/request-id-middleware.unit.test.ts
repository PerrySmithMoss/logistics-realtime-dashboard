import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { requestIdMiddleware } from "../request-id-middleware";

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "generated-request-id"),
}));

describe("request-id middleware", () => {
  const setup = (headers: Record<string, string | string[]> = {}) => {
    return {
      req: createMockRequest({ headers }),
      res: createMockResponse(),
      next: vi.fn(),
    };
  };

  it("reuses a valid incoming request id", () => {
    const { req, res, next } = setup({
      "x-request-id": "incoming-id",
    });

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe("incoming-id");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", "incoming-id");
    expect(next).toHaveBeenCalledWith();
  });

  it("generates a request id when the incoming header is missing", () => {
    const { req, res, next } = setup();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe("generated-request-id");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", "generated-request-id");
    expect(next).toHaveBeenCalledWith();
  });

  it("generates a request id when the incoming header is invalid", () => {
    const { req, res } = setup({
      "x-request-id": "x".repeat(100),
    });

    requestIdMiddleware(req, res, vi.fn());

    expect(req.id).toBe("generated-request-id");
  });

  it("trims whitespace from incoming request IDs", () => {
    const { req, res, next } = setup({ "x-request-id": "  padded-id  " });

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe("padded-id");
  });

  it("takes the first ID if an array of headers is provided", () => {
    const { req, res, next } = setup({
      "x-request-id": ["first-id", "second-id"],
    });

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe("first-id");
  });

  it("generates a new ID if the incoming header is just whitespace", () => {
    const { req, res, next } = setup({ "x-request-id": "   " });

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe("generated-request-id");
  });

  it("ensures the ID is attached to both the request object and response headers", () => {
    const { req, res, next } = setup();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.id);
  });
});
