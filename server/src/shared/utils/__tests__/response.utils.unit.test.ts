import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiResponseError,
  ApiResponseOptions,
} from "../../types/response.types";
import { createErrorResponse, createSuccessResponse } from "../response.utils";

const mockRequestId = "req-123";
const mockContext = { requestId: mockRequestId };
const mockDate = new Date("2026-03-09T12:00:00Z");
const mockOptions: ApiResponseOptions = {
  apiVersion: "1.0.0",
  environment: "test",
  isDev: true,
};

describe("Response Utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createSuccessResponse", () => {
    it("should create a successful response with data and global options", () => {
      const data = { id: 1 };
      // Pass the third argument: mockOptions
      const response = createSuccessResponse(data, mockContext, mockOptions);

      expect(response).toEqual({
        success: true,
        data,
        error: null,
        meta: {
          requestId: mockRequestId,
          timestamp: mockDate.toISOString(),
          apiVersion: "1.0.0",
          environment: "test",
        },
      });
    });

    it("should handle deep cloning to ensure data immutability", () => {
      const data = { nested: { val: 1 } };
      const response = createSuccessResponse(data, mockContext, mockOptions);

      // Ensure it's not the same reference
      expect(response.data).not.toBe(data);
      expect(response.data?.nested).not.toBe(data.nested);
    });

    it("should handle null data correctly", () => {
      const response = createSuccessResponse(null, mockContext, mockOptions);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it("should include pagination in meta when provided", () => {
      const pagination = { total: 100, page: 1, limit: 10, totalPages: 10 };
      const response = createSuccessResponse(
        [],
        {
          ...mockContext,
          pagination,
        },
        mockOptions,
      );

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
        mockOptions,
      );

      expect(response.meta).toMatchObject({
        requestId: mockRequestId,
        version: "v1",
        traceId: "trace-abc",
      });
    });

    it("should ensure the default timestamp overwrites any provided meta timestamp", () => {
      const response = createSuccessResponse(
        {},
        {
          ...mockContext,
          timestamp: "1970-01-01T00:00:00Z",
        } as any,
        mockOptions,
      );

      expect(response.meta.timestamp).toBe(mockDate.toISOString());
      expect(response.meta.timestamp).not.toBe("1970-01-01T00:00:00Z");
    });

    it("should produce a valid JSON stringifyable object", () => {
      const response = createSuccessResponse(
        { a: 1 },
        mockContext,
        mockOptions,
      );
      const json = JSON.parse(JSON.stringify(response));

      expect(json.success).toBe(true);
      expect(json.meta.timestamp).toBe(mockDate.toISOString());
    });
  });

  describe("createErrorResponse", () => {
    const mockError: ApiResponseError = {
      message: "Fail",
      code: "ERR",
      statusCode: 500,
      stack: "Error stack at source.ts",
    };

    it("should create a standard error response object", () => {
      const response = createErrorResponse(mockError, mockContext, mockOptions);

      expect(response).toEqual({
        success: false,
        data: null,
        error: {
          code: mockError.code,
          message: mockError.message,
          statusCode: mockError.statusCode,
          details: mockError.details,
          stack: mockError.stack,
        },
        meta: {
          requestId: mockRequestId,
          timestamp: mockDate.toISOString(),
          apiVersion: mockOptions.apiVersion,
          environment: mockOptions.environment,
        },
      });
    });

    it("should hide the stack trace when options.isDev is false", () => {
      const response = createErrorResponse(mockError, mockContext, {
        ...mockOptions,
        isDev: false,
      });

      expect(response.error).not.toHaveProperty("stack");
    });

    it("should include the stack trace when options.isDev is true", () => {
      const response = createErrorResponse(mockError, mockContext, {
        ...mockOptions,
        isDev: true,
      });

      expect(response.error?.stack).toBe(mockError.stack);
    });

    it("should include stack traces in meta or error when provided", () => {
      const errorWithStack = {
        ...mockError,
        stack: "Error: at source.ts:10:5",
      };
      const response = createErrorResponse(
        errorWithStack,
        mockContext,
        mockOptions,
      );

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
        mockOptions,
      );

      expect(response.meta.retryAfter).toBe(60);
    });
  });

  describe("Immutability (Freeze)", () => {
    it("should prevent mutation of the success response and its meta", () => {
      const response = createSuccessResponse(
        { foo: "bar" },
        mockContext,
        mockOptions,
      );

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
      const response = createErrorResponse(mockError, mockContext, mockOptions);

      expect(() => {
        (response.error as any).message = "Hack";
      }).toThrow(TypeError);

      expect(() => {
        (response.meta as any).requestId = "new-id";
      }).toThrow(TypeError);
    });

    it("should not maintain a reference to the input meta object (Defensive Copying)", () => {
      const inputMeta = { requestId: "123" };
      const response = createSuccessResponse(
        { val: 1 },
        inputMeta,
        mockOptions,
      );

      expect(response.meta).not.toBe(inputMeta);

      expect(() => {
        inputMeta.requestId = "changed";
      }).not.toThrow();
    });
  });
});
