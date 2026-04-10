import {
  ApiResponse,
  ApiResponseMeta,
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
  public ok<T extends SerialisableApiResponseTypes>(
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

  public okPaginated<T extends SerialisableApiResponseTypes>(
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

  public created<T extends SerialisableApiResponseTypes>(
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

  public accepted(req: Request, res: Response): Response {
    if (req.id) {
      res.setHeader("X-Request-Id", req.id);
    }
    return res.sendStatus(202);
  }

  public serviceUnavailable<T extends SerialisableApiResponseTypes>(
    req: Request,
    res: Response,
    data: T,
  ): Response {
    return res
      .status(503)
      .json(createSuccessResponse(data, { requestId: req.id }));
  }
}
