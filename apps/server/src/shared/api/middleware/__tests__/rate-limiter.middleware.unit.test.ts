import { InternalServerError, TooManyRequestsError } from "@shared/errors/app.errors";
import { createMockCache } from "@shared/testing/test-utils";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { rateLimiter, RateLimiterOptions } from "../rate-limiter.middleware";

describe("rateLimiter", () => {
  const setup = (usage = 1, middlewareOptions: Partial<RateLimiterOptions> = {}) => {
    const cache = createMockCache();
    cache.increment.mockResolvedValue(usage);

    const defaultOptions: RateLimiterOptions = {
      windowMs: 10_000,
      maxRequests: 3,
      keyPrefix: "rl",
    };

    const mergedOptions = { ...defaultOptions, ...middlewareOptions };

    return {
      cache,
      req: createMockRequest({ ip: "203.0.113.10", path: "/fleet/stream" }),
      res: createMockResponse(),
      next: vi.fn(),
      middleware: rateLimiter(cache, mergedOptions),
      options: mergedOptions,
    };
  };

  it("increments the request counter, sets rate limit headers, and calls next within the limit", async () => {
    const { middleware, cache, req, res, next } = setup(2);

    await middleware(req, res, next);

    expect(cache.increment).toHaveBeenCalledWith("rl:/fleet/stream:203.0.113.10", 10_000);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 3);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 10);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 1);
    expect(next).toHaveBeenCalledWith();
  });

  it("throws TooManyRequestsError and clamps the remaining header at zero once the limit is exceeded", async () => {
    const { middleware, req, res, next } = setup(4);

    await expect(middleware(req, res, next)).rejects.toThrow(TooManyRequestsError);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(next).not.toHaveBeenCalled();
  });

  it("throws InternalServerError when the client ip is unavailable", async () => {
    const { middleware, res, next } = setup();
    const req = createMockRequest({
      ip: undefined,
      path: "/fleet/stream",
    });

    await expect(middleware(req, res, next)).rejects.toThrow(InternalServerError);
  });

  it("allows a request when usage is exactly at the limit", async () => {
    const { middleware, req, res, next } = setup(3);

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(next).toHaveBeenCalled();
  });

  it("uses a custom key prefix when provided", async () => {
    const { middleware, cache, req, res, next } = setup(1, {
      keyPrefix: "api-gate",
    });

    await middleware(req, res, next);

    expect(cache.increment).toHaveBeenCalledWith("api-gate:/fleet/stream:203.0.113.10", 10_000);
  });

  it("handles cache connection errors by throwing InternalServerError", async () => {
    const { middleware, cache, req, res, next } = setup();
    cache.increment.mockRejectedValue(new Error("Redis Down"));

    await expect(middleware(req, res, next)).rejects.toThrow();
  });

  it("ensures X-RateLimit-Reset is calculated correctly in seconds", async () => {
    const { middleware, res, req, next } = setup(1, { windowMs: 5000 });

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 5);
  });
});
