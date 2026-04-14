import { AppError, ErrorCode } from "@/shared/errors";

export const getFriendlyErrorMessage = (error: Error): string => {
  if (!AppError.isAppError(error)) return "Something went wrong.";

  switch (error.code) {
    case ErrorCode.NotFound:
      return "That resource doesn't exist.";
    case ErrorCode.Unauthorised:
      return "You need to sign in.";
    case ErrorCode.Forbidden:
      return "You don't have access to this.";
    case ErrorCode.ExternalServiceError:
      return "Unable to reach an external service.";
    case ErrorCode.InternalServerError:
      return "Something went wrong on our end.";
    default:
      return error.message;
  }
};
