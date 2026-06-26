import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Clip } from "@/lib/data/types";

// ── Hero video — the General-strip rendering + control (issue #158, design §2/§3/§7). ───────────
// The presentation half: the prominent hero block at the FRONT of the band (AC6), retaining every
// trust signal (AC7); peer clips still render in the scroll row (AC8); logged-out parity — prominence
// without the control (AC9); the signed-in mark/unmark control; and "no hero" = unchanged band. The
// data-layer at-most-one / eligibility / persistence is covered in test/hero-video.test.ts.

function makeClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    topicQid: "Q11982",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    caption: "Overview clip",
    creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
    contextNote: "A clear whole-topic introduction.",
    stance: "explainer",
    accuracyFlag: "accurate",
    general: true,
    upvotes: 5,
    curatedBy: "@sage",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const hero = makeClip({ id: "hero1", caption: "The hero clip" });
const peer = makeClip({ id: "peer1", caption: "A peer clip" });

function renderStrip(props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={[hero, peer]}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      {...props}
    />
  );
}

describe("GeneralStrip — hero rendering (AC6/AC7/AC8)", () => {
  it("renders no hero block when no hero is set (band unchanged)", () => {
    renderStrip({ heroClipId: undefined });
    expect(screen.queryByText("Hero")).toBeNull();
    expect(screen.queryByRole("article", { name: /Hero video:/ })).toBeNull();
    // Both general clips render in the scroll row.
    expect(screen.getByText("The hero clip")).toBeInTheDocument();
    expect(screen.getByText("A peer clip")).toBeInTheDocument();
  });

  it("AC6 — renders the hero prominently with a text-labeled marker, at the front", () => {
    renderStrip({ heroClipId: "hero1" });
    const block = screen.getByRole("article", { name: "Hero video: The hero clip" });
    expect(block).toBeInTheDocument();
    // The marker carries the meaning in WORDS, not color alone.
    expect(within(block).getByText("Hero")).toBeInTheDocument();
    expect(within(block).getByText("The hero clip")).toBeInTheDocument();
  });

  it("AC7 — the hero retains its trust signals (chips, note, context-by, upvote)", () => {
    renderStrip({ heroClipId: "hero1", signedIn: false });
    const block = screen.getByRole("article", { name: "Hero video: The hero clip" });
    // Stance + accuracy chips (labels come from the curation vocab).
    expect(within(block).getByText(/Explainer/i)).toBeInTheDocument();
    expect(within(block).getByText(/Accurate/i)).toBeInTheDocument();
    // Context note + the "context by" attribution.
    expect(within(block).getByText("A clear whole-topic introduction.")).toBeInTheDocument();
    expect(within(block).getByText(/@sage/)).toBeInTheDocument();
    // The upvote control (count present).
    expect(within(block).getByText(/5 upvotes/)).toBeInTheDocument();
  });

  it("AC8 — the non-hero peer clip still renders in the scroll row (not dropped, not duplicated)", () => {
    renderStrip({ heroClipId: "hero1" });
    expect(screen.getByText("A peer clip")).toBeInTheDocument();
    // The hero caption appears exactly once (in the hero block, not also as a tile).
    expect(screen.getAllByText("The hero clip")).toHaveLength(1);
  });
});

describe("GeneralStrip — hero control gating (AC9 logged-out parity)", () => {
  it("AC9 — logged-out: the hero prominence shows but NO mark/unmark control", () => {
    renderStrip({ heroClipId: "hero1", signedIn: false, onSetHero: vi.fn(), onClearHero: vi.fn() });
    expect(screen.getByRole("article", { name: /Hero video:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unmark/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Make .*hero/i })).toBeNull();
  });

  it("signed-in: a peer tile shows '★ Make hero'; the hero shows 'Unmark hero'", () => {
    renderStrip({ heroClipId: "hero1", signedIn: true, onSetHero: vi.fn(), onClearHero: vi.fn() });
    // The hero block carries the Unmark control.
    expect(
      screen.getByRole("button", { name: /Unmark this video as the topic's hero/i })
    ).toBeInTheDocument();
    // The peer tile carries a Make-hero control.
    expect(
      screen.getByRole("button", { name: /Mark as this topic's hero video: A peer clip/i })
    ).toBeInTheDocument();
  });

  it("invokes onSetHero(peer) and onClearHero() on activation", async () => {
    const onSetHero = vi.fn();
    const onClearHero = vi.fn();
    renderStrip({ heroClipId: "hero1", signedIn: true, onSetHero, onClearHero });
    await userEvent.click(
      screen.getByRole("button", { name: /Mark as this topic's hero video: A peer clip/i })
    );
    expect(onSetHero).toHaveBeenCalledWith(peer);
    await userEvent.click(
      screen.getByRole("button", { name: /Unmark this video as the topic's hero/i })
    );
    expect(onClearHero).toHaveBeenCalledTimes(1);
  });

  it("with no hero set, signed-in: every general tile offers 'Make hero'", () => {
    renderStrip({ heroClipId: undefined, signedIn: true, onSetHero: vi.fn() });
    expect(
      screen.getAllByRole("button", { name: /Mark as this topic's hero video/i })
    ).toHaveLength(2);
  });

  it("the controls are disabled while a hero write is in flight", () => {
    renderStrip({
      heroClipId: "hero1",
      signedIn: true,
      onSetHero: vi.fn(),
      onClearHero: vi.fn(),
      settingHero: true,
    });
    expect(
      screen.getByRole("button", { name: /Unmark this video as the topic's hero/i })
    ).toBeDisabled();
  });
});
