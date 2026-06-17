# Design Spec: Promote / Add-video persistence + CC BY-SA note-agreement (milestone D1)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#52](https://github.com/ragesoss/wikiplus/issues/52) — milestone **D**, run **1 of 5**).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/curate-add-persistence.md` — the Product spec. This design serves **AC1–AC13**,
    user stories **S11 / S12 / S14**, and honors Decisions **D1-1** (per-submit agreement capture)
    and **D1-2** (clip publishes immediately).
  - `docs/CURATION_STANDARD.md` §5.2 (creator credit vs. note license — do not conflate) and **§5.3 /
    Decision C5** (the two canonical agreement strings — used **verbatim** in §3 below).
  - `docs/design/topic-page-v1.md` **§6.6** (Promote controls), **§6.8** (`CurateModal` / `CurateFields`,
    AC19), **§6.9** (`AddModal`), §11.4 (modal a11y), §12 (responsive). **This is the committed baseline;
    D1 extends it.** Where this D1 spec changes a §6.8 / §6.9 detail it says so explicitly (§9, Deltas).
  - `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity); reference mockups
    `mockups/inline-indigo-sync.html` (curated) / `mockups/inline-indigo-empty-v2.html` (empty).
- **Implementable against (current code this spec is written to extend, not redesign):**
  `components/topic/CurateModal.tsx`, `components/topic/AddModal.tsx`, `components/topic/CurateForm.tsx`
  (`CurateFields`), `components/topic/ModalShell.tsx`, `app/topic/TopicView.tsx` (the gate +
  `useRequireLogin` + the dismiss path's `isAuthRequired` / `showExpiredGate` pattern),
  `lib/auth/microcopy.ts` (`AUTH_COPY.errors.expiredSession`), `lib/candidates/dismissals.ts`
  (`identityKey` / `videoIdOf` dedup), `lib/data/types.ts` (`Clip` / `Candidate`).
- **Feeds:** Development (build to **this spec** for the D1 deltas, on top of the committed
  `topic-page-v1.md` modals). Then QA & Review (correctness/security) + UX evaluation (this spec + the
  stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the *deltas* D1 adds to
> the **existing** `CurateModal` / `AddModal` / `CurateFields` — the required-and-captured CC BY-SA
> agreement, the real submit/pending/success/error states, the no-reload result on the page, the
> dedup of a promoted candidate, and the expired-session route. It does **not** redesign the modals or
> the curation form; the committed `topic-page-v1.md` §6.8/§6.9 layout, fields, and Indigo Press
> identity stand. Every requirement is tagged with the Product AC(s) and story it makes buildable.

---

## 1. Personas & stories served

D1 is a **curator-side** run. Of the three Topic-page personas (`topic-page-v1.md` §1), it serves **P2
the curator/contributor** as the primary user, with **P1 the reader** served as the downstream
beneficiary of what P2 publishes.

### P2 — Marcus, the curator/contributor (PRIMARY this run)
The same persona `topic-page-v1.md` §1 named, but the prototype constraint that defined his experience
there ("his actions are UI entry points only — mock submit, no persistence — spec A7") is **exactly
what D1 removes.** Marcus signs in with Wikipedia (milestone C), promotes a good candidate or adds a
clip the suggester missed, writes a context note to the curation standard, and — this is the new part —
**his vouch persists, attributes to him, and shows on the page.** D1's job is that his curation stops
being a demo. He works mostly on desktop but may be on a phone; he may use a keyboard or screen reader;
the agreement and every submit affordance must work for all of those.

### P1 — Priya, the reader (downstream beneficiary)
Anonymous, unchanged. D1 adds **no per-user work to the read path** and nothing Priya must log in for.
Her stake in D1 is indirect but central: a clip Marcus just vouched for is a clip **she can now see**
(AC2/AC5) — the product thesis ("a curator vouches → a reader sees it") only closes when the write
sticks. Reading stays anonymous; the cached read path gains nothing per-user.

### P3 — Mod, the moderator (CONTEXT ONLY — out of scope)
A clip published in D1 shows **immediately** (Decision D1-2); the `vetted` review-hold, rate limits,
and moderation surface are **D5**. Named only so the agreement-capture and the gate read as the front
of a real accountability system.

### User stories this run serves (from `topic-page-v1.md` §2; Product owns acceptance criteria)
- **S11 — promote with a note.** *As a curator, I want to promote a candidate into a curated clip by
  writing a note and setting stance + accuracy from a fixed set, so my contribution matches the
  standard* — and (the D1 increment) **so it persists and shows.** *(AC1, AC2, AC3; CURATION §1–§3.)*
- **S12 — add by link.** *As a curator, I want to add a clip the suggester missed by pasting a
  YouTube/TikTok link* — and **so it persists, attributes to me, and shows.** *(AC4, AC5.)*
- **S14 — told my note is CC BY-SA at publish.** *As a contributor, I want to be told my note will be
  released CC BY-SA 4.0 at the moment I publish, so consent is informed* — sharpened by D1 from a
  passive notice into a **required, captured agreement.** *(AC6, AC7; CURATION §5.3 / C5.)*

One new user-POV story this run makes explicit (it traces to the Product spec's robustness ACs, not a
new acceptance line):
- **S15 — my vouch is real or I'm told it failed.** *As a curator, when I publish I want to either see
  my clip appear, or be clearly told it didn't save with my note intact — never a modal that closes as
  if it worked when nothing was written.* *(AC8, AC9, AC11.)*

---

## 2. The two flows, end to end

Both flows live on the **empty / uncurated Topic page** (the curator surface — `topic-page-v1.md` §6),
reached from the Promote / "Be the first to curate" / "＋ Add video" triggers already wired in
`TopicView`. The **trigger → gate** stage is C's and is unchanged; D1 owns everything from the modal's
submit control onward.

### 2.1 Promote-a-candidate (`CurateModal`) — S11
1. **Trigger.** Marcus clicks **"✓ Promote"** on a candidate (rail card or General strip tile, §6.6) or
   **"✦ Be the first to curate"** (§6.2). The trigger passes through C's `requireLogin({ gate:
   "curate", … })`:
   - **Signed out →** the **"Log in to curate"** gate opens; the modal **does not** open (AC8). End.
   - **Signed in →** `CurateModal` opens, seeded with the candidate's media/creator fields and its
     section (existing behavior). Focus lands on the note textarea (existing `initialFocusSelector`).
2. **Form.** The committed §6.8 fields render unchanged: clip-summary block, context note + counter,
   Stance select, Accuracy select, Section select. **(D1 delta:** the passive CC BY-SA line is replaced
   by the required agreement control + the always-visible license statement — §3.)
3. **Required agreement.** The publish control is **inert until** Marcus checks **"I agree to release my
   context note under CC BY-SA 4.0."** (§3, AC6). The license statement **"Your context note will be
   released under CC BY-SA 4.0."** is visible at the submit control whether or not the box is checked.
4. **Submit.** Marcus clicks **"✓ Publish curation."** Preconditions are checked client-side (AC10):
   non-empty note, a stance + an accuracy value (selects default valid), agreement given. If a
   precondition fails the control does not submit (§3.3). On submit the modal enters **pending** (§5):
   the publish control disables + shows a busy label; the modal cannot be double-submitted.
5. **Result.**
   - **Success →** `addClipAction` returns the new clip; the modal **closes**, focus returns to the
     originating Promote trigger; the clip **appears on the page** (note + chips + credit) without a
     reload; the **promoted candidate leaves the suggestion set** (deduped by `platform:videoId`); if it
     was the first clip the page **flips empty → curated**. *(AC1, AC2, AC3.)*
   - **Server error →** the modal **stays open**, the typed note (and all field values) are preserved,
     an error is surfaced; nothing was written (§6, AC11).
   - **Expired session →** the boundary rejects with `AuthRequiredError`; the modal closes and the
     **expired-session login gate** appears (not a generic error); nothing was written (§7, AC9).

### 2.2 Add-by-link (`AddModal`) — S12
1. **Trigger.** Marcus clicks **"＋ Add video"** (§6.3 manual-source cluster). Through C's `requireLogin({
   gate: "add", … })`: signed out → the **"Log in to add a video"** gate, modal does not open (AC8);
   signed in → `AddModal` opens, focus on the link input (existing behavior).
2. **Paste + fetch.** Marcus pastes a share link and clicks **"Fetch details"** (existing). This stage is
   unchanged and **stays a client-side mock** (the honest "no network call" path — AC5 / §8):
   - **Unrecognized link →** the existing inline `role="alert"` error **"Unrecognized link — paste a
     YouTube or TikTok URL."** shows; preview + curate fields stay hidden; persistence is **never
     reached** (AC5). This is the modal's own pre-persistence validation, unchanged.
   - **Recognized link →** the mock preview block reveals (existing: detected platform named in words,
     "resolved via oEmbed" eyebrow, mock title, echoed URL), and the §6.9 curate fields reveal. Focus
     moves to the note (existing).
3. **Form + required agreement.** Identical to 2.1.3 — the curate fields are the **same** `CurateFields`
   component, so the agreement control + license statement appear here exactly as on `CurateModal`.
4. **Submit.** Marcus clicks **"＋ Add & curate."** Preconditions (AC10): a recognized link has resolved
   (the publish control only exists once `resolved` is set), non-empty note, stance + accuracy,
   agreement given. Pending state as in 2.1.4.
5. **Result.** Same success / error / expired branches as 2.1.5, with one add-by-link specific: if the
   topic is **not yet in the store**, `upsertTopicAction` runs first (Dev — the page's QID is already
   resolved). Success → the new clip appears with no reload, **flipping empty → curated if it is the
   first clip** (AC5); a duplicate live suggestion for the same `platform:videoId` (if one was showing)
   is removed too (§4, AC5). Error / expired branches are §6 / §7.

---

## 3. The required CC BY-SA agreement control (the core D1 delta)

This replaces the **passive** line currently in `CurateFields`
(`"By publishing, you agree to release your context note under CC BY-SA 4.0."`) with a **required,
captured** agreement, on **both** modals (they share `CurateFields`, so this is specified once and
applies to both). This is AC6, S14, and CURATION §5.3 / Decision C5.

### 3.1 Placement & anatomy
The agreement lives in `CurateFields`, **directly above the modal's action row** (where the passive
line is today — so it sits with the publish control, not buried mid-form). It is a two-part block:

1. **License statement (always visible).** A short line, `text-[11px]` muted (`ink2`/`muted` per
   §6.8 label tones), reading **verbatim**:
   > **Your context note will be released under CC BY-SA 4.0.**
   It is visible whether or not the box is checked — informed-consent context that does not move.
   *(CURATION §5.3 canonical "license statement" string.)*

2. **Required agreement control.** A real `<input type="checkbox">` with an associated `<label>`, reading
   **verbatim**:
   > **I agree to release my context note under CC BY-SA 4.0.**
   *(CURATION §5.3 canonical "required agreement act" string.)*
   - The checkbox is **unchecked on open** every time (per-submit, not remembered — Decision D1-1; a
     fresh act for each note).
   - Label text and checkbox are a single click/tap target (clicking the label toggles the box).
   - `text-[12px]` ink for the label (legible body, not the muted statement tone), checkbox sized for a
     comfortable touch target (≥ 20px box; the label gives a wide hit area on mobile).

**Do not** present this as, or adjacent to, anything that reads like creator credit. Per CURATION §5.2,
the note-license agreement is the **curator's** act over **their own note**; it must never be conflated
with crediting the video's creator (whom we reference and credit separately, on the card). Keep the
agreement copy strictly about *"my context note,"* as the canonical strings already do — do not add any
"…and credit the creator" rider.

### 3.2 How it blocks publish (AC6, AC10)
- The publish control (**"✓ Publish curation"** / **"＋ Add & curate"**) is **disabled** while the box is
  unchecked. Disabled = both visually distinct (§3.4) **and** non-submittable (`disabled` attribute, so
  Enter-in-a-field and click both no-op).
- Disabled is the resting state on open (box unchecked). It is **not** an error state — no red, no alarm
  — just "you have a step left." It enables the moment the box is checked **and** the other client-side
  preconditions hold (non-empty note; for add-by-link, a resolved link).
- A `disabled` button cannot be the only signal (it is not focusable / not screen-reader-announced as
  an action a user can take). So the always-visible **license statement** + the labeled checkbox are the
  text-carried explanation of *why* publish is unavailable; an unchecked box beside an enabled-looking
  publish would be the failure to avoid. (See §3.3 for the assistive-tech wiring.)

### 3.3 Precondition feedback (AC10)
Beyond the agreement, the only hard client-side preconditions are a **non-empty note** and (add-by-link)
a **resolved link**; stance/accuracy default to valid enum values so they are always satisfied
(`topic-page-v1.md` §6.8). Keep the rule **simple and honest**, no new validation UI beyond what §6.8
already has:
- If the **note is empty**, the publish control stays disabled the same way the unchecked agreement
  disables it (an empty note must never silently write a blank-note clip — AC10). No inline error string
  is required for the empty-note case in D1; the disabled control + the existing placeholder/helper text
  carry it. (D1 does **not** add editorial-quality validation — that is moderation / D5.)
- The note character counter (existing, soft cap 320, CURATION C1) is unchanged and remains
  non-blocking.

### 3.4 Accessibility of the agreement (binding — AC6, AC21, CURATION §4)
Signals are **never color-alone**; the agreement is text-labeled, keyboard-operable, and focus-visible:
- **Text-labeled.** The requirement is carried by the visible label words ("I agree to release…"), not
  by any color or icon. A user who cannot perceive color, or who is on a screen reader, gets the full
  meaning. The disabled/enabled state of publish is reinforced by the visible label + statement, not by
  the button color alone.
- **Keyboard-operable.** Native checkbox: Tab reaches it, Space toggles it. It sits in the tab order
  **immediately before the action row** (note → stance → accuracy → section → agreement checkbox →
  publish → cancel), so the keyboard path to publish runs through the agreement.
- **Focus-visible.** The global `:focus-visible` treatment (3px indigo outline, 2px offset —
  `topic-page-v1.md` §11.2) applies to the checkbox like every other control.
- **Announced.** The checkbox's accessible name is its `<label>` text. Wire the publish button so its
  unavailability is discoverable by AT: when publish is `disabled`, set `aria-describedby` on the publish
  button pointing at the license-statement element (so a screen-reader user lands on "Your context note
  will be released under CC BY-SA 4.0." as the explanation), **or** give the publish button an
  `aria-disabled`-aware accessible description. (Implementation choice is Dev's; the requirement is that a
  screen-reader user can tell *why* publish is unavailable and what to do — check the agreement.)

### 3.5 What gets captured (UX surface only; data shape is Dev's per D1-1)
UX does not design the persisted record, but the design has one obligation: **the act the user takes
must match what we capture.** The user performs a **per-submit affirmative act** (checks the box, then
publishes) — so capturing a per-submit record (agreed = true, license `CC-BY-SA-4.0`, timestamp, bound
to this note + contributor, per D1-1 / AC7) is the honest reflection of the UI. The UI must **not** offer
a "remember my choice" / account-level toggle (that would not match per-submit capture — Decision D1-1).
No UX surface exposes the captured record in D1 (no "you agreed on <date>" readout — that is not asked
for and not in scope).

---

## 4. The result on the page — success without reload (AC2, AC3, AC5)

On a successful publish the curator must **see the outcome in the same session, no manual reload.** The
mechanics (adding to the in-memory clip set, dropping the promoted candidate) are Dev's; the **UX
requirements** are:

1. **The new clip renders as a fully curated clip.** It shows its **context note**, **stance chip**,
   **accuracy chip** (text-labeled, §9 of `topic-page-v1.md`), and **creator credit** — i.e. it is
   visually indistinguishable from any other curated clip (solid border + offset shadow, not the dashed
   candidate treatment). It appears in the section it was filed under, or in the **General** strip if
   filed General. *(AC2 covers the same on reload; D1 requires it live too — AC3/AC5.)*

2. **Empty → curated flip when it is the first clip.** If the topic had **0 curated clips**, publishing
   the first one flips the page from the empty experience (`topic-page-v1.md` §6) to the curated
   experience (§5): the infobox switches from the "0 / videos curated" + CTA block to the 3-column
   counts; the General band relabels from "＋ Suggested videos · uncurated" to "＋ General"; the TOC
   badges switch from dashed `~n` to solid counts. This is the **existing** `mode` switch
   (`clips.length > 0 ? "curated" : "empty"` in `TopicView`) — D1 just needs the new clip in `clips` for
   the switch to fire. No new layout; the state machine already exists.

3. **The promoted candidate leaves the suggestion set immediately.** The candidate that was promoted is
   **removed from the live candidate set** (deduped by `platform:videoId` via `identityKey` / `videoIdOf`,
   `lib/candidates/dismissals.ts`), so the just-published clip does **not** also linger as an
   un-vouched-for suggestion (AC3). Visible consequence: the candidate card fades/removes (reuse the
   existing candidate-removal treatment — `topic-page-v1.md` §6.5 dismiss animation, honoring
   reduced-motion), and the counts it fed (band count, its section's TOC badge, the CTA subline) drop
   wherever it appeared — the **same count-cascade the dismiss path already does**. Add-by-link similarly
   must not leave a duplicate suggestion for the same `platform:videoId` if one was showing (AC5).

4. **No focus or scroll surprise.** The page must not jank the reader to the top or trap focus oddly on
   the flip. After the modal closes, focus returns to the originating trigger (§7.2). If the originating
   trigger was a candidate card that **was just removed** (the promoted candidate), focus must move to a
   stable anchor rather than be lost to `<body>` — reuse `TopicView`'s existing `focusBandHeading()`
   (the General band heading, the shared "move focus off a removed node" anchor already used by dismiss
   and the pinned player). See §7.2 for the exact rule.

---

## 5. Pending state (both modals — AC11)

On submit, before the result resolves:
- **The publish control enters a busy state.** It is `disabled` (not double-submittable) and shows a
  busy label so the curator knows the write is in flight. Microcopy:
  - `CurateModal`: idle **"✓ Publish curation"** → busy **"Publishing…"**
  - `AddModal`: idle **"＋ Add & curate"** → busy **"Adding…"**
  The check/plus glyph may be replaced by the busy word, or kept with the word — Dev's call; the
  requirement is a **visible text change to a present-progressive busy label**, not a spinner alone
  (a spinner is color/motion; the word is the text signal, and it is suppressed-motion-safe).
- **The Cancel / ✕ controls stay enabled** during pending (the user can still abandon). If the user
  cancels mid-flight, the modal closes; a late success/failure must not reopen it or fire a stray
  notice (Dev: ignore the resolved promise if the modal is gone — the existing `alive` pattern in
  `TopicView` is the model).
- **Backdrop click + Esc**: during pending these still close the modal (consistent with Cancel staying
  enabled). The focus trap and Esc behavior (`ModalShell`) are **unchanged** by D1 and must keep working
  across the move from mock-close to real-submit (§7.3).
- **No double-submit.** A disabled publish control plus an in-flight guard means a second Enter/click
  does nothing while pending (AC11).
- The pending label change is announced to AT (the publish button's accessible name changes from
  "Publish curation" to "Publishing…", which screen readers convey on the busy press); no extra live
  region is required for the button itself.

---

## 6. In-modal error state (both modals — AC11)

A **server / boundary error** (the write rejects for a reason other than auth — DB down, validation at
the boundary, network) must **never** read as success:
- **The modal stays OPEN.** No close, no "saved" impression. *(AC11.)*
- **The typed note and every field value are preserved.** The curator does not retype. (This falls out
  of keeping the modal mounted — Dev must not reset/remount the form on error.)
- **The publish control returns to its enabled, idle label** ("✓ Publish curation" / "＋ Add & curate")
  so the curator can retry. The agreement stays checked (it was checked to get here); pending is over.
- **An error message is surfaced inside the modal**, in the **action area near the publish control**
  (so it is seen at the point of retry, not scrolled away). Treatment matches the existing in-modal
  alert language (`role="alert"`, 2px `accred` border, `#FDEDED` bg, `accred` text — the same pattern as
  `AddModal`'s "Unrecognized link" alert, `topic-page-v1.md` §6.9). Microcopy (calm, honest, actionable;
  no blame, no jargon):
  > **Couldn't publish — please try again.**
  Optionally, for `AddModal`'s topic-creation sub-step failing, the same string suffices (the user need
  not distinguish `upsertTopic` from `addClip` failing — both mean "didn't save, retry").
