import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError } from "../../types/response.types";
import { createErrorResponse, createSuccessResponse } from "../response.utils";

const mockRequestId = "req-123";
const mockContext = { requestId: mockRequestId };
const mockDate = new Date("2026-03-09T12:00:00Z");

describe("Response Utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createSuccessResponse", () => {
    it("should create a successful response object with data", () => {
      const data = { id: 1, name: "Test Item" };
      const response = createSuccessResponse(data, mockContext);

      expect(response).toEqual({
        success: true,
        data,
        error: null,
        meta: {
          requestId: mockRequestId,
          timestamp: mockDate.toISOString(),
        },
      });
    });

    it("should handle null data correctly", () => {
      const response = createSuccessResponse(null, mockContext);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it("should include pagination in meta when provided", () => {
      const pagination = { total: 100, page: 1, limit: 10, totalPages: 10 };
      const response = createSuccessResponse([], {
        ...mockContext,
        pagination,
      });

      expect(response.meta.pagination).toEqual(pagination);
    });

    it("should allow extra meta data while preserving default fields", () => {
      const extraMeta = { version: "v1", traceId: "trace-abc" };
      const response = createSuccessResponse(
        { foo: "bar" },
        {
          ...mockContext,
          ...extraMeta,
        },
      );

      expect(response.meta).toMatchObject({
        requestId: mockRequestId,
        version: "v1",
        traceId: "trace-abc",
      });
    });

    it("should ensure the default timestamp overwrites any provided meta timestamp", () => {
      const response = createSuccessResponse({}, {
        ...mockContext,
        timestamp: "1970-01-01T00:00:00Z",
      } as any);

      expect(response.meta.timestamp).toBe(mockDate.toISOString());
      expect(response.meta.timestamp).not.toBe("1970-01-01T00:00:00Z");
    });

    it("should produce a valid JSON stringifyable object", () => {
      const response = createSuccessResponse({ a: 1 }, mockContext);
      const json = JSON.parse(JSON.stringify(response));

      expect(json.success).toBe(true);
      expect(json.meta.timestamp).toBe(mockDate.toISOString());
    });
  });

  describe("createErrorResponse", () => {
    const mockError: ApiResponseError = {
      message: "Validation Failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      stack: "Error: at source.ts:10:5",
      details: [{ field: "email", issue: "invalid", message: "Invalid email" }],
    };

    it("should create a standard error response object", () => {
      // Pass 'true' so the matcher works with the stack trace included in mockError
      const response = createErrorResponse(mockError, mockContext, true);

      expect(response).toEqual({
        success: false,
        data: null,
        error: mockError,
        meta: {
          requestId: mockRequestId,
          timestamp: mockDate.toISOString(),
        },
      });
    });

    it("should hide the stack trace when isDev is false", () => {
      const response = createErrorResponse(mockError, mockContext, false);
      expect(response.error).not.toHaveProperty("stack");
    });

    it("should include the stack trace when isDev is true", () => {
      const response = createErrorResponse(mockError, mockContext, true);
      expect(response.error?.stack).toBe("Error: at source.ts:10:5");
    });

    it("should include stack traces in meta or error when provided", () => {
      const errorWithStack = {
        ...mockError,
        stack: "Error: at source.ts:10:5",
      };
      const response = createErrorResponse(errorWithStack, mockContext, true);

      expect(response.error?.stack).toBeDefined();
      expect(response.error?.stack).toContain("source.ts");
    });

    it("should handle custom error meta data like retryAfter", () => {
      const response = createErrorResponse(
        mockError,
        {
          ...mockContext,
          retryAfter: 60,
        },
        false,
      );

      expect(response.meta.retryAfter).toBe(60);
    });
  });

  describe("Immutability (Freeze)", () => {
    it("should prevent mutation of the success response and its meta", () => {
      const response = createSuccessResponse({ foo: "bar" }, mockContext);

      // Top level freeze
      expect(() => {
        (response as any).success = false;
      }).toThrow(TypeError);

      // Nested level freeze (meta)
      expect(() => {
        (response.meta as any).requestId = "new-id";
      }).toThrow(TypeError);
    });

    it("should prevent mutation of the error response and its error details", () => {
      const mockError: ApiResponseError = {
        message: "Fail",
        code: "ERR",
        statusCode: 500,
      };
      const response = createErrorResponse(mockError, mockContext, false);

      expect(() => {
        (response.error as any).message = "Hack";
      }).toThrow(TypeError);

      expect(() => {
        (response.meta as any).requestId = "new-id";
      }).toThrow(TypeError);
    });

    it("should not maintain a reference to the input meta object (Defensive Copying)", () => {
      const inputMeta = { requestId: "123" };
      const response = createSuccessResponse({ val: 1 }, inputMeta);

      expect(response.meta).not.toBe(inputMeta);

      expect(() => {
        inputMeta.requestId = "changed";
      }).not.toThrow();
    });
  });
});
