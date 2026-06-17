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
 * The trust anchor is the ACCOUNT IDENTITY — `(provider, provider_account_id=<stable Wikimedia
 * subject>)` — NOT the mutable, reusable Wikimedia username (per spec / ARCHITECTURE). Find-or-
 * create is keyed entirely on that anchor:
 *
 *   - A repeat login by the same subject finds the existing `account` and returns its
 *     contributor — never a duplicate (AC3) — and refreshes the contributor's handle/displayName
 *     to the current Wikimedia username (a rename is reflected without a new identity).
 *   - A first login for a never-seen subject inserts a FRESH contributor and links a new account.
 *     We never look up or reuse a contributor by handle: `contributor.handle` is a non-unique
 *     display column, so two DISTINCT subjects that present the SAME username string get TWO
 *     distinct contributors (they must never co-mingle — the username is not an identity key).
 *
 * Because the handle is non-unique, the rename refresh can never collide: a known subject who
 * renames into a username already held by another contributor resolves normally (the handle is
 * display, the account is identity) instead of throwing inside the JWT callback.
 *
 * Concurrency: the `account_provider_identity` unique (provider, provider_account_id) is the
 * source of truth. If two first logins for the same never-seen subject race, the loser's account
 * insert no-ops on that constraint; we re-read the winner's account and both resolve to the same
 * contributor (AC3). The loser's freshly-inserted contributor is left unlinked — harmless: no FK
 * depends on it and it is never returned.
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
    // Refresh the display handle to the current Wikimedia username. Collision-safe: `handle` is
    // non-unique, so a rename into another contributor's handle no longer violates a constraint.
    await db
      .update(contributor)
      .set({ handle: username, displayName: username })
      .where(eq(contributor.id, existing[0].contributorId));
    return { contributorId: existing[0].contributorId, handle: username };
  }

  // 2. First login for THIS subject: always create a fresh contributor — never reuse one by
  //    handle. The account identity (not the username) is what links a login to a contributor,
  //    so distinct subjects sharing a username stay distinct.
  const contributorRows = await db
    .insert(contributor)
    .values({
      handle: username,
      displayName: username,
      avatarUrl: identity.avatarUrl ?? null,
    })
    .returning({ id: contributor.id });
  const contributorId = contributorRows[0].id;

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
  // contributor — re-resolve so both logins agree (AC3). Our own contributor is the common case.
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
