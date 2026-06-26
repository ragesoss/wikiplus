import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FullArticle } from "@/lib/wiki/article";
import type { Clip } from "@/lib/data/types";

// ── Issue #159: "marked complete" suppression + indicator + per-viewer override, THROUGH TopicView.
// The presentation half of the feature (the data/boundary half is test/topic-complete.test.ts):
//   - AC5–AC10: a complete topic with underlying suggestions suppresses ALL suggestion chrome by
//               default (General candidate tiles, the rail CandidateSetHeader/cards, the
//               "Suggested · uncurated" divider, the wiki+ panel suggestion-volume line) for any
//               viewer; AC11: curated content still renders.
//   - AC12/AC15: the per-viewer "Show suggestions anyway" override reveals suggestions in place and
//               is reversible.
//   - The reader-facing completion signal + the reveal live in the General strip's TRAILING TOGGLE
//     (design overview-card-cleanup.md) — the honest "Marked complete" copy + the show/hide button —
//     NOT in the wiki+ Overview card.
//   - AC4/AC16: a signed-in curator sees the mark/un-mark control (card foot); a logged-out viewer
//               sees no mutating control but can still override.
//   - A complete + zero-curated topic renders a MINIMAL band holding just the toggle (not an omitted
//     band) so the reveal always has a home; the article stays calm.
//
// Harness mirrors test/coexistence.test.tsx: it drives the UNCURATED seed topic (Cellular
// respiration, Q189603) with the SAME general-matching YouTube captions that test proves produce
// General candidate tiles, so the suppression assertions have real chrome to suppress. A curated
// clip is added via the same store the view reads to reach the MIXED state.

