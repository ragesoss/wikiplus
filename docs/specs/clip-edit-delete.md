# Spec: Edit / delete your own curated clips — ownership-gated (milestone D2)

- **Issue:** [#53](https://github.com/ragesoss/wikiplus/issues/53) — milestone **D**, run **2 of 5
  (D2)** · **Type:** build · **Status:** spec
- **Owner:** Product · **Feeds:** UX (the edit/delete affordances + confirm flow, owner-only, on
  clips you curated), Development (two new auth-gated, **ownership-checked** Server Actions +
  surfacing them on the seam), Curation/Editorial (D2 **implements** §5.3's edit re-affirmation
  forward-note — a hand-shake, not a hand-off) · **Verified by:** QA & Review + UX
- **Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP,
  section **D** (the curation-action product layer).
- **Builds on:** **C** (`docs/specs/wikimedia-oauth.md`) — the write boundary is `requireContributor`-
  gated and a curated clip attributes to the **real** signed-in contributor (`clip.curatorId` +
  `clip.curatedBy`); C explicitly deferred edit/delete to D because it "needs ownership rules" (C
  Out-of-scope, Decision D1). And **D1** (`docs/specs/curate-add-persistence.md`) — the
  Promote/Add write flow, the per-submit CC BY-SA agreement capture (`note_license` +
  `note_license_agreed_at`, Decision D1-1), and the `addClipAction` attribution pattern
  (`requireContributor()` → boundary sets `curatorId`/`curatedBy`; client cannot supply them).
- **Inputs (authoritative — do not relitigate):**
  - `docs/CURATION_STANDARD.md` **§5.3** — the edit re-affirmation rule (a **material change to the
    note text** re-affirms the agreement with a new act + timestamp; a trivial/typo fix **or a
    stance/accuracy-chip-only change** does **not**). D2 implements this; it does **not** reopen it.
  - `docs/CURATION_STANDARD.md` **§7** — removal is for **abuse** (curator/**moderator** removal),
    which is **D5**, distinct from an owner editing or removing **their own** clip (D2).
  - `docs/ARCHITECTURE.md` — *Prototype phase*, the *server data-access boundary* + *Boundary
    surface* (why `updateClip`/`deleteClip` are off the boundary today). D2 records the ownership
    rule here.
  - The code (read, not paraphrased): `lib/data/store.ts` (the NOTE: `updateClip`/`deleteClip` are
    deliberately **off** the seam pending ownership), `lib/db/drizzle-store.ts` (the two methods
    exist — `deleteClip` is a **hard** `db.delete(clip)`; `updateClip` is a `db.update(...).set(...)`),
    `lib/server/actions.ts` (the NOT-exposed note + the `requireContributor()` gate + how
    `addClipAction` resolves the contributor and sets `curatorId`/`curatedBy`), `lib/data/types.ts` +
    `lib/db/mappers.ts` (the client `Clip` exposes `curatedBy` (username) but **not** `curatorId`;
    `clip.curatorId → contributor.id` is the stable owner key, on the row, not on the client shape),
    `lib/db/schema.ts` (`note_license` + `note_license_agreed_at` columns already exist from D1).
- **Hand-off:** UX (the buildable flow/design spec for the stories below), then Development.

---

## Problem & user value

D1 closed the add side of the loop: a signed-in curator can promote a candidate or add a clip by
link, and the clip persists, attributes to **them** (`clip.curatorId` = their contributor, set by
the boundary), and shows. But a vouch is not a one-shot act — a curator who wrote a note will, in
real use, want to **tighten the wording, fix the stance/accuracy assessment, re-file the clip to a
better section, or remove a clip they no longer stand behind.** Today they cannot:

- `updateClip` / `deleteClip` **exist on `DrizzleDataStore`** (`lib/db/drizzle-store.ts`) and are
  exercised by store-level tests — but they are deliberately **off** the client-facing seam
  (`lib/data/store.ts`) and **off** the Server-Actions boundary (`lib/server/actions.ts`). The #45
  fix round pulled them precisely because, **with no auth and no ownership rule**, a boundary export
  would let *any* visitor edit or delete *any* clip — an over-broad, destructive capability.
- C supplied the missing half: a **real, stable owner** per clip (`clip.curatorId`). The reason
  edit/delete waited for D is now satisfied — we can ask "is the signed-in contributor the clip's
  owner?" and answer it server-side.

**Who acts and why.** A **signed-in curator** can edit or delete **the clips they curated** — revise
the context note, change the stance/accuracy assessment (incl. modifiers), or re-file the clip to a
section/general — and can **remove** a clip they no longer want to back. They **cannot** touch a clip
someone else curated; that is not their vouch to revise. A **reader** is unaffected: reading stays
anonymous and gains no per-user work.

This is milestone **D2**: surfacing `updateClip` / `deleteClip` as **auth-gated, owner-only Server
Actions** with the ownership check **server-side, on the stable contributor id**. It is *ownership +
the gate + the owner-only affordances* — **not** moderator removal (D5), profiles (D3), or upvotes
(D4).

---

## Scope (what D2 does)

1. **`updateClipAction` — owner-only edit of the curator-authored fields.** A new auth-gated Server
   Action that (a) resolves the signed-in contributor via `requireContributor()`, (b) loads the
   target clip's owner, (c) **rejects** unless the clip's `curatorId` equals the signed-in
   contributor, and (d) on pass, applies a **patch limited to the editable set** (below) via
   `DrizzleDataStore.updateClip`, then returns the updated clip. The same closed-enum / length-cap
   stopgap D1 applies on add (`validateClipInput`-equivalent guards for `stance` / `accuracyFlag` /
   text length) applies to the patch.

2. **The editable set.** Only the **curator-authored** fields are editable:
   - `contextNote` (the note text),
   - `stance` (+ optional `stanceModifier`),
   - `accuracyFlag` (+ optional `accuracyModifier`),
   - section placement: `general` (whole-topic) vs. `sectionSlug` + `sectionLabel`.

   The clip's **identity is not editable**: the video/embed/watch URLs, `platform`, `creator`,
   `orientation`, `thumbnail`, the parent `topicQid`, `curatorId`/`curatedBy`, `createdAt`, and
   `upvotes` are **not** part of the patch (see **Decision 2**). Changing the underlying video would
   make this a different clip — that is a delete + add, not an edit.

3. **`deleteClipAction` — owner-only delete (with confirmation in the UI).** A new auth-gated Server
   Action with the **same ownership check** as edit; on pass it calls `DrizzleDataStore.deleteClip`
   (a **hard** delete — see **Decision 4**) and the clip is gone. The destructive nature is why the
   UI requires an explicit confirmation step before the action fires.

4. **The ownership gate is server-side and id-based.** The check is `clip.curatorId === <signed-in
   contributor id>`, evaluated **inside** the Server Action against the DB row — **never** by
   username and **never** trusting a client flag. A direct boundary call by a non-owner (or an
   anonymous caller) writes nothing and is rejected. (See **Decision 6** for the client-affordance
   mechanism, which is separate from this gate.)

5. **The §5.3 edit re-affirmation of the CC BY-SA note license.** On an edit that **changes the note
   text materially**, the action **re-stamps** the agreement: a new `noteLicense` (= `CC-BY-SA-4.0`,
   from `NOTE_LICENSE`) + a new `noteLicenseAgreedAt` server timestamp, exactly as `addClipAction`
   stamps on publish. On an edit that **does not change the note text** (a stance/accuracy/section-
   only change, or a no-op note save), the existing `noteLicense` / `noteLicenseAgreedAt` are **left
   untouched** (see **Decision 3** for the buildable "material change" definition and where the
   re-agreement consent comes from).

6. **Owner-only affordances on the Topic page.** The Topic page shows **Edit** and **Delete**
   affordances **only on clips the signed-in contributor owns**, reusing the existing curate form
   (`CurateFields` / the Curate modal) for the edit surface (pre-filled with the clip's current
   values). Clips you do not own, and **all** clips when logged out, show **no** edit/delete
   affordance. (The affordance is convenience + clarity; it is **not** the security control — #4 is.)

7. **The edited/deleted clip reflects in the same session (no manual reload).** On a successful edit
   the clip re-renders with its new note/chips/section in place; on a successful delete the clip is
   removed from the Topic page's in-memory clip set (and, if it was the last clip, the page returns
   to its empty/uncurated state), without a manual reload — matching the D1 no-reload bar.

8. **`docs/ARCHITECTURE.md` records the ownership rule.** The *Boundary surface* / *Prototype phase*
   note is updated: `updateClip` / `deleteClip` are now surfaced as **auth-gated, owner-only** Server
   Actions whose gate is `clip.curatorId === session contributor id`; delete is a hard delete;
   legacy `@prototype` clips are owned by no current user.

---

## Out of scope

Kept out so this run stays one build-loop run. Each routes to its milestone-D run or a deferred lane.

- **Moderator / admin removal of *anyone's* clip (CURATION §7 abuse removal).** D2 is **owner-only**.
  A role that can remove another contributor's clip — and the review-hold / `vetted` workflow — is
  **D5**. D2 adds no role concept beyond "owner vs. not owner."
- **Contributor profiles / "my curations" views / public attribution pages** — **D3**. D2 surfaces
  affordances *on the Topic page* for clips you own; it does not build a "your clips" index.
- **Upvotes as a persisted per-user write** — **D4**. `upvotes` is explicitly **not** in the editable
  set (a curator does not edit their own clip's vote count).
- **Any new video / creator editing.** Changing the clip's underlying video or creator identity is
  out (Decision 2) — that is not an edit of a vouch.
- **Retro-assigning legacy `@prototype` clips to a real owner.** Per C Decision D6 there is no real
  person to assign them to; D2 leaves them owned by no current user (Decision 5).
- **Soft-delete / undo / a trash bin / restore.** D2 matches the store's existing **hard** delete
  (Decision 4). An undo affordance, a tombstone, or a soft-delete column is a later enhancement, not
  D2.
- **The production read-path** (ISR / Redis `cacheHandler`, Cloudflare edge). Unchanged; still
  deferred. D2 adds **no** per-user work to the cached read path (the edit/delete gate runs only on
  the write actions; ownership of the *affordance* is computed in the already-authenticated client
  session — see Decision 6).
- **Note-quality / editorial enforcement beyond the existing limits.** D2 keeps D1's closed-enum +
  length-cap guards on the patch; it does not add editorial-quality enforcement of §1 (moderation/D5).

---

## Acceptance criteria

Each item is independently testable; QA maps each to pass/fail with fresh, non-author eyes.
**"Owner"** = the signed-in contributor whose id equals the clip's `curatorId`. **"Signed in"** = a
valid Wikimedia session per C's flow; **"signed out"** = no session. Per the C/D1 pattern, a **live
Wikimedia OAuth round-trip cannot run in CI** — QA verifies the gated/ownership behavior with the
**session stubbed** (a resolvable `contributor` injected, the provider call mocked) and the DB via
pglite, consistent with how Wikipedia/YouTube fetches are mocked (`lib/server/actions.ts`: the server
never calls Wikipedia/YouTube).

**Owner edits their own clip**

1. **AC1 — An owner can edit each editable field, and each persists.** When the **owner** of a clip
   edits it via the edit surface and saves, `updateClipAction` writes the patch and a fresh
   `listClips` (or the returned clip) reflects the change for **each** editable field independently:
   `contextNote`, `stance` (+ `stanceModifier`), `accuracyFlag` (+ `accuracyModifier`), and section
   placement (`general` ⇄ a `sectionSlug` + `sectionLabel`). Non-editable fields (video/creator/
   platform/orientation/URLs/`topicQid`/`curatorId`/`curatedBy`/`createdAt`/`upvotes`) are
   **unchanged** by the edit, even if a forged patch tries to set them (the action ignores fields
   outside the editable set).

2. **AC2 — The edited clip re-renders in the same session (no manual reload).** After AC1 the Topic
   page shows the clip with its new note / chips / section without a manual reload; the persisted
   change also survives a reload (a fresh `listClips`). The chips render from the closed enums
   (CURATION §2/§3) — an out-of-vocabulary stance/accuracy in a patch is rejected (the D1 closed-set
   guard), writing nothing.

**Owner deletes their own clip**

3. **AC3 — An owner can delete their own clip, with confirmation, and it is gone.** When the **owner**
   confirms deletion, `deleteClipAction` removes the clip; a fresh `listClips` no longer returns it,
   the Topic page removes it from the in-memory set without a manual reload (returning to the
   empty/uncurated state if it was the last clip), and the topic counts (videos/creators/curators)
   reflect its absence. The delete requires an explicit confirmation step in the UI before it fires
   (no one-click destroy).

**The ownership gate (server-side — the security control, verified by test)**

4. **AC4 — A non-owner's edit is rejected server-side.** A signed-in contributor who is **not** the
   clip's owner who calls `updateClipAction` for that clip is **rejected server-side** — the clip is
   **not** modified and the action raises/returns an authorization error. This is verified by a test
   that invokes the action directly (a stubbed session for a *different* contributor than the clip's
   `curatorId`), **not** merely by the absence of a button.

5. **AC5 — A non-owner's delete is rejected server-side.** As AC4, for `deleteClipAction`: a
   signed-in non-owner's delete call leaves the clip present and raises/returns an authorization
   error. Verified by a direct action invocation, not a hidden button.

6. **AC6 — A logged-out edit/delete is rejected and prompts to log in.** With **no** session,
   `updateClipAction` / `deleteClipAction` reject (the `requireContributor()` gate, as C's writes do)
   and write nothing; in the UI, the (absent-by-default) affordances never reach a write that cannot
   succeed, and an expired-session attempt surfaces C's login prompt rather than a generic error
   (reusing the D1 `AuthRequiredError` / expired-session pattern). The gate is `requireContributor()`
   **then** the ownership check; an anonymous caller is rejected before the ownership check runs.

**Owner-only affordances**

7. **AC7 — Edit/delete affordances appear only on clips you own; not on others'; not when logged
   out.** On the Topic page, the **Edit** and **Delete** affordances are shown **only** on clips the
   signed-in contributor owns. A clip curated by a **different** contributor shows **no** edit/delete
   affordance, and when **logged out** **no** clip shows them. (This is the convenience/clarity layer;
   AC4/AC5/AC6 are the security control behind it.)

8. **AC8 — Legacy `@prototype` clips show no edit/delete to anyone, and reject at the action.** A clip
   attributed to the seeded `@prototype` stub (curated before C, no real owner) shows **no**
   edit/delete affordance to **any** signed-in user, and a direct `updateClipAction` /
   `deleteClipAction` call for such a clip by any real contributor is **rejected** (its `curatorId`
   matches no current user). This is **correct behavior, not a bug** (Decision 5).

**§5.3 license re-affirmation**

9. **AC9 — A material note-text edit re-stamps the CC BY-SA agreement.** An owner edit that
   **changes the context-note text materially** re-stamps the note license: a new `noteLicenseAgreedAt`
   timestamp (later than the prior one) with `noteLicense` = `CC-BY-SA-4.0`. QA can confirm the
   re-stamp on the persisted clip. (Implements CURATION §5.3.)

10. **AC10 — A chip-only / no-text-change edit does NOT re-stamp the agreement.** An owner edit that
    changes **only** stance/accuracy/section (or saves the note unchanged) **leaves**
    `noteLicenseAgreedAt` and `noteLicense` exactly as they were — no new timestamp. (Implements
    CURATION §5.3's "a trivial/typo fix or a stance/accuracy-chip-only change does not re-affirm.")

**Build / docs**

11. **AC11 — `yarn build` / `yarn typecheck` / `yarn test` green; the ownership gate + re-affirmation
    are tested without a live provider.** The full check set passes. New tests cover, with the
    session/provider **stubbed** and the DB via pglite (the C/D1 pattern): an owner edit persists each
    editable field and leaves non-editable fields unchanged (AC1); an owner delete removes the clip
    (AC3); a **non-owner** edit and a **non-owner** delete are each **rejected and write nothing**
    (AC4/AC5); an **anonymous** edit/delete is rejected (AC6); a `@prototype`-owned clip rejects for a
    real contributor (AC8); a material note-text edit re-stamps `noteLicenseAgreedAt` (AC9) and a
    chip-only edit does not (AC10). The non-owner / anonymous rejection tests are the load-bearing
    security tests (the gate, not a button).

12. **AC12 — `docs/ARCHITECTURE.md` reflects what shipped.** ARCHITECTURE's *Boundary surface* /
    *Prototype phase* records that `updateClip` / `deleteClip` are now **auth-gated, owner-only**
    Server Actions, the gate is `clip.curatorId === session contributor id` (id-based, server-side),
    delete is a **hard** delete, and legacy `@prototype` clips are owned by no current user. (Docs-as-
    built — the #45/C/D1 pattern.)

---

## Decisions (resolving the prompt's six questions; rationale recorded for UX/Dev/Curation/QA)

### Decision 1 — Owner = the contributor who curated the clip; D2 is owner-only. **Confirmed.**
The owner is the contributor whose id equals `clip.curatorId` (the stable identity C established and
the boundary set on add). D2 grants edit + delete to the **owner only**. Moderator/admin removal of
*anyone's* clip is **D5** (CURATION §7 abuse removal). *Why:* D2's job is "a curator can revise/retract
**their own** vouch"; introducing a moderator role now would pull in the review surface and role model
that are explicitly D5, and would broaden the destructive capability before there is moderation
tooling to govern it.

### Decision 2 — Editable set = the curator-authored fields only. **Confirmed.**
Editable: `contextNote`, `stance` (+ `stanceModifier`), `accuracyFlag` (+ `accuracyModifier`), and
section placement (`general` / `sectionSlug` + `sectionLabel`). **Not** editable: the clip's identity
— video/embed/watch URLs, `platform`, `creator`, `orientation`, `thumbnail`, parent `topicQid`,
`curatorId` / `curatedBy`, `createdAt`, and `upvotes`. *Why:* an edit revises a **vouch** (the note +
the assessment + where it sits), not the **thing vouched for**. Changing the underlying video is a
different clip — delete + add, not edit. Locking attribution (`curatorId`/`curatedBy`) and `createdAt`
out of the patch keeps provenance honest; `upvotes` is D4's, not the owner's to set.

### Decision 3 — Re-affirm CC BY-SA only on a material note-text change; chip/section-only edits do not. **Confirmed (implements §5.3).**
The buildable rule:
- **If the saved `contextNote` text differs materially from the stored note text**, the action
  re-stamps the agreement (`noteLicense = CC-BY-SA-4.0`, `noteLicenseAgreedAt = new Date()`), exactly
  as `addClipAction` stamps on publish. Because the agreement binds to *the note as published* (§5.3),
  a materially new note is a new act.
- **If the note text is unchanged** (a stance/accuracy/section-only edit, or a no-op note save), the
  existing `noteLicense` / `noteLicenseAgreedAt` are **left as-is** — no new timestamp.
- **"Material change" — the buildable definition (testable):** the note text changed after
  whitespace normalization (trim + collapse internal runs of whitespace). A pure whitespace/typo-level
  change that leaves the normalized text identical is **not** material; any change to the normalized
  text **is** material for D2's purposes. (§5.3 frames a typo fix as non-material; D2 uses the simple,
  testable "normalized text changed" line rather than attempting semantic-diff judgement — UX may add
  a re-agreement control, see below; the *capture rule* is this.)
- **Where the re-agreement consent comes from (flag for UX/Dev):** D1 made the agreement a **required,
  affirmative** act at publish. On a material edit, the edit surface should likewise present the §5.3
  required-agreement control (re-using D1's microcopy), so the re-stamp reflects an actual fresh
  agreement, not a silent server stamp. The *client* signals consent (a boolean, as in D1); the
  *server* stamps the version + timestamp (never trusted off the wire). On a non-material edit the
  control is not required. Exact control/placement is UX's; the captured-facts rule is fixed here.

### Decision 4 — Hard delete, matching the store. **Confirmed; consequence stated.**
`DrizzleDataStore.deleteClip` is a **hard** `db.delete(clip)` (it removes the row). D2 surfaces that
as-is; it does **not** introduce a soft-delete column or a trash/undo. *Acceptable for the prototype:*
this matches the store's existing behavior and the MVP posture (a curator who deletes their vouch
removes it). *Consequence stated:* the clip row is **gone** — its note, chips, and the captured
note-license agreement (`note_license` / `note_license_agreed_at`) go with it; there is no undo.
The candidate **dismissal** history is **unaffected** — `dismissed_candidate` is keyed by
`(topicId, provider, providerVideoId)` and references the dismissal's own contributor, **not** the
clip row, so deleting a clip leaves dismissals intact (a previously-dismissed candidate stays
dismissed; the deleted clip's video is no longer in the curated set, so dedup against it simply stops).
A soft-delete / undo is an explicit Out-of-scope enhancement.

### Decision 5 — Legacy `@prototype` clips are editable/deletable by no one. **Confirmed; correct, not a bug.**
Clips curated before C are owned by the seeded `@prototype` stub (C Decision D6 — no retro-rewrite to
a real person). No **current** signed-in contributor's id equals the stub's, so the ownership check
fails for everyone: these clips show no edit/delete affordance (AC8) and reject at the action. *Why
correct:* there is no real owner to grant the capability to, and granting *any* signed-in user edit/
delete over stub clips would be a moderator-style capability — that is **D5**, not D2. They remain
read-only until a moderator capability exists (or they age out of the prototype seed).

### Decision 6 — Ownership signal to the client: the gate is server-side + id-based; the affordance mechanism is Dev's, with one fixed constraint. **Confirmed.**
**Fixed (security):** the authorization check is **server-side**, inside `updateClipAction` /
`deleteClipAction`, comparing the loaded clip's **`curatorId`** to the **session contributor id**
(`requireContributor()` → `contributorId`). It is **never** by username and **never** trusts a
client-supplied "isOwner" flag. A non-owner / anonymous direct call is rejected (AC4/AC5/AC6) —
this is the only thing that actually protects the data.

**Open for Dev (the *affordance*, not the gate):** the client must decide which clips to show
edit/delete affordances on. Two viable mechanisms, Dev's call:
- **(a) Expose `curatorId` read-only on the client `Clip`** (today `rowToClip` exposes `curatedBy`
  but **not** `curatorId`), and compare it to the session's contributor id — most precise, matches the
  server gate exactly. Note: this surfaces a numeric contributor id client-side; it is not a secret
  (it is an internal row id, not the Wikimedia identity), but Dev should confirm that is acceptable.
- **(b) Compare the session's Wikimedia **username** to the clip's `curatedBy`** for the affordance
  only (no schema/shape change). Cheaper, but `curatedBy` is a display username, not the stable id —
  acceptable **only** because the server gate (id-based) is authoritative; a username collision or
  rename would at worst show/hide a button wrongly, never authorize a write.

Either is fine **because the gate does not depend on it.** Dev picks; record the choice in
ARCHITECTURE per AC12. The constraint that does not move: **the gate is server-side and id-based.**

---

## Schema / migration note

**This is a no-schema-delta change — no migration.** `updateClip` / `deleteClip` already exist on
`DrizzleDataStore`, and the note-license columns (`note_license` + `note_license_agreed_at`) the
re-affirmation re-stamps already landed in D1 (`lib/db/schema.ts`). D2 surfaces two new Server Actions
over existing methods + columns; it adds **no** table, column, or migration. If Dev chooses Decision 6
mechanism (a) it changes only the client-facing `Clip` **type** + `rowToClip` mapper (a read-side
shape addition), still **no** DB migration. (If Dev discovers a genuine schema need, that is a flag
back to Product — the expectation set here is no-migration.)

---

## Success metric

D2 has no analytics backend (Analytics is deferred); success is the **owner-only edit/delete loop +
the ownership gate working end-to-end**, verified at QA/UX review against the ACs:

- **Primary (the capability is real and owner-only):** A signed-in curator can **edit** each
  curator-authored field of **their own** clip and **delete** their own clip (with confirmation), and
  both reflect immediately and survive reload (AC1/AC2/AC3) — while a **non-owner** and an **anonymous**
  caller are **rejected server-side** and change nothing (AC4/AC5/AC6). This is the binary "I can
  revise/retract **my** vouch and only mine" check: today it is zero (the methods are off the boundary).
- **Secondary (the license stays honest):** A material note-text edit **re-affirms** the CC BY-SA
  agreement with a fresh timestamp; a chip/section-only edit does **not** (AC9/AC10) — implementing
  §5.3 so the captured agreement keeps binding to the note as published.
- **Foundational (no regression, correct edges):** Legacy `@prototype` clips are editable/deletable by
  no one (AC8); reading stays anonymous with no new read-path work; the ownership check is server-side
  and id-based (Decision 6), so a hidden button is never the security control.

A future Analytics role would instrument edit/delete rates and revision frequency on the shared DB;
for D2 the success check is the manual + tested end-to-end above (owner edits/deletes; non-owner and
anonymous rejected; re-affirmation behavior; legacy clips inert), not a metric pipeline.

---

## Hand-off

- **UX:** produce the buildable flow/design spec for **D2** on top of the committed Topic-page design
  and D1's curate surface. What D2 needs from UX:
  - **The owner-only Edit + Delete affordances on a clip** (AC7): where they sit on a curated clip
    card, shown **only** on clips the signed-in contributor owns (and on **no** clip when logged out),
    honoring the Indigo Press identity + AA accessibility (text-labeled, keyboard-operable, focus-
    visible — never color-alone). Delete is destructive: design the **confirmation** step (AC3) so a
    delete is never a single accidental click.
  - **The edit surface**, reusing the D1 curate form (`CurateFields` / Curate modal) **pre-filled**
    with the clip's current note/stance/accuracy/section, with real pending/success/error states (the
    D1 bar: no false success; on a server error the modal stays open with the edits intact).
  - **The §5.3 re-agreement control on a material note edit** (AC9): when the note text changes,
    present D1's required CC BY-SA agreement control (re-using the §5.3 canonical microcopy); on a
    non-material edit it is not required. Coordinate with Dev on how "material" is signalled to the UI
    (the Decision 3 normalized-text rule).
  - Evaluate the built UI against AC2, AC3, AC7, AC8.

- **Development:** build in-scope items 1–8 against AC1–AC12 — add `updateClipAction` /
  `deleteClipAction` to `lib/server/actions.ts` with `requireContributor()` **then** the **id-based
  ownership check** (`clip.curatorId === contributorId`, loaded from the DB — reject otherwise);
  restrict the update to the editable set (Decision 2) and apply the D1 closed-enum/length guards to
  the patch; implement the §5.3 re-stamp (material note-text change → new `noteLicense` +
  `noteLicenseAgreedAt`; else leave them — Decision 3); surface both on the client seam
  (`lib/data/store.ts` / `lib/data/index.ts`) and remove the "off the boundary" note now that
  ownership exists; pick the Decision 6 affordance mechanism (expose `curatorId` read-only **or**
  compare `curatedBy` — the gate stays id-based regardless) and wire the owner-only affordances + the
  no-reload reflect (AC2/AC3). **No** migration is expected (see *Schema / migration note*). Add the
  AC11 tests (session/provider stubbed, pglite DB; the non-owner/anonymous rejection tests are the
  security tests). Record the as-built ownership rule + affordance choice in ARCHITECTURE (AC12). Hand
  to QA & Review.

- **Curation/Editorial:** D2 **implements** §5.3's edit re-affirmation forward-note (material note
  change re-affirms; chip/section-only does not). No editorial change is requested — a hand-shake, not
  a hand-off. Flag for Curation only if the re-agreement copy or the "material change" line needs
  sign-off.

- **QA & Review:** verify AC1–AC12 with fresh, non-author eyes, plus the standard security pass — the
  **server-side ownership gate** (AC4/AC5/AC6/AC8) is the only thing between a non-owner/anonymous
  request and a destructive write, so test it at the **action**, not the button. Confirm the hard
  delete actually removes the row and that dismissals are unaffected (Decision 4), and that the §5.3
  re-stamp fires on a material note edit and **not** on a chip-only edit (AC9/AC10). A live OAuth
  round-trip cannot run in CI — stub the session (a contributor distinct from `curatorId` for the
  non-owner tests).

- **Operations:** no new infra, **no migration** (Decision / Schema note). Same deploy path as
  D1/C; nothing new to provision.
