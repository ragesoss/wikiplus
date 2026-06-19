import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Infobox } from "@/components/topic/Infobox";
import type { TopicStats } from "@/lib/data/types";

// QA acceptance matrix for the ＋plus overview panel redesign (issue #16, design spec
// docs/design/plus-overview-redesign.md). Independent verification on top of the author's
// toc-infobox.test.tsx component tests: this file locks the VERBATIM §7 microcopy, proves the
// removed strings are gone in EVERY state, confirms the §10 handler split is mutually exclusive
// across all states, and checks the §9 a11y contract (aria-haspopup, accessible names, no
// competing heading). It maps each issue "Done when" criterion to a passing assertion.

const stats: TopicStats = { videos: 14, creators: 9, curators: 6, synced: "2h ago" };
const zero: TopicStats = { videos: 0, creators: 0, curators: 0 };

// §7 verbatim strings — the single source of truth the panel must render character-for-character.
const VALUE =
  "Short videos to learn this topic, each weighed for what's fact vs. opinion.";
const EMPTY_VOL_1 = "videos found to weigh in";
const EMPTY_VOL_2 = "none vouched for yet — these are unreviewed suggestions";
const EMPTY_INVITE =
  "Watched one worth keeping? Vouch for it and write a note so the next learner knows how to weigh it.";
const MIXED_CURATED_INVITE =
  "Know a clip that belongs here? Add & curate one to broaden how this topic is shown.";
const ERROR_LINE =
  "Couldn't load this topic's video stats. The article is unaffected.";

// The strings §7 says must be GONE everywhere. None of these may appear in ANY state.
const REMOVED = [
  /suggestions synced/i,
  /synced .*shown/i,
  /Be the first to curate/i,
  /auto-suggestion/i,
  /just now/i,
];

function renderState(
  state: "empty" | "mixed" | "curated" | "error",
  onBrowse = vi.fn(),
  onCurate = vi.fn()
) {
  const props = {
    empty: { hasCurated: false, stats: zero, suggestionCount: 5 },
    mixed: { hasCurated: true, stats, suggestionCount: 12 },
    curated: { hasCurated: true, stats, suggestionCount: 0 },
    error: { hasCurated: false, stats: zero, suggestionCount: 5, storeError: true },
  }[state];
  return render(<Infobox {...props} onBrowse={onBrowse} onCurate={onCurate} />);
}

describe("Infobox QA — §7 verbatim microcopy", () => {
  it("renders the exact value statement (all states)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      expect(screen.getByText(VALUE)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the empty volume lines + invite + button labels verbatim (§6.1)", () => {
    renderState("empty");
    expect(screen.getByText(EMPTY_VOL_1)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_VOL_2)).toBeInTheDocument();
    // Invite copy is split across <strong> — match by normalized text content.
    expect(
      screen.getByText((_t, el) => el?.textContent === EMPTY_INVITE)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Browse suggested videos" })
    ).toHaveTextContent("Browse suggested videos ↓");
    expect(
      screen.getByRole("button", { name: "＋ Curate a video" })
    ).toBeInTheDocument();
  });

  it("renders the mixed two-count line + Jump/Add labels verbatim (§6.2)", () => {
    renderState("mixed");
    expect(
      screen.getByText((_t, el) => el?.textContent === "14 curated · 12 suggested to weigh in")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toHaveTextContent("Jump to videos ↓");
    expect(
      screen.getByRole("button", { name: "＋ Add a video" })
    ).toBeInTheDocument();
    expect(
      screen.getByText((_t, el) => el?.textContent === MIXED_CURATED_INVITE)
    ).toBeInTheDocument();
  });

  it("renders the fully-curated grid only — no suggestion count, no unvetted line (§6.3)", () => {
    renderState("curated");
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.queryByText(/suggested/i)).toBeNull();
    expect(screen.queryByText(/weigh in/i)).toBeNull();
    expect(screen.queryByText(EMPTY_VOL_2)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "＋ Add a video" })
    ).toBeInTheDocument();
  });

  it("renders the error line verbatim, no numerals, no buttons (§6.5)", () => {
    renderState("error");
    expect(screen.getByText(ERROR_LINE)).toBeInTheDocument();
    expect(screen.getByText(VALUE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("5")).toBeNull();
    expect(screen.queryByText("Videos")).toBeNull();
  });
});

