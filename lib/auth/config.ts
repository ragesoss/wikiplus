import NextAuth, {
  customFetch,
  type DefaultSession,
  type NextAuthConfig,
} from "next-auth";
import Wikimedia, { type WikimediaProfile } from "next-auth/providers/wikimedia";
import { findOrCreateContributor, getSkinPreference } from "./contributor";
import { isModeratorContributor } from "./moderators";
import { getDb } from "@/lib/db/client";

// ── Auth.js (NextAuth v5) — Wikimedia OAuth 2.0, JWT sessions (issue C). ──────────────────
// Spec: docs/specs/wikimedia-oauth.md (AC1–AC14); ARCHITECTURE "Authentication & identity".
//
// CHOICES (recorded in ARCHITECTURE):
//   - Auth.js v5 (next-auth@5 beta) — App-Router-native (`handlers`/`auth`/`signIn`/`signOut`
//     from one config), first-class multi-provider OAuth so Google is additive later (D2).
//   - The BUILT-IN Wikimedia provider (`next-auth/providers/wikimedia`), with its three
//     endpoints OVERRIDDEN (below) so the user authorizes at en.wikipedia.org — a consent
//     screen Wikipedia editors recognize — using the DEFAULT identify-only scope (D5: stable
//     `sub` + username; no edit/act-on-behalf grant). We pass the consumer creds explicitly
//     from env (below).
//   - JWT session strategy (NO database adapter, NO server-side session store) — AC4/D3: an
//     ordinary read resolves the header from the signed JWT cookie with no per-read DB hit,
//     and C needs no Redis/session table. The ONLY DB write a login makes is the find-or-create
//     identity mapping, run once in the `jwt` callback on sign-in.

// Augment the session/JWT with the resolved wiki+ identity (the durable contributor row).
declare module "next-auth" {
  interface Session {
    user: {
      /** wiki+ contributor.id — the durable identity the write boundary attributes to. */
      contributorId?: number;
      /** Wikimedia username the header shows (AC2). */
      username?: string;
      /**
       * D5b (issue #58): is this signed-in viewer a moderator/reviewer? Resolved SERVER-SIDE in
       * the `jwt` callback (the DB `contributor.is_moderator` column OR the `WIKIPLUS_MODERATORS`
       * allowlist — lib/auth/moderators.ts), carried on the JWT, and exposed read-only here so the
       * Topic page can decide which clips show the reviewer Hold/Approve affordances. This is the
       * AFFORDANCE predicate ONLY (the D2/D4 off-read-path pattern); the SECURITY control is the
       * server-side role-gate inside `holdClipAction`/`reviewClipAction`, which re-resolves the
       * role and never trusts this claim. Default false (logged-out + every non-moderator).
       */
      isModerator?: boolean;
      /**
       * Issue #143: the contributor's stored skin preference (`'zine'` | `'zine-dark'`, or
       * undefined for none). Resolved SERVER-SIDE once at sign-in (the `jwt` callback's one DB pass),
       * carried on the JWT, exposed read-only here so a thin post-login client step can MIRROR it into
       * the `wikiplus-skin` cookie (DB→cookie — spec §6.1), making the next paint correct cross-device.
       * It is NEVER read on the render path; ordinary reads stay JWT-only (no per-read DB hit).
       */
      skinPreference?: string;
    } & DefaultSession["user"];
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    contributorId?: number;
    username?: string;
    isModerator?: boolean;
    skinPreference?: string;
  }
}

// Wikimedia etiquette (D5 / ARCHITECTURE): a DESCRIPTIVE User-Agent on every server-side call
// to the Wikimedia OAuth identity endpoints (token + userinfo). `customFetch` is Auth.js's
// documented hook to wrap the provider's fetch; we only add the header, then defer to fetch.
const WIKI_PLUS_UA =
  "wiki-plus/0.1 (https://wikiplus.wikiedu.org; sage@wikiedu.org) Auth.js";

function wikimediaFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", WIKI_PLUS_UA);
  return fetch(input, { ...init, headers });
}

// The consumer key/secret are in env under the OWNER-CONFIRMED names (lowercase) —
// `wikimedia_oauth_client_key` / `wikimedia_oauth_client_secret` (.env, gitignored). We read
// them explicitly (NOT the AUTH_WIKIMEDIA_ID/SECRET names Auth.js would auto-detect) so the
// already-registered consumer is used as-is. `AUTH_SECRET` (JWT signing) is auto-read by
// Auth.js from env. None of these reach the client bundle (AC12) — this module is server-only
// (imported by the route handler + server actions + the auth() helper).
const clientId = process.env.wikimedia_oauth_client_key;
const clientSecret = process.env.wikimedia_oauth_client_secret;

