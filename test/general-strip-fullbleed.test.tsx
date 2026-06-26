import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { CuratorBadge } from "@/components/topic/CuratorBadge";
import { VideoThumb } from "@/components/topic/VideoThumb";
import type { Candidate, Clip } from "@/lib/data/types";

// ── QA & Review — general-strip-fullbleed (design docs/design/general-strip-fullbleed.md, AC1–AC6).
// Independent, non-author coverage for the structural contract of the redesign that the existing
// general-clip-context-note / hero-layout suites don't pin: the white-card `stripcard` thumbnail
// variant, the corner `CuratorBadge` (stub→null / real→link + aria-label + focus-revealed name), the
// full-bleed `.general-scroller` (and that it's a SIBLING of the centered header container, not nested
// in it), and the seed-clip "context by"/"seed clip · no curator" fallback inside the white card.

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
    creator: {
      handle: "@cc",
      name: "CrashCourse",
      platform: "youtube",
      url: "https://www.youtube.com/@crashcourse",
    },
    contextNote: "Solid whole-topic overview; the back-half framing is opinion.",
    stance: "explainer",
    accuracyFlag: "accurate",
    general: true,
    curatedBy: "Marcus",
    curatorId: 7,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function makeCand(over: Partial<Candidate> = {}): Candidate {
  return {
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
    ...over,
  };
}

