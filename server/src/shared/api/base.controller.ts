import {
  ApiResponse,
  ApiResponseMeta,
  ApiResponsePaginationMeta,
} from "@shared/types/response.types";
import { createSuccessResponse } from "@shared/utils/response.utils";
import { Request, Response } from "express";

// omitting system-managed fields which are handled elsewhere
type ResponseMeta = Omit<
  Partial<ApiResponseMeta>,
  "requestId" | "timestamp" | "pagination"
>;

export abstract class BaseController {
  public ok<T>(
    req: Request,
    res: Response<ApiResponse<T>>,
    data: T,
    meta?: ResponseMeta,
  ): Response<ApiResponse<T>> {
    return res.status(200).json(
      createSuccessResponse(data, {
        ...meta,
        requestId: req.id,
      }),
    );
  }

  public okPaginated<T>(
    req: Request,
    res: Response<ApiResponse<T[]>>,
    data: T[],
    pagination: ApiResponsePaginationMeta,
    extraMeta?: ResponseMeta,
  ): Response<ApiResponse<T[]>> {
    return res.status(200).json(
      createSuccessResponse(data, {
        ...extraMeta,
        pagination,
        requestId: req.id,
      }),
    );
  }

  public created<T>(
    req: Request,
    res: Response<ApiResponse<T>>,
    data: T,
    meta?: ResponseMeta,
  ): Response<ApiResponse<T>> {
    return res.status(201).json(
      createSuccessResponse(data, {
        ...meta,
        requestId: req.id,
      }),
    );
  }

  public noContent(res: Response): Response {
    return res.sendStatus(204);
  }

  public accepted(res: Response, requestId?: string): Response {
    const id = requestId || (res.req as Request).id;
    if (id) {
      res.setHeader("X-Request-Id", id);
    }
    return res.sendStatus(202);
  }

  public serviceUnavailable<T>(req: Request, res: Response, data: T): Response {
    return res
      .status(503)
      .json(createSuccessResponse(data, { requestId: req.id }));
  }
}
