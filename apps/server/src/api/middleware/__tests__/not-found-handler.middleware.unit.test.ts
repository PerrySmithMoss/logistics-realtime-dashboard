import { AppErrorCodes, NotFoundError } from "@shared/errors/app.errors";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { Response } from "express";
import { notFoundHandler } from "../not-found-handler.middleware";

describe("notFoundHandler", () => {
  it("forwards a NotFoundError with the correct metadata", () => {
    const req = createMockRequest({
      method: "PATCH",
      originalUrl: "/api/vehicles/missing",
    });

    const res = {} as Response;
    const next = vi.fn();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0] as NotFoundError;

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(AppErrorCodes.NotFound);
    expect(error.message).toBe("PATCH /api/vehicles/missing not found");
  });

  it("handles the error message format correctly based on the class implementation", () => {
    const req = createMockRequest({
      method: "GET",
      originalUrl: "Resource",
    });
    const next = vi.fn();

    notFoundHandler(req, {} as Response, next);

    const error = next.mock.calls[0][0] as NotFoundError;
    expect(error.message).toBe("GET Resource not found");
  });
});
