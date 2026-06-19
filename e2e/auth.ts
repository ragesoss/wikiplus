import { readFileSync } from "node:fs";
import { encode } from "@auth/core/jwt";
import type { Page } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_SESSION_COOKIE, E2E_USER_FILE } from "./db-server";

// Test sign-in helper (issue #47). As of issue C the contribute entry points (Add / Curate /
// Dismiss) are AUTH-GATED: a logged-out click opens the LoginPromptDialog instead of the real
// modal / a real dismiss (useRequireLogin + lib/auth/config.ts). So the AC18/AC19 tests, which
// assert the REAL Add modal, the REAL Curate modal, and a REAL dismiss-decrement, must run
// SIGNED IN — otherwise they would only ever see the login gate.
//
// We establish that precondition WITHOUT real Wikimedia OAuth (out of scope; offline sandbox) by
// minting the exact session cookie the running server already trusts: Auth.js v5 JWT sessions are
// a JWE signed with AUTH_SECRET, salted by the cookie name. `@auth/core/jwt`'s own `encode` (the
// app's dependency) produces it, so this couples to the project's installed Auth.js, not a guessed
// format. The token's `contributorId` points at the real e2e contributor row seeded in
// e2e/db-server.ts (the write boundary attributes to it). This is a test PRECONDITION, not net-new
// auth coverage — it exercises no OAuth flow.

interface E2EUser {
  contributorId: number;
  handle: string;
}

function readUser(): E2EUser {
  // Written by startE2EDatabase() (globalSetup) after the seed.
  return JSON.parse(readFileSync(E2E_USER_FILE, "utf8")) as E2EUser;
}

/**
 * Mint a valid Auth.js session JWT for the seeded e2e contributor. 30-day expiry (Auth.js's
 * default) keeps it valid for the whole run.
 */
async function mintSessionToken(): Promise<string> {
  const { contributorId, handle } = readUser();
  return encode({
    salt: E2E_SESSION_COOKIE,
    secret: E2E_AUTH_SECRET,
    token: {
      // The fields lib/auth/config.ts's `session` callback reads off the JWT (contributorId /
      // username / isModerator), plus a stable subject + display name.
      name: handle,
      sub: `e2e:${contributorId}`,
      contributorId,
      username: handle,
      isModerator: false,
    },
  });
}

/**
 * Sign the page's browser context in as the seeded e2e contributor by setting the session cookie
 * on the test origin. Call once per test (e.g. in a `beforeEach`) BEFORE `page.goto`. After this,
 * `useSession()` resolves to "authenticated" and the gated contribute actions run for real.
 */
export async function signIn(page: Page, baseURL?: string): Promise<void> {
  const token = await mintSessionToken();
  const origin = new URL(baseURL ?? "http://localhost:4321");
  await page.context().addCookies([
    {
      name: E2E_SESSION_COOKIE,
      value: token,
      domain: origin.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
