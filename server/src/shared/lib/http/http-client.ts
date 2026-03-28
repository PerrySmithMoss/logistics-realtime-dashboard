import { FetchError } from "@shared/errors/app.errors";

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
    transform = true,
    retries = 2,
    initialRetryDelay = 1000,
    allowRetry = false,
    label = "HTTP_Request",
    ...options
  }: HttpClientOptions = {},
): Promise<T> => {
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
      ? AbortSignal.any([options.signal, controller.signal])
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
        const isClientError = response.status < 500 && response.status !== 408;

        if (isClientError || attempt === retries || !canRetry) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData?.message
            ? errorData?.message
            : `Request failed with ${response.status}`;
          throw new FetchError(
            `${label}: ${errorMsg}`,
            response.status,
            errorData,
          );
        }

        throw new Error(`Server Error ${response.status}`);
      }

      const result =
        response.status !== 204 && response.status !== 205
          ? await response.json().catch(() => null)
          : null;

      return transform ? result?.data : result;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError" && options.signal?.aborted) throw err;

      const isTimeout = err.name === "AbortError" && controller.signal.aborted;
      const isLastAttempt = attempt === retries;

      if (isLastAttempt || !canRetry) {
        if (err instanceof FetchError) throw err;
        throw new FetchError(
          `${label}: ${isTimeout ? "Timeout" : "Network Error"}`,
          isTimeout ? 408 : 500,
          { originalError: err.message },
        );
      }

      const delay = initialRetryDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Retry loop exhausted unexpectedly");
};
