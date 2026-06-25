# Spec: Curator can mark one "hero" video per topic for prominent placement

- **Status:** Product spec for build-loop — GitHub issue #158. Written **before** UX/Dev.
- **Owner:** Product
- **Implements:** Issue #158 — "[build] Hero video: a curator can mark one must-watch clip per topic
  for prominent placement."
- **Inputs read:**
  - GitHub issue #158 — owner intent, the decision/design step (data-model + eligibility), in-scope /
    out-of-scope, "done when", and the open questions encoded below.
  - `docs/VISION.md` — "What 'good' looks like" (a reader leaves with 2–5 clips they're glad they
    watched and knows how to weigh each) and "reader utility first": a hero points the reader at the
    one clip that best introduces the topic.
  - `docs/TOPIC_PAGE_DESIGN.md` — §"The General strip — the one crossover" (placement + curated-tile
    anatomy), §"Curated player anatomy", §"Logged-out reader model (issue #71)", §"Data implications".
  - `docs/ARCHITECTURE.md` — §"Data model" (the `topic` / `clip` entities — where the hero designation
    lives), §"Persistence — Drizzle/Postgres behind a server data-access boundary" (Server Actions,
    the gate→limit→write contract, the curator-set `closed_to_suggestions` precedent).
  - `docs/specs/topic-complete.md` (issue #159) — the prior art for a **curator-set topic-level flag**:
    a plain column on `topic`, a curator-gated Server Action on the gate→limit→write contract, an
    optimistic-with-rollback host write, and a presentational derivation in `TopicView`. The hero is
    the same shape (a topic-level designation, any-curator-set), so this spec mirrors it deliberately.
  - `docs/specs/curated-suggested-coexistence.md` (issue #60) — the General-band three-state model
    (curated group always first; the hero is a re-ordering + re-rendering *within* the curated group,
    never a new state).
- **Hand-off:**
  - **UX / Design** — authors the design spec *before* Dev: the prominent hero treatment at the front
    of the General strip (the candidate layout in §4.3 is a starting point — UX owns the final form),
    keeping every standard trust signal; the on-tile/in-block **Mark as hero / Unmark** control and its
    label/placement (signed-in only); the logged-out parity (prominence visible, control absent); and
    the responsive + accessibility behavior across mobile/tablet/desktop.
  - **Development** — implements against the UX design spec + the AC below: the data-model change + its
    Drizzle migration, the DataStore method enforcing at-most-one, the curator-gated Server Action, and
    the prominent render + control. *How* (the exact column, the render seam) is a Dev call within §3.
  - **Curation / Editorial** — **no new vocabulary.** "Hero" is a topic-level prominence/placement act,
    not a clip `stance`/`accuracy_flag`, and it introduces no new context-note, attribution, or
    moderation rule. Flagged here only so Editorial can confirm the hero retains every existing trust
    signal (it does — §3.3) and that prominence never overrides the accuracy/stance honesty of a clip.
  - **QA & Review** verifies against the **Acceptance criteria** (§5); UX evaluates the built UI.

---

## 1. Problem

On many topics there is a single **must-watch** video — the one clip a curator would hand a newcomer
first. Today the General strip treats every curated clip with equal weight: each is a uniform `w-44`
tile in one horizontally-scrollable row, in arrival order. The standout clip is just one tile among
many, with nothing to draw the reader's eye to it. A curator who knows which video best introduces the
topic has no way to *say so*, and a reader arriving cold has no signal for where to start.

## 2. User value

- **As a curator,** I can mark one curated clip as this topic's **hero** (and unmark it), so I can
  point readers at the single video that best introduces the topic — and change my mind freely.
- **As a reader,** the hero video is visibly emphasized over the other clips (larger, first), so I
  know where to start without having to judge every tile myself.
- **As the self-directed learner the plus side serves first** (`VISION.md`), I get a curator's "start
  here" signal while every other curated clip — and its trust signals — still reads normally.

## 3. The decision + model (load-bearing)

### 3.1 Data-model decision — a topic-level `hero_clip_id` reference

The issue offers two representations; the decision is a **topic-level reference**, not a clip-level
boolean:

| Concern | Decision |
|---|---|
| **DB representation** | `topic.hero_clip_id` — a **nullable FK → `clip.id`**, `ON DELETE SET NULL`. `NULL` ≙ no hero. |
| **App / type field** | `Topic.heroClipId?: string` (the stringified clip id, matching `Clip.id`; `undefined` ≙ no hero). |
| **At-most-one enforcement** | **Structural** — a single column holds one value, so two heroes are *unrepresentable*. |
| **Set a new hero / replace the prior** | One atomic `UPDATE topic SET hero_clip_id = …` — replacing the prior hero is the same write, no transaction, no read-modify-write race. |
| **User-facing verb / label** | **"Mark as hero"** / **"Unmark hero"**; a clip is **"the hero."** |

**Why a topic-level reference, not a clip-level `hero` boolean.** The invariant the issue names —
*at most one hero per topic, setting a new one clears the previous atomically* — is **free** with a
single column: there is no second value to clash with, and replacing the hero is one UPDATE. A
clip-level boolean would need a partial unique index *and* a clear-old-then-set-new transaction to hold
the same invariant, with a race window between the two writes. The reference also models the
relationship honestly (the topic *has a* hero) and matches the existing curator-set topic-level flag
precedent (`closed_to_suggestions`, issue #159). `ON DELETE SET NULL` means a deleted or
moderator-removed hero clip clears the reference automatically — no dangling hero, no orphan cleanup.

### 3.2 Eligibility — curated, general clips only (this run)

- **Curated clips only, never candidates.** A hero is a clip the topic *has vouched for*. Auto-suggested
  candidates are **not** `clip` rows (they are computed/cached, never stored — `ARCHITECTURE.md`), so a
  candidate is structurally ineligible: the FK can only reference a real `clip`. This is enforced by
  construction, not just by UI.
- **General / whole-topic clips only, this run.** Resolving the issue's open question: the hero must be
  a **General** (`clip.general = true`) clip, not a section-anchored one. Default leaning from the issue,
  taken: it keeps the hero a **single-place** layout (the front of the General strip) with no
  section→General hoisting or mirroring to design. The server **rejects** an attempt to hero a
  section-anchored clip. *(Allowing a section-anchored hero is an explicit possible future evolution —
  §6.)*
- **Held / not-yet-vouched clips:** a hero may be any curated General clip the topic shows, including a
  clip currently **held** for review — it still renders its held marking in the hero slot (the marking
  is never suppressed). A **removed** clip cannot be a hero (it leaves the read, and `ON DELETE SET
  NULL`-style clearing applies). No extra gate beyond "curated + general."

### 3.3 Interaction model (what the hero does)

`topic.hero_clip_id = <a general clip's id>` makes that clip render **first and prominently** in the
General strip — a larger, visually-emphasized presentation ahead of the remaining (uniform) curated
tiles — for **every** viewer. It changes **only presentation and order**: the hero keeps **every**
standard trust signal it has as an ordinary tile — the stance + accuracy chips, the context-note
preview, the `context by <curator>` attribution, the upvote control, the held marking if held, and the
owner Edit/Delete + reviewer Hold/Approve/Remove affordances. Prominence is *placement*, never a change
to the clip's data, its accuracy/stance assessment, or its vouch.

The hero designation **rides the topic read** (`heroClipId` on the already-loaded `Topic`); the strip
marks a clip as the hero by comparing each general clip's id to it. So the prominence is the **same for
every viewer** and the cached read path does **no per-user work** to render it — the logged-out parity
(§3.5) holds by construction.

### 3.4 Who can set / clear it

Setting and clearing the hero is a **curation act**: available to **any signed-in curator** (the same
bar as adding/curating/marking-complete). No moderation lock, no ownership restriction — any signed-in
curator can mark a hero and any signed-in curator can change or unmark it. A **logged-out reader
cannot** set or clear it; they see the prominence but no control. The any-curator-override (one curator
can change another's hero with no audit trail) is **accepted for the prototype**, consistent with the
other curation actions (flagged for a later audit/permission revisit — §6).

### 3.5 Logged-out parity (issue #71)

The hero's **prominence is visible to everyone**, logged-out included (it rides the topic read). The
**mark/unmark control is signed-in-only** — an affordance gate. As everywhere in the product, the
affordance gate is not the security control: the Server Action re-checks the signed-in curator
server-side and rejects an anonymous/expired call regardless of the button (§5 AC4).

### 3.6 Docs to update (part of done)

- `docs/ARCHITECTURE.md` §"Data model" — add `topic.hero_clip_id` (nullable FK → `clip`, `ON DELETE
  SET NULL`; at-most-one is structural; curated + general eligibility) and note the new curator-gated
  Server Action on the gate→limit→write contract.
- `docs/TOPIC_PAGE_DESIGN.md` §"The General strip" — record that one curated General clip may be the
  topic's **hero**, rendered prominently at the front of the strip with all trust signals, set/cleared
  by any signed-in curator; logged-out sees the prominence, not the control.

---

## 4. Scope

### 4.1 In scope

- A topic-level `hero_clip_id` reference (nullable, default none), persisted in shared Postgres,
  set/cleared by **any signed-in curator** via a curator-gated Server Action.
- **Server-side at-most-one enforcement** — setting a new hero replaces the previous in one atomic
  write (structural, per §3.1).
- The **prominent hero rendering** at the front of the General strip + the **Mark as hero / Unmark**
  control on curated General clips (signed-in only).
- **Logged-out parity:** the hero prominence is visible; the control is not (§3.5).
- **Eligibility enforcement:** only a curated **General** clip can be the hero; a section-anchored clip
  or a candidate is rejected (§3.2).

### 4.2 Out-of-scope behaviors it must not introduce

The hero changes presentation/order only. It must not alter candidate/unvetted tiles, the empty state,
the suggestion pipeline, or any clip's stored data. See §6.

### 4.3 Candidate hero layout (UX owns the final form)

A starting point, **not** a mandate — UX resolves the final treatment: the hero takes the **full
General-strip width** with a **large thumbnail and the metadata + context-note beside it (horizontal)**
rather than the default stacked `w-44` tile, rendered **above** the existing scroll row of the
remaining curated tiles + suggestions. It carries a **text-labeled prominence marker** (e.g. a "★ Hero"
eyebrow — the word carries the meaning, never color alone), the play affordance, and all the standard
trust signals named in §3.3. On a narrow viewport it stacks (thumbnail above metadata) but stays
visibly more prominent than a peer tile.

---

## 5. Acceptance criteria (numbered, testable)

Each is verifiable by QA against the built app.

1. **Curator can mark a hero.** A signed-in curator viewing a topic can activate "Mark as hero" on a
   curated General clip; afterward the topic's stored `hero_clip_id` equals that clip's id.
2. **Curator can unmark the hero.** A signed-in curator can clear the hero; afterward the stored
   `hero_clip_id` is `NULL` and no clip renders in the prominent hero slot.
3. **At most one hero — a new mark clears the prior.** With clip A the hero, a curator marking clip B as
   hero leaves `hero_clip_id = B` and **not** A — exactly one hero exists at any time, enforced
   server-side in one atomic write (no window in which two clips are the hero).
4. **Logged-out viewers cannot set or clear it.** A logged-out viewer is not offered (and cannot invoke)
   any hero mark/unmark control; an attempt to invoke the action without a signed-in curator is rejected
   server-side and the stored `hero_clip_id` is unchanged.
5. **The designation persists (shared Postgres).** After a curator marks a hero, a *fresh* page load
   (new request / new session, any viewer) reads the same hero — it is durable in Postgres, not
   session/in-memory.
6. **The hero renders prominently.** On a topic with a hero, that clip renders at the **front** of the
   General strip in a visibly larger/emphasized layout, distinct from the uniform peer tiles, carrying
   a text-labeled prominence marker.
7. **The hero retains all trust signals.** The hero renders its stance + accuracy chips, its
   context-note preview, its `context by <curator>` attribution, and its upvote control — the same
   signals a peer curated tile carries (a held hero also shows its held marking).
8. **Peer clips still render.** The remaining (non-hero) curated General clips still render in the
   normal scroll row, after the hero; no curated clip is dropped or hidden by the hero treatment.
9. **Logged-out parity — prominence without control.** A logged-out reader sees the hero's prominence
   (AC6/AC7) but is shown **no** mark/unmark control on any clip.
10. **Eligibility — candidates are never heroable.** No "Mark as hero" control appears on an
    auto-suggested candidate tile (candidates are not curated clips); the data model cannot reference one.
11. **Eligibility — general only (this run).** The mark-as-hero control appears only on **General**
    curated clips, not on section-anchored ones; an attempt to hero a non-general clip is rejected
    server-side and the stored `hero_clip_id` is unchanged.
12. **Deleting/removing the hero clip clears the designation.** If the hero clip is deleted (owner
    hard-delete) or removed (moderator soft-removal), the topic no longer reports a hero (`hero_clip_id`
    is `NULL` / resolves to no clip) and the strip renders with no prominent slot — no dangling/broken
    hero.
13. **No-reload reflect.** Marking/unmarking a hero updates the rendered strip without a full page
    reload (optimistic, reconciled to the server's authoritative value; on failure it rolls back to the
    pre-click state with a calm notice).
14. **Accessibility baseline.** The mark/unmark control and the prominence marker are keyboard-operable
    with visible focus, meet AA contrast, and carry text labels for their state (never color alone) —
    consistent with the project accessibility baseline.

---

## 6. Out of scope (explicit)

- **Finer-grained tiering** — no "prestige" videos per sub-area, no multiple coexisting heroes, no
  ranked ordering beyond the single hero (a possible future evolution, not this build).
- **A section-anchored hero** (and any section→General hoisting/mirroring). This run keeps the hero a
  General/whole-topic clip; allowing a section hero is an explicit future revisit (§3.2).
- **A new permission/moderation tier for hero.** It is an ordinary any-curator action this run; no
  ownership lock, no moderator gate.
- **An audit trail / history** of who set the hero and when (no `hero_set_by` / `hero_set_at`; the
  reference is a plain nullable column).
- **Changes to candidate/unvetted tiles, the empty state, or the suggestion pipeline.**
- **Any change to the hero clip's stored data** — prominence is placement only; the clip's note, chips,
  accuracy/stance, attribution, and votes are untouched.

---

## 7. Success metric

**Primary — adoption of the hero on curated topics.** The share of topics with ≥2 curated General
clips whose curators designate a hero, trending up, signals curators reaching for the "start here"
declaration the feature provides. A healthy signal is that heroes are set and *kept* (a low churn /
re-mark rate), indicating the hero reflects a real "best introduction" judgment rather than churn.

**Secondary — the hero earns the start.** On topics with a hero, the hero clip's play/upvote rate
relative to peer clips on the same topic should run **above** an equal share — evidence that the
prominence is steering readers to a clip they're glad they watched (the VISION "what good looks like"
bar), not merely re-ordering noise.

*(Analytics is a deferred role; these are the metric definitions Product owns until it splits out. No
instrumentation is required to ship this feature.)*
