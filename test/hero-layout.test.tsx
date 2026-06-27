import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Clip } from "@/lib/data/types";

// ── general-hero-layout AC1/AC2/AC3: the full-bleed hero block STRUCTURE. ─────────────────────────
// hero-video-view.test.tsx covers the prominence mechanism (front placement, trust signals, controls,
// no-duplication). This pins the redesign's layout contract: the curated heading is sr-only (AC1); the
// hero VIDEO bleeds (a uniform 16:9 frame with NO own border, the article breaks out with -mx-5) (AC2);
// the curation card is a SEPARATE white bordered card (AC2); the gold ★ marker lives on the CARD, not
// the video thumbnail (AC3); and an only-hero clip bleeds top AND bottom (AC2 first/last edges).

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
    caption: "The hero clip",
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

function renderStrip(props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={[makeClip({ id: "hero1" })]}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      heroClipId="hero1"
      {...props}
    />
  );
}

describe("GeneralStrip hero layout — AC1 lower-chrome heading", () => {
  it("a curated state shows an sr-only 'General videos' h2 and NO visible '＋ General' / count pill", () => {
    renderStrip();
    const h2 = screen.getByRole("heading", { level: 2, name: "General videos" });
    expect(h2.className).toContain("sr-only");
    expect(screen.queryByText("＋ General")).toBeNull();
    expect(screen.queryByText(/\d+ video$/)).toBeNull();
  });
});

describe("GeneralStrip hero layout — AC2 full-bleed video + separate docked card", () => {
  it("the hero article breaks out of the band padding (-mx-5)", () => {
    renderStrip();
    const block = screen.getByRole("article", { name: /Hero video:/ });
    expect(block.className).toContain("-mx-5");
  });

  it("the hero bleeds the band's top edge (-mt-4); the bottom is flush via the header container", () => {
    renderStrip({ signedIn: false });
    const block = screen.getByRole("article", { name: /Hero video:/ });
    expect(block.className).toContain("-mt-4"); // nothing above the hero → top bleed
    // The header container carries no bottom padding, so a last-element hero is already flush to the
    // band bottom — no `-mb-4` margin needed (general-strip-fullbleed.md §3).
    expect(block.className).not.toContain("-mb-4");
  });

  it("signed-in ALSO bleeds the top — the find-more controls ride the row below, not a toolbar above", () => {
    renderStrip({ signedIn: true });
    const block = screen.getByRole("article", { name: /Hero video:/ });
    // Nothing renders above the hero in any auth state (the heading is sr-only; the curator controls
    // are the leading item of the scroll row BELOW), so it bleeds to the top identically to logged-out.
    expect(block.className).toContain("-mt-4");
    expect(block.className).not.toMatch(/(^|\s)mt-4(\s|$)/); // no positive top margin
  });

  it("the hero VIDEO thumbnail carries NO 2px border (the band/card frame it)", () => {
    renderStrip();
    const block = screen.getByRole("article", { name: /Hero video:/ });
    // The play facade is the only <button> inside the hero block when logged-out.
    const thumb = within(block).getByRole("button", { name: /Play:/ });
    expect(thumb.className).not.toContain("border-2");
    expect(thumb.className).toContain("aspect-video"); // uniform 16:9 for any orientation
  });

  it("the curation card is a SEPARATE bordered white (surface-raised) card, distinct from the video", () => {
    const { container } = renderStrip();
    // A docked card: surface-raised fill + a 2px seam/border, holding the caption.
    const card = container.querySelector(".bg-surface-raised.border-t-2");
    expect(card).not.toBeNull();
    expect(card?.className).toContain("text-ink-plus"); // ink text on white clears AA over the band
    expect(within(card as HTMLElement).getByText("The hero clip")).toBeInTheDocument();
  });
});

describe("GeneralStrip hero layout — AC3 gold ★ on the card, not the video", () => {
  it("the gold ★ svg lives inside the curation card, never on the video thumbnail", () => {
    renderStrip();
    const block = screen.getByRole("article", { name: /Hero video:/ });
    const star = block.querySelector("svg.fill-gold-accent");
    expect(star).not.toBeNull();
    expect(star).toHaveAttribute("aria-hidden"); // decorative; meaning is the region label + shape
    // The ★ is NOT inside the play-facade button (the video thumb).
    const thumb = within(block).getByRole("button", { name: /Play:/ });
    expect(thumb.querySelector("svg.fill-gold-accent")).toBeNull();
  });
});
