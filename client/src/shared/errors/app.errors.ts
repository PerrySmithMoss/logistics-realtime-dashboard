import { ErrorCode } from "./error-codes";
import { ErrorDetails } from "./error.types";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
    public readonly details?: ErrorDetails[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  static isAppError(err: unknown): err is AppError {
    return err instanceof AppError;
  }
}

export class InternalServerError extends AppError {
  constructor(cause?: unknown) {
    super(
      "An unexpected error occurred",
      ErrorCode.InternalServerError,
      500,
      false,
      undefined,
      { cause },
    );
  }
}
