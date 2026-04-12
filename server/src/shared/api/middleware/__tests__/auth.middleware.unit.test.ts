import { UnauthorisedError } from "@shared/errors/app.errors";
import { createMockLogger } from "@shared/testing/test-utils";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { describe, expect, it, vi } from "vitest";
import { verifyServiceSecret } from "../auth.middleware";

describe("auth middleware", () => {
  describe("verifyServiceSecret", () => {
    const MOCKED_SECRET = "test-secret-123";

    const setup = () => {
      const mockLogger = createMockLogger();
      const middleware = verifyServiceSecret(mockLogger, {
        internalAuthSecret: MOCKED_SECRET,
      });
      const mockNext = vi.fn();
      return {
        logger: mockLogger,
        middleware,
        next: mockNext,
      };
    };

    it("should call next() when the correct secret is provided", () => {
      const { middleware, logger, next } = setup();
      const req = createMockRequest({
        headers: { "x-internal-secret": MOCKED_SECRET },
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should throw UnauthorisedError when the secret is missing", () => {
      const { middleware, logger, next } = setup();
      const req = createMockRequest({
        headers: {},
        ip: "127.0.0.1",
      });
      const res = createMockResponse();

      expect(() => middleware(req, res, next)).toThrow(UnauthorisedError);

      expect(next).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Auth] Failed attempt from 127.0.0.1. Missing header",
        ),
      );
    });

    it("should throw UnauthorisedError when the secret is incorrect", () => {
      const { middleware, logger, next } = setup();
      const req = createMockRequest({
        headers: { "x-internal-secret": "wrong-secret" },
      });
      const res = createMockResponse();

      expect(() => middleware(req, res, next)).toThrow(UnauthorisedError);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid value"),
      );
    });

    it("should throw UnauthorisedError if the secret has incorrect casing (if secret is case-sensitive)", () => {
      const { middleware, next } = setup();
      const req = createMockRequest({
        headers: { "x-internal-secret": MOCKED_SECRET.toUpperCase() }, // Assuming secrets are case-sensitive
      });
      const res = createMockResponse();

      expect(() => middleware(req, res, next)).toThrow(UnauthorisedError);
    });

    it("should not allow access if both the header and the configured secret are empty strings", () => {
      const mockLogger = createMockLogger();
      const middleware = verifyServiceSecret(mockLogger, {
        internalAuthSecret: "",
      });

      const req = createMockRequest({ headers: { "x-internal-secret": "" } });
      const res = createMockResponse();
      const next = vi.fn();

      expect(() => middleware(req, res, next)).toThrow(UnauthorisedError);
    });
  });
});
