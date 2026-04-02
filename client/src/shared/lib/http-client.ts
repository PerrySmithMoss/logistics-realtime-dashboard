import { ExternalServiceError, FetchError } from "../errors";

export interface HttpClientOptions extends RequestInit {
  timeout?: number;
  transform?: boolean;
  retries?: number;
  initialRetryDelay?: number;
  allowRetry?: boolean;
  label?: string;
  params?: Record<string, string>;
}

// Per-instance defaults set at creation time
export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  initialRetryDelay?: number;
  defaultHeaders?: Record<string, string>;
}

const IDEMPOTENT_METHODS = new Set(["GET", "PUT", "DELETE", "HEAD"]);

const resolveUrl = (
  base: string,
  path: string,
  params?: Record<string, string>,
): string => {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, base);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  return url.toString();
};

const request = async <T>(
  url: string,
  instanceConfig: Required<
    Omit<HttpClientConfig, "baseUrl" | "defaultHeaders">
  > & {
    defaultHeaders: Record<string, string>;
  },
  {
    timeout = instanceConfig.timeout,
    transform = false,
    retries = instanceConfig.retries,
    initialRetryDelay = instanceConfig.initialRetryDelay,
    allowRetry = false,
    label = "HTTP_Request",
    params: _params,
    ...options
  }: HttpClientOptions = {},
): Promise<T> => {
  const method = options.method?.toUpperCase() ?? "GET";
  const canRetry = allowRetry || IDEMPOTENT_METHODS.has(method);

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
        headers: {
          "Content-Type": "application/json",
          ...instanceConfig.defaultHeaders,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isClientError = response.status < 500 && response.status !== 408;

        if (isClientError || attempt === retries || !canRetry) {
          const errorData = await response.json().catch(() => ({}));
          throw new FetchError(
            `${label}: ${errorData?.message ?? `Request failed with ${response.status}`}`,
            response.status,
            errorData,
          );
        }

        // retries remaining, fall through to backoff
        throw new Error(`Server error ${response.status}`);
      }

      const isNoContent = response.status === 204 || response.status === 205;
      const result = isNoContent
        ? null
        : await response.json().catch(() => null);

      return (
        transform && result?.data !== undefined ? result.data : result
      ) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // caller cancelled, don't retry
      if (
        err instanceof Error &&
        err.name === "AbortError" &&
        options.signal?.aborted
      ) {
        throw err;
      }

      const isTimeout =
        err instanceof Error &&
        err.name === "AbortError" &&
        controller.signal.aborted;
      const isLastAttempt = attempt === retries;

      if (isLastAttempt || !canRetry) {
        if (err instanceof FetchError) throw err;
        if (isTimeout) {
          throw new FetchError(`${label}: Gateway Timeout`, 504, {
            original: err instanceof Error ? err.message : String(err),
          });
        }
        throw new ExternalServiceError(label, err);
      }

      const delay = initialRetryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("[httpClient] Retry loop exhausted");
};

export interface HttpClient {
  get: <T>(path: string, options?: HttpClientOptions) => Promise<T>;
  post: <T>(
    path: string,
    body: unknown,
    options?: HttpClientOptions,
  ) => Promise<T>;
  put: <T>(
    path: string,
    body: unknown,
    options?: HttpClientOptions,
  ) => Promise<T>;
  patch: <T>(
    path: string,
    body: unknown,
    options?: HttpClientOptions,
  ) => Promise<T>;
  delete: <T>(path: string, options?: HttpClientOptions) => Promise<T>;
}

export const createHttpClient = ({
  baseUrl,
  timeout = 5500,
  retries = 2,
  initialRetryDelay = 1000,
  defaultHeaders = {},
}: HttpClientConfig): HttpClient => {
  const instanceConfig = {
    timeout,
    retries,
    initialRetryDelay,
    defaultHeaders,
  };

  const resolve = (path: string, params?: Record<string, string>) =>
    resolveUrl(baseUrl, path, params);

  return {
    get: <T>(path: string, options?: HttpClientOptions) =>
      request<T>(resolve(path, options?.params), instanceConfig, {
        ...options,
        method: "GET",
      }),

    post: <T>(path: string, body: unknown, options?: HttpClientOptions) =>
      request<T>(resolve(path), instanceConfig, {
        ...options,
        method: "POST",
        body: JSON.stringify(body),
      }),

    put: <T>(path: string, body: unknown, options?: HttpClientOptions) =>
      request<T>(resolve(path), instanceConfig, {
        ...options,
        method: "PUT",
        body: JSON.stringify(body),
      }),

    patch: <T>(path: string, body: unknown, options?: HttpClientOptions) =>
      request<T>(resolve(path), instanceConfig, {
        ...options,
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: <T>(path: string, options?: HttpClientOptions) =>
      request<T>(resolve(path), instanceConfig, {
        ...options,
        method: "DELETE",
      }),
  };
};
