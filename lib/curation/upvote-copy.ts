// ── Upvote control microcopy (issue #55 / D4, design §6.1 / §6.4 — VERBATIM). ──────────────
// The single source of the exact strings the upvote toggle uses, so its per-state accessible
// names + the "Voted" cue + the write-failed notice can't drift from the design contract. The
// LOGIN GATE copy lives in `lib/auth/microcopy.ts` (`AUTH_COPY.gates.upvote`, §6.2); the
// expired-session string is reused unchanged from D1 (`AUTH_COPY.errors.expiredSession`, §6.3).
//
// The voted state is text-carried, NEVER color-alone (CURATION §4 / design §9): the control
// carries `aria-pressed` + a visible "Voted" word + a filled-vs-outline glyph SHAPE; the
// accessible name (below) carries the full meaning to assistive tech, pluralized honestly.

import { pluralize } from "@/lib/format";

/** The visible "Voted" cue word (shown only in the voted state — design §4.2 / §5.2). */
export const VOTED_LABEL = "Voted";

/** The logged-out actionable label (the count stays visible; this is the gate trigger — §4.3). */
export const LOGIN_TO_UPVOTE_LABEL = "Log in to upvote";

/** The non-blocking, polite write-failed notice (design §6.4 — verbatim). */
export const UPVOTE_ERROR_NOTICE =
  "Couldn't record your upvote — please try again.";

/** "N upvotes" / "1 upvote" — the count noun, pluralized honestly (design §6.1 / §9). */
function upvotesNoun(count: number): string {
  return pluralize(count, "upvote");
}

/**
 * The control's accessible name per state (design §6.1 — verbatim). The visible text is the count
 * (+ the "Voted" / "Log in to upvote" words); this label carries the full meaning to AT.
 *   - not voted (3a):  "Upvote this clip — <N> upvotes"            · aria-pressed="false"
 *   - voted     (3b):  "You upvoted this clip — <N> upvotes. Activate to remove your upvote."
 *                                                                  · aria-pressed="true"
 *   - logged out(3d):  "Log in to upvote this clip — <N> upvotes"  · no aria-pressed (gate trigger)
 */
export function upvoteAccessibleName(
  state: "not-voted" | "voted" | "logged-out",
  count: number
): string {
  const noun = upvotesNoun(count);
  switch (state) {
    case "voted":
      return `You upvoted this clip — ${noun}. Activate to remove your upvote.`;
    case "logged-out":
      return `Log in to upvote this clip — ${noun}`;
    case "not-voted":
    default:
      return `Upvote this clip — ${noun}`;
  }
}