- **`role="alert"`** so the error is announced to assistive tech the moment it appears. Move focus to
  the alert (or keep focus in the modal and rely on the live announcement) — at minimum the user must
  not be left focused on a now-removed/disabled control. Recommended: on error, send focus to the alert
  container (`tabindex=-1`) so a keyboard/SR user lands on the message; the focus trap keeps them in the
  modal.
- **Distinct from the expired-session case (§7).** An `AuthRequiredError` is **not** this generic error —
  it routes to the login gate. Dev branches on `isAuthRequired(err)` exactly as the dismiss path does.

---

## 7. Auth: logged-out and expired-session (AC8, AC9)

D1 must **not regress C's gate** and must add the expired-session-at-submit handling. Both reuse
existing seams — UX specifies the experience, not new auth.

### 7.1 Logged-out at the trigger (AC8) — unchanged from C, must not regress
The Promote / "Be the first to curate" / "＋ Add video" triggers already route through C's
`requireLogin({ gate, action })` in `TopicView`. A **signed-out** activation:
- shows C's login gate — **"Log in to curate"** (promote / curate-first) or **"Log in to add a video"**
  (add), with the **"Log in with Wikipedia"** button (`AUTH_COPY`);
- **does not open the modal** to a write that cannot succeed — no mock-close, no silent no-op, no false
  "saved." *(AC8.)*
