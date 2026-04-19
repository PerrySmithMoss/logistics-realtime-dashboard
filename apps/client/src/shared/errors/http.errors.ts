import { AppError } from "./app.errors";
import { ErrorCode } from "./error-codes";
import { ErrorDetails } from "./error.types";

export class FetchError extends AppError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, ErrorCode.FetchError, status, true, undefined, options);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, options?: ErrorOptions) {
    super(`${resource} not found`, ErrorCode.NotFound, 404, true, undefined, options);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: ErrorDetails[], options?: ErrorOptions) {
    super(message, ErrorCode.BadRequest, 400, true, details, options);
  }
}

export class UnauthorisedError extends AppError {
  constructor(options?: ErrorOptions) {
    super("Authentication required", ErrorCode.Unauthorised, 401, true, undefined, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(options?: ErrorOptions) {
    super(
      "You do not have permission to perform this action",
      ErrorCode.Forbidden,
      403,
      true,
      undefined,
      options,
    );
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(details: ErrorDetails[], options?: ErrorOptions) {
    super("Validation failed", ErrorCode.UnprocessableEntity, 422, true, details, options);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown) {
    super(
      `External service error: ${service}`,
      ErrorCode.ExternalServiceError,
      502,
      true,
      undefined,
      { cause },
    );
  }
}
