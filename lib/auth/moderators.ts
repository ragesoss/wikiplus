import "server-only";

import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { contributor } from "@/lib/db/schema";

// ── How a moderator is granted (issue #58 / D5b — Decision 2, out-of-band, NO admin UI). ──────────
// The minimal binary moderator/reviewer role (the shared prerequisite D5c reuses) is granted
// OUT-OF-BAND, two complementary ways — EITHER suffices, and this module OR-combines them so a
// grant by either mechanism takes effect:
//
//   (a) the DB flag — an owner/ops sets `contributor.is_moderator = true` on a row directly
//       (e.g. `psql -c "UPDATE contributor SET is_moderator = true WHERE handle = 'Name';"`), or
//   (b) the WIKIPLUS_MODERATORS env allowlist — a comma-separated list of Wikimedia usernames;
//       a contributor whose handle (case-insensitively) appears in it is a moderator. Cleaner for
//       staging (no manual psql; set the env + redeploy), and it self-heals if the DB column was
//       never set on an older row.
//
// The role-gate's AUTHORITY is ALWAYS SERVER-SIDE (Decision 2): the action resolves the acting
// contributor's role HERE, on the server, from the DB row and/or the env allowlist — it NEVER
// trusts a client-supplied "isModerator" flag and never a hidden button. The client session claim
// (resolved the same way in the JWT callback, lib/auth/config.ts) is the affordance layer ONLY.
//
// The feature ships GREEN with NO moderator existing: with no allowlist set and no DB flag, this
// resolves `false` for everyone (the safe default) and the role-gate rejects everyone — the
// MECHANISM is shipped + correct; granting a LIVE moderator is a separate owner/ops runbook step.

/**
 * The configured moderator-username allowlist (lowercased), parsed from `WIKIPLUS_MODERATORS`.
 * Read lazily per call (not module-load) so staging can change the env without a rebuild and the
 * tests can set/clear it per test. Empty/unset ⇒ an empty set (no env-granted moderators).
 */
function moderatorAllowlist(): Set<string> {
  const raw = process.env.WIKIPLUS_MODERATORS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter((u) => u.length > 0)
  );
}

/**
 * Is this Wikimedia username on the env allowlist? Client-independent, no DB hit — used both to
 * derive the session claim at login (lib/auth/config.ts) and as one arm of the server-side
 * role-gate. Case-insensitive (Wikimedia usernames are case-insensitive on the first letter; we
 * normalize the whole string for a forgiving allowlist match).
 */
export function isAllowlistedModerator(
  username: string | null | undefined
): boolean {
  if (!username) return false;
  return moderatorAllowlist().has(username.trim().toLowerCase());
}

/**
 * Resolve, SERVER-SIDE, whether the acting contributor is a moderator — the load-bearing
 * role-gate authority (AC4/AC5). True iff EITHER the DB column `contributor.is_moderator` is set
 * OR the contributor's handle is on the `WIKIPLUS_MODERATORS` allowlist. Loads the one
 * `contributor` row by id; an absent row resolves `false` (a stale/removed identity is never a
 * moderator). NEVER consults a client flag.
 */
export async function isModeratorContributor(
  db: Db,
  contributorId: number
): Promise<boolean> {
  const rows = await db
    .select({ isModerator: contributor.isModerator, handle: contributor.handle })
    .from(contributor)
    .where(eq(contributor.id, contributorId))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  return row.isModerator || isAllowlistedModerator(row.handle);
}
