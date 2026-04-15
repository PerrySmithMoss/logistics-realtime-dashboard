import { ExternalServiceError, FetchError, InternalServerError } from "@shared/errors/app.errors";
import { exponentialBackoff, getErrorData, mergeAbortSignals } from "@shared/utils";

export interface HttpClientOptions extends RequestInit {
  timeout?: number;
  transform?: boolean;
  retries?: number;
  initialRetryDelay?: number;
  allowRetry?: boolean;
  label?: string;
}

export const httpClient = async <T>(
  url: string,
  {
    timeout = 5500,
    transform = false,
    retries = 2,
    initialRetryDelay = 1000,
    allowRetry = false,
    label = "HTTP_Request",
    ...options
  }: HttpClientOptions = {},
): Promise<T | null> => {
  if (!url.startsWith("http")) {
    throw Error(`[httpClient] invalid url: ${url}`);
  }

  const method = options.method?.toUpperCase() || "GET";
  const isIdempotent = ["GET", "PUT", "DELETE", "HEAD"].includes(method);
  const canRetry = allowRetry || isIdempotent;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const signal = options.signal
      ? mergeAbortSignals([options.signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(url, {
        ...options,
        method,
        signal,
        headers: { "Content-Type": "application/json", ...options.headers },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await getErrorData(response);
        const status = response.status;

        throw new FetchError(`${label}: ${status}`, status, errorData);
      }

      if (response.status === 204 || response.status === 205) return null;

      const result = await response.json().catch(() => null);

      return transform && result?.data !== undefined ? result.data : result;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const error = err instanceof Error ? err : new Error(String(err));

      if (error.name === "AbortError") {
        if (options.signal?.aborted) throw error;

        if (attempt < retries && canRetry) {
          await exponentialBackoff(initialRetryDelay, attempt);
          continue;
        }
        throw new FetchError(`${label}: Gateway Timeout`, 504, { cause: error.message });
      }

      const isFetchError = error instanceof FetchError;
      const shouldRetry = canRetry && attempt < retries;

      if (!shouldRetry) {
        throw isFetchError ? error : new ExternalServiceError(label, error);
      }

      await exponentialBackoff(initialRetryDelay, attempt);
    }
  }

  throw new InternalServerError("Retry loop exhausted");
};
