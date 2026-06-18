# Spec: Upvotes as a persisted, one-per-user signal (milestone D4)

- **Issue:** [#55](https://github.com/ragesoss/wikiplus/issues/55) — milestone **D**, run **4 of 5
  (D4)** · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the upvote affordance + its voted/not-voted states + the
  logged-out → login prompt + the optimistic/error treatment, all on the Indigo Press identity),
  Development (a new `clip_vote` table + migration, one auth-gated `toggleUpvoteAction`, a per-viewer
  "have I voted?" read off the cached topic path, the UI state), Curation/Editorial (D4 is governed by
  §7 "contribution is gated by login; reading is anonymous" — a hand-shake, not a hand-off) ·
  **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer).
- **Builds on:**
  - **C** (`docs/specs/wikimedia-oauth.md`) — the real `contributor` identity and the auth-gated
    write boundary; C explicitly deferred "**Upvote identity / one-vote-per-user**" to D (C
    Out-of-scope — "Upvotes are not yet a persisted per-user write; tying a vote to an identity is
    D"). That deferral is the charter for this run.
  - **D1** (`docs/specs/curate-add-persistence.md`) — the auth-gated write boundary, the
    `requireContributor()` gate, the `AuthRequiredError` / expired-session route (the
    `isAuthRequired` → `showExpiredGate` pattern), and the optimistic-with-rollback write posture
    `TopicView` already uses for dismissals.
  - **D2** (`docs/specs/clip-edit-delete.md`) — the per-clip **owner** mechanism: `clip.curatorId`
    is on the row and surfaced read-only on the client `Clip` (Decision 6a), and `ownsClip()` /
    `myContributorId` (from `useSession()`) decide a per-viewer affordance in the
    already-authenticated client session **without** a read-path hit. D4 reuses this "per-viewer
    state in the client session, never on the cached read path" pattern for "have I voted?".
  - **D3** (`docs/specs/contributor-profiles.md`) — the just-shipped read patterns and the explicit
    deferral of upvotes: "`clip.upvotes` renders as-is (decorative, as today) and is not D3's to
    set." D4 makes it real.
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§7** — contribution is gated by login, reading is anonymous; an
    upvote is a **gated contribution** (it ties an action to an identity). Per-identity rate limits
    and abuse/moderation are §7 policy whose **enforcement is D5**, not D4.
  - `docs/ARCHITECTURE.md` — *Guiding principle: the read path is the scale lever*; *Prototype
    phase* (shared Postgres via Drizzle behind the Server Actions boundary); the read-path principle
    that **D4 must add no per-user work to the cached topic read path**. D4 records the vote model +
    migration here.
  - The code (read, not paraphrased):
    - `lib/data/types.ts` — `Clip.upvotes?: number` today: a static seed number with no per-user
      write.
    - `lib/db/schema.ts` — the `clip` table (`upvotes` integer, nullable), the `contributor` table,
      and how D1's migration added nullable columns + D3's optional additive indexes. The
      `(provider, providerAccountId)` and `(topicId, provider, providerVideoId)` `unique(...)`
      constraints show the project's pattern for a DB-enforced uniqueness.
    - `lib/server/actions.ts` — `requireContributor()` + the gated-action pattern (gate FIRST, then
      the work); the dismissal action's "resolve the contributor, write attributed" shape is the
      closest sibling to a toggle.
    - `lib/data/store.ts` + `lib/data/index.ts` — the `DataStore` seam (the single place a new
      method + its Server Action are wired).
    - `components/topic/ClipCard.tsx` — the current upvote display: a static `▲ {clip.upvotes}` in
      the footer (no interactivity). `components/topic/GeneralStrip.tsx` renders the General-band
      tile (also shows the count). `components/topic/ContextByLink.tsx` shares the footer.
    - `app/topic/TopicView.tsx` — `myContributorId` from `useSession()`, `ownsClip()`, the
      optimistic-with-rollback dismissal (`runDismiss`), and the `requireLogin({ gate, action })` +
      `isAuthRequired` / `showExpiredGate` gates D4 reuses.
- **Hand-off:** UX (the buildable flow/design spec for the stories below), then Development.

---

## Problem & user value

The curation loop is now real: a curator promotes/adds (D1), edits/deletes their own (D2), and is
publicly attributable (D3). But the **reader's** one lightweight way to participate — upvoting a clip
they're glad they watched — is still **fake**. Today `clip.upvotes` is a **static seed number**
(`lib/data/types.ts`, `lib/db/schema.ts`): it renders as `▲ {n}` on the card (`ClipCard.tsx`), but
**nothing writes it per user**. There is no "I upvoted this," no one-per-user enforcement, no
persistence — the number is demo decoration.

This breaks the product's core promise on the read side. VISION's "what good looks like" is *a reader
leaves with 2–5 clips they're glad they watched and understands how to weigh each* — and an upvote is
the reader's signal of exactly that ("I'm glad I watched this"). For the signal to mean anything it
must be **one real person, once** — a vote count that anyone could inflate, or that double-counts the
same person, is worse than no count. Wikipedia-shaped trust comes from real identities acting; C made
contribution tie to a real Wikimedia identity, and D4 extends that to the upvote.

**Who acts and why.** A **signed-in reader/curator** upvotes a clip they found worth watching — and
can do so **exactly once**; clicking again **toggles the vote off** (they change their mind). The
displayed count reflects **distinct real users**. An **anonymous** visitor who tries to upvote is
prompted to log in (an upvote is a gated contribution, §7) — reading the count stays anonymous. The
count, and a vote, **persist** across reloads and sessions.

This is milestone **D4**: **upvotes as a persisted, one-per-user signal** — a vote tied to an
identity, toggleable, with the count derived from distinct voters so it can never drift. It is *a
vote table + one gated toggle action + a per-viewer "have I voted?" state* — **not** downvotes, not
ranking, not anti-gaming enforcement (D5).

---

## Scope (what D4 does)

1. **A `clip_vote` table keyed uniquely on `(clip_id, contributor_id)`** (Decision 1). One row = one
   contributor's vote on one clip. The **unique constraint** is the one-per-user enforcement, at the
   DB — not in app logic. A clean additive Drizzle migration adds it (see *Schema / migration note*).

2. **`toggleUpvoteAction(clipId)` — the one auth-gated write** (Decision 4). It resolves the
   signed-in contributor via `requireContributor()` (gate FIRST, before any DB touch — the D1/C
   posture); then: if no `clip_vote` row exists for `(clipId, me)`, **insert** one (now voted); if a
   row exists, **delete** it (now un-voted). It returns the **new per-viewer state** — `{ voted:
   boolean, count: number }` — so the UI reflects the toggle without a reload. It is idempotent and
   one-per-user **by the unique constraint** (a concurrent double-insert collides on the constraint,
   not on a read-modify-write race).

3. **The displayed count is derived, with the legacy seed as a baseline** (Decision 2). The count
   shown on a clip = the legacy `clip.upvotes` seed baseline **+** the count of real `clip_vote`
   rows for that clip. The count is **never** a mutable counter incremented/decremented in place —
   so it cannot drift from the set of real voters. A seeded demo clip keeps its demo number and real
   votes add on top; a clip with no seed (seed `0`/null) shows exactly its real vote count. A
   contributor's **own** "have I voted?" state comes **only** from `clip_vote`, **never** from the
   seed.

4. **A per-viewer "have I voted?" read, OFF the cached topic read path** (Decision 6). The signed-in
   viewer's set of voted clips (for the clips visible on the page) is resolved in the
   **already-authenticated client session** — a small client read of the viewer's own votes,
   hydrated after the topic shell renders — **not** baked into `listClips` or the cached/SSG topic
   shell. The displayed count (derivable/static) may ride the topic read; the per-user voted-state
   may not. This mirrors D2/D3's "owner affordance computed in the client session, never on the
   cached read path" rule. (Dev picks the exact mechanism — a seam read of the viewer's votes for the
   visible clip ids, or hydrate-on-mount — the product constraint is: no per-user work on the cached
   read path.)

