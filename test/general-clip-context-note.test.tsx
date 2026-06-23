import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { ClipCard } from "@/components/topic/ClipCard";
import type { Clip } from "@/lib/data/types";

// ── QA & Review — issue #63: surface the curator's context note (+ stance/accuracy) on curated
// General clips. Independent acceptance-criterion coverage (AC1–AC7) for the two render surfaces
// the change touches: the curated General tile (`GeneralStrip`) and the opened player
// (`PlayerModal`). The chip components themselves (label text, AA fills) are covered by
// chips.test.tsx; here we verify the NEW SURFACING — that the chips + note reach the tile and the
// player, the player block matches the rail card's reading order (parity), the @prototype/empty/held
// states behave per §6, and the AC7 non-regressions hold.
//
// Spec: docs/specs/general-clip-context-note.md (AC1–AC7).
// Design: docs/design/general-clip-context-note.md (§2 decision, §4 player block, §6 states, §7 a11y).

/** A full curated General `Clip`. `over` sets the per-test variation. */
function makeGeneralClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "g1",
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    caption: "Overview clip",
    creator: {
      handle: "@cc",
      name: "CrashCourse",
      platform: "youtube",
      url: "https://www.youtube.com/@crashcourse",
    },
    contextNote: "Solid whole-topic overview; the host's framing in the back half is opinion.",
    stance: "explainer",
    accuracyFlag: "accurate_with_caveat",
    accuracyModifier: "simplified",
    general: true,
    curatedBy: "Marcus",
    curatorId: 7,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function renderStrip(clips: Clip[], props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={clips}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — stance + accuracy chips render on the curated General tile.
// AC1 (preview) — a 2-line note preview is reachable on the tile.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC2/AC1 — curated General tile surfaces both chips + a note preview", () => {
  it("renders the StanceChip and AccuracyChip (label text from the CURATION map) on the tile", () => {
    renderStrip([makeGeneralClip()]);
    // The stance chip label (CURATION §2 map) and the accuracy chip label WITH its modifier (§3 + C6).
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText("Accurate, with a caveat · simplified")).toBeInTheDocument();
  });

  it("renders the context-note PREVIEW text (AC1 reachable on the tile) under a 'Curator note' eyebrow", () => {
    renderStrip([makeGeneralClip()]);
    // The eyebrow word (reused verbatim from the rail card) + the note words themselves.
    expect(screen.getByText("Curator note")).toBeInTheDocument();
    expect(
      screen.getByText(/Solid whole-topic overview; the host's framing in the back half is opinion\./)
    ).toBeInTheDocument();
  });

  it("clamps the note preview to 2 lines (line-clamp-2) on a white panel (AA over the indigo band)", () => {
    renderStrip([makeGeneralClip()]);
    const note = screen.getByText(/Solid whole-topic overview/);
    expect(note.className).toMatch(/line-clamp-2/);
    // The note body sits on a raised panel (the AA treatment §3.1), NOT directly on the indigo band.
    // The fill/border are the skin surface/hardbox tokens (#119): `bg-surface-raised` is white on the
    // default skin (byte-identical to the old `bg-white`), the dark card on the zine-dark skin.
    const panel = note.closest("div");
    expect(panel?.className).toMatch(/bg-surface-raised/);
    expect(panel?.className).toMatch(/border-2 border-hardbox/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — the opened player shows the full note + chips + "context by" for a curated clip.
// AC1 — full note text reachable in the player.
// AC5 — "context by" links IN; creator credit links OUT; distinct.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC3/AC1/AC5 — PlayerModal renders the curation block for a curated clip", () => {
  it("renders the FULL (untruncated) context note, both chips, and the 'context by' attribution", () => {
    render(<PlayerModal clip={makeGeneralClip()} onClose={vi.fn()} />);

    // Full note text (not clamped — the player is the 'tell me more' surface, §2).
    const note = screen.getByText(/Solid whole-topic overview; the host's framing in the back half is opinion\./);
    expect(note).toBeInTheDocument();
    expect(note.className).not.toMatch(/line-clamp/);

    // Both chips.
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText("Accurate, with a caveat · simplified")).toBeInTheDocument();

    // "context by <curator>" links IN to the profile and is NOT a new-tab outbound link.
    const contextBy = screen.getByRole("link", { name: "context by Marcus, view their curations" });
    expect(contextBy.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
    expect(contextBy).not.toHaveAttribute("target", "_blank");
  });

  it("renders the creator credit linking OUT to the platform, textually distinct from 'context by'", () => {
    render(<PlayerModal clip={makeGeneralClip()} onClose={vi.fn()} />);
    // The creator credit is an OUT link (new tab, the platform URL) — the distinctness pair (AC5).
    const out = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "https://www.youtube.com/@crashcourse");
    expect(out).toBeDefined();
    expect(out).toHaveAttribute("target", "_blank");
    expect(out).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // The creator name renders inside it; this is NOT the "context by" curator.
    expect(within(out as HTMLElement).getByText("CrashCourse")).toBeInTheDocument();
  });

  it("renders the curation block even when the clip can't be embedded (no embedUrl) — §6", () => {
    render(<PlayerModal clip={makeGeneralClip({ embedUrl: undefined })} onClose={vi.fn()} />);
    expect(screen.getByText(/This clip can't be embedded\./)).toBeInTheDocument();
    // The contextualization does not depend on the embed: note + chips + context-by still render.
    expect(screen.getByText(/Solid whole-topic overview/)).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "context by Marcus, view their curations" })
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — parity: the player block is IDENTICAL for a General vs. a section-anchored clip,
// and mirrors the rail ClipCard's reading order (creator → held → chips → note → context-by).
// ─────────────────────────────────────────────────────────────────────────────
describe("AC4 — General/section-anchored parity in the player + rail-card reading order", () => {
  it("shows the same curation signals for a General clip and a section-anchored clip", () => {
    const general = makeGeneralClip({ general: true });
    const anchored = makeGeneralClip({
      general: false,
      sectionSlug: "calvin-cycle",
      sectionLabel: "Calvin cycle",
    });

    const { unmount } = render(<PlayerModal clip={general} onClose={vi.fn()} />);
    expect(screen.getByText(/Solid whole-topic overview/)).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "context by Marcus, view their curations" })
    ).toBeInTheDocument();
    unmount();

    render(<PlayerModal clip={anchored} onClose={vi.fn()} />);
    // The block does not vary on `clip.general` — identical signals.
    expect(screen.getByText(/Solid whole-topic overview/)).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "context by Marcus, view their curations" })
    ).toBeInTheDocument();
  });

  it("orders the player block as creator → held → chips → note → context-by (mirrors ClipCard)", () => {
    render(<PlayerModal clip={makeGeneralClip({ held: true })} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Video player" });
    const text = dialog.textContent ?? "";
    const iCreator = text.indexOf("CrashCourse");
    const iHeld = text.indexOf("In review");
    const iChips = text.indexOf("Explainer");
    const iNote = text.indexOf("Solid whole-topic overview");
    const iContextBy = text.indexOf("context by");
    expect(iCreator).toBeGreaterThanOrEqual(0);
    expect(iHeld).toBeGreaterThan(iCreator);
    expect(iChips).toBeGreaterThan(iHeld);
    expect(iNote).toBeGreaterThan(iChips);
    expect(iContextBy).toBeGreaterThan(iNote);
  });

  it("the SAME reading order is the rail ClipCard's order (parity target — non-regression)", () => {
    render(
      <ClipCard
        clip={makeGeneralClip({ general: false, sectionSlug: "calvin-cycle", sectionLabel: "Calvin cycle", held: true })}
        active={false}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
    const card = screen.getByRole("article");
    const text = card.textContent ?? "";
    const iCreator = text.indexOf("CrashCourse");
    const iHeld = text.indexOf("In review");
    const iChips = text.indexOf("Explainer");
    const iNote = text.indexOf("Solid whole-topic overview");
    const iContextBy = text.indexOf("context by");
    expect(iHeld).toBeGreaterThan(iCreator);
    expect(iChips).toBeGreaterThan(iHeld);
    expect(iNote).toBeGreaterThan(iChips);
    expect(iContextBy).toBeGreaterThan(iNote);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — @prototype seed: non-linked "seed clip · no curator", never a fake profile link.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC5 — @prototype seed shows 'seed clip · no curator' (not a link) in the player", () => {
  it("renders the non-linked seed label and NO 'context by' profile link", () => {
    render(
      <PlayerModal clip={makeGeneralClip({ curatedBy: "@prototype", curatorId: undefined })} onClose={vi.fn()} />
    );
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /context by/ })).toBeNull();
  });

  it("does the same on an absent curator (no curatedBy)", () => {
    render(<PlayerModal clip={makeGeneralClip({ curatedBy: undefined, curatorId: undefined })} onClose={vi.fn()} />);
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /context by/ })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 — accessibility: chips keep their own AA fills (no indigo re-tint); the "context by"
// link in the player is keyboard-operable inside the unchanged ModalShell trap.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC6 — a11y of the newly surfaced signals", () => {
  it("the tile chip uses its centralized AA-safe fill (NOT re-tinted for the indigo band)", () => {
    renderStrip([makeGeneralClip({ stance: "opinion" })]);
    // The stance chip carries its own deep-violet fill; the indigo band never touches the text.
    expect(screen.getByText("Opinion")).toHaveStyle({ background: "#5248AF" });
  });

  it("the player 'context by' link has its accessible name and is keyboard-focusable in the trap", () => {
    render(<PlayerModal clip={makeGeneralClip()} onClose={vi.fn()} />);
    const link = screen.getByRole("link", { name: "context by Marcus, view their curations" });
    // It is a real <a href> (keyboard-operable; joins the ModalShell focus trap via a[href]).
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href");
    link.focus();
    expect(link).toHaveFocus();
  });

  it("Esc still closes the dialog with the curation block present (ModalShell unchanged)", async () => {
    const onClose = vi.fn();
    render(<PlayerModal clip={makeGeneralClip()} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 (focus model) — adding the curation block must NOT regress ModalShell's focus
// trap: the close button stays the first focusable / initial focus, and Tab cycles
// THROUGH the new links back to close. jsdom has no layout, so offsetParent is always
// null and ModalShell's visibility filter would drop every focusable; stub it (the
// modal-shell.test.tsx convention) so the REAL focus-trap logic is exercised.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC6 (focus model) — player focus trap not regressed by the curation block", () => {
  let restoreOffsetParent: () => void;
  beforeAll(() => {
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return document.body;
      },
    });
    restoreOffsetParent = () => {
      if (desc) Object.defineProperty(HTMLElement.prototype, "offsetParent", desc);
    };
  });
  afterAll(() => restoreOffsetParent?.());

  it("focuses the close button on open (it stays FIRST despite the new block's links)", () => {
    render(<PlayerModal clip={makeGeneralClip()} onClose={vi.fn()} />);
    // The curation block's links come AFTER the close button in DOM order, so the close
    // control is still the first focusable ModalShell focuses on open (focus model intact).
    expect(screen.getByRole("button", { name: /close/ })).toHaveFocus();
  });

  it("Tab from the LAST focusable (the 'context by' link) wraps back to the close button", async () => {
    render(<PlayerModal clip={makeGeneralClip()} onClose={vi.fn()} />);
    const link = screen.getByRole("link", { name: "context by Marcus, view their curations" });
    link.focus();
    await userEvent.tab();
    // The new link joined the Tab cycle; the trap wraps it back to the first focusable (close).
    expect(screen.getByRole("button", { name: /close/ })).toHaveFocus();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC7 — no regression: empty-note guard keeps chips; held coexists; candidates get nothing.
// (The rail ClipCard / ModalShell being untouched is verified by the diff + the parity test above.)
// ─────────────────────────────────────────────────────────────────────────────
describe("AC7/§6 — empty-note guard, held coexistence, candidate non-regression", () => {
  it("TILE: an empty note omits the note panel but the chips still render", () => {
    renderStrip([makeGeneralClip({ contextNote: "" })]);
    // No "Curator note" eyebrow / panel...
    expect(screen.queryByText("Curator note")).toBeNull();
    // ...but the chips are still there.
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText("Accurate, with a caveat · simplified")).toBeInTheDocument();
  });

  it("PLAYER: an empty note omits the note block but chips + context-by still render", () => {
    render(<PlayerModal clip={makeGeneralClip({ contextNote: "" })} onClose={vi.fn()} />);
    expect(screen.queryByText("Curator note")).toBeNull();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "context by Marcus, view their curations" })
    ).toBeInTheDocument();
  });

  it("HELD: a held clip keeps its 'In review' marking alongside the now-surfaced note/chips (tile)", () => {
    renderStrip([makeGeneralClip({ held: true })]);
    expect(screen.getByText("In review · not yet vouched")).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText(/Solid whole-topic overview/)).toBeInTheDocument();
  });

  it("HELD: a held clip in the player shows the held marking + the note/chips together", () => {
    render(<PlayerModal clip={makeGeneralClip({ held: true })} onClose={vi.fn()} />);
    expect(screen.getByText("In review · not yet vouched")).toBeInTheDocument();
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText(/Solid whole-topic overview/)).toBeInTheDocument();
  });

  it("CANDIDATE: a general candidate tile gets NO note and NO chips (CURATION §6)", () => {
    renderStrip([], {
      generalCandidates: [
        {
          id: "cand1",
          topicQid: "Q11982",
          platform: "youtube",
          platformLabel: "YouTube",
          orientation: "horizontal",
          watchUrl: "https://www.youtube.com/watch?v=def",
          caption: "Suggested overview",
          creator: { handle: "@as", name: "Amoeba Sisters", platform: "youtube" },
          vetted: false,
          source: "YouTube",
          matchReason: "Top result",
          general: true,
        },
      ],
    });
    // The candidate's match reason shows, but no curator-note eyebrow and no chips.
    expect(screen.queryByText("Curator note")).toBeNull();
    expect(screen.queryByText("Explainer")).toBeNull();
    expect(screen.queryByText(/Accurate/)).toBeNull();
  });
});
