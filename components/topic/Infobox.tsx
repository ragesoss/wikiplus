"use client";

import type { TopicStats } from "@/lib/data/types";
import { Stat } from "./Stat";

// ＋plus overview panel (design docs/design/plus-overview-redesign.md — Direction A).
//
// The panel leads with a state-variant counts/volume block and a primary Browse/Jump
// scroll action. It is useful to a non-curator.
//
// Three derived states share ONE structure (§6), reshaping only the counts/volume block:
//   - empty          (0 curated, ≥1 suggestion) → dashed bg2 panel: the suggestion numeral
//                                                  + "uncurated videos".
//   - mixed          (≥1 curated, ≥1 sugg.)     → the 3-up Videos/Creators/Curators grid
//                                                  + the "{V} curated · {M} suggested"
//                                                  two-count line.
//   - fully-curated  (≥1 curated, 0 sugg.)      → the 3-up grid only (no suggestion count,
//                                                  no unvetted line).
// Plus the §6.5 ERROR floor: header + an honest one-line, no counts/buttons.
//
// The unvetted meaning is carried in TEXT ("suggested" / "uncurated"), never by
// color or border alone (§9). Gold is not used.

export function Infobox({
  hasCurated,
  stats,
  suggestionCount,
  storeError = false,
  candidatesLoading = false,
  onBrowse,
}: {
  /** ≥1 curated clip — selects the numeral grid vs. the empty volume panel. */
  hasCurated: boolean;
  stats: TopicStats;
  /** Remaining, deduped suggestions (`liveCandidates.length`) — `{M}` in mixed / the empty numeral. */
  suggestionCount: number;
  /** Store-read failure floor (§6.5): render header + an honest line, no counts/buttons. */
  storeError?: boolean;
  /** The live candidate search is still in flight (topic-loading-states §4 row 4). While it is —
   *  on an uncurated topic whose suggestion count has not settled — the empty volume block shows a
   *  projector-scan loading treatment instead of a (misleading) "0 uncurated videos" numeral. */
  candidatesLoading?: boolean;
  /** Browse/Jump — ALWAYS scrolls to the General band / first video (never opens curate). */
  onBrowse: () => void;
}) {
  const isEmpty = !hasCurated;
  const isMixed = hasCurated && suggestionCount > 0;
  // An uncurated topic whose candidate search has not settled: the suggestion numeral is not yet
  // trustworthy, so show the volume block as loading rather than asserting a count (AC1).
  const isEmptyLoading = isEmpty && candidatesLoading && suggestionCount === 0;

  return (
    <div className="plus-card overflow-hidden">
      {/* Header block — the Indigo identity (§6.1). */}
      <div className="flex items-baseline gap-2 border-b-2 border-hardbox bg-brand px-4 py-2.5 text-white">
        <span className="plus-disp text-lg leading-none font-bold">＋plus</span>
        <span className="plus-sans text-[11px] font-bold uppercase tracking-widest opacity-90">
          on this topic
        </span>
      </div>

      {storeError ? (
        // §6.5 read-failure floor: an honest line in place of the counts block. No numerals,
        // no buttons (a write surface is meaningless when reads are failing).
        <div className="px-4 pb-4 pt-3">
          <p className="plus-body text-[12px] leading-snug text-ink2">
            Couldn&apos;t load this topic&apos;s video stats. The article is unaffected.
          </p>
        </div>
      ) : (
        <>
          {/* Counts / volume block — the single state-variant region (§6.1–§6.3). */}
          <div className="px-4 pt-3">
            {isEmptyLoading ? (
              // Empty + candidates still loading (topic-loading-states §4 row 4): hold the volume
              // block in the projector-scan loading treatment rather than asserting "0 uncurated
              // videos". Two static neutral bars stand in for the numeral + label; the scan sweeps
              // across them. Announced via the candidate polite live region (TopicView), so the
              // skeleton itself needs no text (§5.2/§5.3).
              <div
                aria-busy="true"
                className="relative flex items-center gap-3 border-2 border-dashed border-[var(--color-emptyrule)] bg-surface-2 px-3 py-2.5"
              >
                <div className="skeleton-bar h-8 w-8" />
                <div className="skeleton-bar h-3.5 w-24" />
                <span className="projector-scan projector-scan-plus" aria-hidden="true" />
              </div>
            ) : isEmpty ? (
              // Empty: a dashed, light (bg2) panel — visually "provisional", matching the
              // unvetted candidate language. The word "uncurated" carries the unvetted
              // meaning in TEXT (§6.1 / §9), not the dashed border/fill alone.
              <div className="flex items-center gap-3 border-2 border-dashed border-[var(--color-emptyrule)] bg-surface-2 px-3 py-2.5">
                <p className="bignum text-3xl leading-none text-brand">
                  {suggestionCount}
                </p>
                <div className="leading-tight">
                  <p className="plus-sans text-[12px] font-bold text-ink-plus">
                    uncurated videos
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mixed + fully-curated: the three-numeral grid (§6.2 / §6.3). */}
                <div className="grid grid-cols-3 divide-x-2 divide-hardbox border-2 border-hardbox">
                  <Stat n={stats.videos} label="Videos" />
                  <Stat n={stats.creators} label="Creators" />
                  <Stat n={stats.curators} label="Curators" />
                </div>
                {/* Mixed only: the rescoped once-per-context two-count line. "suggested"
                    carries the unvetted meaning in TEXT (§6.2 / §9). Absent in
                    fully-curated (no suggestion count, no unvetted line — §6.3). */}
                {isMixed && (
                  <p className="plus-body mt-2 text-center text-[12px] text-ink2">
                    {stats.videos} curated ·{" "}
                    <span className="font-bold">{suggestionCount} suggested</span>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Primary action — scrolls to the relevant content. ALWAYS a scroll, never curate
              (§10). A real <button> performing a scripted scroll, with a clear accessible
              name (§9). */}
          <div className="px-4 pt-3 pb-4">
            <button
              type="button"
              onClick={onBrowse}
              aria-label={isEmpty ? "Browse suggested videos" : "Jump to videos"}
              className="block w-full border-2 border-hardbox bg-surface-raised px-3 py-2 text-center plus-sans text-[13px] font-bold text-ink-plus transition hover:bg-surface-2"
            >
              {isEmpty ? "Browse suggested videos ↓" : "Jump to videos ↓"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
