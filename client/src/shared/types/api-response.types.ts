export interface ApiResponseErrorDetails {
  /**
   * Internal error code.
   * (e.g.'INVALID_FORMAT', 'REQUIRED_FIELD', 'SYSTEM_STATE')
   */
  code: string;

  /**
   * Human readable description of the specific issue.
   * (e.g. 'The status is currently INITIALISING', 'Email is required')
   */
  message: string;

  /**
   * Location of the error in the request.
   * (Use dot-notation for nesting.)
   * (e.g. 'status', 'user.email', 'metadata.fleetId')
   */
  path: string | null;

  /**
   * The value that caused the issue.
   */
  value?: unknown;

  /**
   * Extra context specific to this one detail.
   */
  meta?: Record<string, unknown>;
}

export interface ApiResponseError {
  message: string;
  code: string;
  statusCode: number;
  details?: ApiResponseErrorDetails[];
  // should only be accessible in development
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
} & Record<string, unknown>; // allow for custom metadata

export type ApiResponseMeta = ApiResponseContext & {
  environment?: string; // should only show in development
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
