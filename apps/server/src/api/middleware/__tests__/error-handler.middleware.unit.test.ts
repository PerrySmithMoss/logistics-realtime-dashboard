import {
  createMockConfig,
  createMockLogger,
  createMockRequest,
  createMockResponse,
} from "@shared/testing/test-utils";
import {
  AppError,
  AppErrorCodes,
  ServiceUnavailableError,
} from "../../../shared/errors/app.errors";
import { createErrorHandler } from "../error-handler.middleware";

describe("error-handler middleware", () => {
  const setup = (overrides: { isDev?: boolean } = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T13:00:00Z"));

    const logger = createMockLogger();
    const config = createMockConfig({
      server: {
        port: 5570,
        host: "localhost",
        env: "test",
        isProd: false,
        isDev: overrides.isDev ?? true,
        isTest: true,
        minLogLevel: "DEBUG",
        internalAuthSecret: "test-secret-at-least-32-chars-long-for-validity",
      },
    });

    return {
      logger,
      config,
      req: createMockRequest({
        method: "POST",
        path: "/vehicles/123",
      }),
      res: createMockResponse(),
      next: vi.fn(),
      middleware: createErrorHandler(logger, config),
    };
  };

  it("returns the app error payload, sets retry headers, and logs 4xx app errors as warnings", () => {
    const { middleware, logger, req, res, next } = setup();
    const error = new ServiceUnavailableError(
      "Busy",
      [
        {
          code: "SYSTEM_STATE",
          path: "status",
          value: "STARTING",
          message: "The status is currently STARTING",
        },
      ],
      15,
    );

    middleware(error, req, res, next);

    expect(logger.error).toHaveBeenCalledWith(
      "[SERVICE_UNAVAILABLE] POST /vehicles/123",
      expect.objectContaining({
        requestId: "test-request-id-123",
        message: "Busy",
        code: AppErrorCodes.ServiceUnavailable,
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "15");
    expect(res.status).toHaveBeenCalledWith(503);

    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: AppErrorCodes.ServiceUnavailable,
        message: "Busy",
        statusCode: 503,
        details: [
          expect.objectContaining({
            path: "status",
            value: "STARTING",
          }),
        ],
      },
      meta: {
        requestId: "test-request-id-123",
        path: "/vehicles/123",
        retryAfter: 15,
        timestamp: "2026-04-12T13:00:00.000Z",
      },
    });
    expect(body.error.stack).toBeTypeOf("string");
  });

  it("normalises unknown throwables into a 500 response and logs them as errors", () => {
    const { middleware, logger, req, res, next } = setup({ isDev: false });

    middleware("socket exploded", req, res, next);

    expect(logger.critical).toHaveBeenCalledWith(
      "[INTERNAL_SERVER_ERROR] POST /vehicles/123",
      expect.objectContaining({
        message: "socket exploded",
        code: AppErrorCodes.InternalServerError,
      }),
    );

    expect(res.status).toHaveBeenCalledWith(500);
    // ... rest of test
  });

  it("logs 4xx AppErrors as 'warn' and 5xx/Unknown as 'error'", () => {
    const { middleware, logger, req, res, next } = setup();
    const badRequest = new AppError("Bad", AppErrorCodes.BadRequest, 400);

    middleware(badRequest, req, res, next);

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    vi.clearAllMocks();

    const serverError = new AppError("Boom", AppErrorCodes.InternalServerError, 500);
    middleware(serverError, req, res, next);
    expect(logger.error).toHaveBeenCalled();
  });

  it("hides stack traces in non-development environments", () => {
    const { middleware, req, res, next } = setup({ isDev: false });
    const error = new Error("Secret details");

    middleware(error, req, res, next);

    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.error.stack).toBeUndefined();
  });

  it("handles null or undefined errors gracefully", () => {
    const { middleware, req, res, next } = setup();

    expect(() => middleware(null, req, res, next)).not.toThrow();

    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.error.message).toBe("Internal Server Error");
  });

  it("correctly identifies AppError vs standard Error for status codes", () => {
    const { middleware, res, req, next } = setup();
    const genericError = new Error("Simple error");

    middleware(genericError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.error.code).toBe(AppErrorCodes.InternalServerError);
  });
});
