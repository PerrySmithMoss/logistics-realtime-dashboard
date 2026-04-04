export enum AppErrorCodes {
  NotFound = "NOT_FOUND",
  BadRequest = "BAD_REQUEST",
  Unauthorised = "UNAUTHORISED",
  UnprocessableEntity = "UNPROCESSABLE_ENTITY",
  FetchError = "FETCH_ERROR",
  HydrationFailed = "HYDRATION_FAILED",
  InternalServerError = "INTERNAL_SERVER_ERROR",
  ExternalServiceError = "EXTERNAL_SERVICE_ERROR",
  MissingIdentifier = "MISSING_IDENTIFIER",
  TooManyRequests = "TooManyRequests",
}

interface AppErrorDetails {
  field: string | null;
  issue: string;
  message: string;
  meta?: Record<string, unknown>;
}

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: AppErrorCodes,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly details?: AppErrorDetails[],
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
  constructor(
    message: string = "Unprocessable Entity",
    details?: AppErrorDetails[],
  ) {
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
    const normalizedCause = cause instanceof Error ? cause : undefined;

    super(
      message,
      AppErrorCodes.InternalServerError,
      500,
      isOperational,
      undefined,
      { cause: normalizedCause },
    );

    this.name = "InternalServerError";

    this.cause = cause;
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown, isOperational: boolean = true) {
    const normalizedCause = cause instanceof Error ? cause : undefined;

    super(
      `${service} request failed`,
      AppErrorCodes.ExternalServiceError,
      502,
      isOperational,
      undefined,
      { cause: normalizedCause },
    );

    this.name = "ExternalServiceError";

    this.cause = cause;
  }
}

export class FetchError extends AppError {
  constructor(
    message: string = "Request Failed",
    public readonly status: number,
    public readonly data?: any,
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