const article: FullArticle = {
  title: "Cellular respiration",
  displayTitle: "Cellular respiration",
  url: "https://en.wikipedia.org/wiki/Cellular_respiration",
  styleCss: "",
  lead: {
    title: "Cellular respiration",
    url: "https://en.wikipedia.org/wiki/Cellular_respiration",
    leadHtml: "<p>Lead text here.</p>",
  },
  sections: [
    { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
    { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C.</p>" },
  ],
};

const QID = "Q189603";

let qid = QID;
let pathname = "/topic/";
let signedIn = true;
const routerReplace = vi.fn();
const routerPush = vi.fn();
const fetchFullArticle = vi.fn();

const router = { replace: routerReplace, push: routerPush };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(qid ? `qid=${qid}` : ""),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Cellular respiration"),
  titleToQid: vi.fn(async () => QID),
  resolvePage: vi.fn(async (title: string) => ({
    canonicalTitle: title,
    displayTitle: title,
    qid: QID,
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));

vi.mock("next-auth/react", () => ({
  useSession: () =>
    signedIn
      ? {
          data: { user: { contributorId: 7, username: "Tester" } },
          status: "authenticated",
        }
      : { data: null, status: "unauthenticated" },
}));

vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { store } from "@/lib/data";
import { seedIfEmpty } from "./helpers/data-mock";

function ytItem(videoId: string, title: string, description = "") {
  return {
    id: { videoId, kind: "youtube#video" },
    snippet: {
      title,
      description,
      channelTitle: "Some Channel",
      channelId: "UC123",
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${videoId}/hq.jpg`, width: 480, height: 360 },
      },
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

// A general-overview curated clip on Q189603 — turns the topic MIXED (curated + suggestions).
function generalClip(): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: QID,
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=curated1",
    embedUrl: "https://www.youtube-nocookie.com/embed/curated1",
    caption: "A curated respiration overview",
    creator: { handle: "@teacher", name: "Teacher", platform: "youtube" },
    general: true,
    stance: "explainer",
    accuracyFlag: "accurate",
    contextNote: "A clear overview of the whole process.",
    curatedBy: "@teacher",
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  qid = QID;
  pathname = "/topic/";
  signedIn = true;
  await seedIfEmpty();
  fetchFullArticle.mockResolvedValue(article);
  // The same general-matching captions the coexistence suite proves produce General candidate tiles.
  mockYtSearch([
    ytItem("g1", "A cellular respiration overview"),
    ytItem("g2", "Another respiration deep-dive"),
    ytItem("g3", "Respiration in plants"),
  ]);
  vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "test-key");
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function band(): HTMLElement | null {
  return document.getElementById("general-band");
}
function bandCandcards(): number {
  return band()?.querySelectorAll(".candcard").length ?? 0;
}

describe("Marked complete — default suppression (mixed: curated + suggestions)", () => {
  beforeEach(async () => {
    await store.addClip(generalClip());
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("AC5/AC6/AC7 — no General-band candidate tiles, divider, or 'See N more'; curated stays (AC11)", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    // Give the (suppressed) candidate pipeline a tick — it must NOT surface tiles.
    await new Promise((r) => setTimeout(r, 50));
    expect(bandCandcards()).toBe(0); // AC5
    expect(within(band()!).queryByText(/Suggested · uncurated/i)).toBeNull(); // AC6
    expect(within(band()!).queryByText(/See \d+ more/i)).toBeNull(); // AC7
    // AC11 — curated content still renders (the curated `＋ General` heading + curated caption).
    expect(within(band()!).getByRole("heading", { name: /General/i })).toBeTruthy();
    expect(within(band()!).getByText(/A curated respiration overview/i)).toBeTruthy();
  });

  it("AC9/AC10 — no rail unvetted-set header and no wiki+ panel two-count line", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    // AC9 — the "Suggested · uncurated" set header/divider is gone everywhere.
    expect(screen.queryAllByText(/Suggested · uncurated/i).length).toBe(0);
    // AC10 — the mixed two-count "{V} curated · {M} suggested" line is gone (the precise pattern).
    expect(screen.queryByText(/\d+ curated ·/i)).toBeNull();
  });

  it("the completion signal + reveal live in the strip's trailing toggle, not the card", async () => {
    render(<TopicView />);
    // "Marked complete" + the honest body line now live in the strip's trailing toggle card.
    await waitFor(() =>
      expect(within(band()!).getByText(/Marked complete/i)).toBeTruthy()
    );
    expect(
      within(band()!).getByText(
        /A curator marked this complete, so suggestions are hidden/i
      )
    ).toBeTruthy();
    // The reveal toggle (any viewer) is present.
    expect(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeTruthy();
    // The signal lives ONLY in the band now — it is not duplicated in the Overview card.
    expect(screen.getAllByText(/Marked complete/i)).toHaveLength(1);
  });

  it("AC12/AC15 — the per-viewer override reveals suggestions in place, and is reversible", async () => {
    const user = userEvent.setup();
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    expect(bandCandcards()).toBe(0);

    await user.click(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    );
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0)); // AC12

    const hideBtn = screen.getByRole("button", { name: /Hide suggestions again/i });
    await user.click(hideBtn);
    await waitFor(() => expect(bandCandcards()).toBe(0)); // AC15
  });

  it("AC4 (affordance) — a signed-in curator sees the un-mark control ('Reopen')", async () => {
    render(<TopicView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Reopen this topic to suggestions/i })
      ).toBeTruthy()
    );
  });

  it("AC8 — no dashed/suggested ('~{s}') TOC counts while suppressed; curated counts unaffected (AC11)", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    const toc = screen.getByRole("navigation", { name: /Table of contents/i });
    // AC8 — every dashed suggested badge carries the sr-only " suggested, unvetted" word; with
    // suggestions suppressed (fed an empty set) the gate `suggested > 0` is false on every row, so
    // none render. The badge text would also show the `~{s}` numeral — neither is present.
    expect(within(toc).queryByText(/suggested, unvetted/i)).toBeNull();
    expect(within(toc).queryByText(/^~\d+$/)).toBeNull();
    // AC11 — the curated count badge for the General row still renders (the curated clip is there):
    // its sr-only word is " curated", proving only the SUGGESTED layer was suppressed, not curated.
    expect(within(toc).getAllByText(/^\s*curated\s*$/i).length).toBeGreaterThan(0);
  });

  it("AC8/AC12 — the dashed suggested TOC count reappears for this viewer after override", async () => {
    const user = userEvent.setup();
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    const toc = screen.getByRole("navigation", { name: /Table of contents/i });
    expect(within(toc).queryByText(/suggested, unvetted/i)).toBeNull();
    await user.click(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    );
    // After the override, the underlying suggestions present again — so the dashed `~{s}` badge
    // (with its " suggested, unvetted" sr-only word) reappears for this viewer.
    await waitFor(() =>
      expect(within(toc).queryAllByText(/suggested, unvetted/i).length).toBeGreaterThan(0)
    );
  });

  it("AC13 — the override is session-local (sessionStorage, QID-keyed) and never a DB write", async () => {
    const user = userEvent.setup();
    // Spy on the persisted-flag write: the override must NEVER call it (it is a pure client reveal).
    const setFlag = vi.spyOn(store, "setTopicClosedToSuggestions");
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));

    await user.click(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    );
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0));

    // Session-local: written under a QID-scoped sessionStorage key, NOT the DB.
    expect(window.sessionStorage.getItem(`wikiplus.suggestions-override.${QID}`)).toBe("1");
    expect(setFlag).not.toHaveBeenCalled();
    // Per-topic (AC13): a DIFFERENT topic B's key is untouched — overriding A never reveals B.
    expect(
      window.sessionStorage.getItem("wikiplus.suggestions-override.Q-other")
    ).toBeNull();

    // Reversible (AC15) clears the key rather than persisting an "off" — still no DB write.
    await user.click(
      screen.getByRole("button", { name: /Hide suggestions again/i })
    );
    await waitFor(() => expect(bandCandcards()).toBe(0));
    expect(
      window.sessionStorage.getItem(`wikiplus.suggestions-override.${QID}`)
    ).toBeNull();
    expect(setFlag).not.toHaveBeenCalled();
  });
});

describe("Marked complete — logged-out viewer", () => {
  beforeEach(async () => {
    signedIn = false;
    await store.addClip(generalClip());
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("AC4 — no mark/un-mark control; AC16 — the override still works logged-out", async () => {
    render(<TopicView />);
    await waitFor(() => expect(screen.getByText(/Marked complete/i)).toBeTruthy());
    expect(
      screen.queryByRole("button", { name: /Reopen this topic to suggestions/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Mark this topic complete/i })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeTruthy();
  });
});

describe("Marked complete + zero curated videos — minimal render (AC18)", () => {
  beforeEach(async () => {
    // No curated clip added — Q189603 is the uncurated seed topic. Mark complete.
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("renders a minimal band holding just the toggle (no candidate tiles), article stays calm (AC8)", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    // The minimal band carries the toggle card but NO candidate tiles / suggestion bootstrap chrome.
    expect(within(band()!).getByText(/Marked complete/i)).toBeTruthy();
    expect(bandCandcards()).toBe(0);
    expect(within(band()!).queryByText("＋ Suggested videos")).toBeNull();
    expect(within(band()!).queryByText("uncurated")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeTruthy();
    // A finished topic offers no "add more": the curator find-more (＋ Add video) is suppressed in
    // the minimal band, even for a signed-in curator (they reopen first to add).
    expect(screen.queryByRole("button", { name: /Add video/i })).toBeNull();
    // The article column still renders normally.
    expect(screen.getByText(/Lead text here/i)).toBeTruthy();
  });

  it("the override reveals the band in place even at zero curated videos", async () => {
    const user = userEvent.setup();
    render(<TopicView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Show suggestions for this topic/i })
      ).toBeTruthy()
    );
    await user.click(
      screen.getByRole("button", { name: /Show suggestions for this topic/i })
    );
    await waitFor(() => expect(band()).not.toBeNull());
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0));
  });
});

describe("Not marked complete — baseline unchanged", () => {
  it("a NON-complete topic still shows suggestion chrome (no regression)", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    expect(screen.queryByText(/Marked complete/i)).toBeNull();
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0));
    // The signed-in curator sees the "Mark topic complete" affordance.
    expect(
      screen.getByRole("button", { name: /Mark this topic complete/i })
    ).toBeTruthy();
  });
});
