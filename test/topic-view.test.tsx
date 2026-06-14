import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { FullArticle } from "@/lib/wiki/article";

// Integration test for the page state machine (AC1 layout, AC2/AC3 article render,
// AC4 attribution, AC14 empty CTA, AC20 store-driven curated-vs-empty, loading +
// error states). The wiki module is MOCKED (no network egress in the sandbox).

const article: FullArticle = {
  title: "Photosynthesis",
  url: "https://en.wikipedia.org/wiki/Photosynthesis",
  lead: {
    title: "Photosynthesis",
    url: "https://en.wikipedia.org/wiki/Photosynthesis",
    leadHtml: "<p>Photosynthesis is a <a href=\"/topic/Process\">process</a>.</p>",
  },
  sections: [
    { slug: "light-dependent-reactions", title: "Light-dependent reactions", level: 2, html: "<p>LDR body.</p>" },
    { slug: "calvin-cycle", title: "Calvin cycle", level: 2, html: "<p>CC body.</p>" },
    { slug: "water-photolysis", title: "Water photolysis", level: 2, html: "<p>WP body.</p>" },
    { slug: "order-and-kinetics", title: "Order and kinetics", level: 2, html: "<p>OK body.</p>" },
    { slug: "photosynthetic-membranes-and-organelles", title: "Photosynthetic membranes and organelles", level: 2, html: "<p>PM body.</p>" },
  ],
};

let qid = "Q11982";
const fetchFullArticle = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`qid=${qid}`),
}));
vi.mock("@/lib/wiki/article", () => ({
  qidToTitle: vi.fn(async () => "Photosynthesis"),
  fetchFullArticle: (...a: unknown[]) => fetchFullArticle(...a),
}));

import { TopicView } from "@/app/topic/TopicView";
import { seedIfEmpty } from "@/lib/data";

beforeEach(async () => {
  window.localStorage.clear();
  fetchFullArticle.mockReset();
  await seedIfEmpty(); // seed the curated Photosynthesis + uncurated topics
});
afterEach(() => vi.clearAllMocks());

describe("TopicView — curated state (AC1, AC2, AC3, AC4, AC7, AC20)", () => {
  beforeEach(() => {
    qid = "Q11982";
    fetchFullArticle.mockResolvedValue(article);
  });

  it("renders the split Wiki / ＋plus wordmark (AC1)", async () => {
    render(<TopicView />);
    expect(screen.getByText("Wiki")).toBeInTheDocument();
    expect(await screen.findByText("plus")).toBeInTheDocument();
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
    // "＋ General" appears in BOTH the TOC and the General strip header — expected.
    expect(screen.getAllByText("＋ General").length).toBeGreaterThanOrEqual(2);
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
      url: "https://en.wikipedia.org/wiki/Cellular_respiration",
      lead: { title: "Cellular respiration", url: "https://en.wikipedia.org/wiki/Cellular_respiration", leadHtml: "<p>Lead.</p>" },
      sections: [
        { slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" },
        { slug: "citric-acid-cycle", title: "Citric acid cycle", level: 2, html: "<p>C.</p>" },
      ],
    });
  });

  it("renders the '0 / videos curated' infobox + curate CTA (AC14) when the store has no clips (AC20)", async () => {
    render(<TopicView />);
    expect(await screen.findByText("videos curated")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Be the first to curate this topic" })
    ).toBeInTheDocument();
  });

  it("shows the 'Suggested videos · uncurated' band with candidate treatment (AC16/AC15)", async () => {
    render(<TopicView />);
    expect(await screen.findByText("＋ Suggested videos")).toBeInTheDocument();
    expect(screen.getByText("uncurated")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested").length).toBeGreaterThan(0);
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

describe("TopicView — candidate dismiss (AC19)", () => {
  beforeEach(() => {
    qid = "Q189603";
    fetchFullArticle.mockResolvedValue({
      ...article,
      title: "Cellular respiration",
      sections: [{ slug: "glycolysis", title: "Glycolysis", level: 2, html: "<p>G.</p>" }],
    });
  });

  it("removes a candidate and decrements the visible suggestion count on 'Not relevant'", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<TopicView />);
    // 5 seeded candidates → "5 auto-suggestions"
    expect(await screen.findByText(/5 auto-suggestions/)).toBeInTheDocument();
    const dismissBtns = await screen.findAllByRole("button", {
      name: /Dismiss as not relevant/,
    });
    await userEvent.click(dismissBtns[0]);
    await waitFor(() =>
      expect(screen.getByText(/4 auto-suggestions/)).toBeInTheDocument()
    );
  });
});
