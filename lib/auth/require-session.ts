import "server-only";

import { auth } from "./config";
import { AUTH_REQUIRED_MARKER } from "./auth-error";

// ── The server-side write gate (issue C — AC7/AC8, Decision D1). ──────────────────────────
// The auth check that stands between an anonymous request and a write lives HERE, at the
// Server Actions boundary — NOT only behind a hidden UI button. A direct boundary invocation
// with no valid session is rejected before any DB write (the #45 fix round flagged the open
// boundary; this closes it). Reads stay anonymous: nothing on the cached read path calls this.

/** The error a gated write raises when there is no authenticated session. */
export class AuthRequiredError extends Error {
  readonly code = AUTH_REQUIRED_MARKER;
  constructor(message = `${AUTH_REQUIRED_MARKER}: you must be logged in to do that.`) {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export interface SignedInContributor {
  contributorId: number;
  /** The Wikimedia username — written to `clip.curatedBy` so the vouch shows a real name. */
  username: string;
}

/**
 * Resolve the signed-in contributor from the JWT session, or throw `AuthRequiredError`.
 * Reads the JWT (AC4 — no per-read DB hit); the find-or-create already ran at login, so the
 * `contributorId` is carried on the token. A session with no resolved contributor (a malformed
 * or expired token) is treated as unauthenticated.
 */
export async function requireContributor(): Promise<SignedInContributor> {
  const session = await auth();
  const contributorId = session?.user?.contributorId;
  const username = session?.user?.username;
  if (!session || typeof contributorId !== "number" || !username) {
    throw new AuthRequiredError();
  }
  return { contributorId, username };
}
