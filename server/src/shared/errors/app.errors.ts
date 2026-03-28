export enum AppErrorCodes {
  NotFound = "NOT_FOUND",
  BadRequest = "BAD_REQUEST",
  UnprocessableEntity = "UNPROCESSABLE_ENTITY",
  InternalServerError = "INTERNAL_SERVER_ERROR",
  ExternalServiceError = "EXTERNAL_SERVICE_ERROR",
  FetchError = "FETCH_ERROR",
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
  constructor(message: string = "Internal Server Error", cause?: Error) {
    super(message, AppErrorCodes.InternalServerError, 500, true);
    this.name = "InternalServerError";
    this.cause = cause;
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: Error) {
    super(
      `${service} request failed`,
      AppErrorCodes.ExternalServiceError,
      502,
      true,
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
