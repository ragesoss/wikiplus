import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

// QA supplement (#126) — independent, non-author coverage for the redesigned homepage Topic card
// (components/home/TopicCard.tsx). The author's landing-page suites prove the card renders inside
// the grid and links to the canonical Topic href; these close the two card-level acceptance
// criteria that had no direct assertion:
//   - the SINGULAR BOUNDARY in the composed aria-label ("1 video", never "1 videos") — issue #126
//     "Done when" + design topic-card-redesign.md §5.1;
//   - the DEFENSIVE `videos === 0` fallback (§6.2): no 0/0/0 grid, article-only accessible name.
// Plus the curated-state anatomy that carries identity + AA-contrast tokens (§3, §8).

import { TopicCard } from "@/components/home/TopicCard";
import type { TopicWithStats } from "@/lib/data/types";

function topic(stats: TopicWithStats["stats"], over: Partial<TopicWithStats> = {}): TopicWithStats {
  return {
    qid: "Q11982",
    title: "Photosynthesis",
    description: "Biological process converting light to chemical energy",
    stats,
    ...over,
  };
}

describe("#126 TopicCard — composed accessible name + singular boundary (§5.1)", () => {
  it("pluralizes counts > 1 in the aria-label (the whole card is one named link)", () => {
    render(<TopicCard topic={topic({ videos: 12, creators: 7, curators: 3 })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "aria-label",
      "Photosynthesis — Wikipedia article. 12 videos, 7 creators, 3 curators."
    );
  });

  it("uses the SINGULAR noun at the count==1 boundary — '1 video', never '1 videos'", () => {
    render(<TopicCard topic={topic({ videos: 1, creators: 1, curators: 1 })} />);
    const label = screen.getByRole("link").getAttribute("aria-label") ?? "";
    expect(label).toBe(
      "Photosynthesis — Wikipedia article. 1 video, 1 creator, 1 curator."
    );
    // Belt-and-suspenders: no "1 videos"/"1 creators"/"1 curators" slip past the rule.
    expect(label).not.toMatch(/1 videos|1 creators|1 curators/);
  });

  it("mixes singular + plural correctly within one phrase", () => {
    render(<TopicCard topic={topic({ videos: 1, creators: 2, curators: 1 })} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "aria-label",
      "Photosynthesis — Wikipedia article. 1 video, 2 creators, 1 curator."
    );
  });
});

describe("#126 TopicCard — curated anatomy + the stat grid (§3 / §8)", () => {
  it("renders the title, the WIKIPEDIA ARTICLE mark, and the description (text-labeled identity)", () => {
    render(<TopicCard topic={topic({ videos: 12, creators: 7, curators: 3 })} />);
    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("Wikipedia article")).toBeInTheDocument();
    expect(
      screen.getByText("Biological process converting light to chemical energy")
    ).toBeInTheDocument();
  });

  it("renders the 3-up Videos/Creators/Curators stat grid with the live counts, text-labeled", () => {
    const { container } = render(
      <TopicCard topic={topic({ videos: 12, creators: 7, curators: 3 })} />
    );
    // Every numeral has its word label on screen (never number/color alone — §8). The grid is
    // aria-hidden (the composed aria-label conveys the counts), so query the DOM, not by role.
    for (const label of ["Videos", "Creators", "Curators"]) {
      expect(within(container).getByText(label)).toBeInTheDocument();
    }
    for (const n of ["12", "7", "3"]) {
      expect(within(container).getByText(n)).toBeInTheDocument();
    }
    // The stat grid is aria-hidden so AT does not double-read the counts (§8).
    expect(container.querySelector("[aria-hidden] .bignum")).toBeTruthy();
  });

  it("the description uses text-ink2 (AA contrast), not the faint text-ink/60 (§8)", () => {
    render(<TopicCard topic={topic({ videos: 2, creators: 1, curators: 1 })} />);
    const desc = screen.getByText(
      "Biological process converting light to chemical energy"
    );
    expect(desc.className).toContain("text-ink2");
    expect(desc.className).not.toContain("text-ink/60");
  });
});

describe("#126 TopicCard — defensive videos===0 fallback (§6.2)", () => {
  it("omits the stat grid and the count clause when videos === 0 (never a 0/0/0 grid)", () => {
    const { container } = render(
      <TopicCard topic={topic({ videos: 0, creators: 0, curators: 0 })} />
    );
    // Article-only accessible name — no "0 videos" phrase.
    expect(screen.getByRole("link")).toHaveAttribute(
      "aria-label",
      "Photosynthesis — Wikipedia article."
    );
    // No stat grid rendered at all (no bignum numerals, no labels).
    expect(container.querySelector(".bignum")).toBeNull();
    expect(screen.queryByText("Videos")).toBeNull();
    // The article half still renders (a real, openable topic).
    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("Wikipedia article")).toBeInTheDocument();
  });
});