D1 changes nothing here; it only must not break it (the modals must keep being reached **only** via the
gated trigger). UX evaluates AC8 at Phase 4.

### 7.2 Expired session at submit (AC9) — the new auth handling
A session valid when the modal opened may be invalid at submit (it expired in between). The boundary
rejects `addClipAction` / `upsertTopicAction` with **`AuthRequiredError`**. The modal must surface the
**expired-session login prompt**, not the generic §6 error — reusing the **exact** pattern the dismiss
path already uses (`TopicView` `runDismiss`: `if (isAuthRequired(err)) showExpiredGate(); else
setDismissError(true);`):
- On `AuthRequiredError`: **close the modal** and open the **expired-session gate** (`showExpiredGate()`
  from `useRequireLogin`), which renders the "Log in to curate" gate carrying the verbatim error line
  **"Your session ended — please log in again."** (`AUTH_COPY.errors.expiredSession`). Nothing was
  written (AC9).
- The curator's typed note is **lost** on this path in D1 (the modal closes to surface the gate). This is
  the accepted trade-off the dismiss path already makes and is consistent across the app; D1 does not add
  draft-preservation across a re-login (out of scope — no auto-resume, per C's UX-2). The honest signal
  is the explicit "your session ended" gate, not a silent failure.
- It is an `AuthRequiredError` **only** — every other rejection is the §6 in-modal error (modal stays
  open, note preserved). Dev must branch precisely as the dismiss path does so the two are never
  confused.

### 7.3 Focus management & keyboard flow (AC21; survives the mock→real move)
The existing `ModalShell` already provides: focus into the dialog on open, focus **trap** while open,
Esc / backdrop / ✕ close, and **focus return to the triggering control** on unmount (`prevActive.focus()`).
D1 must **preserve all of it** across the change from mock-close to real-submit. Specifics:
- **Initial focus** — unchanged: `CurateModal` → note textarea; `AddModal` → link input, then the note
  after a successful fetch (existing `initialFocusSelector` behavior).
- **Tab order through the agreement** — note → stance → accuracy → section → **agreement checkbox** →
  publish → cancel (the checkbox sits just before the action row, §3.4).
- **Focus return on close** — to the originating **Promote / Add** trigger (`ModalShell`'s `prevActive`
  does this; verify it still fires after a real success, since success now closes the modal
  programmatically, not via the user-clicked Cancel). **Exception (§4.4):** when the originating trigger
  was the **just-promoted candidate card** (which success removes), `prevActive.focus()` would target a
  detached node; Dev must instead move focus to `focusBandHeading()` (the General band heading) so focus
  is never lost. Add-by-link's trigger ("＋ Add video") is not removed, so its return is the normal
  `prevActive`.
- **Focus on the error state** — focus stays inside the modal (the trap holds); on a server error, send
  focus to the `role="alert"` message (§6) so it is read. On the expired-session path the modal closes
  and focus goes to the gate dialog (the gate is itself a `ModalShell` dialog — its own focus management
  applies).
- **Esc / trap during pending** — both keep working (§5); the trap must not be defeated by the publish
  control being `disabled` (the trap computes focusables live, so a disabled button is simply skipped —
  no change needed, but Dev must confirm there is always ≥1 focusable, e.g. Cancel, so the trap never
  has an empty set).

---

## 8. Add-by-link specifics (AC5; honest mock preserved)

D1 keeps the prototype's honest "no network" preview path (Product spec Out-of-scope: no live oEmbed).
- The **"Fetch details"** step stays a client-side parse (`parseVideoUrl`) + **mock preview** with the
  existing helper line **"We detect the platform from the link and mock a preview — no network call."**
  Do not imply a live fetch. *(AC5; `topic-page-v1.md` §6.9.)*
- The **unrecognized-link inline error** (`role="alert"`, "Unrecognized link — paste a YouTube or TikTok
  URL.") is unchanged and fires **before** any persistence — an unrecognized link **never** reaches
  `addClipAction` (AC5). This is the modal's own validation, distinct from the §6 server error and the
  §7 auth error.
- On a recognized link, persistence assembles the clip from what `parseVideoUrl` + the mock preview
  yield (platform, videoId, embedUrl, watch/thumbnail URL, the minimal creator credit the preview shows).
  UX does not require richer creator metadata in D1 (Product Out-of-scope); the card renders the credit
  from whatever is captured, and "Pasted clip (mock preview)" / the echoed handle is acceptable interim
  credit text — it improves when a real oEmbed lands later, with no UX change needed here.

---

## 9. Deltas from the committed `topic-page-v1.md` §6.8 / §6.9 (Dev: build these on top of the baseline)

The committed baseline stands; D1 changes exactly these points. Everything else in §6.8 / §6.9 (layout,
fields, selects, counter, section select, header bands, modal a11y, responsive) is **unchanged**.

1. **Passive notice → required agreement.** `CurateFields`' line
   `"By publishing, you agree to release your context note under CC BY-SA 4.0."` is **replaced** by the
   §3 two-part block: the always-visible **license statement** ("Your context note will be released
   under CC BY-SA 4.0.") + the **required checkbox** ("I agree to release my context note under CC BY-SA
   4.0."). The checkbox **gates** the publish control. *(AC6, CURATION §5.3 — verbatim strings.)*
2. **Mock submit → real submit.** Both modals' `onSubmit` (currently `e.preventDefault(); onClose();
   // mock`) becomes a real call to the gated boundary with **pending → success/error/expired** states
   (§§5–7). `CurateModal` → `addClipAction`; `AddModal` → (`upsertTopicAction` if the topic is new →)
   `addClipAction`. *(AC1, AC4, AC11.)*
3. **Publish control gets pending + disabled states + busy microcopy** (§5). The buttons are no longer
   always-enabled, always-idle.
4. **Result reflects on the page** (§4): the new clip enters the in-memory clip set (renders + flips
   empty→curated if first); the promoted candidate is **deduped out** of the live set
   (`platform:videoId`). This is `TopicView` state work, not modal markup, but it is part of the D1 UX
   contract. *(AC2, AC3, AC5.)*
5. **Expired-session route** (§7.2): submit rejections branch on `isAuthRequired` → `showExpiredGate()`
   exactly like the dismiss path. New modal behavior; reuses the existing hook. *(AC9.)*
6. **`AddModal`'s success removes a duplicate suggestion** for the same `platform:videoId` if one was
   showing (§4.3, AC5). Minor — the dedup helper already exists.

No change to: the §6.8/§6.9 field set and selects (closed enums, counter), the clip-summary block, the
"signed in as @handle" pill (it already shows the real username post-C), the unrecognized-link error,
the mock preview, or the modal shell's focus/Esc/backdrop behavior (preserved, §7.3).

---

## 10. Responsive behavior (AC21-adjacent; `topic-page-v1.md` §12)

Mobile-first; both modals already use `ModalShell` (`fixed inset-0 … p-4`, dialog `max-w-lg`,
`max-h-[90vh] overflow-y-auto`). D1 adds no new layout but must keep the **new controls usable narrow**:
- **The agreement control** is full-width with a large label hit-area; the checkbox is a comfortable
  touch target (§3.1). On a phone the label wraps to two lines if needed and stays tappable.
- **The action row** (publish + cancel) keeps its `flex flex-wrap gap-2` — on a narrow screen the
  buttons wrap rather than overflow; the busy/error states do not change the row's wrap behavior.
- **The error alert** (§6) is full-width above/at the action row and scrolls into view within the
  modal's `max-h-[90vh] overflow-y-auto` body; on a phone the modal body scrolls, the header band and
  action area stay reachable.
- The modal occupies the full small viewport with `p-4` margins (existing); the focus trap keeps the
  background inert (existing). No horizontal scroll at ~390px.
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — both modals, both flows, the agreement
  + pending + error states at each.

---

## 11. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 notation):
- **Brand indigo `#676EB4`** — the publish primary fill (existing `bg-brand`), modal header bands.
  Where indigo fill carries `text-[11px]`-or-smaller white text and must clear AA, follow the §9.3
  guidance already in `topic-page-v1.md` (deep-violet `#5248AF` for small white-on-indigo); the publish
  button label is large/bold enough to clear AA on `#676EB4`, but Dev confirms.
- **Action blue `#1F6F95`** — available for secondary affordances if needed; not required by D1.
- **Sprout/teal `#2A8270`** — the "signed in" status dot tone (existing); not a D1 signal.
- **Ink `#2C2C2C`** — borders, body text, the hardbox offset (existing).
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional/signal color (and
  must never be enlisted for the agreement, pending, or error states).
- **Error** uses the established `accred` red + `#FDEDED` bg (the existing in-modal alert tone), the
  same red the candidate/accuracy reds use — and it carries a **text** message ("Couldn't publish…"),
  never color alone.
- **Non-color rule (CURATION §4, AC21):** every new signal is text-labeled — the agreement is its label
  words; the pending state is the busy **word** ("Publishing…"/"Adding…"); the error is the alert
  **text**; the disabled-publish reason is the visible license statement + checkbox label. Color only
  reinforces. The "required" nature of the agreement is **never** signaled by color alone (no red
  asterisk-as-sole-cue) — it is the labeled checkbox a user must check and the disabled publish that
  carries it.

---

## 12. Accessibility requirements (verifiable against AC6 / AC21)

Consolidated for QA + UX evaluation:
- **Agreement checkbox** — native `<input type="checkbox">` with an associated visible `<label>`;
  Tab-reachable, Space-toggles, `:focus-visible` ring; accessible name = label text; unchecked on open
  (§3).
- **Publish control** — when blocked (agreement unchecked / note empty), `disabled` **and** its
  unavailability is discoverable by AT (the §3.4 `aria-describedby` → license statement, or equivalent);
  when busy, its accessible name reflects the busy label.
- **Error** — `role="alert"` so it is announced on appearance; focus is not stranded on a removed/disabled
  control (§6).
- **Expired session** — routes to the gate dialog (its own a11y), carrying the verbatim "Your session
  ended — please log in again." line; not a silent failure (§7.2).
- **Focus** — trap, Esc, backdrop close, and return-to-trigger preserved (`ModalShell`); the
  removed-promoted-candidate exception moves focus to the band heading (§7.3 / §4.4).
- **Contrast** — AA for the agreement label, license statement, busy label, and error text against their
  backgrounds (QA spot-checks the `text-[11px]` muted statement and the `accred` error text per §9.3
  guidance).
- **Responsive** — the agreement, pending, and error states operable by keyboard and touch at ~390px
  (§10).

---

## 13. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | Promote persists + attributes | §2.1, §9.2 |
| AC2 | Promoted clip shows curated (reload) | §4.1 (live + reload parity) |
| AC3 | Promoted candidate leaves suggestion set, no reload | §4.3 |
| AC4 | Add-by-link persists + attributes | §2.2, §8, §9.2 |
| AC5 | Added clip shows, no reload; empty→curated; unrecognized-link error pre-persistence | §2.2, §4, §8 |
| AC6 | Agreement **required** to publish | §3 (esp. §3.1–§3.2) |
| AC7 | Agreement **captured** (version + timestamp) | §3.5 (UX surface only; shape is Dev/D1-1) |
| AC8 | Logged-out → login gate, no modal/mock-close | §7.1 |
| AC9 | Expired session → login gate, not generic error | §6 (the contrast), §7.2 |
| AC10 | Client-side publish preconditions | §3.2, §3.3 |
| AC11 | Real pending/success/error; no double-submit; no false success | §5, §6, §4 |
| AC12 | Build/typecheck/test green; tested w/o live provider | (Dev/QA — no design blocker) |
| AC13 | ARCHITECTURE reflects where agreement is captured | (Dev — docs-as-built) |

---

## 14. What UX will evaluate at Phase 4

Against this spec **and** the stories (S11/S12/S14/S15), on the running prototype with the session
stubbed signed-in:
- **Promote** a candidate end-to-end: agreement blocks publish until checked (AC6); on publish the clip
  appears as curated with note + chips + credit and the promoted candidate is gone, no reload (AC2/AC3);
  first clip flips empty→curated (§4.2); focus returns sensibly even though the candidate card was
  removed (§4.4/§7.3).
- **Add-by-link** end-to-end: unrecognized link errors before persistence; recognized link → mock
  preview → curate fields → agreement → publish → clip appears, no reload (AC5); empty→curated flip.
- **Required-and-captured agreement:** the two canonical strings appear **verbatim**; the checkbox is
  required, unchecked-on-open, keyboard-operable, focus-visible, text-labeled; the license statement is
  always visible; the agreement is not conflated with creator credit (CURATION §5.2/§5.3).
- **States:** pending shows the busy label and blocks double-submit; a server error keeps the modal open
  with the note intact and a `role="alert"` message (no false "saved"); an expired session routes to the
  "Your session ended…" gate, not the generic error (AC9/AC11).
- **A11y in practice:** AA contrast on the new copy, visible focus on the checkbox/publish, screen-reader
  discoverability of why publish is unavailable, and operability at ~390px.
- **Indigo Press fidelity:** brand/action/ink palette, gold unused, signals text-carried (§11).

Defects route back to **Development**; a pass is reported to the orchestrator.
