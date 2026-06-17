import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { FullArticle, ResolvedPage } from "@/lib/wiki/article";

// Issue #23 — the title-route canonicalization exercised END-TO-END through TopicView:
// the address-bar router.replace (AC1–AC3, AC5, AC7) and the canonical/display heading
// split (AC4), plus the unresolved → not-found guard (AC6). The wiki module is MOCKED
// (no network egress); `resolvePage` is the resolution seam and `routerReplace` records
// the canonicalization hop. Mirrors test/topic-view.test.tsx's mock posture.

// Per-test routing + resolution inputs.
let pathname = "/topic/calvin_cycle/";
const routerReplace = vi.fn();
const routerPush = vi.fn();
const resolvePage = vi.fn<(t: string) => Promise<ResolvedPage>>();
const fetchFullArticle = vi.fn<(t: string, d?: string | null) => Promise<FullArticle>>();

// A STABLE router object (like the real next/navigation useRouter) so the resolution
// effect — which depends on `router` — fires once per genuine input change, not on
// every re-render. An unstable object would re-trigger the effect (and a redundant
// router.replace) on each post-mount state commit, which the real app never does.
const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  // The title route carries NO ?qid= (the title in the path is the only input).
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => null),
  titleToQid: vi.fn(async () => null),
  resolvePage: (t: string) => resolvePage(t),
  fetchFullArticle: (t: string, d?: string | null) => fetchFullArticle(t, d),
}));
// Issue #45: mock the @/lib/data seam to the localStorage-backed test double (the prod seam
// routes through Server Actions → Postgres, not runnable in jsdom).
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

/** Build a FullArticle for a canonical/display pair (fetchFullArticle's contract). */
function article(canonical: string, display: string): FullArticle {
  return {
    title: canonical,
    displayTitle: display,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical)}`,
    lead: {
      title: canonical,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical)}`,
      leadHtml: "<p>Lead.</p>",
    },
    sections: [{ slug: "overview", title: "Overview", level: 2, html: "<p>Body.</p>" }],
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  routerReplace.mockReset();
  routerPush.mockReset();
  resolvePage.mockReset();
  fetchFullArticle.mockReset();
  // TopicView passes the resolved displayTitle into fetchFullArticle; reflect it back
  // so the rendered <h1> is the display title (mirrors the real function's contract).
  fetchFullArticle.mockImplementation(async (t, d) => article(t, d ?? t));
  await seedIfEmpty();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("TopicView title-route canonicalization (#23, AC1–AC6)", () => {
  it("AC1: /topic/calvin_cycle/ → replaces to /topic/Calvin_cycle/, heading 'Calvin cycle'", async () => {
    pathname = "/topic/calvin_cycle/";
    resolvePage.mockResolvedValue({
      canonicalTitle: "Calvin cycle",
      displayTitle: "Calvin cycle",
      qid: "Q189445",
    });
    render(<TopicView />);
    expect(
      await screen.findByRole("heading", { name: "Calvin cycle", level: 1 })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/Calvin_cycle/")
    );
    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled(); // replace, never push (AC7)
  });

  it("AC2: literal-space /topic/Calvin cycle/ → same /topic/Calvin_cycle/ destination", async () => {
    pathname = "/topic/Calvin cycle/"; // a literal space in the typed path
    resolvePage.mockResolvedValue({
      canonicalTitle: "Calvin cycle",
      displayTitle: "Calvin cycle",
      qid: "Q189445",
    });
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Calvin cycle", level: 1 });
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/Calvin_cycle/")
    );
    expect(routerReplace).toHaveBeenCalledTimes(1);
  });

  it("AC3: alias /topic/jfk/ → replaces to /topic/John_F._Kennedy/, target heading", async () => {
    pathname = "/topic/jfk/";
    resolvePage.mockResolvedValue({
      canonicalTitle: "John F. Kennedy",
      displayTitle: "John F. Kennedy",
      qid: "Q9696",
    });
    render(<TopicView />);
    // The TARGET's heading — never "jfk".
    expect(
      await screen.findByRole("heading", { name: "John F. Kennedy", level: 1 })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "jfk" })).toBeNull();
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/John_F._Kennedy/")
    );
    expect(routerReplace).toHaveBeenCalledTimes(1);
  });

  it("AC4: the bell hooks split — URL /topic/Bell_hooks/, heading 'bell hooks'", async () => {
    pathname = "/topic/bell_hooks/";
    resolvePage.mockResolvedValue({
      canonicalTitle: "Bell hooks", // capital B keys the URL
      displayTitle: "bell hooks", // lowercase keys the heading
      qid: "Q259507",
    });
    render(<TopicView />);
    // Heading is the lowercase display title…
    expect(
      await screen.findByRole("heading", { name: "bell hooks", level: 1 })
    ).toBeInTheDocument();
    // …and the URL snaps to the capital-B canonical form.
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/Bell_hooks/")
    );
    // The "From Wikipedia" attribution link stays keyed on the CANONICAL title (capital
    // B), NEVER the lowercase display title (scope item 2). fetchFullArticle builds the
    // article URL from the canonical title via encodeURIComponent (space → %20).
    const wikiLink = screen.getByRole("link", { name: "Wikipedia" });
    expect(wikiLink).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Bell%20hooks"
    );
    // The display title never leaks into the canonical-keyed link.
    expect(wikiLink.getAttribute("href")).not.toContain("bell%20hooks");
    expect(wikiLink.getAttribute("href")).not.toContain("bell_hooks");
    // The article fetch used the CANONICAL title (the display title never keys a fetch/URL).
    expect(fetchFullArticle).toHaveBeenCalledWith("Bell hooks", "bell hooks");
  });

  it("AC5: already-canonical /topic/Calvin_cycle/ → NO router.replace", async () => {
    pathname = "/topic/Calvin_cycle/";
    resolvePage.mockResolvedValue({
      canonicalTitle: "Calvin cycle",
      displayTitle: "Calvin cycle",
      qid: "Q189445",
    });
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Calvin cycle", level: 1 });
    // Give any (incorrect) canonicalization a chance to fire, then assert it didn't.
    await waitFor(() => expect(fetchFullArticle).toHaveBeenCalled());
    expect(routerReplace).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("AC5: a multi-word canonical that already matches (Photosynthesis) → NO replace", async () => {
    pathname = "/topic/Photosynthesis/";
    resolvePage.mockResolvedValue({
      canonicalTitle: "Photosynthesis",
      displayTitle: "Photosynthesis",
      qid: "Q11982",
    });
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Photosynthesis", level: 1 });
    await waitFor(() => expect(fetchFullArticle).toHaveBeenCalled());
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("AC6: an UNRESOLVED title → no replace, reaches the not-found path", async () => {
    pathname = "/topic/glorpwobble/"; // not seeded, and the API resolves nothing
    resolvePage.mockResolvedValue({
      canonicalTitle: null,
      displayTitle: null,
      qid: null,
    });
    render(<TopicView />);
    // The existing "Topic not found. Back home" resolve-error state (#19's territory).
    expect(await screen.findByText(/Topic not found/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back home" })
    ).toBeInTheDocument();
    // Never a canonicalization to an empty/partial slug; never a push.
    expect(routerReplace).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    // The article fetch never ran for an unresolved title (no flash of a Topic shell).
    expect(fetchFullArticle).not.toHaveBeenCalled();
  });
});
