import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinnedPlayer, type PinnedClip } from "@/components/topic/PinnedPlayer";
import { PlayerModal } from "@/components/topic/PlayerModal";
import type { Clip } from "@/lib/data/types";

// Component-level verification of the two logged-out player CTAs added by issue #71
// (spec AC5/AC6/AC7/AC9; design `docs/design/declutter-logged-out.md` §6/§6.4/§7/§7.4).
// The on-tile decluttering (curated read-only count, watch-only candidates) is covered in
// upvote-control.test.tsx / candidate.test.tsx / general-strip.test.tsx; here we pin the
// two player surfaces' own contract: logged-out CTA present, signed-in CTA absent, gate
// routing fires, and the modal/non-modal focus contracts hold.

const NOCOOKIE = "https://www.youtube-nocookie.com/embed/abc123";

const candidateClip: PinnedClip = {
  embedUrl: NOCOOKIE,
  caption: "Glycolysis in 2 minutes",
  orientation: "horizontal",
  creator: { handle: "@2minuteclassroom" },
  platformLabel: "YouTube",
};

function makeClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "clip1",
    topicQid: "Q189603",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    caption: "Clip",
    creator: { handle: "@x", name: "Creator X", platform: "youtube" },
    general: true,
    contextNote: "Solid explainer; minor caveat.",
    stance: "explainer",
    accuracyFlag: "accurate",
    curatedBy: "curatorX",
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const CURATE_CTA = "Curate this video — log in to write a context note and vouch for it";
const JOIN_CTA = "Log in to curate videos for this topic";

// ── PinnedPlayer "Curate this video" CTA (AC5/AC7/AC9; design §6) ──────────────────────────
describe("PinnedPlayer — logged-out 'Curate this video' CTA (#71 §6)", () => {
  it("renders the CTA when logged out and an onCurate is bound (AC5)", () => {
    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    const cta = screen.getByRole("button", { name: CURATE_CTA });
    // Text-labeled, never color-alone: the visible word "Curate" carries the meaning (AC9).
    expect(cta.textContent).toMatch(/Curate this video/);
  });

  it("does NOT render the CTA when signed in (AC7)", () => {
    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn
        onCurate={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: CURATE_CTA })).toBeNull();
  });

  it("does NOT render the CTA when no onCurate is bound (no candidate to route to)", () => {
    render(
      <PinnedPlayer clip={candidateClip} onClose={vi.fn()} signedIn={false} />
    );
    expect(screen.queryByRole("button", { name: CURATE_CTA })).toBeNull();
  });

  it("activating the CTA fires onCurate (routes into the candidate's gated curate flow — AC5)", async () => {
    const onCurate = vi.fn();
    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={onCurate}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: CURATE_CTA }));
    expect(onCurate).toHaveBeenCalledOnce();
  });

  it("is a real keyboard-operable <button> with the gate hint (AC9)", async () => {
    const onCurate = vi.fn();
    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={onCurate}
      />
    );
    const cta = screen.getByRole("button", { name: CURATE_CTA });
    expect(cta).toHaveAttribute("type", "button");
    // It announces a dialog destination (the login gate) honestly to AT.
    expect(cta).toHaveAttribute("aria-haspopup", "dialog");
    cta.focus();
    expect(cta).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onCurate).toHaveBeenCalledOnce();
  });

  it("does NOT steal focus on dock open — the non-modal contract holds (AC9, §6.4)", () => {
    // A control outside the dock that was focused before the dock mounts.
    render(<button type="button">outside</button>);
    const outside = screen.getByRole("button", { name: "outside" });
    outside.focus();
    expect(outside).toHaveFocus();

    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    // The dock mounted with the CTA present but did NOT pull focus to itself.
    expect(outside).toHaveFocus();
    expect(screen.getByRole("button", { name: CURATE_CTA })).not.toHaveFocus();
  });

  it("adding the CTA does not turn the dock into a dialog (still a labeled region)", () => {
    render(
      <PinnedPlayer
        clip={candidateClip}
        onClose={vi.fn()}
        signedIn={false}
        onCurate={vi.fn()}
      />
    );
    const region = screen.getByRole("region", { name: "Video preview" });
    expect(region).not.toHaveAttribute("role", "dialog");
    expect(region).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── PlayerModal "Log in to curate videos for this topic" join nudge (AC6/AC7/AC9; design §7) ─
describe("PlayerModal — logged-out join nudge (#71 §7)", () => {
  it("renders the nudge when logged out and an onJoin is bound (AC6)", () => {
    render(
      <PlayerModal
        clip={makeClip()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: JOIN_CTA })).toBeInTheDocument();
  });

  it("does NOT render the nudge when signed in (AC7)", () => {
    render(
      <PlayerModal
        clip={makeClip()}
        onClose={vi.fn()}
        signedIn
        onJoin={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: JOIN_CTA })).toBeNull();
  });

  it("renders the nudge inside the dialog focus trap (AC6)", () => {
    render(
      <PlayerModal
        clip={makeClip()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Video player" });
    // The CTA lives in the dialog's DOM, so it joins the existing ModalShell trap.
    expect(
      dialog.querySelector("button")
    ).toBeTruthy();
    const cta = screen.getByRole("button", { name: JOIN_CTA });
    expect(dialog.contains(cta)).toBe(true);
  });

  it("keeps the ✕ close button FIRST in the dialog (still first-focused on open — §7.4)", () => {
    render(
      <PlayerModal
        clip={makeClip()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Video player" });
    const buttons = Array.from(dialog.querySelectorAll("button"));
    // The close button is the first focusable; the join nudge is the LAST (§7.4 tab order).
    expect(buttons[0].textContent).toMatch(/close/i);
    expect(buttons[buttons.length - 1].textContent).toBe(JOIN_CTA);
  });

  it("activating the nudge fires onJoin (routes through the login gate — AC6)", async () => {
    const onJoin = vi.fn();
    render(
      <PlayerModal
        clip={makeClip()}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={onJoin}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: JOIN_CTA }));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("renders the nudge even when the clip can't be embedded (block always renders — §7)", () => {
    render(
      <PlayerModal
        clip={makeClip({ embedUrl: undefined })}
        onClose={vi.fn()}
        signedIn={false}
        onJoin={vi.fn()}
      />
    );
    expect(screen.getByText(/can't be embedded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: JOIN_CTA })).toBeInTheDocument();
  });
});
