export enum ErrorCode {
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
  CacheTypeMismatch = "CACHE_TYPE_MISMATCH",
  CacheKeyNotFound = "CACHE_KEY_NOT_FOUND"
}
