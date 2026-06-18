# Spec: Moderator removal of abusive clips — soft-removal / tombstone (milestone D5c)

- **Issue:** [#59](https://github.com/ragesoss/wikiplus/issues/59) — milestone **D**, run **D5c**
  (third of three split from #56: D5a rate-limit shipped / D5b vetted-hold + role model shipped /
  **D5c** moderator removal) · the **final issue of Milestone D** · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the **moderator-only removal affordance** + its confirmation
  step — distinct from the D2 owner Edit/Delete and from the D5b reviewer Hold/Approve; AA + Indigo
  Press), Development (one additive migration — soft-removal columns on `clip` — a `removeClipAction`
  role-gated server-side, and a `removed_at IS NULL` filter on the clip read), Curation/Editorial
  (D5c is the **enforcement** of §7's already-set "removable content" rule and the "removal is for
  abuse, not for disagreement" boundary — a hand-shake, not a hand-off; Curation confirms what is
  removable and that removal stays distinct from the D5b hold) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer); D5 = the §7 moderation enforcement layer. **D5c
  is the last D5 run; closing it closes Milestone D.**
- **Builds on:**
  - **D5b** (`docs/specs/vetted-review-hold.md`) — **the moderator role model D5c reuses.** D5b
    established `contributor.is_moderator` (the binary reviewer/moderator role), the
    `WIKIPLUS_MODERATORS` env allowlist, the server-side resolver `lib/auth/moderators.ts`
    (`isModeratorContributor` — DB column OR allowlist, OR-combined; **never** a client flag), and the
    `isModerator` JWT session claim (affordance layer only). D5c adds **no** new role concept — it is
    the **second** capability gated on that same `isModerator`: D5b's reviewer can *approve/hold*; D5c's
    moderator can *remove*.
  - **D2** (`docs/specs/clip-edit-delete.md`) — the **contrast.** `deleteClipAction` is **owner-gated**
    (`clip.curatorId === contributorId`) and is a **hard** `db.delete` (D2 Decision 4). D5c's removal is
    the **role-gated parallel**: any clip, moderator-only — and (Decision 1) a **soft removal**, not a
    hard delete, so a moderator removing *someone else's* work is auditable and (later) reversible. D2's
    owner-delete is unchanged by D5c (Decision 3).
  - **D5a** (`docs/specs/write-rate-limit.md`) — the **gate→limit→write** order every gated write slots
    into (`requireContributor()` FIRST → `checkWriteRateLimit` → write → `recordWriteEvent`). D5c's
    removal is a counted gated write; it adds a **role check** between the limit and the write, exactly
    as D5b's hold/approve do, and appends a `remove` `kind` to the `write_event` ledger (no ledger
    schema change — `kind` already exists, D5a Decision 2).
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§7 "Removable content"** — the **posture is already set**: "a
    curator/moderator may remove… spam and self/affiliate promotion; clips with no genuine topical
    relevance; context notes that violate §1.2 (hype, personal attacks, unsupported curator claims,
    copied metadata); hateful, harassing, or illegal content; manipulated/deceptive media presented as
    genuine without disclosure; copyright-circumventing embeds." D5c is the **mechanism** for that rule.
  - `docs/CURATION_STANDARD.md` **§7 — the load-bearing boundary: "Removal is for abuse, not for
    disagreement."** A clip that is honestly flagged `opinion` / `mixed` / `inaccurate` **with a note
    that does the work of weighing it** is **legitimately curatable** — it is **not** removable. D5c is
    a **capability** (a human moderator judges abuse); it does **not** auto-classify abuse and must
    never make an honest opinion/inaccurate clip removable *by its flag value* (Decision 2).
  - `docs/CURATION_STANDARD.md` **§7.1 — removal is NOT the hold.** A **hold** (D5b) is a *reversible
    review pause* ("not yet vouched"); a **removal** (D5c) takes an *abusive* clip down. "Removal is
    **not** the hold's job, and a held clip must **never** read as 'this was removed/rejected.'" The two
    are distinct acts with distinct gates-of-meaning (Decision 3). A moderator may hold-then-remove, but
    they are separate states/actions.
  - `docs/CURATION_STANDARD.md` **§1.2** — what a note must not contain (hype, personal attacks,
    unsupported curator claims, copied metadata): a note that violates §1.2 is on the §7 removable list.
  - `docs/ARCHITECTURE.md` — *Guiding principle: the read path is the scale lever*; *Data model* (the
    `clip` table — D5b just added `vetted`; D5c adds the soft-removal columns); *Boundary surface* (the
    gate→limit→role→write order); *Open questions* → Abuse/spam ("**Moderator removal is D5c** … still
    to build"). D5c records the removal model + the soft-removal columns here (AC8).
  - The code (read, not paraphrased):
    - `lib/server/actions.ts` — `deleteClipAction` (owner-gated hard delete — the contrast);
      `holdClipAction` / `reviewClipAction` (D5b — the **role-gated pattern to parallel**:
      `requireContributor()` → `checkWriteRateLimit` → `isModeratorContributor(db, contributorId)` →
      `setClip…` → `recordWriteEvent`). D5c's `removeClipAction` is `holdClipAction`'s shape with a
      **moderator-only** gate (no own-curator arm) and a soft-removal write.
    - `lib/auth/moderators.ts` — `isModeratorContributor(db, contributorId)` — the **role resolution
      D5c reuses verbatim** (DB column OR `WIKIPLUS_MODERATORS` allowlist, server-side authority, never
      a client flag).
    - `lib/db/schema.ts` — the `clip` table. D5b's `vetted` column is the most recent additive pattern
      (`boolean(...).notNull().default(...)` + a backfill); the soft-removal columns follow the same
      additive conventions (`timestamp(...)` nullable, `integer(...).references(...)`, `text(...)`).
    - `lib/db/drizzle-store.ts` — **`listClips` filters only `eq(clip.topicId, topicId)`** today (the
      read D5c must extend to exclude removed clips); `deleteClip` is a hard `db.delete(clip)` (D2);
      **`setClipVetted` is the D5b column-flip-and-return pattern** D5c's soft-remove method mirrors;
      `clipOwnership(id)` loads the clip's `curatorId` (reused so a moderator removing their own clip is
      trivial and the row is confirmed to exist).
    - `lib/db/mappers.ts` — `rowToClip` derives `held` from `vetted`; a **removed** clip is filtered
      from the read entirely (Decision 1), so — unlike `held` — the removed-state needs **no** client
      `Clip` field (Decision 5).
    - `components/topic/ClipCard.tsx` / `ReviewRow.tsx` (the D2/D5b manage row) / `GeneralStrip.tsx` —
      where a moderator removal affordance would sit, alongside (and distinct from) the owner Edit/Delete
      and the reviewer Hold/Approve.
