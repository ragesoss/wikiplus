# Security Review: Auth + Server Actions
**Scope:** Issue #67 — consolidated security review for the public-link prototype  
**Reviewer:** QA & Review (non-author, fresh eyes)  
**Date:** 2026-06-19  
**Branch:** claude/wonderful-fermi-6puawr  
**Threat model:** anonymous internet visitors, signed-in non-moderator contributors, curators acting on others' clips, forged/replayed sessions, moderators acting outside authority

---

## 1. Executive Summary

**Overall posture: ADEQUATE for public-link prototype exposure. No Critical findings.**

The auth and write-boundary implementation is defense-in-depth and structurally sound. Every Server Action write calls `requireContributor()` before any DB operation. Ownership gates are id-based and server-side. The moderator role is re-resolved server-side on every privileged write — the JWT `isModerator` claim is correctly limited to the affordance layer. `server-only` imports and Drizzle's typed queries prevent DB access from reaching the client bundle. Email is never selectable on any public path.

Two High findings require Development attention before or shortly after go-live: unvalidated free-text modifier fields in `pickEditable` (no length cap, stored in DB), and a stale `isModerator` JWT claim after a moderator is granted or revoked in-session (the claim is only refreshed on sign-in). Additionally there are several Medium and Low findings that represent hardening improvements for the production phase.

**Verdict for go-live:** route the two High findings to Development. The Critical invariants (gate-first, ownership, role-gate, secret isolation, privacy projection) are all CONFIRMED. Proceed to Operations with High defects queued for the post-public-link sprint.

---

## 2. Severity-Ranked Findings

---

### H-1 — HIGH: No length cap on `stanceModifier`, `accuracyModifier`, `sectionSlug`, `sectionLabel` in `pickEditable`

**Location:** `lib/server/actions.ts:237-249`  
**Severity:** High

**Description:** The `pickEditable` function passes `stanceModifier`, `accuracyModifier`, `sectionSlug`, and `sectionLabel` through to the DB without a length cap. Only `contextNote` (capped via `capText`) is guarded. A signed-in contributor can POST a `ClipEditPatch` with arbitrarily large strings in any of these four fields. The architecture note (`ARCHITECTURE.md`) acknowledges "a free-text length cap (`context_note` / `caption` / `title`)" but omits these four fields from the list.

**Impact:** A malicious contributor can store multi-megabyte strings in `stance_modifier`, `accuracy_modifier`, `section_slug`, or `section_label` columns, bloating the DB, degrading list-clips queries, and potentially causing out-of-memory rendering on every topic load. This is exploitable by any authenticated user; it does not require moderator privileges.

**Recommendation (for Development):** Apply `capText` to all four fields in `pickEditable` — or extract a shared short-string cap (e.g., 512 chars) distinct from `MAX_TEXT`. Also apply the same cap to the corresponding fields in `validateClipInput` (`addClipAction` path). Compare with ARCHITECTURE's note that `*_modifier` is "≤24 chars" — if that is the intended UX limit, enforce it at the boundary.

---

### H-2 — HIGH: Stale `isModerator` JWT claim after role change; time-window where UI shows wrong affordances

**Location:** `lib/auth/config.ts:113-116`  
**Severity:** High (though only High, not Critical, because the write boundary always re-resolves the role server-side)

**Description:** The `isModerator` claim is stamped on the JWT at sign-in and is never refreshed until the user re-authenticates. Auth.js v5 stateless JWT sessions have no server-side invalidation. If:
- A moderator's role is revoked (DB flag cleared or removed from `WIKIPLUS_MODERATORS`), they continue to see Hold/Approve UI affordances until their session expires (default Auth.js JWT `maxAge` is 30 days unless overridden — not configured in `authConfig`).
- A newly-granted moderator doesn't see the affordances until they sign out and back in.

**Security impact of the first case:** LOW at the write boundary (the boundary always re-resolves the role, so a revoked moderator cannot actually perform a privileged write). However, a revoked moderator continues to see the reviewer affordances in the UI for up to 30 days, which creates a misleading user experience and could be confusing for moderation investigations.

**Impact of the second case:** A newly granted moderator may attempt to perform a review and get "Not authorized" from the server despite appearing to have the affordance — a UX bug, not a security failure.

