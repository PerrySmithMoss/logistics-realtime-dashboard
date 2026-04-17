import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSessionToken = vi.fn();
const verifySessionToken = vi.fn();
const nextMock = vi.fn();

vi.mock("@/shared/lib/session", () => ({
  SESSION_COOKIE_NAME: "fleet_session",
  createSessionToken,
  verifySessionToken,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
  },
}));

type CookieRecord = {
  set: ReturnType<typeof vi.fn>;
};

const createResponse = () => {
  const cookies: CookieRecord = {
    set: vi.fn(),
  };

  return {
    cookies,
  };
};

const createEvent = () => ({}) as never;

const createRequest = ({
  pathname = "/",
  cookies = new Map<string, string>(),
  headers,
}: {
  pathname?: string;
  cookies?: Map<string, string>;
  headers?: Headers;
}) =>
  ({
    nextUrl: { pathname },
    headers: headers ?? new Headers(),
    cookies: {
      get: (name: string) => {
        const value = cookies.get(name);
        return value ? { value } : undefined;
      },
    },
  }) as never;

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextMock.mockImplementation(() => createResponse());
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("skips static assets", async () => {
    const { proxy } = await import("../proxy");

    await proxy(createRequest({ pathname: "/logo.svg" }), createEvent());

    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it("creates a guest viewer session when no token exists", async () => {
    createSessionToken.mockResolvedValueOnce("guest-token");
    const { proxy } = await import("../proxy");

    const response = (await proxy(
      createRequest({ pathname: "/" }),
      createEvent(),
    )) as unknown as {
      cookies: CookieRecord;
    };

    expect(createSessionToken).toHaveBeenCalledWith({ role: "viewer" });
    expect(response.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "fleet_session",
        value: "guest-token",
        httpOnly: true,
      }),
    );
  });

  it("injects the verified role header and strips any incoming x-user-role", async () => {
    verifySessionToken.mockResolvedValueOnce({ role: "admin", iat: Math.floor(Date.now() / 1000) });
    const { proxy } = await import("../proxy");
    const headers = new Headers({ "x-user-role": "attacker" });

    await proxy(
      createRequest({
        pathname: "/api/proxy/fleet/stream",
        cookies: new Map([["fleet_session", "existing-token"]]),
        headers,
      }),
      createEvent(),
    );

    expect(verifySessionToken).toHaveBeenCalledWith("existing-token");
    expect(nextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          headers: expect.any(Headers),
        },
      }),
    );

    const forwardedHeaders = nextMock.mock.calls[0][0].request.headers as Headers;
    expect(forwardedHeaders.get("x-user-role")).toBe("admin");
  });

  it("refreshes stale authenticated sessions", async () => {
    const oldIssuedAt = Math.floor(Date.now() / 1000) - 1_900;
    verifySessionToken.mockResolvedValueOnce({ role: "operator", iat: oldIssuedAt });
    createSessionToken.mockResolvedValueOnce("refreshed-token");
    const { proxy } = await import("../proxy");

    const response = (await proxy(
      createRequest({
        pathname: "/",
        cookies: new Map([["fleet_session", "existing-token"]]),
      }),
      createEvent(),
    )) as unknown as { cookies: CookieRecord };

    expect(createSessionToken).toHaveBeenCalledWith({ role: "operator" });
    expect(response.cookies.set).toHaveBeenCalledWith(
      "fleet_session",
      "refreshed-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3600,
      }),
    );
  });
});
