import { ApiResponse, ApiResponseMeta } from "@shared/types/response.types";
import { Response } from "express";

export abstract class BaseController {
  private envelope<T, M extends ApiResponseMeta>(
    data: T,
    meta?: M,
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      error: null,
      ...(meta && {
        meta: {
          timestamp: new Date().toISOString(),
          ...meta,
        },
      }),
    };
  }

  public ok<T, M extends ApiResponseMeta>(
    res: Response,
    data: T,
    meta?: M,
  ): Response {
    return res.status(200).json(this.envelope(data, meta));
  }

  public created<T, M extends ApiResponseMeta>(
    res: Response,
    data: T,
    meta?: M,
  ): Response {
    return res.status(201).json(this.envelope(data, meta));
  }

  public accepted(res: Response, requestId?: string): Response {
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }
    return res.sendStatus(202);
  }
}
