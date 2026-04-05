import {
  ApiResponse,
  ApiResponseError,
  ApiResponseMeta,
} from "../types/response.types";

export const createSuccessResponse = <T>(
  data: T,
  meta?: ApiResponseMeta,
): ApiResponse<T> => ({
  success: true,
  data,
  error: null,
  meta: {
    timestamp: new Date().toISOString(),
    ...meta,
  },
});

export const createErrorResponse = (
  reqId: string,
  error: ApiResponseError,
  path?: string,
  retryAfter?: number,
): ApiResponse<null> => ({
  success: false,
  data: null,
  error,
  meta: {
    requestId: reqId,
    timestamp: new Date().toISOString(),
    path,
    ...(retryAfter && { retryAfterSeconds: retryAfter }),
  },
});
