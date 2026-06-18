import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { GENERAL_SUGGESTION_DEFAULT } from "@/lib/candidates";
import type { Candidate, Clip } from "@/lib/data/types";

// ── Issue #60 — QA & Review independent coverage. ─────────────────────────────────────────────
// Fresh-eyes additions closing two gaps the Development suite (coexistence/general-strip/
// toc-infobox) left uncovered:
//   - AC8 (displacement = reflow, not deletion): a section-anchored suggestion that is displaced
//     folds into the GENERAL pool — it must be REACHABLE there, never absent, even when it
//     overflows the default-8 (then it is reachable under "See more"). This is the design §4
//     outcome ("General-pool presence, never absence"); the re-classification itself is the
//     pipeline's job (out of #60 scope), so the verifiable #60 contract is: a general-classified
//     suggestion renders in the General pool and is reachable.
//   - AC4/AC5 boundary strengthening: curated-before-suggestions is asserted at the GROUP level
//     (every curated tile precedes every suggestion tile, not just the first pair).
//
// These are component-level so a state can be constructed deterministically from props (the
// Product spec's preferred verifiability path). The through-TopicView no-churn bar (AC10) is
// owned by coexistence.test.tsx; this file does not duplicate it.

const baseClip: Clip = {
  id: "c1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=clipv",
  embedUrl: "https://www.youtube-nocookie.com/embed/clipv",
  thumbnailUrl: "https://i.ytimg.com/vi/clipv/hqdefault.jpg",
  caption: "Curated overview",
  creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
  contextNote: "note",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: true,
  createdAt: new Date().toISOString(),
};

const baseCand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=candv",
  caption: "A general suggestion",
  creator: { handle: "@as", name: "Amoeba Sisters", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "Top result",
  general: true,
};

/** N distinct general-classified candidates with stable identity + caption. */
function generalCandidates(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    ...baseCand,
    id: `g_${i + 1}`,
    watchUrl: `https://www.youtube.com/watch?v=g${i + 1}`,
    caption: `General suggestion ${i + 1}`,
  }));
}

function renderStrip(props: Partial<React.ComponentProps<typeof GeneralStrip>>) {
  return render(
    <GeneralStrip
      topicTitle="Cellular respiration"
      generalClips={[]}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      {...props}
    />
  );
}

// Captions of the dashed `.candcard` suggestion tiles in the band, in DOM order.
function suggestionCaptions(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".candcard")).map(
    (card) => card.querySelector("p")?.textContent?.trim() ?? ""
  );
}

describe("Coexistence QA — AC8 displacement folds into the General pool (reachable, never dropped)", () => {
  // A displaced section suggestion is re-classified general and renders in the General pool,
  // alongside the curated clip that displaced it — both present, no drop (AC8 / design §4).
  it("renders a displaced (general-classified) suggestion in the General pool next to the curated clip", () => {
    const displaced: Candidate = {
      ...baseCand,
      id: "displaced",
      caption: "Displaced from Glycolysis",
      // Carries its original section match reason — the design §4 'genuine context' that may
      // name the section — but is classified `general` because a curated clip took its slot.
      matchReason: "Matched the Glycolysis section",
      general: true,
    };
    const { container } = renderStrip({
      generalClips: [baseClip],
      generalCandidates: [displaced],
    });
    // Mixed: both the curated clip and the displaced suggestion are on the page.
    expect(screen.getByText("Curated overview")).toBeInTheDocument();
    expect(screen.getByText("Displaced from Glycolysis")).toBeInTheDocument();
    // It is in the SUGGESTION pool (a dashed candcard), not silently dropped.
    expect(suggestionCaptions(container)).toContain("Displaced from Glycolysis");
  });

  // AC8 + AC6: if the displaced suggestion overflows the default-8 it is still REACHABLE —
  // under "See more", not lost. Put it last in an overflowing pool; it is hidden until expand.
  it("keeps a displaced suggestion reachable under 'See more' when it overflows the default", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const pool = generalCandidates(GENERAL_SUGGESTION_DEFAULT);
    const displaced: Candidate = {
      ...baseCand,
      id: "displaced_overflow",
      caption: "Displaced overflow suggestion",
      general: true,
    };
    const { container } = renderStrip({
      generalClips: [baseClip],
      generalCandidates: [...pool, displaced], // total = DEFAULT + 1 → overflow by 1
    });
    // Collapsed: the displaced (overflow) suggestion is NOT yet visible — but the control is.
    expect(screen.queryByText("Displaced overflow suggestion")).toBeNull();
    const seeMore = screen.getByRole("button", { name: /See 1 more/ });
    // Reveal the overflow → the displaced suggestion is now reachable (never dropped — AC8).
    await userEvent.click(seeMore);
    expect(screen.getByText("Displaced overflow suggestion")).toBeInTheDocument();
    expect(suggestionCaptions(container)).toContain("Displaced overflow suggestion");
  });
});

describe("Coexistence QA — AC4 group ordering (every curated precedes every suggestion)", () => {
  // Strengthen beyond the author's single-pair check: with MULTIPLE curated + MULTIPLE
  // suggestions, EVERY curated tile must precede EVERY suggestion tile (not interleaved).
  it("renders all curated tiles before all suggestion tiles in the band (AC4, group-level)", () => {
    const clips: Clip[] = [
      { ...baseClip, id: "k1", caption: "Curated A" },
      { ...baseClip, id: "k2", caption: "Curated B" },
      { ...baseClip, id: "k3", caption: "Curated C" },
    ];
    const cands = generalCandidates(3);
    renderStrip({ generalClips: clips, generalCandidates: cands });

    const band = document.getElementById("general-band")!;
    // The full ordered list of tile captions (curated solid tiles + dashed candcards).
    const allText = band.textContent ?? "";
    const lastCuratedIdx = Math.max(
      allText.indexOf("Curated A"),
      allText.indexOf("Curated B"),
      allText.indexOf("Curated C")
    );
    const firstSuggestionIdx = Math.min(
      ...["General suggestion 1", "General suggestion 2", "General suggestion 3"].map(
        (t) => allText.indexOf(t)
      )
    );
    // Every curated caption appears before the first suggestion caption in source order.
    expect(lastCuratedIdx).toBeGreaterThanOrEqual(0);
    expect(firstSuggestionIdx).toBeGreaterThan(lastCuratedIdx);
    // The "Suggested · uncurated" divider sits between the groups, not before curated.
    const dividerIdx = allText.indexOf("Suggested · uncurated");
    expect(dividerIdx).toBeGreaterThan(lastCuratedIdx);
    expect(dividerIdx).toBeLessThan(firstSuggestionIdx);
  });
});

describe("Coexistence QA — AC15 see-more focus stays on the button across toggle", () => {
  // §3.2: focus must STAY on the button across expand/collapse (the button persists; the
  // newly-revealed tiles come after it in source order). Verify focus is not lost to <body>.
  it("keeps focus on the see-more button after expanding (focus not dropped)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderStrip({
      generalClips: [],
      generalCandidates: generalCandidates(GENERAL_SUGGESTION_DEFAULT + 2),
    });
    const seeMore = screen.getByRole("button", { name: /See 2 more/ });
    await userEvent.click(seeMore);
    // The same control persists (now "See fewer") and retains focus — not <body>.
    const collapse = screen.getByRole("button", { name: /See fewer/ });
    expect(collapse).toHaveFocus();
  });
});
