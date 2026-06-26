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
//   - The reader-facing completion signal + the reveal live in the PLUS RAIL (design
//     complete-toggle-rail.md) — the honest "Marked complete" copy + the show/hide button — after the
//     curated rail cards, NOT in the General strip and NOT in the wiki+ Overview card.
//   - AC4/AC16: a signed-in curator sees the mark/un-mark control (card foot); a logged-out viewer
//               sees no mutating control but can still override.
//   - A complete + zero-curated topic OMITS the General band (it would carry only suppressed
//     suggestion chrome); the reveal toggle lives in the rail, and the article stays calm.
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
// The plus rail is the only labelled `complementary` region ("wiki+ … videos"); the Overview-card
// aside carries no accessible name, so the name filter resolves the rail unambiguously.
function rail(): HTMLElement {
  return screen.getByRole("complementary", { name: /wiki\+/i });
}

// A SECTION-anchored curated clip (NOT general) → it lands in the plus rail as a ClipCard, so the
// relocated toggle has a "last curated rail card" to sit after (AC2).
function sectionClip(): Omit<Clip, "id" | "createdAt"> {
  return {
    topicQid: QID,
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=section1",
    embedUrl: "https://www.youtube-nocookie.com/embed/section1",
    caption: "A curated glycolysis clip",
    creator: { handle: "@teacher", name: "Teacher", platform: "youtube" },
    general: false,
    sectionSlug: "glycolysis",
    sectionLabel: "Glycolysis",
    stance: "explainer",
    accuracyFlag: "accurate",
    contextNote: "A clear look at glycolysis.",
    curatedBy: "@teacher",
  };
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

  it("AC1 — the completion signal + reveal live in the plus rail, not the band or the Overview card", async () => {
    render(<TopicView />);
    // "Marked complete" + the honest body line live in the RAIL's toggle card.
    await waitFor(() =>
      expect(within(rail()).getByText(/Marked complete/i)).toBeTruthy()
    );
    expect(
      within(rail()).getByText(
        /A curator marked this complete, so suggestions are hidden/i
      )
    ).toBeTruthy();
    // The reveal toggle (any viewer) is present — in the rail.
    expect(
      within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeTruthy();
    // NOT in the General band (the band is the video showcase, no complete-state control).
    expect(within(band()!).queryByText(/Marked complete/i)).toBeNull();
    // The signal is not duplicated — only the rail (the Overview card carries no status notice).
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

describe("Marked complete — toggle placement in the rail (AC2)", () => {
  beforeEach(async () => {
    // A SECTION-anchored curated clip → a ClipCard in the rail; mark complete so the toggle renders.
    await store.addClip(sectionClip());
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("AC2 — the toggle card follows the last curated rail ClipCard in DOM order", async () => {
    render(<TopicView />);
    // The curated section clip's curator-note text is the rail ClipCard's stable visible anchor.
    await waitFor(() =>
      expect(within(rail()).getByText(/A clear look at glycolysis/i)).toBeTruthy()
    );
    const railEl = rail();
    const curatedCard = within(railEl).getByText(/A clear look at glycolysis/i);
    const toggleBtn = within(railEl).getByRole("button", {
      name: /Show suggestions for this topic/i,
    });
    // The toggle FOLLOWS the curated rail card (AC2 — "after the last curated video").
    expect(
      curatedCard.compareDocumentPosition(toggleBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  // AC6 edge — the orchestrator-flagged "only SECTION clips, no general curated video" suppressed
  // case. `generalClips.length === 0` (the section clip is `general:false`), so the band-omission
  // guard `suppressSuggestions && generalClips.length === 0` fires: the band must be OMITTED (it would
  // carry only suppressed suggestion chrome) while the rail's curated ClipCard + toggle still render.
  it("AC6 — only section curated clips (zero general) + suppressed: the General band is omitted, the rail keeps its card + toggle", async () => {
    render(<TopicView />);
    await waitFor(() =>
      expect(within(rail()).getByText(/A clear look at glycolysis/i)).toBeTruthy()
    );
    // Give the suppressed candidate pipeline a tick — it must not resurrect the band.
    await new Promise((r) => setTimeout(r, 50));
    expect(band()).toBeNull(); // band OMITTED (no general curated video, suggestions suppressed)
    expect(
      within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeTruthy(); // the rail toggle is still the reveal's home
  });

  // The matching keep-path: overriding at zero-general/only-section-clips lifts suppression and the
  // band reappears with its (general-matching) candidate tiles — proving omission is purely the
  // suppressed-empty guard, never a permanent removal.
  it("AC12 — overriding at only-section-clips reveals the General band (with its suggestion tiles) in place", async () => {
    const user = userEvent.setup();
    render(<TopicView />);
    await waitFor(() =>
      expect(
        within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
      ).toBeTruthy()
    );
    expect(band()).toBeNull();
    await user.click(
      within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
    );
    await waitFor(() => expect(band()).not.toBeNull());
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0));
  });
});

// AC7 — a complete topic with ZERO underlying suggestions shows the toggle NOWHERE (it never promises
// a reveal it can't deliver). The harness here returns zero YouTube items, so `liveCandidates` is
// empty → `hasUnderlyingSuggestions` is false → the rail gate `closedToSuggestions &&
// hasUnderlyingSuggestions` is false. This is the orchestrator-flagged AC7 surface (previously
// untested through TopicView).
describe("Marked complete + ZERO underlying suggestions — no toggle anywhere (AC7)", () => {
  beforeEach(async () => {
    // Override the default suggesting mock: zero candidate items → nothing to reveal.
    mockYtSearch([]);
    await store.addClip(generalClip()); // a curated video so the band still renders (fully-curated)
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("AC7 — no reveal toggle in the rail, the band, or anywhere; no 'Marked complete' card", async () => {
    render(<TopicView />);
    // The curated band renders (fully-curated), proving the page mounted past the suppressed pipeline.
    await waitFor(() => expect(band()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    // No underlying suggestion to reveal → the toggle is omitted EVERYWHERE.
    expect(
      screen.queryByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Hide suggestions again/i })
    ).toBeNull();
    // The rail toggle CARD (its honest "Marked complete" framing) is not rendered either.
    expect(screen.queryByText(/A curator marked this complete, so suggestions are hidden/i)).toBeNull();
    // No band candidate tiles (suppressed AND none exist anyway).
    expect(bandCandcards()).toBe(0);
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

describe("Marked complete + zero curated videos — band omitted, rail toggle (AC6/AC8)", () => {
  beforeEach(async () => {
    // No curated clip added — Q189603 is the uncurated seed topic. Mark complete.
    await store.setTopicClosedToSuggestions(QID, true);
  });

  it("omits the General band entirely; the reveal toggle is the rail's first item; the article stays calm", async () => {
    render(<TopicView />);
    // The rail toggle is the reveal's home (the rail's first item — there are no curated cards).
    await waitFor(() =>
      expect(
        within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
      ).toBeTruthy()
    );
    // Give the (suppressed) candidate pipeline a tick — it must NOT resurrect the band.
    await new Promise((r) => setTimeout(r, 50));
    // The band is OMITTED (no near-empty shell, no minimal band, no candidate tiles / bootstrap chrome).
    expect(band()).toBeNull();
    expect(within(rail()).getByText(/Marked complete/i)).toBeTruthy();
    // A finished topic offers no "add more": no ＋ Add video anywhere, even for a signed-in curator.
    expect(screen.queryByRole("button", { name: /Add video/i })).toBeNull();
    // The article column still renders normally.
    expect(screen.getByText(/Lead text here/i)).toBeTruthy();
  });

  it("AC12 — the override reveals the band (and its suggestions) in place even at zero curated videos", async () => {
    const user = userEvent.setup();
    render(<TopicView />);
    await waitFor(() =>
      expect(
        within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
      ).toBeTruthy()
    );
    await user.click(
      within(rail()).getByRole("button", { name: /Show suggestions for this topic/i })
    );
    // Override on → suppression lifts → the band reappears with its general candidate tiles.
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

  // AC8 — read-path parity: a not-complete topic carries NO reveal toggle anywhere (the toggle is a
  // complete-only surface, gated on `closedToSuggestions`). Strengthens the "no regression" check by
  // asserting the button and its honest framing are absent in both the band and the rail.
  it("AC8 — a not-complete topic renders no reveal toggle (button or framing) anywhere", async () => {
    render(<TopicView />);
    await waitFor(() => expect(band()).not.toBeNull());
    await waitFor(() => expect(bandCandcards()).toBeGreaterThan(0));
    expect(
      screen.queryByRole("button", { name: /Show suggestions for this topic/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Hide suggestions again/i })
    ).toBeNull();
    expect(
      screen.queryByText(/A curator marked this complete, so suggestions are hidden/i)
    ).toBeNull();
  });
});
