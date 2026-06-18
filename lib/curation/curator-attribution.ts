// Public curator attribution — the canonical, client-safe strings + stub detection (issue #54 /
// D3). CURATION §5.4 / Decision C7 (commit a2c2892) blesses the "context by <curator>" public
// attribution; this module centralizes its VERBATIM strings and the `@prototype`-stub test so the
// shared `ContextByLink` element (the `ClipCard` footer + the curated `GeneralStrip` tile) defines
// them ONCE. It is plain data (no `server-only`), so the client component imports it freely.
//
// The distinctness rule (load-bearing — CURATION §5.4): the §5.2 CREATOR credit links OUT to the
// platform (the video's maker); the §5.4 CURATOR attribution links IN to `/contributor/<username>`
// (the note's author). Direction is the editorial tell — never merge them, never share a link.

/**
 * The seeded stub-contributor handle (issue C Decision D6 / D2 Decision 5): pre-C clips attribute
 * to this placeholder identity, NOT a real person. It is the single source of truth for the handle
 * — `lib/db/drizzle-store.ts` (the live-lookup + write attribution) and `lib/db/seed.ts` (the seed)
 * both import it, and the client uses it to suppress the profile link (Decision 4 / AC4 / AC6).
 */
export const STUB_HANDLE = "@prototype";

/**
 * Is this clip's curator the seeded stub (or absent) rather than a real, browsable curator? A
 * `@prototype` clip — or any clip with no real `curatedBy` — gets the NON-linked legacy label,
 * never a profile link (Decision 4 / AC6). Used by `ContextByLink` to pick its branch.
 */
export function isStubCurator(curatedBy: string | undefined | null): boolean {
  return !curatedBy || curatedBy === STUB_HANDLE;
}

/** The fixed "context by " label prefix that always precedes the linked username (CURATION §5.4). */
export const CONTEXT_BY_PREFIX = "context by ";

/**
 * The accessible name for the curator attribution link (VERBATIM — CURATION §5.4): the visible text
 * carries "context by <username>"; the aria-label adds "view their curations" so a screen-reader
 * user knows the link's destination (the curator's profile).
 */
export function contextByAccessibleName(username: string): string {
  return `${CONTEXT_BY_PREFIX}${username}, view their curations`;
}

/**
 * The legacy stub provenance label (VERBATIM — CURATION §5.4): a NON-linked span shown in place of
 * the linked attribution on a `@prototype` (or no-curator) clip — honest about provenance (seeded,
 * not vouched for by a person) with no dead/implying link.
 */
export const SEED_CLIP_LABEL = "seed clip · no curator";