export const authConfig: NextAuthConfig = {
  // Trust the host header behind Caddy/Cloudflare (the app runs behind a reverse proxy on the
  // VPS; Auth.js otherwise refuses an untrusted host). The session cookie is `Secure` in
  // production automatically (HTTPS host) — Ops verifies the TLS path (spec Dependencies).
  trustHost: true,
  // Stateless JWT session cookie (AC4/D3): ordinary reads need no session/account DB lookup.
  // `maxAge` (7 days) bounds the lifetime of the at-sign-in claims below — notably the
  // affordance-only `isModerator` stamp — so a stale claim cannot outlive a re-login by more
  // than a week (issue #79). The write boundary still re-resolves the role server-side, so this
  // window only affects which UI affordances show, never authorization.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [
    Wikimedia({
      clientId,
      clientSecret,
      // Override the built-in provider's three endpoints (which default to meta.wikimedia.org)
      // to authorize at en.wikipedia.org. The consumer is registered ONCE at meta
      // (Special:OAuthConsumerRegistration lives only there), but CentralAuth/SUL recognizes it
      // on every Wikimedia wiki — so authorizing at en.wikipedia.org shows Wikipedia editors a
      // recognizable consent screen while the global `sub` identity is unchanged (no identity
      // fragmentation, no re-registration). The trailing `?scope=` is preserved to keep the
      // DEFAULT identify-only scope (D5 — no edit/act-on-behalf grant; do not add scopes).
      authorization: "https://en.wikipedia.org/w/rest.php/oauth2/authorize?scope=",
      token: "https://en.wikipedia.org/w/rest.php/oauth2/access_token",
      userinfo: "https://en.wikipedia.org/w/rest.php/oauth2/resource/profile",
      // Descriptive User-Agent on the token + userinfo round-trips (Wikimedia etiquette, D5).
      [customFetch]: wikimediaFetch,
    }),
  ],
  callbacks: {
    // Runs server-side. On the sign-in pass (`account` + `profile` present) we do the ONE DB
    // write a login makes — find-or-create the contributor/account (AC2/AC3) — and stash the
    // resolved identity in the JWT. Every later request just reads the token (no DB hit, AC4).
    async jwt({ token, account, profile }) {
      if (account?.provider === "wikimedia" && profile) {
        const p = profile as WikimediaProfile;
        const resolved = await findOrCreateContributor({
          subject: p.sub,
          username: p.username,
          email: p.email ?? null,
        });
        token.contributorId = resolved.contributorId;
        token.username = resolved.handle;
        // D5b (issue #58): resolve the moderator role SERVER-SIDE once at sign-in and stamp it on
        // the JWT (the DB `is_moderator` column OR the `WIKIPLUS_MODERATORS` allowlist — never a
        // client flag). This is the AFFORDANCE claim only; the write boundary re-resolves the role
        // server-side, so a stale/forged claim never authorizes a write. Resolving it in the
        // sign-in pass (alongside the one find-or-create write) keeps ordinary reads JWT-only (AC4
        // / read-path discipline): no per-read role query.
        //
        // STALENESS TRADEOFF (issue #79): because the claim is stamped here and not re-resolved per
        // read, a role grant/revoke (WIKIPLUS_MODERATORS or the DB flag) only changes a user's UI
        // affordances after they re-login or their JWT expires. The session `maxAge` (7 days, above)
        // bounds that stale-affordance window. This is acceptable because the claim is affordance-only:
        // the write boundary (`holdClipAction`/`reviewClipAction`) re-resolves the role server-side
        // and enforces it immediately, so a stale stamp never grants or withholds an actual write.
        token.isModerator = await isModeratorContributor(
          getDb(),
          resolved.contributorId
        );
        // Issue #143: read the stored skin preference in the SAME sign-in pass (no extra read on
        // ordinary requests — read-path discipline / AC4). It is exposed on the session so a thin
        // client step mirrors it DB→cookie at login (spec §6.1), so the next paint's pre-paint
        // bootstrap reads the cookie alone. `undefined` ⇒ no stored preference (fall through to the
        // cookie / OS default). It NEVER enters the render path, so the cache stays skin-agnostic.
        const storedSkin = await getSkinPreference(resolved.contributorId, getDb());
        token.skinPreference = storedSkin ?? undefined;
      }
      return token;
    },
    // Expose the resolved identity to the client session (read from the JWT, no DB hit).
    async session({ session, token }) {
      if (session.user) {
        session.user.contributorId = token.contributorId;
        session.user.username = token.username;
        session.user.isModerator = token.isModerator ?? false;
        // Issue #143: expose the stored skin preference so a thin client step mirrors it into the
        // `wikiplus-skin` cookie at login (DB→cookie — spec §6.1). Read-only here; the cookie is the
        // single client source of truth for rendering and the toggle keeps both in sync.
        session.user.skinPreference = token.skinPreference;
        // Keep `name` aligned with the Wikimedia username for any default rendering.
        if (token.username) session.user.name = token.username;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
