import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/reset-password"];
const SESSION_COOKIE = "session";

/**
 * Optimistic redirect based on cookie presence only -- middleware runs on
 * the Edge runtime, where `pg` can't connect to Postgres to actually
 * validate the session. Real validation (does the session row still
 * exist? has it expired? does the user still have an active
 * organization membership?) happens in `requireOrgContext` on every
 * page, which runs in the Node.js runtime. A stale/forged cookie gets
 * past this check but is rejected there.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Only bounce an already-authenticated visitor away from /login -- not
  // /signup. requireOrgContext sends a signed-in user with no active
  // organization membership to /signup (see lib/session.ts); bouncing them
  // straight back to /dashboard from there would loop the two redirects
  // forever.
  if (hasSession && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, images, fonts
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
