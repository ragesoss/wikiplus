# Design Spec: Edit / delete your own curated clips — ownership-gated (milestone D2)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#53](https://github.com/ragesoss/wikiplus/issues/53) — milestone **D**, run **2 of 5**).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/clip-edit-delete.md` — the Product spec. This design serves **AC1–AC12**, the
    curator-revises/retracts stories below, and honors Decisions **2** (editable set), **3** (§5.3
    re-affirmation on a *material* note edit), **4** (hard delete + confirmation), and **6**
    (owner-only affordance; the gate is server-side + id-based).
  - `docs/design/curate-add-persistence.md` — **the D1 design spec.** D2 **reuses** D1's curate
    surface (`CurateFields` / the Curate modal), its **required CC BY-SA agreement control** (§3),
    and its **pending / success / error / expired-session** state patterns (§§5–7). This spec
    specifies the **deltas** D2 adds, not a redesign.
  - `docs/CURATION_STANDARD.md` **§5.3 / Decision C5** — the edit re-affirmation rule + the two
    canonical agreement strings, used **verbatim** (centralized in `lib/curation/note-license.ts`):
    *"Your context note will be released under CC BY-SA 4.0."* / *"I agree to release my context
    note under CC BY-SA 4.0."*
  - `docs/design/topic-page-v1.md` **§5.9** (the curated clip card), **§11.4** (modal a11y),
    **§11.2** (focus-visible), **§12** (responsive), **§9.3** (chip AA contrast); and
    `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity). Reference mockups
    `mockups/inline-indigo-sync.html` (curated).
- **Implementable against (current code this spec extends, not redesigns):**
  `components/topic/ClipCard.tsx` (the curated clip card — where the owner affordances go),
  `components/topic/CurateForm.tsx` (`CurateFields` — the curate surface to pre-fill + condition
  the agreement on), `components/topic/CurateModal.tsx` (the modal to clone into an Edit modal),
  `components/topic/ModalActionRow.tsx` (publish / cancel / error alert), `components/topic/ModalShell.tsx`
  (dialog focus-trap + return-to-trigger), `components/topic/useCurateSubmit.ts` (the
  pending/success/error/expired state machine), `components/topic/curate-clip.ts` (`clipFromForm`),
  `app/topic/TopicView.tsx` (the in-memory `clips` set, `persistClip`, `focusBandHeading()`,
  `isAuthRequired` → `showExpiredGate()`), `lib/curation/note-license.ts` (the verbatim strings +
  `NOTE_LICENSE`), `lib/auth/microcopy.ts` (`AUTH_COPY`).
- **Feeds:** Development (build to **this spec** for the D2 deltas, on top of the committed D1
  curate surface + the `topic-page-v1.md §5.9` clip card). Then QA & Review (correctness/security)
  + UX evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the **deltas** D2
> adds: the owner-only **Edit + Delete** affordances on a curated clip card, the **pre-filled** edit
> surface (reusing D1's modal + states), the destructive-delete **confirmation** step, the
> **conditional §5.3 re-agreement** that appears only once the note text diverges, and the
> **no-reload** edit-in-place / delete-and-move-focus result on the page. It does **not** redesign
> the curate form, the modal shell, or the clip card; the committed `topic-page-v1.md §5.9` card and
> D1 §§3/5/6/7 stand. Every requirement is tagged with the Product AC(s) and the story it makes
> buildable. **The security control is the server-side, id-based gate (Decision 6 / AC4–AC6/AC8) —
> not these affordances; this spec designs the affordances and never claims they protect data.**

---

## 1. Personas & stories served

D2 is a **curator-side** run, like D1. Of the three Topic-page personas (`topic-page-v1.md` §1), it
serves **P2 the curator/contributor** as the primary user; **P1 the reader** is the downstream
beneficiary (an out-of-date or retracted vouch corrected); **P3 the moderator** is context-only
(removing *someone else's* clip is **D5**, not D2).

### P2 — Marcus, the curator/contributor (PRIMARY this run)
The same persona D1 served. D1 let Marcus *publish* a vouch; D2's premise is that **a vouch is not a
one-shot act**. After living with a clip he curated, Marcus will want to tighten the note's wording,
correct the stance/accuracy assessment, re-file it to a better section — or **retract** it entirely
when he no longer stands behind it. D2's job is that he can revise or remove **his own** vouch, and
only his own. He works mostly on desktop but may be on a phone, on a keyboard, or on a screen
reader; every affordance, the confirmation step, and the conditional re-agreement must work for all
of those.

He **cannot** touch a clip another contributor curated — that is not his vouch to revise — and a
clip he is **not** signed in to own shows him nothing to act on. This is the boundary the design
draws visibly (the affordance) and the server draws authoritatively (the gate).

### P1 — Priya, the reader (downstream beneficiary)
Anonymous, unchanged. D2 adds **no per-user work to the read path** and nothing Priya must log in
for. Her stake: a clip whose note Marcus just sharpened — or removed because it no longer holds up —
is a more trustworthy page for her. Reading stays anonymous; the cached read path gains nothing
per-user (the ownership comparison for the affordance runs only in the **already-authenticated**
client session — §3.1).

### P3 — Mod, the moderator (CONTEXT ONLY — out of scope)
Removing or editing **another** contributor's clip — the moderator capability and the review-hold —
is **D5**. D2 adds no role concept beyond "owner vs. not owner." Legacy `@prototype` clips, owned by
no current user, are inert to everyone (S18 / AC8) precisely because there is no moderator role yet.

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S16 — revise my own vouch.** *As a curator, I want to edit the note, stance, accuracy, and
  section of a clip I curated — and only one I curated — so I can correct or sharpen my vouch when I
  learn more or word it better.* *(AC1, AC2, AC7; CURATION §1–§3.)*
- **S17 — retract my own vouch, deliberately.** *As a curator, I want to delete a clip I curated,
  with a clear confirmation so I never destroy a vouch by accident, and see it leave the page.*
  *(AC3, AC7; Decision 4.)*
- **S18 — only mine, and I'm not handed a control I can't use.** *As a curator, I want edit/delete to
  appear only on clips I own — not on others', not when logged out, not on legacy stub clips — so the
  page never offers me a capability that would be rejected.* *(AC7, AC8; the affordance side of the
  Decision 6 gate.)*
- **S19 — re-affirming the license when I rewrite the note.** *As a contributor, when I materially
  change the note text I want to re-affirm the CC BY-SA release — but not be asked again for a
  stance/accuracy/section-only tweak — so consent keeps binding to the note as published, without
  friction where it isn't needed.* *(AC9, AC10; CURATION §5.3.)*
- **S20 — my edit is real, or I'm told it failed.** *As a curator, when I save an edit I want to see
  the clip update in place, or be clearly told it didn't save with my edits intact — never a modal
  that closes as if it worked when nothing changed; and if my session ended, tell me that.* *(AC2,
  AC6, AC11; inherits D1's S15 bar.)*

---

## 2. The two flows, end to end

Both flows begin on the **curated** Topic page (`mode === "curated"` in `TopicView`), on a **curated
clip card** (`ClipCard`, `topic-page-v1.md` §5.9) that the **signed-in contributor owns**. The
owner-only affordances (§3) are the only new triggers; everything downstream **reuses** D1.

> **The gate vs. the affordance (binding, set by Decision 6).** The affordances in §3 decide *which
> cards show Edit/Delete*; they are convenience + clarity. The **authorization** is the server-side,
> id-based check inside `updateClipAction` / `deleteClipAction` (`clip.curatorId === session
> contributorId`, AC4/AC5/AC6/AC8) — Dev's, verified by QA at the action. This design never relies on
> a hidden button to protect data; §3.1 fixes the affordance constraint, the rest is the experience.

### 2.1 Edit-a-clip (the Edit modal) — S16 / S19 / S20
1. **Trigger.** Marcus activates **"Edit"** on a curated clip card he owns (§3.2). No login gate is
   needed at the trigger — the affordance only renders when signed in and owning (§3.1) — but the
   **submit** is still gated server-side (the expired-session route, step 5, covers the in-between).
2. **Open, pre-filled.** The **Edit modal** opens (a clone of D1's `CurateModal` — §6). It is the
   **same curate surface** (`CurateFields`), **pre-filled** from the clip: the **context note**
   text, the **stance** (+ `stanceModifier`), the **accuracy** (+ `accuracyModifier`), and the
   **section** placement (`General` or the clip's `sectionSlug`). Header title reads **"Edit
   curation"**; the clip-summary block names the clip's caption + creator (read-only). Initial focus
   lands on the note textarea (existing `initialFocusSelector`).
3. **Conditional agreement (§4, the core D2 delta).** Because the clip already carries a captured
   agreement, the §5.3 required-agreement control is **not** shown on open. It **appears and becomes
   required only once the note's normalized text diverges** from the stored note (a *material* note
   edit — Decision 3). A stance/accuracy/section-only change, or a whitespace-only note change,
   never surfaces it. Details + the exact reveal/require/hide behavior are §4.
4. **Save.** Marcus activates **"✓ Save changes."** Client-side preconditions (AC10-analog): a
   **non-empty** note, and — **only if** the note is a material change — the **agreement checked**.
   If the note is unchanged or only chip/section changed, the agreement is not required and Save is
   available. On save the modal enters **pending** (D1 §5): the Save control disables + shows a busy
   label (**"Saving…"**); no double-submit. (See §5 for the "nothing changed" edge.)
5. **Result.**
   - **Success →** `updateClipAction` returns the updated clip; the modal **closes**, focus returns
     to the originating **Edit** trigger (`ModalShell` `prevActive`); the clip **re-renders in place**
     with its new note / chips / section, **no reload** (§7, AC2). If the section changed, the card
     moves to its new anchor (§7.1).
   - **Server error →** the modal **stays open**, every edited field value is preserved (the modal
     stays mounted), the §6 `role="alert"` message **"Couldn't save — please try again."** appears
     at the action row; nothing was written (D1 §6, AC11-analog).
   - **Expired session →** the boundary rejects with `AuthRequiredError`; the modal closes and the
     **expired-session login gate** appears (D1 §7.2 — *"Your session ended — please log in again."*),
     not a generic error; nothing was written (§8, AC6).

### 2.2 Delete-a-clip (the Delete confirm dialog) — S17 / S20
1. **Trigger.** Marcus activates **"Delete"** on a curated clip card he owns (§3.2). Delete is
   **destructive and irreversible** (hard delete, Decision 4 — no undo) — so it **never** fires from
   this single click.
2. **Confirm.** A **Delete confirmation dialog** opens (§9): a small `ModalShell` dialog that names
   what will be deleted and asks for an explicit second act. **Cancel is the default / safe choice**
   (initial focus); **Delete clip** is the destructive confirm, styled with the established `accred`
   red + its text label (never color alone — §10).
3. **Confirm → delete.** Activating **"Delete clip"** runs `deleteClipAction`. The confirm dialog
   enters **pending** (the Delete-clip control disables + shows **"Deleting…"**; Cancel stays enabled;
   no double-submit — mirrors D1 §5).
4. **Result.**
   - **Success →** `deleteClipAction` removes the clip; the confirm dialog closes; the clip is
     **removed from the page's in-memory clip set, no reload**; the infobox counts
     (videos/creators/curators) reflect its absence; if it was the **last** curated clip the page
     **flips curated → empty** (§7.2, AC3). Because the **clip card is gone**, focus must not be lost
     to `<body>` — it moves to **`focusBandHeading()`** (the same stable anchor the dismiss / promote
     / pinned-player paths use — §7.3, AC3-analog).
   - **Server error →** the confirm dialog **stays open**, a `role="alert"` message **"Couldn't
     delete — please try again."** appears, the Delete-clip control returns to idle; the clip is
     still present; the curator can retry or Cancel (§9.3).
   - **Expired session →** the confirm dialog closes and the **expired-session login gate** appears
     (D1 §7.2 / `showExpiredGate()`), not a generic error; nothing was deleted (§8, AC6).

---

## 3. The owner-only Edit + Delete affordances (the first D2 delta) — AC7

This is the visible boundary "this is your vouch to revise." It is added to the **curated clip card**
(`ClipCard`, `topic-page-v1.md` §5.9) and **only** there (D2 surfaces edit/delete on the Topic page,
not a "my clips" index — that is D3).

### 3.1 When the affordances render (the only fixed constraint; mechanism is Dev's — Decision 6)
The Edit + Delete affordances render **only** when **all** hold:
1. the viewer is **signed in** (a valid session — `useSession()` `status === "authenticated"`), **and**
2. the viewer **owns** the clip.

In **every** other case there is **no** edit/delete affordance on the card:
- **logged out** → no affordance on **any** clip (AC7);
- a clip curated by a **different** contributor → no affordance (AC7);
- a **legacy `@prototype`** clip (owned by no current user) → no affordance to anyone (AC8).

**Ownership comparison (the affordance only — NOT the security gate).** Decision 6 leaves the
client-side mechanism to Dev, with one fixed constraint: **the affordance must never be the security
control** — the server gate (`clip.curatorId === session contributorId`) is. Two viable mechanisms,
already supported by the code:
- **(a)** expose `clip.curatorId` read-only on the client `Clip` (today `rowToClip` exposes
  `curatedBy` but not `curatorId`) and compare it to `session.user.contributorId` — matches the
  server gate exactly; **preferred** (no username-collision corner case);
- **(b)** compare `session.user.username` to `clip.curatedBy` (a display username) — no schema/shape
  change; acceptable **only** because the server gate is authoritative (a rename/collision would at
  worst show/hide a button wrongly, never authorize a write).
Both `session.user.contributorId` and `session.user.username` are available client-side
(`lib/auth/config.ts`). Dev picks; records the choice in ARCHITECTURE (AC12). **The constraint that
does not move: a non-owner / anonymous direct action call is rejected server-side regardless of any
button (AC4/AC5/AC6/AC8).**

**No read-path cost (binding).** The ownership comparison runs **only** in the already-authenticated
client session, on data already loaded; it adds **no** per-user work to the cached read path. An
anonymous reader's render is byte-for-byte unchanged (no affordance, no session read on the read
path).

### 3.2 Placement & anatomy on the clip card
The affordances sit in a small **owner action row** on the curated clip card, **below the provenance
footer** (the last element today, `ClipCard` lines 87–95) — so they read as "manage this clip I
curated," distinct from the reader-facing content (thumbnail / chips / note) above. They do **not**
displace or restyle any existing card element; they are an **additive** row that renders only for the
owner (§3.1).

- A `role="group"` row, `aria-label="Manage your curated clip"`, `flex flex-wrap gap-2`, a hairline
  top divider (`border-t border-ink/15 pt-2 mt-2`) to separate from the decorative footer.
- **"Edit"** — a `<button type="button">`, **secondary** treatment: white fill, 2px ink border,
  Source Sans Pro bold `text-[12px]`, ink text, hover lifts a 2px ink offset (the `.srcbtn` language,
  `topic-page-v1.md` §6.3). A leading pencil glyph is optional and decorative (`aria-hidden`); the
  **word "Edit" is the signal**. `aria-label="Edit your curation: <caption>"`. Activates §2.1.
- **"Delete"** — a `<button type="button">`, **destructive** treatment but **restrained** (it is one
  step from a confirm, not the destroy itself): white fill, **2px `accred` border**, **`accred` text**,
  Source Sans Pro bold `text-[12px]`; hover deepens to an `accred` fill with white text (confirm the
  AA of white-on-`accred` per §10 / `topic-page-v1.md` §9.3, darken toward `#B83A3A` if needed). A
  leading trash glyph is optional + `aria-hidden`; the **word "Delete" is the signal** (never
  color-alone). `aria-label="Delete your curation: <caption>"`. Activates §2.2.

