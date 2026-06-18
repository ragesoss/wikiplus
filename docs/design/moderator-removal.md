# Design Spec: The moderator-only Remove affordance + the removal confirm (optional reason) + the removed-from-read result (milestone D5c)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#59](https://github.com/ragesoss/wikiplus/issues/59) — milestone **D**, run **5c of 5** — the **final Milestone D issue** (D5a rate-limit shipped / D5b vetted-hold + role model shipped / **D5c** moderator removal)).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/moderator-removal.md` — the Product spec. This design serves **AC1–AC9** and the
    moderator/reader stories below, and honors Decisions **1** (soft-removal / tombstone —
    `removed_at` / `removed_by` / `removed_reason`; the removed clip is **filtered from the read**, no
    reader-facing tombstone; restore deferred-but-trivial), **2** (**moderator-only**, on **any** clip,
    **no own-curator arm** — unlike the D5b hold; a capability, never an `accuracy_flag`-classifier),
    **3** (removal is its **own** state/action, **distinct from** the D5b hold — `removed_at` and
    `vetted` are independent), and **4** (a **minimal, optional** removal reason captured for the audit
    trail — never required, never shown to readers).
  - `docs/CURATION_STANDARD.md` **§7.2 / Decision C9** — the **editorial contract** for what a
    *removal* asserts. Used **verbatim** where this spec surfaces it:
    - **The removable boundary (binding):** removal is for the **§7 abuse list**, *not* for
      disagreement. An honestly-flagged `opinion` / `mixed` / `inaccurate` clip with a fair note is
      **legitimately curatable — NOT removable**. The mechanism never classifies by `accuracy_flag`; a
      human moderator judges. (UX does not gate, hint, or auto-trigger removal by a clip's chips.)
    - **The removal-reason vocabulary (verbatim labels)** — a fixed §7-aligned category set, used
      **verbatim** if UX surfaces it (and it does — §5.2), centralized so the form and a future
      moderation surface share one source:

      | Value (enum) | Label (UX text — VERBATIM) |
      |---|---|
      | `spam` | **Spam** |
      | `promotion` | **Self/affiliate promotion** |
      | `off_topic` | **No genuine relevance** |
      | `note_violation` | **Note violates the standard** |
      | `hateful_or_illegal` | **Hateful, harassing, or illegal** |
      | `deceptive_media` | **Deceptive / manipulated media** |
      | `copyright` | **Copyright-circumventing embed** |
      | `other` | **Other (see note)** |

    - **The reason is OPTIONAL and AUDIT-ONLY (binding):** a removal needs no reason; the reason is
      **never shown to readers** (a removed clip simply stops showing — there is no public "removed for
      X" notice). It is display + audit metadata for a future moderation surface only.
    - **Removal stays editorially distinct from the D5b hold:** a removal takes an *abusive* clip
      **down** (it stops showing, no reader marking); a hold is a reversible "in review" pause (the
      clip *stays visible*, marked). They never read as the same act.
  - `docs/design/clip-edit-delete.md` (D2) — the **owner manage-row** (`role="group"` Edit/Delete on
    `ClipCard` / the `GeneralStrip` tile) and the **`DeleteConfirmDialog`** pattern (a small `ModalShell`
    yes/no, **Cancel-as-focused-default**, the `accred` destructive confirm darkened to `#B83A3A` for
    AA, the pending / `role="alert"` error / expired-gate / rate-limit states, the `SubmitOutcome`
    contract). D5c's removal confirm **parallels** `DeleteConfirmDialog`; D5c's Remove affordance is
    **distinct from** the D2 owner Delete. This spec specifies the **deltas**, not a redesign.
  - `docs/design/vetted-review-hold.md` (D5b) — the **reviewer manage-row** (`ReviewRow` — Hold /
    Approve), the **`isModerator`** client-session gating (the off-read-path predicate Dev derived from
    the server role claim, *never* a client-typed flag), the **`runReview` three-arm catch**
    (`isAuthRequired` → expired gate / `isRateLimited` → calm notice / else generic), and the
    **same-card focus anchor** (`focusAfterReview`). D5c reuses `isModerator` and the three-arm catch,
    and the Remove affordance must be **distinct from** D5b's Hold/Approve.
  - `docs/design/topic-page-v1.md` — **the committed Topic-page baseline.** Specifically: the curated
    clip card **§5.9**; the `GeneralStrip` tile **§5.5 / §6.3**; the **`DeleteConfirmDialog`** language;
    chips + **AA contrast §9.3** (the load-bearing ratios, incl. the `#C44949` → `#B83A3A` darkening for
    white-on-red); **focus-visible §11.2** (3px indigo outline, 2px offset); text-labeled signals
    **§11.1**; **responsive §12**.
  - `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity); reference mockups
    `mockups/inline-indigo-sync.html` (curated).
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/ClipCard.tsx` — the rail card. Today it renders, below the footer: (a) the D2
    owner Edit/Delete `role="group"` row (when `owned`), then (b) the D5b `ReviewRow` (Hold/Approve).
    D5c adds the **moderator-only Remove affordance** as a **third** manage act — see §4 for whether it
    joins `ReviewRow` (recommended) or is its own row.
  - `components/topic/ReviewRow.tsx` — the D5b reviewer row (`canHold` / `canApprove`, `inFlight`, busy
    words, `size: "rail" | "tile"`). **Recommended host for Remove** (§4.2): a moderator's review
    surface, gated on the same `isModerator`.
  - `components/topic/DeleteConfirmDialog.tsx` — the D2 confirm pattern to **parallel** (the
    `SubmitOutcome` contract, the `alive` guard, the Cancel-default focus, the pending word, the
    `role="alert"` generic error + the calm `limited` notice). D5c adds a **`RemoveConfirmDialog`** that
    parallels it **plus** the optional-reason capture (§5).
  - `components/topic/GeneralStrip.tsx` — the curated tile. D5c adds the Remove affordance to the tile's
    `ReviewRow` (`size="tile"`), parallel to the rail.
  - `app/topic/TopicView.tsx` — `isModerator` (line 76), `ownsClip` (917), `canHold` / `canApprove`
    (929–937), `reviewInFlight` (938), `runReview` / the three-arm catch (971–1000), `focusAfterReview`
    (the same-card anchor, 949–963), `focusBandHeading` (the removed-node anchor, 673), `onDeleteConfirm`
    (the `SubmitOutcome` delete wiring, 1153), `reviewNotice` (the page-level `role="status"` surface,
    1344). D5c **adds** a `canRemove` predicate, a `removeFor` confirm target, a `runRemove` / the
    confirm's `onConfirm`, and the **removed-from-read** in-memory `clips` filter.
  - `lib/auth/microcopy.ts` (`AUTH_COPY` — `rateLimit.notice` + `errors.expiredSession`, reused
    verbatim; D5c adds **no** new login-gate string — Remove is a moderator affordance, never shown
    logged out).
- **Feeds:** Development (build to **this spec** for the D5c deltas, on top of the committed
  `topic-page-v1.md §5.9` clip card, the D2 `DeleteConfirmDialog`, and the D5b `ReviewRow` +
  `isModerator`). Then QA & Review (correctness/security — the **server-side role-gate** is theirs) + UX
  evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the **deltas** D5c adds:
> the **moderator-only Remove affordance** (on the rail card + the General tile, on **any** clip, **no**
> own-curator arm), the **removal confirm dialog** with the **optional, audit-only** reason capture
> (parallel to D2's `DeleteConfirmDialog`, Cancel-as-default), and the **removed-from-read result** (the
> clip simply disappears — no reader-facing tombstone). It does **not** redesign the card, the chips,
> the note, the D2 owner row, or the D5b reviewer row. Every requirement is tagged with the Product
> AC(s) and the story it makes buildable. **The security control is the server-side, role-resolved gate
> inside `removeClipAction` (Decision 2 / AC2/AC3) — never the affordance; this spec designs the
> affordance and never claims it protects the action.**

---

## 1. Personas & stories served

D5c touches two of the three Topic-page personas (`topic-page-v1.md` §1). The
**reviewer/moderator (P3)** is the primary *actor* — D5b gave P3 the review hold; D5c gives P3 the
*harder* tool: taking abuse down. The **reader (P1)** is the downstream beneficiary — abusive content
simply stops appearing on the page she reads. The **curator (P2)** is **not** an actor this run (there
is **no own-curator arm**; a curator who wants their *own* clip gone uses D2 owner-delete — §3).

### P3 — Mod, the moderator (PRIMARY actor — the §7 abuse-removal tool)
The `contributor` granted the moderator role **out-of-band** (D5b, Decision 2 — there is no in-app
grant UI; the role-gate authority is **server-side**). In D5b Mod could **Hold** (pause for review) and
**Approve** (confirm the vouch). D5c adds the **third, heaviest** moderator act: **Remove** abusive
content per the §7 list — spam, self/affiliate promotion, no-genuine-relevance clips, §1.2-violating
notes, hateful/harassing/illegal content, deceptive media, copyright-circumventing embeds — on **any**
contributor's clip, the exact case moderation exists for (an abusive clip whose curator won't take it
down). Removing *someone else's* work is a **privileged, accountable** act, so it is never a one-click
fire: it goes through an explicit confirm, and the removal is recorded as a soft tombstone (who/when/
optional-why). Mod works mostly on desktop but may be on a phone, a keyboard, or a screen reader; the
affordance, the confirm, and the reason control must work for all of those. Mod judges abuse against
the **§7 boundary** — *removal is for abuse, not disagreement* — the design never makes a fair
opinion/inaccurate clip removable *by its chips*.

### P1 — Priya, the reader (downstream beneficiary; never sees a removal marker)
Anonymous, unchanged. D5c adds **no per-user work to the read path** and nothing she must log in for.
Her stake: an abusive clip that should never have been on the page **simply stops appearing** — there
is **no** reader-facing "this was removed" marker, no tombstone, no gap she must interpret. (This is the
deliberate contrast with the D5b *held* marking, which **is** shown to her — a removed clip is filtered
out of the read entirely; a held clip is shown-but-marked.) Reading stays anonymous; the removed-state
rides the clip read as a server-side exclusion, the same for every viewer (no per-user query).

### P2 — Marcus, the curator (NOT an actor this run — context only)
D5c adds **no** capability for the curator. There is **no own-curator arm** (unlike the D5b hold, which
a curator may do on their own clip). A curator who wants their *own* clip gone has **D2 owner-delete**;
a curator is **not** offered a Remove affordance on anyone's clip (including their own). A
non-moderator's Remove call — including the clip's own curator acting as a non-moderator — is rejected
server-side (AC2). This is the editorial line from C9 / Decision 2 ("removal of *anyone's* clip is the
privileged reach").

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S26 — take down abusive content.** *As a moderator, I want to remove a clip that violates the
  curation standard (spam, hate, deceptive media, a note that breaks the rules) — on anyone's clip — so
  content that should not be on the page at all stops showing, and I see it disappear without a reload.*
  *(AC1; CURATION §7 / §7.2.)*
- **S27 — never remove someone's work by an accidental click, and record why.** *As a moderator, I want
  an explicit confirmation before a removal fires — and the option to record a reason for the audit
  trail — so removing another person's work is a deliberate, accountable act, never a stray click.*
  *(AC1, AC6; Decision 1/4; CURATION §7.2.)*
- **S28 — removal is for abuse, not disagreement.** *As a moderator, I want Remove to be clearly the
  "take down abuse" act — distinct from holding a clip for review and from a curator deleting their own
  clip — so I never confuse "this is abuse" with "this needs a second look" or "this is my clip to
  retract," and I'm never nudged to remove a clip just because I disagree with its take.* *(AC4, AC5;
  CURATION §7.2 / §7.1 boundary.)*
- **S29 — the reader just stops seeing it.** *As a reader, I want a removed clip to simply not be on the
  page — no "removed" placeholder, no gap to interpret — so the page reads as cleanly curated.* *(AC1,
  AC7; Decision 1 — no reader-facing tombstone.)*
- **S30 — I'm not handed a control I can't use, and the action is told to me honestly.** *As a viewer
  who isn't a moderator (or who's logged out), I want **no** Remove control offered to me; and as a
  moderator, when a removal fails I want to be told it didn't take — never a control that reads as if it
  worked when nothing changed.* *(AC2, AC3 (the affordance side); the D1/D2/D5a/D5b state bar.)*

