import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/shared/lib/session";
import type { NextProxy } from "next/server";
import { NextResponse } from "next/server";

export const proxy: NextProxy = async (request) => {
  const { pathname } = request.nextUrl;

  const isStaticAsset =
    pathname.includes(".") &&
    /((?!api|_next\/static|_next\/image|favicon\.ico|sitemap\.xml|robots\.txt).*\.)/.test(pathname);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  // prevent header injection
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-role");

  if (payload && typeof payload.role === "string") {
    // valid session exists
    requestHeaders.set("x-user-role", payload.role);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // auto refresh the cookie to prevent stale requests
    const issuedAt = payload.iat || 0;
    const now = Math.floor(Date.now() / 1000);
    if (now - issuedAt > 1800) {
      const newToken = await createSessionToken({ role: payload.role });
      response.cookies.set(SESSION_COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 3600,
      });
    }

    return response;
  }

  // no existing session - create guest session
  const guestToken = await createSessionToken({ role: "viewer" });
  const response = NextResponse.next();

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: guestToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });

  return response;
};

export const config = {
  matcher: ["/", "/api/proxy/:path*"],
};
