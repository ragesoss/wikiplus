import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// Regression suite for issue #21 — "Keep the Wiki column free of plus content."
// Spec: docs/specs/wiki-column-no-plus.md (AC1–AC6); design: docs/design/wiki-column-no-plus.md.
//
// The boundary under test: the General strip is the ONLY place plus content crosses
// into the Wikipedia article column. Section-matched candidates live exclusively in
// the plus rail (via CandidateCard) — NEVER interleaved inline in the article body.
//
// The wiki module is MOCKED (no network egress in the sandbox), mirroring topic-view.test.tsx.

// A two-section article whose section slugs match seeded section-anchored candidates
// on the uncurated demo topic (Q189603): "glycolysis" and "citric-acid-cycle". These
// sections must NOT render a second, inline candidate copy in the article body.
const cellularRespiration: FullArticle = {
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
    { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G body.</p>" },
    { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C body.</p>" },
  ],
};

// A curated article (Photosynthesis, Q11982 — 13 seeded clips). AC4: the curated
// article column already renders no inline plus content; confirm no regression.
const photosynthesis: FullArticle = {
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
    { slug: "calvin-cycle", title: "Calvin cycle", level: 2, html: "<p>CC.</p>" },
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
    qid,
  })),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));
// Issue #45: mock the @/lib/data seam to the localStorage-backed test double.
vi.mock("@/lib/data", async () => {
  const { buildDataMock } = await import("./helpers/data-mock");
  return buildDataMock();
});

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "./helpers/data-mock";

/** The Wikipedia article column — the left <main> region. AC1/AC4 inspect it. */
function articleColumn(): HTMLElement {
  return screen.getByRole("main", { name: "Wikipedia article" });
}
/** The plus rail — the suggested/curated videos <aside>. AC2 inspects it. */
function plusRail(): HTMLElement {
  return screen.getByRole("complementary", {
    name: /wiki\+ (suggested|curated) videos/,
  });
}

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  routerReplace.mockReset();
  routerPush.mockReset();
  qid = "Q189603";
  pathname = "/topic/";
  await seedIfEmpty();
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Wiki column free of plus content — empty state (issue #21, AC1/AC2)", () => {
  beforeEach(() => {
    qid = "Q189603"; // uncurated demo topic with seeded section-anchored candidates
    fetchFullArticle.mockResolvedValue(cellularRespiration);
  });

  it("AC1 — the empty-state article body renders NO plus/suggestion content", async () => {
    render(<TopicView />);
    // Article body present (sections rendered).
    expect(
      await screen.findByRole("heading", { name: "Glycolysis", level: 2 })
    ).toBeInTheDocument();
    // Let the candidate load settle so any (regressed) inline render would have a chance.
    await screen.findByText("Glycolysis Explained in 2 minutes"); // present in the RAIL

    const article = articleColumn();
    // No candidate card is interleaved in the article column…
    expect(article.querySelector(".candcard")).toBeNull();
    // …no retired inline "Suggested for this section" heading…
    expect(within(article).queryByText("Suggested for this section")).toBeNull();
    // …no retired inline aside ("Suggested video for <section>")…
    expect(
      article.querySelector('[aria-label^="Suggested video for"]')
    ).toBeNull();
    // …and no SUGGESTED badge inside the article body (those live only in the rail).
    expect(within(article).queryByText("Suggested")).toBeNull();
  });

  it("AC2 — a section-matched candidate still renders in the plus rail (CandidateCard)", async () => {
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Glycolysis", level: 2 });

    const rail = plusRail();
    // The section-anchored candidate's CandidateCard (an <article class="candcard">)
    // is present in the rail, anchored by its sectionSlug/sectionLabel.
    await waitFor(() =>
      expect(rail.querySelector("article.candcard")).not.toBeNull()
    );
    const glyCard = within(rail).getByText("Glycolysis Explained in 2 minutes");
    expect(glyCard).toBeInTheDocument();
    // It carries its section anchor (data-clip-section) + the per-card source pill
    // (the #14 decluttered replacement for the removed "SUGGESTED" badge).
    const card = glyCard.closest("article.candcard")!;
    expect(card.getAttribute("data-clip-section")).toBe("glycolysis");
    expect(
      within(card as HTMLElement).getByTitle(/^Auto-suggested from /)
    ).toBeInTheDocument();
    // No per-card "SUGGESTED" badge anymore (#14 AC1).
    expect(within(card as HTMLElement).queryByText("Suggested")).toBeNull();
    // The section label links the card to its section ("Glycolysis").
    expect(within(card as HTMLElement).getByText("Glycolysis")).toBeInTheDocument();
  });

  it("AC1/AC2 — every section-matched candidate lives only in the rail, never the body", async () => {
    render(<TopicView />);
    await screen.findByRole("heading", { name: "Citric acid cycle", level: 2 });
    // Both seeded section-anchored captions appear (in the rail).
    await screen.findByText("Glycolysis Explained in 2 minutes");
    await screen.findByText("The Krebs cycle in 60 seconds");

    const article = articleColumn();
    const rail = plusRail();
    // Each section-matched caption is in the rail and absent from the article column.
    for (const caption of [
      "Glycolysis Explained in 2 minutes",
      "The Krebs cycle in 60 seconds",
    ]) {
      expect(within(rail).getByText(caption)).toBeInTheDocument();
      expect(within(article).queryByText(caption)).toBeNull();
    }
    // No candidate card anywhere in the article body.
    expect(article.querySelectorAll(".candcard").length).toBe(0);
  });
});

describe("Wiki column free of plus content — curated state unaffected (issue #21, AC4)", () => {
  beforeEach(() => {
    qid = "Q11982"; // seeded curated Photosynthesis (13 clips)
    fetchFullArticle.mockResolvedValue(photosynthesis);
  });

  it("AC4 — the curated article body shows no inline plus content (no regression)", async () => {
    render(<TopicView />);
    // Curated rail renders (stance chips present, no candidate SUGGESTED badge).
    expect(
      await screen.findByRole("heading", { name: "Calvin cycle", level: 2 })
    ).toBeInTheDocument();
    await screen.findByText("Videos"); // infobox painted → store loaded

    const article = articleColumn();
    expect(article.querySelector(".candcard")).toBeNull();
    expect(within(article).queryByText("Suggested for this section")).toBeNull();
    expect(within(article).queryByText("Suggested")).toBeNull();
  });
});