---

## 2. The flow, end to end (the Remove → confirm → removed-from-read path) — S26 / S27 / S29

The flow begins on the **curated** Topic page (`mode === "curated"` in `TopicView`), on **any** clip,
for a viewer the session resolves as a **moderator** (`isModerator`). The Remove affordance (§4) is the
only new trigger; the confirm (§5) parallels D2's `DeleteConfirmDialog`; the removed-from-read result
(§6) reuses the in-memory `clips` filter the delete path already uses — but as a **soft** removal
(the row persists server-side), surfaced to the client as the clip leaving the read.

> **The gate vs. the affordance (binding, set by Decision 2 / C9).** The affordance in §4 decides
> *which* cards show Remove; it is convenience + clarity. The **authorization** is the server-side,
> role-resolved check inside `removeClipAction` (`isModeratorContributor`, **no** own-curator arm —
> AC2/AC3) — Dev's, verified by QA at the action. This design never relies on a hidden button to protect
> the action; §4.1 fixes the affordance constraint, the rest is the experience.

### 2.1 Remove a clip (moderator → confirm → removed) — S26 / S27 / S29
1. **Trigger.** A moderator activates **"Remove (moderator)"** on any clip they can see in curated mode
   (§4.2). Because removal is an act on **someone else's** work *and* removes the clip from view, it
   **never** fires from this single click — it opens a confirm (step 2).
