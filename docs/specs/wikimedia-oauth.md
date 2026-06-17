# Spec: Wikimedia OAuth login — "Log in with Wikipedia" (milestone C)

- **Issue:** milestone item **C** ("Log in with Wikipedia") · **Type:** build (auth foundation —
  first user-facing identity feature) · **Status:** spec
- **Owner:** Product · **Feeds:** UX (sign-in / signed-in flows + the logged-out contribute state),
  Development (Auth.js + Wikimedia provider + the gated write boundary), Operations (new secrets +
  prod callback URL), Curation/Editorial (the login-gating policy this implements) · **Verified by:**
  QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **C**
- **Builds on:** [#45](https://github.com/ragesoss/wikiplus/issues/45) (shared Postgres via Drizzle
  behind a Server Actions write boundary; the `contributor` / `account` tables already landed,
  Auth.js-adapter-shaped, unused by writes; interim writes attributed to a stub `@prototype`
  contributor)
- **Inputs (authoritative — do not relitigate):** `docs/VISION.md` (non-goals: OAuth-only, no
  passwords, web-first), `docs/ARCHITECTURE.md` *Authentication & identity* (settles the technical
  shape), `docs/CURATION_STANDARD.md` §7 (contribution is login-gated; reading is anonymous),
  `lib/data/types.ts` + `lib/db/schema.ts` (the identity model), `lib/server/actions.ts` (the write
  boundary C gates).
- **Hand-off:** UX (flows + buildable design spec for the stories below), then Development.

---

## Problem & user value

