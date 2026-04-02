export enum ErrorCode {
  // App errors
  InternalServerError = "INTERNAL_SERVER_ERROR",

  //   Http errors
  NotFound = "NOT_FOUND",
  BadRequest = "BAD_REQUEST",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  UnprocessableEntity = "UNPROCESSABLE_ENTITY",
  FetchError = "FETCH_ERROR",
  HydrationFailed = "HYDRATION_FAILED",
  ExternalServiceError = "EXTERNAL_SERVICE_ERROR",
}
