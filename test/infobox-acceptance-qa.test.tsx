import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Infobox } from "@/components/topic/Infobox";
import type { TopicStats } from "@/lib/data/types";

// QA acceptance matrix for the ＋plus Overview card after the cleanup (design
// overview-card-cleanup.md). The card is a quiet stats card: a thin indigo cap with NO wordmark
// text (AC1), the counts/volume block, and (signed-in) the curator mark/reopen control. It carries
// NO "Marked complete" notice, NO "Show suggestions"/"Add a video" buttons (AC2), and NO
// Browse/Jump scroll button in any state (AC3). This locks the verbatim microcopy that stays, and
// proves the removed surfaces are gone in EVERY state.

const stats: TopicStats = { videos: 14, creators: 9, curators: 6, synced: "2h ago" };
const zero: TopicStats = { videos: 0, creators: 0, curators: 0 };

const EMPTY_UNCURATED = "uncurated videos";
const ERROR_LINE =
  "Couldn't load this topic's video stats. The article is unaffected.";

// Strings that must be GONE everywhere — including the retired card header wordmark + the dropped
// Browse/Jump labels.
const REMOVED = [
  /suggestions synced/i,
  /Be the first to curate/i,
  /Short videos to learn this topic/i, // value statement removed
  /videos found to weigh in/i, // old empty-state label removed
  /to weigh in/i, // trimmed from mixed two-count line
  /＋plus/, // the card header wordmark is gone (AC1)
  /on this topic/i, // …and its sub-label
  /Jump to videos/i, // Browse/Jump dropped (AC3)
  /Browse suggested videos/i,
  /Marked complete/i, // the status notice moved out of the card (AC2)
];

function renderState(state: "empty" | "mixed" | "curated" | "error") {
  const props = {
    empty: { hasCurated: false, stats: zero, suggestionCount: 5 },
    mixed: { hasCurated: true, stats, suggestionCount: 12 },
    curated: { hasCurated: true, stats, suggestionCount: 0 },
    error: { hasCurated: false, stats: zero, suggestionCount: 5, storeError: true },
  }[state];
  return render(<Infobox {...props} />);
}

describe("Infobox QA — verbatim microcopy that stays", () => {
  it("renders 'uncurated videos' as the empty-state label", () => {
    renderState("empty");
    expect(screen.getByText(EMPTY_UNCURATED)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders the mixed two-count line without 'to weigh in'", () => {
    renderState("mixed");
    expect(
      screen.getByText((_t, el) => el?.textContent === "14 curated · 12 suggested")
    ).toBeInTheDocument();
  });

  it("renders the fully-curated grid only — no suggestion count, no unvetted line", () => {
    renderState("curated");
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.queryByText(/suggested/i)).toBeNull();
  });

  it("renders the error line verbatim, no numerals, no buttons (§6.5)", () => {
    renderState("error");
    expect(screen.getByText(ERROR_LINE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("5")).toBeNull();
    expect(screen.queryByText("Videos")).toBeNull();
  });
});

describe("Infobox QA — removed surfaces are GONE in every state", () => {
  it("renders none of the retired strings in empty / mixed / curated / error", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { container, unmount } = renderState(s);
      for (const pattern of REMOVED) {
        expect(container.textContent ?? "").not.toMatch(pattern);
      }
      unmount();
    }
  });

  it("the curate/add button is absent in every state (AC2)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      expect(screen.queryByRole("button", { name: /Curate a video/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Add a video/i })).toBeNull();
      unmount();
    }
  });

  it("no Browse/Jump scroll button in any non-error state (AC3)", () => {
    for (const s of ["empty", "mixed", "curated"] as const) {
      const { unmount } = renderState(s);
      expect(
        screen.queryByRole("button", { name: /Browse suggested videos/i })
      ).toBeNull();
      expect(screen.queryByRole("button", { name: /Jump to videos/i })).toBeNull();
      unmount();
    }
  });

  // A logged-out (signedIn=false), not-complete card has no actions at all — counts only.
  it("renders NO buttons in the non-error states (logged out, not complete)", () => {
    for (const s of ["empty", "mixed", "curated"] as const) {
      const { unmount } = renderState(s);
      expect(screen.queryByRole("button")).toBeNull();
      unmount();
    }
  });
});

describe("Infobox QA — accessibility contract", () => {
  it("introduces NO heading element in the card (the cap is decorative)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      expect(screen.queryByRole("heading")).toBeNull();
      unmount();
    }
  });

  it("the unvetted signal is present in TEXT in empty state ('uncurated')", () => {
    renderState("empty");
    expect(screen.getByText(EMPTY_UNCURATED)).toBeInTheDocument();
  });

  it("the unvetted signal is present in TEXT in mixed state ('suggested')", () => {
    renderState("mixed");
    expect(screen.getByText(/suggested/)).toBeInTheDocument();
  });
});

describe("Infobox QA — the curator control + the empty-card guard", () => {
  it("a signed-in curator on a complete topic sees 'Reopen to suggestions'", () => {
    render(
      <Infobox
        hasCurated
        stats={stats}
        suggestionCount={0}
        signedIn
        closedToSuggestions
        onToggleComplete={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Reopen this topic to suggestions/i })
    ).toBeInTheDocument();
  });

  it("renders NOTHING at complete + zero curated video for a logged-out reader (AC8)", () => {
    const { container } = render(
      <Infobox
        hasCurated={false}
        stats={zero}
        suggestionCount={5}
        closedToSuggestions
      />
    );
    // The body would be just the cap → the card does not render at all.
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialed-down card (cap + Reopen, no counts) at complete + zero video for a curator (AC8)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={zero}
        suggestionCount={5}
        signedIn
        closedToSuggestions
        onToggleComplete={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Reopen this topic to suggestions/i })
    ).toBeInTheDocument();
    // No counts grid at zero curated video.
    expect(screen.queryByText("Videos")).toBeNull();
    expect(screen.queryByText("uncurated videos")).toBeNull();
  });
});
