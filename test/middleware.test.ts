// @vitest-environment node
//
// Middleware unit tests — issue #51 (skipTrailingSlashRedirect + middleware.ts).
//
// The middleware takes over trailing-slash redirect responsibility from Next.js so that
// /api/* routes (Auth.js OAuth callbacks) are never 308-redirected. These tests drive the
// middleware function directly with synthetic NextRequests and assert the correct response:
// NextResponse.next() (pass-through) vs NextResponse.redirect() with status 308.
//
// AC coverage:
//   AC1 — /api/auth/* routes must NOT receive a 308 redirect
//   AC2 — /topic/<Title> (no slash) → 308 to /topic/<Title>/   [BUG: loop — see findings]
//   AC3 — / (root, already ends with /) → no redirect
//   AC4 — /favicon.ico (static-file heuristic) → no redirect
//   (AC5 — build/typecheck pass — verified by yarn typecheck + yarn build, not here)
//
// *** DEFECT FOUND (route to Development) ***
// AC2 FAILS. The middleware uses `request.nextUrl.clone()` to build the redirect URL,
// then sets `url.pathname = pathname + "/"`. However, Next.js's `NextURL` serializes
// `href` via `formatPathname()`, which reads `internal.trailingSlash`. When an incoming
// request has no trailing slash, `NextURL` initializes `trailingSlash: false`, and the
// cloned URL inherits that flag. The `formatPathname` call then strips the trailing slash
// from the serialized href, so `NextResponse.redirect(url)` emits a Location header that
// is identical to the original URL — a permanent redirect loop (308 → same URL → 308 → …).
// A browser that follows the 308 will loop; the cached 308 also breaks the route for that
// browser session permanently.
//
// Fix required (Development): replace `request.nextUrl.clone()` with a plain `new URL()`
// (or a string URL) so the trailing slash is preserved in serialization, e.g.:
//   const dest = new URL(`${pathname}/`, request.nextUrl.origin);
//   dest.search = search;
//   return NextResponse.redirect(dest, { status: 308 });
//
// The tests below assert the CORRECT (intended) behavior. AC2 tests will fail against
// the current code; they should pass once the defect is fixed.

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

/** Returns true when the response is a pass-through (NextResponse.next()), i.e. not a redirect. */
function isPassThrough(response: Response): boolean {
  // NextResponse.next() has no Location header and carries no 3xx status.
  return !response.headers.get("location");
}

/** Returns true when the response is a 308 redirect to the given destination URL. */
function is308To(response: Response, destination: string): boolean {
  return (
    response.status === 308 &&
    response.headers.get("location") === destination
  );
}

// ---------------------------------------------------------------------------
// AC1 — /api/auth/* must NOT be 308-redirected  [PASS]
// ---------------------------------------------------------------------------

describe("AC1 — Auth.js API routes: no trailing-slash 308 redirect", () => {
  it("/api/auth/signin is passed through without redirect", () => {
    const res = middleware(makeRequest("/api/auth/signin"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/api/auth/callback/wikimedia is passed through without redirect", () => {
    const res = middleware(makeRequest("/api/auth/callback/wikimedia"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/api/auth/session is passed through without redirect", () => {
    const res = middleware(makeRequest("/api/auth/session"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/api/auth/signout is passed through without redirect", () => {
    const res = middleware(makeRequest("/api/auth/signout"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("a generic /api/foo/bar route is also passed through without redirect", () => {
    // All /api/* routes are exempt, not just /api/auth/*.
    const res = middleware(makeRequest("/api/foo/bar"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Topic routes without trailing slash → 308 to canonical form
//        [BUG: currently loops — see file header; tests assert correct behavior]
// ---------------------------------------------------------------------------

describe("AC2 — Topic routes: missing trailing slash triggers 308 redirect [BUG: see header]", () => {
  it("/topic/France (no slash) → 308 to http://localhost/topic/France/", () => {
    const res = middleware(makeRequest("/topic/France"));
    // BUG: current code emits Location: http://localhost/topic/France (no slash) — loop.
    // This assertion documents the CORRECT expected behavior and will fail until fixed.
    expect(is308To(res, "http://localhost/topic/France/")).toBe(true);
  });

  it("/topic/France/ (already canonical) → no redirect", () => {
    const res = middleware(makeRequest("/topic/France/"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/topic/Cellular_respiration (no slash) → 308 to /topic/Cellular_respiration/", () => {
    const res = middleware(makeRequest("/topic/Cellular_respiration"));
    // BUG: current code emits Location: http://localhost/topic/Cellular_respiration (no slash).
    expect(is308To(res, "http://localhost/topic/Cellular_respiration/")).toBe(
      true
    );
  });

  it("query string is preserved on the 308 redirect destination", () => {
    const res = middleware(makeRequest("/topic/France?tab=clips"));
    expect(res.status).toBe(308);
    const loc = res.headers.get("location") ?? "";
    // BUG: current code emits http://localhost/topic/France?tab=clips (no slash).
    expect(loc).toBe("http://localhost/topic/France/?tab=clips");
  });

  it("no redirect loop: applying middleware to the destination is a pass-through", () => {
    // Once fixed, /topic/France/ must be a pass-through so there is no second hop.
    const res = middleware(makeRequest("/topic/France/"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Root path is already canonical  [PASS]
// ---------------------------------------------------------------------------

describe("AC3 — Root path: / already ends in slash, no redirect", () => {
  it("/ is passed through without redirect", () => {
    const res = middleware(makeRequest("/"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Static files are not redirected  [PASS]
// ---------------------------------------------------------------------------

describe("AC4 — Static-file heuristic: paths with . in last segment skip redirect", () => {
  it("/favicon.ico is passed through without redirect", () => {
    const res = middleware(makeRequest("/favicon.ico"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/robots.txt is passed through without redirect", () => {
    const res = middleware(makeRequest("/robots.txt"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/sitemap.xml is passed through without redirect", () => {
    const res = middleware(makeRequest("/sitemap.xml"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("a nested static asset path is passed through without redirect", () => {
    const res = middleware(makeRequest("/images/logo.png"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Belt-and-suspenders: /_next/* internals  [PASS]
// ---------------------------------------------------------------------------

describe("Next.js internals: /_next/* is always passed through", () => {
  it("/_next/static/chunk.js is passed through (in-function guard)", () => {
    // The matcher also excludes _next/static, but the in-function guard is belt-and-suspenders.
    // Under vitest the matcher doesn't filter — the function guard is what matters here.
    const res = middleware(makeRequest("/_next/static/chunk.js"));
    expect(isPassThrough(res)).toBe(true);
  });

  it("/_next/image is passed through", () => {
    const res = middleware(makeRequest("/_next/image"));
    expect(isPassThrough(res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Other page routes without trailing slash → 308  [BUG: currently loops]
// ---------------------------------------------------------------------------

describe("Other app routes: missing trailing slash triggers 308 [BUG: see header]", () => {
  it("/contribute (no slash) → 308 to /contribute/", () => {
    const res = middleware(makeRequest("/contribute"));
    // BUG: current code emits Location: http://localhost/contribute (no slash).
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/contribute/");
  });

  it("/about/data (no slash) → 308 to /about/data/", () => {
    const res = middleware(makeRequest("/about/data"));
    // BUG: current code emits Location: http://localhost/about/data (no slash).
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/about/data/");
  });
});
