import { ExternalServiceError, FetchError } from "@shared/errors/app.errors";
import { exponentialBackoff } from "@shared/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient, HttpClientOptions } from "../http-client";

vi.mock("@shared/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/utils")>();
  return {
    ...actual,
    exponentialBackoff: vi.fn().mockResolvedValue(undefined),
  };
});

const createMockResponse = (
  status: number,
  body: unknown = {},
  contentType = "application/json",
) => {
  const isJson = contentType === "application/json";
  const hasNoContent = status === 204 || status === 205;

  let responseBody: BodyInit | null = null;

  if (!hasNoContent) {
    if (isJson) {
      responseBody = JSON.stringify(body);
    } else if (typeof body === "string") {
      responseBody = body;
    } else if (
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams
    ) {
      responseBody = body;
    } else if (body == null) {
      responseBody = null;
    } else {
      responseBody = String(body);
    }
  }

  const response = new Response(responseBody, {
    status,
    headers: { "Content-Type": contentType },
  });

  vi.spyOn(response, "json");

  return response;
};

const mockFetch = (...responses: ReturnType<typeof createMockResponse>[]) => {
  let chain = (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(responses[0]);
  for (const res of responses.slice(1)) {
    chain = chain.mockResolvedValueOnce(res);
  }
};

const URL = "https://api.example.com/data";

// Setting fast default options so we don't have to
// wait exponentially long for the tests to run.
const HTTP_CLIENT_DEFAULT_OPTIONS = {
  timeout: 100,
  retries: 0,
  initialRetryDelay: 100,
} satisfies HttpClientOptions;

describe("httpClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    if (vi.isFakeTimers()) {
      await vi.runAllTimersAsync();
      vi.clearAllTimers();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("URL validation", () => {
    it("throws a plain Error (not FetchError) for relative URLs", async () => {
      await expect(httpClient("/relative/path")).rejects.toThrow("[httpClient] invalid url");
      await expect(httpClient("/relative/path")).rejects.not.toThrow(FetchError);
    });

    it("rejects protocol-relative URLs", async () => {
      await expect(httpClient("//example.com/data")).rejects.toThrow("[httpClient] invalid url");
    });

    it("accepts https:// URLs", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createMockResponse(200, { ok: true }),
      );
      await expect(httpClient(URL)).resolves.not.toThrow();
    });
  });

  describe("successful responses", () => {
    it("returns parsed JSON from a 200 response", async () => {
      const body = { id: 1, name: "example" };
      mockFetch(createMockResponse(200, body));

      const result = await httpClient(URL);

      expect(result).toEqual(body);
      expect(global.fetch).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "GET" }));
    });

    it("sends Content-Type: application/json by default", async () => {
      mockFetch(createMockResponse(200));

      await httpClient(URL);

      expect(global.fetch).toHaveBeenCalledWith(
        URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("allows callers to override Content-Type", async () => {
      mockFetch(createMockResponse(200));

      await httpClient(URL, {
        headers: { "Content-Type": "text/plain" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        URL,
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "text/plain" }),
        }),
      );
    });

    it("returns null for 204 without calling .json()", async () => {
      const response = createMockResponse(204);

      fetchMock.mockResolvedValueOnce(response);

      const result = await httpClient(URL);

      expect(result).toBeNull();
      expect(response.json).not.toHaveBeenCalled();
    });

    it("returns null for 205 without calling .json()", async () => {
      const response = createMockResponse(205);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(response);

      const result = await httpClient(URL);

      expect(result).toBeNull();
      expect(response.json).not.toHaveBeenCalled();
    });

    it("returns null when json() rejects (malformed body)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      });

      const result = await httpClient(URL);
      expect(result).toBeNull();
    });
  });

  describe("transform option", () => {
    it("unwraps result.data when transform:true and data is present", async () => {
      const body = { data: { foo: "bar" }, meta: { count: 1 } };
      mockFetch(createMockResponse(200, body));

      // TS now knows 'result' is the inner object because of the overload
      const result = await httpClient<{ foo: string }>(URL, { transform: true });

      expect(result).toEqual({ foo: "bar" });
      expect(result).not.toHaveProperty("meta");
    });

    it("returns the full result when transform:true but data is undefined", async () => {
      const body = { items: [] };
      mockFetch(createMockResponse(200, body));

      const result = await httpClient(URL, { transform: true });

      expect(result).toEqual(body);
    });

    it("returns full result when transform:false (default)", async () => {
      const body = { data: { foo: "bar" }, meta: {} };
      mockFetch(createMockResponse(200, body));

      const result = await httpClient(URL, { transform: false });

      expect(result).toEqual(body);
    });
  });

  describe("retry logic — idempotency", () => {
    it("retries GET on 5xx and succeeds on the second attempt", async () => {
      mockFetch(createMockResponse(500), createMockResponse(200, { ok: true }));

      const result = await httpClient(URL, { retries: 1 });

      expect(result).toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      expect(exponentialBackoff).toHaveBeenCalledWith(1000, 0);
    });

    it("retries PUT on 5xx by default (idempotent method)", async () => {
      mockFetch(createMockResponse(500), createMockResponse(200, { updated: true }));

      const p = httpClient(URL, {
        method: "PUT",
        retries: 1,
        initialRetryDelay: 100,
      });
      await vi.runAllTimersAsync();

      await expect(p).resolves.toEqual({ updated: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries DELETE on 5xx by default (idempotent method)", async () => {
      mockFetch(createMockResponse(503), createMockResponse(200));

      const p = httpClient(URL, {
        method: "DELETE",
        retries: 1,
        initialRetryDelay: 100,
      });
      await vi.runAllTimersAsync();

      await expect(p).resolves.toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry POST on 5xx by default", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(500));

      const p = httpClient(URL, { method: "POST", retries: 2 });

      await expect(p).rejects.toThrow(FetchError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry PATCH on 5xx by default", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(502));

      const p = httpClient(URL, { method: "PATCH", retries: 2 });

      await expect(p).rejects.toThrow(FetchError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("retries POST when allowRetry:true is explicit", async () => {
      mockFetch(createMockResponse(500), createMockResponse(200, { created: true }));

      const p = httpClient(URL, {
        method: "POST",
        retries: 1,
        allowRetry: true,
        initialRetryDelay: 100,
      });
      await vi.runAllTimersAsync();

      await expect(p).resolves.toEqual({ created: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("exhausts all retries and throws FetchError after the final attempt", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(503));

      const p = httpClient(URL, {
        retries: 2,
        initialRetryDelay: 100,
        label: "MY_SERVICE",
      }).catch((e) => e);

      await vi.runAllTimersAsync();

      const error = await p;

      expect(error).toBeInstanceOf(FetchError);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("retry logic — client errors", () => {
    it.each([400, 401, 403, 404, 422])(
      "throws FetchError immediately for %i without retrying",
      async (status) => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
          createMockResponse(status, { message: `Error ${status}` }),
        );

        await expect(httpClient(URL, { ...HTTP_CLIENT_DEFAULT_OPTIONS })).rejects.toThrow(
          FetchError,
        );

        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
    );

    it("retries on 408 (server-side timeout)", async () => {
      mockFetch(createMockResponse(408), createMockResponse(200, { ok: true }));

      const p = httpClient(URL, { retries: 1, initialRetryDelay: 100 });
      await vi.runAllTimersAsync();

      await expect(p).resolves.toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("exponential backoff — timing precision", () => {
    it("calls backoff with the correct delay calculation", async () => {
      fetchMock.mockResolvedValue(createMockResponse(500));

      const p = httpClient(URL, {
        initialRetryDelay: 100,
        retries: 2,
      }).catch((e) => e);

      await p;

      expect(global.fetch).toHaveBeenCalledTimes(3);

      expect(exponentialBackoff).toHaveBeenNthCalledWith(1, 100, 0);
      expect(exponentialBackoff).toHaveBeenNthCalledWith(2, 100, 1);
    });
  });

  describe("timeouts", () => {
    it("throws FetchError with statusCode 504 after the configured timeout", async () => {
      fetchMock.mockImplementation((_: unknown, options: RequestInit) => {
        return new Promise((_, reject) => {
          if (options.signal) {
            options.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      });

      const promise = httpClient(URL, {
        ...HTTP_CLIENT_DEFAULT_OPTIONS,
        timeout: 100,
      }).catch((e) => e);

      await vi.advanceTimersByTimeAsync(101);

      const error = await promise;

      expect(error).toMatchObject({
        statusCode: 504,
        message: expect.stringContaining("Gateway Timeout"),
      });
    });

    it("includes the label in the 504 error message", async () => {
      fetchMock.mockImplementation(
        (
          _: unknown,
          options: {
            signal: {
              addEventListener: (arg0: string, arg1: () => void) => void;
            };
          },
        ) => {
          return new Promise((_, reject) => {
            options.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        },
      );

      const p = httpClient(URL, {
        timeout: 500,
        retries: 0,
        label: "PAYMENT_SERVICE",
      }).catch((e) => e); // ✅

      await vi.advanceTimersByTimeAsync(501);

      const error = await p;

      expect((error as Error).message).toMatch(/PAYMENT_SERVICE/);
    });

    it("clears the timeout after a successful response", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      mockFetch(createMockResponse(200, { ok: true }));

      await httpClient(URL, { timeout: 5000, retries: 0 });

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("clears the timeout after a failed response (before rethrowing)", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      mockFetch(createMockResponse(400, { message: "Bad Request" }));

      await expect(httpClient(URL, { retries: 0 })).rejects.toThrow(FetchError);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("abort signals", () => {
    it("rethrows AbortError immediately when the external signal is aborted", async () => {
      const controller = new AbortController();

      fetchMock.mockImplementation((_: unknown, options: RequestInit) => {
        return new Promise((_, reject) => {
          if (options.signal?.aborted) {
            return reject(new DOMException("Aborted", "AbortError"));
          }

          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const p = httpClient(URL, {
        signal: controller.signal,
        retries: 0,
      });

      controller.abort();

      vi.runAllTicks();

      await expect(p).rejects.toThrow();
    });

    it("does not retry after an external abort", async () => {
      const controller = new AbortController();
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        Object.assign(new Error("AbortError"), { name: "AbortError" }),
      );

      controller.abort();
      const p = httpClient(URL, {
        signal: controller.signal,
        retries: 2,
      });

      await expect(p).rejects.toMatchObject({ name: "AbortError" });
      // should not attempt retry for an external abort
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("throws FetchError 504 on internal timeout, not AbortError", async () => {
      fetchMock.mockImplementation((_: unknown, options: RequestInit) => {
        return new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });

      const p = httpClient(URL, { timeout: 500, retries: 0 }).catch((e) => e);

      await vi.advanceTimersByTimeAsync(501);

      const error = await p;

      expect(error).toBeInstanceOf(FetchError);
      expect(error).toMatchObject({ statusCode: 504 });
      expect((error as FetchError).name).not.toBe("AbortError");
    });

    it("external abort takes priority over internal timeout", async () => {
      const controller = new AbortController();

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, opts: RequestInit) => {
          return new Promise((_res, rej) => {
            opts.signal?.addEventListener("abort", () =>
              rej(new DOMException("The operation was aborted.", "AbortError")),
            );
          });
        },
      );

      const p = httpClient(URL, {
        ...HTTP_CLIENT_DEFAULT_OPTIONS,
        signal: controller.signal,
        timeout: 1000,
      }).catch((e) => e);

      controller.abort();

      const error = await p;

      expect(error).toMatchObject({ name: "AbortError" });
    });
  });

  describe("error classification and messages", () => {
    it("includes API message in FetchError", async () => {
      mockFetch(createMockResponse(400, { message: "Bad input" }));

      const error = await httpClient(URL, { label: "ORDER_SERVICE", retries: 0 }).catch((e) => e);

      expect(error).toBeInstanceOf(FetchError);

      const fetchError = error as FetchError;

      expect(fetchError.name).toBe("FetchError");
      expect(fetchError.statusCode).toBe(400);

      expect(fetchError.message).toContain("Bad input");
      expect(fetchError.data).toMatchObject({ message: "Bad input" });
    });

    it("falls back to status-based message when body has no message field", async () => {
      vi.useRealTimers();

      mockFetch(createMockResponse(400, {}));

      await expect(httpClient(URL, { label: "ORDER_SERVICE", retries: 0 })).rejects.toMatchObject({
        message: expect.stringContaining("400"),
      });
    });

    it("falls back when JSON parsing fails", async () => {
      const badResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
        text: vi.fn().mockResolvedValue("Garbage HTML/Text"),
      };

      fetchMock.mockResolvedValue(badResponse);

      const error = await httpClient(URL, { label: "ORDER_SERVICE", retries: 0 }).catch((e) => e);

      expect(error).toBeInstanceOf(ExternalServiceError);

      const externalError = error as ExternalServiceError;

      expect(externalError.statusCode).toBe(502);
    });

    it("throws ExternalServiceError for non-HTTP errors (e.g. network down)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network Down"));

      await expect(httpClient(URL, { retries: 0 })).rejects.toThrow(ExternalServiceError);
    });

    it("does not wrap FetchError inside ExternalServiceError", async () => {
      mockFetch(createMockResponse(400, { message: "Bad input" }));

      const promise = httpClient(URL, { retries: 0 }).catch((e) => e);

      const error = await promise;

      expect(error).toBeInstanceOf(FetchError);
      expect(error).not.toBeInstanceOf(ExternalServiceError);
    });

    it("ExternalServiceError message includes the label", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(httpClient(URL, { retries: 0, label: "INVENTORY_SERVICE" })).rejects.toThrow(
        "INVENTORY_SERVICE",
      );
    });

    it("preserves FetchError through retry loop without wrapping it", async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(createMockResponse(400, { message: "Bad input" })),
      );

      const promise = httpClient(URL, {
        retries: 2,
        initialRetryDelay: 10,
        label: "HTTP_Request",
      }).catch((e) => e);

      await vi.runAllTimersAsync();

      const error = await promise;

      expect(error).toBeInstanceOf(FetchError);
      const fetchError = error as FetchError;

      expect(fetchError.message).toContain("Bad input");
      expect(fetchError.statusCode).toBe(400);
    });

    it("includes statusCode and data in FetchError", async () => {
      const body = { message: "Quota exceeded", code: "QUOTA_001" };
      mockFetch(createMockResponse(429, body));

      const error = await httpClient(URL, { retries: 0 }).catch((e) => e);

      expect(error).toBeInstanceOf(FetchError);
      expect((error as FetchError).statusCode).toBe(429);
      expect((error as FetchError).data).toMatchObject(body);
    });

    it("normalises HTML error pages into the FetchError data details", async () => {
      const html = "<html>Node.js Error Page</html>";
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers({ "Content-Type": "text/html" }),
        text: vi.fn().mockResolvedValue(html),
      });

      const error = await httpClient(URL, { retries: 0 }).catch((e) => e);

      if (!(error instanceof FetchError)) {
        throw new Error("Expected an FetchError");
      }

      expect(error.data.details[0]).toMatchObject({
        code: "RAW_RESPONSE",
        value: html,
      });
    });
  });

  describe("request options", () => {
    it("defaults to GET when no method is specified", async () => {
      mockFetch(createMockResponse(200));

      await httpClient(URL);

      expect(global.fetch).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "GET" }));
    });

    it("normalises method to uppercase", async () => {
      mockFetch(createMockResponse(200));

      await httpClient(URL, { method: "post" as "POST" });

      expect(global.fetch).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "POST" }));
    });

    it("forwards additional fetch options (e.g. body) to native fetch", async () => {
      mockFetch(createMockResponse(201, { id: 99 }));
      const body = JSON.stringify({ name: "test" });

      await httpClient(URL, { method: "POST", body, allowRetry: false });

      expect(global.fetch).toHaveBeenCalledWith(URL, expect.objectContaining({ body }));
    });
  });
});
