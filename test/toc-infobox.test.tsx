import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toc, type TocEntry } from "@/components/topic/Toc";
import { Infobox } from "@/components/topic/Infobox";
import type { TopicStats } from "@/lib/data/types";

const entries: TocEntry[] = [
  { slug: "__general", title: "General", level: 2, count: 3 },
  { slug: "light-dependent-reactions", title: "Light-dependent reactions", level: 2, count: 2 },
  { slug: "calvin-cycle", title: "Calvin cycle", level: 2, count: 0 }, // zero-count
];

describe("Toc (AC6 / AC17)", () => {
  it("lists the ＋General row first, then sections (incl. zero-count ones)", () => {
    render(<Toc entries={entries} mode="curated" currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    expect(screen.getByText("Calvin cycle")).toBeInTheDocument(); // zero-count still listed
  });

  it("shows a solid integer count badge for curated sections with videos (AC6)", () => {
    render(<Toc entries={entries} mode="curated" currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    // zero-count section shows no integer badge (it shows the "no video" text badge)
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a 'no video' text badge on a zero-count SECTION (article-fidelity #27 D5)", () => {
    render(<Toc entries={entries} mode="curated" currentSlug={null} onGo={vi.fn()} />);
    // the zero-count "Calvin cycle" row gets the muted text badge (text, not color alone)
    expect(screen.getByText("no video")).toBeInTheDocument();
  });

  it("does NOT badge the ＋General band row with 'no video' even at zero count (D5)", () => {
    const zeroBand: TocEntry[] = [
      { slug: "__general", title: "General", level: 2, count: 0 },
      { slug: "calvin-cycle", title: "Calvin cycle", level: 2, count: 0 },
    ];
    render(<Toc entries={zeroBand} mode="curated" currentSlug={null} onGo={vi.fn()} />);
    // only the section row gets a badge → exactly one "no video"
    expect(screen.getAllByText("no video")).toHaveLength(1);
  });

  it("shows 'no video' on a zero-count section in EMPTY mode too (D5)", () => {
    render(<Toc entries={entries} mode="empty" currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("no video")).toBeInTheDocument();
  });

  it("shows dashed/outline '~n' badges in the empty state (AC17)", () => {
    render(<Toc entries={entries} mode="empty" currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("~2")).toBeInTheDocument();
    expect(screen.getByText("＋ Suggested")).toBeInTheDocument();
    const badge = screen.getByText("~2");
    expect(badge.className).toMatch(/border-dashed/);
  });

  it("invokes onGo with the section slug when an entry is activated (AC6/AC13)", async () => {
    const onGo = vi.fn();
    render(<Toc entries={entries} mode="curated" currentSlug={null} onGo={onGo} />);
    await userEvent.click(screen.getByText("Light-dependent reactions"));
    expect(onGo).toHaveBeenCalledWith("light-dependent-reactions");
  });
});

const stats: TopicStats = { videos: 14, creators: 9, curators: 6, synced: "2h ago" };

describe("Infobox (AC7 curated / AC14 empty)", () => {
  it("shows the three derived counts as big numerals in the curated state (AC7)", () => {
    render(
      <Infobox
        mode="curated"
        stats={stats}
        suggestionCount={0}
        sources="YouTube"
        syncedLabel="now"
        onCurateFirst={vi.fn()}
      />
    );
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
    expect(screen.getByText("Creators")).toBeInTheDocument();
    expect(screen.getByText("Curators")).toBeInTheDocument();
  });

  it("shows '0 / videos curated' and the curate CTA in the empty state (AC14)", () => {
    render(
      <Infobox
        mode="empty"
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        sources="YouTube + TikTok"
        syncedLabel="now"
        onCurateFirst={vi.fn()}
      />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("videos curated")).toBeInTheDocument();
    expect(screen.getByText(/5 auto-suggestions from YouTube \+ TikTok/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Be the first to curate this topic" })
    ).toBeInTheDocument();
  });

  it("fires onCurateFirst when the CTA is activated (AC14)", async () => {
    const onCurateFirst = vi.fn();
    render(
      <Infobox
        mode="empty"
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        sources="YouTube"
        syncedLabel="now"
        onCurateFirst={onCurateFirst}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Be the first to curate this topic" })
    );
    expect(onCurateFirst).toHaveBeenCalledOnce();
  });
});
