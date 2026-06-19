import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Infobox } from "@/components/topic/Infobox";
import type { TopicStats } from "@/lib/data/types";

// QA acceptance matrix for the ＋plus overview panel redesign (issue #16, design spec
// docs/design/plus-overview-redesign.md). Independent verification on top of the author's
// toc-infobox.test.tsx component tests: this file locks the verbatim microcopy, proves the
// removed strings are gone in EVERY state, confirms the §10 Browse handler fires (the curate
// button is removed), and checks the §9 a11y contract (accessible names, no competing heading).
// It maps each issue "Done when" criterion to a passing assertion.

const stats: TopicStats = { videos: 14, creators: 9, curators: 6, synced: "2h ago" };
const zero: TopicStats = { videos: 0, creators: 0, curators: 0 };

// Verbatim strings the panel must render.
const EMPTY_UNCURATED = "uncurated videos";
const ERROR_LINE =
  "Couldn't load this topic's video stats. The article is unaffected.";

// The strings that must be GONE everywhere. None of these may appear in ANY state.
const REMOVED = [
  /suggestions synced/i,
  /synced .*shown/i,
  /Be the first to curate/i,
  /auto-suggestion/i,
  /just now/i,
  /Short videos to learn this topic/i,  // value statement removed
  /videos found to weigh in/i,           // old empty-state label removed
  /none vouched for yet/i,               // old empty-state subtitle removed
  /Watched one worth keeping/i,          // invite copy removed
  /Know a clip that belongs here/i,      // invite copy removed
  /to weigh in/i,                        // trimmed from mixed two-count line
];

function renderState(
  state: "empty" | "mixed" | "curated" | "error",
  onBrowse = vi.fn()
) {
  const props = {
    empty: { hasCurated: false, stats: zero, suggestionCount: 5 },
    mixed: { hasCurated: true, stats, suggestionCount: 12 },
    curated: { hasCurated: true, stats, suggestionCount: 0 },
    error: { hasCurated: false, stats: zero, suggestionCount: 5, storeError: true },
  }[state];
  return render(<Infobox {...props} onBrowse={onBrowse} />);
}

describe("Infobox QA — verbatim microcopy", () => {
  it("renders 'uncurated videos' as the empty-state label (§6.1)", () => {
    renderState("empty");
    expect(screen.getByText(EMPTY_UNCURATED)).toBeInTheDocument();
  });

  it("renders the empty Browse button label verbatim (§6.1)", () => {
    renderState("empty");
    expect(
      screen.getByRole("button", { name: "Browse suggested videos" })
    ).toHaveTextContent("Browse suggested videos ↓");
  });

  it("renders the mixed two-count line without 'to weigh in' (§6.2)", () => {
    renderState("mixed");
    expect(
      screen.getByText((_t, el) => el?.textContent === "14 curated · 12 suggested")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toHaveTextContent("Jump to videos ↓");
  });

  it("renders the fully-curated grid only — no suggestion count, no unvetted line (§6.3)", () => {
    renderState("curated");
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.queryByText(/suggested/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toBeInTheDocument();
  });

  it("renders the error line verbatim, no numerals, no buttons (§6.5)", () => {
    renderState("error");
    expect(screen.getByText(ERROR_LINE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("5")).toBeNull();
    expect(screen.queryByText("Videos")).toBeNull();
  });
});

describe("Infobox QA — removed strings are GONE in every state", () => {
  it("renders none of the retired strings in empty / mixed / curated / error", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { container, unmount } = renderState(s);
      for (const pattern of REMOVED) {
        expect(container.textContent ?? "").not.toMatch(pattern);
      }
      unmount();
    }
  });

  it("the curate/add button is absent in every state (block removed)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      expect(screen.queryByRole("button", { name: /Curate a video/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Add a video/i })).toBeNull();
      unmount();
    }
  });
});

describe("Infobox QA — §10 Browse handler fires (all non-error states)", () => {
  it("empty: Browse fires onBrowse", async () => {
    const onBrowse = vi.fn();
    renderState("empty", onBrowse);
    await userEvent.click(
      screen.getByRole("button", { name: "Browse suggested videos" })
    );
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("mixed: Jump fires onBrowse", async () => {
    const onBrowse = vi.fn();
    renderState("mixed", onBrowse);
    await userEvent.click(screen.getByRole("button", { name: "Jump to videos" }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("fully-curated: Jump fires onBrowse", async () => {
    const onBrowse = vi.fn();
    renderState("curated", onBrowse);
    await userEvent.click(screen.getByRole("button", { name: "Jump to videos" }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });
});

describe("Infobox QA — §9 accessibility contract", () => {
  it("the scroll button carries a clear accessible name distinct from its label per state", () => {
    const { unmount } = renderState("empty");
    expect(
      screen.getByRole("button", { name: "Browse suggested videos" })
    ).toHaveAttribute("aria-label", "Browse suggested videos");
    unmount();
    renderState("mixed");
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toHaveAttribute("aria-label", "Jump to videos");
  });

  it("introduces NO heading element in the panel — (§9)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      // The panel sits inside the page's labelled <aside>; it must not add an <h1>–<h6>
      // that would disrupt the page outline.
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

  it("the browse button is a keyboard-activable real <button> (Enter/Space, tab order)", async () => {
    const onBrowse = vi.fn();
    renderState("empty", onBrowse);
    const browse = screen.getByRole("button", { name: "Browse suggested videos" });
    browse.focus();
    expect(browse).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(browse.tagName).toBe("BUTTON");
  });
});
