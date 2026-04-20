export interface ApiResponseErrorDetails {
  code: string;
  message: string;
  path: string | null;
  value?: unknown;
  meta?: Record<string, unknown>;
}

export interface ApiResponseError {
  message: string;
  code: string;
  statusCode: number;
  details?: ApiResponseErrorDetails[];
  stack?: string;
}

export interface ApiResponsePaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponseOptions {
  apiVersion: string;
  environment: string;
  isDev: boolean;
}

export type ApiResponseContext = {
  requestId: string;
  path?: string;
  retryAfter?: number;
  pagination?: ApiResponsePaginationMeta;
} & Record<string, unknown>;

export type ApiResponseMeta = ApiResponseContext & {
  environment?: string;
  apiVersion: string;
  timestamp: string;
};

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
      meta: ApiResponseMeta;
    }
  | {
      success: false;
      data: null;
      error: ApiResponseError;
      meta: ApiResponseMeta;
    };

export type SerialisableApiResponseTypes =
  | string
  | number
  | boolean
  | null
  | unknown
  | { [key: string]: SerialisableApiResponseTypes }
  | SerialisableApiResponseTypes[];
