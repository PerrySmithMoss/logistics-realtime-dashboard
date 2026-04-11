import { ServiceUnavailableError } from "@shared/errors/app.errors";
import {
  ApiResponse,
  ApiResponseContext,
  ApiResponseErrorDetails,
  ApiResponseMeta,
  ApiResponseOptions,
  ApiResponsePaginationMeta,
  SerialisableApiResponseTypes,
} from "@shared/types/response.types";
import { createSuccessResponse } from "@shared/utils/response.utils";
import { Request, Response } from "express";

// Omitting fields which are adding further
// down the chain (middleware etc.).
type ResponseMeta = Omit<
  Partial<ApiResponseMeta>,
  "requestId" | "timestamp" | "pagination"
>;

export abstract class BaseController {
  constructor(protected readonly responseOptions: ApiResponseOptions) {}

  public ok<T extends SerialisableApiResponseTypes>(
    req: Request,
    res: Response<ApiResponse<T>>,
    data: T,
    meta?: ResponseMeta,
  ): Response<ApiResponse<T>> {
    const context: ApiResponseContext = {
      ...meta,
      requestId: req.id,
      path: req.path,
    };

    return res
      .status(200)
      .json(createSuccessResponse(data, context, this.responseOptions));
  }

  public okPaginated<T extends SerialisableApiResponseTypes>(
    req: Request,
    res: Response<ApiResponse<T[]>>,
    data: T[],
    pagination: ApiResponsePaginationMeta,
    extraMeta?: ResponseMeta,
  ): Response<ApiResponse<T[]>> {
    const context: ApiResponseContext = {
      ...extraMeta,
      pagination,
      requestId: req.id,
      path: req.path,
    };

    return res
      .status(200)
      .json(createSuccessResponse(data, context, this.responseOptions));
  }

  public created<T extends SerialisableApiResponseTypes>(
    req: Request,
    res: Response<ApiResponse<T>>,
    data: T,
    meta?: ResponseMeta,
  ): Response<ApiResponse<T>> {
    const context: ApiResponseContext = {
      ...meta,
      requestId: req.id,
      path: req.path,
    };

    return res
      .status(201)
      .json(createSuccessResponse(data, context, this.responseOptions));
  }

  public accepted(res: Response): Response {
    return res.sendStatus(202);
  }

  public noContent(res: Response): Response {
    return res.sendStatus(204);
  }

  public serviceUnavailable(
    data: string | Record<string, unknown>,
    retryAfterSeconds?: number,
  ): never {
    const isString = typeof data === "string";
    const message = isString ? data : "Service temporarily unavailable";

    const details: ApiResponseErrorDetails[] = !isString
      ? Object.entries(data).map(([key, value]) => ({
          code: "SYSTEM_STATE",
          path: key,
          value: value,
          message: `The ${key} is currently ${value}`,
        }))
      : [];

    throw new ServiceUnavailableError(message, details, retryAfterSeconds);
  }
}