The prototype is now functionally live on shared Postgres (#45): everyone on
`wikiplus.wikiedu.org` reads and writes the **same** data. But **there is no real identity.**
Writes are anonymous: `addClip` and `recordDismissal` reach the server boundary with no logged-in
user, and every curated clip is attributed to a single seeded stub `@prototype` contributor. Two
problems follow directly:

1. **No accountability, and a known security gap.** Any anonymous visitor can curate or dismiss.
   The #45 fix round already had to *remove* `updateClip` / `deleteClip` from the boundary precisely
   because, with no auth, an anonymous boundary export would let any visitor edit or delete any
   clip. The write boundary is wide open by design, waiting for C to close it.
2. **Curation cannot be tied to a person.** VISION's core value is a curator who *vouches* for a
   clip — "a community doing for creator video what Wikipedia editors do for text." A vouch from
   `@prototype` is worthless. `Clip.curatedBy` exists but points at a stub; the `contributor` /
   `account` tables exist but no login ever populates them.

**Who logs in and why.** A **curator** signs in with their **Wikipedia / Wikimedia account** so
that the clips they curate, the notes they write, and the candidates they rule out are tied to
**their** Wikimedia identity — on-brand for a Wikipedia-adjacent product, and the thing that turns
an anonymous edit into an accountable, attributable vouch. A **reader** never has to log in:
reading stays fully anonymous, and the cached read path stays free of any per-user work
(ARCHITECTURE's read-path-efficiency principle, VISION non-goal).

This is milestone **C**: the **authentication foundation** — sign in / sign out with Wikipedia,
the real `contributor` / `account` identity, showing who you are, and closing the
anonymous-write gap by gating the existing write actions behind a logged-in session and
attributing curated clips to the real signed-in contributor.

---

## Scope decision: the C / D boundary

This is the scope call this spec exists to make. **C is the identity foundation; D is the richer
curation product layer.** The line is drawn so C closes the known anonymous-write security gap
(ARCHITECTURE: "contributing requires login"; CURATION §7) **without** taking on the
ownership/moderation/profile product surface that needs the identity to already exist.

### In scope (C)

1. **Sign in with Wikipedia (Wikimedia OAuth 2.0 via Auth.js).** Wikimedia configured as a custom
   OAuth/OIDC provider in Auth.js (NextAuth), authorized at `meta.wikimedia.org` (the mediawiki.org
   OAuth extension), using the **already-registered consumer** (key + secret already in `.env`,
   owner-provided). No passwords, no bespoke accounts (VISION non-goal). Wikimedia is the **only**
   provider in C; the `account` table's `(provider, provider_account_id)` shape means Google is
   purely additive later.

2. **Sign out.** A signed-in curator can sign out; the session is cleared and the UI returns to the
   anonymous state.

3. **The session.** **Stateless JWT session cookie** (ARCHITECTURE: ordinary requests need no
   session lookup, consistent with read-path efficiency). The signed-in `contributor` is resolvable
   server-side on a write without a per-read DB hit.

4. **Real `contributor` / `account` identity + the login→identity mapping.** On a successful
   Wikimedia login: find-or-create an **`account`** row keyed by `(provider='wikimedia',
   provider_account_id=<Wikimedia stable subject id>)`, belonging to a **`contributor`** row that
   carries the Wikimedia **username** as its display identity. A repeat login by the same Wikimedia
   user maps to the **same** `contributor` (no duplicate rows). This adopts the #45 tables; any
   small additive column the Auth.js adapter needs (e.g. provider tokens/expiry) is Development's
   call within the existing schema — recorded as a migration (see AC9).

5. **The stub→real migration.** The seeded stub `@prototype` contributor stays as the attribution
   for clips curated **before** C; new writes attribute to the real signed-in contributor. C does
   **not** retro-rewrite historical `@prototype` clips to a real person. (Recorded as a decision —
   D6.)

6. **Show the logged-in identity in the UI.** When signed in, the header shows **who you are** (the
   Wikimedia username; avatar if granted) and offers sign-out; when signed out, it offers
   **"Log in with Wikipedia."** The displayed identity is the signed-in user's, not a stub.

7. **Gate the existing write actions behind an authenticated session (closes the anonymous-write
   gap).** The two write actions that **persist today** —
   - `addClipAction` (reached from `app/contribute/page.tsx`), and
   - `recordDismissalAction` (reached from the Topic-page rail, `TopicView.tsx`) —

   are **rejected when there is no authenticated session** (server-side check at the boundary, not
   only a hidden button), and on success **attribute to the signed-in contributor** (`clip.curatorId`
   / `clip.curatedBy` = the real contributor; the dismissal's `contributorId` = the real
   contributor). `upsertTopicAction` is a prerequisite of `addClipAction` in the contribute flow and
   is gated **with** it (a logged-out user cannot create a topic-as-a-side-effect-of-adding). The
   `@prototype` stub is no longer used for new writes.

8. **The logged-out contribute experience is specified, not left to chance.** A logged-out user who
   tries to contribute (the `/contribute` page; a candidate's **Promote** / **Add video** entry
   points; **Not relevant** / dismiss) is **prompted to log in** rather than hitting a silent
   failure or a server error. Reading, browsing candidates, watching clips, search, and navigation
   are **unaffected** and require no login (CURATION §7: "browsing candidates is anonymous;
   promoting or adding requires login").

9. **Secrets handled correctly.** The Wikimedia consumer key/secret and the new `AUTH_SECRET` live
   in env / Docker secrets, **never** in the repo (ARCHITECTURE; VISION). No auth secret in the
   client bundle.

### Out of scope — this is **D** (the curation-action product layer), not C

Explicitly deferred so C stays the foundation. Each routes to D unless noted.

- **Editing / deleting your own clips.** `updateClip` / `deleteClip` stay off the boundary (where
  #45 left them). C does **not** add gated edit/delete actions — that needs **ownership** rules
  (who may edit what), which is D. → Development on **D**.
- **The CC BY-SA 4.0 context-note agreement capture at submit time** (CURATION §5.3 / Decision C5).
  C gates *who* may write; D captures the *license agreement* on the write. → Curation/Editorial set
  it; UX + Development build it in **D**.
- **Contributor profiles / "my curations" views / public attribution pages.** C shows *who you are*
  in the header; a browsable contributor identity surface is D. → UX + Development on **D**.
- **Upvote identity / one-vote-per-user.** Upvotes are not yet a persisted per-user write; tying a
  vote to an identity is D. → **D**.
- **Wiring the in-product Promote / Add-video / dismiss *modals* to real persistence.** Today
  `CurateModal` / `AddModal` are mock-submit (the real promote/add-by-link persistence is D). C gates
  the **boundary** those flows will eventually call and specifies their **logged-out** behavior
  (prompt to log in); it does **not** make the modals persist. → **D**.
- **Moderation tooling, the `vetted` review-hold workflow, per-identity rate-limit enforcement**
  (CURATION §7). Policy is set; *enforcement* is later. → Curation/Editorial + Operations.
- **Google (or any second provider) and account linking/merge.** The `account` table is shaped for
  it; switching it on is additive and later. → **D** / post-MVP.
- **Which Wikimedia scopes/claims to request beyond what identifies the user** (e.g. edit count as a
  moderation signal). C requests only what's needed to **identify** the user (stable subject id +
  username; avatar/email only if trivially granted). Edit-count-as-moderation-signal is a D/Ops
  concern. (ARCHITECTURE open question — left open here.)
- **Production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge). Unchanged; still deferred.
  C must not add per-user work to the cached read path (AC11).

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh eyes. "Signed in" = a
valid Wikimedia session established via the flow; "signed out" = no session. Where a live Wikimedia
round-trip can't run in CI, QA verifies the server-side **gate** and the **identity mapping** with
the provider call mocked/stubbed (consistent with how the Wikipedia fetch is mocked in tests).

**Sign-in / session / sign-out**

1. **AC1 — Log in with Wikipedia.** A signed-out user can initiate "Log in with Wikipedia" from the
   header, is sent through Wikimedia's OAuth authorization (`meta.wikimedia.org`), and on success
   returns to wiki+ in a signed-in state. The provider is Wikimedia, implemented with Auth.js
   (NextAuth) using the registered consumer credentials from env (not hardcoded).

2. **AC2 — A `contributor` + `account` row exist after first login, and the header shows the
   Wikimedia username.** After a first successful Wikimedia login, exactly one `account` row exists
   with `provider = 'wikimedia'` and `provider_account_id` = the user's stable Wikimedia subject id,
   linked to one `contributor` row whose display identity is the user's **Wikimedia username**; the
   header displays that username (not `@prototype`, not "anonymous").

3. **AC3 — Repeat login maps to the same contributor (no duplicates).** A second login by the **same**
   Wikimedia user does **not** create a second `contributor` or `account` row — it resolves to the
   existing rows (matched on `(provider, provider_account_id)`, which is unique per the schema).

4. **AC4 — Stateless session, no per-read DB lookup.** The session is carried by a JWT session
   cookie; an ordinary **read** request (loading the home page or a Topic page) performs **no**
   session/account DB lookup. (Verifiable by the absence of a session/account query on a read path,
   or by the documented session strategy = JWT.)

5. **AC5 — Sign out clears the session.** A signed-in user can sign out; afterward the session
   cookie no longer authenticates them, the header returns to the "Log in with Wikipedia" state, and
   a subsequent write action is treated as logged-out (rejected per AC7).

**Gating the write boundary (closes the anonymous-write gap)**

6. **AC6 — An authenticated `addClip` attributes to the real contributor.** When a **signed-in**
   user completes the contribute flow, the persisted clip's curator is the **signed-in
   contributor** (`clip.curatorId` → that contributor; `curatedBy` reflects their Wikimedia
   identity), **not** the `@prototype` stub. The infobox curator count reflects real contributors.

7. **AC7 — An unauthenticated `addClip` server action is rejected.** A call to `addClipAction`
   (and to `upsertTopicAction`, its prerequisite in the contribute flow) **with no authenticated
   session is rejected server-side** — it does not write a clip/topic and returns/raises an
   auth error. This holds for a direct boundary invocation, not just a hidden UI button (the gate is
   in the Server Action, not only the client).

8. **AC8 — An unauthenticated `recordDismissal` is rejected; an authenticated one attributes to the
   real contributor.** `recordDismissalAction` with no session is rejected server-side and writes no
   `dismissed_candidate` row; with a session it writes a row whose `contributorId` is the signed-in
   contributor. (Browsing/reading candidates remains anonymous — only the *dismiss write* is gated.)

**Logged-out contribute experience**

9. **AC9 — Identity migration applies cleanly and adopts the #45 tables.** Any schema change C needs
   (e.g. Auth.js-adapter columns for provider tokens) is a Drizzle migration that applies cleanly to
   the #45 schema from its current state, preserving the existing `contributor` / `account` /
   `clip.curatorId` shape; no destructive rewrite of #45's tables. The seeded `@prototype` contributor
   still exists after migration (it backs pre-C clips — D6).

10. **AC10 — Logged-out contribute prompts to log in, never silently fails.** A signed-out user who
    attempts to contribute — visiting `/contribute`, or activating a candidate's **Promote** / **Add
    video**, or **Not relevant** / dismiss — is shown a clear **"Log in with Wikipedia"** prompt /
    state rather than a server error, a silent no-op, or a false "saved" confirmation. (Exact UX is
    UX's; the AC is: the logged-out attempt resolves to an explicit login prompt.)

11. **AC11 — Reading stays anonymous and unchanged.** With **no** session, a user can still: load the
    home page and Topic pages, read the article, browse candidates, watch clips, use search, and
    follow internal links — with no login wall and no new per-user work on the read path. The reader
    experience is unchanged from #45 except for the addition of the header sign-in affordance.

**Security / hygiene**

12. **AC12 — No auth secret in the client bundle.** The shipped client JS bundle contains **no**
    `AUTH_SECRET`, no Wikimedia consumer secret, and no other auth credential. (Same bar as #45's
    AC7 for `DATABASE_URL`. The Wikimedia client *id* / public callback URL appearing client-side is
    acceptable; the *secret* must not.)

13. **AC13 — `yarn build` / `yarn typecheck` / `yarn test` green; gate + identity-mapping tested
    without a live provider.** The full check set passes. The boundary gate (AC7/AC8) and the
    login→`contributor`/`account` mapping (AC2/AC3) are covered by tests that run in CI with **no
    live Wikimedia round-trip** (the provider call mocked/stubbed; the DB via pglite as in #45).

14. **AC14 — `docs/ARCHITECTURE.md` reflects what shipped.** ARCHITECTURE's *Authentication &
    identity* and *Prototype phase* (the "Auth: stubbed" line) are updated to record that Wikimedia
    OAuth via Auth.js is **live**, that the write boundary is auth-gated, that the `@prototype` stub
    is superseded for new writes, and the session strategy used. (Docs-as-built, the #45 pattern.)

---

## Success metric

C is auth infrastructure with no analytics backend, so success is the **gate + real identity working
end-to-end**, verified at QA/UX review:

- **Primary (the gap is closed + identity is real):** With **no** session, a direct call to
  `addClipAction` / `upsertTopicAction` / `recordDismissalAction` is **rejected** (AC7, AC8) — the
  anonymous-write gap #45 flagged is closed. With a Wikimedia session, a curated clip is attributed
  to the **real signed-in contributor**, not `@prototype` (AC6, AC2). This is the binary
  "contributing requires login, and a vouch ties to a real Wikimedia identity" check.
- **Secondary (reading is untouched):** Reading, browsing, watching, and search work with **no**
  login and **no** new per-user read-path work (AC11, AC4) — we added accountable contribution
  without regressing the anonymous, cacheable read path.
- **Foundational:** The `account` / `contributor` mapping is populated by real logins (AC2, AC3) and
  is provider-additive (the `(provider, provider_account_id)` shape unchanged), so **D** (the
  curation product layer: edit/delete-your-own, profiles, license-agreement capture) and a later
  Google provider build on it with no identity rework.

A future Analytics role would instrument distinct-contributor counts and login conversion on the
shared DB; for C the success check is the manual two-state test above (rejected-when-anonymous /
attributed-when-signed-in), not a metric pipeline.

---

## Dependencies & owner / Operations actions

These are **infra/owner concerns, flagged here so Ops and the owner act on them** — this spec does
not design the infra.

- **`AUTH_SECRET` (new).** Auth.js requires a server-side `AUTH_SECRET` for signing/encrypting the
  session JWT. It must be generated and provided as a **server secret** (env / Docker secret on the
  VPS, and a CI/local value for tests) — never committed. → Operations + owner.
- **Registered prod callback / redirect URL.** The Wikimedia OAuth consumer must have the
  **production callback URL** registered at `meta.wikimedia.org` (the Auth.js Wikimedia-provider
  callback under `https://wikiplus.wikiedu.org`). Confirm the registered redirect URI matches what
  Auth.js will use before bring-up. → owner (consumer registration) + Operations (wire on the box).
- **Existing consumer credentials.** The Wikimedia consumer **key + secret are already in `.env`**
  (owner-provided). Development reads them from env via the same pattern as the YouTube key's
  server-secret path; they must reach the VPS as Docker secrets at deploy. → Operations.
- **Session cookie over HTTPS.** Caddy already terminates TLS at `wikiplus.wikiedu.org`; the
  session cookie must be `Secure` in production. → Operations (verify), Development (cookie config).
- **No new always-on service.** C needs **no** Redis or new container — the JWT session strategy
  avoids a server-side session store (ARCHITECTURE). Any account-record reads use the existing
  Postgres. → no Ops infra change beyond the two secrets above.

---

## Hand-off

- **UX:** C is the **first user-facing identity surface.** Produce the flows + buildable design spec
  for: (a) the **header sign-in affordance** — "Log in with Wikipedia" when signed out, the
  signed-in identity (Wikimedia username, optional avatar) + sign-out when signed in; (b) the
  **logged-out contribute experience** (AC10) — what a signed-out user sees when they hit
  `/contribute` or a Promote / Add-video / Not-relevant entry point, resolving to a clear login
  prompt rather than a dead end or false success; (c) the **return-from-OAuth** moment (where they
  land, any pending action resumed or not). Honor the Indigo Press identity; the "Log in with
  Wikipedia" affordance is on the plus side. Evaluate the built UI against AC2, AC5, AC10, AC11.

- **Development:** build the in-scope items 1–9 against AC1–AC14 — Auth.js (NextAuth) with Wikimedia
  as a custom OAuth provider (consumer creds from env), the JWT session, the login→find-or-create
  `contributor`/`account` mapping (adopting the #45 tables; any adapter columns as a clean
  migration), the header identity wiring, and **the auth gate on `addClipAction` /
  `upsertTopicAction` / `recordDismissalAction` at the boundary with real-contributor attribution**.
  Keep `updateClip`/`deleteClip` off the boundary (that's D). Record the as-built in ARCHITECTURE.
  Hand off to QA & Review.

- **Operations:** provision the two new secrets (`AUTH_SECRET`; the existing Wikimedia consumer
  key/secret as Docker secrets on the VPS), confirm the registered prod callback URL, and verify the
  `Secure` session cookie under Caddy/TLS. No new always-on service is required.

- **Curation/Editorial:** C **implements** the §7 login-gating policy (contribution gated, reading
  anonymous). The CC BY-SA agreement capture stays **D** — no editorial change is requested by C;
  this is a hand-shake, not a hand-off.

- **QA & Review:** verify AC1–AC14 pass/fail with fresh, non-author eyes, plus the standard security
  review — the boundary gate is the only thing standing between an anonymous request and a write
  (AC7/AC8), and no auth secret may reach the client bundle (AC12).

---

## Decisions (recorded because the prompt/docs leave these open; owner offline)

- **D1 — C gates the *boundary*, not just the buttons.** The auth check lives in the Server Actions
  (`addClipAction`, `upsertTopicAction`, `recordDismissalAction`), so a direct boundary call with no
  session is rejected (AC7/AC8) — a hidden button is not a security control. This is the direct
  closure of the gap #45's fix round flagged when it removed `updateClip`/`deleteClip`.

- **D2 — Wikimedia only; provider-additive by construction.** Only the Wikimedia provider is wired
  in C (VISION MVP). The `account` table's `(provider, provider_account_id)` shape (already landed in
  #45) means Google later is additive — explicitly **out of scope** here, not redesigned.

- **D3 — JWT sessions (not a server-side session store).** Per ARCHITECTURE, stateless JWT session
  cookies keep ordinary reads free of a session lookup (AC4) and avoid standing up Redis or a session
  table for C. Account records use the existing Postgres.

- **D4 — C does not wire the in-product curation modals to persistence.** `CurateModal` / `AddModal`
  remain mock-submit; the real promote/add-by-link persistence (and its license-agreement capture) is
  D. C gates the boundary they will call and specifies their **logged-out** behavior (AC10). This
  keeps C the identity foundation, not the curation product layer.

- **D5 — Minimal scopes: identify the user only.** C requests only what identifies the Wikimedia user
  (stable subject id + username; avatar/email only if trivially granted). Edit-count-as-moderation
  and richer scopes are deferred (ARCHITECTURE open question, left open) → D/Ops.

- **D6 — No retro-rewrite of `@prototype` clips.** The seeded stub contributor stays as attribution
  for clips curated before C; only **new** writes attribute to the real signed-in contributor. C does
  not migrate historical stub-attributed clips to a real person (there is no real person to assign
  them to). The stub row persists (AC9).

- **D7 — Logged-out contribute resolves to a login prompt, never a false success.** A signed-out
  contribute attempt must explicitly prompt to log in (AC10); it must never silently no-op or show a
  "saved" confirmation for a write that did not happen (the #45 async-write UX bar: no false
  success). The exact placement/copy is UX's.
