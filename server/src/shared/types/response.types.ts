export interface ApiResponseErrorDetails {
  field: string | null;
  issue: string;
  message: string;
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

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiResponseError | null;
  meta?: ApiResponseMeta;
}
