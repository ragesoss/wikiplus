import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { account, contributor } from "@/lib/db/schema";

// ── Login → find-or-create identity mapping (issue C — AC2/AC3). ────────────────────────
// On a successful Wikimedia login, resolve the signed-in user to a durable wiki+ identity:
//   - an `account` row keyed by (provider='wikimedia', provider_account_id=<stable sub>),
//   - belonging to a `contributor` row carrying the Wikimedia username.
// A REPEAT login by the same Wikimedia user resolves to the SAME rows (AC3) — matched on the
// `account_provider_identity` unique (provider, provider_account_id). This is the only place
// a login writes to Postgres; everything else (the header, the gate) reads the JWT (AC4), so
// ordinary reads never hit this path.
//
// SERVER-ONLY: imported by the Auth.js JWT callback (server) and the contract tests (pglite).
// It is NEVER on the client-facing seam — the pg driver can't reach the bundle (mirrors #45).

export const WIKIMEDIA_PROVIDER = "wikimedia";

export interface WikimediaIdentity {
  /** Stable Wikimedia subject id (`profile.sub`) — the durable provider_account_id. */
  subject: string;
  /** Wikimedia username (`profile.username`) — the contributor's display identity. */
  username: string;
  /** Optional cached profile bits (granted later; nullable now — D5). */
  email?: string | null;
  avatarUrl?: string | null;
}

export interface ResolvedContributor {
  contributorId: number;
  /** The Wikimedia username the header shows (AC2). */
  handle: string;
}

/**
 * Find-or-create the `contributor` + `account` for a Wikimedia login (AC2/AC3).
 *
 * Idempotent on `(provider, provider_account_id)`: the first login inserts both rows; a repeat
 * login by the same Wikimedia subject finds the existing `account` and returns its contributor
 * — never a duplicate (AC3). The contributor handle is kept in sync with the current Wikimedia
 * username on each login (a Wikimedia rename is reflected) without creating a new identity.
 *
 * Concurrency: the `account_provider_identity` unique constraint is the source of truth. If two
 * logins for a never-seen subject race, the loser's insert hits the unique constraint; we then
 * re-read the winner's row, so both resolve to the same contributor.
 */
export async function findOrCreateContributor(
  identity: WikimediaIdentity,
  db: Db = getDb()
): Promise<ResolvedContributor> {
  const { subject, username } = identity;

  // 1. Existing account for this Wikimedia subject? (the repeat-login fast path — AC3)
  const existing = await db
    .select({
      contributorId: account.contributorId,
    })
    .from(account)
    .where(
      and(
        eq(account.provider, WIKIMEDIA_PROVIDER),
        eq(account.providerAccountId, subject)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Keep the contributor handle current with the Wikimedia username (rename-safe, no new row).
    await db
      .update(contributor)
      .set({ handle: username, displayName: username })
      .where(eq(contributor.id, existing[0].contributorId));
    return { contributorId: existing[0].contributorId, handle: username };
  }

  // 2. First login for this subject: create the contributor, then link the account.
  const contributorRows = await db
    .insert(contributor)
    .values({
      handle: username,
      displayName: username,
      avatarUrl: identity.avatarUrl ?? null,
    })
    // A handle collision (the same Wikimedia username already created earlier, or the seeded
    // stub somehow shares it) must not throw — fall through to a read below.
    .onConflictDoNothing({ target: contributor.handle })
    .returning({ id: contributor.id });

  let contributorId = contributorRows[0]?.id;
  if (contributorId === undefined) {
    const found = await db
      .select({ id: contributor.id })
      .from(contributor)
      .where(eq(contributor.handle, username))
      .limit(1);
    contributorId = found[0]?.id;
    if (contributorId === undefined) {
      throw new Error(
        `findOrCreateContributor: could not create or find contributor for ${username}`
      );
    }
  }

  // Link the account (idempotent on the provider identity — handles a login race, AC3).
  await db
    .insert(account)
    .values({
      contributorId,
      provider: WIKIMEDIA_PROVIDER,
      providerAccountId: subject,
      name: username,
      email: identity.email ?? null,
      avatarUrl: identity.avatarUrl ?? null,
    })
    .onConflictDoNothing({
      target: [account.provider, account.providerAccountId],
    });

  // If the account insert lost a race, the winner's account points at a (possibly different)
  // contributor — re-resolve so both logins agree (AC3).
  const linked = await db
    .select({ contributorId: account.contributorId })
    .from(account)
    .where(
      and(
        eq(account.provider, WIKIMEDIA_PROVIDER),
        eq(account.providerAccountId, subject)
      )
    )
    .limit(1);

  return {
    contributorId: linked[0]?.contributorId ?? contributorId,
    handle: username,
  };
}