2. **Confirm.** The **`RemoveConfirmDialog`** opens (§5): a small `ModalShell` dialog that (a) names
   what will happen — *the clip is removed and stops showing; it is reversible by an admin, not
   destroyed* — and (b) offers the **optional, audit-only** reason capture (the C9 category select +
   optional free-text). **Cancel is the focused default** (§5.4); **Remove clip** is the destructive
   confirm. A reason is **never required** — Remove clip is enabled with no reason chosen.
3. **Confirm → remove.** Activating **"Remove clip"** runs `removeClipAction` (via the seam). The
   confirm enters **pending** (the Remove-clip control disables + shows **"Removing…"**; Cancel stays
   enabled; no double-submit — the `alive`/`pending` guard pattern from `DeleteConfirmDialog`).
4. **Result.**
   - **Success →** `removeClipAction` resolves; the confirm dialog **closes**; the clip is **removed
     from the page's in-memory `clips` set, no reload** — it **simply disappears** from the rail, the
     General band, and the infobox counts (videos/creators/curators reflect its absence). If it was the
     **last** curated clip, the page flips **curated → empty** (the existing `mode` switch — §6.1).
     Because the **clip card is gone**, focus must not be lost to `<body>` — it moves to
     **`focusBandHeading()`** (the same removed-node anchor the D2 delete path uses — §6.2). There is
     **no** reader-facing "removed" marker anywhere (S29 / §6.3).
   - **Rate-limited →** the confirm dialog **stays open** with the **calm** `AUTH_COPY.rateLimit.notice`
     (D5a — *"You're doing that a bit too fast — give it a moment, then try again."*) on its non-red,
     `role="status"` surface (exactly as `DeleteConfirmDialog`'s `limited` outcome); the Remove control
     returns to idle; the clip is **unchanged** (still shown) (§5.5).
   - **Expired session →** the boundary rejects `removeClipAction` with `AuthRequiredError`; the confirm
     dialog **closes** and `showExpiredGate()` surfaces the verbatim **"Your session ended — please log
     in again."** prompt (D1 §7.2 / `AUTH_COPY.errors.expiredSession`); the clip is **unchanged**
     (§5.5).
   - **Other error →** the confirm dialog **stays open**, a `role="alert"` message **"Couldn't remove —
     please try again."** appears (the `DeleteConfirmDialog` generic-error treatment — 2px `accred`
     border, `#FDEDED` bg, `accred` text; focus sent to the alert), the Remove-clip control returns to
     idle; the clip is **still present**; the moderator can retry or Cancel (§5.5).

> **The three error arms are mutually exclusive** (the D5a/D5b/D2 bar): expired → the gate (dialog
> closes); rate-limited → the calm `limited` notice in the dialog (dialog stays open); everything else →
> the generic `role="alert"` in the dialog (dialog stays open). Never confuse the three (a moderator on
> the rate-limit arm is signed-in — it is **not** a login prompt and **not** a generic failure).

> **The reason never blocks the removal (binding — Decision 4 / C9).** A removal with **no** reason is
> valid; the reason capture in §5.2 is never a precondition of Remove clip and never gates the write.

---

## 3. Distinctness — three moderator/owner acts kept unmistakable (the load-bearing requirement) — AC4 / AC5

The Topic page now carries **three** distinct manage acts on a clip, and the words + treatment must keep
them unmistakable. A moderator (who may also be an owner) must never confuse "take down abuse" with
"pause for review" or "retract my own clip." This table is the binding contract for the words and the
treatment; the per-surface placement is §4 and the confirm is §5.

| Act | Who | On whose clip | What it does | Affordance word | Treatment | Confirm? | Persistence |
|---|---|---|---|---|---|---|---|
| **D2 Delete** | the clip's **owner** | **own** clip only | retracts the curator's *own* vouch | **"Delete"** | `accred` destructive (border + text) | yes — `DeleteConfirmDialog` ("Delete clip") | **hard delete** (row gone) |
| **D5b Hold / Approve** | moderator (any) / curator-own (hold) | any (hold) / held (approve) | a **reversible review pause** (visible, marked) / restore the vouch | **"Hold for review"** / **"Approve"** | ink secondary / action-blue affirming (**never** red) | no — direct (reversible, non-destructive) | flips `vetted`; clip **stays visible** |
| **D5c Remove (moderator)** | **moderator only** (no own-curator arm) | **any** clip (the point) | takes an **abusive** clip **down** — it stops showing | **"Remove (moderator)"** | `accred` destructive (like D2) — but the word/scope says *moderator removal*, not *delete my clip* | yes — `RemoveConfirmDialog` ("Remove clip") | **soft tombstone** (`removed_at` set, row persists); **filtered from the read** |

The three tells (binding):
- **Word.** D2 says **"Delete"** (and "Delete clip" in its confirm); D5c says **"Remove (moderator)"**
  (and "Remove clip" in its confirm). "Delete" reads as *my own thing*; "Remove (moderator)" carries the
  **role + scope** — this is a moderator removing content, not a curator deleting their own clip. D5b
  says **"Hold for review"** / **"Approve"** — neither is "remove" or "delete." The parenthetical
  **"(moderator)"** is the textual tell that distinguishes Remove from Delete even though both are red.
- **Treatment.** Remove uses the **established `accred` red destructive treatment** — the same family as
  D2 Delete (border + text on the card; the `#B83A3A` AA-safe fill on the confirm button — §7). This is
  deliberate: Remove **is** destructive-from-the-reader's-view, like Delete. The red is **never** how a
  moderator tells Remove from Delete (both are red) — the **word + scope** is. D5b Hold/Approve are
  **never** red (a review pause is not a deletion — the §7.1 tone guard).
- **Surface / accessible name.** Remove lives in the **moderator review surface** (the `ReviewRow`,
  `aria-label="Review this clip"` — §4.2), so a screen-reader user hears it as a *review* act on *this*
  clip, distinct from the D2 owner row's **"Manage your curated clip"** (which a screen-reader user
  hears as *their own* clip). Its per-clip accessible name (§4.3) names it as a moderator removal.
- **The abuse-not-disagreement boundary (CURATION §7.2 / §7.1).** The design **never** nudges Remove by
  a clip's `accuracy_flag`. A clip flagged `opinion` / `mixed` / `inaccurate` shows the **same** Remove
  affordance as any other clip (no extra emphasis, no auto-suggested reason, no warning chrome) — Remove
  is for §7 abuse a human judges, never for an honest-but-imperfect take. The reason categories (§5.2)
  are the **§7 abuse list**, not the accuracy vocabulary, precisely so the moderator's mental model is
  "which abuse is this," never "do I disagree with the chip."

---

## 4. The moderator-only Remove affordance (the first D5c delta) — AC2/AC3 (affordance side)

This is the visible boundary "you can take this abuse down." It is added to the **curated clip card**
(`ClipCard`) and the **curated `GeneralStrip` tile** — the same two surfaces the D2 owner row and the
D5b reviewer row live on.

