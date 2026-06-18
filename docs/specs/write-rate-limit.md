# Spec: Per-identity write rate-limit enforcement (milestone D5a)

- **Issue:** [#57](https://github.com/ragesoss/wikiplus/issues/57) — milestone **D**, run **D5a**
  (first of three split from #56: D5a rate-limit / D5b vetted-hold + role model / D5c moderator
  removal) · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the user-facing "too fast" notice — its copy, placement, and
  AA treatment on the Indigo Press identity, distinct from the login gate and the generic write
  error), Development (a `write_event` ledger table + migration, a server-side per-identity window
  check wired into the gated write actions, a distinct `RateLimitedError` + a client-safe detector),
  Curation/Editorial (D5a is the **enforcement** of §7's already-set rate-limit posture — a
  hand-shake, not a hand-off) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer); D5 = the §7 moderation enforcement layer.
- **Builds on:**
  - **C** (`docs/specs/wikimedia-oauth.md`) — the real `contributor` identity and the
    `requireContributor()`-gated write boundary. The rate-limit subject is the resolved
    `contributor.id`; C is what makes "per-identity" possible (an anonymous user can't write at all).
  - **D1** (`docs/specs/curate-add-persistence.md`) — the gate-FIRST posture (`requireContributor()`
    before any DB touch), the `AuthRequiredError` / `AUTH_REQUIRED_MARKER` / `isAuthRequired` /
    `showExpiredGate` pattern D5a mirrors for its own distinct rejection, and the
    optimistic-with-rollback write posture `TopicView` uses.
  - **D4** (`docs/specs/upvotes.md`) — the just-shipped `toggleUpvoteAction` (a gated, high-frequency
    write that D5a brings under a limit) and the additive-migration pattern
    (`drizzle/0004_perpetual_fat_cobra.sql`); D4 explicitly deferred "moderation / anti-gaming /
    per-identity rate limits on voting" to **D5** — that deferral is the charter for this run.
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§7** — the **posture is already set**: "per-identity write limits
    (Redis-backed) to blunt spam floods"; "contribution is gated by login; reading is anonymous"; a
    write is a natural **rate-limit subject** *because* it ties to an identity. D5a is the
    **enforcement** of that policy — it does not re-decide the policy.
  - `docs/ARCHITECTURE.md` — *Guiding principle: the read path is the scale lever*; *Prototype phase*
    (shared Postgres via Drizzle behind the Server Actions boundary); the **deferred** read-path
    Redis ISR `cacheHandler` (Redis is reserved there for the shared ISR cache + cached candidate
    sets — **not yet introduced**); the resolved-policy / pending-enforcement note for "Abuse/spam
    handling." D5a records its backing decision here.
  - The code (read, not paraphrased):
    - `lib/server/actions.ts` — the `requireContributor()`-gated content writes the limit applies to:
      `addClipAction`, `upsertTopicAction` (its prerequisite), `toggleUpvoteAction`; the gate-FIRST
      shape (`recordDismissalAction`, `updateClipAction`, `deleteClipAction` follow the same order).
    - `lib/auth/require-session.ts` — `requireContributor()` resolves `{ contributorId, username }`
      from the JWT (no per-read DB hit). `AuthRequiredError` (a distinct error class carrying a stable
      marker `code`) is the exact shape D5a's rejection mirrors.
    - `lib/auth/auth-error.ts` — `AUTH_REQUIRED_MARKER` + `isAuthRequired(err)`: the **client-safe
      detector** pattern (no server-only import; inspects a caught error) D5a reuses for its own
      distinct "you're going too fast" signal — and the production caveat (Next.js redacts Server
      Action error *messages*; the `name`/`code` match is the reliable channel).
    - `lib/auth/microcopy.ts` — `AUTH_COPY` (the single source of verbatim gate/error strings). D5a's
      message is a **new, distinct** entry here (not a reuse of a `gates.*` login string and not the
      generic `errors.*`).
    - `lib/db/schema.ts` — the table patterns: `clip_vote` (D4) as the most recent additive table;
      `index(...)` for query support; `references(... onDelete: "cascade")`; `defaultNow()`
      timestamps. The `write_event` ledger follows these conventions.
- **Hand-off:** UX (the buildable copy/placement/AA spec for the limit notice), then Development.

---

## Problem & user value

The curation write surface is now fully real: a logged-in contributor can promote/add a clip and
write its note (D1), edit/delete their own (D2), be publicly attributed (D3), and upvote (D4). Every
one of these is `requireContributor()`-gated — so a write **always** ties to a real Wikimedia
identity. But there is **no cap on how fast** that identity may write. A single signed-in account (or
a script driving an authenticated session) can flood the shared database — hundreds of
clip-adds, topic-upserts, or upvote toggles in seconds — with nothing to blunt it. CURATION §7 names
exactly this risk and sets the posture ("per-identity write limits to blunt spam floods"), but the
**enforcement** was deferred to D5. D4 closed with that deferral explicit: "anti-gaming / per-identity
rate limits on voting — D5."

**The user value is integrity, not friction.** wiki+'s whole premise is Wikipedia-shaped trust: a
Topic page is worth reading because real people curated it with care. A flood of low-effort or
scripted writes — spam clips, junk topics, upvote inflation — directly corrodes "what good looks
like" (*a reader leaves with 2–5 clips they're glad they watched and understands how to weigh each*).
A per-identity cap is the cheapest, most legible blunt instrument against that: it costs an honest
curator **nothing** (the limit is set well above any human curation rate) and costs a flood-script its
flood.

**Who is affected and how.** A **normal signed-in curator** acting at human speed **never sees the
limit** — that is the design's first requirement, and the limit values are chosen to guarantee it. A
contributor (or session) writing far faster than any human would — the flood case — is **stopped
server-side**: the write does not happen, and they see a **clear, non-alarming** message ("you're
doing that too fast — try again in a moment"), distinct from the login gate and from a generic error.
After the window passes, they can write again. An **anonymous** visitor is irrelevant to the limit:
the auth gate already stops every anonymous write, so the limit only ever applies post-auth, per
identity. **Reading stays anonymous and unlimited** — the limit touches contributions only.

This is milestone **D5a**: **per-identity write rate-limit enforcement** — a generous per-identity
cap on the gated content writes, enforced at the write boundary, rejecting an over-limit write with a
clear message and writing nothing. It is *a window check at the gated actions + a small Postgres
ledger + a distinct limit message* — **not** the `vetted` review hold (D5b), **not** moderator removal
(D5c), and **not** sockpuppet / vote-fraud heuristics (post-MVP).

---

## Scope (what D5a does)

1. **A per-identity, fixed-window write cap, enforced server-side at the gated write boundary.** A
   contributor may make at most **N writes per rolling/fixed window W**; the (N+1)th within the
   window is **rejected** — the write does not happen (no clip / topic / vote row written) — and a
   distinct rate-limit rejection is raised. The check runs **at the action, after** `requireContributor()`
   resolves the identity and **before** any persisting DB write (Decision 2's defaults; gate-then-limit-then-write
   order — Decision 2 fixes the ordering). The limit is keyed by **`contributor.id`** (Decision 4).

2. **The limited set = the gated content writes** (Decision 2): `addClipAction` (and its prerequisite
   `upsertTopicAction`), and `toggleUpvoteAction`. `recordDismissalAction` (a curation action, also
   gated) **counts** toward the budget too (it is a write; Decision 2 records why). The **two
   load-bearing** writes for the spam case are clip-add and upvote-toggle. **Reads** are never
   limited (no `requireContributor()`, no count).

3. **The limit is Postgres-backed — a small `write_event` ledger** (Decision 1): each successful (or
   attempted-and-counted — Dev's call within Decision 2) gated write records a lightweight event row
   keyed by `(contributor_id, created_at[, kind])`; the window check is a `COUNT(... WHERE
   contributor_id = ? AND created_at > now() - W)`. This **avoids pulling the deferred read-path
   Redis forward** (ARCHITECTURE reserves Redis for the ISR cache handler + cached candidate sets,
   not yet introduced). A clean **additive** Drizzle migration adds the table (see *Schema / migration
   note*).

4. **A distinct, non-alarming user-facing limit response** (Decision 3): when the cap is hit, the
   boundary raises a **`RateLimitedError`** — a new error class mirroring `AuthRequiredError`'s shape
   (a distinct `name` + a stable `code`/marker, so the client can detect it past Next.js's
   production message redaction) — and the UI surfaces a clear, calm "you're doing that too fast —
   try again in a moment"-style notice. It is **distinct** from C's login gate (you *are* logged in)
   and from the generic write-error (nothing is broken). The exact copy lives as a **new entry in
   `lib/auth/microcopy.ts`** (UX authors the verbatim string + decides placement). It is
   text-labeled and AA — never color-alone, keyboard-reachable, focus-visible (gold is not a
   functional signal color). A client-safe detector (alongside `isAuthRequired`) lets the existing
   write call-sites branch to this notice and **roll back** any optimistic UI (the D1/D4 posture).

5. **The window resets** (Decision 2): once W has elapsed since the contributor's earlier writes age
   out of the window, that contributor can write again — the cap is a **sliding/fixed window**, not a
   permanent ban. (Dev picks fixed vs. sliding within Decision 2; the product contract is "it resets
   after the window.")

6. **`docs/ARCHITECTURE.md` records the backing decision + the as-built limit** (Decision 1). The
   *Open questions* "Abuse/spam handling" note (currently "*Enforcement* … remains
   Operations'/Development's to build") and *Prototype phase* record: that the rate-limit backing is
   **Postgres (the `write_event` ledger)**, **not** the deferred read-path Redis; the default N/W and
   which actions are limited; that the limit is per-`contributor.id`; that reading is unlimited; and
   the migration name (Docs-as-built — the #45/C/D1/D2/D3/D4 pattern).

---

## Out of scope

Kept out so this run stays one build-loop run and stays independent of D5b/D5c. Each routes to its
run or a deferred lane.

- **The `vetted` review hold + the role model — D5b.** Queuing a freshly added clip for review before
  it shows as fully curated (the `clip.vetted` flag), and any contributor-role / trust-level model
  (e.g. account-age or edit-count gating), are **D5b**, a separate issue. D5a adds **no** review
  state, **no** role column, and **no** trust-tiered limits — the cap is **uniform per identity** in
  D5a (a role-aware limit is a D5b/post-MVP refinement).
- **Moderator removal — D5c.** A moderator removing abusive content is **D5c**. D5a only *blunts the
  rate*; it removes nothing and reviews nothing.
- **Sockpuppet / vote-fraud / brigading heuristics — post-MVP.** Detecting that many *new* accounts
  act in concert, or that one human runs many identities, is explicitly post-MVP (CURATION §7 / VISION
  "possible future directions"). D5a is a **per-single-identity** cap; it does not reason across
  identities, does not score account reputation, and does not special-case self-votes (D4 Decision 3
  stands — any self-vote reconsideration is a later anti-gaming decision, not D5a).
- **Per-IP / anonymous rate-limiting.** Reading is anonymous and **unlimited**; an anonymous *write*
  is already impossible (the auth gate). D5a limits the **authenticated write actor only** — there is
  no per-IP limiter and no anonymous-request throttle in this run (Decision 4).
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge, cached candidate sets).
  **Unchanged; still deferred.** D5a must **not** introduce the read-path Redis, the ISR cache
  handler, or a Redis compose service. If Ops later judges Redis worth introducing for rate-limiting,
  that is a separate owner/infra action (Decision 1 flags it) — **not** part of this build run.
- **Editing/admin of the limit values at runtime.** The N/W defaults are configuration the build sets
  (and ARCHITECTURE records); a runtime admin UI to tune them is out of scope. (Dev may make N/W
  env-overridable for staging tuning — that is fine and not a feature surface.)
- **Per-action analytics on near-limit / throttle rate.** Analytics is deferred (its define-the-metric
  work sits in Product — see *Success metric*). D5a writes the `write_event` ledger but builds **no**
  dashboard or alerting on it.

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Signed in"** = a valid Wikimedia session per C's flow (a resolvable `contributor`); **"signed
out"** = no session. Per the C/D1/D2/D3/D4 pattern, a **live Wikimedia OAuth round-trip cannot run in
CI** — QA verifies the limit at the action with the **session stubbed** (a resolvable `contributor`
injected, the provider call mocked) and the DB via pglite, consistent with how the Wikipedia/YouTube
fetches are mocked. The limit is fully verifiable at the action with a stubbed contributor — no live
round-trip is needed to prove it.

**Normal curation is unaffected**

1. **AC1 — Under-limit writes by a signed-in contributor pass unchanged.** A signed-in contributor
   making writes **at or below** the per-identity cap within the window has **every** write succeed
   exactly as before D5a — the clip/topic/vote row is written, the action returns its normal result,
   and **no** rate-limit rejection is raised. Verified by driving the gated actions up to (and
   including) the Nth write within the window with a stubbed session: all N succeed.

**Over-limit is rejected server-side and writes nothing**

2. **AC2 — Exceeding the per-identity cap is rejected server-side; the write does not happen.** When a
   signed-in contributor exceeds the cap within the window, the (N+1)th gated write is **rejected** by
   the boundary (raises the distinct `RateLimitedError`) **before any persisting write** — **no**
   `clip` / `topic` / `clip_vote` row is created (and no existing row is mutated/deleted) for that
   rejected call. Verified at the action/store (a stubbed session driving N+1 calls), asserting the
   (N+1)th throws the rate-limit rejection **and** the target table's row count is unchanged by it —
   not by the UI hiding a click. This is the load-bearing integrity test.

3. **AC3 — The rejection is the distinct, non-alarming limit signal, not the auth gate and not the
   generic error.** The over-limit rejection is detectably **`RateLimitedError`** (a distinct `name`
   and stable `code`/marker), distinguishable at the call-site from `AuthRequiredError` and from a
   generic `Error`, so the UI can surface the calm "you're doing that too fast — try again in a
   moment"-style notice (a **new** `lib/auth/microcopy.ts` entry) rather than the login gate or the
   generic write-failure notice. The notice is text-labeled and AA (UX builds the exact copy and
   placement; QA/UX confirm it is not color-alone and is keyboard/focus reachable). Verified: the
   thrown error's `name`/`code` is the rate-limit marker (not `AUTH_REQUIRED`), and the client
   detector classifies it as rate-limited.

**The window resets**

4. **AC4 — After the window passes, the contributor can write again.** A contributor who hit the cap
   can make a further gated write **once their earlier writes age out of the window** (W elapsed): the
   later write **succeeds** and writes its row. Verified deterministically by advancing the clock /
   stubbing "now" (or seeding `write_event` rows with old timestamps) so the window has passed, then
   asserting the next write succeeds — the limit is a window, not a permanent block.

**The limit is per-identity**

5. **AC5 — One contributor hitting the cap does not block another.** When contributor A has exceeded
   the cap (A's writes are rejected — AC2), contributor B (a distinct `contributor.id`) making writes
   within their own budget is **unaffected** — B's writes succeed. The window count is scoped to
   `contributor_id`; there is **no** global counter and **no** cross-identity coupling. Verified at the
   action with two distinct stubbed contributors.

**Reading stays anonymous + unlimited**

6. **AC6 — Reads are never limited and never gated; an anonymous visitor reads freely.** The read
   actions (`listTopicsAction`, `getTopicAction`, `listClipsAction`, the public profile reads, the
   public count derivation, etc.) call **no** rate-limit check and write **no** `write_event` row — an
   anonymous (no-session) visitor reads any number of topics/clips/counts with no limit, no login, and
   no per-user work. Verified: the read path issues no `write_event` insert and no window query;
   anonymous reads in a loop are never rejected.

**Backing + build/docs**

7. **AC7 — The backing decision is recorded in `docs/ARCHITECTURE.md`.** ARCHITECTURE's *Open
   questions* "Abuse/spam handling" note + *Prototype phase* record, as built: the rate-limit backing
   is **Postgres (the `write_event` ledger)**, explicitly **not** the deferred read-path Redis (with
   the one-line rationale — Redis stays reserved for the ISR cache handler); the default N/W and the
   limited action set; that the limit is per-`contributor.id`; that reading is unlimited; and the
   migration name. (Docs-as-built — the #45/C/D1/D2/D3/D4 pattern.)

8. **AC8 — `yarn build` / `yarn typecheck` / `yarn test` green; the limit is tested without a live
   provider.** The full check set passes. New tests cover, with the session/provider **stubbed** and
   the DB via pglite (the C/D1/D2/D3/D4 pattern): under-limit writes all succeed (AC1); the (N+1)th is
   rejected and writes nothing (AC2 — the load-bearing test); the rejection is the distinct rate-limit
   error, not the auth error (AC3); the window resets via a clock/timestamp stub (AC4); a second
   contributor is unaffected (AC5); reads are uncounted/unlimited (AC6). A **live OAuth round-trip
   cannot run in CI** — QA stubs the session for every signed-in case (note this for QA: the limit is
   provable at the action with a stubbed contributor).

---

## Decisions (resolving the prompt's four questions; rationale recorded for UX/Dev/Curation/QA/Ops)

### Decision 1 — Backing: **Postgres** — a small `write_event` ledger table. **Confirmed (recommended).** Do NOT pull the deferred read-path Redis forward.

D5a's window counter is **Postgres-backed** — a lightweight `write_event` ledger (see *Schema /
migration note*), with the window check a `COUNT(... WHERE contributor_id = ? AND created_at >
now() - W)`.

- *Why Postgres, not Redis, for the MVP:* ARCHITECTURE reserves **Redis** for the **deferred
  read-path** — the shared ISR `cacheHandler` and cached candidate-suggestion sets — and that service
  is **not yet introduced** (the *Prototype phase* runs Node SSR on the VPS with shared Postgres;
  Redis is "still deferred"). Introducing Redis *just* for the rate limiter would (a) stand up a new
  runtime service (a Redis container in compose, a connection, a secret, an Ops backup/monitoring
  concern) **ahead of** the read-path need that actually justifies it, and (b) couple a security
  control to infra we haven't committed. Postgres is **already** the shared store behind the Server
  Actions seam (#45); a counted ledger is a clean additive table on the exact migration path D4 just
  used. At prototype scale a `COUNT` over a small, indexed, time-bounded slice is trivially cheap and
  trivially correct — and the ledger doubles as the §7 audit trail a future D5b/D5c or Analytics can
  read.
- *§7 says "(Redis-backed)" — is this a contradiction?* No. §7 sets the **posture** ("per-identity
  write limits to blunt spam floods") and parenthetically anticipated Redis as the eventual home —
  written before the prototype's actual infra sequencing landed. D5a is the **enforcement** of the
  posture; the **backing choice** is an architecture call recorded here, and the MVP-correct choice is
  Postgres (no new infra). When Redis lands for the read-path, the limiter **may** migrate to it —
  but that is a future optimization behind the same per-identity-window contract, not a D5a
  requirement. ARCHITECTURE records exactly this (AC7).
- *If Ops/owner judges Redis worth introducing now (flagged):* that is an **Operations/owner infra
  action** — a new service (Redis in compose + secret + backup/monitoring posture), **out of scope for
  this build run**, and it would change the *Schema / migration note* (no `write_event` table needed
  if a Redis counter is used instead). The spec's recommendation, and the build-loop default, is
  **Postgres**; the Redis path is noted only so the owner can override before Dev starts.

### Decision 2 — Limited set + defaults + ordering. **Confirmed.**

**Which writes are limited:** the `requireContributor()`-gated **writes** —
`addClipAction` (and its prerequisite `upsertTopicAction`), `toggleUpvoteAction`, and
`recordDismissalAction`. **Reads are never limited.** Edit/delete of one's own clip
(`updateClipAction` / `deleteClipAction`) are gated writes too and **count** toward the budget for
consistency (they are writes, and an edit-flood is as unwelcome as an add-flood) — but they are not
the spam-flood vector the defaults are tuned against; Dev includes them in the counted set unless that
proves awkward, in which case the **minimum** required set is add + upsert + upvote + dismiss.

**Shared vs. separate budgets — one shared per-identity budget.** All counted writes draw from a
**single per-identity window budget** (not a separate budget per action). Rationale: a shared budget
is the simplest correct blunt instrument (one ledger, one count, one limit), it matches §7's framing
("per-identity write limits," singular), and a flood is a flood regardless of which action carries it.
A per-action budget is a refinement that buys little here and adds surface; if a later run finds add
and upvote need different ceilings (upvotes are higher-frequency by nature), that is a D5b/post-MVP
tuning, expressible by adding a `kind` discriminator to the count (the ledger carries `kind` precisely
so that refinement needs **no** schema change). **Recommendation:** ship one shared budget; record
`kind` on the ledger so a future split is free.

**The defaults (the testable starting values — Product owns the numbers):**

- **N = 60 writes per W = 60 seconds** (a rolling/fixed 1-minute window), as the **default shared
  per-identity cap.**
- *Why these values:* the design requirement is **high enough that a human curating normally never
  trips it, low enough to blunt a script.** A human curator reads a clip, writes/weighs a context
  note, vouches — that is **seconds-to-minutes per write**; even rapid upvoting while skimming a Topic
  page is a handful per minute, nowhere near 60/min sustained. 60 writes in a single minute is already
  ~1/second sustained — unambiguously non-human at the *content-write* level — yet leaves enormous
  headroom for the most active real session (clicking through and upvoting a dozen clips, adding a few,
  dismissing a few). A flood script, by contrast, trips it almost immediately. The values are
  **defaults, not law** — Dev may make N/W env-overridable for staging tuning (Out of scope: no
  runtime admin UI), and a later run can adjust them; ARCHITECTURE records the shipped values (AC7).
- *Dismissals counting:* yes (see above) — a dismiss is a gated write and a dismiss-flood is
  undesirable; counting it keeps the budget honest (one identity's total write rate) without a special
  case. It is **not** a high-value spam vector, so it does not need its own ceiling.

**Ordering (the contract):** `requireContributor()` **FIRST** (reject anonymous — the C/D1 gate),
**then** the per-identity window check (reject over-limit — write nothing), **then** the existing
validation + DB write. So an over-limit call writes nothing, and an anonymous call is still rejected by
the auth gate before the limit even runs (the limit only ever sees an authenticated identity —
Decision 4). Whether a *rejected* attempt records a `write_event` row is **Dev's call** (counting
attempts makes a sustained flood self-throttling and is the simpler implementation; counting only
successes is also acceptable) — the product contract is only that the **rejected write's target row is
never written** (AC2).

### Decision 3 — User-facing response: a distinct, non-alarming "too fast" notice; the write does not happen. **Confirmed.**

The boundary raises a **distinct `RateLimitedError`** (mirroring `AuthRequiredError`'s shape: a
distinct `name` + a stable `code`/marker string, so the client can detect it **past Next.js's
production Server-Action message redaction** — the channel `auth-error.ts` documents). A client-safe
detector (alongside `isAuthRequired` in `lib/auth/auth-error.ts`, importing no server-only code) lets
each write call-site branch to the limit notice and **roll back** any optimistic UI (the D1/D4
rollback posture — e.g. an optimistic upvote reverts).

- *Distinct from the login gate (C) and the generic error:* the user **is** logged in (so the
  "Log in with Wikipedia" gate is wrong and confusing), and **nothing is broken** (so the generic
  "couldn't save — try again" is wrong and alarming). The correct message is calm and specific:
  *you're doing that too fast — try again in a moment.* It tells the (almost always honest) user the
  benign truth and what to do (wait), without implying they did something wrong or that the system
  failed.
- *Copy + placement are UX's:* the exact verbatim string is a **new entry in
  `lib/auth/microcopy.ts`** (the single source of write-boundary copy), authored by UX — Product fixes
  the *intent and tone* ("too fast, momentary, non-alarming, not your fault, just wait"), not the
  words. UX decides placement (inline near the activated control vs. a transient notice) consistent
  with the existing gate/error treatments.
- *Accessibility (baseline):* text-labeled, AA contrast, keyboard-reachable, focus-visible; the
  signal is **never color-alone** and **gold is not used as a functional signal** (CLAUDE.md /
  CURATION §7 accessibility baseline). The notice does not steal focus abusively but is announced to
  assistive tech (UX picks the exact `aria-live`/role, consistent with the expired-session notice).

### Decision 4 — Scope of the limit: **per-identity (per `contributor.id`)**, not global, not per-IP. **Confirmed.**

The window count is keyed by the resolved **`contributor.id`** (from `requireContributor()`), so each
identity has its own budget (AC5).

- *Why per-identity, not global:* a global cap would let one flood-script throttle **every** honest
  curator at once (a trivial denial-of-curation) — the opposite of the goal. §7's subject is the
  **identity** precisely because login-gating made the write actor accountable and individually
  capped.
- *Why not per-IP:* reading is anonymous and unlimited, and an anonymous **write is already
  impossible** (the auth gate stops it before the limit could ever run) — so there is no anonymous
  write actor to rate-limit by IP. The only write actor is the authenticated `contributor.id`, which
  is a **better** subject than IP (it is the accountable identity; it survives IP changes and is not
  confounded by shared NAT/VPN egress). Per-IP throttling of anonymous *requests* (read floods,
  scraping) is an Ops/edge concern (Cloudflare / Caddy), not this app-level per-contributor limit —
  and is out of scope here.
- *The limit only ever applies post-auth:* because the gate runs first, the limiter never sees an
  anonymous request; it is, by construction, a control on the authenticated write actor only — which
  is exactly §7's "natural rate-limit subject."

---

## Schema / migration note

**This IS a stateful change — it adds a table and needs a migration. Operations stages it.** D5a
introduces a **`write_event`** ledger table (Decision 1) — the Postgres backing for the per-identity
window count. Suggested shape (Dev's call on exact names/types, recorded in ARCHITECTURE per AC7):

- `id` (serial PK),
- `contributorId` → `contributor.id` (FK, NOT NULL, `onDelete: "cascade"` — a removed contributor's
  events go with them; the limit only ever counts a live identity's recent writes),
- `kind` (text — e.g. `add` | `upsert` | `upvote` | `dismiss` | `edit` | `delete`; carried so a future
  per-action split needs **no** schema change — Decision 2),
- `createdAt` (timestamp, `defaultNow`) — the window pivot,
- an **index on `(contributor_id, created_at)`** — supports the hot `COUNT(... WHERE contributor_id =
  ? AND created_at > ?)` window query.

This is a clean **additive, non-destructive** Drizzle migration on the C/D1/D4 schema — a new table,
**no** column drop, **no** type change, **no** data migration. It applies on the existing migration
path (`docker compose ... up -d` runs migrations, same as D4's `drizzle/0004_*`). Because the window
is short and rows age out of relevance fast, the ledger is **append-mostly and self-bounding** for the
window check; a periodic prune of old rows (or a retention note) is a reasonable Ops follow-up but is
**not** required for D5a correctness (the `created_at > now() - W` filter ignores old rows
regardless). Flag any prune/retention as a small Ops follow-up, not a blocker.

**Operations:** this run **does** add a migration (like D4). No new infra and **no** new secret — the
backing is Postgres, **not** Redis (Decision 1; do not stand up a Redis service for this). The
`write_event` table must apply cleanly on deploy before the merge is live; same migration path as
D4/C. Flag it as the stateful step. (If the owner overrides Decision 1 to Redis, this note is void and
it becomes an infra change instead — that override is an owner/Ops call before Dev starts.)

---

## Success metric

D5a has no analytics backend (Analytics is deferred; its define-the-metric work sits in Product).
Success is the **per-identity write rate-limit working end-to-end**, verified at QA/UX review against
the ACs:

- **Primary (the flood is blunted, the honest curator is untouched — the binary check):** A signed-in
  contributor exceeding the per-identity cap within the window is **rejected server-side and the write
  does not happen** (no clip/topic/vote row — AC2), with a clear, non-alarming message (AC3); while a
  contributor curating at any human rate has **every** write succeed unaffected (AC1). Today this is
  zero — an authenticated identity can write without bound. The success condition is: the (N+1)th
  over-limit write is stopped and writes nothing, **and** normal curation never trips the limit.
- **Secondary (correct scoping, §7 implemented):** The limit is **per-`contributor.id`** — one
  identity hitting the cap does not block another (AC5) — and **reading stays anonymous + unlimited**
  (AC6), implementing CURATION §7's "contribution is limited; reading is anonymous." The window
  **resets** after W (AC4): the cap is a momentary brake, not a ban.
- **Foundational (right backing, recorded, no infra creep):** The limit is **Postgres-backed** (the
  `write_event` ledger), the **deferred read-path Redis is not pulled forward** (Decision 1), and the
  backing + defaults + scope are **recorded in ARCHITECTURE** (AC7); the integrity test (over-limit
  writes nothing) is a **server-side** test at the action, not a UI hide (AC2/AC8).

A future Analytics role would instrument, off the same `write_event` ledger, the **near-limit rate**
(how often real sessions approach the cap — the signal that N/W needs tuning) and the **throttle
rate** (over-limit rejections per identity — the spam signal). The metric to define when Analytics
splits out: *what fraction of honest sessions ever come within X% of the cap* (should be ~0 — if it
isn't, the limit is too tight) and *the over-limit rejection rate* (the blunted-flood signal). For
D5a the success check is the manual + tested end-to-end above (over-limit rejected and writes nothing;
under-limit unaffected; window resets; per-identity; reads unlimited; backing recorded), **not** a
metric pipeline.

---

## Hand-off

- **UX:** produce the buildable copy/placement/AA spec for the **limit notice** on top of the
  committed Topic-page design and the existing write call-sites (Promote/Add in `TopicView`, the
  upvote control on `ClipCard`/`GeneralStrip`, dismiss). What D5a needs from UX, grounded in the
  almost-always-honest user who briefly went too fast:
  - **The verbatim "too fast — try again in a moment" string** (a **new** `lib/auth/microcopy.ts`
    entry), in Product's fixed tone (calm, specific, not-your-fault, momentary), **distinct** from C's
    login gate and from the generic write-error notice (AC3).
  - **Placement + treatment** consistent with the existing gate/expired-session notices: inline near
    the activated control vs. a transient notice; the optimistic-write **rollback** treatment (the
    D1/D4 `runDismiss` / optimistic-upvote pattern — on a rate-limit rejection, revert the optimistic
    UI and show the notice). Decide the `aria-live`/role so it is announced (AA).
  - **AA / Indigo Press:** text-labeled, AA contrast, keyboard-reachable, focus-visible; never
    color-alone; gold is not a functional signal color.
  - Evaluate the built UI against AC1 (normal use shows nothing), AC3 (the distinct calm notice on
    over-limit), and AC6 (reading is unaffected).

- **Development:** build in-scope items 1–6 against AC1–AC8 — add the **`write_event`** ledger table +
  the `(contributor_id, created_at)` index as a clean additive Drizzle migration (Decision 1 /
  *Schema note*); add a **per-identity window check** wired into the gated content writes in
  `lib/server/actions.ts` (`requireContributor()` FIRST → the window `COUNT` check → reject with a new
  **`RateLimitedError`** if over-cap, writing nothing → else the existing validation + write +
  record the event), applied to `addClipAction` / `upsertTopicAction` / `toggleUpvoteAction` /
  `recordDismissalAction` (+ edit/delete if clean), drawing from **one shared per-identity budget**
  with **`kind`** on the ledger so a future split is free (Decision 2); use the **default N=60 / W=60s**
  (env-overridable is fine; no runtime admin UI); raise the distinct `RateLimitedError` (mirror
  `AuthRequiredError`: distinct `name` + stable `code`/marker) and add a **client-safe detector**
  beside `isAuthRequired` in `lib/auth/auth-error.ts`; wire each write call-site to branch to the
  limit notice (a **new** `lib/auth/microcopy.ts` entry — UX authors the string) and **roll back**
  optimistic UI (the D1/D4 posture). Do **not** limit reads, do **not** add a global or per-IP limiter
  (Decision 4), do **not** introduce the read-path Redis / ISR cacheHandler / a Redis service
  (Decision 1), do **not** build the vetted hold (D5b) or moderator removal (D5c). Add the AC8 tests
  (session/provider stubbed, pglite DB; **the over-limit-writes-nothing test is the load-bearing
  integrity test**, the window-reset test uses a clock/timestamp stub, the per-identity test uses two
  stubbed contributors). Record the **Postgres backing** + the default N/W + the limited set + the
  per-identity scope + the migration name in ARCHITECTURE (AC7). Hand to QA & Review.

- **Curation/Editorial:** D5a is the **enforcement** of §7's already-set rate-limit posture
  ("per-identity write limits to blunt spam floods; contribution is limited, reading is anonymous").
  No editorial change is requested — a hand-shake, not a hand-off. Flag for Curation only if the
  limit-notice *tone/wording* needs §7-consistency sign-off, or if the "dismissals count toward the
  budget" call (Decision 2) reads as a curation-policy question. The abuse/anti-gaming posture beyond
  a single-identity cap (sockpuppets, vote-fraud) is explicitly **post-MVP**, and the `vetted` hold +
  role model is **D5b**.

- **QA & Review:** verify AC1–AC8 with fresh, non-author eyes, plus the standard security pass. The
  **load-bearing check:** the limit is **server-side** — the (N+1)th over-limit gated write is
  rejected **and writes nothing** (no clip/topic/vote row), tested at the action/store with a stubbed
  session (not the UI hiding a click) — AC2. Also confirm: under-limit writes all succeed (AC1); the
  rejection is the **distinct** rate-limit error, not `AuthRequiredError` and not a generic error
  (AC3); the window **resets** via a clock/timestamp stub (AC4); a **second contributor** is
  unaffected (AC5); **reads** call no limit check, write no `write_event`, and are never rejected
  (AC6); ARCHITECTURE records the Postgres backing + defaults + scope (AC7). A **live OAuth round-trip
  cannot run in CI** — stub the session for every signed-in case; the limit is fully provable at the
  action with a stubbed contributor.

- **Operations:** **this run adds a migration** (like D4): the new `write_event` table must apply
  cleanly on deploy (same Drizzle migration path as D4's `drizzle/0004_*`). **No new infra and no new
  secret** — the backing is **Postgres, not Redis** (Decision 1; do **not** stand up a Redis service
  for this). A periodic prune / retention policy for old `write_event` rows is a reasonable **small
  follow-up** (not a D5a blocker — the window query ignores old rows regardless). Stage the migration
  before the merge is live (the *Schema / migration note* flags it as the stateful step). If the owner
  overrides Decision 1 to a Redis-backed limiter, that is the only path that turns this into an infra
  change (a new service + secret) — an owner/Ops call to make **before** Dev starts.
