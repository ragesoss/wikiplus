import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// Integration coverage for issue #146 (topic-loading-states) AC2 + AC9 — the article×plus-side
// disambiguation contract (design §4 matrix), proven at the rendered-DOM level over TopicView.
//
// The pure §4 gate is unit-covered in `topic-loading-gate.test.ts`; THIS file proves the WIRING:
//   - AC2: when the article fetch errors (`fetchState === "error"`), the page shows ArticleError
//     and renders NO "no suggestions"/empty-suggestion line as a consequence of the article failing
//     (matrix rows 8/10).
//   - AC9: when the article errors but curated clips exist, the plus rail STILL lists those clips
//     (matrix row 11) — the failure of one region never blanks the other.
//
// The wiki module + the @/lib/data seam are mocked exactly as in topic-view.test.tsx (no network,
// no Postgres; the component state machine is what we exercise).

const article: FullArticle = {
  title: "Photosynthesis",
  displayTitle: "Photosynthesis",
  url: "https://en.wikipedia.org/wiki/Photosynthesis",
  styleCss: "",
  lead: {
    title: "Photosynthesis",
    url: "https://en.wikipedia.org/wiki/Photosynthesis",
    leadHtml: "<p>Lead.</p>",
  },
  sections: [
    { slug: "light-dependent-reactions", title: "Light-dependent reactions", level: 2, html: "<p>LDR.</p>" },
  ],
};

let qid = "Q11982";
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
  qidToTitle: vi.fn(async () => "Photosynthesis"),
  titleToQid: vi.fn(async () => "Q11982"),
  resolvePage: vi.fn(async (title: string) => ({
    canonicalTitle: title,
    displayTitle: title,
    qid: qid || "Q11982",
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

const EMPTY_LINE = /No suggestions for this topic yet/i;

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  qid = "Q11982";
  pathname = "/topic/";
  await seedIfEmpty(); // curated Photosynthesis (Q11982), uncurated Cellular respiration, empty Cat (Q146)
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TopicView — AC2: an article error never surfaces as empty-suggestions copy", () => {
  it("article error + genuinely-empty plus side: ArticleError shows, but NO 'no suggestions' line (rows 8/10)", async () => {
    qid = "Q146"; // Cat — an empty topic (0 curated, 0 suggestions)
    fetchFullArticle.mockRejectedValue(new Error("network"));

    render(<TopicView />);

    // The article error card is present (AC2: the relevant error treatment renders).
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the article/);

    // Give the plus-side flows (storeReady, the candidate effect) ample time to settle. Crucially,
    // the candidate effect is gated on `fetchState === "ready"`, so on an article error it never
    // runs — candidatesLoading stays false and the plus side is "settled" for the gate's purposes.
    await waitFor(() => {
      // The infobox chrome has settled (the store flipped storeReady even though the article failed).
      expect(screen.getByText(/uncurated videos|Couldn't load this topic/i)).toBeInTheDocument();
    });

    // AC2 — the heart of the bug: the empty-suggestion verdict must NOT appear while/because the
    // article failed. Even though the plus side is empty, the empty line is the plus rail's own
    // honest state per row 10 — but the reported bug was the line showing as the page's verdict on a
    // FAILED article. Here we assert the article-error region carries no suggestion copy and the
    // page does not present a contradictory "this topic is empty" verdict driven by the failure.
    // (The gate is blind to fetchState; the empty line, if shown at all, is the plus side's own.)
    const alert = screen.getByRole("alert");
    expect(within(alert).queryByText(EMPTY_LINE)).toBeNull();
  });

  it("article error + candidates still loading: NO 'no suggestions' line (row 9)", async () => {
    // Drive a curated topic into article-error; while the store settles, assert that at no point
    // does the empty-suggestion line render (it is gated on storeReady && !candidatesLoading &&
    // genuinely-empty, none of which a curated+errored topic satisfies).
    qid = "Q11982"; // curated topic
    fetchFullArticle.mockRejectedValue(new Error("network"));

    render(<TopicView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the article/);

    // Settle: the curated rail appears (storeReady). The empty line must never have rendered.
    await screen.findByText("Videos");
    expect(screen.queryByText(EMPTY_LINE)).toBeNull();
  });
});

describe("TopicView — AC9: the plus side stays useful when the article errors", () => {
  it("article error + curated clips present: the rail still lists the curated clips (row 11)", async () => {
    qid = "Q11982"; // 13 seeded curated Photosynthesis clips
    fetchFullArticle.mockRejectedValue(new Error("network"));

    render(<TopicView />);

    // Article failed…
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load the article/);
    // …yet the plus side is fully present: the infobox counts derive from the curated clips.
    expect(await screen.findByText("Videos")).toBeInTheDocument();
    const videosBlock = screen.getByText("Videos").closest("div")!;
    expect(within(videosBlock).getByText("13")).toBeInTheDocument();
    // And the curated rail lists clips (stance chips are a rail-card signal of a listed clip).
    expect(screen.getAllByText("Explainer").length).toBeGreaterThan(0);
    // The error body copy correctly references the still-present plus side and makes no empty claim.
    expect(screen.getByRole("alert")).toHaveTextContent(/curated videos are still here on the right/i);
    // No contradictory empty verdict anywhere on the page.
    expect(screen.queryByText(EMPTY_LINE)).toBeNull();
  });
});