- **Hand-off:** UX (the buildable flow/design spec for the moderator removal affordance + confirm),
  then Development.

---

## Problem & user value

The §7 moderation layer is being built in three runs, and D5c is the last. D5a shipped the **rate
limit** (blunt the *speed* of writes). D5b shipped the **review hold** + the **moderator role model**
(a *reversible review pause*, "not yet vouched"). But §7 names a distinct, harder tool the product
still lacks: a **moderator can remove abusive content** — spam, self/affiliate promotion, no-genuine-
relevance clips, §1.2-violating notes, hateful/harassing/illegal content, deceptive media, copyright-
circumventing embeds. Today there is **no such mechanism**: the only way a clip leaves the site is its
**own curator** hard-deleting it (D2, owner-gated). An abusive clip whose curator will not remove it —
the exact case moderation exists for — **cannot** be taken down by anyone.

**The user value is trustworthy curation, not gatekeeping.** wiki+'s premise is Wikipedia-shaped
trust: a Topic page is worth reading because real people vouched for each clip with care, *and a reader
can weigh each clip* (VISION: "a reader leaves with 2–5 clips they're glad they watched **and**
understands how to weigh each"). Abuse — spam, hate, deceptive media, a §1.2-violating note — directly
corrodes that. Removal is the §7 enforcement that lets a moderator take down content that **should not
be on the page at all** — distinct from the D5b hold ("this is still being checked") and distinct from
an honest opinion/inaccurate clip with a fair note (which is **legitimately curatable**, never
removable — §7). Removing *someone else's* work is a privileged, accountable act, so the removal is a
**soft removal / tombstone**: the clip stops showing, but the row + who removed it + when (+ optionally
why) persist as an audit trail (Decision 1).

**Who acts and why.**
- A **moderator** (a `contributor` with the D5b role — `is_moderator` or the `WIKIPLUS_MODERATORS`
  allowlist) can **remove any clip** (any contributor's, not just their own) when it is abuse per §7.
  Removing others' abusive content is the *point* of the capability; a moderator removing *their own*
  clip is the trivial subset (they could also D2-delete it). Removal is the **second privileged
  capability** in the product, reusing D5b's role model exactly.
- A **non-moderator** — including the clip's **own curator** acting as a non-moderator — **cannot**
  remove. (The clip's own curator already has D2 owner-delete for *their own* clip; D5c adds no new
  power to a non-moderator over *anyone's* clip.) A **logged-out** caller cannot remove (the
  `requireContributor()` gate).
- A **reader** is unaffected and reading stays anonymous: a removed clip simply **stops showing** (it
  is filtered from `listClips` / the read path), with no per-viewer work and no login required to read.

This is milestone **D5c**: **moderator removal of abusive clips** — *a moderator-gated `removeClipAction`
that soft-removes any clip (a tombstone: who/when/why persist, the clip stops showing) + the read filter
+ the moderator-only removal affordance*, reusing D5b's role model. It is **not** the rate limit (D5a,
shipped), **not** the vetted hold (D5b, shipped — removal is its own state, Decision 3), **not** an
appeals workflow, **not** a moderation dashboard or a removal-log UI, **not** auto-classification of
abuse, **not** a restore UI (deferred — Decision 1 makes restore trivial to add later), and **not** an
in-app admin UI to grant moderators (D5b's out-of-band mechanism is unchanged).

---

## Scope (what D5c does)

1. **Soft-removal columns on the `clip` table (additive migration — Decision 1).** Add a removed-state
   to `clip` so a removal is an auditable, reversible tombstone, not a destructive delete:
   - **`removed_at`** (`timestamp` with timezone, **nullable**) — `NULL` ≙ live; non-null ≙ removed (the
     removal timestamp). This is the single removed/live discriminant.
   - **`removed_by`** (`integer`, nullable, FK → `contributor.id`, `onDelete: "set null"`) — the
     moderator who removed it (the accountability anchor: §7's "removal is for abuse, not disagreement"
     implies a *who*). `set null` so a removed contributor doesn't cascade-delete the tombstone.
   - **`removed_reason`** (`text`, nullable — Decision 4) — a minimal optional reason for the audit
     trail (free text and/or a §7 category — the captured *fact* is "an optional reason string";
     Dev's call on shape, recorded in ARCHITECTURE per AC8). Optional: a removal with no reason is
     valid.

   All three default `NULL` (no migration backfill writes them) so **every existing/seeded clip lands
   live (`removed_at IS NULL`)** when the columns land — **no live clip goes dark** (AC6). (Dev may
   instead use the D5b enum style, e.g. a `removal` shape — the *captured facts* are fixed: removed-yes/no
   + who + when + optional why; the column shape is Dev's call recorded in ARCHITECTURE per AC8. The spec
   uses `removed_at` / `removed_by` / `removed_reason` throughout.)

2. **A `removeClipAction` — moderator-only soft removal of ANY clip (auth- + role-gated server-side).**
   A new gated Server Action that, after `requireContributor()` (the auth gate) and the D5a rate-limit,
   loads the clip and **sets `removed_at = now()` + `removed_by = <acting contributor>` (+ the optional
   `removed_reason`) only if the acting contributor is a moderator** (`isModeratorContributor` — the D5b
   resolver, server-side, never a client flag) — otherwise it is **rejected server-side** and the clip
   stays live. Same `requireContributor()` FIRST → D5a rate-limit → **role check** → write order as
   D5b's `holdClipAction` / `reviewClipAction`, appending a `remove` `kind` to the `write_event` ledger
   (no ledger schema change). **Moderator-only — there is no own-curator arm** (unlike D5b's `hold`):
   removal of *anyone's* clip is the privileged reach; a curator wanting *their own* clip gone uses D2
   owner-delete (Decision 2/3).

3. **A removed clip stops showing — the read filter (Decision 1).** `listClips` (and any clip read on
   the read path) excludes removed clips: the query gains a **`removed_at IS NULL`** predicate alongside
   the existing `topicId` filter, so a removed clip is **not returned** to readers — it disappears from
   the Topic page, the General band, and the topic counts (videos/creators/curators reflect its
   absence). The row + `removed_at` / `removed_by` (+ `removed_reason`) **persist** in the DB (the audit
   trail). The removed-state rides the read as an **exclusion** (a property of the clip, the same for
   every viewer), so the cached read path does **no** per-user work for it (Decision 1 / AC7).

4. **Distinct from owner-delete (D2) and from the D5b hold (Decision 3).** Removal is its **own state
   and action**, not a reuse of either:
   - **vs. D2 owner-delete:** D2 stays **owner-gated** and a **hard delete** (a curator removing *their
     own* vouch — the row is gone). D5c is **role-gated** and a **soft removal** (a moderator taking
     down *abuse* — the row persists as a tombstone). Both remove a clip from view, by different actors,
     for different reasons, with different persistence. D2 is unchanged by D5c.
   - **vs. D5b hold:** a **hold** (`vetted = false`) is a *reversible review pause* — the clip **stays
     visible**, marked "in review · not yet vouched," and a moderator (or the curator) can flip it live.
     A **removal** (`removed_at` set) takes an *abusive* clip **down** — it stops showing. D5c does
     **NOT** reuse the held state for removal; `vetted` and `removed_at` are independent columns. A
     removed clip must never read as merely "in review," and a held clip must never read as "removed."

5. **A moderator-only removal affordance on the Topic page (convenience layer, not the security
   control).** The Topic page shows a **Remove** affordance to a **moderator** on **any** clip, reusing
   the D2/D5b manage-row pattern, **visually and textually distinct** from the owner Edit/Delete (D2) and
   the reviewer Hold/Approve (D5b). Because removal is destructive-from-the-reader's-view *and* an act
   on someone else's work, the UI requires an **explicit confirmation step** before the action fires (the
   D2 delete-confirm pattern). A contributor with no moderator role, and an anonymous viewer, see **no**
   removal affordance. (The affordance mirrors the server role-gate; **AC2/AC3 are the security
   control**, the affordance is not — the D2/D5b Decision-6 pattern.)

6. **`docs/ARCHITECTURE.md` records the removal model.** The *Data model* note for `clip` gains the
   **soft-removal columns** (`removed_at` / `removed_by` / `removed_reason`, nullable, all-live backfill,
   the read excludes `removed_at IS NULL`); the *Boundary surface* records `removeClipAction` as a
   **moderator-only, soft-removal** gated write in the gate→limit→role→write order (reusing
   `isModeratorContributor`), distinct from D2's owner-gated hard delete and D5b's hold/approve; the
   *Open questions* → Abuse/spam "**Moderator removal is D5c** … still to build" note is updated to
   as-built; and it records that **restore is deferred** but trivial given the tombstone (Decision 1).
   (Docs-as-built — the #45/C/D1/D2/D5a/D5b pattern.)

---

## Out of scope

Kept out so this run stays one build-loop run and closes D5 cleanly. Each routes to a later run or a
deferred lane.

- **The rate limit — D5a (shipped).** D5c's removal is a counted gated write that slots into the
  shipped gate→limit→write contract; D5c does **not** re-spec the limit.
- **The vetted review hold — D5b (shipped).** The `vetted` hold (a reversible review pause) and the role
  model are D5b. D5c **reuses D5b's role model** (that reuse is exactly why D5b established it) but adds
  **no** new role concept and does **NOT** reuse the held state for removal — removal is its own
  state/action (Decision 3).
- **A restore / un-remove UI — deferred (Decision 1 makes it trivial later).** D5c builds removal only.
  Because removal is a **soft** tombstone (`removed_at` flips, the row persists), a future un-remove is a
  near-mirror action (clear `removed_at`/`removed_by`) — but D5c does **not** ship a restore action or
  UI. ARCHITECTURE notes restore is deferred-but-trivial (AC8).
- **An appeals workflow.** No contributor-contests-a-removal flow, no notification to the removed clip's
  curator, no review queue/inbox. A moderator removes; that is the act. Appeals are post-MVP.
- **A moderation dashboard / a removal-log UI.** No in-product surface that lists removed clips, shows
  the audit trail, or aggregates moderation activity. The tombstone columns **persist the audit data**;
  surfacing it in a UI is post-MVP. (A future Analytics/moderation surface reads the same columns —
  Success metric.)
- **Auto-classification of abuse.** D5c is a **capability** (a human moderator judges whether a clip is
  §7 abuse). It does **NOT** auto-detect spam/hate/deception, and it must **never** make a clip removable
  *by its `accuracy_flag` value* — an honest `opinion` / `mixed` / `inaccurate` clip with a fair note is
  **legitimately curatable**, not removable (§7; Decision 2).
- **An in-app admin UI to grant / revoke the moderator role — out-of-band (D5b's mechanism, unchanged).**
  There is **no** in-product surface to make someone a moderator. The role is granted out-of-band (the
  D5b DB flag or `WIKIPLUS_MODERATORS` allowlist); D5c changes nothing about how moderators are granted.
- **Hard delete of others' clips, or changing D2's owner-delete.** D5c does **not** hard-delete (it soft-
  removes — Decision 1) and does **not** alter D2's owner-gated hard delete (a curator deleting their own
  clip is unchanged).
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge, cached candidate sets).
  **Unchanged; still deferred.** D5c must **not** introduce the read-path Redis or the ISR cache handler.
  The removed-state rides the existing clip read as a query exclusion; D5c adds **no** per-user work to it
  (Decision 1).

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Moderator"** = a signed-in `contributor` resolved as a moderator server-side via
`isModeratorContributor` (the D5b DB column OR the `WIKIPLUS_MODERATORS` allowlist). **"Curator"** = the
clip's own contributor (`clip.curatorId == session contributor id` — the D2 owner). **"Signed in"** = a
valid Wikimedia session per C's flow; **"signed out"** = no session. Per the C/D1/D2/D5a/D5b pattern, a
**live Wikimedia OAuth round-trip cannot run in CI** — QA verifies the gated/role-gated behavior with
the **session stubbed** (a resolvable `contributor` injected — with or without the moderator role — and
the provider call mocked) and the DB via pglite, consistent with how the Wikipedia/YouTube fetches are
mocked. The whole workflow, including the role-gate, is provable at the action with a **stubbed moderator
session**; no live moderator-granting round-trip is needed (the feature ships green without a live
moderator on the box — D5b's posture, unchanged).

**A moderator removes an abusive clip and it stops showing**

1. **AC1 — A moderator removes ANOTHER contributor's clip, and it stops showing.** When a **moderator**
   removes a clip curated by a **different** contributor, `removeClipAction` sets `removed_at` (+
   `removed_by` = the moderator's id, + the optional `removed_reason`), and a fresh `listClips` for that
   topic **no longer returns** the clip — it is gone from the Topic page, the General band, and the topic
   counts (videos/creators/curators) reflect its absence. In the same session the clip is removed from
   the in-memory clip set **without a manual reload** (returning to the empty/uncurated state if it was
   the last clip), and the removal survives a reload (a fresh `listClips` still excludes it). A moderator
   removing **their own** clip works identically (the trivial subset). The removal requires an explicit
   confirmation step in the UI before it fires (no one-click removal of others' work).

**The role-gate is server-side (the load-bearing security test)**

2. **AC2 — A NON-moderator's removal call is rejected server-side, and the clip stays.** A signed-in
   contributor who is **not** a moderator who calls `removeClipAction` — **including the clip's own
   curator acting as a non-moderator** — is **rejected server-side**: the clip's `removed_at` stays
   `NULL`, the clip **still shows** (a fresh `listClips` still returns it), and the action
   raises/returns an authorization error. This is verified by a test that invokes the action **directly**
   with a stubbed **non-moderator** session (and a separate one with the stubbed **curator** session who
   is not a moderator), **not** by the absence of a button. **This is the load-bearing role-gate test:**
   the gate is at the **action**, on the **role resolved server-side** (`isModeratorContributor`), never
   trusting a client "isModerator" flag and never a hidden button.

3. **AC3 — A logged-out removal call is rejected and the clip stays.** With **no** session,
   `removeClipAction` rejects via the `requireContributor()` gate (as C/D1/D2/D5a/D5b writes do) and
   changes nothing — the clip's `removed_at` stays `NULL` and the clip still shows. The order is
   `requireContributor()` **FIRST** → the D5a rate-limit → the role check (gate→limit→role→write), so an
   anonymous caller is rejected before the role check runs. Verified by a direct anonymous action
   invocation, not a hidden button.

**Removal is distinct from owner-delete (D2) and from the D5b hold**

4. **AC4 — Removal is distinct from D2 owner-delete; D2 still works owner-gated.** D5c does **not** change
   `deleteClipAction`: an owner deleting **their own** clip is unchanged (owner-gated, a hard delete —
   D2's ACs still pass). `removeClipAction` is the separate, role-gated, **soft** path: a removed clip's
   **row persists** (with `removed_at` / `removed_by`), whereas an owner-deleted clip's row is **gone**.
   Verified: D2's owner-delete still hard-deletes (row absent); a moderator removal leaves the row present
   but excluded from the read. The two are independent code paths and independent persistence.

5. **AC5 — Removal is distinct from the D5b hold; they do not collide.** A removed clip is **not** the
   same as a held clip: removal sets `removed_at` (the clip **stops showing**), while a hold sets `vetted
   = false` (the clip **stays visible**, marked "in review"). The two columns are independent — a clip
   can be live-and-published, held (visible, in review), or removed (not shown); holding a clip does not
   remove it, and removing a clip does not merely hold it. Verified: a held clip (`vetted = false`,
   `removed_at IS NULL`) is still returned by `listClips` and renders with the D5b "in review" marking; a
   removed clip (`removed_at` set) is **not** returned, regardless of its `vetted` value. D5c does not
   reuse the held state for removal.

**The tombstone persists (soft-removal audit trail)**

6. **AC6 — The removed row + who/when persist; the column lands without taking live clips dark.** After
   AC1 the clip **row still exists** in the DB with `removed_at` set (the removal timestamp) and
   `removed_by` = the removing moderator's contributor id (and `removed_reason` if one was supplied) — the
   audit trail per §7. All existing/seeded clips land **live** (`removed_at IS NULL`) when the columns
   land (the columns default `NULL`, no backfill marks anything removed), so **no clip that is live today
   goes dark** on migration. Verified at the store/DB: the removed clip's row is present with `removed_at`
   / `removed_by` populated and is excluded from `listClips`; a pre-existing/seeded clip has `removed_at
   IS NULL` and still shows after the migration.

**Read-path discipline**

7. **AC7 — The removed-state rides the clip read as an exclusion; no per-user work on the cached read
   path.** Whether a clip is removed is a property of the **clip** (the same for every viewer), enforced
   as a `removed_at IS NULL` predicate on the clip read; the cached topic read path issues **no**
   per-viewer / per-auth query to determine removed-state and adds **no** rate-limit or role query. The
   role gate runs **only** on the `removeClipAction` write; the moderator affordance is computed in the
   already-authenticated client session (the D2/D5b pattern). Verified: the read path issues no per-user
   query for removed-state; an anonymous read returns the topic's live clips (removed ones excluded) with
   no login and no per-user work.

**Removal model recorded; build/docs**

8. **AC8 — The removal model is recorded in `docs/ARCHITECTURE.md`.** ARCHITECTURE's *Data model* records,
   as-built: the **soft-removal columns on `clip`** (`removed_at` / `removed_by` / `removed_reason`, the
   chosen shape, all nullable, all-live backfill) and that the clip read **excludes `removed_at IS NULL`**;
   the *Boundary surface* records **`removeClipAction`** as a **moderator-only, soft-removal** gated write
   in the gate→limit→role→write order (reusing `isModeratorContributor` — the D5b resolver), **distinct**
   from D2's owner-gated **hard** delete and D5b's hold/approve; the *Open questions* → Abuse/spam
   "Moderator removal is **D5c**" note is updated to as-built; and it records that **restore is deferred
   but trivial** given the tombstone (Decision 1) and the `remove` `kind` appended to `write_event`. (Docs-
   as-built — the #45/C/D1/D2/D5a/D5b pattern.)

9. **AC9 — `yarn build` / `yarn typecheck` / `yarn test` green; removal is tested without a live
   provider.** The full check set passes. New tests cover, with the session/provider **stubbed** (with and
   without the moderator role) and the DB via pglite (the C/D1/D2/D5a/D5b pattern): a **moderator** removes
   another contributor's clip and it is excluded from `listClips` while its row persists with
   `removed_at` / `removed_by` set (AC1/AC6); a **non-moderator** removal — **including the clip's own
   curator** — is **rejected and changes nothing** (AC2 — the load-bearing role-gate test, at the action
   on the role, not a button); an **anonymous** removal is rejected (AC3); removal is **distinct** from
   D2 owner-delete (the moderator path soft-removes, the row persists; D2 still hard-deletes — AC4) and
   from the D5b hold (a held clip still lists; a removed clip does not — AC5); existing/seeded clips land
   live and the read excludes removed clips with no per-user query (AC6/AC7). The **non-moderator /
   anonymous rejection tests are the load-bearing security tests** (the role-gate, not a button). Note for
   QA: a **live OAuth round-trip cannot run in CI** — stub the session (moderator / non-moderator /
   curator) for every signed-in case; the role-gate is fully provable at the action with a stubbed
   contributor (so it is green **without a live moderator granted** on any box).

---

## Decisions (resolving the prompt's questions 1–4; rationale recorded for UX/Dev/Curation/QA/Ops)

### Decision 1 — Removal semantics: a **soft removal / tombstone**, not a hard delete. **Confirmed (recommended).** Restore is deferred (but trivial given the tombstone).

D5c removes a clip by **soft removal**: a `removed_at` timestamp (+ `removed_by` + optional
`removed_reason`) is set on the `clip` row, the row **persists**, and the clip is **excluded** from the
read (`listClips` gains a `removed_at IS NULL` predicate). It is **not** a hard `db.delete`.

- *Why soft removal, not a hard delete (the central call):* D2's owner-delete is a **hard** delete and
  that is right *there* — a curator deleting **their own** vouch is removing their own work, and a
  hard delete matches the MVP posture (D2 Decision 4). D5c is categorically different: a moderator removes
  **someone else's** work, on an **abuse** judgment (§7). §7's load-bearing rule — "**removal is for
  abuse, not for disagreement**" — implies an **auditable, attributable** act: who removed it, when, and
  (optionally) why. A hard delete leaves **no trace** of a privileged action taken on another person's
  contribution; a soft tombstone makes the moderation **accountable** (the audit columns) and
  **reversible** (a wrongly-removed clip can be restored — see below). At prototype scale the storage
  cost of keeping a removed row is trivial, and the audit/accountability value is high — exactly the
  trade §7 points to.
- *The removed clip stops showing:* the read excludes `removed_at IS NULL` (scope item 3), so a removed
  clip disappears from readers (the page, the band, the counts). The persistence is for the **moderator
  audit trail / a future moderation surface / a future restore**, not for readers.
- *Restore is deferred (Decision):* D5c builds **removal only**, **not** a restore action or UI (Out of
  scope). Because removal is soft, a future un-remove is a near-mirror (clear `removed_at` / `removed_by`)
  and is **trivial to add** — ARCHITECTURE records this (AC8). Shipping restore now would pull in the
  moderation-surface question (where does a moderator *see* removed clips to restore one?) that is post-
  MVP; D5c keeps the tombstone so restore is cheap later without building it now.
- *Why not the D2 hard-delete path:* reusing `deleteClip` would (a) lose the audit trail §7 implies,
  (b) make a moderator's action on another's work irreversible, and (c) conflate "the curator retracted
  their own vouch" with "a moderator took down abuse" — two different acts that should leave different
  traces. Soft removal keeps them distinct (Decision 3 / AC4).

### Decision 2 — Who may remove + what's removable: moderator-only, on ANY clip, the §7 abuse list; D5c is a capability, not an auto-classifier. **Confirmed.**

- **Who:** **moderator-only** — reuse D5b's `isModeratorContributor` (the DB `is_moderator` column OR the
  `WIKIPLUS_MODERATORS` allowlist, resolved server-side, never a client flag). A moderator may remove
  **any** clip (the point is removing *others'* abusive content); a moderator removing their **own** clip
  is the trivial subset. **There is no own-curator arm** (unlike D5b's `hold`, which a curator may do on
  their own clip): removal of *anyone's* clip is the privileged reach, and a curator who simply wants
  *their own* clip gone has D2 owner-delete. A non-moderator (including the clip's own curator acting as a
  non-moderator) and an anonymous caller are rejected server-side (AC2/AC3).
- **What's removable:** the **§7 abuse list** — spam and self/affiliate promotion; clips with no genuine
  topical relevance; context notes that violate §1.2; hateful/harassing/illegal content;
  manipulated/deceptive media presented as genuine without disclosure; copyright-circumventing embeds.
- **The load-bearing boundary — "removal is for abuse, not for disagreement" (§7):** an honestly-flagged
  `opinion` / `mixed` / `inaccurate` clip whose context note does the work of weighing it is
  **legitimately curatable** — it is **NOT** removable. D5c must **never** make a clip removable *by its
  `accuracy_flag` value*. D5c is a **capability** — a human moderator *judges* whether a given clip is §7
  abuse and removes it; D5c does **NOT** auto-classify abuse (Out of scope). The mechanism cannot tell
  abuse from disagreement — a person does. The standard guards the judgment; the action just executes a
  moderator's decision.

### Decision 3 — Removal vs. the D5b hold: distinct states, distinct actions. Removal does NOT reuse the held state. **Confirmed (CURATION §7.1).**

A **hold** (D5b, `vetted = false`) is a **reversible review pause** — "not yet vouched," the clip stays
visible and marked "in review," and a moderator (or the curator) can flip it live. A **removal** (D5c,
`removed_at` set) takes an **abusive** clip **down** — it stops showing. Per CURATION §7.1, "removal is
**not** the hold's job, and a held clip must **never** read as 'this was removed/rejected.'" D5c therefore:

- uses an **independent column** (`removed_at`), **not** `vetted` — a removed clip is removed regardless
  of its `vetted` value, and a held clip is held regardless of its `removed_at` value (AC5);
- is its **own action** (`removeClipAction`), separate from `holdClipAction` / `reviewClipAction`;
- has its **own affordance** (Remove), visually/textually distinct from Hold/Approve (and from D2's
  Edit/Delete) — scope item 5.

A moderator may *hold-then-remove* (review a clip, then decide it is abuse), but those are two distinct
acts, not one. Removal is the §7 abuse mechanism; the hold is the §7.1 review pause; they never read as
the same thing.

### Decision 4 — A removal reason: a minimal optional reason, captured for the audit trail. **Confirmed (recommended).**

The removal captures an **optional** reason (`removed_reason`) — free text and/or a §7 category — bound to
the removal alongside `removed_by` / `removed_at`.

- *Why capture it (low cost, high accountability value):* once we are storing a tombstone for
  accountability (Decision 1), a reason is the cheapest, highest-value addition to the audit trail — it
  records *why* a moderator took down another person's work, which is exactly what §7's "removal is for
  abuse, not disagreement" wants legible. It costs one nullable column and is invaluable to a future
  moderation surface / appeals / Analytics read.
- *Why optional, not required:* requiring a reason would add a friction step to a confirmation flow and a
  validation surface for marginal MVP benefit; the *facts that matter most* (who + when) are captured
  regardless. A removal with no reason is valid. (Dev's call on shape — free text, a §7-category enum, or
  both; the captured fact is "an optional reason string," recorded in ARCHITECTURE per AC8. UX decides
  whether/how to prompt for it in the confirm step; the spec does not require a reason UI.)

---

## Schema / migration note

**This IS a stateful change — it adds soft-removal columns to `clip` and needs a migration. Operations
stages it.** D5c is a soft removal (Decision 1), so it introduces:

- **`removed_at`** (`timestamp` with timezone, **nullable**) on `clip` — the removed/live discriminant
  (`NULL` ≙ live; non-null ≙ removed).
- **`removed_by`** (`integer`, nullable, FK → `contributor.id`, `onDelete: "set null"`) on `clip` — the
  removing moderator (the accountability anchor).
- **`removed_reason`** (`text`, nullable — Decision 4) on `clip` — the optional audit reason.

All three default `NULL`; **no backfill marks any clip removed**, so every existing/seeded clip lands
**live** (`removed_at IS NULL`) and **no live clip goes dark** (AC6). This is a clean **additive, non-
destructive** Drizzle migration on the C/D1/D2/D4/D5a/D5b schema — three new nullable columns on one
table, **no** column drop, **no** type change, **no** data loss. It applies on the existing migration
path (`docker compose ... up -d` runs migrations, the same path as D5b's `drizzle/0006_*`). The
`remove` `kind` the new action appends to `write_event` needs **no** ledger schema change (the `kind`
column already exists — D5a Decision 2). The clip read gains a `removed_at IS NULL` predicate (no schema
change beyond the columns).

**Operations:** this run **does** add a migration (like D4/D5a/D5b): the three new `clip` columns must
apply cleanly on deploy before the merge is live; same Drizzle migration path as D5b's `drizzle/0006_*`,
with the all-live default (no destructive backfill). **No new infra and no new secret** — this is a
column-only change (Decision 1; do **not** stand up Redis or any new service). **No new owner/ops grant
step** beyond D5b's already-documented out-of-band moderator grant (D5c reuses D5b's role — granting a
live moderator is the same runbook step D5b recorded; the feature ships green and is fully testable with
a stubbed moderator without one).

---

## Success metric

D5c has no analytics backend (Analytics is deferred; its define-the-metric work sits in Product). Success
is the **moderator removal capability + the role-gate + the soft-removal audit trail working end-to-end**,
verified at QA/UX review against the ACs:

- **Primary (a moderator can take down abuse, and only a moderator can — the binary check):** A
  **moderator** removes **another contributor's** abusive clip and it **stops showing** (excluded from
  `listClips`, gone from the page/band/counts, no reload — AC1), while a **non-moderator** (including the
  clip's own curator acting as a non-moderator) and an **anonymous** caller are **rejected server-side and
  the clip stays** (AC2/AC3). Today this is zero — the only way a clip leaves the site is its own curator
  hard-deleting it; an abusive clip whose curator won't remove it cannot be taken down. The success
  condition is: a moderator can remove any abusive clip and it disappears for readers, and only a
  moderator can.
- **Secondary (correct semantics; distinct from D2 and D5b; the audit trail is real):** Removal is a
  **soft tombstone** — the removed row + `removed_by` + `removed_at` (+ optional reason) **persist** as the
  §7 audit trail (AC6) — **distinct** from D2's owner-gated **hard** delete (AC4) and from the D5b
  **hold** (a held clip still shows; a removed clip does not — AC5); and existing clips land live with no
  clip going dark (AC6). The removed-state **rides the clip read** as an exclusion with **no per-user
  work** on the cached read path (AC7).
- **Foundational (reuses D5b's role model, recorded, green without a live grant):** Removal is gated on
  **D5b's `isModerator`** (no new role concept), the removal model + soft-removal columns + the read
  filter + "restore deferred-but-trivial" are **recorded in ARCHITECTURE** (AC8), and the workflow is
  proven **green in CI with a stubbed moderator** — no live moderator grant required to ship (the role-
  gate test is server-side, at the action, not a button — AC2/AC9). **Closing D5c closes the §7
  enforcement layer (D5a rate-limit + D5b hold + D5c removal) and Milestone D.**

A future Analytics / moderation-surface role would instrument, off the same soft-removal columns, the
**removal rate** (how often clips are removed — the signal of abuse pressure and of moderator activity)
and the **removal-reason distribution** (which §7 categories dominate — the signal of what abuse the
product actually attracts). The metric to define when Analytics splits out: *what fraction of clips are
ever removed* and *the removal-reason breakdown* (a rising removal rate signals the MVP needs the deferred
appeals / moderation-queue surface). For D5c the success check is the manual + tested end-to-end above
(a moderator removes abuse and it stops showing; non-moderator/anonymous rejected; soft tombstone persists
who/when/why; distinct from D2 and D5b; read-path clean; model recorded), **not** a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D5c** on top of the committed Topic-page design,
  the D2 owner-manage-row + delete-confirm pattern, and the D5b reviewer manage-row pattern. What D5c
  needs from UX, grounded in the §7 abuse-removal value (a moderator can take down content that should not
  be on the page at all):
  - **The moderator-only Remove affordance** (scope item 5): where it sits on a clip card / General-band
    tile / the manage row, shown **only** to a moderator and on **any** clip, **visually and textually
    distinct** from the D2 owner Edit/Delete and the D5b reviewer Hold/Approve (a moderator should never
    confuse "remove this abuse" with "hold this for review" or "delete my own clip"). Honor Indigo Press +
    AA (text-labeled, keyboard-operable, focus-visible — never color-alone; gold is not a functional
    signal). A contributor with no moderator role and an anonymous viewer see **no** Remove affordance.
  - **The removal confirmation step** (AC1): removal is an act on **someone else's** work and removes the
    clip from view, so design an explicit **confirm** step (the D2 delete-confirm pattern) so a removal is
    never a single accidental click. **Optionally** (Decision 4) offer a place to capture the optional
    **removal reason** (free text and/or a §7 category) in the confirm step — UX decides whether/how to
    prompt; the reason is optional, not required.
  - **Real pending/success/error states** (the D1/D2/D5b bar — no false success; the `AuthRequiredError`
    expired-session route and the D5a `RateLimitedError` "too fast" notice both apply, since removal is a
    gated write). On success the clip is removed from the in-memory set with no reload (AC1).
  - Evaluate the built UI against AC1 (a moderator removes and it stops showing, with confirm), and that
    the Remove affordance is distinct from Edit/Delete (D2) and Hold/Approve (D5b) and shown only to a
    moderator.

- **Development:** build in-scope items 1–6 against AC1–AC9 — add the **soft-removal columns on `clip`**
  (`removed_at` timestamp nullable, `removed_by` integer nullable FK→`contributor.id` `set null`,
  `removed_reason` text nullable; all default NULL, no destructive backfill — Decision 1 / *Schema note*)
  as a clean additive Drizzle migration; add a store **soft-remove method** mirroring `setClipVetted` (set
  `removed_at`/`removed_by`/`removed_reason` + `updatedAt`, return the updated clip — so the client can
  drop it from the in-memory set with no reload) and extend **`listClips`** (and any clip read on the read
  path) with a **`removed_at IS NULL`** predicate (Decision 1 / AC7 — no per-user query); add a
  **`removeClipAction`** to `lib/server/actions.ts` in the `requireContributor()` **FIRST** → D5a
  rate-limit → **role check** → write order, mirroring `holdClipAction` but **moderator-only**
  (`isModeratorContributor(db, contributorId)` — the D5b resolver; **no** own-curator arm — Decision 2),
  loading the clip via `clipOwnership` to confirm it exists and capturing `removed_by` = the acting
  contributor (+ the optional reason); reject + change nothing for a non-moderator / anonymous caller
  (load-bearing AC2/AC3); append a `remove` `kind` to `write_event` (no ledger schema change); surface the
  action on the client seam (`lib/data/store.ts` / `lib/data/index.ts`); wire the moderator-only Remove
  affordance + the no-reload reflect (mirroring the D2/D5b affordance compute in the authenticated client
  session — the affordance is **not** the security control). Do **NOT** reuse `vetted` for removal (it is
  an independent column — Decision 3 / AC5); do **NOT** change D2's owner-gated hard delete (AC4); do
  **NOT** hard-delete others' clips, build a restore action/UI, an appeals flow, a moderation dashboard,
  an admin grant UI, or auto-classification; do **NOT** introduce the read-path Redis / ISR cacheHandler.
  Add the AC9 tests (session/provider **stubbed** — with and without the moderator role, plus a curator
  session — pglite DB; **the non-moderator / anonymous rejection tests are the load-bearing security
  tests**, at the action on the role, not a button; plus the soft-tombstone-persists, distinct-from-D2,
  distinct-from-D5b, and read-excludes-removed tests). Record the **soft-removal columns** + the read
  filter + **`removeClipAction` (moderator-only, soft removal)** + **restore deferred-but-trivial** in
  ARCHITECTURE (AC8). Hand to QA & Review.

- **Curation/Editorial:** D5c is the **enforcement** of §7's already-set "removable content" rule and the
  "removal is for abuse, not for disagreement" boundary, and §7.1's removal-vs-hold distinction. No
  editorial change is requested — a hand-shake, not a hand-off. Flag for Curation only if: the **set of
  what's removable** (Decision 2 — the §7 abuse list) or the **removal-reason categories** (Decision 4, if
  Dev/UX use a §7-category enum) need §7-consistency sign-off, or if the **moderator-only, no-own-curator-
  arm** call (Decision 2 — unlike D5b's hold) reads as a curation-policy question rather than a product
  one. Appeals + a moderation surface are post-MVP.

- **QA & Review:** verify AC1–AC9 with fresh, non-author eyes, plus the standard security pass. The
  **load-bearing check:** the **role-gate is server-side** — a **non-moderator's** removal call (including
  the clip's **own curator** acting as a non-moderator) is rejected **at the action** and the clip stays,
  and an **anonymous** removal is rejected **at the action** (gate→limit→role→write order) — tested with a
  **stubbed session** (with and without the moderator role; a curator session for AC2), **not** the UI
  hiding a button (AC2/AC3). Also confirm: a moderator removal **soft-removes** (the row persists with
  `removed_at` / `removed_by`, AC6) and the clip is **excluded from `listClips`** (AC1); removal is
  **distinct** from D2 owner-delete (the moderator path soft-removes; D2 still hard-deletes — AC4) and
  from the D5b **hold** (a held clip still lists; a removed clip does not — AC5); existing/seeded clips
  land live and the read excludes removed clips with **no per-user query** (AC6/AC7); ARCHITECTURE records
  the removal model + soft-removal columns + restore-deferred (AC8). A **live OAuth round-trip cannot run
  in CI** — stub the session (moderator / non-moderator / curator) for every signed-in case; the whole
  workflow, including the role-gate, is provable at the action with a stubbed contributor (so it is green
  **without a live moderator granted** on any box).

- **Operations:** **this run adds a migration** (like D4/D5a/D5b): the three new `clip` soft-removal
  columns must apply cleanly on deploy (same Drizzle migration path as D5b's `drizzle/0006_*`), all
  defaulting NULL (no destructive backfill — every existing clip stays live). **No new infra and no new
  secret** — this is a column-only change (do **not** stand up Redis or any new service for it). **No new
  grant step** beyond D5b's already-documented out-of-band moderator grant (D5c reuses D5b's role — the
  feature ships green without a live moderator, verified in CI with a stub). Stage the migration before
  the merge is live (the *Schema / migration note* flags it as the stateful step).
