import {
  ApiResponse,
  ApiResponseContext,
  ApiResponseError,
  ApiResponseMeta,
  SerialisableApiResponseTypes,
} from "../types/response.types";

export const createSuccessResponse = <T extends SerialisableApiResponseTypes>(
  data: T,
  context: ApiResponseContext,
): ApiResponse<T> => {
  return Object.freeze({
    success: true,
    data,
    error: null,
    meta: Object.freeze({
      ...context,
      timestamp: new Date().toISOString(),
    }) as ApiResponseMeta,
  });
};

export const createErrorResponse = (
  error: ApiResponseError,
  context: ApiResponseContext,
  isDev: boolean,
): ApiResponse<null> => {
  const formattedError: ApiResponseError = Object.freeze({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    ...(isDev && { stack: error.stack }),
  });

  return Object.freeze({
    success: false,
    data: null,
    error: formattedError,
    meta: Object.freeze({
      ...context,
      timestamp: new Date().toISOString(),
    }) as ApiResponseMeta,
  });
};
