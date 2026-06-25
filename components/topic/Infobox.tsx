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
// ── "Marked complete" / closed to suggestions (issue #159; design topic-complete.md). ────────
// When a curator marks the topic complete (`closedToSuggestions`), the panel grows two surfaces:
//   - The STATUS INDICATOR (§3) at the TOP of the panel body, shown to EVERY viewer: a calm
//     notice block stating a curator marked the topic complete (so suggestions are hidden),
//     carrying the two opt-in paths — (a) the per-viewer "Show suggestions anyway" override
//     (any viewer, incl. logged-out) and (b) add a video / curate (login-gated for logged-out).
//   - The CURATOR CONTROL (§2) at the FOOT of the panel, SIGNED-IN ONLY: the "Mark topic
//     complete" ⇄ "Reopen to suggestions" toggle. The affordance gate here is `signedIn`; the
//     SECURITY control is the role-gated Server Action (host re-checks the curator server-side).
// The host (`TopicView`) owns the booleans + the optimistic-with-rollback wiring; this component
// is presentational. The override is the indicator's path (a) — never elsewhere; the two are
// kept distinct (state at the top, action at the foot). When the topic has NO underlying
// suggestion to reveal (`hasUnderlyingSuggestions === false`), path (a) is omitted (§4.4 — the
// toggle never promises a reveal it can't deliver).