### 4.1 When the Remove affordance renders (the only fixed constraint; the gate is server-side)
The Remove affordance renders **iff** the viewer's session resolves the moderator role — and **on any
clip** (published *or* held; own *or* anyone's). Specifically, it renders iff:
- **`isModerator`** is true — the **existing D5b** off-read-path predicate (the session claim Dev
  derived from the server role, `session?.user?.isModerator === true`, *never* a client-typed flag —
  `TopicView` line 76). Default **false** (logged-out and every non-moderator).

In **every** other case there is **no** Remove affordance:
- **logged out / anonymous** → no Remove on **any** clip (AC3 affordance side);
- **signed-in non-moderator** — *including the clip's own curator acting as a non-moderator* → no
  Remove on **any** clip (AC2 affordance side; **no own-curator arm** — §3 / P2).

**No own-curator arm (binding — Decision 2, the key contrast with D5b Hold).** Unlike `canHold`
(`!held && (isModerator || ownsClip(clip))`), the Remove predicate is **moderator-only** — it does
**not** OR-in `ownsClip`. A curator who is not a moderator never sees Remove, even on their own clip
(they have D2 Delete for that). The recommended predicate in `TopicView`, parallel to `canHold` /
`canApprove`:

```
const canRemove = useCallback(
  (_clip: Clip): boolean => isModerator,   // moderator-only, ANY clip; NO ownsClip OR-arm
  [isModerator]
);
```

**The constraint that does not move (binding):** a non-moderator / anonymous **direct action call** —
including the clip's own curator acting as a non-moderator — is rejected **server-side** by
`removeClipAction`'s role gate regardless of any button (AC2/AC3). The affordance mirrors but never
replaces the role-gate. (QA verifies the reject at the action, with a stubbed non-moderator / curator /
anonymous session — not by the absence of a button.)

**No read-path cost (binding — AC7).** `canRemove` runs **only** in the already-authenticated client
session (the `isModerator` claim is already read for D5b), on data already loaded; it adds **no**
per-user work to the cached read path. An anonymous reader's render is byte-for-byte unchanged (no
Remove affordance, no role read on the read path). The role-gate query runs **only** on the
`removeClipAction` write (server-side), never on the read.

### 4.2 Placement — Remove joins the D5b reviewer `ReviewRow` (recommended)
**Decision: Remove joins the existing `ReviewRow`** (the moderator's review surface,
`aria-label="Review this clip"`), *not* a new fourth row. Rationale:
- Remove is a **moderator** act gated on the **same `isModerator`** as Hold/Approve — it belongs in the
  moderator's review surface, not a separate "removal bar."
- It keeps the card to the **minimum** rows that serve the state (the D5b spec's "keep the row to the
  minimum" instruction): the card shows at most the D2 owner row ("Manage your curated clip") + the
  reviewer row ("Review this clip"). A moderator who owns the clip sees both; a non-owner moderator sees
  only the reviewer row.
- It places Remove **last** in the reviewer row, **after** Hold/Approve — so the order of moderator acts
  reads **least-destructive → most-destructive** (Hold/Approve → Remove), and the destructive red
  Remove is visually separated from the neutral/affirming review actions beside it.

So the `ReviewRow` renders, in order: **Hold for review** (if `canHold`) → **Approve** (if `canApprove`)
→ **Remove (moderator)** (if `canRemove`). `ReviewRow` gains a `canRemove` prop + an `onRemove` callback
+ a `removeInFlight` (or reuse `inFlight` — Dev's call, but a removal opens a *confirm*, so it has no
in-flight busy word on the affordance itself; the busy word lives on the confirm's "Removing…" button —
§5.5). The row's existing `aria-label="Review this clip"` group covers Remove (a moderator review
action). The row still renders only when at least one of `canHold` / `canApprove` / `canRemove` is true
(extend the existing early-return guard).

> **Alternative (acceptable, not recommended).** A separate `role="group" aria-label="Moderator
> actions"` row below the reviewer row. This is acceptable but adds a fourth row and a second
> moderator-surface label for marginal benefit; prefer joining `ReviewRow`. If Dev does split it, the
> §3 distinctness (word + treatment) and §4.3 accessible name still bind.

**On the `GeneralStrip` tile (`size="tile"`):** Remove joins the tile's `ReviewRow` identically,
wrapping within the `w-44` tile (`flex flex-wrap gap-1.5`). The destructive treatment uses the
**card-affordance restrained** style (white fill + `accred` border + `accred` text, like the tile's D2
Delete button), legible on the indigo band — the word is the signal.

### 4.3 Anatomy & microcopy of the Remove affordance (verbatim)
- **"Remove (moderator)"** — a `<button type="button">`, **destructive but restrained** (it is one step
  from a confirm, not the removal itself — exactly the D2 Delete affordance treatment): white fill,
  **2px `accred` border**, **`accred` text**, Source Sans Pro bold `text-[12px]` (`text-[11px]` on the
  tile); hover deepens to an `accred` fill with white text (confirm AA of white-on-`accred` — §7). A
  leading glyph (e.g. a shield/flag) is optional + `aria-hidden`; the **word "Remove (moderator)" is the
  signal** (never color-alone). It activates §2.1 (opens the confirm — it does **not** remove directly).
- **Visible label (verbatim):** **"Remove (moderator)"**. The parenthetical "(moderator)" is the
  textual tell that distinguishes it from the owner's "Delete" (§3) — it says *role*, not *my clip*.
- **Accessible name (verbatim):** **"Remove this clip (moderator action): &lt;caption&gt;"** — so a
  screen-reader user hears that this is a moderator removal of *this* clip, distinct from the D2 owner
  Delete's *"Delete your curation: &lt;caption&gt;"* (which says *your*).
- It is a real `<button>` in the tab order **after** the other reviewer-row controls (Hold/Approve) and
  after the D2 owner row if present: Tab-reachable, Enter/Space activates (opens the confirm), the global
  `:focus-visible` 3px indigo outline applies (`topic-page-v1.md` §11.2).

### 4.4 Accessibility of the affordance (binding — AC2/AC3 affordance side, CURATION §4)
- **Text-labeled.** The affordance carries its **visible words** ("Remove (moderator)"); meaning never
  depends on the glyph or the red. A colorblind / screen-reader / high-contrast user gets the full
  meaning. The destructive nature is carried by the **word + the confirm step (§5)**, reinforced (not
  signaled) by the `accred` border.
- **Keyboard-operable + focus-visible.** A native button in the tab order (§4.3); the global
  focus-visible ring applies.
- **Role-scoped name.** The `ReviewRow`'s `aria-label="Review this clip"` + the button's per-caption
  "(moderator action)" name tell a screen-reader user this is a moderator review/removal act on this
  clip — distinct from the D2 owner row's "Manage your curated clip."

---

## 5. The removal confirm dialog (the second D5c delta) — AC1 / AC6