**No JWT `maxAge` is configured** in `authConfig` (no `session: { strategy: "jwt", maxAge: ... }`). Auth.js v5 defaults to 30 days. This means a session token from 29 days ago is still valid. While not a critical risk here (ownership and role are re-resolved server-side), the absence of an explicit `maxAge` is a missing control.

**Recommendation (for Development):** Set an explicit `session: { maxAge: ... }` in `authConfig` (e.g., 7 days for prototype, 24 hours for production). Consider adding a `session` callback that re-resolves `isModerator` from the DB on every session read — this does add a per-request DB hit but is the correct defense when role changes must take effect without re-login. Alternatively, document the "re-login required for role change" operational requirement explicitly in the runbook.

---

### M-1 — MEDIUM: `clipOwnership` does not filter out already-removed clips; owner can edit/hold a soft-removed clip

**Location:** `lib/db/drizzle-store.ts:317-326`  
**Severity:** Medium

**Description:** `clipOwnership` runs `WHERE id = ?` with no `removed_at IS NULL` predicate. This means `updateClipAction`, `deleteClipAction`, and `holdClipAction` can succeed on a clip that a moderator has already soft-removed. The owner can still edit the `contextNote` or put it "back on hold" even though the clip is already removed from the public read. The write boundary has no guard for this state.

**Impact:** A clip a moderator soft-removed as abusive can be edited by its owner, potentially changing the evidence in the soft-removal audit trail. More concretely: a curator could call `holdClipAction` on a removed clip (they own it), which sets `vetted = false` and returns the clip row — but since `listClips` already filters `removed_at IS NULL`, this is a no-op from the reader's perspective. The concern is the `updateClipAction` path: an owner can overwrite the `contextNote` on a removed row, which changes the audit record of what was in the clip when it was removed.

**Recommendation (for Development):** Add `and(isNull(clip.removedAt))` to the `clipOwnership` query (or to the individual actions that call it) so that edit/delete/hold on a removed clip fails with "not found." Alternatively, accept this as a known limitation if the audit trail concern is low-priority for the prototype.

---

### M-2 — MEDIUM: `trustHost: true` — confirm Caddy is the only external entry point

**Location:** `lib/auth/config.ts:82`  
**Severity:** Medium

**Description:** `trustHost: true` tells Auth.js to trust the `Host` request header for constructing the OAuth callback URL. If any path exists to reach the Next.js server directly (bypassing Caddy), an attacker who can control the `Host` header could construct a redirect_uri pointing at an arbitrary domain, potentially enabling session theft.

**Impact:** If Caddy correctly blocks direct access to port 3000, this is a non-issue. If the VPS exposes port 3000 publicly (or if a misconfiguration allows it), an open-redirect in the OAuth flow becomes possible.

**Verification needed (Ops):** Confirm that the Docker Compose exposes only ports 80/443 via Caddy and that port 3000 is not published to the host. The current `docker-compose.yml` uses `expose: ["3000"]` (internal-only), not `ports:`, which is correct. This finding is confirmed-safe if that configuration is enforced.

**Recommendation (for Ops):** Add a firewall rule (ufw/iptables) to block direct access to port 3000 from outside the compose network as an additional defense-in-depth layer. Document this in the runbook.

---

### M-3 — MEDIUM: No explicit JWT `maxAge` / session expiry configured

**Location:** `lib/auth/config.ts:84`  
**Severity:** Medium (overlaps with H-2 but is a separate concern)

**Description:** Auth.js v5 defaults to 30-day JWT `maxAge` when not explicitly set. This is a long-lived session for a curation tool. A stolen JWT cookie would grant contributor access for up to 30 days.

**Recommendation (for Development):** Set `session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }` (7 days) at minimum. For production, 24–48 hours is a common standard for privileged contribution tools.

---

### M-4 — MEDIUM: Open-redirect risk via client-supplied `callbackUrl` — Auth.js's built-in protection relies on same-origin check

**Location:** `lib/auth/callback-url.ts:8-9`, `components/auth/LoginPrompt.tsx:41`  
**Severity:** Medium

**Description:** `currentCallbackUrl()` returns `window.location.pathname + window.location.search`, which is same-origin by construction (it reads from `window.location`). The `signIn` call passes this as `callbackUrl`. Auth.js v5 does validate that `callbackUrl` is on the same origin before redirecting, so a direct external-URL bypass is blocked by the framework. However, there is no application-level validation in `currentCallbackUrl()` beyond reading `window.location`.

