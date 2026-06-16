import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Component test for the bare-path redirect host (app/not-found.tsx). Verifies the UX
// contract (design spec): a bare title redirects ONCE via router.replace AND lands in the
// loading state (the existing ArticleSkeleton) — never the not-found flash — with a
// polite "Loading topic…" a11y announcement; a non-bare path falls through to TopicView,
// which ends in the graceful "Topic not found. Back home" dead end. (AC1/AC4 + a11y.)
//
// Under the Node SSR server (issue #37) not-found.tsx is no longer the `404.html` SPA
// shell, and `/topic/...` deep links are now rendered on demand by the `[[...slug]]`
// catch-all — they no longer reach this component at runtime. The fallback render here
// is the defensive path for genuinely-unmatched (reserved/multi-segment) paths.
//
// TopicView is mocked to a sentinel so we test the not-found host's routing decision in
// isolation (TopicView's own resolve flow is covered by topic-view.test.tsx).

const routerReplace = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace, push: routerPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/app/topic/TopicView", () => ({
  TopicView: () => <div data-testid="topic-view">TopicView shell</div>,
}));

import NotFound from "@/app/not-found";

function setLocation(pathname: string, search = "", hash = "") {
  // jsdom: navigate (same origin) so window.location.{pathname,search,hash} reflect the
  // bare path. Cross-origin replaceState is a SecurityError, so reuse window.origin.
  const url = `${window.location.origin}${pathname}${search}${hash}`;
  window.history.replaceState({}, "", url);
}

beforeEach(() => {
  routerReplace.mockClear();
  routerPush.mockClear();
  setLocation("/");
});

afterEach(() => {
  setLocation("/");
});

describe("app/not-found.tsx — bare-path redirect host", () => {
  it("AC1 — a bare title redirects via router.replace and shows the loading state, not not-found", async () => {
    setLocation("/San_Francisco");
    render(<NotFound />);

    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/San_Francisco/")
    );
    // Never `push` (no extra history entry; Back skips the transient bare URL).
    expect(routerPush).not.toHaveBeenCalled();
    // Lands in the loading state — NOT the "Topic not found." flash.
    expect(screen.queryByText(/Topic not found/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("topic-view")).not.toBeInTheDocument();
  });

  it("a11y — announces the hop politely (Loading topic…) at the redirect boundary", async () => {
    setLocation("/San_Francisco");
    render(<NotFound />);
    const status = await screen.findByText("Loading topic…");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("AC3 — preserves query + hash through the redirect", async () => {
    setLocation("/San_Francisco", "?foo=bar", "#sec-history");
    render(<NotFound />);
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(
        "/topic/San_Francisco/?foo=bar#sec-history"
      )
    );
  });

  it("AC4 — redirects exactly once (no loop)", async () => {
    setLocation("/San_Francisco");
    render(<NotFound />);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledTimes(1));
  });

  it("AC2/AC7 — a non-bare-title path does NOT redirect and falls through to TopicView", async () => {
    // A multi-segment / deep path that the SPA shell serves: no redirect, render the
    // shell (TopicView), whose own flow ends in the graceful not-found for case (d).
    setLocation("/foo/bar");
    render(<NotFound />);
    await waitFor(() =>
      expect(screen.getByTestId("topic-view")).toBeInTheDocument()
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("a /topic/<Title>/ path is never redirected by not-found's bare-path rule (loop guard)", async () => {
    // Under SSR the catch-all renders /topic/... on demand, so this path no longer reaches
    // not-found.tsx at runtime; this asserts the defensive behavior IF it did — the
    // bare-path rule is a no-op on the reserved /topic prefix (no redirect, falls through).
    setLocation("/topic/Cellular_respiration/");
    render(<NotFound />);
    await waitFor(() =>
      expect(screen.getByTestId("topic-view")).toBeInTheDocument()
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
