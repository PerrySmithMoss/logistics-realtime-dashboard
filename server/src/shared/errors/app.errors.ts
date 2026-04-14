import { ApiResponseErrorDetails } from "@shared/types/response.types";

export enum AppErrorCodes {
  // app
  NotFound = "NOT_FOUND",
  BadRequest = "BAD_REQUEST",
  Unauthorised = "UNAUTHORISED",
  Forbidden = "FORBIDDEN",
  UnprocessableEntity = "UNPROCESSABLE_ENTITY",
  FetchError = "FETCH_ERROR",
  HydrationFailed = "HYDRATION_FAILED",
  InternalServerError = "INTERNAL_SERVER_ERROR",
  ExternalServiceError = "EXTERNAL_SERVICE_ERROR",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  MissingIdentifier = "MISSING_IDENTIFIER",
  TooManyRequests = "TOO_MANY_REQUESTS",

  // cache
  CacheTypeMismatch = "CACHE_TYPE_MISMATCH",
  CacheKeyNotFound = "CACHE_KEY_NOT_FOUND",
}

// App errors

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: AppErrorCodes,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly details?: ApiResponseErrorDetails[],
    public readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, AppErrorCodes.NotFound, 404);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, AppErrorCodes.BadRequest, 400);
    this.name = "BadRequestError";
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = "Unprocessable Entity", details?: ApiResponseErrorDetails[]) {
    super(message, AppErrorCodes.UnprocessableEntity, 422, true, details);
    this.name = "UnprocessableEntityError";
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal Server Error",
    cause?: unknown,
    isOperational: boolean = true,
  ) {
    const normalisedCause = cause instanceof Error ? cause : undefined;

    super(message, AppErrorCodes.InternalServerError, 500, isOperational, undefined, undefined, {
      cause: normalisedCause,
    });

    this.name = "InternalServerError";
    this.cause = cause;
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown, isOperational: boolean = true) {
    const normalisedCause = cause instanceof Error ? cause : undefined;

    super(
      `${service} request failed`,
      AppErrorCodes.ExternalServiceError,
      502,
      isOperational,
      undefined,
      undefined,
      { cause: normalisedCause },
    );

    this.name = "ExternalServiceError";
    this.cause = cause;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service temporarily unavailable",
    details?: ApiResponseErrorDetails[],
    retryAfterSeconds?: number,
  ) {
    super(message, AppErrorCodes.ServiceUnavailable, 503, true, details, retryAfterSeconds);
    this.name = "ServiceUnavailableError";
  }
}

export class FetchError extends AppError {
  constructor(
    message: string = "Request Failed",
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message, AppErrorCodes.FetchError, status);
    this.name = "FetchError";
  }

  public getDetails() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      data: this.data,
      stack: this.stack,
    };
  }
}

export class UnauthorisedError extends AppError {
  constructor(message: string = "Unauthorised access") {
    super(message, AppErrorCodes.Unauthorised, 401);
    this.name = "UnauthorisedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Permission denied") {
    super(message, AppErrorCodes.Forbidden, 403);
    this.name = "ForbiddenError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = "Too many requests, please try again later.",
    public readonly retryAfter?: number,
  ) {
    super(message, AppErrorCodes.TooManyRequests, 429, true, undefined, retryAfter);
    this.name = "TooManyRequestsError";
  }
}

// Cache errors

export class CacheTypeError extends AppError {
  constructor(key: string, expected: string, actual: string) {
    super(
      `Cache type mismatch for key "${key}": expected ${expected}, but found ${actual}`,
      AppErrorCodes.CacheTypeMismatch,
      500,
    );
    this.name = "CacheTypeError";
  }
}
