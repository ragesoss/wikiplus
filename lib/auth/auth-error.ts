// Client-safe detection of the boundary's auth-required rejection (issue C, design §2d/§4).
// The gated Server Actions throw `AuthRequiredError` (lib/auth/require-session.ts) when there
// is no session. This module is SAFE to import on the client (it imports no server-only code);
// it only inspects a caught error so the client can surface the expired-session gate rather
// than the generic failure notice.
//
// Caveat: Next.js redacts Server Action error MESSAGES in production builds (replacing them
// with a generic string + a digest), so a message match is only reliable in dev. The PRIMARY
// guard is the client-side gate (`useRequireLogin`), which means `runDismiss` is reached while
// signed-out only if the session expired between render and click — a rare edge. This helper
// is the best-effort secondary signal for that edge; when the message is redacted it simply
// falls through to the generic notice (still honest, never a false success).

/** Stable marker the boundary's AuthRequiredError carries in its message. */
export const AUTH_REQUIRED_MARKER = "AUTH_REQUIRED";

export function isAuthRequired(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const e = err as { name?: string; code?: string; message?: string };
    if (e.name === "AuthRequiredError" || e.code === AUTH_REQUIRED_MARKER) {
      return true;
    }
    if (typeof e.message === "string" && e.message.includes(AUTH_REQUIRED_MARKER)) {
      return true;
    }
  }
  return false;
}

// ── The per-identity write rate-limit signal (issue #57 / D5a, design §2/§4). ──────────────
// The boundary throws `RateLimitedError` (lib/auth/rate-limit.ts) when a signed-in contributor
// exceeds their per-identity write window. This detector MIRRORS `isAuthRequired` exactly: it is
// client-safe (imports no server-only code, only inspects a caught error), and matches on the
// distinct `name` / stable `code` marker — the SAME channel that survives Next.js's production
// Server-Action message redaction (a message-substring fallback covers dev). The three-arm catch
// at each gated-write call-site uses it to surface the calm "too fast" notice instead of the login
// gate (the user IS signed in) or the generic write error (nothing is broken) — AC3.

/** Stable marker the boundary's RateLimitedError carries in its `code` + message. */
export const RATE_LIMITED_MARKER = "RATE_LIMITED";

export function isRateLimited(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const e = err as { name?: string; code?: string; message?: string };
    if (e.name === "RateLimitedError" || e.code === RATE_LIMITED_MARKER) {
      return true;
    }
    if (typeof e.message === "string" && e.message.includes(RATE_LIMITED_MARKER)) {
      return true;
    }
  }
  return false;
}
