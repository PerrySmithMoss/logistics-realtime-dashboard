import { InternalServerError, TooManyRequestsError } from "@shared/errors/app.errors";
import {
  createMockCache,
  createMockLogger,
  createMockSseResponse,
} from "@shared/testing/test-utils";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { sseRateLimiter, SseRateLimiterOptions } from "../sse-rate-limiter.middleware";

describe("sseRateLimiter", () => {
  const setup = (middlewareOptions: SseRateLimiterOptions = {}) => {
    const logger = createMockLogger();
    const cache = createMockCache();

    const defaultOptions = { maxConcurrent: 2, minRetryMs: 2_000 };
    const mergedOptions = { ...defaultOptions, ...middlewareOptions };

    return {
      logger,
      cache,
      req: createMockRequest({
        ip: "198.51.100.22",
        path: "/fleet/stream",
      }),
      res: createMockSseResponse(),
      next: vi.fn(),
      middleware: sseRateLimiter(logger, cache, mergedOptions),
    };
  };

  it("admits a connection, records the retry window, and cleans up the counter once the stream closes", async () => {
    const { middleware, cache, req, res, next } = setup();

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 2);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 2);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 1);
    expect(cache.set).toHaveBeenCalledWith("sse:retry:/fleet/stream:198.51.100.22", true, 2_000);
    expect(cache.increment).toHaveBeenCalledWith("sse:count:/fleet/stream:198.51.100.22", 86400000);

    res.emit("close");

    await vi.waitFor(() => {
      expect(cache.decrement).toHaveBeenCalledWith(
        "sse:count:/fleet/stream:198.51.100.22",
        86400000,
      );
      expect(cache.delete).toHaveBeenCalledWith("sse:count:/fleet/stream:198.51.100.22");
    });

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects clients that reconnect before the retry window expires", async () => {
    const { middleware, cache, req, res, next } = setup();
    cache.seed("sse:retry:/fleet/stream:198.51.100.22", true, 2_000);

    await expect(middleware(req, res, next)).rejects.toThrow(TooManyRequestsError);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects clients when the concurrent connection limit is reached", async () => {
    const { middleware, cache, req, res, next } = setup();
    cache.seed("sse:count:/fleet/stream:198.51.100.22", 2, 10_000);

    await expect(middleware(req, res, next)).rejects.toThrow(TooManyRequestsError);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(next).not.toHaveBeenCalled();
  });

  it("throws InternalServerError when the request ip is unavailable", async () => {
    const { middleware, res, next } = setup();
    const req = createMockRequest({
      ip: undefined,
      path: "/fleet/stream",
    });

    await expect(middleware(req, res, next)).rejects.toThrow(InternalServerError);
  });

  it("logs cleanup errors from close handlers without surfacing them to the client", async () => {
    const { middleware, cache, logger, req, res } = setup();
    cache.decrement.mockRejectedValueOnce(new Error("cleanup failed"));

    await middleware(req, res, vi.fn());
    res.emit("close");

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith("SSE Cleanup Error", expect.any(Error));
    });
  });

  it("uses custom error messages when provided in options", async () => {
    const customMessage = "Stop right there!";
    const { cache, req, res, next } = setup();

    const customMiddleware = sseRateLimiter(createMockLogger(), cache, {
      maxConcurrent: 1,
      errorMessageResponses: { concurrencyErrorMessage: customMessage },
    });

    cache.seed("sse:count:/fleet/stream:198.51.100.22", 1, 10_000);

    await expect(customMiddleware(req, res, next)).rejects.toThrow(customMessage);
  });

  it("only decrements the counter once even if both close and finish events fire", async () => {
    const { middleware, cache, req, res, next } = setup();

    await middleware(req, res, next);

    res.emit("close");
    res.emit("finish");

    await vi.waitFor(() => {
      expect(cache.decrement).toHaveBeenCalledTimes(1);
    });
  });

  it("handles the case where the count key is deleted if remaining reaches zero", async () => {
    const { middleware, cache, req, res, next } = setup();
    cache.decrement.mockResolvedValue(0);

    await middleware(req, res, next);
    res.emit("close");

    await vi.waitFor(() => {
      expect(cache.delete).toHaveBeenCalledWith("sse:count:/fleet/stream:198.51.100.22");
    });
  });

  it("rejects clients when the concurrent connection limit is reached", async () => {
    const { middleware, cache, req, res, next } = setup();

    cache.increment.mockResolvedValue(3);

    await expect(middleware(req, res, next)).rejects.toThrow(TooManyRequestsError);

    expect(cache.decrement).toHaveBeenCalledWith("sse:count:/fleet/stream:198.51.100.22", 86400000);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
  });
});