**Impact:** Same-origin only — the framework protection is the guard. This is defense-in-depth gap, not an exploitable vulnerability as of Auth.js v5 beta. However, if Auth.js's callback URL check ever regresses, there is no app-level fallback.

**Recommendation (for Development):** Add an explicit guard in `currentCallbackUrl()` to confirm the returned path starts with `/` and does not contain `//` or a scheme. This is belt-and-suspenders for the framework's validation.

---

### M-5 — MEDIUM: `dismissedKeysAction` (read) is unauthenticated but exposes all dismissals across all contributors for a topic

**Location:** `lib/server/actions.ts:537-539`  
**Severity:** Medium (informational, by design)

**Description:** `dismissedKeysAction` returns the full set of dismissed `platform:videoId` keys for a topic — from all contributors — with no auth gate. This is intentional (shared durable dismissals, per design). However, it means any anonymous visitor can learn what videos the collective curation community has ruled out for a given topic.

**Impact:** Low. The dismissed keys are `platform:videoId` strings (not contributor identities, not clip content). However, it is a minor information disclosure about curatorial activity to anonymous users.

**Recommendation:** Accept as by-design for the prototype. Consider restricting to authenticated users in a production hardening pass if the dismissed-candidate signal proves sensitive.

---

### L-1 — LOW: `stanceModifier` and `accuracyModifier` are not validated against a closed set

**Location:** `lib/server/actions.ts:237-245`  
**Severity:** Low

**Description:** The `stance` and `accuracyFlag` fields are validated against a closed set (`STANCES`, `ACCURACY`), but `stanceModifier` and `accuracyModifier` are free text with no length cap (see H-1) and no closed-set validation. ARCHITECTURE notes these should be "≤24 chars" but this is not enforced at the boundary. A malformed modifier could confuse rendering downstream.

**Recommendation:** After fixing H-1's length cap, consider adding a max length of 48–64 chars (not 24 — the UX limit — as a generous server cap) to prevent DB bloat while allowing reasonable values.

---

### L-2 — LOW: `AUTH_SECRET` absence not caught until first auth round-trip

**Location:** `lib/auth/config.ts` (Auth.js auto-reads `AUTH_SECRET`)  
**Severity:** Low

**Description:** Auth.js auto-reads `AUTH_SECRET` from `process.env` and throws at runtime when it is absent during a sign-in. The `deploy/docker-compose.yml` uses `${AUTH_SECRET:?...}` so the service fails to start if the secret is missing — this is a good deploy-time guard. However, a `next build` succeeds without `AUTH_SECRET` (intentional — the connection is lazy), so a misconfigured build environment wouldn't surface this until a sign-in attempt.

**Recommendation:** Accept as-is. The `:?` guard in `docker-compose.yml` is the correct deploy-time enforcement. Document "AUTH_SECRET required for any session operation" in the ops runbook (it may already be there — confirm).

---

### L-3 — LOW: YouTube API key is `NEXT_PUBLIC_` — intentional but worth documenting per-reviewer

**Location:** `lib/candidates/youtube.ts:18`, `playwright.config.ts:49`  
**Severity:** Low (informational)

**Description:** `NEXT_PUBLIC_YOUTUBE_API_KEY` is inlined into the client bundle at build time. This is intentional per ARCHITECTURE ("a browser key restricted by HTTP referrer"). The key is API-restricted to YouTube Data API v3 and referrer-restricted to the live origin. This is not a secret; it is a public-data API key.

**Impact:** If the referrer restriction is misconfigured or bypassed, the quota can be consumed. The key itself is not a secret.

**Recommendation:** Confirm the referrer restriction in the YouTube API console is correctly set to `https://wikiplus.wikiedu.org/*`. This is an Ops check, not a code change.

---

### I-1 — INFORMATIONAL: `resolveOEmbedAction` is not auth-gated — correct by design, confirmed

**Location:** `lib/embed/oembed.ts:75`  
**Severity:** Informational

**Description:** `resolveOEmbedAction` is a `"use server"` function but does not call `requireContributor()`. It is a stateless, read-only metadata lookup with no DB write. The add-clip write (`addClipAction`) that follows it is separately auth-gated.

