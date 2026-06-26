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
//
// ── "Marked complete" / closed to suggestions (design overview-card-cleanup.md, revising #159). ──
// On a complete topic the card grows ONE surface: the CURATOR CONTROL at the FOOT, SIGNED-IN ONLY —
// the "Mark topic complete" ⇄ "Reopen to suggestions" toggle. The affordance gate is `signedIn`; the
// SECURITY control is the role-gated Server Action (the host re-checks the curator server-side). The
// host (`TopicView`) owns `closedToSuggestions`/`marking` + the optimistic-with-rollback wiring; this
// component is presentational.
//
// The reader-facing completion SIGNAL and the per-viewer "show suggestions anyway" REVEAL do NOT live
// in this card — they are the trailing toggle item in the General strip's scroll row
// (`GeneralStrip`), where the videos they govern live. So the card carries no status notice, no
// override, and no add-a-video path (the strip's add is signed-in-only). At a complete + zero-curated
// topic the card has no counts to show; for a logged-out reader it then has no body at all and renders
// nothing (the strip's minimal band + the article carry that state — see the empty-body guard below).

export function Infobox({
  hasCurated,
  stats,
  suggestionCount,
  storeError = false,
  candidatesLoading = false,
  signedIn = false,
  closedToSuggestions = false,
  marking = false,
  onToggleComplete,
}: {
  /** ≥1 curated clip — selects the numeral grid vs. the empty volume panel. */
  hasCurated: boolean;
  stats: TopicStats;
  /** Remaining, deduped suggestions (`liveCandidates.length`) — `{M}` in mixed / the empty numeral. */
  suggestionCount: number;
  /** Store-read failure floor (§6.5): render the cap + an honest line, no counts/buttons. */
  storeError?: boolean;
  /** The live candidate search is still in flight (topic-loading-states §4 row 4). While it is —
   *  on an uncurated topic whose suggestion count has not settled — the empty volume block shows a
   *  projector-scan loading treatment instead of a (misleading) "0 uncurated videos" numeral. */
  candidatesLoading?: boolean;
  /**
   * Is the viewer signed in — the AFFORDANCE gate for the curator mark/un-mark control (the foot
   * row). Logged-out never sees a mutating control; the SECURITY control is the role-gated Server
   * Action. Default false so an anonymous render shows no control and the read-path render is
   * unchanged for a not-complete topic.
   */
  signedIn?: boolean;
  /** Is the topic marked complete (`closed_to_suggestions`). Drives the curator control's label
   *  (Mark complete ⇄ Reopen) and, with zero curated videos, the dialed-down card (no counts). */
  closedToSuggestions?: boolean;
  /** A mark/un-mark write is in flight → the foot button shows a busy word and is disabled to block
   *  a double-submit (the visual flip is optimistic, so the busy word is brief). */
  marking?: boolean;
  /** Activate the curator mark/un-mark toggle (host's optimistic-with-rollback). */
  onToggleComplete?: () => void;
}) {
  const isEmpty = !hasCurated;
  const isMixed = hasCurated && suggestionCount > 0;
  // An uncurated topic whose candidate search has not settled: the suggestion numeral is not yet
  // trustworthy, so show the volume block as loading rather than asserting a count (AC1).
  const isEmptyLoading = isEmpty && candidatesLoading && suggestionCount === 0;

  // On a COMPLETE topic with zero curated videos the card dials down — it omits the counts/volume
  // block (overview-card-cleanup §3.4): a "0 videos" grid or a dashed suggestion-volume block would
  // read as broken / would point at suppressed suggestions. On a complete topic WITH curated videos
  // the numeral grid stays (curated content is never suppressed).
  const completeZeroVideo = closedToSuggestions && isEmpty;

  // Empty-body guard (overview-card-cleanup §3.5): the card renders only when it has body content —
  // the store-error line, a counts block (present whenever NOT complete+zero-video), or the signed-in
  // curator mark/reopen control. At complete + zero-video with neither an error nor the curator
  // control (i.e. a logged-out reader), the body would be just the cap, so render nothing — the
  // strip's minimal band + the article carry that state.
  const hasBody = storeError || !completeZeroVideo || (signedIn && !!onToggleComplete);
  if (!hasBody) return null;

  return (
    <div className="plus-card overflow-hidden">
      {/* Header — a thin solid brand cap, no text (overview-card-cleanup §3.1). It marks the card as a
          plus-side element by color + the hardbox language; the brand WORDMARK's home is the universal
          projector header (VI §10.1), so the card needs no "＋plus" text. Decorative → aria-hidden. */}
      <div className="h-2.5 border-b-2 border-hardbox bg-brand" aria-hidden />

      {storeError ? (
        // §6.5 read-failure floor: an honest line in place of the counts block. No numerals,
        // no buttons (a write surface is meaningless when reads are failing). On a read failure the
        // curator mark/reopen control is also absent (the flag lives on `topic`, and a write surface
        // is meaningless when reads fail): a read failure is not a complete-topic state.
        <div className="px-4 pb-4 pt-3">
          <p className="plus-body text-[12px] leading-snug text-ink2">
            Couldn&apos;t load this topic&apos;s video stats. The article is unaffected.
          </p>
        </div>
      ) : (
        <>
          {/* Counts / volume block — the single state-variant region. OMITTED on a complete +
              zero-video topic (overview-card-cleanup §3.4): no honest numeral exists and a dashed
              suggestion-volume / "0 videos" grid would mislead. Curated counts still show on a
              complete topic with curated videos (curated content is never suppressed). */}
          {!completeZeroVideo && (
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
                      fully-curated (no suggestion count, no unvetted line — §6.3). Also absent on
                      a COMPLETE mixed topic: the suggestion volume is suppressed (issue #159 / AC10),
                      so `suggestionCount` is fed as 0 → `isMixed` false → no line. */}
                  {isMixed && (
                    <p className="plus-body mt-2 text-center text-[12px] text-ink2">
                      {stats.videos} curated ·{" "}
                      <span className="font-bold">{suggestionCount} suggested</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* The CURATOR mark/un-mark control — the card FOOT row, SIGNED-IN ONLY (the affordance
              gate; the role-gated Server Action is the security control). A quiet, deliberate
              plus-side action: a secondary raised/white toggle. The WORD states what tapping does (no
              `aria-pressed`/`role=switch` — a labeled action button is the clearer model).
              Optimistic-with-rollback lives in the host; here it shows the busy word + disabled while
              `marking`. The helper line sits under the not-complete button; when already complete the
              line is omitted (the strip's trailing toggle carries the reader-facing explanation). */}
          {signedIn && onToggleComplete && (
            <div className="border-t-2 border-hardbox px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={onToggleComplete}
                disabled={marking}
                aria-label={
                  closedToSuggestions
                    ? "Reopen this topic to suggestions — un-mark complete"
                    : "Mark this topic complete — close it to suggestions"
                }
                className="block w-full border-2 border-hardbox bg-surface-raised px-3 py-2 text-center plus-sans text-[13px] font-bold text-ink-plus transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-60"
              >
                {marking ? (
                  closedToSuggestions ? (
                    "Reopening…"
                  ) : (
                    "Marking…"
                  )
                ) : closedToSuggestions ? (
                  "Reopen to suggestions"
                ) : (
                  <>
                    <span aria-hidden>✓</span> Mark topic complete
                  </>
                )}
              </button>
              {!closedToSuggestions && (
                <p className="plus-body mt-1.5 text-[12px] leading-snug text-ink2">
                  Stops showing unvetted suggestions to readers. Any curator can reopen it.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
