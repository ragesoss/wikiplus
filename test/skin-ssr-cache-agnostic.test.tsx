import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// QA (issue #143) — AC9/AC10: the SSR'd HTML shell is SKIN-AGNOSTIC, so the (future) ISR/Redis read
// path needs no skin variance — the same cached page serves every skin. This is the LOAD-BEARING
// read-path invariant and the spec demands a BEHAVIORAL proof, not just a source grep: render the
// real app/layout.tsx RootLayout server-side under three skin states — (a) no `wikiplus-skin` cookie,
// (b) `wikiplus-skin=zine` (explicit light), (c) `wikiplus-skin=zine-dark` (explicit dark) — and
// assert the produced HTML body is BYTE-IDENTICAL across all three and carries NO `data-skin`. The
// skin is resolved ENTIRELY by the pre-paint browser script (which reads `document.cookie` at runtime
// in the BROWSER, never interpolated into the server markup) — so a per-request cookie can never
// fragment the cached SSR shell (AC9), and there is no skin-derived cache key (AC10).
//
// `renderToStaticMarkup` reproduces the server pass: useEffect does not run, so SkinSync/AuthControl
// effects never fire — we observe exactly what the SSR server streams as first HTML.

// SessionProvider (next-auth/react) is a client context; under SSR it must render its children with
// no session work. Stub it to a passthrough so the layout's <Providers> renders to static markup.
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

import RootLayout from "@/app/layout";

/** Server-render the real RootLayout to a static HTML string under a given runtime cookie. The
 *  cookie is the per-request input the read-path decision forbids from affecting server markup. */
function renderLayoutWithCookie(cookie: string): string {
  // Set the runtime cookie the way a real request would carry it. The SSR render must NOT read it.
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => cookie,
    set: () => {},
  });
  return renderToStaticMarkup(
    <RootLayout>
      <main>topic content</main>
    </RootLayout>
  );
}

describe("AC9/AC10 — the SSR HTML shell is skin-agnostic (cache-agnostic guarantee)", () => {
  let originalCookieDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalCookieDesc = Object.getOwnPropertyDescriptor(document, "cookie");
  });
  afterEach(() => {
    if (originalCookieDesc) {
      Object.defineProperty(document, "cookie", originalCookieDesc);
    }
    vi.restoreAllMocks();
  });

  it("AC9 — the server response body is BYTE-IDENTICAL with no cookie / zine / zine-dark", () => {
    const noCookie = renderLayoutWithCookie("");
    const lightCookie = renderLayoutWithCookie("wikiplus-skin=zine");
    const darkCookie = renderLayoutWithCookie("wikiplus-skin=zine-dark");

    // The whole point of the seam (#119/#143): the cookie is read by the BROWSER pre-paint script,
    // never by the server render. So the three SSR bodies must be character-for-character identical.
    expect(lightCookie).toBe(noCookie);
    expect(darkCookie).toBe(noCookie);
  });

  it("AC9 — the SSR <html> TAG carries NO data-skin attribute (it is only ever set client-side)", () => {
    const html = renderLayoutWithCookie("wikiplus-skin=zine-dark");
    // The opening <html …> tag must not carry a server-rendered data-skin ATTRIBUTE — the attribute
    // is applied exclusively by the pre-paint setAttribute in the browser. (The literal string
    // `data-skin` legitimately appears INSIDE the inline bootstrap's `setAttribute("data-skin", …)`
    // — that is the client script, not a server-rendered attribute — so we match the open tag only.)
    const openTag = html.match(/<html[^>]*>/)?.[0] ?? "";
    expect(openTag).toMatch(/lang="en"/);
    expect(openTag).not.toMatch(/data-skin/);
    // Belt-and-suspenders: no HTML attribute form `data-skin="…"` anywhere in the SSR markup (the
    // script form is `setAttribute("data-skin", s)`, which has the comma+space, not `=`).
    expect(html).not.toMatch(/data-skin=/);
  });

  it("AC10 — the inline bootstrap interpolates ONLY a build-time default, never the runtime cookie", () => {
    // The pre-paint script (the only skin code in the SSR HTML) reads the cookie via document.cookie
    // at runtime in the browser — it is NOT interpolated into the server markup. So a crafted cookie
    // value can never appear verbatim in the SSR'd <script> (AC10 / the bootstrap-XSS guard).
    const crafted = 'wikiplus-skin="></script><script>alert(1)</script>';
    const html = renderLayoutWithCookie(crafted);
    expect(html).not.toContain("alert(1)");
    // The script reads the cookie at runtime (document.cookie.match), not from a server interpolation.
    expect(html).toMatch(/document\.cookie\.match/);
  });
});
