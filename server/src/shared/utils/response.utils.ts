import {
  ApiResponse,
  ApiResponseContext,
  ApiResponseError,
  ApiResponseMeta,
  ApiResponseOptions,
  SerialisableApiResponseTypes,
} from "../types/response.types";

const getCommonMeta = (
  context: ApiResponseContext,
  options: ApiResponseOptions,
): ApiResponseMeta => ({
  apiVersion: options.apiVersion,
  environment: options.environment,
  ...context,
  timestamp: new Date().toISOString(),
});

export const createSuccessResponse = <T extends SerialisableApiResponseTypes>(
  data: T,
  context: ApiResponseContext,
  options: ApiResponseOptions,
): Readonly<ApiResponse<T>> => {
  return Object.freeze({
    success: true,
    data: Object.freeze(structuredClone(data)),
    error: null,
    meta: Object.freeze(getCommonMeta(context, options)),
  });
};

export const createErrorResponse = (
  error: ApiResponseError,
  context: ApiResponseContext,
  options: ApiResponseOptions,
): Readonly<ApiResponse<null>> => {
  const formattedError: ApiResponseError = {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details?.length ? error.details : undefined,
  };

  if (options.isDev && error.stack) {
    formattedError.stack = error.stack;
  }

  return Object.freeze({
    success: false,
    data: null,
    error: Object.freeze(formattedError),
    meta: Object.freeze(getCommonMeta(context, options)),
  });
};