5. **The upvote affordance becomes interactive, with a voted/not-voted state** (Decision 4/6). The
   current static `▲ {n}` (`ClipCard.tsx` footer, and the General-band tile) becomes an interactive,
   text-labeled control showing the count and **whether the signed-in viewer has voted** (a toggle
   state). Activating it when signed in toggles the vote and reflects the new count + state in the
   same session (no manual reload). Activating it when **logged out** routes through C's login gate
   (the same `requireLogin` entry point Promote/Add/dismiss use) — it does **not** silently no-op and
   does **not** optimistically show a vote that cannot persist. (Exact control, copy, and
   voted-state treatment are UX's; the signal is text-labeled, never color-alone — §7/accessibility
   baseline.)

6. **Anonymous and expired-session attempts resolve to a login prompt and write nothing**
   (Decision 5). An anonymous upvote attempt is rejected **server-side** (`requireContributor()` in
   `toggleUpvoteAction`) and, in the UI, routes to C's "Log in with Wikipedia" gate before any write
   is attempted. A session that expired between render and click is rejected at the boundary with
   `AuthRequiredError`; the UI surfaces the **expired-session** prompt (the D1 `isAuthRequired` →
   `showExpiredGate` path), not a generic error — and rolls back any optimistic state.

7. **`docs/ARCHITECTURE.md` records the vote model + migration** (Decision 1). The *Data model* /
   *Prototype phase* sections record: the `clip_vote` table and its `(clip_id, contributor_id)`
   unique constraint; that the displayed count is **derived** (seed baseline + distinct vote rows),
   not a mutated counter; that the legacy `clip.upvotes` is a frozen seed baseline; that the toggle
   is one auth-gated Server Action; and that the per-viewer voted-state is resolved in the client
   session **off** the cached topic read path. (Docs-as-built — the #45/C/D1/D2/D3 pattern.)

---

## Out of scope

Kept out so this run stays one build-loop run. Each routes to its milestone-D run or a deferred lane.

- **Downvotes / a net score / a dislike.** D4 is a single positive signal ("glad I watched"). A
  negative vote is a different product decision (and a different trust posture); not D4, not planned
  for the MVP.
- **Vote-based ranking / sorting / "top clips" ordering.** D4 persists and displays the per-clip
  count; it does **not** re-order clips by votes, surface a "most upvoted" rail, or change any
  ordering. Ranking is a later product decision (it interacts with the read-path cache and the
  curation thesis) — explicitly deferred.
- **Contributor profiles / "my upvotes" / a vote history view** — profiles are **D3** (shipped); a
  "clips I upvoted" surface is a later enhancement, not D4. D4 adds no profile change.
- **Moderation / anti-gaming / per-identity rate limits on voting** — **D5** (CURATION §7 sets the
  policy; enforcement is later). D4 buys the §7 prerequisites (a vote ties to an identity → a
  rate-limit subject and an audit row exist) but enforces **no** limit, sockpuppet detection, or
  vote-fraud heuristic. Login-gating + one-per-user are the only controls in D4.
- **Migrating/seeding real voters for the legacy seed count.** The legacy `clip.upvotes` is treated
  as an opaque seed **baseline** (Decision 2); D4 does **not** back-fill `clip_vote` rows to "explain"
  the seed, and does not attribute the seed to any real contributor.
- **Editing the upvote count by an owner.** D2 already excludes `upvotes` from the editable set; D4
  does not add an owner control over the count. The count is the readers', derived — not the
  curator's to set.
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge). Unchanged; still
  deferred. D4 adds **no** caching and **no** per-user work to the cached topic read path (Decision
  6). The toggle is a dynamic write action; the per-viewer voted-state is a client-session read.
