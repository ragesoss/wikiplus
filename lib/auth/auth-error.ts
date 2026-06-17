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