**Confirmed correct:** The SSRF posture is sound: the host is fixed (`www.youtube.com/oembed`), the user-supplied `watchUrl` is confined to the `?url=` query parameter via `encodeURIComponent`, and no fetch is made for non-YouTube platforms. Covered by `test/oembed-ssrf-qa.test.tsx`. No action needed.

---

### I-2 — INFORMATIONAL: Race condition in `findOrCreateContributor` — loser creates an orphaned contributor row

**Location:** `lib/auth/contributor.ts:55-60, 121-136`  
**Severity:** Informational

**Description:** The concurrent first-login race is handled via `onConflictDoNothing` on the `account` insert (the `account_provider_identity` unique), after which both racers re-read the winner's account. However, the loser's freshly-inserted `contributor` row is left unlinked. No FK depends on it; it is never returned. As documented in the code, this is "harmless" — correct.

**Confirmed correct:** The loser's orphaned row is an acceptable tradeoff given the prototype's concurrency volume. For production, a SERIALIZABLE transaction or an application-level lock would clean this up, but it is not a security issue.

---

### I-3 — INFORMATIONAL: No CSRF protection on Server Actions — Next.js handles this by default

**Location:** All Server Actions in `lib/server/actions.ts`  
**Severity:** Informational

**Description:** Next.js App Router Server Actions include built-in CSRF protection via the `Origin` header check: a Server Action invoked from a cross-origin page is rejected. This is framework-level, not application-level, but it is the standard defense.

**Confirmed correct:** No additional application-level CSRF token is needed for Server Actions in Next.js 15. The `trustHost: true` flag does not disable Origin checking. No action needed.

---

### I-4 — INFORMATIONAL: Prior reviews — confirmed still holds

**From issue C (attribution-spoof override):** `addClipAction` stamps `curatedBy = username` from the server session, ignoring any client-supplied `curatedBy`. Confirmed in `lib/server/actions.ts:180` and `test/auth-boundary.test.ts:137-155`.

**From issue C (identity-collision):** `findOrCreateContributor` uses `(provider, provider_account_id)` as the durable identity anchor, not the mutable handle. The handle is non-unique. Confirmed correct in `lib/auth/contributor.ts`.

**From issue #45 (shared persistence + write boundary):** The boundary is `"use server"` with `server-only` imports on all DB-touching modules. `DATABASE_URL` is never in the client bundle. Confirmed.

**From issue #64 (oEmbed SSRF posture):** Confirmed still sound. Host is fixed, input is query-parameter-confined, no second-order fetch. Test coverage exists in `test/oembed-ssrf-qa.test.tsx`.

---

## 3. Invariant Confirmation Table

| # | Invariant | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **Gate-first**: every write action calls `requireContributor()` before any DB operation | CONFIRMED | All 10 write actions in `lib/server/actions.ts` call `requireContributor()` as their first statement. Read actions (`listClips`, `getTopic`, `getContributorByUsername`, `listClipsByContributor`, `dismissedKeysAction`) correctly do NOT gate. |
| 2 | **Ownership gate**: edit/delete is owner-only (session `contributorId === clip.curatorId`, id-based) | CONFIRMED | `updateClipAction:284` and `deleteClipAction:316` both compare `owner.curatorId !== contributorId` after loading `clipOwnership`. Never username-based. Covered by `test/clip-edit-delete.test.ts` AC4/AC5/AC6. |
| 3 | **Role gate accuracy**: hold = moderator OR own-curator; approve = moderator-only, no self-approve; remove = moderator-only, NO own-curator arm | CONFIRMED | `holdClipAction:354`: `!isModerator && !ownsClip`. `reviewClipAction:381`: `!isModerator` only (no `ownsClip` arm). `removeClipAction:435`: `!isModerator` only (no `ownsClip` arm). Covered by `test/vetted-review-hold.test.ts` and `test/moderator-removal.test.ts`. |
| 4 | **Rate-limit placement**: called after auth gate, before write, on every counted gated write | CONFIRMED | `checkWriteRateLimit` is called after `requireContributor()` and before any `store.*` write in all 10 write actions. `recordWriteEvent` is called after the write lands. Pattern consistent across all actions. |
| 5 | **Secret isolation**: `DATABASE_URL` + OAuth secrets + `AUTH_SECRET` never in client bundle | CONFIRMED | `lib/db/client.ts` imports `server-only` at line 1. `lib/auth/config.ts` imports are server-only (route handler + jwt callback). `lib/auth/require-session.ts` imports `server-only`. `lib/db/drizzle-store.ts` imports `server-only`. OAuth secrets use `process.env.wikimedia_oauth_client_key` (not `NEXT_PUBLIC_`). `docker-compose.yml` uses `:?` guards. |
| 6 | **Privacy projection**: `account.email` never selectable on any public (anonymous-reachable) path | CONFIRMED | `getContributorByUsername` in `lib/db/drizzle-store.ts:342-356` selects only `contributor.id`, `contributor.handle`, `contributor.avatarUrl`, `contributor.displayName`, `contributor.createdAt` — `account` table is never joined. `rowToPublicContributor` (mappers.ts:185-196) uses `Pick<ContributorRow, "id" \| "handle" \| "avatarUrl">` narrowing. `listClipsByContributor` selects `clip.*` and `topic.wikidataQid`/`topic.title` — no `account` join. |
| 7 | **isModerator claim is affordance-only**: write boundary re-resolves the role server-side | CONFIRMED | `lib/auth/config.ts:113`: "This is the AFFORDANCE claim only; the write boundary re-resolves the role server-side." `holdClipAction:352`, `reviewClipAction:380`, `removeClipAction:435` all call `isModeratorContributor(db, contributorId)` directly — no JWT claim is consulted in the write path. |

