// The single source of truth for the wiki+ context-note license + the canonical agreement
// strings (CURATION §5.3 / Decision C5; issue #52 / D1, AC6/AC7). Client-safe (no server-only
// import): `CurateFields` shows the strings; `lib/server/actions.ts` stamps the version on the
// captured agreement. Centralized so the version + the two verbatim strings are defined once.

/**
 * The note-license identifier/version stamped on a clip when its contributor agrees at publish
 * (Decision D1-1). A VERSION STRING, not a boolean, so a future license bump is expressible.
 */
export const NOTE_LICENSE = "CC-BY-SA-4.0";

/**
 * The always-visible license statement at the submit control (CURATION §5.3 canonical string —
 * used VERBATIM in the curate fields; do not paraphrase).
 */
export const NOTE_LICENSE_STATEMENT =
  "Your context note will be released under CC BY-SA 4.0.";

/**
 * The required agreement act — the checkbox label (CURATION §5.3 canonical string — VERBATIM).
 * Checking it is the per-submit affirmative consent that gates publish (AC6).
 */
export const NOTE_LICENSE_AGREEMENT =
  "I agree to release my context note under CC BY-SA 4.0.";