Removing *someone else's* work is consequential, so it goes through an explicit confirm — a
**`RemoveConfirmDialog`** that **parallels** D2's `DeleteConfirmDialog` (same `ModalShell` yes/no,
`SubmitOutcome` contract, `alive` guard, Cancel-as-focused-default, pending word, `role="alert"` error /
calm `limited` notice / expired-gate) and **adds** the optional, audit-only reason capture. It is **not**
the full curate surface (there is nothing to edit) — it is a yes/no *plus* an optional reason.

### 5.1 Anatomy
A small `ModalShell` dialog (`role="dialog" aria-modal="true"`, `aria-labelledby` → its title;
`max-w-sm`, `.plus-card`), parallel to `DeleteConfirmDialog`:
- **Header band** — indigo fill (`bg-brand`, white text — consistent with `DeleteConfirmDialog`'s
  header); title **"Remove this clip?"** + a **"✕"** cancel (`aria-label="Cancel"`).
- **Clip caption** — `clip.caption` (`text-[12px]` bold ink) so the moderator confirms *which* clip
  (parallels `DeleteConfirmDialog`'s caption line).
- **Body — what will happen (verbatim, the soft/reversible framing).** A short, honest line that names
  the consequence *and* the soft/reversible-by-an-admin nature (Decision 1 — **not** "permanently
  destroyed," unlike D2's hard-delete copy): **"This removes the clip so it no longer shows on the
  topic. It's recorded for moderators and can be restored by an admin — not permanently deleted."** This
  is the deliberate contrast with D2's *"This permanently removes … This can't be undone."* — a
  moderator removal is a **soft tombstone**, not an erase, and the copy says so honestly.
- **Optional reason capture (§5.2)** — the C9 category select + optional free-text, clearly labeled
  **internal/audit-only** (never required, never shown to readers).
- **The notices** — `role="alert"` generic error + the calm `role="status"` `limited` notice, exactly as
  `DeleteConfirmDialog` (§5.5).
- **Action row** (`flex flex-wrap gap-2`):
  - **"Cancel"** — `<button type="button">`, white fill, 2px ink border, ink text. **The safe default**
    (initial focus — §5.4). Closes the dialog, no removal; focus returns to the **Remove** trigger
    (`ModalShell` `prevActive`).
  - **"Remove clip"** — `<button type="button">`, the destructive confirm: **`accred` fill darkened to
    `#B83A3A`** (the AA-safe white-on-red the D2 confirm uses — §7), white text, 2px ink border; hover
    lifts the 2px ink offset. The **word "Remove clip" is the signal**, the red reinforces. Enabled
    **regardless of whether a reason is chosen** (Decision 4 — a reason never blocks). Activates §2.1
    step 3.

### 5.2 The optional, audit-only reason capture (verbatim labels — C9 / Decision 4)
The reason is captured for the **moderator audit trail** — never required, never shown to readers. The
recommended shape (matching C9): a **single-select category** (the §7 list) **plus** an **optional
free-text** note.

- **Section label / framing (verbatim, so the moderator knows it's internal):** a small eyebrow above
  the reason controls: **"Reason (optional — for moderators only, not shown to readers)"**. This makes
  the C9 "audit-only, never reader-facing" rule legible at the point of capture, and makes the
  optionality explicit (a moderator never feels they *must* justify a clear-abuse removal).
- **The category control** — a native `<select>` (recommended for 8 options + a "no reason" default) or
  a radio group; either is keyboard-operable and screen-reader-labeled. The options, **verbatim** from
  C9 (UX uses these strings; Dev encodes the enum values):
  - A default first option: **"No reason given"** (selected by default → the captured reason is empty;
    a removal with no reason is valid).
  - **Spam** (`spam`)
  - **Self/affiliate promotion** (`promotion`)
  - **No genuine relevance** (`off_topic`)
  - **Note violates the standard** (`note_violation`)
  - **Hateful, harassing, or illegal** (`hateful_or_illegal`)
  - **Deceptive / manipulated media** (`deceptive_media`)
  - **Copyright-circumventing embed** (`copyright`)
  - **Other (see note)** (`other`)
- **The free-text note** — an optional `<textarea>` (or short input), labeled **"Add a note (optional)"**,
  placeholder e.g. *"Specifics for the audit trail — e.g. affiliate links in the note to vendor X."* It
  is **always optional**, including when **"Other (see note)"** is chosen — UX **does not** make the
  free-text a hard requirement even for `other` (Decision 4 / C9 keep both optional; the `other` label's
  "(see note)" is a *nudge*, not a validation gate). It carries a sensible `maxLength` (Dev's call;
  recommend ~280 chars — it is a moderator note, not an essay).
- **Default = no reason (binding).** On open, the category is **"No reason given"** and the free-text is
  **empty**. Remove clip is fully enabled in this state. The reason **never** gates Remove clip and
  **never** blocks the write (Decision 4).
- **What is sent.** On Remove clip, the host passes the chosen reason to `removeClipAction` — Dev's call
  on the captured shape (the §7-category enum + optional free-text, or a single composed string; the
  Product spec / C9 fix the *facts* — "an optional reason string" — not the column shape). When the
  category is "No reason given" and the free-text is empty, **no** reason is sent (`removed_reason` stays
  `NULL`). UX requirement: the capture surface must allow *category only*, *free-text only*, *both*, or
  *neither*.
- **Never reader-facing (binding — C9).** The reason is **only** in the confirm dialog (the moderator's
  own session) and the persisted tombstone. It is **never** rendered on the Topic page, the read's
  return shape, the client bundle for a reader, or any public surface. A removed clip simply stops
  showing — there is no "removed for spam" notice anywhere a reader can see (§6.3).

### 5.3 The reason capture is audit-only — it does not change the removal's behavior (binding)
- The reason **does not gate** the removal (Decision 4): Remove clip fires with or without a reason.
- The reason **does not auto-trigger or classify** the removal (Decision 2 / C9): choosing a category is
  a *record* of the moderator's judgment, not a mechanism that decides removability. There is no logic
  that maps a clip's `accuracy_flag` to a reason or pre-selects a category from the clip — the moderator
  chooses. (UX **must not** pre-fill the category from the clip's chips; the default is always "No reason
  given.")

### 5.4 Default & focus (binding — destructive-dialog safety, parallels D2 §9.2)
- **Initial focus lands on Cancel**, not on Remove clip and not on the reason control. A moderator who
  reflexively hits Enter/Space on open **cancels** (the safe outcome), never removes. (The deliberate
  inversion of "focus the primary action" — for a destructive confirm the *safe* action is primary for
  focus; matches `DeleteConfirmDialog`'s `initialFocusSelector="button[data-delete-cancel]"` —
  recommend `data-remove-cancel`.)
- **Esc** and **backdrop click** **cancel** (close without removing) — consistent with Cancel being the
  safe path. Focus trap holds while open (`ModalShell`).
- The confirm is **two intentional steps from the card**: card **Remove (moderator)** button → this
  dialog's **Remove clip** button. No single click removes (AC1).
- The reason controls are in the tab order **between** the body copy and the action row, so a moderator
  who wants to record a reason Tabs into the select/textarea before reaching Cancel/Remove clip — but a
  moderator who wants to remove with no reason never has to touch them.

### 5.5 The confirm dialog's states (parallel `DeleteConfirmDialog` exactly)
Reuse the `DeleteConfirmDialog` lifecycle (the `pending` / `noticeKind` / `alive` machine + the
`SubmitOutcome` contract) — the **only** additions are the reason controls (§5.2) and the verbatim copy
(§5.1). Specify every state so Dev never guesses:

| State | Trigger | Behavior |
|---|---|---|
| **Idle** | dialog open, moderator present | **"Remove clip"** available (enabled — reason optional); Cancel focused (§5.4) |
| **Pending** | Remove clip activated | **"Remove clip"** disables + shows the busy **word** **"Removing…"** — not a spinner alone; **Cancel stays enabled** (abandon mid-flight); no double-submit (the `pending` guard); a late resolve after the dialog is gone is ignored (the `alive` guard) |
| **Success** | `removeClipAction` resolves OK | the dialog **closes**; the host removed the clip from `clips` (§6.1) **no reload**; focus → `focusBandHeading()` (§6.2); **no** "removed!" toast (the clip's disappearance *is* the confirmation) |
| **Rate-limited** | `RateLimitedError` (`outcome: "limited"`) | the dialog **stays open** with the **calm** `AUTH_COPY.rateLimit.notice` (the `DeleteConfirmDialog` `limited` `role="status"` surface — non-red, ink-on-`bg2`, `border-brand`); Remove clip returns to idle; the clip is **unchanged** |
| **Expired session** | `AuthRequiredError` (`outcome: "expired"`) | the dialog **closes**, `showExpiredGate()` → the verbatim **"Your session ended — please log in again."** prompt; the clip is **unchanged**; **not** a generic error |
| **Other error** | any other rejection (the dialog's `catch`) | the dialog **stays open**, a `role="alert"` message **"Couldn't remove — please try again."** (the `DeleteConfirmDialog` generic treatment — 2px `accred` border, `#FDEDED` bg, `accred` text; focus → the alert); Remove clip returns to idle; the clip is **still present**; retry or Cancel |

The host's `onConfirm` mirrors `onDeleteConfirm` (`TopicView` line 1153): call `store.removeClip(id,
reason)` via the seam; on success filter the clip out of `clips` + `requestAnimationFrame(() =>
focusBandHeading())` + return `{ outcome: "added" }`; on `isAuthRequired` → `showExpiredGate()` + return
`{ outcome: "expired" }`; on `isRateLimited` → return `{ outcome: "limited" }`; else `throw` (dialog
keeps open with the alert). Same three-arm split as the delete path.

---

## 6. The result on the page — removed-from-read, no reader-facing marker (AC1 / AC7) — S29

### 6.1 The clip disappears; last clip flips curated → empty (AC1)
On a successful removal, the clip is **removed** from the in-memory `clips` set, no reload — the **same
in-memory filter the D2 delete path uses** (`setClips((prev) => prev.filter((c) => c.id !==
target.id))`). The difference from delete is server-side only (soft tombstone vs. hard delete — Dev/QA);
from the client's view the clip leaves the read:
- The card (rail) / tile (General band) disappears; the infobox **counts** (videos / creators / curators
  — `deriveStats(clips)`) drop accordingly; the **TOC badge** for its section (or the General band
  count) decrements. All of this falls out of removing the clip from `clips` (the derivations recompute)
  — no new state.
- **Last clip → empty flip.** If it was the **only** curated clip, `mode` flips to **empty** and the
  page returns to the empty/uncurated experience (the **existing** `mode = clips.length > 0 ? "curated"
  : "empty"` switch — exactly as the D2 delete path). No new layout.
- **Survives a reload.** A fresh `listClips` excludes the removed clip (server-side `removed_at IS NULL`
  filter — Dev/QA / AC1). The client filter is the no-reload reflect; the server exclusion is the
  durable truth.

### 6.2 Focus after removal lands on a stable anchor (binding — a11y, parallels D2 §7.3)
A removal **removes the card the action came from** (the confirm closed, the card is gone), so
`ModalShell`'s `prevActive.focus()` would target a **detached node** and focus would be lost to
`<body>`. Move focus to **`focusBandHeading()`** — the General band heading, the shared "move focus
sensibly off a removed node" anchor the D2 delete / candidate-dismiss / promote / pinned-player paths
already use (`TopicView` line 673). Schedule it post-close via the `requestAnimationFrame` pattern
`onDeleteConfirm` uses (so it runs **after** the shell's `prevActive` fires). Never leave focus on
`<body>`.

> **This is the removed-node case, not the same-card case.** D5b's Hold/Approve use the **same-card
> anchor** (`focusAfterReview`) because the card stays. D5c's Remove uses **`focusBandHeading()`** —
> exactly like D2 Delete — because the card is gone. (A moderator removing the only clip lands on the
> band heading of the now-empty page, the same as deleting the last clip.)

### 6.3 No reader-facing "removed" marker (binding — AC7 / Decision 1) — the contrast with D5b
A removed clip is **filtered out of the read** — it is **not** shown as a tombstone, placeholder, gap,
or "this was removed" notice to readers. This is the **deliberate contrast with the D5b held marking**:
- The **D5b held marking IS shown** to the reader (the clip stays visible, marked "In review · not yet
  vouched" — `HeldMarking` / `HeldPill`). A held clip is *shown-but-marked*.
- The **D5c removed clip is NOT shown** at all. There is **no** removed-state marking component, **no**
  reader-facing reason, **no** placeholder. The clip simply isn't in the read.

So: do **not** add any reader-facing removed-state rendering (no `RemovedMarking`, no tombstone tile, no
"N removed" count). The removed-state is **invisible to readers** — its only surfaces are (a) the
moderator's confirm dialog (their own session) and (b) the persisted tombstone (a future moderation
surface, post-MVP). This is the editorial line from C9 ("the reason is never shown to readers; a removed
clip simply stops showing") and S29.

---

## 7. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Brand indigo `#676EB4`** — the confirm dialog's header band (consistent with `DeleteConfirmDialog`);
  the General band fill the tile Remove sits on (white-fill + `accred`-border button for legibility on
  indigo); **not** a destructive signal.
- **Action blue `#1F6F95`** — reserved for the D5b **Approve** affirming act; **not** used for Remove
  (Remove is destructive, not affirming).
- **Ink `#2C2C2C`** — the Remove affordance's white fill / structure language (border-2 on hover offset),
  the Cancel button, the dialog borders, body text.
- **`accred` red `#C44949`** — the **destructive** signal for **Remove (moderator)** (card/tile
  affordance border + text — restrained, one step from a confirm, exactly like the D2 Delete affordance)
  and for the §5.5 **error** alert. The **confirm's Remove clip button** uses the AA-safe
  **`#B83A3A`** white-on-red fill (the **exact** value `DeleteConfirmDialog` uses as `DESTRUCTIVE_RED`,
  because `#C44949` is ≈4.0:1 white-on-red and must clear ≥4.5:1 — `topic-page-v1.md` §9.3; QA verifies).
  `accred` always carries a **text** label ("Remove (moderator)" / "Remove clip" / "Couldn't remove…"),
  never color alone.
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional / signal color, and must
  never be enlisted for the Remove affordance, the confirm, the reason capture, the pending state, the
  error, or anything in D5c.
- **Non-color rule (CURATION §4, binding):** every D5c signal is text-carried — the affordance is its
  **words** ("Remove (moderator)"); the destructive nature is the **word + the confirm step + the body
  copy**; the pending state is the busy **word** ("Removing…"); the error is the alert **text**; the
  reason is the **labeled select + textarea**. Color only reinforces. The "destructive" nature of Remove
  is **never** signaled by red alone — it is the word, the confirm dialog, and the soft/reversible body
  copy.
- **Remove vs. Delete share the red, differ in the word (binding — §3).** Because both Remove and Delete
  use `accred`, the **word + scope** is the sole tell between them: "Remove (moderator)" vs. "Delete";
  "Remove clip" (soft, reversible-by-admin copy) vs. "Delete clip" (permanent, can't-be-undone copy). A
  colorblind / screen-reader user gets the distinction from the words and the accessible names, never the
  color.

---

## 8. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive; the clip card, the General tile, and the confirm dialog already collapse to a
single readable column below `lg`. D5c adds no new layout but must keep the new controls usable narrow:
- **The Remove affordance in the `ReviewRow`** is part of the existing `flex flex-wrap gap-2` (rail) /
  `flex flex-wrap gap-1.5` (tile) — on a phone Hold/Approve/Remove wrap rather than overflow; each is a
  comfortable touch target (the `.srcbtn` padding gives ≥40px height). On the `w-44` General tile the
  three buttons stack/wrap and the tile does not overflow horizontally.
- **The `RemoveConfirmDialog`** is a small dialog (`max-w-sm`, the `DeleteConfirmDialog` shell); on a
  phone it occupies the small viewport with `p-4` margins. The **reason controls** must stay usable
  narrow: the category `<select>` is full-width and native (mobile-friendly); the free-text `<textarea>`
  is full-width and wraps; the Cancel / Remove clip buttons wrap; the body copy and the error/limit
  notices are full-width above the actions; no horizontal scroll at ~390px. Initial focus on Cancel
  works identically narrow.
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — the Remove affordance (moderator vs.
  non-moderator vs. logged-out; rail + tile), the confirm (the reason select/textarea, pending, success,
  expired, rate-limited, error), and the removed-from-read result (counts drop, last-clip empty flip,
  focus to band heading) at each.

---

## 9. Accessibility requirements (consolidated — verifiable against AC1/AC2/AC3/AC6, CURATION §4/§7.2)

- **The Remove affordance** — a `<button>`, text-labeled (**"Remove (moderator)"**), Tab-reachable,
  Enter/Space activates (opens the confirm), focus-visible ring; renders **only** for the moderator
  (`isModerator`), on **any** clip, **no** own-curator arm (§4.1); accessible name **"Remove this clip
  (moderator action): &lt;caption&gt;"** (distinct from the D2 owner Delete's *"your curation"*); never
  color-alone (the word + the confirm carry the destructive meaning; the `accred` reinforces).
- **The confirm dialog** — `role="dialog" aria-modal="true"` with the title (**"Remove this clip?"**) as
  the accessible name; focus trap; Esc/backdrop cancel; **initial focus on Cancel** (the safe default —
  §5.4); both action buttons text-labeled ("Cancel" / "Remove clip") + focus-visible; the destructive
  button's meaning is the **word + the soft/reversible body copy**, reinforced by `#B83A3A`; the generic
  error is `role="alert"` (announced on appearance), the rate-limit notice is `role="status"
  aria-live="polite"` (polite, no focus steal).
- **The reason capture** — the category control is a native `<select>` (or radio group) with a visible
  associated label/eyebrow (**"Reason (optional — for moderators only, not shown to readers)"**); the
  free-text is a labeled `<textarea>` (**"Add a note (optional)"**); both Tab-reachable, keyboard- and
  screen-reader-operable, focus-visible; both **optional** (default "No reason given", empty free-text);
  the reason **never** gates Remove clip and is **never** announced/shown to a reader.
- **Focus after removal** — moves to `focusBandHeading()` (§6.2 — the removed-node anchor, like D2
  Delete), never lost to `<body>`.
- **Expired session** — routes to the gate dialog carrying the verbatim "Your session ended…" line
  (§5.5); not a silent failure.
- **No reader-facing removed marker** — a removed clip is filtered out; there is no removed-state
  rendering for a reader to perceive (§6.3) — the contrast with the D5b *shown-but-marked* held state.
- **Contrast (AA, binding)** — white-on-red on the confirm's Remove clip button uses `#B83A3A` (the D2
  `DESTRUCTIVE_RED`, ≥4.5:1; `#C44949` is ≈4.0:1 — `topic-page-v1.md` §9.3); the affordance `accred` text
  on white, the busy word, the error text, and the reason labels against their backgrounds (QA
  spot-checks the `text-[12px]` / `text-[11px]` copy).
- **Responsive** — the Remove affordance + the confirm (incl. the reason controls) operable by keyboard
  and touch at ~390px (§8).

---

## 10. Deltas from the committed surfaces (Dev: build these on top)

The `topic-page-v1.md §5.9` clip card, the D2 owner manage-row + `DeleteConfirmDialog`, and the D5b
`ReviewRow` + `isModerator` + the three-arm catch all stand. D5c changes exactly these points;
everything else is unchanged.

1. **A `canRemove` predicate in `TopicView`** — **moderator-only, any clip, NO own-curator arm**:
   `canRemove = isModerator` (parallel to `canHold` / `canApprove`, but **without** the `ownsClip`
   OR-arm — §4.1). Off the read path (the `isModerator` claim is already read for D5b); **no** read-path
   cost (AC7). *(AC2/AC3 affordance side.)*
2. **Remove joins the D5b `ReviewRow`** (recommended — §4.2): add `canRemove` + `onRemove`
   (+ optionally `removeInFlight`) props; render **"Remove (moderator)"** **last** in the row (after
   Hold/Approve), the **restrained `accred` destructive** treatment (white fill + `accred` border + text;
   hover → `accred` fill + white), on **both** the rail (`size="rail"`) and the tile (`size="tile"`);
   accessible name **"Remove this clip (moderator action): &lt;caption&gt;"**. Extend `ReviewRow`'s
   early-return guard to also stay mounted when `canRemove`. *(AC2/AC3 affordance side.)*
3. **A `RemoveConfirmDialog`** parallel to `DeleteConfirmDialog` (§5): the `ModalShell` yes/no, the
   `SubmitOutcome` contract, the `alive`/`pending` guards, **Cancel as the focused default**
   (`data-remove-cancel`), **"Remove clip"** as the `#B83A3A` destructive confirm, the pending word
   **"Removing…"**, the `role="alert"` generic error **"Couldn't remove — please try again."**, the calm
   `limited` notice, and the expired-gate route. **New body copy** (verbatim, the soft/reversible
   framing — §5.1) and **new** optional reason capture (§5.2). *(AC1, AC6.)*
4. **The optional, audit-only reason capture** in the confirm (§5.2): the **verbatim C9 category** select
   (default "No reason given" + the 8 §7 labels) + an optional free-text **"Add a note (optional)"**;
   both **optional** (never gate Remove clip — Decision 4); never pre-filled from the clip's chips
   (§5.3); **never** shown to a reader (§5.2 / §6.3). Centralize the labels (e.g.
   `lib/curation/removal-reason.ts`) so the form + a future moderation surface share one source. *(AC6;
   CURATION §7.2 / C9.)*
5. **`runRemove` + the confirm's `onConfirm` in `TopicView`** (§2.1 / §5.5 / §6) — mirror
   `onDeleteConfirm`: a `removeFor` target (set by the Remove affordance), call `store.removeClip(id,
   reason)` via the seam; on success filter the clip out of `clips` (the no-reload removed-from-read) +
   `requestAnimationFrame(() => focusBandHeading())` (the removed-node anchor — §6.2) + the last-clip
   empty flip (the existing `mode` switch); the **three-arm catch** (`isAuthRequired` →
   `showExpiredGate()` / `outcome: "expired"`; `isRateLimited` → `outcome: "limited"`; else `throw`). The
   client filter is the no-reload reflect; the durable truth is the server soft-remove + `removed_at IS
   NULL` read filter (Dev/QA). *(AC1, AC7.)*
6. **No reader-facing removed-state rendering** (§6.3): D5c adds **no** `RemovedMarking` / tombstone /
   placeholder / "N removed" count — a removed clip is filtered out. (The deliberate contrast with the
   D5b `HeldMarking` / `HeldPill`, which **are** shown.) *(AC7; Decision 1.)*

No change to: the chips + their AA fills (`topic-page-v1.md` §9), the curator note, the creator credit,
the provenance footer, the D5b held marking (`HeldMarking`/`HeldPill`) and Hold/Approve actions, the D2
owner Edit/Delete + `DeleteConfirmDialog` (Remove **parallels** it, does not change it), the §6
candidate / empty-state treatment, the scroll-sync, the article side, the D1 add/promote flows, or the
modal shells. Reading stays anonymous — no per-user work on the read path (§4.1 / §6.3).

---

## 11. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | A moderator removes ANY clip → it stops showing, no reload (with confirm); last→empty; survives reload | §2.1, §5, §6.1, §6.2 |
| AC2 | A non-moderator's removal (incl. own curator) rejected server-side | §2 (gate-vs-affordance), §4.1 (no own-curator arm + constraint) — *server is Dev/QA* |
| AC3 | A logged-out removal rejected server-side | §2, §4.1 (no affordance logged out + constraint) — *server is Dev/QA* |
| AC4 | Removal distinct from D2 owner-delete (soft vs. hard; moderator vs. owner) | §3 (table + tells), §5.1 (soft/reversible body copy vs. D2 permanent copy), §7 |
| AC5 | Removal distinct from the D5b hold (down/filtered vs. shown-but-marked) | §3, §6.3 (no reader marker vs. D5b held marking), §4.2 (Remove in ReviewRow, distinct from Hold/Approve) |
| AC6 | The tombstone persists who/when/optional-why | §5.2 (the optional reason capture) — *server persistence is Dev/QA* |
| AC7 | Removed-state rides the read as an exclusion; no per-user work; no reader tombstone | §4.1 (no read-path cost), §6.1, §6.3 |
| AC8 | Removal model recorded in ARCHITECTURE | (Dev/QA — docs-as-built; no design blocker) |
| AC9 | build/typecheck/test green; removal tested without a live provider | (Dev/QA — no design blocker) |

---

## 12. What UX will evaluate at Phase 4

Against this spec **and** the stories (S26–S30), on the running prototype with the session stubbed (the
C/D1/D5b pattern — no live OAuth in CI; stub a **moderator** session, a **curator/non-moderator** session,
and **logged-out**):
- **The moderator-only Remove affordance (AC2/AC3 affordance side):** **"Remove (moderator)"** appears
  for a moderator on **any** clip (own, another's, published, held) on both the rail card and the General
  tile; appears on **no** clip for a signed-in non-moderator — **including the clip's own curator** (no
  own-curator arm — the key D5b contrast); appears on **no** clip when logged out; text-labeled,
  keyboard-operable, focus-visible; in the moderator review surface (`ReviewRow`), placed last/after
  Hold/Approve, and **visually + textually distinct from** the D2 owner Delete (the word "(moderator)" +
  the soft confirm copy) and the D5b Hold/Approve (red destructive vs. ink/action-blue).
- **The removal confirm (AC1/AC6):** card Remove → a confirm with **Cancel focused by default**, the
  soft/reversible body copy (not D2's "permanently … can't be undone"), and the **optional, audit-only**
  reason capture — the verbatim C9 categories + optional free-text, defaulting to "No reason given,"
  **never** required, **never** pre-filled from the clip's chips; Remove clip is enabled with no reason
  chosen; a single click never removes.
- **The removed-from-read result (AC1/AC7):** Remove clip → the clip **disappears** from the page with
  no reload (counts drop; last clip flips to empty); **focus lands on the band heading**, never
  `<body>`; survives a reload (the stubbed store excludes it); and there is **no** reader-facing
  "removed" marker, placeholder, or gap anywhere (the contrast with the D5b *shown-but-marked* held
  state).
- **The states (AC1/AC2/AC3 state side):** Remove pending shows the busy **word** "Removing…" and blocks
  double-submit; a rate-limit keeps the dialog open with the **calm** `rateLimit.notice` and leaves the
  clip unchanged; an expired session routes to the "Your session ended…" gate; a generic error keeps the
  dialog open with the `role="alert"` "Couldn't remove…" and leaves the clip present (no false success —
  the clip never disappears on a failed removal).
- **A11y in practice:** the Remove affordance + the confirm (incl. the reason select/textarea) operable
  by keyboard at ~390px; AA contrast on the `accred` Remove affordance and the `#B83A3A` Remove clip
  button (white-on-red cleared); the reason capture optional and clearly internal; the removed-state
  invisible to a reader (filtered, not marked).
- **Indigo Press fidelity:** `accred` carries the destructive Remove + error signals **with text
  labels**; gold unused; action-blue reserved for Approve (not Remove); the soft/reversible removal copy
  honest (not a "permanent destroy"); signals text-carried (§7); the abuse-not-disagreement boundary
  visible (no chip-driven nudge to remove — §3).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is distinct
from QA & Review's correctness/security pass — UX asks "does it match intent and feel right," QA verifies
the **server-side role-gate** AC2/AC3 at the action — a non-moderator / own-curator / anonymous direct
call rejected on the **role**, not by a hidden button.)
