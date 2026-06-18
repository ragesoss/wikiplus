# Spec: The `vetted` review-hold workflow + the minimal moderator/reviewer role model (milestone D5b)

- **Issue:** [#58](https://github.com/ragesoss/wikiplus/issues/58) — milestone **D**, run **D5b**
  (second of three split from #56: D5a rate-limit shipped / **D5b** vetted-hold + role model / D5c
  moderator removal) · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the **held-clip** rendering — a third clip-state distinct from
  fully-curated and from an unvetted candidate, echoing §6's "not-vouched-for" visual language; the
  reviewer-only **hold** and **review/approve** affordances; AA + Indigo Press), Development (two
  additive migrations — a **review-state column on `clip`** and a **role field on `contributor`** —
  plus two role-gated Server Actions and the held-state riding the clip read), Curation/Editorial
  (D5b is the **enforcement** of §7's already-set review-hold posture + §6's unvetted visual
  language — a hand-shake, not a hand-off; Curation confirms what "held" reads as and that it is
  distinct from a candidate) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer); D5 = the §7 moderation enforcement layer.
- **Builds on:**
  - **C** (`docs/specs/wikimedia-oauth.md`) — the real `contributor` identity and the
    `requireContributor()`-gated write boundary. The reviewer/moderator is a `contributor`; the
    role-gate runs **after** the auth gate, so it only ever sees an authenticated identity.
  - **D1** (`docs/specs/curate-add-persistence.md`) — **Decision D1-2: a freshly added clip publishes
    immediately**; the hold is an *available action*, not auto-on. D5b preserves D1-2 (the new-add
    default stays **published**). D1 also notes "the data model already carries a `vetted`-style flag
    the D5 hold can switch on" — **this run discovers that flag does not actually exist yet** and adds
    it (see *Grounding correction* + *Schema note*).
  - **D2** (`docs/specs/clip-edit-delete.md`) — the **ownership-gate pattern** (`requireContributor()`
    FIRST → load the clip → server-side, id-based check → write; reject otherwise; the affordance
    mirrors but never replaces the server gate). D5b's **reviewer-gate** is the same shape, gating on
    a **role** rather than ownership. D2 also fixed that the held/`vetted` workflow and any role beyond
    "owner vs. not owner" are **D5**, not D2.
  - **D5a** (`docs/specs/write-rate-limit.md`) — the just-shipped `RateLimitedError` + the
    **gate→limit→write** contract on every counted gated write, and the additive-migration pattern
    (`drizzle/0005_*`, the `write_event` ledger). D5b's hold/review actions are gated writes and slot
    into the same `requireContributor()` → rate-limit → write order, adding a **role check** between
    the gate and the write.
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§7** — the **posture is already set**: "a light `vetted` hold is
    available to queue a freshly added clip for review before it shows as fully curated"; "contribution
    is gated by login; reading is anonymous." D5b is the **enforcement** of that posture — it does not
    re-decide it. (§7's parenthetical "the `clip.vetted` flag already exists in the data model" is
    **factually stale** — see *Grounding correction*.)
  - `docs/CURATION_STANDARD.md` **§6** — the **unvetted-candidate rule**: a candidate reads as visibly
    un-vouched-for (no chips, no context note, "no context yet — a human hasn't reviewed this" once per
    context). A held clip **echoes this "not-vouched-for / not yet fully curated" visual language**,
    but is **not** a candidate (it has a note + chips + a real curator — it is a curated clip awaiting
    review). The two not-fully-curated states must be **distinguishable** (Decision 3b).
  - `docs/ARCHITECTURE.md` — *Guiding principle: the read path is the scale lever*; *Data model* (the
    `clip` + `contributor` rows; the **stale** `vetted` note at lines ~139–151); *Boundary surface*
    (the gate pattern); *Open questions* → Abuse/spam (the resolved-policy / "**the `clip.vetted`
    review hold + the role model is D5b**" pending note); *Prototype phase* → D5a. D5b records the new
    column + the role model + how a moderator is granted here.
  - The code (read, not paraphrased):
    - `lib/db/schema.ts` — **the `clip` table has NO review-state column today** (no `vetted`, no
      `review_state`); the `contributor` table has **NO role / moderator field**. D5b **adds both**
      via additive migrations. The additive-table/column conventions to follow: `boolean(...).notNull().default(...)`,
      `index(...)`, `defaultNow()` timestamps (as `clip_vote` / `write_event` did).
    - `lib/data/types.ts` — `vetted: false` exists **only** as the discriminant on the *`Candidate`*
      interface (an auto-suggested, unvetted suggestion that is **not a clip row**). It is **not** a
      field on the `Clip` interface. D5b adds a review-state to the **`Clip`** type + the `clip` row;
      this is distinct from the `Candidate.vetted` discriminant and must not be conflated with it.
    - `lib/server/actions.ts` — `requireContributor()` then the D5a rate-limit then the write; the
      D2 owner-gate pattern (`clipOwnership` load → id compare → reject). D5b adds the role-gate
      between gate/limit and write.
    - `lib/auth/require-session.ts` — `requireContributor()` resolves `{ contributorId, username }`
      from the JWT (no per-read DB hit). D5b's role check resolves the role **server-side** for the
      acting identity (the gate's authority — see Decision 2).
    - `lib/data/store.ts` / `lib/data/index.ts` — the `DataStore` seam (`listClips`, the gated write
      actions); the held-state rides `listClips` (it is a property of the clip, public/derivable —
      Decision 4).
    - `components/topic/ClipCard.tsx` (the fully-curated card — chips + note + provenance footer +
      the D2 owner-only manage row), `components/topic/GeneralStrip.tsx` (the General band tile),
      `components/topic/CandidateBits.tsx` (the **unvetted-candidate** visual language — dashed
      container, "Suggested · uncurated" once-per-context header, no chips/note) — the held state
      borrows §6's not-vouched-for language without becoming a candidate.
- **Hand-off:** UX (the buildable flow/design spec for the held-clip rendering + the reviewer
  affordances), then Development.

---

## Grounding correction (read before scoping — it changes the work)

The issue, §7, and D1 all speak as if a `vetted` flag already exists on the clip. **It does not.**
Confirmed by reading `lib/db/schema.ts` and `lib/data/types.ts`:

- **There is no review-state column on the `clip` table** — no `vetted`, no `review_state`. The `clip`
  row carries no held/published distinction at all today.
- **`vetted` exists only as `vetted: false` on the `Candidate` TS interface** (`lib/data/types.ts`) —
  the discriminant that marks an *auto-suggested suggestion that is not a clip row*. That is a
  different concept (a candidate vs. a clip) and is **not** the clip review-state this run needs.
- **The `contributor` table has no role / moderator field.**
- `docs/ARCHITECTURE.md` (lines ~139–151) *describes* a `vetted` boolean on `clip` as if present
  ("`vetted` remains so we can hold a freshly added clip"); that note is **anticipatory, not
  as-built**. D5b makes it real **and corrects that note** to reflect what actually ships (AC8).

**Consequence:** D5b is **not** "flip an existing flag." It is an **additive schema change** — it adds
a review-state column to `clip` *and* a role field to `contributor`, plus the two role-gated actions
and the held rendering. This is a **stateful** run with a migration (see *Schema / migration note*).

---

## Problem & user value

The §7 moderation layer is being built in three runs. D5a shipped the **rate limit** (blunt the
*speed* of writes). But §7 names a second, complementary tool: a **light review-hold** — the ability
to **queue a freshly added clip for review before it shows as fully curated**, so a clip a contributor
is unsure of (or that a reviewer wants to look at before it carries the site's full vouch) can be
shown as *not yet fully curated* until a reviewer flips it live. Today there is **no such state**: a
clip is either a fully-curated, fully-vouched clip the moment it is written (D1-2), or it does not
exist. There is no "in review, not yet vouched-for" middle state, and **no role that can perform a
review** — `contributor` has no moderator/reviewer concept at all.

**The user value is calibrated trust, not gatekeeping.** wiki+'s whole premise is that a Topic page is
worth reading because real people vouched for each clip with care, *and a reader can weigh each clip*
(VISION: "a reader leaves with 2–5 clips they're glad they watched **and** understands how to weigh
each"). A review-hold extends that honesty to the *act of curation itself*: a clip can be visibly
marked "a human added this, but it has not yet passed review" — the same honesty §6 already demands for
auto-suggested candidates, applied one rung up. It is the lightweight, MVP-appropriate version of the
editorial review Wikipedia applies to contributions; reputation/role tiers scale later (VISION
"possible future directions").

**Who acts and why.**
- A **reviewer/moderator** (a `contributor` granted the role out-of-band — Decision 2) can **hold** a
  clip (move a published clip into review) and **review/approve** a held clip (flip it back to
  published/live). Reviewing is **the first privileged action in the product** — so D5b also
  establishes the **minimal role model** that **D5c (moderator removal) reuses**.
- A **clip's own curator** may **hold their own clip** (Decision 3: a curator can voluntarily pull
  their own vouch into review — it parallels D2's "I can revise/retract my own vouch") but **cannot
  approve** anything (approval is the privileged act; a curator approving their own hold would defeat
  the purpose). Approval is **reviewer/moderator only**.
- A **reader** is unaffected and reading stays anonymous: a held clip is shown to everyone as
  *not yet fully curated* (Decision 3b — shown-but-marked, not hidden), with no per-viewer work and no
  login required to read.

This is milestone **D5b**: **the `vetted` review-hold workflow + the minimal moderator/reviewer role
model.** It is *a review-state column on `clip` + a role field on `contributor` + a `hold` action + a
`review/approve` action (both auth- and role-gated server-side) + the held-clip rendering*. It is
**not** the rate limit (D5a, shipped), **not** moderator *removal* of abusive clips (D5c — reuses this
role model), **not** an in-app admin UI to grant roles (out-of-band — an owner/ops action), **not**
appeals, and **not** auto-hold heuristics / trust tiers (post-MVP).

---

## Scope (what D5b does)

1. **A review-state on the `clip` table (additive migration).** Add a review-state to `clip` — it does
   **not** exist today (Grounding correction). **Shape: a `vetted boolean NOT NULL DEFAULT true`**
   (Decision 1: a held clip is `vetted = false`; a published/live clip is `vetted = true`). The name
   `vetted` is chosen so §7 / ARCHITECTURE / D1's existing language reads true once it lands, and so
   D5c's removal work and any future Analytics read a single, obvious flag. (Dev may instead use a small
   `review_state` enum `published | held` if it reads cleaner end-to-end — the *captured fact* is fixed:
   one of two states per clip, `held` ≙ `vetted=false`; the column shape is Dev's call recorded in
   ARCHITECTURE per AC8. The spec uses **`vetted`** throughout.)

2. **New adds publish-by-default; existing/seeded clips backfill to published (Decision 1).** A clip
   created via Promote / Add-by-link is `vetted = true` (published) **by default** — D1-2 is preserved;
   the hold is an *available action a reviewer or the curator takes*, not auto-on. All
   existing/seeded/migrated clips backfill to `vetted = true` (the column default + a non-null backfill
   on the migration), so **nothing that is live today goes dark** when the column lands.

3. **The minimal moderator/reviewer role model on `contributor` (additive migration — the shared
   prerequisite for D5c).** `contributor` has no role field. Add the minimal model: **a role
   designation on `contributor`** set **out-of-band** (Decision 2). **Recommended shape: an
   `isModerator boolean NOT NULL DEFAULT false`** (or a `role text` enum `contributor | moderator` — the
   captured fact is "this contributor is/ isn't a moderator/reviewer"; shape is Dev's call, recorded in
   ARCHITECTURE per AC8). There is **no in-app admin UI** to grant it (out of scope) — it is set
   out-of-band (a manual DB flag, or an env/seed allowlist resolved at find-or-create — Decision 2). The
   role model is deliberately a **single binary role** (moderator/reviewer): D5b needs exactly one
   privileged capability (review), and D5c (removal) reuses the same role — no tier ladder in the MVP.

4. **A `hold` action — put a clip into review (auth- + role-gated server-side).** A new gated Server
   Action that, after `requireContributor()` (the auth gate) and the D5a rate-limit, loads the clip and
   sets `vetted = false` **only if** the acting contributor is **a moderator OR the clip's own curator**
   (Decision 3) — otherwise it is **rejected server-side** and changes nothing. Same gate→(limit)→
   role/ownership-check→write order as D2/D5a.

5. **A `review/approve` action — flip a held clip back to live (auth- + role-gated server-side,
   moderator-only).** A new gated Server Action that, after `requireContributor()` + the D5a rate-limit,
   sets `vetted = true` on a held clip **only if** the acting contributor **is a moderator** (Decision 3
   — approval is the privileged act; the clip's own curator may **not** self-approve). A non-moderator
   (including the clip's curator, including anonymous) call is **rejected server-side** and changes
   nothing. **This rejection — at the action, on the role, not the button — is the load-bearing
   security behavior of D5b** (AC4).

6. **A held clip renders as not-yet-fully-curated (echo §6's unvetted visual language; a third,
   distinct clip-state).** A held clip is shown to readers as *in review / not yet fully curated*
   (Decision 3b — **shown-but-marked**, visible to anonymous readers, **not** hidden). It is
   **text-labeled** (a word carries the meaning — never color-alone), AA, and **visually distinct from
   both**: (a) a fully-curated clip (which carries the site's full vouch) and (b) an auto-suggested
   candidate (which has no note, no chips, no curator — §6). A held clip **keeps** its context note,
   chips, and curator attribution (it is a real curated clip, authored by a real curator, simply *not
   yet approved*) — it borrows §6's "not vouched-for" *language/marking*, not §6's *content-stripping*.
   (Exact treatment is UX's, on top of §6's vocabulary; the *requirement that the three states are
   mutually distinguishable* is the standard.)

7. **The held-state rides the clip read; no per-user work on the cached read path (Decision 4).** The
   held/published state is a property of the **clip** (not of the viewer), so it is carried on the clip
   shape and rides the existing `listClips` read — every viewer sees the same held marking, derived from
   the clip row. D5b adds **no** per-user/per-auth query to the cached topic read path (the gate runs
   only on the two write actions; the reviewer affordances are computed in the already-authenticated
   client session, mirroring D2's owner-affordance pattern).

8. **Reviewer-only affordances on the Topic page (convenience layer, not the security control).** The
   Topic page shows a **Hold** affordance (to a moderator on any clip, and to a clip's own curator on
   their own clip) and a **Review/Approve** affordance (to a moderator on a held clip), reusing the D2
   manage-row pattern. A contributor with no role, and an anonymous viewer, see **no** review
   affordances. (The affordance mirrors the server role-gate; **AC4/AC5 are the security control**, the
   affordance is not.)

9. **`docs/ARCHITECTURE.md` records the new column, the role model, and how a moderator is granted.**
   The *Data model* note for `clip` is **corrected** (the `vetted` flag is now a real, as-built column,
   not anticipatory) and the `contributor` note gains the role field; the *Open questions* → Abuse/spam
   "the `clip.vetted` review hold + the role model is **D5b**" pending note is updated to as-built; and
   it records **who may hold / who may approve** and **how a contributor becomes a reviewer/moderator
   (out-of-band — the mechanism Dev chose)**, including the explicit note that **granting a live
   moderator is a separate owner/ops action** (the mechanism ships; the feature is green without a live
   moderator granted — see *Schema / migration note* + *Decisions*).

---

## Out of scope

Kept out so this run stays one build-loop run and stays correctly sequenced within D5. Each routes to
its run or a deferred lane.

- **Per-identity write rate-limiting — D5a (shipped).** The speed cap on writes is already enforced
  (`write_event` ledger, `RateLimitedError`). D5b's two new actions **slot into** that gate→limit→write
  contract (they are counted gated writes) but D5b does **not** re-spec or change the rate limit.
- **Moderator *removal* of abusive clips — D5c.** A moderator **removing** another contributor's clip
  (CURATION §7 abuse removal — distinct from a held clip becoming live) is **D5c**. D5c **reuses this
  run's role model** (that reuse is exactly why D5b establishes it). D5b's reviewer can **hold** and
  **approve** — it cannot **delete** anyone's clip (that stays D2's owner-only delete + D5c's
  moderator removal).
- **An in-app admin UI to grant / revoke roles — out-of-band (not built).** There is **no** in-product
  surface to make someone a moderator in D5b. The role is set out-of-band (Decision 2); building a
  grant/revoke admin screen is a later run. **Granting a live moderator on the box is an owner/ops
  follow-up action** (the mechanism ships green without one — the gate simply rejects everyone until a
  moderator exists; the workflow is fully testable with a **stubbed moderator session**).
- **Appeals / a contributor contesting a hold or a removal.** No appeal workflow, no notification, no
  reviewer queue/inbox UI. A held clip is marked held; a moderator can approve it. A structured
  review-queue surface, notifications, and appeals are post-MVP.
- **Auto-hold heuristics / trust tiers / reputation-gated limits — post-MVP.** D5b does **not**
  auto-hold new clips by account age, edit count, or any heuristic (D1-2 stands: new adds publish). It
  does **not** introduce trust levels or a role-aware *rate* limit (D5a's cap stays uniform per
  identity). The role is a single binary moderator/reviewer designation; a tier ladder is post-MVP
  (VISION "possible future directions").
- **Editorial-quality enforcement of §1.** D5b adds the *mechanism* to hold/review; it does **not**
  encode rules for *when* a note must be held, nor auto-judge note quality. A human reviewer decides.
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge, cached candidate sets).
  **Unchanged; still deferred.** D5b must **not** introduce the read-path Redis or the ISR cache
  handler. The held-state rides the existing clip read; D5b adds **no** per-user work to it (Decision
  4).

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Reviewer/moderator"** = a signed-in `contributor` whose role designation marks them a
moderator/reviewer (Decision 2). **"Curator"** = the clip's own contributor (`clip.curatorId` ==
session contributor id — the D2 owner). **"Signed in"** = a valid Wikimedia session per C's flow;
**"signed out"** = no session. Per the C/D1/D2/D5a pattern, a **live Wikimedia OAuth round-trip cannot
run in CI** — QA verifies the gated/role-gated behavior with the **session stubbed** (a resolvable
`contributor` injected — with or without the moderator role — and the provider call mocked) and the DB
via pglite, consistent with how the Wikipedia/YouTube fetches are mocked. The whole workflow is provable
at the action with a **stubbed moderator session**; no live moderator-granting round-trip is needed
(this is why the feature ships green without a live moderator on the box — see *Schema note*).

**A clip can be held and renders as a distinct, not-yet-fully-curated state**

1. **AC1 — A clip can be put on hold, and a held clip renders as "not yet fully curated."** When a hold
   is performed (by a moderator on any clip, or by the clip's own curator on their own clip — AC3a), the
   target clip's review-state becomes `vetted = false` (held), persisted, and on the Topic page (and on
   a fresh `listClips`) it renders as **not yet fully curated / in review** — a **text-labeled**,
   AA-contrast state (the word carries the meaning, never color-alone), echoing §6's "not-vouched-for"
   language. The held marking is shown to **anonymous** readers too (Decision 3b — shown-but-marked, not
   hidden).

2. **AC2 — A held clip is visually distinct from BOTH a fully-curated clip AND an unvetted candidate.**
   The held state is a **third** clip-state: it is **not** rendered identically to a fully-curated clip
   (which carries the full site vouch and **no** "in review" marking), and it is **not** rendered as an
   auto-suggested candidate (a held clip **keeps** its context note, stance/accuracy chips, and curator
   attribution — it is a real curated clip awaiting review, where a candidate has none of these — §6).
   A reader can tell all three apart from the **text/marking**, not color alone. (UX builds the exact
   treatment on §6's vocabulary; QA/UX confirm the three-way distinction and AA.)

**A reviewer flips a held clip live**

3. **AC3 — A reviewer/moderator flips a held clip back to live, and it shows as fully curated again
   without a manual reload.** When a **moderator** approves a held clip, the review/approve action sets
   `vetted = true` (published), and in the same session the clip re-renders as a **fully-curated** clip
   (its "in review" marking gone, full vouch restored) **without a manual reload**, and the change
   survives a reload (a fresh `listClips`). **AC3a — a curator may hold their own clip; a curator may
   NOT approve.** A clip's own curator can perform the **hold** on their own clip (it goes `vetted =
   false` — AC1), but a curator's **approve** call is **rejected** (approval is moderator-only —
   Decision 3); verified at the action.

**The role-gate is server-side (the load-bearing security test)**

4. **AC4 — A non-reviewer's review/approve call is rejected server-side.** A signed-in contributor who
   is **not** a moderator (including the clip's **own curator**, per AC3a) who calls the
   `review/approve` action is **rejected server-side** — the clip's review-state is **unchanged** and
   the action raises/returns an authorization error. This is verified by a test that invokes the action
   directly with a **stubbed non-moderator session** (and a separate one with the stubbed *curator*
   session), **not** by the absence of a button. **This is the load-bearing role-gate test:** the gate
   is at the **action**, on the **role resolved server-side**, never trusting a client "isModerator"
   flag and never a hidden button.

5. **AC5 — A non-authorized hold call, and a logged-out hold/review call, are rejected server-side.** A
   signed-in contributor who is **neither a moderator nor the clip's curator** who calls the `hold`
   action is **rejected server-side** (the clip stays published, an authorization error is raised). With
   **no** session, **both** the hold and the review/approve actions reject via the `requireContributor()`
   gate (as C/D1/D2/D5a writes do) and change nothing — the auth gate runs **first**, then the rate
   limit, then the role/ownership check (gate→limit→role→write). Verified by direct action invocations
   (anonymous; and a non-moderator non-curator), not by hidden buttons.

**D1's immediate-publish default is preserved**

6. **AC6 — New adds publish by default; the column lands without taking live clips dark.** A clip
   created via Promote / Add-by-link is `vetted = true` (published) **by default** — D1-2 is preserved
   (the hold is an available action, never auto-on) — and is **not** parked in review on creation. All
   existing/seeded clips backfill to `vetted = true` when the column lands, so **no clip that is live
   today goes dark** on migration. Verified: a freshly added clip is `vetted = true` and renders fully
   curated (not held); a pre-existing/seeded clip is `vetted = true` after the migration.

**Read-path discipline**

7. **AC7 — The held-state rides the clip read; no per-user work on the cached read path.** The
   held/published state is read **from the clip** (it is a property of the clip, public/derivable —
   same for every viewer), carried on `listClips` / the client `Clip` shape; the cached topic read path
   issues **no** per-viewer / per-auth query to determine held-state and adds **no** rate-limit or role
   query. The reviewer affordances are computed in the already-authenticated client session (D2's
   pattern). Verified: the read path issues no per-user query for held-state; an anonymous read returns
   each clip's held marking with no login and no per-user work.

**Role model + schema recorded; build/docs**

8. **AC8 — The role model + the review-state column are recorded in ARCHITECTURE, including how a
   moderator is granted.** ARCHITECTURE's *Data model* records, as-built: the **review-state column on
   `clip`** (the chosen shape — `vetted boolean default true`, or the `review_state` enum) with
   `vetted=true` (published) the new-add default and the all-published backfill; the **role field on
   `contributor`** (the chosen shape — `isModerator boolean default false`, or a `role` enum); **who may
   hold (moderator OR the clip's own curator) and who may approve (moderator only)**; and **how a
   contributor becomes a reviewer/moderator — the out-of-band mechanism Dev chose** (manual DB flag /
   seed / env allowlist; **no in-app admin UI**), explicitly noting that **granting a live moderator is
   a separate owner/ops action** and that the feature **ships green without one** (the gate rejects
   everyone until a moderator is granted; the workflow is testable with a stubbed moderator). The *Open
   questions* → Abuse/spam "the `clip.vetted` review hold + the role model is **D5b**" pending note is
   updated to as-built, and the **stale anticipatory `vetted` note** (the column was described as if
   present — see *Grounding correction*) is corrected. (Docs-as-built — the #45/C/D1/D2/D5a pattern.)

9. **AC9 — `yarn build` / `yarn typecheck` / `yarn test` green; the workflow is tested without a live
   provider.** The full check set passes. New tests cover, with the session/provider **stubbed** and the
   DB via pglite (the C/D1/D2/D5a pattern): a hold sets `vetted=false` and a held clip is read back as
   held, distinct from a published clip (AC1/AC2 — the data/render distinction at least at the
   data/seam level); a **moderator** approve flips `vetted=true` (AC3); a **curator** can hold their own
   clip but **cannot** approve (AC3a); a **non-moderator** approve (incl. the curator) and a
   **non-authorized** hold and an **anonymous** hold/approve are each **rejected and change nothing**
   (AC4/AC5 — the load-bearing role-gate tests, at the action with a stubbed role, not a button); a new
   add is `vetted=true` by default (AC6); the held-state rides `listClips` with no per-user query
   (AC7). The **non-moderator / non-curator / anonymous rejection tests are the load-bearing security
   tests** (the role-gate, not a button). Note for QA: a **live OAuth round-trip cannot run in CI** —
   stub the session (with and without the moderator role) for every signed-in case; the role-gate is
   fully provable at the action with a stubbed contributor.

---

## Decisions (resolving the prompt's questions 1–4; rationale recorded for UX/Dev/Curation/QA/Ops)

### Decision 1 — Review-state on `clip`: a `vetted boolean NOT NULL DEFAULT true`; new adds publish-by-default; existing clips backfill published. **Confirmed (recommended).**

- **The column does not exist today** (Grounding correction). D5b **adds** it. **Recommended shape: a
  `vetted boolean NOT NULL DEFAULT true`** — `vetted = true` ≙ **published / live / fully curated**;
  `vetted = false` ≙ **held / in review / not yet fully curated**. The name `vetted` makes §7,
  ARCHITECTURE's data-model note, and D1's "the data model carries a `vetted`-style flag" read **true**
  once it lands, and gives D5c + a future Analytics one obvious flag to read. (Dev may instead use a
  small `review_state` enum `published | held` if it reads cleaner — the captured fact is one-of-two
  per clip; shape recorded in ARCHITECTURE per AC8.)
- **New-add default = published (`vetted = true`).** D1's **Decision D1-2** ("a freshly added clip
  publishes immediately") is **preserved**: the hold is an *available action* a reviewer or the curator
  takes, **not auto-on** — §7 says the hold is "**available** to queue a freshly added clip for review,"
  not that adds are held by default. Auto-holding new adds would (a) reverse a shipped product decision,
  (b) need a reviewer queue that is out of scope, and (c) make a curator's vouch invisible until a
  moderator acts — corroding "a curator vouches → a reader sees it" with no moderation capacity yet.
- **Backfill = all published (`vetted = true`).** The `NOT NULL DEFAULT true` column + a non-null
  backfill on the migration means every existing/seeded clip is published when the column lands — **no
  live clip goes dark**. *Why:* every existing clip exists because a human acted (promote / add-by-link)
  — it is curated by construction (ARCHITECTURE's data-model note) — so "published" is the honest
  backfill state; nothing was ever in review.

### Decision 2 — The role model: a minimal binary moderator/reviewer designation on `contributor`, set out-of-band (recommended: `isModerator boolean`). No in-app admin UI. The role-gate authority is server-side. **Confirmed (recommended).**

- **The shared prerequisite for D5c.** Reviewing is the **first privileged action** in the product, so
  D5b establishes the **minimal** role model and D5c (moderator removal) **reuses** it. Keep it minimal:
  **a single binary role** (moderator/reviewer). D5b needs exactly one privileged capability (review);
  D5c needs one (remove) — both are "is this contributor a moderator?" No tier ladder, no per-capability
  permission matrix in the MVP.
- **Shape (recommended): an `isModerator boolean NOT NULL DEFAULT false` on `contributor`.** (Dev may
  use a `role text` enum `contributor | moderator` instead — the captured fact is binary; shape recorded
  in ARCHITECTURE per AC8.) `DEFAULT false` so every existing/new contributor is a non-moderator until
  granted — the safe default.
- **Granted OUT-OF-BAND — no in-app admin UI (out of scope).** A contributor becomes a
  reviewer/moderator by an **out-of-band** act, **Dev's call between** (recommended order of
  preference):
  - **(a) a manual DB flag** — the simplest, most honest MVP mechanism: an owner/ops sets
    `is_moderator = true` on the `contributor` row directly (e.g. via `psql` on the box). No code path
    grants it; nothing in-product changes it.
  - **(b) an env/seed allowlist** — a `MODERATOR_USERNAMES`-style env var (or a seed) of Wikimedia
    usernames, resolved to the role at find-or-create / login (so the role is derived from the
    allowlist, not stored, or stored-on-grant). Cleaner for staging (no manual `psql`), but couples the
    role to deploy config.
  - Either is fine; **the role-gate's authority is server-side regardless** — the action resolves the
    acting contributor's role **on the server** (from the DB row, or from the allowlist-derived session
    claim) and never trusts a client-supplied "isModerator" flag. Dev records the chosen mechanism in
    ARCHITECTURE (AC8).
- **Granting a LIVE moderator is an owner/ops follow-up action — but the feature ships green without
  one.** With no moderator granted, the role-gate simply **rejects everyone** (correct, safe default) —
  the *mechanism* is shipped and correct; only the *live granting* is an owner step. The workflow is
  **fully testable with a stubbed moderator session** (AC9), so QA proves it green in CI without any
  live grant. (Flagged in *Schema / migration note* + reported to the orchestrator.)

### Decision 3 — Hold + review actions: who may hold (moderator OR the clip's own curator), who may approve (moderator only). Both auth- + role-gated server-side, in the D2/D5a order. **Confirmed.**

- **`hold` (publish → held, `vetted = false`):** allowed for **a moderator (any clip)** OR **the clip's
  own curator (their own clip only)**. *Why the curator too:* it parallels D2's "a curator can
  revise/retract **their own** vouch" — a curator who has second thoughts can pull *their own* clip into
  review rather than only edit or hard-delete it; it is a safe, non-privileged-over-others act (they can
  only hold what they own). A moderator can hold any clip (the privileged reach).
- **`review/approve` (held → published, `vetted = true`):** **moderator only.** A clip's own curator may
  **not** self-approve their own held clip — approval is the *privileged act* that grants the clip the
  site's full vouch, and letting a curator clear their own hold would make the hold meaningless. (A
  curator who holds their own clip and then changes their mind has D2 edit/delete; restoring the full
  vouch is a reviewer's call.)
- **The gate is server-side, role-based, in the established order:** `requireContributor()` **FIRST**
  (reject anonymous — the C/D1 gate), **then** the D5a rate-limit (both actions are counted gated
  writes — they slot into the existing gate→limit→write contract; add a `kind` such as `hold` /
  `review` to the `write_event` ledger — no schema change, the ledger already carries `kind`), **then**
  the **role/ownership check** (approve: `isModerator`; hold: `isModerator` OR `clip.curatorId ==
  contributorId` — the D2 id-based ownership compare), **then** the write. A failing role/ownership
  check rejects and writes nothing (AC4/AC5). It is **never** by a client flag and **never** a hidden
  button; the affordance (scope item 8) mirrors but never replaces this gate (the D2 Decision-6
  pattern).

### Decision 3b — A held clip is shown-but-marked (visible to anonymous readers), not hidden; it is a third clip-state distinct from curated and from a candidate. **Confirmed (recommended).**

- **Shown-but-marked, not hidden.** A held clip remains **visible to anonymous readers**, rendered as
  *in review / not yet fully curated* (echoing §6's "not-vouched-for" language), rather than hidden
  until approved. *Why shown-but-marked for the prototype:* (a) **transparency fits the curation
  ethos** — §6 already shows un-vouched-for *candidates* openly with honest marking rather than hiding
  them; a held clip is one rung up and the same honesty applies; (b) at **prototype scale clips are
  few**, so hiding a held clip would often empty a section / a topic, hurting the read experience for no
  safety gain (the rate limit + login-gating, not hiding, are the spam blunting — D5a); (c) it makes
  D5b's effect **observable** (a held clip you can see, marked, is testable and demoable; a hidden one
  is invisible). *The honest tell to the reader:* "a human added this and wrote a note, but it has not
  yet passed review — weigh it accordingly," which is exactly the calibrated-trust value. (If a future
  run finds held content needs hiding — e.g. for clearly-abusive holds — that is a D5c/post-MVP refinement;
  D5b's posture is shown-but-marked.)
- **A third, distinct state.** The held clip is neither a fully-curated clip nor a candidate (§6): it
  **keeps** its note + chips + curator attribution (unlike a candidate, which has none — §6) but **lacks
  the full vouch** (unlike a published clip). The three states must be **mutually distinguishable by
  text/marking**, never color alone (§4/§6 accessibility baseline). UX builds the exact treatment on
  §6's vocabulary; the *requirement that the distinction exists* is the standard.

### Decision 4 — Read-path discipline: the held-state is a property of the clip; it rides the clip read; D5b adds no per-user work to the cached read path. **Confirmed.**

The held/published state is **not** per-viewer — it is the same for everyone, a property of the **clip**
row (`vetted`). So it is carried on the clip shape and rides the existing `listClips` read (like
`stance`/`accuracyFlag`/the derived count do), not fetched per viewer. D5b adds **no** per-user /
per-auth query to the cached topic read path: the auth + rate-limit + role gates run **only** on the
two write actions; the reviewer affordances are computed in the already-authenticated client session
(D2's owner-affordance pattern). This preserves ARCHITECTURE's *read-path-is-the-scale-lever* principle
(AC7) and matches D1–D5a (no read-path regression).

---

## Schema / migration note

**This IS a stateful change — it adds TWO columns across two tables and needs a migration. Operations
stages it.** D5b is **not** "flip an existing flag" (Grounding correction). It introduces:

- **A review-state column on `clip`** (Decision 1) — recommended **`vetted boolean NOT NULL DEFAULT
  true`** (or a `review_state` enum `published | held`). New adds default published (D1-2 preserved);
  **all existing/seeded clips backfill to `vetted = true`** (the `NOT NULL DEFAULT true` column +
  non-null backfill) so **no live clip goes dark**.
- **A role field on `contributor`** (Decision 2) — recommended **`isModerator boolean NOT NULL DEFAULT
  false`** (or a `role` enum `contributor | moderator`). Every existing/new contributor defaults to
  non-moderator.

This is a clean **additive, non-destructive** Drizzle migration on the C/D1/D2/D4/D5a schema — two new
columns, **no** column drop, **no** type change, **no** data loss (the backfill is a default-value
backfill, not a destructive rewrite). It applies on the existing migration path (`docker compose ... up
-d` runs migrations, same as D5a's `drizzle/0005_*`). The two `write_event` `kind` values the new
actions append (`hold` / `review`) need **no** ledger schema change (the `kind` column already exists —
D5a Decision 2).

**Operations:** this run **does** add a migration (like D4/D5a). The two new columns must apply cleanly
on deploy before the merge is live; same Drizzle migration path. **No new infra and no new secret** —
this is a column-only change (Decision 1/2; do **not** stand up Redis or any new service). **Owner/ops
follow-up to flag (not a blocker):** **granting a live moderator** is a separate out-of-band owner
action (Decision 2 — a manual DB flag or the env/seed allowlist Dev chose). The **mechanism ships
green without it** — the role-gate rejects everyone until a moderator is granted, and the whole
workflow is verified in CI with a stubbed moderator (AC9). When the owner wants a real reviewer on the
box, they set the role out-of-band by the recorded mechanism; that is a runbook step, not a code
change.

---

## Success metric

D5b has no analytics backend (Analytics is deferred; its define-the-metric work sits in Product).
Success is the **review-hold workflow + the role model working end-to-end**, verified at QA/UX review
against the ACs:

- **Primary (the hold is real, the role-gate holds — the binary check):** A clip can be **put on
  hold** and renders as a **distinct, text-labeled "not yet fully curated"** state — distinct from both
  a fully-curated clip and a candidate (AC1/AC2) — and a **moderator flips a held clip live** with the
  full vouch restored, no reload (AC3); while a **non-reviewer's** approve call (including the clip's own
  curator) and a **non-authorized / anonymous** hold/approve call are **rejected server-side and change
  nothing** (AC4/AC5). Today this is zero — there is no review-state and no role at all. The success
  condition is: a held clip is markedly not-fully-curated, a reviewer can flip it live, and only a
  reviewer can.
- **Secondary (D1 preserved; correct scoping; read-path clean):** New adds **publish by default** and
  the column lands without taking live clips dark (AC6 — D1-2 intact); the held-state **rides the clip
  read** with **no per-user work** on the cached read path (AC7); a curator may **hold** their own clip
  but not **approve** (AC3a). The role model is the **minimal binary moderator/reviewer** that **D5c
  reuses** — the shared-prerequisite goal of this run.
- **Foundational (recorded, no infra creep, green without a live grant):** The review-state column +
  the role model + **who may hold/approve** + **how a moderator is granted (out-of-band; no admin UI;
  granting a live one is an owner/ops step)** are **recorded in ARCHITECTURE** (AC8), the stale
  anticipatory `vetted` note is corrected, and the workflow is proven **green in CI with a stubbed
  moderator** — no live moderator grant required to ship (the role-gate test is server-side, at the
  action, not a button — AC4/AC9).

A future Analytics role would instrument, off the same data, the **hold rate** (how often clips are
held — the signal of review pressure) and the **time-to-approve** (held → live latency — the signal of
reviewer capacity). The metric to define when Analytics splits out: *what fraction of added clips are
ever held* and *the median held → live latency* (a growing backlog signals the MVP needs the deferred
reviewer-queue surface). For D5b the success check is the manual + tested end-to-end above (held + the
three-state distinction; a reviewer flips it live; non-reviewer/anonymous rejected; D1 default
preserved; read-path clean; role/column recorded), **not** a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D5b** on top of the committed Topic-page design,
  §6's unvetted-candidate visual vocabulary, and the D2 manage-row pattern. What D5b needs from UX,
  grounded in the calibrated-trust value (a reader can tell a held clip from a vouched one and from a
  raw suggestion):
  - **The held-clip rendering — a third clip-state** (AC1/AC2): a curated clip (note + chips + curator
    attribution intact) **marked** *in review / not yet fully curated*, **text-labeled** and AA (the
    word carries the meaning, never color-alone; gold is not a functional signal), echoing §6's
    "not-vouched-for" language but **distinct** from a §6 candidate (which has no note/chips/curator)
    **and** from a fully-curated clip. It renders the same for anonymous readers (Decision 3b —
    shown-but-marked). Place it on the `ClipCard` and the `GeneralStrip` tile.
  - **The reviewer affordances** (scope item 8): a **Hold** affordance (shown to a moderator on any
    clip, and to the clip's own curator on their own clip) and a **Review/Approve** affordance (shown to
    a moderator on a held clip), reusing the D2 owner-manage-row treatment — text-labeled,
    keyboard-operable, focus-visible. A contributor with no role and an anonymous viewer see **no**
    review affordances. Real pending/success/error states (the D1/D2 bar — no false success; the
    `AuthRequiredError` expired-session route; the D5a `RateLimitedError` "too fast" notice both apply,
    since these are gated writes).
  - **The no-reload reflect** (AC3): a held → approved clip re-renders as fully curated in the same
    session; a published → held clip gains its "in review" marking in the same session.
  - Evaluate the built UI against AC1, AC2, AC3.

- **Development:** build in-scope items 1–9 against AC1–AC9 — add the **review-state column on `clip`**
  (recommended `vetted boolean NOT NULL DEFAULT true`; new-add default published; backfill all existing
  to `true`) **and** the **role field on `contributor`** (recommended `isModerator boolean NOT NULL
  DEFAULT false`) as a clean additive Drizzle migration (Decision 1/2 / *Schema note*); surface the
  held-state on the client `Clip` shape + the `rowToClip` mapper so it **rides `listClips`** (Decision 4
  — no per-user read-path query) — note this is the **clip** review-state, distinct from the
  `Candidate.vetted: false` discriminant in `lib/data/types.ts`; add a **`holdClipAction`** and a
  **`reviewClipAction`** (or equivalently named) to `lib/server/actions.ts` in the
  `requireContributor()` **FIRST** → D5a rate-limit → **role/ownership check** → write order
  (Decision 3: approve = `isModerator`; hold = `isModerator` OR `clip.curatorId == contributorId`;
  reject + write nothing otherwise — load-bearing AC4/AC5); append `hold`/`review` `kind` to
  `write_event` (no ledger schema change); surface both on the client seam (`lib/data/store.ts` /
  `lib/data/index.ts`); resolve the acting role **server-side** (DB row, or the chosen
  allowlist-derived session claim — **never** a client flag) and pick + implement the **out-of-band
  grant mechanism** (Decision 2 — manual DB flag or env/seed allowlist; **no** admin UI); wire the
  reviewer-only affordances + the no-reload reflect (mirroring D2's owner-affordance compute in the
  authenticated client session). Do **not** build moderator *removal* (D5c), an admin UI to grant roles,
  appeals, or auto-hold heuristics; do **not** introduce the read-path Redis / ISR cacheHandler. Add the
  AC9 tests (session/provider **stubbed** — with and without the moderator role — pglite DB; **the
  non-moderator / non-curator / anonymous rejection tests are the load-bearing security tests**, at the
  action on the role, not a button). Record the **review-state column** + the **role model** + **who may
  hold/approve** + **how a moderator is granted (out-of-band; no admin UI; live grant = owner/ops step)**
  in ARCHITECTURE, and **correct** the stale anticipatory `vetted` data-model note (AC8). Hand to QA &
  Review.

- **Curation/Editorial:** D5b is the **enforcement** of §7's already-set review-hold posture ("a light
  `vetted` hold is **available** to queue a freshly added clip for review before it shows as fully
  curated") and §6's unvetted visual language (a held clip echoes "not-vouched-for"). No editorial
  change is requested — a hand-shake, not a hand-off. Flag for Curation only if: the **held-clip
  marking copy/tone** needs §6/§7-consistency sign-off (the verbatim "in review / not yet fully
  curated" microcopy), or the **who-may-hold/approve** split (Decision 3 — curator may hold, only a
  moderator may approve) reads as a curation-policy question rather than a product one. The abuse-removal
  posture (moderator removing abusive clips) is **D5c**; appeals + trust tiers are post-MVP.

- **QA & Review:** verify AC1–AC9 with fresh, non-author eyes, plus the standard security pass. The
  **load-bearing check:** the **role-gate is server-side** — a **non-moderator's** review/approve call
  (including the clip's **own curator**) is rejected **at the action** and changes nothing, and a
  **non-authorized / anonymous** hold/approve is rejected **at the action** (gate→limit→role→write
  order) — tested with a **stubbed session** (with and without the moderator role; a curator session for
  AC3a/AC4), **not** the UI hiding a button (AC4/AC5). Also confirm: a held clip reads back as held and
  is the **distinct third state** (not a published clip, not a candidate — AC1/AC2); a moderator approve
  flips it live, no reload, survives reload (AC3); a **new add is `vetted=true`** by default and the
  migration backfills existing clips to published (AC6 — no live clip goes dark); the held-state **rides
  `listClips`** with **no per-user query** (AC7); ARCHITECTURE records the column + role model + grant
  mechanism and corrects the stale `vetted` note (AC8). A **live OAuth round-trip cannot run in CI** —
  stub the session (moderator / non-moderator / curator) for every signed-in case; the whole workflow,
  including the role-gate, is provable at the action with a stubbed contributor (so it is green **without
  a live moderator granted** on any box).

- **Operations:** **this run adds a migration** (like D4/D5a): the two new columns (the `clip`
  review-state + the `contributor` role field) must apply cleanly on deploy (same Drizzle migration path
  as D5a's `drizzle/0005_*`), with the all-clips-published backfill applied. **No new infra and no new
  secret** — this is a column-only change (do **not** stand up Redis or any new service for it).
  **Owner/ops follow-up (not a deploy blocker):** **granting a live moderator** is a separate out-of-band
  action by the mechanism Dev recorded in ARCHITECTURE (a manual DB flag — e.g. `psql` set
  `is_moderator = true` on a `contributor` row — or the env/seed allowlist). The feature **ships green
  without it** (the role-gate rejects everyone until a moderator is granted; CI proves the workflow with
  a stub). Add a one-line runbook note for the owner on how to grant a reviewer when wanted; that is a
  follow-up, not part of this build's deploy.