- **A second OAuth provider / account linking.** As in C/D1/D2/D3 — additive, post-MVP. A vote is
  keyed by the (single) `contributor.id` the signed-in user resolves to.

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Signed in"** = a valid Wikimedia session per C's flow (a resolvable `contributor`); **"signed
out"** = no session. Per the C/D1/D2/D3 pattern, a **live Wikimedia OAuth round-trip cannot run in
CI** — QA verifies the gated/one-per-user behavior with the **session stubbed** (a resolvable
`contributor` injected, the provider call mocked) and the DB via pglite, consistent with how the
Wikipedia/YouTube fetches are mocked (`lib/server/actions.ts`: the server never calls
Wikipedia/YouTube).

**The vote persists and is one-per-user**

1. **AC1 — A signed-in user upvotes a clip; exactly one vote persists and the count increments by
   one.** When a signed-in contributor activates the upvote control on a clip they have not voted on,
   `toggleUpvoteAction` inserts **exactly one** `clip_vote` row for `(clip, that contributor)`, the
   action returns `{ voted: true, count: <baseline + distinct vote rows> }`, and the displayed count
   for that clip is **one higher** than before. After a reload (a fresh count derivation) the vote is
   still counted.

2. **AC2 — Re-clicking toggles the vote off; the row is removed and the count decrements.** When the
   same contributor activates the control again on a clip they have already voted on,
   `toggleUpvoteAction` **deletes** their `clip_vote` row, returns `{ voted: false, count: ... }`, and
   the displayed count is back to its pre-vote value. The toggle is idempotent: the post-state is "no
   vote row for `(clip, me)`," reached whether the click un-votes a real vote or is a no-op race.

