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
    // zero-count section shows no integer badge (it shows the "no video" text badge)
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows a 'no video' text badge on a zero-count SECTION (article-fidelity #27 D5)", () => {
    render(<Toc entries={curatedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("no video")).toBeInTheDocument();
  });

  it("does NOT badge the ＋General band row with 'no video' even at zero count (D5)", () => {
    const zeroBand: TocEntry[] = [
      { slug: "__general", title: "General", level: 2, curated: 0, suggested: 0 },
      { slug: "calvin-cycle", title: "Calvin cycle", level: 2, curated: 0, suggested: 0 },
    ];
    render(<Toc entries={zeroBand} currentSlug={null} onGo={vi.fn()} />);
    // only the section row gets a badge → exactly one "no video"
    expect(screen.getAllByText("no video")).toHaveLength(1);
  });

  it("shows 'no video' on a zero-count section in a suggestions-only TOC too (D5)", () => {
    render(<Toc entries={suggestedEntries} currentSlug={null} onGo={vi.fn()} />);
    expect(screen.getByText("no video")).toBeInTheDocument();
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

// ＋plus overview panel — Direction A (docs/design/plus-overview-redesign.md). These cover the
// component contract Dev built; QA authors the full acceptance matrix on top.
describe("Infobox (plus-overview redesign — Direction A)", () => {
  it("shows the three derived counts as big numerals when curated (§6.2/§6.3)", () => {
    render(
      <Infobox
        hasCurated
        stats={stats}
        suggestionCount={0}
        onBrowse={vi.fn()}
      />
    );
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Videos")).toBeInTheDocument();
    expect(screen.getByText("Creators")).toBeInTheDocument();
    expect(screen.getByText("Curators")).toBeInTheDocument();
  });

  it("shows the dashed volume panel with 'uncurated videos' label in the empty state (§6.1)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        onBrowse={vi.fn()}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    // The unvetted meaning is carried in TEXT (§9), not color/border alone.
    expect(screen.getByText("uncurated videos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Browse suggested videos" })
    ).toBeInTheDocument();
    // No curate button — secondary block removed.
    expect(screen.queryByRole("button", { name: "＋ Curate a video" })).toBeNull();
  });

  // §6.2: the mixed face — three numerals + the trimmed two-count line + Jump button.
  it("shows the '{V} curated · {M} suggested' line (without 'to weigh in') in mixed state (§6.2)", () => {
    render(
      <Infobox
        hasCurated
        stats={stats}
        suggestionCount={12}
        onBrowse={vi.fn()}
      />
    );
    expect(screen.getByText("14")).toBeInTheDocument(); // the curated numerals still show
    expect(screen.getByText(/14 curated/)).toBeInTheDocument();
    expect(screen.getByText(/12 suggested/)).toBeInTheDocument();
    expect(screen.queryByText(/to\s+weigh in/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Jump to videos" })
    ).toBeInTheDocument();
    // No add button — secondary block removed.
    expect(screen.queryByRole("button", { name: "＋ Add a video" })).toBeNull();
  });

  // §6.3: fully-curated — numerals only, NO suggestion count, NO unvetted line.
  it("shows no suggestion count in the fully-curated state (§6.3)", () => {
    render(
      <Infobox
        hasCurated
        stats={stats}
        suggestionCount={0}
        onBrowse={vi.fn()}
      />
    );
    expect(screen.queryByText(/suggested/)).toBeNull();
    // No add button — secondary block removed.
    expect(screen.queryByRole("button", { name: "＋ Add a video" })).toBeNull();
  });

  it("renders the ＋plus header with the 'on this topic' label (§6.1)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        onBrowse={vi.fn()}
      />
    );
    expect(screen.getByText("＋plus")).toBeInTheDocument();
    expect(screen.getByText("on this topic")).toBeInTheDocument();
  });

  // §6.5: the store-read error floor — header + the honest line, no counts/buttons.
  it("renders the honest error line and no counts/buttons on storeError (§6.5)", () => {
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        storeError
        onBrowse={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        "Couldn't load this topic's video stats. The article is unaffected."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull(); // no browse
    expect(screen.queryByText("5")).toBeNull(); // no numerals
  });

  it("fires onBrowse (scroll) from the primary action (§10)", async () => {
    const onBrowse = vi.fn();
    render(
      <Infobox
        hasCurated={false}
        stats={{ videos: 0, creators: 0, curators: 0 }}
        suggestionCount={5}
        onBrowse={onBrowse}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Browse suggested videos" })
    );
    expect(onBrowse).toHaveBeenCalledOnce();
  });
});
