import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toc, type TocEntry } from "@/components/topic/Toc";
import { Infobox } from "@/components/topic/Infobox";
import type { TopicStats } from "@/lib/data/types";

// Issue #60 §5.2: a TocEntry carries DUAL counts ({ curated, suggested }) — no `mode`.
const curatedEntries: TocEntry[] = [
  { slug: "__general", title: "General", level: 2, curated: 3, suggested: 0 },
  {
    slug: "light-dependent-reactions",
    title: "Light-dependent reactions",
    level: 2,
    curated: 2,
    suggested: 0,
  },
  { slug: "calvin-cycle", title: "Calvin cycle", level: 2, curated: 0, suggested: 0 }, // zero-count
];

const suggestedEntries: TocEntry[] = [
  { slug: "__general", title: "General", level: 2, curated: 0, suggested: 3 },
  {
    slug: "light-dependent-reactions",
    title: "Light-dependent reactions",
    level: 2,
    curated: 0,
    suggested: 2,
  },
  { slug: "calvin-cycle", title: "Calvin cycle", level: 2, curated: 0, suggested: 0 },
];

describe("Toc (AC6 / AC17 / #60 §5.2)", () => {
  it("lists the ＋General row first, then sections (incl. zero-count ones)", () => {
    render(<Toc entries={curatedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    expect(screen.getByText("Calvin cycle")).toBeInTheDocument(); // zero-count still listed
  });

  it("shows a solid integer count badge for curated sections with videos (AC6)", () => {
    render(<Toc entries={curatedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    // a zero-count section shows no integer badge — and no "no video" badge (overview-card-cleanup §5).
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows NO 'no video' badge on a zero-count section row; it just lists the title (AC10)", () => {
    render(<Toc entries={curatedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.queryByText("no video")).toBeNull();
    expect(screen.getByText("Calvin cycle")).toBeInTheDocument();
  });

  it("shows NO 'no video' badge anywhere — band row or section, curated or suggested TOC (AC10)", () => {
    const zeroBand: TocEntry[] = [
      { slug: "__general", title: "General", level: 2, curated: 0, suggested: 0 },
      { slug: "calvin-cycle", title: "Calvin cycle", level: 2, curated: 0, suggested: 0 },
    ];
    const { unmount } = render(
      <Toc entries={zeroBand} currentSlug={null} onGo={vi.fn()} />
    );
    expect(screen.queryByText("no video")).toBeNull();
    unmount();
    render(<Toc entries={suggestedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.queryByText("no video")).toBeNull();
  });

  it("shows dashed/outline '~n' badges for suggestion counts (AC17)", () => {
    render(<Toc entries={suggestedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("~2")).toBeInTheDocument();
    // The band row label is always "＋ General" now (issue #60 §5.3) — no "＋ Suggested".
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    const badge = screen.getByText("~2");
    expect(badge.className).toMatch(/border-dashed/);
  });

  // Issue #60 AC12: a row with BOTH renders BOTH badges, curated-first, each text-labeled.
  it("renders BOTH the solid curated and dashed suggested badge on a mixed row (AC12)", () => {
    const mixed: TocEntry[] = [
      { slug: "__general", title: "General", level: 2, curated: 4, suggested: 7 },
    ];
    render(<Toc entries={mixed} currentSlug={null} onGo={vi.fn()} />);
    const solid = screen.getByText("4");
    const dashed = screen.getByText("~7");
    expect(solid.className).not.toMatch(/border-dashed/);
    expect(dashed.className).toMatch(/border-dashed/);
    // Text-labeled (AC15) — the meaning is in the accessible name, not color/border alone.
    expect(within(solid).getByText("curated")).toBeInTheDocument();
    expect(within(dashed).getByText("suggested, unvetted")).toBeInTheDocument();
  });

  it("invokes onGo with the section slug when an entry is activated (AC6/AC13)", async () => {
    const onGo = vi.fn();
    render(<Toc entries={curatedEntries} currentSlug={null} onGo={onGo} />);
    await userEvent.click(screen.getByText("Light-dependent reactions"));
    expect(onGo).toHaveBeenCalledWith("light-dependent-reactions");
  });
});

const stats: TopicStats = { videos: 14, creators: 9, curators: 6, synced: "2h ago" };

// ＋plus Overview card after the cleanup (design overview-card-cleanup.md). These cover the
// component contract Dev built; QA authors the full acceptance matrix on top.
describe("Infobox (Overview card — overview-card-cleanup)", () => {
  it("shows the three derived counts as big numerals when curated (§3.4)", () => {
    render(<Infobox hasCurated stats={stats} suggestionCount={0} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
    expect(screen.getByText("Creators")).toBeInTheDocument();
    expect(screen.getByText("Curators")).toBeInTheDocument();
  });

  it("shows the dashed volume panel with 'uncurated videos' label in the empty state", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    // The unvetted meaning is carried in TEXT, not color/border alone.
    expect(screen.getByText("uncurated videos")).toBeInTheDocument();
    // No curate button, and no Browse/Jump button (overview-card-cleanup §3.2/§3.3).
    expect(screen.queryByRole("button", { name: "＋ Curate a video" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Browse suggested videos/i })
    ).toBeNull();
  });

  // The mixed face — three numerals + the trimmed two-count line (no Jump button).
  it("shows the '{V} curated · {M} suggested' line (without 'to weigh in') in mixed state", () => {
    render(<Infobox hasCurated stats={stats} suggestionCount={12} />);
    expect(screen.getByText("14")).toBeInTheDocument(); // the curated numerals still show
    expect(screen.getByText(/14 curated/)).toBeInTheDocument();
    expect(screen.getByText(/12 suggested/)).toBeInTheDocument();
    expect(screen.queryByText(/to\s+weigh in/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Jump to videos/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "＋ Add a video" })).toBeNull();
  });

  // Fully-curated — numerals only, NO suggestion count, NO unvetted line.
  it("shows no suggestion count in the fully-curated state", () => {
    render(<Infobox hasCurated stats={stats} suggestionCount={0} />);
    expect(screen.queryByText(/suggested/)).toBeNull();
    expect(screen.queryByRole("button", { name: "＋ Add a video" })).toBeNull();
  });

  it("renders a thin indigo cap with NO wordmark text (AC1)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
      />
    );
    expect(screen.queryByText("＋plus")).toBeNull();
    expect(screen.queryByText("on this topic")).toBeNull();
  });

  // The store-read error floor — the honest line, no counts/buttons.
  it("renders the honest error line and no counts/buttons on storeError (§6.5)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        storeError
      />
    );
    expect(
      screen.getByText(
        "Couldn't load this topic's video stats. The article is unaffected."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("5")).toBeNull(); // no numerals
  });
});
