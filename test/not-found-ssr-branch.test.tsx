import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// QA (issue #37) — the SSR server-prerender branch of app/not-found.tsx.
//
// Under the Node SSR server, `not-found.tsx` is server-rendered PER REQUEST for any
// unmatched path (chiefly a bare single segment like `/San_Francisco`). The #13/#37
// no-flash invariant (spec AC5/AC6, design "SSR-specific invariants" #1) requires
// that the SERVER's first HTML for such a path is the NEUTRAL LOADING SHELL — the
// `redirecting === null` branch (ArticleSkeleton + the "Loading topic…" polite
// status) — and NEVER the "Topic not found." dead end. If the server emitted
// "not found" the client would then flip to loading: a hydration mismatch + the
// exact flash this design exists to prevent.
//
// `renderToString` reproduces the server pass precisely: useEffect does NOT run, so
// `redirecting` stays at its initial `null` and we observe what the SSR server
// actually streams as first HTML. The existing test/not-found.test.tsx covers the
// CLIENT mount behavior (the redirect fires, lands in loading); this file covers the
// SERVER-side first paint that per-request SSR newly makes hot on every boot.

// useRouter is only touched in the (effect-only) redirect path, never during the
// server render; stub it so the import resolves under renderToString.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// TopicView is the "fell through to the client SPA" branch — it must NOT appear in
// the server's first paint for a redirect-eligible boot. Stub to a sentinel so we
// can assert its ABSENCE from the SSR HTML.
vi.mock("@/app/topic/TopicView", () => ({
  TopicView: () => "TOPICVIEW_SENTINEL",
}));

import NotFound from "@/app/not-found";

describe("app/not-found.tsx — SSR server-prerender first paint (issue #37)", () => {
  it("AC5/AC6 — the server's first HTML is the neutral loading shell, NOT 'Topic not found.'", () => {
    // `renderToString` = the server pass (no effects → redirecting stays `null`).
    const html = renderToString(<NotFound />);

    // The no-flash guarantee: the server NEVER emits the "Topic not found." dead end
    // as first paint (which would flicker-then-replace on the client).
    expect(html).not.toMatch(/Topic not found/i);

    // It IS the neutral loading shell: the polite "Loading topic…" announcement, the
    // role="status" live region, and the ArticleSkeleton placeholder.
    expect(html).toMatch(/Loading topic/i);
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/aria-live="polite"/);

    // And it is NOT TopicView (the fall-through SPA shell) on first paint — the
    // server renders the skeleton, not the client resolve component.
    expect(html).not.toContain("TOPICVIEW_SENTINEL");
  });

  it("AC6 — the server first paint is hydration-safe: deterministic, no window/effect dependency", () => {
    // Two server renders produce identical HTML — no Date.now()/random/window read
    // that would diverge between the server pass and the client's first paint.
    const a = renderToString(<NotFound />);
    const b = renderToString(<NotFound />);
    expect(a).toBe(b);
  });
});
