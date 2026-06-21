import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// ── Issue #60: curated and suggested videos COEXIST on a Topic page. ──────────────────────────
// This suite exercises the three-state coexistence model THROUGH TopicView, with the focus on
// AC10 (no churn — the primary bar): curating ONE suggestion changes exactly one video and leaves
// every other suggestion's identity/order/position untouched, with NO re-run of the candidate
// pipeline (`suggestCandidates`) and NO re-derivation of the set from scratch.
//
// The wiki module is MOCKED (no network egress). The @/lib/data seam is the localStorage-backed
// test double, but we SPY on `store.suggestCandidates` so we can assert it is not re-invoked on
// curation. The session is mocked signed-in so the curate flow proceeds (the curate gate clears).

const article: FullArticle = {
  title: "Cellular respiration",
  displayTitle: "Cellular respiration",
  url: "https://en.wikipedia.org/wiki/Cellular_respiration",
  styleCss: "",
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

let qid = "Q189603";
let pathname = "/topic/";
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
  titleToQid: vi.fn(async () => "Q189603"),
  resolvePage: vi.fn(async (title: string) => ({
    canonicalTitle: title,
    displayTitle: title,
    qid: "Q189603",
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));

// A signed-in session so the curate gate clears and the CurateModal opens (off the read path;
// an anonymous render does no session work — the curate path needs a contributor id).
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { contributorId: 7, username: "Tester" } },
    status: "authenticated",
  }),
}));

// The data seam: the localStorage test double, with `suggestCandidates` wrapped in a spy so we
// can assert the pipeline is NOT re-invoked across a curation (AC10). We keep the REAL pipeline
// behind the spy so the live flow still resolves an ordered set.
const suggestSpy = vi.fn();
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  const real = buildDataMock();
  const wrapped = {
    ...real,
    store: {
      ...real.store,
      suggestCandidates: (input: Parameters<typeof real.store.suggestCandidates>[0]) => {
        suggestSpy(input);
        return real.store.suggestCandidates(input);
      },
    },
  };
  return wrapped;
});

import { TopicView } from "@/app/topic/TopicView";
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

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  suggestSpy.mockClear();
  qid = "Q189603";
  pathname = "/topic/";
  await seedIfEmpty();
  fetchFullArticle.mockResolvedValue(article);
  vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "test-key"); // enable the live source
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// The general SUGGESTION-pool order — the captions of the dashed `.candcard` tiles in the
// General band, in DOM order. Scoped to `.candcard` so a just-curated clip (which carries the
// same caption as the candidate it was promoted from, but renders as a SOLID curated tile) is
// NOT counted as a suggestion. This is what AC10 snapshots: the suggestion set's identity/order.
function generalSuggestionCaptions(): string[] {
  const band = document.getElementById("general-band")!;
  return Array.from(band.querySelectorAll<HTMLElement>(".candcard")).map(
    (card) =>
      card.querySelector("p")?.textContent?.trim() ?? ""
  );
}

describe("Coexistence — AC10 no-churn (the primary bar)", () => {
  it("curating one suggestion leaves the others' identity + order untouched, with NO pipeline re-run", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    // Three GENERAL suggestions (none section-matched), in a stable source order.
    mockYtSearch([
      ytItem("g1", "A cellular respiration overview"),
      ytItem("g2", "Another respiration deep-dive"),
      ytItem("g3", "Respiration in plants"),
    ]);
    render(<TopicView />);

    // All three suggestions resolve into the General pool, in source order.
    await screen.findByText("A cellular respiration overview");
    await waitFor(() => expect(generalSuggestionCaptions()).toHaveLength(3));
    const before = generalSuggestionCaptions();
    expect(before).toEqual([
      "A cellular respiration overview",
      "Another respiration deep-dive",
      "Respiration in plants",
    ]);

    // The pipeline ran exactly once for this load.
    await waitFor(() => expect(suggestSpy).toHaveBeenCalledTimes(1));

    // Curate the FIRST suggestion (g1): open its CurateModal, fill the note + agreement, publish.
    const curateBtn = within(document.getElementById("general-band")!).getByRole("button", {
      name: "Curate this clip: A cellular respiration overview",
    });
    await userEvent.click(curateBtn);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox"),
      "A clear explainer; one dated figure."
    );
    await userEvent.click(within(dialog).getByRole("checkbox"));
    await userEvent.click(within(dialog).getByRole("button", { name: /Publish curation/ }));

    // The curated suggestion (g1) leaves the SUGGESTION set (it is deduped out of
    // `liveCandidates`); the OTHER two remain, in the SAME relative order and identity
    // (AC9/AC10). No reshuffle — exactly one video changed state.
    await waitFor(() =>
      expect(generalSuggestionCaptions()).toEqual([
        "Another respiration deep-dive",
        "Respiration in plants",
      ])
    );
    const after = generalSuggestionCaptions();
    // The non-curated entries kept their identity AND relative order vs. the before-snapshot.
    expect(after).toEqual(before.filter((c) => c !== "A cellular respiration overview"));

    // THE BAR: curating did NOT re-run the candidate pipeline. Give any (incorrect) re-fire a
    // chance to land, then assert the spy count is unchanged from the single initial run.
    await new Promise((r) => setTimeout(r, 0));
    expect(suggestSpy).toHaveBeenCalledTimes(1);

    // And the page is now MIXED: the just-curated clip renders as curated content (a SOLID
    // tile, no longer a `.candcard`) alongside the remaining suggestions (coexistence, AC2) —
    // the band heads "＋ General", not "Suggested videos".
    expect(screen.getAllByText("＋ General").length).toBeGreaterThanOrEqual(1);
    // The curated g1 tile is present but NOT in the suggestion pool.
    expect(generalSuggestionCaptions()).not.toContain("A cellular respiration overview");
  });
});