3. **AC3 — The count reflects DISTINCT users; a second vote by the same user does not double-count
   (server-side — the load-bearing test).** Two `toggleUpvoteAction` *insert* attempts for the same
   `(clip, contributor)` result in **one** `clip_vote` row, **not** two — enforced by the
   `(clip_id, contributor_id)` **unique constraint** at the DB, not by an app-level read-then-write.
   Distinct contributors voting the same clip each add one to the count. This is verified by a test
   that drives the action/store directly (a stubbed session), asserting the row count and the derived
   count — **not** by the UI hiding a second click.

**Anonymous + expired**

4. **AC4 — An anonymous upvote is rejected server-side and writes nothing; the UI prompts login.**
   A `toggleUpvoteAction` call with **no** session is **rejected** by `requireContributor()` (raises
   `AuthRequiredError`) before any `clip_vote` write — **no** row is inserted or deleted. In the UI, a
   logged-out user who activates the upvote control is shown C's **"Log in with Wikipedia"** gate and
   no optimistic vote is shown (no false "voted"). (The server gate is the security control; the UI
   gate is the UX. Verified at the action with no session: it rejects and writes nothing — the
   load-bearing security test alongside AC3.)

5. **AC5 — A session that expired before the click surfaces the expired-session prompt, not a generic
   error.** If the session is invalid at toggle time, `toggleUpvoteAction` rejects with
   `AuthRequiredError`; the UI surfaces the **expired-session login prompt** (the D1 `isAuthRequired`
   → `showExpiredGate` path), rolls back any optimistic state, and **no** `clip_vote` row is written.

**Per-viewer state + read-path discipline**

6. **AC6 — The per-viewer voted-state shows in the UI without a manual reload AND is not on the
   cached read path.** When a signed-in viewer loads a Topic page, the upvote control reflects whether
   **they** have voted on each visible clip — and this voted-state is resolved in the
   **already-authenticated client session** (a per-viewer read of the viewer's own votes for the
   visible clips, or hydrated client-side), **not** baked into `listClips` or the cached/SSG topic
   shell. After a toggle (AC1/AC2) the control's voted-state and the count update in the **same
   session without a manual reload**. (Verifiable: `listClips` / the topic read path issues **no**
   per-user/per-session vote query for D4; the voted-state read is reachable only from the
   authenticated client session, never from an anonymous topic load.)

7. **AC7 — Reading the count stays anonymous.** An anonymous visitor sees each clip's displayed
   count (the derived seed-baseline + distinct vote rows) with **no** session and **no** login — the
   count is public; only **casting/toggling** a vote is gated (CURATION §7). No per-user work is done
   for an anonymous reader.

**Legacy seed + self-vote**

8. **AC8 — The legacy seed is a frozen baseline; a real vote adds on top; own-vote state never comes
   from the seed.** For a seeded clip with `clip.upvotes = N` and no real votes, the displayed count
   is **N**. After a signed-in user upvotes it, the displayed count is **N + 1** and a `clip_vote`
   row exists; un-voting returns it to **N**. The legacy `clip.upvotes` value is **never mutated** by
   a vote (it stays the frozen baseline). A viewer's **"have I voted?"** state for a seeded clip comes
   **only** from `clip_vote` (a seeded clip with no real vote shows the viewer as **not voted**, even
   if the baseline is large). (Decision 2.)

9. **AC9 — A curator may upvote their own clip (self-vote allowed).** A signed-in contributor can
   upvote a clip whose `curatorId` is their own — exactly as any other clip: one row, one increment,
   toggleable. There is **no** server-side or UI special-case blocking a self-vote. (Decision 3.
   Abuse posture — including any self-vote concern — is D5, not D4.)

**Build / docs**

10. **AC10 — `yarn build` / `yarn typecheck` / `yarn test` green; the gate + one-per-user + toggle +
    derivation are tested without a live provider.** The full check set passes. New tests cover, with
    the session/provider **stubbed** and the DB via pglite (the C/D1/D2/D3 pattern): a signed-in
    toggle inserts then deletes one vote row and returns the right `{ voted, count }` (AC1/AC2); a
    **second insert** for the same `(clip, contributor)` yields **one** row, not two — the
    one-per-user constraint (AC3, the load-bearing test); an **anonymous** toggle is rejected and
    writes nothing (AC4); the derived count = seed baseline + distinct vote rows, and the seed is not
    mutated (AC8); a self-vote is allowed (AC9). A **live OAuth round-trip cannot run in CI** — QA
    stubs the session for the signed-in cases (note this for QA).

