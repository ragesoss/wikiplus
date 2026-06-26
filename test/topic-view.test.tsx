import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// Integration test for the page state machine (AC1 layout, AC2/AC3 article render,
// AC4 attribution, AC14 empty CTA, AC20 store-driven curated-vs-empty, loading +
// error states). The wiki module is MOCKED (no network egress in the sandbox).

const article: FullArticle = {
  title: "Photosynthesis",
  displayTitle: "Photosynthesis",
  url: "https://en.wikipedia.org/wiki/Photosynthesis",
  styleCss: "",
  lead: {
    title: "Photosynthesis",
    url: "https://en.wikipedia.org/wiki/Photosynthesis",
    leadHtml:
      '<p>Photosynthesis is a <a href="/topic/Process/" data-topic-title="Process">process</a>.</p>',
  },
  sections: [
    { slug: "light-dependent-reactions", title: "Light-dependent reactions", level: 2, html: "<p>LDR body.</p>" },
    { slug: "calvin-cycle", title: "Calvin cycle", level: 2, html: "<p>CC body.</p>" },
    { slug: "water-photolysis", title: "Water photolysis", level: 2, html: "<p>WP body.</p>" },
    { slug: "order-and-kinetics", title: "Order and kinetics", level: 2, html: "<p>OK body.</p>" },
    { slug: "photosynthetic-membranes-and-organelles", title: "Photosynthetic membranes and organelles", level: 2, html: "<p>PM body.</p>" },
  ],
};

// Routing inputs: most tests drive the back-compat `?qid=` entry (pathname `/topic/`,
// no title); the title-route test sets `pathname` instead. `routerReplace` records the
// canonicalization (QID → title URL). `qidToTitle`/`titleToQid` resolve under the hood.
let qid = "Q11982";
let pathname = "/topic/";
const routerReplace = vi.fn();
const routerPush = vi.fn();
const fetchFullArticle = vi.fn();

// A STABLE router object — the real next/navigation useRouter returns a referentially
// stable instance, so the resolution effect (which depends on `router`) fires once per
// genuine input change rather than re-firing on every re-render (#23 added `pathname`
// to that effect's deps; an unstable router would re-trigger it on each post-mount
// state commit and loop).
const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(qid ? `qid=${qid}` : ""),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Photosynthesis"),
  titleToQid: vi.fn(async () => "Q11982"),
  // #23: TopicView's title route resolves via resolvePage (canonical + display + QID
  // in one call). Mocked to the canonical seeded title so the title-route test's
  // already-canonical arrival fires no router.replace (AC5 parity).
  resolvePage: vi.fn(async (title: string) => ({
    canonicalTitle: title,
    displayTitle: title,
    qid: "Q11982",
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));
// Issue #45: the production @/lib/data seam routes through Server Actions → Postgres (not
// runnable in jsdom). Mock it to the localStorage-backed test double, preserving the pre-#45
// behavior these state-machine tests rely on (incl. a test `seedIfEmpty`).
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

// A minimal YouTube search.list item the live source can normalize (F5 — drives the
// live flow through TopicView end-to-end, with the network MOCKED like article.test.ts).
function ytItem(videoId: string, title: string, description = "") {
  return {
    id: { videoId, kind: "youtube#video" },
    snippet: {
      title,
      description,
      channelTitle: "Some Channel",
      channelId: "UC123",
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, width: 480, height: 360 } },
    },
  };
}
function mockYtSearch(items: ReturnType<typeof ytItem>[]) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  qid = "Q11982";
  pathname = "/topic/"; // back-compat ?qid= entry unless a test overrides
  await seedIfEmpty(); // seed the curated Photosynthesis + uncurated topics
});
afterEach(() => {
  // Full hygiene so the live-flow suite's stubs (a `vi.spyOn(fetch)` spy +
  // `vi.stubEnv`/`vi.stubGlobal`) cannot bleed into sibling tests run in this file
  // alone. `beforeEach` re-arms the module-level `vi.fn()` mocks and re-seeds the
  // store, so restoring spies/env/globals here is safe. (issue #5 / AC1)
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TopicView — curated state (AC1, AC2, AC3, AC4, AC7, AC20)", () => {
  beforeEach(() => {
    qid = "Q11982";
    fetchFullArticle.mockResolvedValue(article);
  });

  it("renders the seam-aligned wiki+ wordmark as a home link (AC1; #72 AC1/AC3)", async () => {
    render(<TopicView />);
    // #72: the bespoke two-block TopicHeader is retired for the shared Daylight Projector header.
    // The wordmark renders the split serif "Wiki" + the indigo "plus" block (now via HeaderProjector,
    // cross-faded Tier-A lit + flat slim mark, so each appears more than once — tolerate multiples),
    // and is a real link to / with the accessible name "wiki+" (the universal home affordance, AC3).
    expect(screen.getAllByText("Wiki").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("plus")).length).toBeGreaterThan(0);
    const homeLinks = screen.getAllByRole("link", { name: "wiki+" });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    homeLinks.forEach((l) => expect(l).toHaveAttribute("href", "/"));
  });

  it("renders the real article title + sections once the fetch resolves (AC2/AC3)", async () => {
    render(<TopicView />);
    expect(
      await screen.findByRole("heading", { name: "Photosynthesis", level: 1 })
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Calvin cycle" })).toBeInTheDocument();
    // section heading carries a stable id usable as a scroll anchor (AC3)
    expect(document.getElementById("h-calvin-cycle")).not.toBeNull();
  });

  it("shows the CC BY-SA + QID attribution linking to the source article (AC4)", async () => {
    render(<TopicView />);
    const attribution = await screen.findByText(/CC BY-SA 4\.0/);
    expect(attribution).toHaveTextContent("Wikidata Q11982");
    const link = within(attribution).getByRole("link", { name: "Wikipedia" });
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Photosynthesis");
  });

  it("derives the infobox counts from the seeded clips (AC7) and renders the General strip (AC8)", async () => {
    render(<TopicView />);
    expect(await screen.findByText("Videos")).toBeInTheDocument();
    // "＋ General" appears in the TOC; the General-band heading is now sr-only ("General videos").
    expect(screen.getAllByText("＋ General").length).toBeGreaterThanOrEqual(1);
    // 13 seeded curated Photosynthesis clips → infobox Videos count is derived.
    const videosBlock = screen.getByText("Videos").closest("div")!;
    expect(within(videosBlock).getByText("13")).toBeInTheDocument();
  });

  it("renders the curated rail (no candidate SUGGESTED badges) — store-driven (AC20)", async () => {
    render(<TopicView />);
    await screen.findByText("Videos");
    expect(screen.queryByText("Suggested")).toBeNull();
    // at least one stance chip is present in the curated state
    expect(screen.getAllByText("Explainer").length).toBeGreaterThan(0);
  });
});