The two buttons sit in a sensible tab order **after** the card's existing interactive elements
(section link → thumbnail → creator credit link → **Edit → Delete**). Both are real `<button>`s:
Tab-reachable, Enter/Space activates, the global `:focus-visible` 3px indigo outline applies
(`topic-page-v1.md` §11.2).

### 3.3 Accessibility of the affordances (binding — AC7, CURATION §4)
- **Text-labeled.** Each affordance carries its **visible word** ("Edit" / "Delete"); meaning never
  depends on the glyph or the red. A colorblind / screen-reader / high-contrast user gets the full
  meaning. The destructive nature of Delete is carried by the **word + the confirmation step (§9)**,
  reinforced (not signaled) by the `accred` border.
- **Keyboard-operable + focus-visible.** Both are native buttons in the tab order (§3.2); the global
  focus-visible ring applies.
- **Owner-scoped name.** The `aria-label`s say **"your curation"** so a screen-reader user
  understands these act on a clip they own — matching the visible boundary.

---

## 4. The conditional §5.3 re-agreement on a material note edit (the second D2 delta) — AC9 / AC10

This is the subtlest D2 delta. On **add** (D1 §3) the agreement is *always required* (every publish
is a new note). On **edit**, the agreement is required **only when the note text materially changes**
(Decision 3 / CURATION §5.3) — so a curator fixing a chip or re-filing a section is not asked to
re-consent to a note they did not change, while a curator rewriting the note **does** re-affirm.

