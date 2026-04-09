import {
  ApiResponse,
  ApiResponseError,
  ApiResponseMeta,
} from "../types/response.types";

type Serialisable = object | any[] | string | number | boolean;

export type RequiredContext = Partial<ApiResponseMeta> & { requestId: string };

export const createSuccessResponse = <T extends Serialisable = null>(
  data: T | null = null,
  meta: RequiredContext,
): ApiResponse<T> => {
  return {
    success: true,
    data: data,
    error: null,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  };
};

export const createErrorResponse = (
  error: ApiResponseError,
  meta: RequiredContext,
): ApiResponse<null> => ({
  success: false,
  data: null,
  error,
  meta: {
    ...meta,
    timestamp: new Date().toISOString(),
  },
});