function renderStrip(props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={[makeClip()]}
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
// AC4 — the scroll row is the full-bleed `.general-scroller`, a SIBLING of the
// centered `max-w-[1200px]` header container (not nested inside it).
// ─────────────────────────────────────────────────────────────────────────────
describe("AC4 — full-bleed `.general-scroller` is a sibling of the centered header", () => {
  it("the scroll <ul> carries `.general-scroller` and is NOT a descendant of the centered container", () => {
    const { container } = renderStrip();
    const ul = container.querySelector("ul.general-scroller");
    expect(ul).not.toBeNull();
    // It must NOT be nested inside the centered `max-w-[1200px]` header container — that nesting is
    // exactly what would re-confine the scroll to the content column (AC4 regression). It is a direct
    // child of the band <section>.
    const centered = container.querySelector("div.max-w-\\[1200px\\]");
    expect(centered).not.toBeNull();
    expect(centered?.contains(ul as Node)).toBe(false);
    const section = container.querySelector("section#general-band");
    expect(ul?.parentElement).toBe(section);
  });

  it("renders the scroller (controls-only) for a signed-in zero-results band, with the zero line", () => {
    // Empty (0 curated, 0 suggestions, not loading) + signed-in → the find-more controls lead a
    // scroller AND the honest zero line shows. The scroller must still render so the actions are
    // reachable.
    const { container } = renderStrip({ generalClips: [], signedIn: true });
    expect(container.querySelector("ul.general-scroller")).not.toBeNull();
    expect(screen.getByText(/No videos found for this topic yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "＋ Add video" })).toBeInTheDocument();
  });

  it("omits the scroller entirely for a logged-out zero-results band (nothing to show)", () => {
    const { container } = renderStrip({ generalClips: [], signedIn: false });
    expect(container.querySelector("ul.general-scroller")).toBeNull();
    expect(screen.getByText(/check back as people curate this topic/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — every curated peer tile + every suggestion tile is a white card with a 3:2
// `stripcard` thumbnail bled to the top (bottom seam only); tiles are ~288px (w-72).
// ─────────────────────────────────────────────────────────────────────────────
describe("AC1 — curated + suggestion tiles are white cards with a 3:2 `stripcard` thumb", () => {
  it("the curated tile is a white (surface-raised) bordered card ~288px wide", () => {
    const { container } = renderStrip();
    const item = container.querySelector("li.w-72");
    expect(item).not.toBeNull(); // ~288px tile width
    const card = item?.querySelector("div.bg-surface-raised.border-2");
    expect(card).not.toBeNull();
    expect(card?.className).toContain("text-ink-plus"); // ink text on white → AA over the indigo band
  });

  it("the curated thumb uses the 3:2 `stripcard` frame with ONLY a bottom seam (no full border)", () => {
    renderStrip();
    const thumb = screen.getByRole("button", { name: "Play: Overview clip" });
    expect(thumb.className).toContain("aspect-[3/2]"); // 3:2, taller than 16:9
    expect(thumb.className).toContain("border-b-2"); // bottom seam only
    expect(thumb.className).not.toMatch(/(^|\s)border-2(\s|$)/); // not the full 2px frame
    expect(thumb.className).toContain("w-full"); // fills the card width
  });

  it("the suggestion tile is a dashed `candcard` white card with the same 3:2 `stripcard` thumb", () => {
    const { container } = renderStrip({ generalClips: [], generalCandidates: [makeCand()] });
    const card = container.querySelector("div.candcard.w-72");
    expect(card).not.toBeNull(); // dashed unvetted card, ~288px
    const thumb = within(card as HTMLElement).getByRole("button");
    expect(thumb.className).toContain("aspect-[3/2]");
    expect(thumb.className).toContain("border-b-2");
  });

  it("VideoThumb `stripcard` renders a desaturated/hatched candidate frame when `candidate`", () => {
    const { container } = render(
      <VideoThumb
        video={{
          platform: "youtube",
          platformLabel: "YouTube",
          orientation: "horizontal",
          caption: "x",
          watchUrl: "https://youtu.be/x",
          thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
        }}
        variant="stripcard"
        candidate
      />
    );
    // The hatch overlay marks "candidate"; the image is desaturated.
    expect(container.querySelector("span.candthumb")).not.toBeNull();
    const img = container.querySelector("img");
    expect(img?.className).toMatch(/saturate-\[\.55\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — the curator credit is the corner `CuratorBadge`: a real link to the profile,
// aria-label "context by <user>", full name revealed on hover AND focus; stub → null.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC2 — CuratorBadge: real → focusable link w/ accessible name + focus-revealed name", () => {
  it("renders a real <a> link to /contributor/<user> with the full 'context by' accessible name", () => {
    render(<CuratorBadge curatedBy="Marcus" />);
    const link = screen.getByRole("link", { name: "context by Marcus, view their curations" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
  });

  it("the meaning is NOT carried by the initial/hover alone — the aria-label has the full name", () => {
    render(<CuratorBadge curatedBy="Marcus" />);
    const link = screen.getByRole("link", { name: /context by Marcus/ });
    // The visible glyph is just the initial; the accessible name carries the full attribution.
    expect(within(link).getByText("M", { selector: "span[aria-hidden]" })).toBeInTheDocument();
  });

  it("the full name reveals on FOCUS as well as hover (group-focus:block, not hover-only)", () => {
    render(<CuratorBadge curatedBy="Marcus" />);
    const link = screen.getByRole("link", { name: /context by Marcus/ });
    const namePill = within(link).getByText("Marcus", { selector: "span[aria-hidden]" });
    // The pill is `hidden` by default and revealed by BOTH group-hover and group-focus — a
    // keyboard user (focus, no pointer) must get the name too.
    expect(namePill.className).toContain("hidden");
    expect(namePill.className).toContain("group-focus:block");
    expect(namePill.className).toContain("group-hover:block");
    // The `group` is the link itself, so focusing it triggers `group-focus` (not group-focus-within).
    expect(link.className).toContain("group");
  });

  it("a stub / @prototype / absent curator renders NOTHING (no dead link, no badge)", () => {
    const { container: a } = render(<CuratorBadge curatedBy="@prototype" />);
    expect(a.querySelector("a")).toBeNull();
    const { container: b } = render(<CuratorBadge curatedBy={undefined} />);
    expect(b.querySelector("a")).toBeNull();
    const { container: c } = render(<CuratorBadge curatedBy={null} />);
    expect(c.querySelector("a")).toBeNull();
  });
});

describe("AC2 — the bordered curator note hosts the badge; the old 'context by' row is gone", () => {
  it("a real-curator note tile shows the badge and NO separate 'context by' attribution row", () => {
    renderStrip();
    // The corner badge is present...
    expect(
      screen.getByRole("link", { name: "context by Marcus, view their curations" })
    ).toBeInTheDocument();
    // ...and there is no separate "context by Marcus" TEXT row (the credit is the badge, not a row).
    // Only the badge link carries the name; there is no visible "context by" prose for it.
    expect(screen.queryByText(/^context by/)).toBeNull();
    // The note panel that hosts the absolute badge is `relative` (so the badge anchors to it).
    const note = screen.getByText(/Solid whole-topic overview/).closest("div");
    expect(note?.className).toContain("relative");
    expect(note?.className).toMatch(/border-l-4 border-brand/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2 (fallback) — a seed/stub curator (or an empty note) falls back to the compact
// "seed clip · no curator" / "context by" line so provenance is still stated.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC2 (fallback) — seed/stub & empty-note credit line inside the white card", () => {
  it("a @prototype seed clip shows the non-linked 'seed clip · no curator' line, no badge", () => {
    renderStrip({ generalClips: [makeClip({ curatedBy: "@prototype", curatorId: undefined })] });
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /context by/ })).toBeNull();
  });

  it("an empty-note real curator falls back to a linked 'context by' line (still credited)", () => {
    renderStrip({ generalClips: [makeClip({ contextNote: "" })] });
    // No note panel / badge...
    expect(screen.queryByText("Curator note")).toBeNull();
    // ...but the curator is still credited via the compact context-by line linking to the profile.
    const link = screen.getByRole("link", { name: "context by Marcus, view their curations" });
    expect(link.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — suggestion tiles keep the signed-in Curate / Not relevant actions + the
// "Suggested · uncurated" divider (mixed). AC5 — the find-more lead is intact.
// ─────────────────────────────────────────────────────────────────────────────
describe("AC3/AC5 — mixed band: divider, signed-in candidate actions, find-more lead", () => {
  it("keeps the 'Suggested · uncurated' divider word in a mixed band (AT-readable)", () => {
    renderStrip({ generalClips: [makeClip()], generalCandidates: [makeCand()] });
    expect(screen.getByText("Suggested · uncurated")).toBeInTheDocument();
  });

  it("signed-in suggestion tiles get Curate / Not relevant; logged-out get neither", () => {
    const { rerender } = renderStrip({
      generalClips: [],
      generalCandidates: [makeCand()],
      signedIn: true,
    });
    expect(screen.getByRole("button", { name: /Curate this clip/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dismiss as not relevant/ })).toBeInTheDocument();

    rerender(
      <GeneralStrip
        topicTitle="Photosynthesis"
        generalClips={[]}
        generalCandidates={[makeCand()]}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
        signedIn={false}
      />
    );
    expect(screen.queryByRole("button", { name: /Curate this clip/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dismiss as not relevant/ })).toBeNull();
  });

  it("the find-more controls are the LEADING item of the scroller (signed-in, mixed)", () => {
    const { container } = renderStrip({
      generalClips: [makeClip()],
      generalCandidates: [makeCand()],
      signedIn: true,
    });
    const ul = container.querySelector("ul.general-scroller") as HTMLElement;
    const firstItem = ul.querySelector(":scope > li");
    // The first scroller item is the find-more group, not a video tile.
    expect(within(firstItem as HTMLElement).getByRole("button", { name: "＋ Add video" })).toBeInTheDocument();
  });
});
