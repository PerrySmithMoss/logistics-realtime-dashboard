import {
  AppErrorCodes,
  ServiceUnavailableError,
} from "@shared/errors/app.errors";
import { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  ApiResponseOptions,
  ApiResponsePaginationMeta,
} from "../../types/response.types";
import { BaseController } from "../base.controller";

class MockController extends BaseController {
  constructor(options: ApiResponseOptions) {
    super(options);
  }

  public triggerOk(req: Request, res: Response, data: any, meta?: any) {
    return this.ok(req, res, data, meta);
  }

  public triggerOkPaginated(
    req: Request,
    res: Response,
    data: any[],
    pagination: ApiResponsePaginationMeta,
  ) {
    return this.okPaginated(req, res, data, pagination);
  }

  public triggerCreated(req: Request, res: Response, data: any, meta?: any) {
    return this.created(req, res, data, meta);
  }

  public triggerAccepted(res: Response) {
    return this.accepted(res);
  }

  public triggerNoContent(res: Response) {
    return this.noContent(res);
  }

  public triggerServiceUnavailable(
    data: string | Record<string, unknown>,
    retryAfterSeconds?: number,
  ) {
    return this.serviceUnavailable(data, retryAfterSeconds);
  }
}

type MockResponse = Partial<Response> & {
  status: any;
  json: any;
  setHeader: any;
  sendStatus: any;
};

describe("BaseController (Internal Infrastructure)", () => {
  const setup = (overrides: { req?: Partial<Request> } = {}) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00Z"));

    const mockReq = {
      id: "test-request-id-123",
      path: "/test-path",
      ...overrides.req,
    } as Request;

    const mockRes: MockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      sendStatus: vi.fn().mockReturnThis(),
    };

    const options: ApiResponseOptions = {
      apiVersion: "1.0.0",
      environment: "test",
      isDev: true,
    };

    const controller = new MockController(options);

    return {
      controller,
      mockReq,
      mockRes: mockRes as Response,
      options,
    };
  };

  describe("Success Responses", () => {
    it("should return 200 and formatted body for .ok()", () => {
      const { controller, mockReq, mockRes, options } = setup();
      const data = { fleetCount: 5 };

      controller.triggerOk(mockReq, mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          meta: expect.objectContaining({
            apiVersion: options.apiVersion,
            environment: options.environment,
            requestId: "test-request-id-123",
            timestamp: "2026-04-11T12:00:00.000Z",
          }),
        }),
      );
    });

    it("should return 201 and formatted body for .created()", () => {
      const { controller, mockReq, mockRes } = setup();
      const data = { id: "new-vehicle-001" };

      controller.triggerCreated(mockReq, mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data }),
      );
    });

    it("should handle pagination meta correctly in .okPaginated()", () => {
      const { controller, mockReq, mockRes, options } = setup();
      const data = [{ id: 1 }];
      const pagination: ApiResponsePaginationMeta = {
        total: 10,
        page: 1,
        limit: 1,
        totalPages: 10,
      };

      controller.triggerOkPaginated(mockReq, mockRes, data, pagination);

      const mockedJson = vi.mocked(mockRes.json);
      const jsonCall = mockedJson.mock.calls[0][0];

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ id: 1 }],
          error: null,
          meta: {
            apiVersion: options.apiVersion,
            environment: options.environment,
            path: "/test-path",
            requestId: "test-request-id-123",
            timestamp: "2026-04-11T12:00:00.000Z",
            pagination: {
              total: 10,
              page: 1,
              limit: 1,
              totalPages: 10,
            },
          },
        }),
      );
      expect(jsonCall.meta.pagination).toEqual(pagination);
    });

    it("should return status 202 with no json body for accepted", () => {
      const { controller, mockRes } = setup();

      controller.accepted(mockRes);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.sendStatus).toHaveBeenCalledWith(202);
    });

    it("should return status 204 with no json body for noContent", () => {
      const { controller, mockRes } = setup();

      controller.noContent(mockRes);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.sendStatus).toHaveBeenCalledWith(204);
    });

    it("should throw ServiceUnavailableError when called", () => {
      const { controller } = setup();

      expect(() => {
        controller.serviceUnavailable("System Maintenance", 3600);
      }).toThrow(ServiceUnavailableError);

      try {
        controller.serviceUnavailable("Maintenance", 60);
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          expect(error.statusCode).toBe(503);
          expect(error.retryAfterSeconds).toBe(60);
          expect(error.code).toBe(AppErrorCodes.ServiceUnavailable);
        }
      }
    });
  });

  describe("Utility Responses", () => {
    it("should fallback gracefully if req.id is missing", () => {
      const { controller, mockRes } = setup();
      const reqWithoutId = {} as Request;

      controller.triggerOk(reqWithoutId, mockRes, {});

      const mockedJson = vi.mocked(mockRes.json);
      const jsonCall = mockedJson.mock.calls[0][0];

      expect(jsonCall.meta.requestId).toBeUndefined();
    });
  });

  describe("Edge Cases & Security", () => {
    it("should handle missing request ID gracefully", () => {
      const { controller, mockReq, mockRes } = setup({
        req: { id: undefined },
      });

      controller.triggerOk(mockReq, mockRes, {});

      const body = (mockRes.json as any).mock.calls[0][0];
      expect(body.meta).toBeDefined();
      expect(body.meta.requestId).toBeUndefined();
    });

    it("should ensure the data passed in is not mutated by the controller", () => {
      const { controller, mockReq, mockRes } = setup();
      const inputData = { original: true };

      controller.triggerOk(mockReq, mockRes, inputData);

      const responseBody = (mockRes.json as any).mock.calls[0][0];

      expect(responseBody.data).not.toBe(inputData);
      expect(responseBody.data).toEqual(inputData);
    });

    it("should correctly handle array data in paginated responses", () => {
      const { controller, mockReq, mockRes } = setup();
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { total: 2, page: 1, limit: 10, totalPages: 1 };

      controller.triggerOkPaginated(mockReq, mockRes, data, pagination);

      const body = (mockRes.json as any).mock.calls[0][0];
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("should return a frozen response that cannot be mutated by middleware", () => {
      const { controller, mockReq, mockRes } = setup();
      controller.triggerOk(mockReq, mockRes, { a: 1 });

      const mockedBody = vi.mocked(mockRes.json);
      const responseBody = mockedBody.mock.calls[0][0];

      expect(Object.isFrozen(responseBody)).toBe(true);
      expect(Object.isFrozen(responseBody.meta)).toBe(true);
    });
  });
});
