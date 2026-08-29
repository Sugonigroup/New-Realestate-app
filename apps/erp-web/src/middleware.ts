import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route guard: presence check only — token verification stays server-side in the
 * API (03 §2). WP-0D adds role claims to the session payload for UI filtering.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("access_token");
  const onLogin = req.nextUrl.pathname.startsWith("/login");
  if (!hasSession && !onLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && onLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
};