export function Infobox({
  hasCurated,
  stats,
  suggestionCount,
  storeError = false,
  candidatesLoading = false,
  onBrowse,
  signedIn = false,
  closedToSuggestions = false,
  marking = false,
  onToggleComplete,
  hasUnderlyingSuggestions = false,
  overridden = false,
  onToggleOverride,
  onAdd,
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
  /**
   * Issue #159 (design §2.1): is the viewer signed in — the AFFORDANCE gate for the curator
   * mark/un-mark control (the foot row). Logged-out never sees a mutating control (AC4); the
   * SECURITY control is the role-gated Server Action. Default false so an anonymous render shows
   * no control and the read-path render is unchanged for a not-complete topic.
   */
  signedIn?: boolean;
  /** Issue #159: is the topic marked complete (`closed_to_suggestions`). Drives the indicator's
   *  presence (every viewer) + the curator control's label (Mark complete ⇄ Reopen). */
  closedToSuggestions?: boolean;
  /** Issue #159 (§2.3): a mark/un-mark write is in flight → the foot button shows a busy word and
   *  is disabled to block a double-submit (the visual flip is optimistic, so the busy word is brief). */
  marking?: boolean;
  /** Issue #159: activate the curator mark/un-mark toggle (host's optimistic-with-rollback). */
  onToggleComplete?: () => void;
  /**
   * Issue #159 (§4.4): does the topic have ≥1 underlying suggestion (computed as if the flag were
   * off, regardless of suppression)? Gates the indicator's override path (a): when there is nothing
   * to reveal, the "Show suggestions anyway" toggle is omitted (only the add/curate path shows).
   */
  hasUnderlyingSuggestions?: boolean;
  /** Issue #159 (§4): has THIS viewer overridden the suppression for this session (suggestions
   *  showing for them). Drives the override toggle's label/treatment. Session-local, per-topic. */
  overridden?: boolean;
  /** Issue #159 (§4): toggle the per-viewer "show suggestions anyway" override (host's client-only,
   *  session-local, per-topic reveal — instant in-place, never a DB write). */
  onToggleOverride?: () => void;
  /** Issue #159 (§3.3 path b): add a video / curate — the existing gated Add flow (`openAdd`),
   *  login-gated for logged-out via the host's `requireLogin` seam. */
  onAdd?: () => void;
}) {
  const isEmpty = !hasCurated;
  const isMixed = hasCurated && suggestionCount > 0;
  // An uncurated topic whose candidate search has not settled: the suggestion numeral is not yet
  // trustworthy, so show the volume block as loading rather than asserting a count (AC1).
  const isEmptyLoading = isEmpty && candidatesLoading && suggestionCount === 0;

  // Issue #159 (design §6.2): on a COMPLETE topic with zero curated videos, the panel dials down —
  // it omits the counts/volume block AND the Browse action (there is nothing to scroll to; the
  // panel's substance is the indicator + its two paths). A "0 videos" grid or a dashed suggestion-
  // volume block would read as broken / would point at suppressed suggestions (AC10/AC18). On a
  // complete topic WITH curated videos the numeral grid stays (curated content is never suppressed).
  const completeZeroVideo = closedToSuggestions && isEmpty;

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
        // no buttons (a write surface is meaningless when reads are failing). On a read failure the
        // complete-topic indicator + curator control are also absent (design §7.1 — the flag lives
        // on `topic`, and a write surface is meaningless when reads fail): a read failure is not a
        // complete-topic state.
        <div className="px-4 pb-4 pt-3">
          <p className="plus-body text-[12px] leading-snug text-ink2">
            Couldn&apos;t load this topic&apos;s video stats. The article is unaffected.
          </p>
        </div>
      ) : (
        <>
          {/* Issue #159 (§3): the STATUS INDICATOR — top of the panel body, above the counts, for
              EVERY viewer of a complete topic. A calm informational notice (NOT the indigo header
              block, NOT a red/warning treatment): a thin brand left rule on bg2, ink-on-light. The
              WORD carries the meaning; the rule/glyph are reinforcement (§7.2 — never color alone). */}
          {closedToSuggestions && (
            <div className="px-4 pt-3">
              <div className="border-l-4 border-brand bg-surface-2 px-3 py-2.5">
                <p className="plus-sans text-[12px] font-bold uppercase tracking-wide text-ink-plus">
                  <span aria-hidden>✓</span> Marked complete
                </p>
                <p className="plus-body mt-1 text-[13px] leading-snug text-ink-plus">
                  A curator marked this topic complete, so suggestions are hidden. This is
                  one curator&apos;s judgment — not a guarantee that nothing&apos;s missing.
                </p>
                {/* The two opt-in paths (§3.3), as a small wrapping row. Path (a) — the override —
                    is the primary, leftmost path (any viewer, no account), shown only when there is
                    something to reveal (§4.4). Path (b) — add/curate — is the quieter secondary,
                    login-gated for logged-out via the host's `requireLogin`. Both keep ≥44px. */}
                <div className="mt-2 flex flex-wrap items-stretch gap-2">
                  {hasUnderlyingSuggestions && onToggleOverride && (
                    <button
                      type="button"
                      onClick={onToggleOverride}
                      aria-label={
                        overridden
                          ? "Hide suggestions again — return to the complete view"
                          : "Show suggestions for this topic in this session"
                      }
                      className={
                        overridden
                          ? "inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                          : "inline-flex min-h-[44px] items-center border-2 border-hardbox bg-brand px-2.5 py-1 text-[12px] font-bold text-white hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                      }
                    >
                      {overridden ? "Hide suggestions again" : "Show suggestions anyway"}
                    </button>
                  )}
                  {onAdd && (
                    <button
                      type="button"
                      onClick={onAdd}
                      aria-haspopup="dialog"
                      className="inline-flex min-h-[44px] items-center border-2 border-hardbox bg-surface-raised px-2.5 py-1 text-[12px] font-bold text-ink-plus hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]"
                    >
                      ＋ Add a video
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Counts / volume block — the single state-variant region (§6.1–§6.3). OMITTED on a
              complete + zero-video topic (design §6.2 / AC10 / AC18): no honest numeral exists and
              a dashed suggestion-volume / "0 videos" grid would mislead. Curated counts still show
              on a complete topic with curated videos (AC11 — curated content is never suppressed). */}
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

          {/* Primary action — scrolls to the relevant content. ALWAYS a scroll, never curate
              (§10). A real <button> performing a scripted scroll, with a clear accessible
              name (§9). OMITTED on a complete + zero-video topic (design §6.2): there is nothing
              to scroll to; the panel's action at that state is the indicator's override / add paths. */}
          {!completeZeroVideo && (
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
          )}

          {/* Issue #159 (§2): the CURATOR mark/un-mark control — the panel FOOT row, SIGNED-IN ONLY
              (the affordance gate; the role-gated Server Action is the security control). A quiet,
              deliberate plus-side action: a secondary raised/white toggle (not the brand-fill
              curation invite). The WORD states what tapping does (no `aria-pressed`/`role=switch` —
              a labeled action button is the clearer model). Optimistic-with-rollback lives in the
              host; here it shows the busy word + disabled while `marking`. The helper line sits
              under the not-complete button (omitted when already complete — the indicator carries
              the explanation). */}
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
