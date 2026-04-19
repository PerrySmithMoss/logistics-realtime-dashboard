import { InternalServerError, UnprocessableEntityError } from "@shared/errors/app.errors";
import { createMockRequest } from "@shared/testing/test-utils/request.utils";
import { createMockResponse } from "@shared/testing/test-utils/response.utils";
import { z } from "zod";
import { getValidatedRequestData, validateRequest } from "../validate-request.middleware";

describe("validateRequest", () => {
  const setup = () => {
    const next = vi.fn();
    const res = createMockResponse();

    return { next, res };
  };

  it("parses and stores validated body, params, and query data", () => {
    const { next, res } = setup();
    const middleware = validateRequest({
      params: z.object({
        vehicleId: z.string().min(1),
      }),
      query: z.object({
        page: z.coerce.number().int().min(1),
      }),
      body: z
        .object({
          enabled: z.boolean(),
        })
        .strict(),
    });

    const req = createMockRequest({
      params: { vehicleId: "V-101" },
      query: { page: "2" },
      body: { enabled: true },
    });

    middleware(req, res, next);

    expect(req.validated).toEqual({
      params: { vehicleId: "V-101" },
      query: { page: 2 },
      body: { enabled: true },
    });
    expect(Object.isFrozen(req.validated)).toBe(true);
    expect(next).toHaveBeenCalledWith();
  });

  it("throws an UnprocessableEntityError with field details when validation fails", () => {
    const { next, res } = setup();
    const middleware = validateRequest({
      params: z.object({
        vehicleId: z.string().min(1),
      }),
      body: z
        .object({
          lat: z.number().min(-90).max(90),
        })
        .strict(),
    });

    const req = createMockRequest({
      params: { vehicleId: "" },
      body: { lat: 120, extra: true },
    });

    expect(() => middleware(req, res, next)).toThrow(UnprocessableEntityError);

    try {
      middleware(req, res, next);
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityError);
      expect(error).toMatchObject({
        message: "Request validation failed",
        details: expect.arrayContaining([
          expect.objectContaining({
            path: "params.vehicleId",
          }),
          expect.objectContaining({
            path: "body.lat",
          }),
          expect.objectContaining({
            path: "body",
          }),
        ]),
      });
    }

    expect(next).not.toHaveBeenCalled();
  });
});

describe("getValidatedRequestData", () => {
  it("returns typed validated data when present", () => {
    const req = createMockRequest({
      validated: {
        params: { vehicleId: "V-101" },
        body: { lat: 51.5, lng: -0.12, status: "active" },
      },
    });

    const validated = getValidatedRequestData<{
      params: z.ZodObject<{ vehicleId: z.ZodString }>;
      body: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        status: z.ZodString;
      }>;
    }>(req);

    expect(validated.params.vehicleId).toBe("V-101");
    expect(validated.body.lat).toBe(51.5);
  });

  it("throws an InternalServerError when middleware data is missing", () => {
    const req = createMockRequest();

    expect(() => getValidatedRequestData(req)).toThrow(InternalServerError);
  });
});
