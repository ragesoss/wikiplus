"use client";

// The held "in review" third-state marking (issue #58 / D5b — design §3, CURATION §7.1 / Decision
// C8). A held clip is a REAL curated clip whose vouch is not yet reviewer-confirmed: it KEEPS its
// note, chips, and curator attribution, and ADDS this calm, text-labeled marking. It must read as
// "in review," NEVER "removed / bad / flagged" (the §7.1 tone guard), and must be DISTINCT from
//   - a fully-curated clip (which has NO marking), and
//   - a §6 candidate (dashed `candcard` + violet "Suggested · uncurated" — `CandidateBits`):
//     this marking is SOLID ink, never dashed-violet, never red, never gold.
// All strings are the VERBATIM §7.1 microcopy, centralized here so the rail card + the General tile
// share one source (the curator-attribution module pattern).

/** Eyebrow / badge text (VERBATIM — CURATION §7.1 / Decision C8). The word carries the meaning. */
export const HELD_EYEBROW = "In review · not yet vouched";

/** One-line explainer shown where space allows — the rail card (VERBATIM — §7.1). */
export const HELD_EXPLAINER =
  "A curator added this and wrote a note, but it hasn't passed review yet — weigh it accordingly.";

/** Accessible name for the marking (VERBATIM — §7.1) — `sr-only` lead / `aria-label`. */
export const HELD_ACCESSIBLE_NAME =
  "In review — not yet vouched for by a reviewer.";

/**
 * The full held-marking block for the rail `ClipCard` (design §3.2): a SOLID 2px ink left-rule
 * status strip on the calm `bg2` fill — the curator-note's solid-left-border language, NOT the
 * candidate's dashed left border — with the verbatim eyebrow + the verbatim explainer (the rail
 * has the room). A decorative `aria-hidden` dot reinforces but never carries the signal; an
 * `sr-only` lead voices the verbatim accessible name before the chips/note. Placed ABOVE the chips
 * row so it reads as a status banner for the whole vouch.
 */
export function HeldMarking() {
  return (
    <div className="mt-2 border-l-[3px] border-hardbox bg-surface-2 py-1.5 pl-3 pr-2">
      <span className="sr-only">{HELD_ACCESSIBLE_NAME}</span>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-plus">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink2" />
        {HELD_EYEBROW}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink2">{HELD_EXPLAINER}</p>
    </div>
  );
}

/**
 * The compact held marking for the indigo `GeneralStrip` tile (design §3.3): eyebrow ONLY (the
 * explainer is omitted for space), on a WHITE-FILL pill (`bg-surface-raised` + 2px ink border, ink text) so
 * it clears AA on the indigo band — never ink-on-indigo, and never the empty-band "uncurated"
 * white-outline pill (that is the §6 candidate word). Carries the verbatim accessible name via an
 * `sr-only` lead even though the explainer is omitted.
 */
export function HeldPill() {
  return (
    <span className="inline-flex items-center border-2 border-hardbox bg-surface-raised px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-plus">
      <span className="sr-only">{HELD_ACCESSIBLE_NAME}</span>
      <span aria-hidden>{HELD_EYEBROW}</span>
    </span>
  );
}