11. **AC11 — `docs/ARCHITECTURE.md` reflects what shipped.** ARCHITECTURE's *Data model* / *Prototype
    phase* records the `clip_vote` table + its `(clip_id, contributor_id)` unique constraint, that the
    displayed count is **derived** (seed baseline + distinct vote rows) and never a mutated counter,
    that legacy `clip.upvotes` is a frozen seed baseline, that the toggle is one auth-gated Server
    Action, and that the per-viewer voted-state is a client-session read **off** the cached topic read
    path. The migration is named (Docs-as-built — the #45/C/D1/D2/D3 pattern).

---

## Decisions (resolving the prompt's six questions; rationale recorded for UX/Dev/Curation/QA)

### Decision 1 — A `clip_vote` table keyed uniquely on `(clip_id, contributor_id)`; the count is DERIVED, never a mutable counter. **Confirmed.**

D4 adds a **`clip_vote`** table: one row per `(clip, contributor)`, with a **unique constraint** on
`(clip_id, contributor_id)` — the same DB-enforced-uniqueness pattern the schema already uses for
`account_provider_identity` `(provider, providerAccountId)` and `dismissed_candidate_identity`
`(topicId, provider, providerVideoId)`. Suggested shape (Dev's call on exact column names/types,
recorded in ARCHITECTURE per AC11):

- `id` (serial PK),
- `clipId` → `clip.id` (FK, `onDelete: "cascade"` — deleting a clip removes its votes, matching D2's
  hard delete and the `clip.topicId` cascade),
- `contributorId` → `contributor.id` (FK; `onDelete` Dev's call — `cascade` or `set null` with the
  unique constraint adjusted, since a null contributor can't carry the one-per-user meaning; cascade
  is the clean default),
- `createdAt` (timestamp, defaultNow),
- `unique(clipId, contributorId)`.

**Why a row per vote, count derived (not a mutable `upvotes` counter):** a single mutable counter
incremented/decremented in place can **drift** from reality under concurrency, partial failures, or
toggle races, and it cannot answer "did *this* user vote?" The count derived as `seed baseline +
COUNT(clip_vote rows)` can **never** drift — it is, by construction, the number of distinct voters
(plus the frozen demo seed). The unique constraint makes "one per user" a **DB invariant**, not an
app-logic hope: a duplicate insert collides on the constraint regardless of races (AC3). This is the
same "derive, don't store, so it can't drift" posture the project already uses for the infobox counts
(`deriveStats` in `lib/data/index.ts`).

### Decision 2 — Legacy `clip.upvotes` is a frozen seed BASELINE; displayed count = baseline + real vote rows; own-vote state comes ONLY from `clip_vote`. **Confirmed (the recommended option).**

The existing `clip.upvotes` number is **seed/demo data with no real voters**. D4 treats it as an
opaque **baseline**: `displayed count = (clip.upvotes ?? 0) + COUNT(distinct clip_vote rows for the
clip)`. A seeded clip keeps its demo number and real votes add on top; a real vote is still
one-per-user in `clip_vote`. A user's **own** "have I voted?" state is read **only** from `clip_vote`
— **never** inferred from the seed.

- *Why this over the simpler "real-rows-only, seed clips start at 0":* the seed numbers are part of
  the demo's texture (a curated topic looks lived-in, not empty) — zeroing them would make a populated
  demo look dead, hurting "what good looks like" with no upside. Keeping the seed as a baseline costs
  one `+` in the derivation and is honest: the displayed count is "demo baseline + real votes," and
  the *meaningful, identity-backed* part (the real votes) is exactly the distinct-voters set. The seed
  is never mutated and never attributed to a real contributor (it's not a vote anyone cast).
- *The one firm rule either way:* the seed never leaks into per-user state. "Have I voted?" is purely
  a `clip_vote` lookup — so a viewer is never shown as having voted on a seeded clip they didn't
  actually vote on (AC8). The seed affects the **displayed total** only, never the toggle state.
- *Honest edge to record (not a blocker):* because the seed is a frozen baseline, a seeded clip can
  never drop **below** its baseline (you can't un-vote the demo seed). That is correct — the baseline
  is demo decoration, the real signal layers on top. Note it in ARCHITECTURE so it's not read as a
  bug.

### Decision 3 — A curator MAY upvote their own clip (self-vote allowed). **Confirmed (the low-special-case default).**

A self-vote is **allowed** in D4: a contributor can upvote a clip they curated, exactly like any
other clip.

- *Why allowed:* the upvote is a **low-stakes "glad I watched / found this worthwhile" signal**, not a
  scarce reputation currency in D4. Disallowing a self-vote adds a server-side special-case
  (`clip.curatorId === voter` → reject) and a matching UI special-case (hide/disable the control on
  your own clips) for a marginal integrity gain that the **one-per-user** cap already mostly delivers
  (a curator can inflate their own clip by **at most one**). Allowing it keeps the toggle a single,
  uniform path and avoids an asymmetry a reader would find odd ("why can't I upvote a clip I made and
  genuinely think is good?").
- *Where the concern actually lives:* any gaming/abuse posture — self-vote rings, sockpuppets, vote
  brigading — is **D5** (CURATION §7 enforcement), which can revisit self-votes as part of a coherent
  anti-gaming model. D4 should not pre-empt that with a one-off rule. (If Curation later judges
  self-votes should not count, D5 can exclude `clip.curatorId === contributorId` rows from the
  derivation without a schema change.)

### Decision 4 — `toggleUpvoteAction(clipId)`: insert if absent, delete if present; returns the new `{ voted, count }`. **Confirmed.**

One auth-gated Server Action, `toggleUpvoteAction(clipId)`:

1. `requireContributor()` — **gate FIRST** (the C/D1 posture: reject anonymous before any DB touch).
2. Look up the `clip_vote` row for `(clipId, contributorId)`. If **absent**, insert one (now voted);
   if **present**, delete it (now un-voted).
3. Return the new per-viewer state: `{ voted: boolean, count: number }`, where `count` is the derived
   count (Decision 2). The UI uses the return to reflect the toggle without a reload.

- *Why a toggle (not separate up/un-vote actions):* a single idempotent toggle matches the UX (one
  control, one click flips state) and removes a class of "I clicked up but it was already up" bugs.
  The unique constraint backstops the insert path (a racing double-insert collides, not duplicates —
  AC3); the delete path is naturally idempotent (deleting an absent row is a no-op landing in the
  "not voted" state — AC2). Dev should implement the insert as an upsert/`onConflictDoNothing` or
  equivalent so a constraint collision lands in the voted state rather than throwing (the toggle's
  contract is "end in the flipped state," not "error on a race").
- *Why it returns the count + state (not void):* so the client reflects the new truth from the
  server's derivation, not from a client-side guess — the same "the write returns the authoritative
  result" posture D1's `addClipAction` and D2's `updateClipAction` use.

### Decision 5 — Anonymous → login gate (reuse C); expired → expired-session prompt (reuse D1); the gate is server-side. **Confirmed.**

An upvote is a **gated contribution** (CURATION §7: contribution is gated by login, reading is
anonymous). The gate is **server-side** — `requireContributor()` is the first line of
`toggleUpvoteAction`, so an anonymous or expired direct call writes nothing (AC4/AC5) regardless of
the UI. On top of that, the UI reuses the existing gates:

- **Logged-out** activation routes through C's `requireLogin({ gate: "upvote", action })` entry point
  (the same one Promote/Add/dismiss use in `TopicView`) — the login prompt, no optimistic vote.
- **Expired session** (valid at render, gone at click) → the boundary rejects with
  `AuthRequiredError`; the UI surfaces the **expired-session** prompt via the D1 `isAuthRequired` →
  `showExpiredGate` path and rolls back any optimistic state — not a generic error.

*Why reuse, not re-spec:* C built the login gate and D1 built the expired-session route; D4 adds a
gate **subject** ("upvote") and reuses both mechanisms unchanged. No new auth, no new error path.

### Decision 6 — The per-viewer "have I voted?" state is resolved in the authenticated client session, NEVER on the cached topic read path. **Confirmed (ARCHITECTURE read-path principle).**

The signed-in viewer's voted-state is **per-user** and therefore must **not** be baked into the
cached/SSG topic shell or into `listClips` (which the read path caches). Split:

- The **displayed count** is derivable/public (seed baseline + distinct vote rows) — it **may** ride
  the topic read (it's the same for every viewer), or be a small public read. It is **not** per-user.
- The **"have I voted?"** state is resolved in the **already-authenticated client session** — a small
  client read of *the viewer's own* votes for the visible clip ids (or hydrated client-side after the
  shell renders) — exactly as D2/D3 compute the owner affordance from `myContributorId` /
  `clip.curatorId` in the client session, with **no** read-path cost. An anonymous topic load does
  **no** vote-state work (AC7).

*Why this is fixed at the product level (mechanism is Dev's):* the read path is the scale lever
(ARCHITECTURE) — per-user work on the cached topic shell would defeat caching the moment it's turned
on. The product constraint is: **no per-user vote work on the cached read path** (AC6). Dev picks the
mechanism — a `votedClipIds(clipIds)`-shape seam read scoped to the viewer + the visible clips, or a
hydrate-on-mount fetch — recorded in ARCHITECTURE per AC11. (D4 adds **no** ISR/Redis caching; that's
still deferred — but D4 must not plant per-user state where the future cache will live.)

---

## Schema / migration note

**This IS a stateful change — it adds a table and needs a migration. Operations stages it.** Unlike
D2/D3 (no/optional schema delta), D4 introduces the **`clip_vote`** table (Decision 1) with the
`(clip_id, contributor_id)` **unique constraint** and FKs to `clip` and `contributor`. This is a clean
**additive, non-destructive** Drizzle migration on the C/D1 schema — a new table, no column drop, no
type change, no data migration (the legacy `clip.upvotes` column is **kept as-is** as the frozen seed
baseline; it is **not** dropped, renamed, or back-filled). It applies on the existing migration path
(`docker compose ... up -d` runs migrations, same as D1's `drizzle/0002_*`). An index supporting the
`COUNT(clip_vote WHERE clip_id = ?)` derivation and the per-viewer `(contributor_id, clip_id)` lookup
is reasonable (the unique constraint already indexes `(clip_id, contributor_id)`; Dev judges whether a
secondary index helps) — additive, optional at prototype scale, like D3's indexes.

**Operations:** this run, unlike D2/D3, **does** add a migration. No new infra, no new secret — but
the `clip_vote` table must apply cleanly on deploy before the merge is live. Same migration path as
D1/C; flag it as the stateful step.

---

## Success metric

D4 has no analytics backend (Analytics is deferred); success is the **one-per-user, persisted,
toggleable upvote loop working end-to-end**, verified at QA/UX review against the ACs:

- **Primary (a vote is real, one-per-user, and toggleable):** A signed-in user can upvote a clip
  **exactly once** (the count goes up by one and a `clip_vote` row persists), **re-click to toggle it
  off** (the row is removed, the count comes back down), and the count reflects **distinct real users**
  — a second vote by the same user does **not** double-count (AC1/AC2/AC3). This is the binary "the
  upvote means one real person, once" check: today it is zero (a static seed number with no per-user
  write).
- **Secondary (gated like a contribution, public to read):** Casting/toggling a vote requires login
  (anonymous → C's gate; expired → the expired-session prompt; both write nothing — AC4/AC5), while
  **reading** the count stays anonymous (AC7) — implementing CURATION §7 for the upvote. The per-viewer
  voted-state shows without a reload and adds **no** per-user work to the cached read path (AC6).
- **Foundational (correct edges, no drift):** The legacy seed is a frozen baseline real votes layer on
  top of, never mutated (AC8); a self-vote is allowed (AC9); the count is derived so it can never
  drift; and the one-per-user invariant is a DB constraint, not app-logic (AC3/AC10).

A future Analytics role would instrument upvote rate, votes-per-clip, and the upvote→"glad I watched"
correlation on the shared DB; for D4 the success check is the manual + tested end-to-end above
(toggle persists once per user; distinct-user count; anonymous/expired rejected and write nothing;
seed baseline honored; self-vote allowed; read path untouched), not a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D4** on top of the committed Topic-page design
  and the existing upvote affordance (`ClipCard` footer `▲ {n}`, the General-band tile). What D4 needs
  from UX, grounded in the reader's "I'm glad I watched this" signal:
  - **The interactive upvote control + its voted/not-voted state** (AC1/AC2/AC6): how the current
    static `▲ {count}` becomes an interactive, text-labeled toggle on both the `ClipCard` footer
    (light surface) and the curated `GeneralStrip` tile (indigo band) — showing the count and whether
    **the signed-in viewer** has voted, on the Indigo Press identity + AA accessibility (text-labeled,
    keyboard-operable, focus-visible — the state is **never** color-alone; gold is not a functional
    signal color). Coordinate with Dev on the count-vs-state split (Decision 6).
  - **The logged-out + expired flows** (AC4/AC5): activating the control logged-out routes to C's
    "Log in with Wikipedia" gate (no optimistic vote); an expired session surfaces the
    expired-session prompt (the D1 pattern). Decide the **optimistic-vs-awaited** treatment of the
    toggle (the project uses optimistic-with-rollback for dismissals — `runDismiss`; an upvote toggle
    is a natural fit, with rollback on a server error / expired session).
  - **The anonymous reader's view** (AC7): the count is visible and readable logged-out; only the
    *act* of voting is gated — the control should read as "log in to upvote," not as broken/disabled
    nothingness.
  - Evaluate the built UI against AC1, AC2, AC4, AC6, AC7.

- **Development:** build in-scope items 1–7 against AC1–AC11 — add the **`clip_vote`** table + its
  `(clip_id, contributor_id)` unique constraint as a clean additive Drizzle migration (Decision 1 /
  *Schema note*); add **`toggleUpvoteAction(clipId)`** to `lib/server/actions.ts` (`requireContributor()`
  FIRST, then insert-if-absent / delete-if-present via an upsert/`onConflictDoNothing`-style insert so
  a race lands in the flipped state, returning `{ voted, count }` — Decision 4); compute the displayed
  **count as derived** (`(clip.upvotes ?? 0) + distinct clip_vote rows`, never a mutated counter —
  Decision 2); surface the toggle + the per-viewer voted-state read on the seam
  (`lib/data/store.ts` / `lib/data/index.ts`), keeping the per-viewer state in the
  **already-authenticated client session, OFF the cached topic read path** (Decision 6 — Dev picks
  the mechanism: a viewer-scoped `votedClipIds` read for the visible clips, or hydrate-on-mount);
  make the `ClipCard` + `GeneralStrip` upvote control interactive with the voted/not-voted state and
  the no-reload reflect; route logged-out through C's `requireLogin({ gate: "upvote", action })` and
  expired through the D1 `isAuthRequired` → `showExpiredGate` path (Decision 5); **allow self-votes**
  — no special case (Decision 3). Do **not** add downvotes/ranking/rate-limits. Add the AC10 tests
  (session/provider stubbed, pglite DB; the **one-per-user constraint** test and the **anonymous
  rejection** test are the load-bearing security/integrity tests). Record the as-built vote model +
  migration + the read-path discipline in ARCHITECTURE (AC11). Hand to QA & Review.

- **Curation/Editorial:** D4 is governed by §7 ("contribution is gated by login; reading is
  anonymous" — an upvote is a gated contribution). No editorial change is requested — a hand-shake,
  not a hand-off. Flag for Curation only if the self-vote default (Decision 3) or any "what does an
  upvote mean / count" copy needs sign-off (the abuse/anti-gaming posture, including any reconsidering
  of self-votes, is explicitly **D5**'s).

- **QA & Review:** verify AC1–AC11 with fresh, non-author eyes, plus the standard security pass. The
  **two load-bearing checks:** (1) **one-per-user is a DB invariant** — two insert attempts for the
  same `(clip, contributor)` yield **one** `clip_vote` row, tested at the action/store (not the UI
  hiding a second click) — AC3; (2) the **gate is server-side** — an anonymous `toggleUpvoteAction`
  is rejected and writes nothing (AC4), tested at the action, not the button. Also confirm: the toggle
  inserts then deletes one row and returns the right `{ voted, count }` (AC1/AC2); the count is
  **derived** = seed baseline + distinct vote rows, and the seed is never mutated (AC8); a self-vote
  is allowed (AC9); the per-viewer voted-state shows without reload and the **cached topic read path
  issues no per-user vote query** (AC6/AC7). A live OAuth round-trip cannot run in CI — stub the
  session for the signed-in cases.

- **Operations:** **this run adds a migration** (unlike D2/D3): the new `clip_vote` table must apply
  cleanly on deploy (same Drizzle migration path as D1's `drizzle/0002_*`). No new infra, no new
  secret. Stage the migration before the merge is live (the *Schema / migration note* flags it as the
  stateful step).