describe("Infobox QA — removed strings are GONE in every state (§7)", () => {
  it("renders none of the retired strings in empty / mixed / curated / error", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { container, unmount } = renderState(s);
      for (const pattern of REMOVED) {
        expect(container.textContent ?? "").not.toMatch(pattern);
      }
      unmount();
    }
  });
});

describe("Infobox QA — §10 handler split is mutually exclusive (all states)", () => {
  it("empty: Browse fires onBrowse only; Curate fires onCurate only", async () => {
    const onBrowse = vi.fn();
    const onCurate = vi.fn();
    renderState("empty", onBrowse, onCurate);
    await userEvent.click(
      screen.getByRole("button", { name: "Browse suggested videos" })
    );
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(onCurate).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "＋ Curate a video" })
    );
    expect(onCurate).toHaveBeenCalledOnce();
    expect(onBrowse).toHaveBeenCalledOnce(); // unchanged by the curate click
  });

  it("mixed: Jump fires onBrowse only; Add fires onCurate only", async () => {
    const onBrowse = vi.fn();
    const onCurate = vi.fn();
    renderState("mixed", onBrowse, onCurate);
    await userEvent.click(screen.getByRole("button", { name: "Jump to videos" }));
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(onCurate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "＋ Add a video" }));
    expect(onCurate).toHaveBeenCalledOnce();
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("fully-curated: Jump fires onBrowse only; Add fires onCurate only", async () => {
    const onBrowse = vi.fn();
    const onCurate = vi.fn();
    renderState("curated", onBrowse, onCurate);
    await userEvent.click(screen.getByRole("button", { name: "Jump to videos" }));
    expect(onBrowse).toHaveBeenCalledOnce();
    expect(onCurate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "＋ Add a video" }));
    expect(onCurate).toHaveBeenCalledOnce();
    expect(onBrowse).toHaveBeenCalledOnce();
  });
});

describe("Infobox QA — §9 accessibility contract", () => {
  it("the curate/add button declares aria-haspopup='dialog'; the scroll button does NOT", () => {
    renderState("empty");
    expect(
      screen.getByRole("button", { name: "＋ Curate a video" })
    ).toHaveAttribute("aria-haspopup", "dialog");
    expect(
      screen.getByRole("button", { name: "Browse suggested videos" })
    ).not.toHaveAttribute("aria-haspopup");
  });

  it("add button in mixed/curated also declares aria-haspopup='dialog'", () => {
    const { unmount } = renderState("mixed");
    expect(
      screen.getByRole("button", { name: "＋ Add a video" })
    ).toHaveAttribute("aria-haspopup", "dialog");
    unmount();
    renderState("curated");
    expect(
      screen.getByRole("button", { name: "＋ Add a video" })
    ).toHaveAttribute("aria-haspopup", "dialog");
  });

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

  it("introduces NO heading element in the panel — the value line is a tagline, not a competing <h> (§9)", () => {
    for (const s of ["empty", "mixed", "curated", "error"] as const) {
      const { unmount } = renderState(s);
      // The panel sits inside the page's labelled <aside>; it must not add an <h1>–<h6>
      // that would disrupt the page outline.
      expect(screen.queryByRole("heading")).toBeNull();
      unmount();
    }
  });

  it("the unvetted signal is present in TEXT (not color/border alone) in empty and mixed", () => {
    const { unmount } = renderState("empty");
    // "unreviewed suggestions" / "to weigh in" carry the meaning in words.
    expect(screen.getByText(EMPTY_VOL_2)).toBeInTheDocument();
    unmount();
    renderState("mixed");
    expect(screen.getByText(/suggested/)).toBeInTheDocument();
    expect(screen.getByText(/weigh in/)).toBeInTheDocument();
  });

  it("all three buttons are keyboard-activable real <button>s (Enter/Space, tab order)", async () => {
    const onBrowse = vi.fn();
    const onCurate = vi.fn();
    renderState("empty", onBrowse, onCurate);
    const browse = screen.getByRole("button", { name: "Browse suggested videos" });
    browse.focus();
    expect(browse).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onBrowse).toHaveBeenCalledOnce();
    const curate = screen.getByRole("button", { name: "＋ Curate a video" });
    curate.focus();
    await userEvent.keyboard(" ");
    expect(onCurate).toHaveBeenCalledOnce();
    // Native <button>s — confirms Enter/Space need no custom key handling (§9).
    expect(browse.tagName).toBe("BUTTON");
    expect(curate.tagName).toBe("BUTTON");
  });
});