describe("TopicView — empty state (AC14, AC16, AC20)", () => {
  beforeEach(() => {
    qid = "Q189603"; // seeded uncurated topic (Cellular respiration)
    fetchFullArticle.mockResolvedValue({
      ...article,
      title: "Cellular respiration",
      displayTitle: "Cellular respiration",
      url: "https://en.wikipedia.org/wiki/Cellular_respiration",
      lead: { title: "Cellular respiration", url: "https://en.wikipedia.org/wiki/Cellular_respiration", leadHtml: "<p>Lead.</p>" },
      sections: [
        { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
        { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C.</p>" },
      ],
    });
  });

  it("renders the empty ＋plus card (volume block) when the store has no clips (AC20)", async () => {
    render(<TopicView />);
    // The card shows the dashed volume panel with the 'uncurated videos' label. There is no
    // Browse/Jump scroll button and no curate button (design overview-card-cleanup.md §3.2/§3.3).
    await screen.findByText("uncurated videos");
    expect(
      screen.queryByRole("button", { name: /Browse suggested videos/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "＋ Curate a video" })).toBeNull();
  });

  it("shows the 'Suggested videos · uncurated' band with the decluttered candidate treatment (#14 AC1/AC5)", async () => {
    render(<TopicView />);
    expect(await screen.findByText("＋ Suggested videos")).toBeInTheDocument();
    expect(screen.getByText("uncurated")).toBeInTheDocument();
    // #14 AC1: no per-card "SUGGESTED" badge anywhere on the page.
    expect(screen.queryByText("Suggested")).toBeNull();
    // #14 AC5: the one-time "unvetted set" header introduces the rail list exactly
    // once (it carries the "Suggested · uncurated" eyebrow + the once-only framing).
    const setHeaders = screen.getAllByText("Suggested · uncurated");
    expect(setHeaders).toHaveLength(1);
  });
});

describe("TopicView — loading & error states (design §7)", () => {
  it("shows the article skeleton while the fetch is in flight (loading)", async () => {
    qid = "Q11982";
    let resolve!: (a: FullArticle) => void;
    fetchFullArticle.mockReturnValue(new Promise<FullArticle>((r) => (resolve = r)));
    render(<TopicView />);
    expect(await screen.findByText("Loading article…")).toBeInTheDocument();
    resolve(article);
    await waitFor(() =>
      expect(screen.queryByText("Loading article…")).toBeNull()
    );
  });

  it("shows the inline error card with retry + Open-on-Wikipedia when the fetch fails (error)", async () => {
    qid = "Q11982";
    fetchFullArticle.mockRejectedValue(new Error("network"));
    render(<TopicView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Couldn't load the article/
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    const out = screen.getByRole("link", { name: /Open on Wikipedia/ });
    expect(out).toHaveAttribute("target", "_blank");
    expect(out).toHaveAttribute("rel", "noopener");
  });
});

// D1/AC5/AC23 — canonical title-based route. A wikilink lands on /topic/<Title>;
// the QID is resolved UNDER THE HOOD (here via the store's seeded title→QID, no API
// call needed) and never put back in the URL. The curated topic renders by title alone.
describe("TopicView — canonical title route (D1, AC5, AC23)", () => {
  beforeEach(() => {
    qid = ""; // no ?qid= — the title in the path is the only input
    pathname = "/topic/Photosynthesis/";
    fetchFullArticle.mockResolvedValue(article);
  });

  it("resolves the title to the seeded topic and renders it (no QID in the URL)", async () => {
    render(<TopicView />);
    // Article renders from the title alone…
    expect(
      await screen.findByRole("heading", { name: "Photosynthesis", level: 1 })
    ).toBeInTheDocument();
    // …and the store lookup keyed by the resolved QID surfaces the seeded clips (curated).
    const videosBlock = screen.getByText("Videos").closest("div")!;
    expect(within(videosBlock).getByText("13")).toBeInTheDocument();
    // The article fetch was driven by the canonical TITLE (+ the resolved display
    // title, #23), never a QID.
    expect(fetchFullArticle).toHaveBeenCalledWith("Photosynthesis", "Photosynthesis");
    // No URL rewrite — the title slug already equals titleToSlug(canonicalTitle) (AC5).
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("still shows the QID-backed attribution though the URL stays title-based (AC4)", async () => {
    render(<TopicView />);
    const attribution = await screen.findByText(/CC BY-SA 4\.0/);
    expect(attribution).toHaveTextContent("Wikidata Q11982");
  });

  it("intercepts a wikilink click and routes in-SPA (no full reload) — AC5", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<TopicView />);
    await screen.findByText("process");
    // The lead is injected via `dangerouslySetInnerHTML`, so the wikilink is raw DOM whose
    // only handler is the container `<div onClick={onArticleClick}>` (delegated). After
    // first mount, TopicView fires several post-mount state updates (canonicalization,
    // storeReady, candidate load) that re-commit the lead — which DETACHES the node RTL
    // captured on the first `findByText`. Clicking that stale, orphaned node never bubbles
    // to the container, so the handler never runs and jsdom attempts a real <a> navigation
    // (the #5 race). Fix: wait until a LIVE "process" node is connected under the onClick
    // container, then re-query and click that node.
    await waitFor(() => {
      const a = screen.getByText("process").closest("a");
      expect(a?.isConnected).toBe(true);
      expect(a?.closest("div.min-w-0")).not.toBeNull();
    });
    const link = screen.getByText("process");
    // fireEvent (not userEvent): a raw bubbling click is what the delegated handler sees;
    // userEvent.click on an <a href> drives jsdom's unimplemented navigation instead.
    fireEvent.click(link);
    // Routed via the Next client router to the canonical title URL (no QID, no reload).
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith("/topic/Process/")
    );
    expect(routerReplace).not.toHaveBeenCalled(); // title route needs no canonicalization
  });
});

// Back-compat: a legacy ?qid= entry resolves QID→title and canonicalizes the URL to
// the title-based form (QID drops out of the address bar) — D1/AC23.
describe("TopicView — ?qid= back-compat canonicalization (AC23)", () => {
  it("replaces the ?qid= URL with the canonical /topic/<Title>/ route", async () => {
    qid = "Q11982";
    pathname = "/topic/";
    fetchFullArticle.mockResolvedValue(article);
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Photosynthesis", level: 1 });
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith("/topic/Photosynthesis/")
    );
    // The canonical target carries no QID.
    expect(routerReplace.mock.calls[0][0]).not.toMatch(/qid|Q11982/);
  });
});

describe("TopicView — candidate dismiss (AC19)", () => {
  beforeEach(() => {
    qid = "Q189603";
    fetchFullArticle.mockResolvedValue({
      ...article,
      title: "Cellular respiration",
      displayTitle: "Cellular respiration",
      sections: [{ slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" }],
    });
  });

  it("removes a candidate and decrements the visible suggestion count on 'Not relevant'", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<TopicView />);
    // 5 seeded candidates → the empty ＋plus volume panel shows the suggestion numeral "5"
    // (plus-overview-redesign §6.1). The numeral sits next to the stable volume label, so
    // scope the assertion to that panel to disambiguate it from any other "5" on the page.
    const volumePanel = (
      await screen.findByText("uncurated videos")
    ).closest("div")!.parentElement!;
    expect(within(volumePanel).getByText("5")).toBeInTheDocument();
    const dismissBtns = await screen.findAllByRole("button", {
      name: /Dismiss as not relevant/,
    });
    await userEvent.click(dismissBtns[0]);
    await waitFor(() =>
      expect(within(volumePanel).getByText("4")).toBeInTheDocument()
    );
  });
});

// F5 — the LIVE candidate flow exercised through TopicView end-to-end. The YouTube
// source is enabled via the env key and its single search.list call is MOCKED (no
// network — same posture as article.test.ts). This covers the loading→populated/zero
// transition + the aria-live announcement (AC2), sticky dismissal across a remount
// (AC9; design §6.3), and no-second-source-call on revisit within the 24h TTL (AC11).
describe("TopicView — live candidate flow (F5: AC2/AC9/AC11 through the view)", () => {
  const liveArticle: FullArticle = {
    ...article,
    title: "Cellular respiration",
    displayTitle: "Cellular respiration",
    url: "https://en.wikipedia.org/wiki/Cellular_respiration",
    lead: {
      title: "Cellular respiration",
      url: "https://en.wikipedia.org/wiki/Cellular_respiration",
      leadHtml: "<p>Lead.</p>",
    },
    sections: [
      { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
      { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C.</p>" },
    ],
  };

  beforeEach(() => {
    qid = "Q189603"; // uncurated topic → the live path runs (no clips to dedup against)
    fetchFullArticle.mockResolvedValue(liveArticle);
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "test-key"); // enables the live source
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("(a) loads then resolves to a populated set and announces the count (AC2)", async () => {
    mockYtSearch([
      ytItem("v1", "Glycolysis explained step by step"),
      ytItem("v2", "A cellular respiration overview"),
    ]);
    render(<TopicView />);
    // The live results replace the seed: v2's caption appears as a general candidate.
    expect(
      await screen.findByText("A cellular respiration overview")
    ).toBeInTheDocument();
    // The polite live region announces the resolved count (design §5.4 / §8). The page
    // now hosts more than one role=status region (the navbar TopicSearch adds its own
    // suggestion live region, #12), so assert that SOME status region carries the count.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((el) => /Found \d+ suggested videos\./.test(el.textContent || ""))
      ).toBe(true)
    );
  });

  it("(a) a zero-result live search announces 'No suggested videos found.' (AC2 zero)", async () => {
    mockYtSearch([]); // obscure topic → nothing after normalize
    render(<TopicView />);
    // More than one role=status region exists now (#12 navbar search); assert the
    // zero-result line is announced by SOME status region.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((el) => (el.textContent || "").includes("No suggested videos found."))
      ).toBe(true)
    );
    // The honest zero line shows (design §5.2), not an empty tile row.
    expect(
      await screen.findByText(/No videos found for this topic yet/)
    ).toBeInTheDocument();
  });

  it("(b) a dismissal persists across a remount (sticky — AC9)", async () => {
    mockYtSearch([
      ytItem("v1", "Glycolysis explained step by step"),
      ytItem("v2", "A cellular respiration overview"),
    ]);
    const { default: userEvent } = await import("@testing-library/user-event");
    const { unmount } = render(<TopicView />);
    const caption = await screen.findByText("A cellular respiration overview");
    expect(caption).toBeInTheDocument();
    // Dismiss the v2 general candidate.
    const dismissBtns = await screen.findAllByRole("button", {
      name: /Dismiss as not relevant: A cellular respiration overview/,
    });
    await userEvent.click(dismissBtns[0]);
    await waitFor(() =>
      expect(
        screen.queryByText("A cellular respiration overview")
      ).not.toBeInTheDocument()
    );
    // Remount (simulates a reload): the dismissal is read back from localStorage and
    // the cache is warm — the candidate must NOT resurface (AC9; design §6.3).
    unmount();
    render(<TopicView />);
    // The OTHER candidate (v1, a section match → in the plus rail) still renders
    // (proves the live set loaded), but the dismissed general one stays gone. (Since
    // #21 retired the inline-under-section placement, a section match appears ONLY in
    // the rail — `findAllByText` here is tolerant of the single rail occurrence.)
    expect(
      (await screen.findAllByText("Glycolysis explained step by step")).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("A cellular respiration overview")
    ).not.toBeInTheDocument();
  });

  it("(c) revisiting within the TTL does not call the source again (AC11)", async () => {
    const fetchSpy = mockYtSearch([ytItem("v1", "Glycolysis explained step by step")]);
    const { unmount } = render(<TopicView />);
    // v1 matches the Glycolysis section → appears in the plus rail (not also rendered
    // inline in the article body).
    await screen.findAllByText("Glycolysis explained step by step");
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    // Revisit (warm 24h cache): the source must NOT be called a second time.
    unmount();
    render(<TopicView />);
    await screen.findAllByText("Glycolysis explained step by step");
    // Give any (incorrect) re-fetch a chance to fire, then assert it didn't.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });
});
