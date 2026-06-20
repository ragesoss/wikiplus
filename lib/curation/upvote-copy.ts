// ── Upvote control microcopy (issue #55 / D4, design §6.1 / §6.4 — VERBATIM). ──────────────
// The single source of the exact strings the upvote toggle uses, so its per-state accessible
// names + the "Voted" cue + the write-failed notice can't drift from the design contract. The
// expired-session string is reused unchanged from D1 (`AUTH_COPY.errors.expiredSession`, §6.3).
//
// The voted state is text-carried, NEVER color-alone (CURATION §4 / design §9): the control
// carries `aria-pressed` + a visible "Voted" word + a filled-vs-outline glyph SHAPE; the
// accessible name (below) carries the full meaning to assistive tech, pluralized honestly. A
// logged-out reader sees no control — only the read-only count figure (`readonlyUpvoteCount`,
// #71 §4); there is no logged-out gate-trigger label.

import { pluralize } from "@/lib/format";

/** The visible "Voted" cue word (shown only in the voted state — design §4.2 / §5.2). */
export const VOTED_LABEL = "Voted";

/** The non-blocking, polite write-failed notice (design §6.4 — verbatim). */
export const UPVOTE_ERROR_NOTICE =
  "Couldn't record your upvote — please try again.";

/** "N upvotes" / "1 upvote" — the count noun, pluralized honestly (design §6.1 / §9). */
function upvotesNoun(count: number): string {
  return pluralize(count, "upvote");
}

/**
 * The logged-out READ-ONLY count label string (#71 design §4.2/§4.3 — "12 upvotes" / "1 upvote").
 * The logged-out reader sees the count as static social proof, never a control; this wraps the same
 * `upvotesNoun` the toggle uses so the static-label noun can't drift from the control's. Count 0 is
 * the caller's concern (it renders nothing — §4.1); this only formats a positive count.
 */
export function readonlyUpvoteCount(count: number): string {
  return upvotesNoun(count);
}

/**
 * The signed-in control's accessible name per state (design §6.1 — verbatim). The visible text is
 * the count (+ the "Voted" word); this label carries the full meaning to AT. (The logged-out reader
 * gets no control — only the static `readonlyUpvoteCount` figure, #71 §4.)
 *   - not voted (3a):  "Upvote this clip — <N> upvotes"            · aria-pressed="false"
 *   - voted     (3b):  "You upvoted this clip — <N> upvotes. Activate to remove your upvote."
 *                                                                  · aria-pressed="true"
 */
export function upvoteAccessibleName(
  state: "not-voted" | "voted",
  count: number
): string {
  const noun = upvotesNoun(count);
  switch (state) {
    case "voted":
      return `You upvoted this clip — ${noun}. Activate to remove your upvote.`;
    case "not-voted":
    default:
      return `Upvote this clip — ${noun}`;
  }
}
