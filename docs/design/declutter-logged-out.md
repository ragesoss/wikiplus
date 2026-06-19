# Design spec — Declutter the logged-out reader's Topic view

**Issue:** [#71](https://github.com/ragesoss/wikiplus/issues/71) · **Role:** UX / Design ·
**Status:** design spec (written *before* Dev) · **Builds from:** `docs/specs/declutter-logged-out.md`
(Decisions 1–3, AC1–AC11) · **Feeds:** Development (build), then QA & Review + UX (evaluation).

The contract for making the **logged-out (reader) Topic view** calmer and denser-with-content:
per-video action CTAs come **off every tile** (curated and candidate, rail and General strip), and
the invitation to participate **relocates into the player**, where it lands after the reader has
watched. The **signed-in** Topic view is unchanged — every signed-in surface is byte-for-byte its
pre-#71 self. The only gating axis this spec introduces is `signedIn`.

> **What this is NOT.** Not a vote-affordance redesign (that is #65 — no `clip_vote` schema, no
> change to how the count is derived; presentation/gating only). Not a candidate-card redesign (the
> dashed/unvetted treatment, match reason, source pill all stay). Not a change to the signed-in
> experience. Not a change to topic-level CTAs ("Be the first to curate", the "Find more" cluster).

---

## 1. Personas served

- **Priya — the deciding reader (primary, logged-out).** Anonymous, still weighing whether to
  engage. She wants to read the article and judge clips — caption, creator, stance/accuracy, context
  note, match reason, source — **without** a "log in to…" control shouting from every tile. She is
  the persona the success metric (player-driven curate-flow entry) is about.
- **Cory — the keyboard / AT reader (logged-out).** Tabs through the page and listens with a screen
  reader. Removing per-tile controls must *reduce* his tab stops and noise, not orphan a count as a
  fake control. The two player CTAs must be real, reachable controls that respect each surface's
  focus contract.
- **Mona — the signed-in curator (regression guard).** Her experience does not change: the upvote
  toggle, candidate Curate / Not relevant, and owner/moderator rows stay exactly where they are.

## 2. User stories (feed Product's AC; map in §10)

- **S1.** *As Priya, I want a Topic page that reads like reading — tiles carrying the signals that
  help me weigh a clip, not a "log in" button on every one — so I can browse calmly.* → AC1, AC3
- **S2.** *As Priya, I still want to see how others weigh a clip (its upvote count) even when I'm not
  logged in, so I keep that trust signal — just without a button I can't use.* → AC2
- **S3.** *As Priya, I want to still watch any suggested video and see why it matched and where it's
  from, so a watch-only candidate tile is enough to judge it.* → AC4
- **S4.** *As Priya, right after I watch a suggested video I'm most likely to think "I'd curate
  this" — so that's where I want the invitation, as a clear "Curate this video".* → AC5
- **S5.** *As Priya, when I watch an already-curated clip, I want a gentle "join the curators"
  nudge, not a pitch to re-curate something someone already vouched for.* → AC6
- **S6.** *As Cory, I want the read-only count read to me as plain text (not a disabled button), and
  each player CTA to be a real keyboard control that doesn't hijack or trap my focus.* → AC2, AC9
- **S7.** *As Mona (signed in), I want nothing about my controls to move or disappear.* → AC7, AC8

---

## 3. Information architecture — the one gating axis

There is exactly **one** new condition across all four surfaces: **`signedIn`** (TopicView already
derives `const signedIn = typeof myContributorId === "number"` and threads it down). For a
logged-out reader:

| Surface | Today (logged-out) | After #71 (logged-out) |
|---|---|---|
| Curated tile — rail `ClipCard` | `UpvoteControl` "Log in to upvote" form | **read-only count label** (no control); count 0 → nothing |
| Curated tile — General strip | `UpvoteControl` "Log in to upvote" form | **read-only count label** (no control); count 0 → nothing |
| Candidate tile — rail `CandidateCard` | Curate + Not relevant buttons | **no action buttons** (watch-only) |
| Candidate tile — General strip | Curate + Not relevant buttons | **no action buttons** (watch-only) |
| `PinnedPlayer` (candidate just watched) | metadata-only dock | **+ "Curate this video"** button |
| `PlayerModal` (curated clip) | read-only viewing surface | **+ "Log in to curate videos for this topic"** CTA |

Owner-only Edit/Delete and reviewer/moderator Hold/Approve/Remove rows are **already** gated behind
signed-in role state (`owned`, `canHold`/`canApprove`/`canRemove`), so they never render
logged-out today — Dev confirms this, no change needed (AC1's "no owner/reviewer manage control"
holds for free). The work is the upvote control, the candidate actions, and the two player CTAs.

---

## 4. Surface 1 — Logged-out curated-clip tile (read-only upvote count)

Applies to **both** the rail `ClipCard` footer and the General-strip curated tile, which today both
render `UpvoteControl`. Per **Decision 1**, the count stays as social proof; only the interactive
control disappears.

### 4.1 Behavior

- **Signed in:** `UpvoteControl` renders exactly as today (the real `aria-pressed` toggle, "Voted"
  cue, filled/outline glyph). Unchanged.
- **Logged out, count > 0:** render a **static, non-interactive count label** in the same footer
  slot the control occupied. Not a `<button>`, not an `<a>`, **not focusable** (no `tabindex`), not
  clickable, no hover/press affordance.
- **Logged out, count 0:** render **nothing** in that slot (no "0 upvotes", no glyph). The footer's
  right-hand "context by …" attribution still renders; the left slot is simply empty.

### 4.2 Visual + semantic treatment of the read-only label

The label must read unambiguously as a **figure**, never as a disabled or pressable control.

- **Element:** a plain `<span>` (or `<p>`). No button chrome — no border, no fill, no hover
  underline, no `cursor: pointer`, no focus ring.
- **Glyph:** the `▲` upvote glyph may precede the number as a **decorative** mark (`aria-hidden`),
  matching the control's visual family so the count still reads as "upvotes" at a glance. Do **not**
  use the outline `△` (that is the control's "not-voted" shape and implies an actionable toggle) —
  use the filled `▲` purely as a typographic bullet, or omit the glyph and rely on the visible word.
- **Visible text:** the count **plus the noun**, pluralized honestly via the existing
  `pluralize(count, "upvote")` — e.g. **"12 upvotes"**, **"1 upvote"**. The word is what makes it
  self-describing (a bare "12" next to a glyph reads as a pressable counter); it also satisfies the
  "text-labeled, never color-alone" rule without any control affordance.
- **Tone / contrast:**
  - **Rail `ClipCard` (light surface):** muted ink for a quiet, secondary figure — use
    `text-muted` / `text-ink2` (AA-safe body tones already used in the footer). It is **not** the
    deep-violet `--color-violet` the *control* uses, precisely so it does not read as the actionable
    upvote affordance.
  - **General strip (indigo `#676EB4` band):** **white** at the existing tile font weight/size. Do
    **not** apply the persistent underline the control uses on the band (the underline is the
    band's "this is actionable" cue — a static figure must not wear it). White on `#676EB4` clears
    AA at this size; verify with the existing chip-contrast discipline.
- **Accessible exposure (AC9):** the label is **static text**, exposed to AT as text, **not** as a
  control. No `role`, no `aria-pressed`, no `aria-label` that turns it into a named widget — the
  visible "12 upvotes" *is* the accessible text. It must never be announced as a (disabled) button.

### 4.3 Where it lands for Dev

- `lib/curation/upvote-copy.ts`: the count noun already exists as `upvotesNoun(count)` (private) /
  the `pluralize(count, "upvote")` it wraps. Expose a small read-only string helper (e.g.
  `READONLY_UPVOTE_COUNT = (count) => pluralize(count, "upvote")`) so the static-label copy can't
  drift from the control's noun. No other string changes here.
- `components/topic/UpvoteControl.tsx` is the cleanest home for the branch: when `!signedIn`, render
  the **static label** path (the `<span>` per §4.2) instead of the `<button>`; when `signedIn`,
  render the existing toggle. Keep the `surface: "light" | "indigo"` prop driving tone (muted-ink vs
  white) so both call sites (`ClipCard`, `GeneralStrip`) get the right register from one change.
  Count 0 + logged-out → the component returns `null`. (`ClipCard` and `GeneralStrip` need no other
  edit — they keep passing `count`/`signedIn`/`surface`; `voted`/`onActivate` are simply unused in
  the logged-out branch.) Dev may instead gate at the call sites if cleaner, but the single-component
  branch keeps the two surfaces consistent and is preferred.

---

## 5. Surface 2 — Logged-out candidate tile (watch-only)

Applies to **both** the rail `CandidateCard` and the General-strip candidate tile. Per
**Decision 2**, confirmed watch-only.

### 5.1 Behavior

- **Signed in:** `CandidateActions` (Curate + Not relevant) renders as today. Unchanged.
- **Logged out:** `CandidateActions` does **not render** — no Curate, no Not relevant, no
  placeholder. The tile keeps everything else:
  - the **thumbnail** as the click-to-open affordance — for an embeddable YouTube candidate it opens
    the `PinnedPlayer` (the existing `onPlay` wiring), and the existing non-YouTube / no-embed
    new-tab fallback in `VideoThumb.activate()` is **unchanged** (AC4);
  - the **match-reason** line (`MatchReason`);
  - the **source pill** (`SourcePill`);
  - the **caption** and **creator credit**.
- The candidate's **dashed / unvetted visual language is unchanged** — decluttering removes the
  action buttons, not the unvetted distinction (consistent with #14). The once-per-context
  "Suggested · uncurated" signal (`CandidateSetHeader`, the band eyebrow) is untouched.

### 5.2 Where it lands for Dev

- `components/topic/CandidateBits.tsx` — `CandidateCard`: gate the `<CandidateActions …>` render on
  a new `signedIn` prop (render it only when `signedIn`). The thumbnail's `onPlay` wiring is
  unchanged (still passed only for embeddable YouTube candidates).
- `components/topic/GeneralStrip.tsx` — the candidate-tile branch (the `shownCandidates.map`, the
  `<CandidateActions …>` inside the `candcard` tile): gate the same way on the strip's existing
  `signedIn` prop.
- TopicView passes `signedIn` to `CandidateCard` alongside the existing `onPromote`/`onDismiss`
  (which stay wired for the signed-in case). No handler changes.

---

## 6. Surface 3 — `PinnedPlayer` logged-out curate CTA ("Curate this video")

Per **Decision 3**, the strongest "ready to curate" moment. A logged-out reader who just watched a
candidate in the pinned dock gets a **real `<button>`** offering to curate *that* candidate.

### 6.1 Placement & anatomy

- The CTA is a **new row inside the dock chrome**, directly **below the title bar** (caption +
  creator credit) and **above the video frame** — the metadata→action→video reading order, so the
  action sits with the metadata it acts on and never overlays the video. Full dock width, on the
  ink (`#2C2C2C`) chrome.
- Render **only** when `signedIn === false` **and** a candidate is playing. Signed in → the dock is
  the unchanged metadata-only dock (AC7).

### 6.2 Microcopy (ship verbatim — Decision 3)

| Element | String |
|---|---|
| Button visible label | **`Curate this video`** |
| Button `aria-label` | `Curate this video — log in to write a context note and vouch for it` |
| Decorative glyph (optional, `aria-hidden`) | `✦` (matching the on-tile Curate verb's mark) |

The `aria-label` makes the gate-then-curate destination honest to AT (it leads through login). The
visible word "Curate" carries the meaning — never color alone (AC9).

### 6.3 Visual treatment (Indigo Press tokens)

The dock chrome is ink with white text, so the CTA must be a clearly-actionable control on that dark
bar:

- **Primary action style on dark:** a **solid `brand` (`#676EB4`) fill, white bold text, 2px `ink`
  border** — the same primary-action language as the on-tile Curate button (`bg-brand`, white,
  `border-ink`), which reads as the plus-side primary action. White on `#676EB4` clears AA at
  bold ≥12px. The 2px ink border separates it from the surrounding ink bar (the border, not hue
  alone, carries the boundary). **No gold.**
- Comfortable hit target: `min-height: 44px`, full-width within the dock padding.
- Hover may add the hardbox offset shadow (`hover:shadow-[2px_2px_0_#2C2C2C]`) consistent with other
  plus buttons; the affordance is the filled button + word, not the hover.

### 6.4 The non-modal / no-autofocus / no-focus-steal contract (AC9)

This is load-bearing — the CTA must **not** weaken `PinnedPlayer`'s §8 contract in
`docs/design/pinned-player.md`:

- The dock stays a **`<section aria-label="Video preview">`** — **not** a dialog, **no**
  `aria-modal`, **no** focus trap, **no** backdrop. Adding the button changes none of this.
- **No autofocus / no focus steal on open.** The dock still runs **no** `.focus()` on mount; the CTA
  is simply *present and tabbable*, not focused. After a play click, `document.activeElement` remains
  the candidate's `VideoThumb` button (or wherever the reader was). The CTA must not call `.focus()`.
- **Normal tab order, not trapped.** The CTA is a real `<button type="button">` reachable by Tab,
  operable by Enter/Space, showing the global `:focus-visible` ring. Tab flows **into and out of**
  the dock as before (CTA, then Close, then on out of the region) — never trapped.
- **Focus on activation.** Activating the CTA routes through the login gate (§6.5), which opens
  `gateElement` (a `ModalShell` dialog) — that modal's own focus trap then governs, exactly as the
  other gated entry points already do. The pinned dock itself does not move focus; the gate modal
  does (correctly, as a modal).

### 6.5 Behavior & wiring (the `PinnedClip` widening)

Activating "Curate this video" must reach **the curate flow for that specific candidate** — the same
destination the on-tile Curate gives a signed-in user, i.e. TopicView's `promote(candidate)` →
`requireLogin({ gate: "curate", action: open CurateModal for that candidate })`. Today
`playCandidate` **discards** the `Candidate` object when it builds `pinned` (it copies only display
fields), so the dock currently cannot re-run `promote`. Two equivalent seams for Dev (pick one):

- **(a) Widen `PinnedClip`** to carry the originating `candidate: Candidate` (and/or an `onCurate:
  () => void` already bound to that candidate). `PinnedPlayer` gains props `signedIn: boolean` and
  `onCurate?: () => void`; it renders the CTA only when `!signedIn && onCurate`. TopicView builds
  `pinned` with `onCurate: () => promote(c)` and passes `signedIn`.
- **(b)** Keep `PinnedClip` display-only and pass a top-level `onCurate` from TopicView that closes
  over the **currently-pinned candidate** (TopicView holds the candidate alongside `pinned`).

Either way: the CTA calls `promote(candidate)`, which gates first (logged-out → the `curate` login
gate; the gate copy already exists in `lib/auth/microcopy.ts` `gates.curate`). **Do not** add a new
gate kind. Because this CTA only renders logged-out, the signed-in dock is unaffected and the
established triage loop (Promote / Not relevant **on the card** while the player plays) is untouched
— this is the **intentional, logged-out-only reversal** of the dock's "no Promote/Dismiss inside the
dock" rule, recorded in the docs (AC11).

---

## 7. Surface 4 — `PlayerModal` logged-out join nudge

Per **Decision 3**, the softer, topic-level join nudge for a logged-out reader watching an
**already-curated** clip.

### 7.1 Placement & anatomy

- The CTA is a **new control inside the existing curation block** (`PlayerModal`'s light `border-2
  border-ink bg-white` panel beneath the frame), placed **at the end** of that block — after the
  "context by …" attribution, as the closing invitation. It lives on the light panel, so it reads in
  the Indigo-Press light-card register (not white-on-black).
- Render **only** when `signedIn === false`. Signed in → the modal is the unchanged read-only
  viewing surface (AC7). `PlayerModal` gains one prop: `signedIn: boolean` (TopicView passes
  `signedIn` at the single render site, line ~1684).

### 7.2 Microcopy (ship verbatim — Decision 3)

| Element | String |
|---|---|
| Button visible label | **`Log in to curate videos for this topic`** |
| Button `aria-label` | (same as visible label — it is already a full, honest sentence) |

This is a **topic-level join nudge**, not a per-clip re-curate or vouch action — the reader is
looking at content someone already vouched for. **No per-clip "vouch"/upvote action is wired here**
(that coordinates with #65). The single CTA routes through the login gate.

### 7.3 Visual treatment

- A **secondary, text-forward** treatment befitting a *softer* nudge — not the brand-fill primary
  used in the dock. Use the project secondary button language on a light panel: **white fill, 2px
  `ink` border, bold `ink` text** (the `Edit`-button / `.srcbtn` family), full-width or left-aligned
  within the panel, `min-height: 44px`. AA: ink-on-white is ~15:1. **No gold.** The word "Log in"
  carries the meaning (never color alone — AC9).

### 7.4 Focus-trap participation (AC9)

`PlayerModal` is a real modal (`ModalShell` — `role="dialog"`, `aria-modal`, focus trap, Esc,
backdrop, focus-return). The CTA must participate in that trap **normally**:

- It is a real `<button type="button">` in the **dialog's DOM**, so it joins the existing focus trap
  automatically (like the curation block's links already do — `PlayerModal` §7.4). It must come
  **after** the "context by" link in DOM/tab order (the closing element of the block) so the existing
  focus model is preserved: the `✕ close` button stays the **first** focusable (it is focused on
  open), and Tab cycles close → frame → block links → **this CTA** → wrap. Do not move the close
  button or change its first-focus behavior.
- Activating it calls TopicView's existing `requireLogin({ gate: "curate", action: … })` (or a
  topic-join gate if Product later distinguishes one — reuse `curate` now; **no new gate kind**).
  Opening that gate while the player modal is up is the same transient modal-over-modal already
  documented for the gated flows; the gate modal's trap governs while it is up.

---

## 8. Every state (logged-out vs signed-in × empty/zero × reduced-motion)

| Surface / condition | Logged out | Signed in |
|---|---|---|
| **Curated tile, count > 0** | static "N upvotes" label, not focusable (§4) | upvote toggle (unchanged) |
| **Curated tile, count = 0** | **nothing** in the slot (§4.1) | upvote toggle showing 0 (unchanged) |
| **Candidate tile** | watch-only: thumb + match reason + source pill + caption + credit; **no actions** (§5) | + Curate / Not relevant (unchanged) |
| **PinnedPlayer (candidate playing)** | dock + **"Curate this video"** CTA (§6) | metadata-only dock (unchanged) |
| **PinnedPlayer no-embed / non-YouTube** | new-tab fallback, no dock (unchanged) — so no CTA either | same |
| **PlayerModal (curated clip open)** | curation block + **"Log in to curate videos for this topic"** CTA (§7) | read-only curation block (unchanged) |
| **PlayerModal "can't be embedded"** | the existing degraded message **+** the join CTA still renders in the block (§7) | degraded message, no CTA |
| **Empty Topic (all candidates)** | candidate tiles watch-only; the topic-level "Be the first to curate" / "Find more" CTAs **stay** (out of scope, AC10) | unchanged |
| **Reduced motion** | both CTAs are static (no entrance animation of their own); the dock's existing motion stays gated by `prefersReduced` (§6.4) — adding the CTA introduces no new motion | same |

**Loading / error of the underlying surfaces** is unchanged by this spec (the General-strip skeleton,
the article fetch states, the modal load) — #71 only adds/gates controls within already-rendered
surfaces; it does not introduce new loading or error states.

---

## 9. Accessibility (baseline — every changed surface)

- **Text-labeled, never color alone.** Read-only count = the word "upvotes" (§4.2). PinnedPlayer CTA
  = the word "Curate" (§6.2). PlayerModal CTA = the words "Log in to curate…" (§7.2). No signal is
  carried by hue.
- **AA contrast** on each surface: muted-ink figure on white / white figure on `#676EB4` (§4.2);
  white-on-`brand` brand-fill CTA on the ink dock, separated by a 2px ink border (§6.3); ink-on-white
  secondary CTA in the modal block (§7.3). Verify the General-strip white-on-`#676EB4` figure with
  the existing chip-contrast test discipline.
- **Read-only count is static text, not a control (AC9).** No `role`, no `tabindex`, no
  `aria-pressed`, no `aria-disabled`. It must never be announced as a (disabled) button. A disabled
  `<button>` is explicitly **wrong** here (it would be a non-focusable inert control that still reads
  as a button) — use a `<span>`.
- **Keyboard + visible focus** on both player CTAs: real `<button type="button">`, Tab-reachable,
  Enter/Space-operable, the global `:focus-visible` ring (`3px solid var(--color-brand)`).
- **Modal vs non-modal focus contracts (the heart of this spec):**
  - `PinnedPlayer` CTA: **non-modal** — present and tabbable, **no autofocus, no focus steal** on
    dock open; tab flows in and out, never trapped (§6.4). The dock stays a labeled `<section>`, not
    a dialog.
  - `PlayerModal` CTA: **modal** — inside the dialog focus trap, last in the block's tab order, the
    `✕ close` button stays first-focused on open (§7.4).
- **Reduced motion** respected: no new motion is introduced; the dock's entrance stays gated by the
  existing `prefersReduced` signal (§6.4).
- **Fewer tab stops logged out** is a feature, not a regression: removing per-tile controls reduces
  the keyboard reader's stop count across the rail and strip — corroborating the "calmer surface"
  goal for Cory.

---

## 10. Acceptance-criteria → design map

| AC (spec §"Acceptance criteria") | Satisfied by |
|---|---|
| AC1 no curated-clip action control logged out | §4.1 (read-only label, no button), §3 (owner/reviewer rows already gated) |
| AC2 read-only count visible (>0), none at 0, not focusable/clickable | §4.1, §4.2 |
| AC3 no candidate Curate/Not-relevant logged out | §5.1, §5.2 |
| AC4 candidate stays watch-only with signals | §5.1 (thumb/match/source/caption/credit kept; `VideoThumb.activate()` split unchanged) |
| AC5 PinnedPlayer "Curate this video" → that candidate's curate flow | §6.1, §6.2, §6.5 |
| AC6 PlayerModal "Log in to curate videos for this topic" in the trap | §7.1, §7.2, §7.4 |
| AC7 player CTAs absent when signed in | §6.1, §7.1 (render only `!signedIn`) |
| AC8 signed-in Topic view unchanged | §4.1, §5.1 (signed-in arms untouched; no control moved off a tile — Decision 3 scope) |
| AC9 a11y on every changed surface | §9 (text-labeled, AA, keyboard, focus, static-text count, modal/non-modal contracts, reduced-motion) |
| AC10 no out-of-scope CTA removed; no schema/vote-compute change | §8 (topic-level CTAs stay); §4 is presentation/gating only |
| AC11 docs updated | §11 hand-off (TOPIC_PAGE_DESIGN.md + pinned-player.md), including the logged-out-only dock-rule reversal |

---

## 11. Component breakdown & hand-off to Development

- **`components/topic/UpvoteControl.tsx`** — add the `!signedIn` branch: render a static, unfocusable
  `<span>` count label (§4.2) per `surface`; count 0 → render `null`. Signed-in toggle unchanged.
- **`lib/curation/upvote-copy.ts`** — expose a read-only count-string helper (`pluralize(count,
  "upvote")`) so the static label's noun can't drift from the control's.
- **`components/topic/CandidateBits.tsx`** (`CandidateCard`) — add `signedIn` prop; render
  `<CandidateActions>` only when `signedIn`. Thumbnail `onPlay` unchanged.
- **`components/topic/GeneralStrip.tsx`** — candidate-tile branch: gate `<CandidateActions>` on the
  existing `signedIn` prop. (The curated-tile `UpvoteControl` change rides along via the component.)
- **`components/topic/PinnedPlayer.tsx`** — add `signedIn` + `onCurate` (and widen `PinnedClip` to
  carry the candidate / curate binding, §6.5); render the "Curate this video" CTA row (§6.1–6.3) only
  `!signedIn && onCurate`. Keep the `<section aria-label="Video preview">` non-modal contract intact
  (§6.4 — no autofocus, no trap).
- **`components/topic/PlayerModal.tsx`** — add `signedIn` prop; render the "Log in to curate videos
  for this topic" CTA at the end of the curation block (§7.1–7.3) only `!signedIn`. It joins the
  existing `ModalShell` trap; close button stays first-focused (§7.4).
- **`app/topic/TopicView.tsx`** — build `pinned` to carry the candidate/curate binding and pass
  `signedIn` + `onCurate: () => promote(c)` to `PinnedPlayer`; pass `signedIn` to `PlayerModal`,
  `CandidateCard`, and (already) `GeneralStrip`. The player CTAs route through the **existing**
  `promote` / `requireLogin({ gate: "curate" })` — no new gate kind, no schema change.

- **To QA & Review + UX evaluation:** verify against §8 (state table) and §10 (AC map). Render the
  standard logged-out × logged-in screenshot matrix (home + Topic, the three states) as evidence;
  confirm specifically: (1) logged-out tiles carry no action buttons and a count-0 tile shows no
  figure; (2) the read-only count is not Tab-focusable and is announced as text; (3) the PinnedPlayer
  CTA does not steal focus on dock open and is not trapped; (4) the PlayerModal CTA is inside the
  trap with close still first-focused; (5) signed-in surfaces are unchanged.

This spec also requires the timeless-doc updates (Dev/QA confirm landed): `docs/TOPIC_PAGE_DESIGN.md`
(the logged-out reader model — no per-tile CTAs, read-only count, watch-only candidates, the two
player CTAs) and `docs/design/pinned-player.md` (the logged-out-only "Curate this video" CTA and the
intentional, logged-out-only reversal of the dock's "no Promote/Dismiss inside the dock" rule).