---

## 4. Prior Review Summary

### Issue C — attribution-spoof + identity-collision
Confirmed still holds. The boundary stamps attribution server-side; `findOrCreateContributor` is keyed on the stable `(provider, provider_account_id)` anchor.

### Issue #45 — shared persistence + FK attribution + write boundary
The write boundary was characterized as unauthenticated at the time. That is now closed: every write action gates via `requireContributor()`. The `server-only` import chain is intact.

### Issue #64 — oEmbed SSRF posture
The `resolveOEmbedAction` SSRF posture was reviewed independently and remains sound. The host is a fixed constant; user input is `encodeURIComponent`-confined to a query parameter; non-YouTube platforms never trigger a fetch. Test coverage exists.

### Auth bugs #50 and #51
These issue numbers were not found in the codebase comments or git log. Their security impact could not be assessed from this review. Development should confirm whether these are open issues and what their security surface is.

---

## 5. Out of Scope

- **DOMPurify allowlist / Wikipedia HTML XSS surface** — tested in `test/article-fidelity-xss.test.ts` and `test/article.test.ts`; not re-reviewed here per the audit brief ("build on prior reviews — do not redo").
- **Design fidelity and UX correctness** — routed to UX / Design.
- **CI/CD pipeline security** — routed to Operations.
- **Rate-limit bypass via distributed identities (sockpuppets)** — per ARCHITECTURE, explicitly deferred post-MVP. The current per-identity Postgres-backed rate limit is the intended prototype scope.
- **Wikimedia OAuth scope hygiene** — the default identify-only scope is confirmed in use; expanding to edit/act-on-behalf scopes is a future concern if that capability is added.
- **Production Redis ISR cacheHandler** — not yet built; not in scope.
- **Admin UI for moderator grant** — there is none (intentional); the out-of-band runbook approach is correct for the prototype.
- **Content security policy (CSP) headers** — not reviewed; recommended for the production hardening pass.

---

## 6. Defects Routed to Development

| ID | Severity | Finding |
|----|----------|---------|
| H-1 | High | `pickEditable` missing length caps on `stanceModifier`, `accuracyModifier`, `sectionSlug`, `sectionLabel` — any authenticated user can store arbitrarily large strings in these columns |
| H-2 | High | Stale `isModerator` JWT claim + no explicit `session.maxAge` — revoked moderators see affordances for up to 30 days; no configured session expiry |
| M-1 | Medium | `clipOwnership` does not filter `removed_at IS NULL` — owner can edit/hold a soft-removed clip, mutating the audit record |
| M-4 | Medium | No application-level validation in `currentCallbackUrl()` — relies solely on Auth.js framework check |

**Ready for Operations when:** H-1 and H-2 are resolved by Development and re-verified by QA. M-1 is recommended but not blocking.
