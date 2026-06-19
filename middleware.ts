import { NextResponse, type NextRequest } from "next/server";

// Trailing-slash redirect middleware (issue #51).
//
// next.config.mjs keeps `trailingSlash: true` (canonical URL shape, drives <Link> hrefs) but
// adds `skipTrailingSlashRedirect: true` (stops Next.js from issuing a 308 on every route that
// lacks a trailing slash). This middleware takes over the redirect responsibility and skips /api/*
// so Auth.js OAuth routes (/api/auth/callback/wikimedia, /api/auth/signin, etc.) are never
// 308-redirected — OAuth providers require exact callback URL matching and a redirect breaks the flow.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Pass through Next.js internals and API routes without any redirect.
  // /api/* — Auth.js + any future API routes; must never receive a trailing-slash 308.
  // /_next/* — internal Next.js asset requests (covered by the matcher too, belt-and-suspenders).
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Already canonical — nothing to do.
  if (pathname.endsWith("/")) {
    return NextResponse.next();
  }

  // Static file heuristic: a dot in the last path segment means it looks like a file
  // (e.g. favicon.ico, robots.txt, sitemap.xml). Skip the redirect so these are served
  // directly rather than 308-ed to a trailing-slash URL that won't resolve.
  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    return NextResponse.next();
  }

  // Redirect to canonical trailing-slash form, preserving any query string.
  // 308 Permanent Redirect (method-preserving, same as Next.js's own redirect).
  const url = request.nextUrl.clone();
  url.pathname = pathname + "/";
  // search is already part of nextUrl; clone preserves it. Explicitly reassign to be safe.
  url.search = search;
  return NextResponse.redirect(url, { status: 308 });
}

export const config = {
  // Run on all paths except Next.js static assets (_next/static, _next/image) and favicon.ico.
  // This keeps the middleware out of the hot asset-serving path while still catching all
  // page routes (including /topic/France, /, /about/, etc.).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
