export interface ApiResponseDetails {
  field: string | null;
  issue: string;
  message: string;
  meta?: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    message: string;
    code: string;
    details?: ApiResponseDetails[];
  } | null;
  meta?: {
    requestId?: string;
    timestamp: string;
    pagination?: {
      total: number;
      page: number;
      limit: number;
    };
    [key: string]: any;
  };
}
