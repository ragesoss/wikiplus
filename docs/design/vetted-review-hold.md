# Design Spec: The held "in review" third clip-state + the reviewer Hold/Approve affordances (milestone D5b)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#58](https://github.com/ragesoss/wikiplus/issues/58) — milestone **D**, run **5b of 5** (D5a rate-limit shipped / **D5b** vetted-hold + role model / D5c moderator removal)).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/vetted-review-hold.md` — the Product spec. This design serves **AC1–AC9** and the
    reader/reviewer/curator stories below, and honors Decisions **1** (`vetted boolean default true`;
    new adds publish-by-default; existing backfill published), **2** (binary moderator role set
    out-of-band; the role-gate authority is **server-side**), **3** (**hold** = moderator-any OR
    curator-own; **approve** = moderator-only, no self-approve; gate→limit→role→write), **3b** (held =
    **shown-but-marked**, visible to anonymous readers, a third state distinct from curated and from a
    candidate), and **4** (the held-state is a property of the **clip** and rides the clip read; **no**
    per-user work on the cached read path).
  - `docs/CURATION_STANDARD.md` **§7.1 / Decision C8** — the **editorial contract** for what "held"
    means and the **verbatim** marking microcopy, used **unchanged** (centralized; Dev derives the
    marking from the clip's held flag):
    - eyebrow / badge: **"In review · not yet vouched"**
    - one-line explainer (where space allows): **"A curator added this and wrote a note, but it hasn't
      passed review yet — weigh it accordingly."**
    - accessible name: **"In review — not yet vouched for by a reviewer."**
    - **Tone guard (binding):** the marking reads as **"in review," never "removed / bad / flagged."**
      No alarm words ("flagged," "rejected," "warning," "problem"); no color as the sole signal; gold is
      not a functional signal. The held state is a **neutral status** in the register of §1.3.
  - `docs/design/clip-edit-delete.md` (D2) — the **owner manage-row** pattern (the `role="group"`
    Edit/Delete row on `ClipCard` below the provenance footer, the `ownsClip()` mechanism, the
    pending/error/expired modal state patterns). D5b's reviewer **Hold/Approve** affordances **parallel**
    this exact pattern — a second row, on the same surface, gated on **role** (and ownership for hold)
    rather than only ownership. This spec specifies the **deltas**, not a redesign.
  - `docs/design/contributor-profiles.md` (D3) + `docs/design/upvotes.md` (D4) — how a per-viewer /
    per-role affordance is computed **only** in the already-authenticated client session, **off** the
    cached read path (the "split the public part from the per-viewer part" rule: `ownsClip()` /
    `votedClip()` run in the client session, with **no** read-path cost). D5b reuses this exact pattern
    for an `isModerator` client-session check.
  - `docs/design/topic-page-v1.md` — **the committed Topic-page baseline.** Specifically: the curated
    clip card **§5.9** (chips + curator note + provenance footer); the `GeneralStrip` tile **§5.5 /
    §6.3**; the §6 **candidate** rendering (`CandidateBits` — the dashed `candcard`, the "Suggested ·
    uncurated" violet header, no chips/note/curator — the un-vouched auto-suggestion the held state must
    be **distinct from**); chips + **AA contrast §9.3** (the load-bearing ratios); **focus-visible §11.2**
    (3px indigo outline, 2px offset); text-labeled signals **§11.1**; **responsive §12**.
  - `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity); reference mockups
    `mockups/inline-indigo-sync.html` (curated).
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/ClipCard.tsx` — the curated rail card. D5b adds (a) the **held marking** above the
    chips row when the clip is held, and (b) a **reviewer manage-row** parallel to the existing D2
    owner row (lines 142–165), gated on the new `isModerator` / own-curator predicates.
  - `components/topic/GeneralStrip.tsx` — the curated tile (lines 197–261). D5b adds the **compact held
    marking** to the tile and the reviewer affordance(s) in/next to the existing manage-row (lines
    236–259).
  - `components/topic/CandidateBits.tsx` — the **§6 unvetted vocabulary** (`CandidateSetHeader`'s
    violet "Suggested · uncurated", the dashed `candcard`). **For contrast only — not reuse.** The held
    marking must be visibly and textually different from this.
  - `app/topic/TopicView.tsx` — `myContributorId` from `useSession()` (line 69), `ownsClip()` (lines
    899–903 — the D2 own-curator compare the **Hold** affordance reuses), `signedIn` (line 993), the
    three-arm error catch (`isAuthRequired` → `showExpiredGate()`; `isRateLimited` → the calm limit
    notice; else generic — lines 1024–1031 / 967–973), the optimistic no-reload in-memory `clips`
    mutation pattern (`runUpvote` / the edit/delete reflect), `focusBandHeading()` (line 655). D5b
    **adds** an `isModerator`-from-session client-session check (the D2/D4 off-read-path pattern) and a
    `runHold` / `runApprove` pair that mutate the in-memory clip's held flag with no reload.
  - `lib/auth/microcopy.ts` (`AUTH_COPY` — the gate / error / `rateLimit.notice` strings the reviewer
    actions reuse; D5b adds **no** new login-gate string — Hold/Approve are reviewer affordances, never
    shown logged out).
- **Feeds:** Development (build to **this spec** for the D5b deltas, on top of the committed
  `topic-page-v1.md §5.9` clip card, the D2 manage-row, and the §6 candidate vocabulary it must be
  distinct from). Then QA & Review (correctness/security — the **server-side role-gate** is theirs) +
  UX evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the **deltas** D5b adds: a
> **third clip-state** — the held "in review" marking on the `ClipCard` and the `GeneralStrip` tile (a
> real curated clip, note + chips + curator intact, marked as not-yet-reviewer-confirmed) — plus the
> **reviewer-only Hold and Approve affordances** (a second manage-row, parallel to D2's owner row), and
> the **no-reload reflect** of both actions. It does **not** redesign the card, the chips, the note, or
> the candidate/empty treatment. Every requirement is tagged with the Product AC(s) and the story it
> makes buildable. **The security control is the server-side, role-resolved gate inside the hold /
> approve actions (Decision 3 / AC4/AC5) — never these affordances; this spec designs the affordances
> and never claims they protect the action.**

---

## 1. Personas & stories served

D5b touches all three Topic-page personas (`topic-page-v1.md` §1). The **reader (P1)** is the primary
beneficiary of the held marking (a clip whose vouch she can weigh more precisely); the
**reviewer/moderator (P3)** is the primary *actor* — for the first time in the product P3 has tooling;
the **curator (P2)** gains exactly one new act on their own clip (hold).

### P1 — Priya, the weighing reader (PRIMARY beneficiary of the marking)
Anonymous, unchanged. wiki+'s whole promise to her is calibrated trust — she can *weigh* each clip. The
held marking extends that honesty to the act of curation itself: a clip she sees marked **"In review ·
not yet vouched"** tells her a real person added it and wrote a note, but the vouch is **still being
checked** — so she weighs it as a real curation that has not yet earned the site's full vouch. She does
**not** log in to read this; the held marking is public, the same for every viewer, and rides the clip
read (Decision 3b/4). She may be colorblind, on a keyboard, or on a screen reader — the marking is a
**word**, never a color, and carries an accessible name.

### P3 — Mod, the reviewer/moderator (PRIMARY actor — first tooling in the product)
A `contributor` granted the moderator role **out-of-band** (Decision 2 — there is no in-app grant UI;
the role-gate authority is server-side). Mod can **Hold** a published clip (pull it into review — on
*any* clip) and **Approve** a held clip (flip it back to fully curated — moderator-only). Mod works
mostly on desktop but may be on a phone, a keyboard, or a screen reader; every affordance must work for
all of those. Mod's affordances are the convenience layer; the action's **server-side role-gate** is the
authority — a hidden button never authorizes anything.

### P2 — Marcus, the curator (gains one new act: hold his own clip)
The D1/D2/D3/D4 curator. D5b adds exactly one capability for him: he may **Hold** a clip **he curated**
(pull *his own* vouch into review — the editorial parallel of D2's "a curator may revise or retract his
own vouch," a self-limiting act since he can only hold what he authored). He **cannot Approve** — not
even his own held clip (the vouch must be confirmed by someone other than its author — §7.1 / Decision
3). A curator who has second thoughts about his own held clip uses D2 edit/delete; *restoring* the full
vouch is a reviewer's call.

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S21 — weigh a clip that's still in review.** *As a reader, I want a clip whose vouch hasn't passed
  review yet to be clearly marked "in review" — while still showing me its note and chips and who
  curated it — so I can tell it apart from a fully-vouched clip and from a raw auto-suggestion, and
  weigh it accordingly.* *(AC1, AC2; CURATION §7.1.)*
- **S22 — tell the three states apart at a glance.** *As a reader, I want a held clip, a fully-curated
  clip, and an auto-suggested candidate to be distinguishable from the **text/marking**, not the color,
  so I get the right level of trust even if I'm colorblind or on a screen reader.* *(AC1, AC2; CURATION
  §4 / §7.1.)*
- **S23 — hold a clip for review.** *As a reviewer, I want to put a published clip into review (any
  clip), or — as the clip's own curator — pull my own clip into review, so a clip that needs a second
  look stops carrying the full vouch until it's confirmed; and I see the marking appear without a
  reload.* *(AC1, AC3a; Decision 3.)*
- **S24 — approve a held clip back to live.** *As a reviewer, I want to approve a held clip (and only a
  reviewer can), so it carries the site's full vouch again — and I see the "in review" marking go away
  without a reload.* *(AC3; Decision 3.)*
- **S25 — I'm not handed a control I can't use, and the action is told to me honestly.** *As a viewer
  who isn't a reviewer (or who's logged out), I want **no** Hold/Approve control offered to me; and as a
  reviewer, when an action fails I want to be told it didn't take — never a control that reads as if it
  worked when nothing changed.* *(AC4, AC5 (the affordance side); the D1/D2/D5a state bar.)*

---

## 2. The two flows, end to end

Both flows begin on the **curated** Topic page (`mode === "curated"` in `TopicView`), on a clip the
viewer can act on as **a moderator** (Hold any clip, Approve a held clip) or — for Hold only — **the
clip's own curator**. The reviewer affordances (§4) are the only new triggers; the no-reload reflect
(§5) reuses the in-memory `clips` mutation pattern the edit/delete/upvote paths already use.

> **The gate vs. the affordance (binding, set by Decision 3 / §7.1).** The affordances in §4 decide
> *which* cards show Hold/Approve; they are convenience + clarity. The **authorization** is the
> server-side, role-resolved check inside `holdClipAction` / `reviewClipAction` (approve →
> `isModerator`; hold → `isModerator` OR `clip.curatorId === session contributorId`; AC4/AC5) — Dev's,
> verified by QA at the action. This design never relies on a hidden button to protect the action; §4.1
> fixes the affordance constraint, the rest is the experience.

### 2.1 Hold a clip (publish → held) — S23 / S25
1. **Trigger.** A reviewer activates **"Hold for review"** on a published clip they can hold (§4.2) — a
   moderator on any clip, or the clip's own curator on their own clip. No login gate is needed at the
   trigger (the affordance only renders when signed-in *and* authorized — §4.1); the **submit** is
   still gated server-side (the expired-session route, step 3, covers the in-between).
2. **In flight.** The Hold control disables + shows a busy **word** (**"Holding…"**); no double-submit
   (a per-clip in-flight guard, the `runUpvote` / `upvoteInFlight` pattern). The card is otherwise
   undisturbed.
3. **Result.**
   - **Success →** the action returns the updated clip (`vetted = false`). The clip's held flag flips
     in the in-memory `clips` set; the card **re-renders held** — the **"In review · not yet vouched"**
     marking appears (§3), the chips/note/curator stay intact, and the manage-row swaps Hold for
     **Approve** if the actor is a moderator (§4.2) — **no reload** (§5.1, AC1). Focus stays on the
     manage-row (§5.3).
   - **Rate-limited →** the calm **`AUTH_COPY.rateLimit.notice`** limit notice (D5a — *"You're doing
     that a bit too fast — give it a moment, then try again."*); the clip is **unchanged** (still
     published); the Hold control returns to idle (§6).
   - **Expired session →** the boundary rejects with `AuthRequiredError`; `showExpiredGate()` surfaces
     the verbatim **"Your session ended — please log in again."** prompt (D1 §7.2); the clip is
     unchanged (§6).
   - **Other error →** the generic, non-blocking polite notice (*"Couldn't hold that — please try
     again."*); the clip is unchanged; the Hold control returns to idle (§6).

### 2.2 Approve a held clip (held → published) — S24 / S25
1. **Trigger.** A **moderator** activates **"Approve"** on a held clip (§4.2). (Only a moderator sees
   Approve — a curator, including the held clip's own curator, never does; §4.1.)
2. **In flight.** The Approve control disables + shows **"Approving…"**; no double-submit.
3. **Result.**
   - **Success →** the action returns the updated clip (`vetted = true`). The held flag flips in the
     in-memory `clips` set; the card **re-renders fully curated** — the "In review" marking is **gone**,
     the full vouch restored; the manage-row swaps Approve back for **Hold** (still available to a
     moderator) — **no reload** (§5.1, AC3). Focus stays on the manage-row (§5.3). The change survives a
     reload (a fresh `listClips` — Dev/QA, the server write).
   - **Rate-limited / Expired / Other error →** exactly as §2.1 step 3, with the approve copy:
     rate-limit → the calm `rateLimit.notice`; expired → the expired-session gate; other → *"Couldn't
     approve that — please try again."* The clip stays **held** in every failure case (§6).

> **Curator-approve is not a UI path (it's a server reject).** A curator never sees an Approve
> affordance on their own held clip (§4.1), so curator self-approve is unreachable through the UI. The
> **server still rejects** a direct curator-approve call (AC3a/AC4) — that reject, at the action on the
> role, is the load-bearing security behavior, not the hidden button.

---

## 3. The held "in review" third-state rendering (the core D5b delta) — AC1 / AC2

This is the heart of S21/S22. A held clip is a **real curated clip whose vouch is not yet
reviewer-confirmed** (§7.1) — so it **keeps everything** a fully-curated clip has (the curator note, the
stance + accuracy chips, the curator attribution) and **adds one thing**: a calm, text-labeled
**"In review · not yet vouched"** marking. It must be **visually and textually distinct from both**:
(a) a fully-curated clip (which has **no** marking and carries the full vouch), and (b) a §6 candidate
(which has **no** note, **no** chips, **no** curator, and uses the dashed `candcard` + violet "Suggested
· uncurated" language). The held marking borrows §6's *honesty register* (a once-told "not vouched-for"
tell) **without** §6's *content-stripping* and **without** §6's *dashed/violet candidate styling*.

### 3.1 Public, rides the clip read, derived from the held flag (binding — AC1 / Decision 3b/4)
- The held marking is **public** — shown to **anonymous** readers exactly as to signed-in ones — and is
  **derived from the clip's held flag** (`vetted === false`, surfaced on the client `Clip` shape and
  riding `listClips` — Dev, Decision 4). It is **not** per-viewer; the cached read path does **no**
  per-user work to render it (the marking is a property of the clip, like the chips and the note). An
  anonymous reader sees the held marking with no login and no per-user query (AC7 — read-path
  discipline). The marking renders the **same** in `mode === "curated"` for every viewer.

### 3.2 The held marking on the `ClipCard` (rail) — full treatment
On a held rail card (`ClipCard`, where the clip is `vetted === false`), add a **held-marking block**
**above the chips row** (i.e. between the creator credit and the chips, `ClipCard` line ~97 — so it
reads as a status banner for the whole vouch, ahead of the chips it qualifies). The chips, the curator
note, the provenance footer, and the creator credit are **unchanged** and remain present.

- **Container.** A compact block, full card width, marked up so AT announces it as the clip's status —
  e.g. a `<p>`/`<div>` carrying the verbatim accessible name (see below). Visual treatment: a **solid**
  (never dashed) hairline-bordered status strip in a **calm neutral** register — recommended a `bg-bg2`
  fill with a **2px solid `border-ink` left rule** (matching the curator note's solid-left-border
  language, *not* the candidate's dashed left border) and a small status dot that is **decorative**
  (`aria-hidden`) and never the sole signal. **Do not** use the dashed `candcard` border, **do not** use
  `accred`/red, **do not** use gold. The block must read *quieter* than the chips, not louder — a status
  note, not an alarm.
- **Eyebrow (verbatim, the signal-word).** **"In review · not yet vouched"** — uppercase
  `text-[10px]` bold, ink (or ink2), the same eyebrow typography as the "Curator note" eyebrow on the
  card (so it reads as a sibling status label, not a warning). The **word "In review" carries the
  meaning** (never color-alone — §7); "not yet vouched" ties it to the vouch language.
- **Explainer (verbatim, where space allows).** **"A curator added this and wrote a note, but it hasn't
  passed review yet — weigh it accordingly."** — `text-[11px]` leading-snug, ink2, below the eyebrow.
  The rail card has the vertical room (it already holds the full note), so the explainer **is shown** on
  the rail card.
- **Accessible name (verbatim).** The block carries **"In review — not yet vouched for by a reviewer."**
  as its accessible name — recommended an `sr-only` lead inside the block (so a screen-reader user hears
  the status before the chips/note), or an `aria-label` on the block container. The decorative dot is
  `aria-hidden`.
- **Distinctness — the three-way contrast (AC2), explicit:**
  - **vs. a fully-curated clip:** the held card has the marking block; a fully-curated card has **none**
    (the marking's presence/absence is the tell; both keep chips/note/curator). A reader can tell them
    apart by the **words "In review · not yet vouched."**
  - **vs. a §6 candidate:** the held card **keeps** its chips, its curator note, and its curator
    attribution (a candidate has **none** of these — it shows only a match reason + a source pill on a
    dashed `candcard` with the violet "Suggested · uncurated" header). The held marking uses a **solid**
    border + **ink** label + the **"In review"** word; the candidate uses a **dashed** border + **violet**
    label + the **"Suggested · uncurated"** word. They are distinct in **structure** (chips/note/curator
    present vs. absent), in **word** ("In review" vs. "Suggested · uncurated"), and in **styling** (solid
    ink vs. dashed violet) — three independent tells, none of them color alone.

### 3.3 The held marking on the `GeneralStrip` tile — compact treatment
The General tile (`GeneralStrip`, `mode === "curated"`, lines 197–261) is a narrow `w-44` overview tile
with little vertical room. On a held General clip, show the **eyebrow only** (the explainer is the
"where space allows" case — and on the tile it does **not** fit, so it is **omitted**), placed **above
the caption** (so the status reads first) or directly under the caption — Dev's call, but it must be
**legible on the indigo band**:

- **Eyebrow (verbatim).** **"In review · not yet vouched"** — because the General band is the **indigo
  brand fill** (`bg-brand`, white text), the eyebrow must clear AA on indigo. Render it on a **small
  white-fill pill** (`bg-white` + `border-2 border-ink`, ink text — the same white-on-indigo tactic the
  band's existing controls and the empty-state "uncurated" treatment use for legibility), uppercase
  `text-[10px]`/`text-[11px]` bold. **Do not** put ink text directly on the indigo fill (fails AA), and
  **do not** reuse the empty-band's **"uncurated"** white-outline pill (that is the §6 candidate word —
  the held tile must say **"In review · not yet vouched,"** never "uncurated").
- **Accessible name (verbatim).** The pill carries **"In review — not yet vouched for by a reviewer."**
  (`sr-only` lead or `aria-label`) so the full meaning reaches AT even though the explainer is omitted
  for space.
- The tile's caption, creator subline, `ContextByLink` attribution, and upvote control are
  **unchanged**.

### 3.4 No new chip, no new "state machine" beyond the flag
The held marking is a **rendering of one boolean** (`vetted === false`) — not a new chip in the
stance/accuracy row, not a new enum. It sits **outside** the chips row (the chips keep meaning exactly
the §2/§3 fact-signal). Dev derives the marking purely from the held flag; when the flag flips (hold /
approve), the marking appears/disappears with no other change to the card (§5).

---

## 4. The reviewer-only Hold / Approve affordances (the second D5b delta) — AC4/AC5 (affordance side)

This is the visible boundary "you can review this clip." It is added to the **curated clip card**
(`ClipCard`) and the **curated `GeneralStrip` tile** — the same two surfaces the D2 owner manage-row
lives on — as a **second manage-row** (the reviewer row), parallel to D2's owner row. It is the
**convenience layer**; §2's gate-vs-affordance note binds.

### 4.1 When the reviewer affordances render (the only fixed constraint; mechanism is Dev's)
Computed **only** in the already-authenticated client session (the D2/D4 off-read-path pattern — §7),
from two predicates the host (`TopicView`) supplies:
- **`isModerator`** — true iff the signed-in viewer's session resolves the moderator role. Resolved the
  **same off-read-path way** `signedIn` / `ownsClip()` / `votedClip()` are: from the authenticated
  client session (the session claim Dev derives from the server role, *never* a client-typed flag —
  Decision 2). Default **false** (logged-out and every non-moderator); an anonymous reader does **zero**
  role work and the read-path render is byte-for-byte unchanged (AC7).
- **`ownsClip(clip)`** — the **existing** D2 own-curator predicate (`clip.curatorId ===
  myContributorId`), reused unchanged for the curator-can-hold-own case.

The affordances render as follows (and in **no** other case):

| Viewer | Published clip | Held clip |
|---|---|---|
| **Moderator** | **"Hold for review"** | **"Approve"** (+ optionally **"Hold for review"** stays available to re-hold — Dev's call; see note) |
| **Curator (own clip), not a moderator** | **"Hold for review"** (own clip only) | **no** affordance (a curator cannot approve — §7.1; restoring the vouch is a reviewer's call) |
| **Signed-in, non-moderator, non-owner** | **no** affordance | **no** affordance |
| **Logged out / anonymous** | **no** affordance | **no** affordance |

- **Hold** renders iff `(isModerator || ownsClip(clip))` **and** the clip is **published**
  (`!held`). (Holding an already-held clip is a no-op state; show Hold only on a published clip.)
- **Approve** renders iff `isModerator` **and** the clip is **held** (`held`). It renders for **no
  one else** — not the clip's own curator, not a non-moderator, not logged out.
- **Note on the moderator/held row:** the simplest correct surface is — on a **held** clip a moderator
  sees **Approve** (the primary next act); whether a moderator also keeps a **Hold/re-hold** control on
  an already-held clip is **Dev's call** (it is harmless but adds clutter) — the **required** affordance
  on a held clip for a moderator is **Approve**. Keep the row to the **minimum** that serves the state.

**The constraint that does not move (binding):** a non-moderator / non-owner / anonymous **direct
action call** is rejected **server-side** regardless of any button (AC4/AC5). The affordance mirrors but
never replaces the role-gate.

**No read-path cost (binding).** The `isModerator` check and the `ownsClip` check run **only** in the
already-authenticated client session, on data already loaded; they add **no** per-user work to the
cached read path. An anonymous reader's render is byte-for-byte unchanged (no affordance, no role read
on the read path).

### 4.2 Placement & anatomy — a reviewer manage-row, parallel to D2's owner row
The reviewer affordance(s) sit in a **second** `role="group"` manage-row on the card, **distinct from**
the D2 owner Edit/Delete row, so the two never blur (one is "my clip to revise," the other is "a clip I
can review"). Both rows are **additive** and render only for their authorized viewer; either, both, or
neither may be present (a moderator who also owns the clip sees both rows — the owner Edit/Delete row
*and* the reviewer Hold/Approve row).

- **On the `ClipCard` (rail):** the reviewer row sits **below the D2 owner manage-row** (which is itself
  below the provenance footer, `ClipCard` lines 142–165) — so the order top-to-bottom is: card content
  → owner Edit/Delete row (if owned) → reviewer Hold/Approve row (if authorized). A `role="group"` row,
  `aria-label="Review this clip"`, `flex flex-wrap gap-2`, with a hairline top divider
  (`border-t border-ink/15 pt-2 mt-2`) to separate it from the row above.
- **On the `GeneralStrip` tile:** the reviewer affordance wraps within the `w-44` tile, in/after the
  existing manage-row area (lines 236–259), same `flex flex-wrap gap-1.5` so the buttons wrap on the
  narrow tile; same `aria-label="Review this clip"` group.
- **"Hold for review"** — a `<button type="button">`, **secondary** treatment matching the D2 Edit
  affordance: white fill, 2px ink border, Source Sans Pro bold `text-[12px]` (`text-[11px]` on the
  tile), ink text, hover lifts the 2px ink offset (the `.srcbtn` / D2-Edit language). It is a **neutral**
  action (a review pause, not a destroy) — so it uses the **ink** secondary treatment, **never**
  `accred`/red (a hold is not a deletion). A leading glyph is optional + `aria-hidden`; the **word "Hold
  for review" is the signal**. `aria-label="Hold for review: <caption>"`. Activates §2.1.
  - On the indigo General tile, the white-fill + 2px-ink-border treatment already used by the tile's
    Edit/Delete buttons applies (legible on indigo; the word is the signal).
- **"Approve"** — a `<button type="button">`, treatment that reads as the **affirming / restore-vouch**
  act. Recommended the **action-blue** accent (`action #1F6F95`) — either an action-blue 2px border +
  action-blue text (secondary, parallel to Edit) **or** an action-blue fill + white text (primary
  emphasis). Action blue is the right Indigo Press signal here: it is the "do the positive thing"
  accent, distinct from indigo brand (structure) and from `accred` (destructive). **Never** gold, never
  `accred`. If a filled action-blue is used, white-on-`action` clears AA (≈5.5:1 per `topic-page-v1.md`
  §9.3 — confirm at the button's text size). A leading check glyph is optional + `aria-hidden`; the
  **word "Approve" is the signal**. `aria-label="Approve this clip: <caption>"`. Activates §2.2.

Both buttons are real `<button>`s in a sensible tab order **after** the card's existing interactive
elements (and after the D2 owner row if present): Tab-reachable, Enter/Space activates, the global
`:focus-visible` 3px indigo outline applies (`topic-page-v1.md` §11.2).

### 4.3 Microcopy — the affordances (verbatim button text + accessible names)
- **Hold button:** visible **"Hold for review"**; accessible name **"Hold for review: <caption>"**.
  (Busy: **"Holding…"** — §6.)
- **Approve button:** visible **"Approve"**; accessible name **"Approve this clip: <caption>"**.
  (Busy: **"Approving…"** — §6.)

These are reviewer affordances — they are **never** shown logged out, so D5b adds **no** new
`AUTH_COPY.gates` login-prompt string (unlike D4's upvote, which *is* offered logged-out). The only
auth route that applies is the **expired-session** route at submit (§6) — a session valid when the row
was shown that expired before the click.

### 4.4 Accessibility of the affordances (binding — AC4/AC5 affordance side, CURATION §4)
- **Text-labeled.** Each affordance carries its **visible word** ("Hold for review" / "Approve");
  meaning never depends on a glyph or a color. The neutral-vs-affirming distinction (ink Hold vs.
  action-blue Approve) is **reinforced** by color but **carried** by the word.
- **Keyboard-operable + focus-visible.** Both are native buttons in the tab order (§4.2); the global
  focus-visible ring applies.
- **Role-scoped name.** The reviewer row's `aria-label="Review this clip"` and the buttons'
  per-caption names tell a screen-reader user these are review actions on this clip — distinct from the
  D2 owner row's **"Manage your curated clip"** (which a screen-reader user hears as *their own* clip).

---

## 5. The no-reload reflect — held ↔ fully-curated in the same session (AC1 / AC3)

Both actions reflect **in place** in the same session, no manual reload — reusing the in-memory `clips`
mutation pattern the upvote/edit/delete paths already use (`TopicView` sets `clips` by id; the card
re-renders from the new clip object).

### 5.1 Hold → held; Approve → fully curated (in place)
- On a successful **Hold**, the host flips the target clip's held flag in the in-memory `clips` array
  (map by id → `{ ...clip, vetted: false }` / the held property Dev surfaces). The card re-renders
  **held** (§3 marking appears; chips/note/curator intact); the reviewer row swaps **Hold → Approve**
  for a moderator (§4.1). No reload.
- On a successful **Approve**, the host flips the held flag back (`vetted: true`); the card re-renders
  **fully curated** (the §3 marking disappears; full vouch restored); the reviewer row swaps **Approve
  → Hold** for a moderator. No reload. The change survives a reload (a fresh `listClips`).
- **The held marking is the only visible change.** Hold/approve do **not** change the chips, the note,
  the curator attribution, the upvote count, or the section placement — only the presence/absence of the
  §3 marking and the manage-row's Hold↔Approve swap. (Unlike D2 edit, no field re-renders; unlike D2
  delete, the card is **not removed** — it stays in `clips`, so no count change and no empty-flip.)

### 5.2 In-flight + reconcile posture (Dev's call; specify the bar)
Hold/approve are infrequent, deliberate reviewer acts (not the high-frequency upvote toggle), so an
**awaited busy state** (disable + busy word, then apply on resolve) is the recommended, simplest posture
— **not** an optimistic-with-rollback (that complexity earns nothing here). On activation: disable the
control, show the busy word (§6), fire the action, and on **success** apply the flag flip; on **error**
leave the clip unchanged and surface the §6 notice (the control returns to idle). A per-clip in-flight
guard (the `upvoteInFlight` pattern) prevents a double-click. (Dev may use optimistic-with-rollback if
it reads cleaner end-to-end, but it is not required; the **contract** is: no false success — the marking
only changes on a real server success, and a failure leaves the clip in its pre-click state.)

### 5.3 Focus handling on the manage-row after the action (binding — a11y)
Neither hold nor approve **removes** the card (unlike D2 delete) — the card stays in `clips`. So focus
must **not** be lost to `<body>` and must **not** jump to `focusBandHeading()` (that anchor is for the
*removed-node* case — delete/dismiss). Instead:
- After a successful **Hold**, the Hold button is **replaced by Approve** in the reviewer row (for a
  moderator). Move focus to the **newly-rendered Approve button** (the natural next act on the now-held
  clip) so a keyboard/AT user lands on the action that makes sense next, not on `<body>`.
- After a successful **Approve**, Approve is **replaced by Hold**. Move focus to the **newly-rendered
  Hold button** (still the moderator's available act on the now-published clip).
- **The curator-hold edge:** when the actor is the clip's own curator (not a moderator), a successful
  Hold leaves **no** reviewer affordance on the held clip for them (only a moderator gets Approve —
  §4.1). In that case the Hold button is **removed** from their view, so move focus to a stable nearby
  anchor that is **not** detached — recommended the **card's section link** (the first interactive
  element of the card, always present) or the card container — **never** `<body>`. (This is the only
  hold/approve path where the activated control disappears for the actor; handle it like the removed-node
  rule but anchored to the *same card*, which is still present, not to the band heading.)
- Schedule the focus move post-render (the `requestAnimationFrame` pattern the existing reflect paths
  use) so it runs after the row re-renders with the swapped button.

---

## 6. The action states — pending / success / error / expired / rate-limited (the three-arm catch) — AC4/AC5 (state side)

Hold and approve are **gated writes** (they slot into the `requireContributor()` → D5a rate-limit →
role-check → write order — Decision 3), so they inherit the **same three-arm error catch** the
edit/delete/upvote paths use (`isAuthRequired` / `isRateLimited` / generic — `TopicView` lines
1024–1031, 967–973). Specify every state so Dev never guesses:

| State | Trigger | Behavior |
|---|---|---|
| **Idle** | published clip, reviewer present | **"Hold for review"** available (§4.3) |
| **Idle (held)** | held clip, moderator present | **"Approve"** available (§4.3) |
| **Pending** | action in flight | the activated control **disables** + shows the busy **word** (**"Holding…"** / **"Approving…"**) — not a spinner alone (the D1/D2/D4 busy-word rule); no double-submit (per-clip in-flight guard) |
| **Success** | action resolves OK | the held flag flips; the card re-renders (§5.1) **no reload**; focus moves per §5.3; **no** "saved!" toast (the marking change *is* the confirmation) |
| **Expired session** | `AuthRequiredError` | `showExpiredGate()` → the verbatim **"Your session ended — please log in again."** prompt (D1 §7.2 / `AUTH_COPY.errors.expiredSession`); the clip is **unchanged**; **not** a generic error |
| **Rate-limited** | `RateLimitedError` | the **calm** D5a notice — `AUTH_COPY.rateLimit.notice` (*"You're doing that a bit too fast — give it a moment, then try again."*) on the established non-red, ink-on-`bg2`, `border-l-4 border-brand` surface (the `dismissNotice`/`upvoteNotice` "limited" treatment); the clip is **unchanged**; the control returns to idle |
| **Other error** | any other rejection | a **non-blocking, polite** `role="status" aria-live="polite"` notice (the `dismissNotice`/`upvoteNotice` generic treatment — `bg-red-50`/`text-red-700`): **"Couldn't hold that — please try again."** (hold) / **"Couldn't approve that — please try again."** (approve); the clip is **unchanged**; the control returns to idle |
| **Reviewer-not-present** | non-moderator / non-owner / logged-out viewer | **no** Hold/Approve affordance at all (§4.1); the held *marking* is still shown (§3 — it's public); there is simply nothing to act on |

- **Notice surface (Dev: reuse, don't invent).** The rate-limited + generic-error notices reuse the
  **same** page-level reason-aware notice surface `dismissNotice` / `upvoteNotice` already render
  (`TopicView` lines ~1184–1224): a `role="status" aria-live="polite"` line, **calm** (ink-on-`bg2`,
  `border-l-4 border-brand`) for `"limited"` and red (`bg-red-50`/`text-red-700`) for the generic
  failure — the **words switch**, the surface is shared. Add a `holdNotice` / `reviewNotice` (or a
  single shared `reviewActionNotice`) state mirroring those, with the copy above. **No false success:**
  the notice fires only on failure; on success the marking change is the only signal.
- **The three arms are mutually exclusive** (D5a §2): expired → the gate; rate-limited → the calm
  notice; everything else → the generic red notice. Never confuse the three (the user is signed-in on
  the rate-limit arm — it is **not** a login prompt and **not** a generic failure).

---

## 7. Read-path discipline — the held-state is public; the affordances are off the read path (binding — AC7)

Two distinct things, kept distinct (Decision 3b/4):
- **The held *marking* is public + rides the clip read.** It is derived from the clip's held flag,
  carried on `listClips` / the client `Clip` shape, the **same for every viewer**. The cached read path
  does **no** per-user / per-auth query to render it. An anonymous read returns each clip's held marking
  with no login and no per-user work (§3.1).
- **The *affordances* (Hold/Approve) are off the read path.** The `isModerator` and `ownsClip` checks
  that decide which cards show the reviewer row run **only** in the already-authenticated client session
  (the D2/D4 pattern — §4.1), on data already loaded. They add **no** per-user work to the cached read
  path; an anonymous reader's render is byte-for-byte unchanged (no affordance, no role read).

This preserves ARCHITECTURE's *read-path-is-the-scale-lever* principle and matches D1–D5a (no read-path
regression). The role-gate query runs **only** on the two write actions (server-side), never on the
read.

---

## 8. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Brand indigo `#676EB4`** — structure (the General band fill, the active-pairing highlight); **not**
  a held-state signal and **not** a destructive signal. The held marking is **not** indigo-on-indigo (on
  the General band it sits on a white-fill pill for AA — §3.3).
- **Action blue `#1F6F95`** — the recommended accent for the **"Approve"** affirming action (border +
  text, or fill + white text — confirm white-on-`action` ≈5.5:1 AA at the button size, §9.3). The
  affirming "restore the vouch" act, distinct from brand structure and from `accred` destructive.
- **Ink `#2C2C2C` / ink2** — the **held marking**'s border + label (a **solid** ink left rule + ink/ink2
  eyebrow — the calm, neutral status register; *not* the candidate's dashed violet, *not* red, *not*
  gold) and the **"Hold for review"** secondary button (white fill, 2px ink border, ink text — neutral,
  a review pause is not a destroy).
- **`accred` red `#C44949`** — used **only** for the generic-error notice (the §6 "Couldn't hold/approve
  …" red line), reusing the existing `dismissNotice`/`upvoteNotice` red treatment. It is **never** used
  for the held marking or for either affordance (a hold is not a deletion; a held clip is not bad — the
  §7.1 tone guard). The red carries a **text** label always.
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional / signal color, and
  must never be enlisted for the held marking, the affordances, the busy states, or the notices.
- **Non-color rule (CURATION §4 / §7.1 tone guard, binding):** every D5b signal is text-carried — the
  held state is the **words "In review · not yet vouched"** (+ the verbatim explainer / accessible
  name); the affordances are their **words** ("Hold for review" / "Approve"); the busy states are the
  busy **words** ("Holding…" / "Approving…"); the failures are the notice **text**. Color only
  reinforces. The held state is **never** signaled by color alone, and **never** reads as
  "removed/bad/flagged" — no alarm words, no red, no dashed candidate styling (§7.1 tone guard).

---

## 9. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive; the clip card and the General tile already collapse to a single readable column
below `lg`. D5b adds no new layout but must keep the new marking + controls usable narrow:
- **The held marking block** on the rail card is full-width and wraps its eyebrow + explainer to as many
  lines as needed; it never pushes the thumbnail/chips/note off-screen. On the `GeneralStrip` tile the
  eyebrow pill sits within the `w-44` tile and wraps/clamps to stay readable.
- **The reviewer manage-row** (Hold / Approve) is `flex flex-wrap gap-2` on the rail card and
  `flex flex-wrap gap-1.5` on the tile — on a phone the button(s) wrap rather than overflow; each is a
  comfortable touch target (the `.srcbtn`/D2-button padding gives ≥40px height). The row sits below the
  owner row (if present) and never collides with it.
- **Both manage-rows can be present** (a moderator who owns the clip): on a narrow tile they stack and
  wrap; confirm at ~390px that all four controls (Edit, Delete, Hold/Approve) remain reachable and
  tappable and the tile does not overflow horizontally.
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — the held marking (rail card +
  General tile), the reviewer affordances (moderator vs. curator-own vs. non-reviewer vs. logged-out),
  and the action states (pending, success, expired, rate-limited, error) at each.

---

## 10. Accessibility requirements (consolidated — verifiable against AC1/AC2, CURATION §4/§7.1)

- **The held marking** — text-labeled with the verbatim eyebrow **"In review · not yet vouched"**;
  carries the verbatim accessible name **"In review — not yet vouched for by a reviewer."** (`sr-only`
  lead or `aria-label`); distinguishable **without color** from a fully-curated clip (marking present
  vs. absent) and from a §6 candidate (chips/note/curator present vs. absent; "In review" vs.
  "Suggested · uncurated"; solid ink vs. dashed violet); the decorative dot is `aria-hidden`. On the
  indigo General band the eyebrow is on a white-fill pill to clear AA (§3.3).
- **The affordances** — `<button>`s, text-labeled ("Hold for review" / "Approve"), Tab-reachable,
  Enter/Space activates, focus-visible ring; render **only** for the authorized viewer (§4.1); the
  reviewer row's `aria-label="Review this clip"` distinguishes it from the D2 owner row's "Manage your
  curated clip"; never color-alone (the ink-Hold-vs-action-Approve distinction is reinforced, not
  carried, by color).
- **Busy states** — the busy **word** ("Holding…" / "Approving…"), not a spinner alone; the control is
  disabled during flight (no double-submit).
- **Focus after the action** — moves to the **swapped** control (Approve after Hold, Hold after
  Approve) for a moderator, or to a **same-card** anchor when the curator's Hold removes their only
  affordance (§5.3); **never** lost to `<body>`, and **never** jumped to `focusBandHeading()` (no node
  was removed).
- **Expired session** — routes to the gate dialog carrying the verbatim "Your session ended…" line
  (§6); not a silent failure.
- **The rate-limit + error notices** — `role="status" aria-live="polite"` (informational, not urgent;
  do not steal focus); reason-aware (calm "limited" vs. red generic); announced once on appearance.
- **Contrast (AA, binding)** — the held eyebrow ink/ink2 on `bg2` (rail) and ink on the white pill
  (General band) clear AA; if Approve uses an action-blue **fill**, white-on-`action` clears AA (≈5.5:1,
  §9.3 — confirm at the button text size); the generic-error red line reuses the cleared
  `dismissNotice`/`upvoteNotice` treatment. QA verifies.
- **Responsive** — the held marking + both manage-rows operable by keyboard and touch at ~390px (§9).

---

## 11. Deltas from the committed surfaces (Dev: build these on top)

The `topic-page-v1.md §5.9` clip card, the D2 owner manage-row, the D3/D4 surfaces, and the §6 candidate
vocabulary all stand. D5b changes exactly these points; everything else is unchanged.

1. **Held marking on `ClipCard`.** When the clip is held (`vetted === false`), render the §3.2
   held-marking block (verbatim eyebrow + explainer + accessible name) **above the chips row** — a
   **solid** ink-left-rule status block in the calm neutral register, **distinct from** the dashed/violet
   candidate vocabulary and from `accred`. The chips, note, curator attribution, footer, and creator
   credit are **unchanged**. *(AC1, AC2.)*
2. **Held marking on the `GeneralStrip` tile.** When a curated General clip is held, render the §3.3
   **eyebrow-only** marking on a **white-fill pill** (AA on the indigo band) with the verbatim accessible
   name; omit the explainer for space; never reuse the empty-band "uncurated" pill. *(AC1, AC2.)*
3. **A reviewer manage-row on `ClipCard` and the `GeneralStrip` tile.** Add an additive `role="group"
   aria-label="Review this clip"` row, **parallel to and below** the D2 owner row, rendered **only** for
   the authorized viewer (§4.1): **"Hold for review"** (moderator-any OR curator-own, on a published
   clip — ink secondary), **"Approve"** (moderator-only, on a held clip — action-blue affirming). Both
   text-labeled native `<button>`s; never color-alone; the word is the signal. *(AC4/AC5 affordance
   side.)*
4. **An `isModerator` client-session predicate in `TopicView`,** resolved the **same off-read-path way**
   as `signedIn` / `ownsClip()` (from the authenticated session claim Dev derives from the server role —
   never a client-typed flag), default false; reuse the existing `ownsClip()` for the curator-can-hold
   case. **No** read-path cost (§7). *(AC7 read-path side.)*
5. **`runHold` / `runApprove` in `TopicView`** with the awaited busy-state posture (§5.2): disable +
   busy word; on success flip the in-memory `clips` clip's held flag (no reload — §5.1) and move focus
   per §5.3; on error use the **three-arm catch** (§6 — `isAuthRequired` → `showExpiredGate()`;
   `isRateLimited` → the calm `rateLimit.notice`; else the generic red notice) and leave the clip
   unchanged. A per-clip in-flight guard prevents double-submit. *(AC1, AC3, AC4/AC5 state side.)*
6. **A reason-aware notice surface** for hold/approve, mirroring the existing
   `dismissNotice`/`upvoteNotice` page-level `role="status" aria-live="polite"` surface (calm "limited"
   vs. red generic), with the §6 copy. *(AC4/AC5 state side.)*

No change to: the chips + their AA fills (`topic-page-v1.md` §9), the curator note, the creator credit,
the provenance footer (D3/D4), the §6 candidate / empty-state treatment (the held state is **distinct
from** it, not a change to it), the scroll-sync, the article side, the D1 add/promote flows, the D2
edit/delete modals, or the modal shells. Reading stays anonymous — no per-user work on the read path
(§7).

---

## 12. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | A held clip renders "not yet fully curated"; shown to anonymous readers | §3, §3.1, §3.2, §3.3, §5.1 |
| AC2 | Held clip distinct from BOTH a fully-curated clip AND a §6 candidate (text/marking, not color) | §3.2 (three-way contrast), §3.3, §8 (non-color), §10 |
| AC3 | A moderator approves → fully curated again, no reload, survives reload | §2.2, §4.1, §5.1, §6 |
| AC3a | A curator may hold their own clip; a curator may NOT approve | §4.1 (table), §2.2 (curator-approve is a server reject), §1 (P2) |
| AC4 | A non-moderator's (incl. curator's) approve call rejected server-side | §2 (gate-vs-affordance), §4.1 (constraint), §6 (state) — *server is Dev/QA* |
| AC5 | A non-authorized hold + a logged-out hold/approve rejected server-side | §2, §4.1 (constraint, table), §6 — *server is Dev/QA* |
| AC6 | New adds publish by default; column lands without taking live clips dark | (Dev/QA — schema/backfill; the held marking only renders when `vetted===false`, so a published clip is byte-for-byte its pre-D5b self) |
| AC7 | Held-state rides the clip read; no per-user work on the cached read path | §3.1, §4.1 (no read-path cost), §7 |
| AC8 | Role model + column recorded in ARCHITECTURE incl. how a moderator is granted | (Dev/QA — docs-as-built; no design blocker) |
| AC9 | build/typecheck/test green; workflow tested without a live provider | (Dev/QA — no design blocker) |

---

## 13. What UX will evaluate at Phase 4

Against this spec **and** the stories (S21–S25), on the running prototype with the session stubbed (the
C/D1 pattern — no live OAuth in CI; stub a moderator session, a curator session, a plain signed-in
session, and logged-out):
- **The held third-state (AC1/AC2):** a held clip on the rail card shows the verbatim **"In review · not
  yet vouched"** eyebrow + the verbatim explainer + the verbatim accessible name, while **keeping** its
  chips, curator note, and curator attribution; on the General tile the eyebrow pill is legible on the
  indigo band; the held clip is **distinguishable from** a fully-curated clip (marking present vs.
  absent) **and** from a §6 candidate (chips/note/curator present vs. absent; "In review" vs. "Suggested
  · uncurated"; solid ink vs. dashed violet) — **from the text/marking, not color**; the marking renders
  the same for an anonymous (logged-out) viewer.
- **The reviewer affordances (AC4/AC5 affordance side):** **"Hold for review"** appears for a moderator
  on a published clip and for the clip's own curator on their own published clip; **"Approve"** appears
  for a moderator on a held clip and for **no one else** (not the curator, not a non-moderator, not
  logged out); a plain signed-in non-owner and a logged-out viewer see **no** Hold/Approve on any clip;
  text-labeled, keyboard-operable, focus-visible, the reviewer row distinct from the D2 owner row.
- **The no-reload reflect (AC1/AC3):** Hold a published clip → it re-renders **held** in place (marking
  appears, manage-row swaps Hold→Approve for a moderator), no reload; Approve a held clip → it re-renders
  **fully curated** in place (marking gone, manage-row swaps Approve→Hold), no reload, survives reload;
  focus lands on the swapped control (or a same-card anchor on the curator-hold edge), never `<body>`.
- **The states (AC4/AC5 state side):** Hold/Approve pending shows the busy **word** and blocks
  double-submit; a rate-limit shows the **calm** `rateLimit.notice` and leaves the clip unchanged; an
  expired session routes to the "Your session ended…" gate; a generic error shows the polite red notice
  and leaves the clip unchanged (no false success — the marking never changes on a failed action).
- **A11y in practice:** the held marking + both affordances text-labeled and operable by keyboard at
  ~390px; AA contrast on the held eyebrow (rail + the General white pill) and the Approve action-blue;
  the held state distinguishable without color; the notices announced politely without stealing focus.
- **Indigo Press fidelity:** the held marking is **calm/neutral** (solid ink, never dashed-violet, never
  red, never gold) and reads as **"in review," never "removed/bad/flagged"** (the §7.1 tone guard);
  brand/action/ink palette honored; gold unused; signals text-carried (§8).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is
distinct from QA & Review's correctness/security pass — UX asks "does it match intent and feel right,"
QA verifies the **server-side role-gate** AC4/AC5 at the action — a non-moderator / non-owner / anonymous
direct call rejected on the **role**, not by a hidden button.)