### 4.1 The behavior, as the user edits (buildable)
The Edit modal reuses D1's `CurateFields`, with these deltas:
- **Pre-filled, not empty.** `CurateFields` opens with the clip's current `contextNote` in the
  textarea (and the stance/accuracy/section selects defaulted to the clip's current values — §6.2).
- **Agreement hidden on open.** The §5.3 two-part agreement block (license statement + required
  checkbox) is **not** rendered on open (unlike D1, where it always shows). The clip already carries
  a captured agreement; an unchanged or chip-only edit re-affirms nothing.
- **Agreement reveals + becomes required only on a *material* note change.** As the curator types,
  compare the **normalized** textarea value to the **normalized stored note** (Decision 3's rule:
  trim + collapse internal whitespace runs). The instant the normalized text **diverges**:
  - the §5.3 block **appears**, animating in is optional and motion-suppressed-safe (a simple reveal;
    no layout jank — it sits directly above the action row exactly as in D1 §3.1);
  - it shows the **verbatim** `NOTE_LICENSE_STATEMENT` (always-visible once revealed) + the
    **verbatim** `NOTE_LICENSE_AGREEMENT` checkbox, **unchecked** (a fresh per-submit act);
  - the checkbox becomes a **required precondition** of Save (Save is disabled until it is checked,
    exactly as D1 §3.2 gates publish).
- **Agreement hides + stops being required when the text reverts.** If the curator edits the note
  back so the **normalized** text again matches the stored note (or only changes whitespace), the
  block **hides** and Save no longer requires it. (Edge: if the curator had checked the box and then
  reverts the text, the requirement simply lifts; re-diverging re-reveals an **unchecked** box — a
  fresh act each time it is materially different.)

**The signal of "material" is coordinated with Dev (Decision 3).** The **client** computes
"normalized note text differs from the stored normalized note" to drive the reveal/require, and
passes the agreement boolean only when it shows it. The **server** independently recomputes
materiality from the patch (it has the stored note) and is the authority on whether to **re-stamp**
`noteLicense` + `noteLicenseAgreedAt` (AC9) or leave them (AC10) — the client's reveal is the
*consent capture surface*, never trusted as the stamp trigger. Dev should share one normalization
helper between client and server so the UI reveal and the server stamp agree on the same line.

### 4.2 What this means per case (maps AC9 / AC10)
- **Material note-text change** (normalized text differs) → agreement **shown + required**; on Save
  the server re-stamps `noteLicense` = `CC-BY-SA-4.0` + a fresh `noteLicenseAgreedAt` (AC9). The act
  the curator takes (re-check the box) matches what we re-capture — the D1 §3.5 honesty rule.
- **Chip / section-only change, or note unchanged / whitespace-only** (normalized text identical) →
  agreement **not shown, not required**; on Save the server **leaves** `noteLicense` /
  `noteLicenseAgreedAt` untouched (AC10).

### 4.3 Accessibility of the conditional agreement (binding — AC9, CURATION §4)
- The agreement block, when revealed, is the **same** accessible control as D1 §3.4: a native
  checkbox with an associated visible `<label>` carrying the verbatim text; Tab-reachable,
  Space-toggles, focus-visible; the Save button's unavailability discoverable via `aria-describedby`
  → the license statement (reuse `ModalActionRow`'s existing wiring).
- **Its appearance must be announced to AT.** Because the control appears *mid-edit* (not on open),
  wrap the agreement block in a container that is announced when it becomes present — e.g. render it
  inside an `aria-live="polite"` region, or move focus is **not** stolen (do not yank focus from the
  textarea while typing) but the newly-revealed required control + the Save button's changed
  describedby make the new requirement discoverable. The requirement is: a screen-reader user who
  materially changed the note can discover that Save now needs the agreement and where it is. (Exact
  mechanism is Dev's; `aria-live` on the reveal container is the recommended path.)
- Never color-alone: the requirement is the **labeled checkbox + the disabled Save**, never a red
  cue (D1 §11 non-color rule carries forward).

---

## 5. The Edit modal's states (reuse D1 §§5–6; deltas noted) — AC2 / AC11-analog

The Edit modal reuses `useCurateSubmit`'s lifecycle and `ModalActionRow`. Deltas from D1:

- **Idle / Save microcopy.** The action is **"✓ Save changes"** (idle) → **"Saving…"** (busy,
  present-progressive **word**, not a spinner alone — D1 §5). (Not "Publish" — this is a revise, not
  a first publish.)
- **Save precondition.** Save is enabled when: a **non-empty** note **and** (only if the note is a
  material change) the **agreement checked**. For a chip/section-only edit the agreement is not part
  of the precondition (§4). `useCurateSubmit`'s `agreed` precondition must be **conditional on
  whether the agreement is shown** — Dev: gate Save on `hasNote && (!materialNoteChange || agreed)`.
- **Pending.** Save disables + shows "Saving…"; no double-submit; Cancel / ✕ / Esc / backdrop stay
  enabled (the user can abandon mid-flight); a late resolve after the modal is gone is ignored (the
  `alive` guard, D1 §5). Unchanged from D1's machine.
- **Server error.** The modal **stays open**, all field values preserved (modal stays mounted),
  Save returns to idle, a `role="alert"` message at the action row: **"Couldn't save — please try
  again."** (the D1 §6 alert treatment — 2px `accred` border, `#FDEDED` bg, `accred` text; focus
  sent to the alert). Distinct from the expired-session case (§8). *(AC11-analog.)*
- **"Nothing changed" edge (no AC, but specify so Dev does not guess).** If the curator opens Edit
  and saves with **no** field changed at all, two honest options — Dev's call, but specify one:
  **(preferred)** allow the Save (it is a harmless idempotent write; the server's materiality check
  leaves the license untouched per AC10, and the clip re-renders identically) — simplest, no special
  UI. The alternative (disabling Save until *something* changes) adds change-tracking complexity for
  little user value; do **not** build a "you have unsaved changes" affordance in D2 (out of scope).
  Whichever Dev picks, a no-op save must **never** re-stamp the license (AC10) and must **never**
  read as an error.

---

## 6. The Edit modal — built from D1's `CurateModal` (Dev: clone, don't fork the form) — §6 deltas

D2 does **not** add a second curate form. It adds an **Edit modal** that reuses `CurateFields`,
`ModalActionRow`, `ModalShell`, and `useCurateSubmit` — the same surface as `CurateModal`, with the
pre-fill + conditional-agreement deltas (§4) and the edit submit wiring. Concretely:

### 6.1 The dialog
- `ModalShell`, `role="dialog" aria-modal="true"`, `aria-labelledby` → the title; `max-w-lg`,
  `.plus-card`, `max-h-[90vh] overflow-y-auto`. Indigo header band: title **"Edit curation"** + a
  **"✕"** cancel (`aria-label="Cancel"`). Initial focus → the note textarea (existing
  `initialFocusSelector="textarea[name=note]"`).
- **Clip-summary block** (read-only, reuse the `CurateModal` summary block, lines 73–81): the clip's
  **caption** (bold) + **"<creator name> · <platformLabel>"** — but **without** the "auto-suggested,
  not yet curated" sub-text (this is a *curated* clip, not a candidate). Use a neutral line such as
  **"Your curation · <platformLabel>"** — read-only context, not editable (the media/creator identity
  is **not** in the editable set, Decision 2).

### 6.2 The pre-filled fields (the §4.1 deltas to `CurateFields`)
`CurateFields` gains optional initial values so it serves both add (empty) and edit (pre-filled):
- **Context note** — textarea pre-filled with `clip.contextNote`; same counter / helper / soft-cap
  (320) / maxlength (400) as D1. Drives the §4 materiality comparison against the **stored** note.
- **Stance** select — defaulted to `clip.stance`. (Modifier: D2 does not add a UI for the optional
  `stanceModifier` — it was display-only and not in the D1 form; an edit preserves the existing
  modifier untouched. **Flag for Dev:** if the patch omits `stanceModifier`, preserve the stored
  value rather than clearing it — confirm with Product/Dev; UX does not introduce a modifier input
  in D2.)
- **Accuracy** select — defaulted to `clip.accuracyFlag`. Same modifier note as stance.
- **Section** select — defaulted to **"General"** when `clip.general`, else the clip's `sectionSlug`
  (so the current placement is pre-selected); options are "General" + the article section titles
  (existing).
- **Agreement** — hidden on open; conditional reveal per §4.

The selects today are **uncontrolled `defaultValue`** fields read at submit (`clipFromForm`). For the
edit pre-fill, Dev sets each `defaultValue` from the clip; `clipFromForm` already reads them at submit
into the patch shape. (No controlled-input rework needed — `defaultValue` pre-fill + read-at-submit is
sufficient and matches the existing pattern.)

### 6.3 The submit wiring (host owns the write — reuse `TopicView`'s `persistClip` pattern)
The Edit modal hands the assembled **patch** + the agreement boolean up to `TopicView` exactly as
`CurateModal` hands its clip to `onCurateSubmit`. The host:
- calls the new **`updateClipAction`** via the seam (Dev surfaces `updateClip` on `lib/data/store.ts`
  per the Product spec scope item 4/6), passing the clip id + the editable-set patch + the agreement
  boolean (the **server** decides materiality + whether to re-stamp — §4.1);
- on **success**, replaces the clip **in place** in the in-memory `clips` array (map by id → the
  returned updated clip), so it re-renders with new note/chips/section, no reload (§7.1);
- on **`AuthRequiredError`**, calls `showExpiredGate()` and resolves the modal's outcome as
  `"expired"` (modal closes — D1 §7.2 pattern, mirrors `persistClip`);
- on any **other** error, throws so `useCurateSubmit` keeps the modal open with the §6 alert.

The edit patch carries **only** the editable set (`contextNote`, `stance` (+ modifier preserved),
`accuracyFlag` (+ modifier preserved), `general` / `sectionSlug` / `sectionLabel`) — `clipFromForm`
already produces exactly this shape minus the media/creator fields; for edit, the media/creator
fields are **not** sent (Decision 2). Dev: derive the patch from the form, not from re-sending the
whole clip.

---

## 7. The result on the page — no reload (AC2 / AC3)

### 7.1 Edit re-renders in place (AC2)
On a successful edit, the clip updates **in place** in the same session, no manual reload:
- The card shows its **new** context note, **new** stance/accuracy chips (rendered from the closed
  enums via the existing label map — an out-of-vocab patch is rejected server-side, AC2), and **new**
  creator-unchanged content (creator/media are not editable).
- **Section change moves the card.** If the section placement changed (e.g. General → a section, or
  section A → section B), the card re-anchors: it leaves its old position and renders under the new
  section's anchor (or the General strip if changed to General), and the **TOC count badges** for the
  old and new sections adjust. This falls out of the in-memory `clips` array re-render + the existing
  grouping (`sectionClips` / `generalClips` / `tocEntries` derive from `clips`) — Dev replaces the
  clip object in `clips`; the existing derivations do the rest. No new layout.
- **No focus or scroll jank.** Editing does not move the reader to the top. After the modal closes,
  focus returns to the **Edit** trigger (`ModalShell` `prevActive`). Because an edit does **not**
  remove the card, the trigger is still in the DOM — the normal `prevActive.focus()` works (no
  band-heading exception needed for edit; that is the delete case, §7.3).

### 7.2 Delete removes the clip; last clip flips curated → empty (AC3)
On a successful delete, the clip is **removed** from the in-memory `clips` set, no reload:
- The card disappears; the infobox **counts** (videos / creators / curators — `deriveStats(clips)`)
  drop accordingly; the **TOC badge** for its section (or the General band count) decrements. All of
  this falls out of removing the clip from `clips` (the derivations recompute) — no new state.
- **Last clip → empty flip.** If it was the **only** curated clip, `mode` (= `clips.length > 0 ?
  "curated" : "empty"`) flips to **empty**: the page returns to the empty/uncurated experience
  (`topic-page-v1.md` §6) — the infobox switches to "0 / videos curated" + the CTA, the band relabels
  to "＋ Suggested videos · uncurated", the TOC badges switch to dashed `~n`. This is the **existing**
  `mode` switch — Dev just removes the clip from `clips`; the state machine already exists (same
  mechanism D1 §4.2 used in reverse). No new layout.

### 7.3 Focus after delete must land on a stable anchor (binding — AC3-analog, a11y)
A delete **removes the card the action came from**, so `ModalShell`'s `prevActive.focus()` would
target a **detached node** and focus would be lost to `<body>`. Dev must instead move focus to
**`focusBandHeading()`** — the General band heading, the shared "move focus sensibly off a removed
node" anchor already used by candidate dismissal, promote (D1 §4.4), and the pinned player. Schedule
it post-close (the `requestAnimationFrame` pattern `onCurateSubmit` already uses) so it runs **after**
the shell's `prevActive` fires (else `prevActive` re-steals focus to the now-detached Delete button).
Never leave focus on `<body>`.

> This is exactly the D1 §4.4 / §7.3 removed-trigger rule, applied to delete. For **edit** there is
> no removed node, so the normal return-to-trigger holds (§7.1).

---

## 8. Auth: logged-out and expired-session (AC6)

- **Logged out.** There is **no** edit/delete affordance for a logged-out viewer on any clip (§3.1) —
  the trigger never exists, so a logged-out write is never reachable through the UI. *(AC6, the
  affordance side; AC4/AC5/AC6 the server side reject a direct call regardless.)*
- **Expired session at submit.** A session valid when the Edit modal (or Delete confirm) opened may be
  invalid at submit. The boundary rejects `updateClipAction` / `deleteClipAction` with
  **`AuthRequiredError`**. Both surfaces **reuse D1 §7.2 exactly**: branch on `isAuthRequired(err)` →
  `showExpiredGate()` (the "Log in to curate" gate carrying the verbatim **"Your session ended —
  please log in again."** line, `AUTH_COPY.errors.expiredSession`), close the modal/confirm; **not**
  the generic §6 / §9.3 error. Nothing was written/deleted. The curator's in-progress edits are lost
  on this path (the modal closes to surface the gate — the accepted D1/dismiss-path trade-off; D2 adds
  no draft-preservation across re-login, out of scope). Dev branches precisely as `persistClip` and
  `runDismiss` already do — the two error kinds are never confused.

---

## 9. The Delete confirmation dialog (the third D2 delta) — AC3 / Decision 4

A hard delete is irreversible (no undo, no trash — Decision 4). The confirmation step is the **only**
guard against an accidental destroy; it must be a deliberate second act.

### 9.1 Anatomy
A small `ModalShell` dialog (`role="dialog" aria-modal="true"`, `aria-labelledby` → its title;
`max-w-sm`, `.plus-card`) — **not** the full curate surface (there is nothing to edit; this is a
yes/no):
- **Header band** — indigo fill (consistent with the other dialogs' header language) **or** a neutral
  ink band; title **"Delete this curation?"** + a **"✕"** cancel (`aria-label="Cancel"`).
- **Body** — a short, honest, non-alarmist line that names the consequence (Decision 4's "no undo"):
  **"This permanently removes your context note, the stance and accuracy assessment, and this clip
  from the topic. This can't be undone."** Optionally echo the clip caption above it (`text-[12px]`
  bold ink) so the curator confirms *which* clip — recommended when multiple clips are on the page.
- **Action row** (`flex flex-wrap gap-2`):
  - **"Cancel"** — `<button type="button">`, white fill, 2px ink border, ink text. **The safe
    default** (§9.2). Closes the dialog, no delete; focus returns to the **Delete** trigger
    (`ModalShell` `prevActive`).
  - **"Delete clip"** — `<button type="button">`, the destructive confirm: **`accred` fill, white
    text, 2px ink border** (confirm AA of white-on-`accred` per §10 — darken toward `#B83A3A` if it
    does not clear 4.5:1, as `topic-page-v1.md` §9.3 requires for the red fill). The **word "Delete
    clip" is the signal**, the red reinforces. Activates the delete (§2.2 step 3).

### 9.2 Default & focus (binding — destructive-dialog safety)
- **Initial focus lands on Cancel**, not on Delete clip. A user who reflexively hits Enter/Space on
  open **cancels** (the safe outcome), never destroys. (This is the deliberate inversion of a normal
  modal's "focus the primary action" — for a destructive confirm the *safe* action is primary for
  focus.)
- **Esc** and **backdrop click** **cancel** (close without deleting) — consistent with Cancel being
  the safe path. Focus trap holds while open (`ModalShell`).
- The confirm is **two intentional steps from the card**: card **Delete** button → this dialog's
  **Delete clip** button. No single click destroys (AC3).

### 9.3 The confirm dialog's states (mirror D1 §5/§6)
- **Pending.** On confirm, **"Delete clip"** disables + shows **"Deleting…"** (busy **word**, not a
  spinner alone); no double-submit (a guard like `useCurateSubmit`'s `pending`); **Cancel stays
  enabled** (abandon mid-flight); a late resolve after the dialog is gone is ignored (the `alive`
  guard pattern).
- **Server error.** The dialog **stays open**, a `role="alert"` message **"Couldn't delete — please
  try again."** (the §6 alert treatment — 2px `accred` border, `#FDEDED` bg, `accred` text; focus
  sent to the alert); **"Delete clip"** returns to idle; the clip is still present; retry or Cancel.
  Distinct from the expired-session case (§8).
- **Expired session.** Close the dialog, `showExpiredGate()` (§8); nothing deleted.

Dev may reuse a trimmed `useCurateSubmit`-style hook for the confirm's pending/error/expired
lifecycle, or a small local state — the **behavior** (pending word, no double-submit, error keeps
open + alert, expired → gate) is the contract; the hook reuse is Dev's call.

### 9.4 Accessibility (binding — AC3-analog, CURATION §4)
- `role="dialog" aria-modal="true"` with the title as the accessible name; focus trap; Esc/backdrop
  cancel; **initial focus on Cancel** (§9.2).
- Both buttons text-labeled (never color-alone — the destructive one is the **word "Delete clip"** +
  the body copy, reinforced by `accred`); focus-visible ring on both.
- The error alert is `role="alert"` (announced on appearance).
- After a successful delete, focus moves to `focusBandHeading()` (§7.3) — never lost to `<body>`.

---

## 10. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Brand indigo `#676EB4`** — the dialog header bands (consistent with D1's modals); the revealed
  agreement checkbox accent (`accent-brand`, as in `CurateFields`); not a destructive signal.
- **Action blue `#1F6F95`** — available for the **Edit** secondary affordance if Dev prefers an
  action-tinted secondary; not required (the `.srcbtn` white/ink language is the default — §3.2).
- **Ink `#2C2C2C`** — borders, body text, the hardbox offset (existing).
- **`accred` red `#C44949`** — the **destructive** signal for **Delete** (card affordance border +
  text; confirm-dialog destructive button fill) and for the §6/§9.3 **error** alerts. It always
  carries a **text** label ("Delete" / "Delete clip" / "Couldn't save…" / "Couldn't delete…"), never
  color alone. **AA (binding):** white-on-`accred` at the confirm button's text size must clear
  WCAG AA (≥4.5:1); per `topic-page-v1.md` §9.3, `#C44949` is ≈4.0:1 — **darken to `#B83A3A`** (or use
  a bold-large treatment) so it clears; QA verifies.
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional / signal color, and
  must never be enlisted for the affordances, the agreement, pending, error, or the destructive
  delete.
- **Non-color rule (CURATION §4, AC7-analog):** every D2 signal is text-carried — the affordances are
  their **words** ("Edit" / "Delete"); the destructive delete is the **word + the confirmation step**;
  the pending states are the busy **words** ("Saving…" / "Deleting…"); the errors are the alert
  **text**; the re-agreement requirement is the **labeled checkbox + the disabled Save**. Color only
  reinforces. The "destructive" nature of delete is **never** signaled by red alone — it is the word,
  the confirm dialog, and the body copy.

---

## 11. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive; the clip card and both dialogs already collapse to a single readable column
below `lg`. D2 adds no new layout but must keep the new controls usable narrow:
- **The owner action row** (Edit / Delete) on the card is `flex flex-wrap gap-2` — on a phone the two
  buttons wrap rather than overflow; each is a comfortable touch target (the `.srcbtn` padding gives
  ≥40px height; confirm Delete's red is reachable + tappable). The row sits below the footer and never
  pushes the note/thumbnail off-screen.
- **The Edit modal** is the same `ModalShell` (`fixed inset-0 … p-4`, `max-w-lg`, `max-h-[90vh]
  overflow-y-auto`) as D1 — the conditional agreement block, when revealed, is full-width with a large
  label hit-area and wraps to two lines if needed (D1 §10); the action row wraps; the error alert is
  full-width above the actions; no horizontal scroll at ~390px.
- **The Delete confirm** is a small dialog (`max-w-sm`); on a phone it occupies the small viewport with
  `p-4` margins; the Cancel / Delete clip buttons wrap; the body copy wraps and stays readable. Initial
  focus on Cancel works identically narrow.
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — the affordances (owner vs.
  non-owner vs. logged-out), the Edit modal (pre-fill, the conditional agreement reveal, pending,
  error, expired), and the Delete confirm (pending, error, expired) at each.

---

## 12. Accessibility requirements (consolidated — verifiable against AC7 / AC9 / CURATION §4)

- **Affordances** — `<button>`s, text-labeled ("Edit" / "Delete"), Tab-reachable, Enter/Space
  activates, focus-visible ring; render **only** for the signed-in owner (§3.1); owner-scoped
  `aria-label`s ("your curation"); never color-alone (§3.3 / §10).
- **Edit modal** — D1 §12 a11y carries forward (dialog role + label, focus into the note on open,
  focus trap, Esc/backdrop/Cancel close, return-to-trigger); the **conditional agreement** is the D1
  §3.4 control when revealed, and its mid-edit appearance is announced (`aria-live` reveal container,
  §4.3); Save's unavailability discoverable via `aria-describedby` → license statement.
- **Delete confirm** — dialog role + label; **initial focus on Cancel** (the safe default — §9.2);
  Esc/backdrop cancel; both buttons text-labeled + focus-visible; the destructive button's meaning is
  the word + the body copy, reinforced by `accred`; `role="alert"` on the error.
- **Focus after delete** — moves to `focusBandHeading()` (§7.3), never lost to `<body>`.
- **Expired session** — routes to the gate dialog carrying the verbatim "Your session ended…" line
  (§8); not a silent failure.
- **Contrast (AA, binding)** — white-on-`accred` on the confirm Delete button (darken to `#B83A3A` if
  `#C44949` does not clear 4.5:1 — §10 / `topic-page-v1.md` §9.3); the affordance text, busy labels,
  and error text against their backgrounds (QA spot-checks the `text-[12px]` / `text-[11px]` copy).
- **Responsive** — every affordance + both dialogs operable by keyboard and touch at ~390px (§11).

---

## 13. Deltas from the committed D1 spec + `topic-page-v1.md` §5.9 (Dev: build these on top)

The D1 curate surface and the `topic-page-v1.md §5.9` clip card stand. D2 changes exactly these
points; everything else is unchanged.

1. **Owner action row on `ClipCard`.** Add an additive `role="group"` Edit/Delete row below the
   provenance footer, rendered **only** for the signed-in owner (§3). The card's existing content,
   layout, chips, note, and provenance footer are **unchanged**. *(AC7.)*
2. **`CurateFields` gains pre-fill + a conditional agreement.** It accepts optional initial
   note/stance/accuracy/section values; the §5.3 agreement block is **hidden on open** and
   **reveals + becomes required only on a material (normalized-text) note change** (§4) — vs. D1,
   where it always shows + is always required. The D1 add path is unchanged (no initial values →
   empty; for add, materiality is always "true" so the agreement always shows — Dev: an "always
   required" flag for the add modal, "conditional on material change" for the edit modal). *(AC9,
   AC10.)*
3. **An Edit modal** cloned from `CurateModal` (§6): title "Edit curation", read-only clip summary
   (no "auto-suggested" line), pre-filled fields, Save microcopy "✓ Save changes" / "Saving…", the
   conditional agreement, and the `updateClipAction` submit wiring via the host. *(AC1, AC2.)*
4. **A Delete confirmation dialog** (§9): a small `ModalShell` yes/no, **Cancel as the focused
   default**, **Delete clip** as the `accred` destructive confirm, with pending/error/expired states;
   on success the clip is removed (§7.2) and focus moves to `focusBandHeading()` (§7.3). *(AC3.)*
5. **No-reload edit-in-place / delete-and-flip** in `TopicView` (§7): replace the clip object in the
   in-memory `clips` array on edit (re-render in place; section change re-anchors); remove it on
   delete (counts drop; last clip flips curated→empty via the existing `mode` switch). Reuse
   `persistClip`'s `isAuthRequired` → `showExpiredGate()` branch and the `requestAnimationFrame` +
   `focusBandHeading()` removed-node focus pattern. *(AC2, AC3.)*
6. **Expired-session route** reused verbatim from D1 §7.2 on both surfaces (§8). New modal/dialog
   behavior; reuses the existing hook. *(AC6.)*

No change to: the reader-facing clip-card content (thumbnail / chips / note / creator credit), the
chip label map + AA fills (`topic-page-v1.md` §9), the candidate / empty-state treatment, the
scroll-sync, the article side, the D1 add/promote flows, or the modal shell's focus/Esc/backdrop
behavior (preserved). Reading stays anonymous — no per-user work on the read path (§3.1).

---

## 14. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | Owner edits each editable field; persists | §2.1, §6 |
| AC2 | Edited clip re-renders in place, no reload (chips from closed enums) | §7.1, §6.3 |
| AC3 | Owner deletes with confirmation; clip gone, no reload; last→empty | §2.2, §7.2, §7.3, §9 |
| AC4 | Non-owner edit rejected server-side | §2 (gate-vs-affordance note), §3.1 (constraint) — *server is Dev/QA* |
| AC5 | Non-owner delete rejected server-side | §2, §3.1 — *server is Dev/QA* |
| AC6 | Logged-out edit/delete rejected → login; expired → login gate not generic error | §3.1 (no affordance), §8 |
| AC7 | Affordances only on owned clips; not others'; not logged out | §3 |
| AC8 | Legacy `@prototype` clips show no affordance to anyone | §3.1 (the no-owner case) — *server reject is Dev/QA* |
| AC9 | Material note-text edit re-stamps CC BY-SA agreement | §4 (esp. §4.1–§4.2) |
| AC10 | Chip/section-only or no-text-change edit does NOT re-stamp | §4.2, §5 ("nothing changed" edge) |
| AC11 | Real pending/save/error; no false "saved"; modal stays open on error | §5, §6.3, §9.3 |
| AC12 | Build/typecheck/test green; ARCHITECTURE records the gate/affordance choice | (Dev/QA — no design blocker) |

---

## 15. What UX will evaluate at Phase 4

Against this spec **and** the stories (S16–S20), on the running prototype with the session stubbed
signed-in (the C/D1 pattern — no live OAuth in CI):
- **Owner-only affordances (AC7/AC8):** Edit + Delete appear on a clip the stubbed contributor owns;
  appear on **no** clip when the stub is **not** the owner; appear on **no** clip when logged out; and
  appear on **no** legacy `@prototype` clip to anyone. Text-labeled, keyboard-operable, focus-visible,
  never color-alone.
- **Edit end-to-end (AC1/AC2):** open Edit → fields pre-filled with the clip's current
  note/stance/accuracy/section → change each → Save → the clip re-renders **in place** with the new
  content, **no reload**; a section change re-anchors the card and adjusts TOC counts; focus returns
  to the Edit trigger.
- **Conditional re-agreement (AC9/AC10):** a **material** note-text change reveals + requires the
  verbatim §5.3 agreement before Save; a **chip/section-only** (or whitespace-only) change does
  **not**; reverting the text hides it again; the revealed control is keyboard-operable, focus-visible,
  and announced.
- **Delete end-to-end (AC3):** card Delete → a confirmation dialog with **Cancel focused by default**
  → Delete clip → the clip is removed **with no reload**, counts drop, the last clip flips the page to
  empty; **focus lands on the band heading**, never `<body>`; a single click never destroys.
- **States (AC11):** Edit/Delete pending shows the busy **word** and blocks double-submit; a server
  error keeps the modal/dialog open with edits intact and a `role="alert"` message (no false "saved" /
  no false "deleted"); an expired session routes to the "Your session ended…" gate, not the generic
  error.
- **A11y in practice:** AA contrast on the affordances + the `accred` destructive button (white-on-red
  cleared), visible focus, screen-reader discoverability of the mid-edit agreement requirement and the
  destructive confirm, and operability at ~390px.
- **Indigo Press fidelity:** brand/action/ink palette; gold unused; `accred` carries the destructive +
  error signals with text labels; signals text-carried (§10).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is
distinct from QA & Review's correctness/security pass — UX asks "does it match intent and feel right,"
QA verifies the server-side ownership gate AC4/AC5/AC6/AC8 at the action.)
