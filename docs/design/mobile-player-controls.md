# Design spec — Mobile player controls (control strip: Maximize · Move; below-frame curation)

**Issue:** folds into [#123](https://github.com/ragesoss/wikiplus/issues/123) (the in-player
curation PR) · **Role:** UX / Design · **Status:** design spec — **written *before* the mobile
build**, from the owner-approved decisions on `docs/design/mobile-player-controls-explore.md`.
**Surface:** `components/topic/MobilePlayerDock.tsx` (mobile, `< lg`).
**Revises:** the mobile dock's title-bar controls row + (for #123 coherence) adds the signed-in
curation action row the mobile dock lacked.
**Reads / respects (do not break):** `docs/design/mobile-player-launch.md` (#135 — frame-first, the
`88dvh` bound, the narrow-width text budget, the measured spacer), `docs/design/unified-player-mobile.md`
(#120 — the non-modal contract, the state model, the microcopy, park/maximize), `docs/design/in-player-curation.md`
(#123 — the desktop "watch + act" contract this mobile pass mirrors verbatim), `docs/VISUAL_IDENTITY.md`
(Indigo Press), `docs/CURATION_STANDARD.md` §5.2/§5.4 (creator credit + "context by").
**Feeds:** Development (the mobile portion of #123), then QA & Review + UX evaluation.

This is the buildable contract for **two coordinated changes to the mobile dock**:

1. **Fix the unreadable controls** (the owner's complaint: the fullscreen / move-up-down glyphs
   "especially on mobile, they don't read clearly and are very small"). Maximize and Move move
   **out** of the cramped title-bar glyph cluster onto a **labeled control strip directly below the
   frame** — full text + a *conventional* icon, ≥44px. The obscure `⤢` / `⤒` / `⤓` arrow glyphs are
   dropped.
2. **Give the mobile dock the signed-in curation actions it lacked** (today its secondary region has
   only the logged-out CTA). The dock gains the #123 **watch + act** action row — **✦ Curate** /
   **✕ Not relevant** — verbatim from the desktop contract, below the control strip.

The result is **one model across desktop (#123) and mobile**: title bar = identity + Close; below the
frame = everything else, in two clearly-weighted rows — **chrome** ("adjust the player") then
**action** ("decide on the clip").

> **What this is NOT.** Not a re-layout of the frame-first launch (#135 governs that — the frame is
> still the hero, still `shrink-0`, the secondary region still the sole scroll area). Not a change to
> the `88dvh` bound, the non-modal contract, maximize-on-rotate (CSS, never `requestFullscreen`), the
> park mechanics, the safe-area insets, or the embed facade. Not a curated-playback voting change
> (#65 owns the curated "act"). Not a desktop change (desktop is #123's domain; this is its mobile
> sibling). Where this spec is silent, **#135 then #120 govern.**

---

## 1. Personas & user stories served

Carried from #120 §1 (**Priya** — the deciding reader on a phone; **Cory** — keyboard / AT reader;
**Mona** — the curator-in-the-making) and #123 §1 (Mona's and Priya's *triage loop*). This spec
sharpens the controls and the act-where-you-watched loop **on the phone**.

- **MS1.** *As Priya on a phone, I want the "make it bigger" and "get it out of my way" controls to
  read clearly and be comfortably tappable, not tiny unguessable arrows jammed in a corner.* →
  Owner decision 1 + 2 → §3 control strip, §4.
- **MS2.** *As Mona on a phone, I want to Curate the clip I'm watching right from the player, and
  mark it Not relevant and have it disappear, without hunting back to the card.* → Owner decision 3
  (mirrors #123 S1/S2) → §5 States I/K/L.
- **MS3.** *As Mona, after I dismiss the clip on my phone, I want the player to get out of the way
  and put me back in the list to pick the next one.* → §5 State L (dock closes; focus → band heading).
- **MS4.** *As Priya (logged out), I want the same one-tap "Curate this video" invitation in the
  mobile player, and no Dismiss that pretends to work.* → §5 State J (mirrors #123 S4).
- **MS5.** *As Cory, I want the new strip + action buttons to be real tabbable buttons with visible
  focus and text labels, in a sensible order, in a region that still never traps or steals my
  focus.* → §6 (mirrors #123 S6, #120 S8).
- **MS6.** *As any reader, I want "adjust the player" to never look like "decide on the clip" — the
  chrome quieter than the brand action — and every signal carried by a word, AA-legible.* → §7
  visual weight (owner decision; resolves explore IP-7).

**Owner-decision → spec map (build to exactly these):**

| Owner decision | Built by |
|---|---|
| 1 — Layout = Option A (control strip): title bar = ✕ Close only; control strip (Maximize · Move) below the frame; curation action row below that | §2 anatomy, §3 control strip, §5 states |
| 2 — Icons = words + conventional icons; drop `⤢`/`⤒`/`⤓`; Maximize toggles to Exit | §3.2 (exact icon spec) |
| 3 — Folds into #123: same Curate / Not relevant treatment + labels verbatim; logged-out single CTA, no Dismiss; post-dismiss = dock closes + focus to band heading | §5 States I/J/K/L (= #123 §5), §7, §8 wiring |

---

## 2. The full dock anatomy (Option A)

The mobile dock stays the frame-first flex column of #135. Option A inserts **two new `shrink-0`
rows below the frame** — a **control strip** (chrome) then an **action row** (curation) — above the
existing secondary region. Top → bottom (bottom-parked default; identical order top-parked, only the
hugged edge changes — #135 §1.1):

```
  ── article visible above the dock (≥12dvh — #135 AC-2) ──
┌──────────────────────────────────────────────────────────┐  ← <section aria-label="Video player">
│ SLIM TITLE BAR (shrink-0)                        [✕ Close] │  TITLE BAR — Close ONLY now
│   ＋plus · caption (clamp-1)                                │   eyebrow + caption (one clamped line)
│   @handle · platformLabel                                  │   creator credit (CC BY-SA) — AC-4
├──────────────────────────────────────────────────────────┤
│ VIDEO FRAME — THE HERO (shrink-0)                          │   16:9 full-width / 9:16 capped+letterboxed
├──────────────────────────────────────────────────────────┤
│ CONTROL STRIP (shrink-0)   [ ⛶ Maximize ] [ ▲ Move to top ]│  CHROME — quiet, words + conventional icon
├──────────────────────────────────────────────────────────┤
│ ACTION ROW (shrink-0)    [ ✦ Curate ] [ ✕ Not relevant ]   │  ACTION — #123 watch+act (signed-in)
├──────────────────────────────────────────────────────────┤
│ SECONDARY REGION (flex-1 min-h-0 overflow-y-auto)          │  curated only: held · chips · "Context ▸"
│   curated → chips · "Context ▸" (→ note + "context by")    │   the SOLE scroll area
└──────────────────────────────────────────────────────────┘  ← dock pinned to the parked edge
```

**Region roles (clean separation):**

- **Title bar** (`shrink-0`) — identity + the one always-needed control: **✕ Close** only. With the
  row now holding a single button, **Close's word is visible** even at 360px (the text budget that
  forced glyph-only no longer applies — the wide controls left this row).
- **Frame** (`shrink-0`) — the hero, unchanged (#135 §2).
- **Control strip** (`shrink-0`, NEW) — the **chrome** row: **Maximize** + **Move**, full text +
  conventional icon, ≥44px, **quiet** weight (§7). "Adjust the player."
- **Action row** (`shrink-0`, NEW for signed-in) — the **#123 watch + act** row: **✦ Curate**
  (brand, `flex-1`) + **✕ Not relevant** (quiet secondary), or — logged out — the single
  **✦ Curate this video** CTA. "Decide on the clip."
- **Secondary region** (`flex-1 min-h-0 overflow-y-auto`) — curated only: held marking · chips ·
  "Context ▸" → the light note panel + "context by". The **sole** scroll area. **Candidate has no
  secondary region** (its only supplemental was a one-line match reason and the logged-out CTA — see
  §5 / the placement note below).

> **Placement of the candidate match reason and the existing logged-out CTA.** Today both live in the
> candidate's secondary region. With Option A:
> - **Match reason (candidate):** stays a one-line `line-clamp-2` strip. Render it as a thin line
>   **between the control strip and the action row is wrong** (it would split chrome from action);
>   instead render it **below the action row**, in the secondary region slot, where prose belongs —
>   *or*, since a candidate now has an action row and no other secondary content, render it as a
>   one-line caption **directly under the control strip, above the action row**. **Decision: keep the
>   match reason in the secondary region (below the action row).** Rationale: the action row is the
>   decision the reader came to make; the match reason is supporting "why suggested" context that
>   reads naturally just under it, and keeping all non-chrome/non-action content in the one scroll
>   region preserves #135's "secondary region is the sole scroll area" invariant. For a candidate the
>   secondary region therefore holds only the match-reason line (short; shows in full without
>   scrolling at every in-scope width).
> - **Logged-out candidate CTA (`✦ Curate this video`):** this **becomes** the action row's
>   logged-out rendering (§5 State J) — it is no longer a separate secondary-region button.
> - **Logged-out curated nudge (`Log in to curate videos for this topic`):** likewise becomes the
>   action row's logged-out rendering for `kind="curated"` (§5 State J), matching #123's "one row,
>   two states" unification.

### 2.1 The two new rows in the height budget (#135 fit)

The control strip and the action row are each **one ~44px `shrink-0` row** (button min-height 44px +
the row's `py`). Together with their padding they add **≈ two 44px rows ≈ 96–104px** to the docked
height `D` over the #135 baseline. They are `shrink-0` like the title bar and frame, so they **do not
scroll** and they do **not** participate in the `overflow-y-auto` secondary region. The secondary
region stays the sole scroll area; when the `88dvh` cap engages (long expanded note / pathologically
short viewport) it is still the secondary region that scrolls, and the **frame + title bar + control
strip + action row all stay pinned and visible** (the strip's Exit affordance must stay reachable —
§4). See §8 fit math: the article slice still holds at ~390px and at the 780px stress viewport.

---

## 3. The control strip (chrome) — concrete spec

A one-line, `shrink-0` row directly below the frame, on the ink dock chrome. Two buttons, left to
right: **Maximize**, then **Move**. Each is a real `<button>`, full **text + conventional icon**,
`min-height: 44px`, comfortable horizontal padding (`px-3`), `gap` between them so they read as two
distinct buttons (not the old crammed cluster).

### 3.1 Microcopy + behavior (ship verbatim)

| Control | Visible label | `aria-label` | Notes |
|---|---|---|---|
| Maximize (docked) | **Maximize** | `Maximize video to fill the screen` | toggles `maximized` (CSS, never `requestFullscreen`) |
| Maximize (maximized) | **Exit** | `Exit full-screen video` | same button, relabeled when maximized |
| Move (dock at bottom) | **Move to top** | `Move player to top of screen` | label names the **destination** (resolves IP-6 — see §3.3) |
| Move (dock at top) | **Move to bottom** | `Move player to bottom of screen` | |

The **word carries the meaning** in every case; the icon is a familiar reinforcement only (never the
sole signal — §6, §7). The Move label always names where the dock will *go* (the standard toggle
convention, verbatim from #120 §7).

### 3.2 The conventional icons (resolves owner decision 2 / explore IP-2)

Drop the obscure `⤢` (maximize) and `⤒`/`⤓` (move) arrow glyphs. Use **conventional** icons, each
paired with its word. **Inline SVG is the buildable primary** (consistent cross-platform, AA-tunable
to `currentColor`); the glyph alternative is acceptable only if Dev prefers it and it renders
reliably on iOS/Android. All icons are `aria-hidden` (the word is the accessible name) and sized
~16px (`w-4 h-4`), `currentColor`, drawn at the same stroke weight as the label text.

- **Maximize — the standard "corner-expand" fullscreen icon** (four right-angle brackets pointing to
  the corners — the YouTube/native muscle-memory fullscreen mark). Buildable SVG (20×20 viewBox,
  `stroke="currentColor"`, `stroke-width≈2`, `fill="none"`, round caps):

  ```
  Four corner brackets:  M3 7V3h4    (top-left)    M17 7V3h-4   (top-right)
                         M3 13v4h4   (bottom-left) M17 13v4h-4  (bottom-right)
  ```
  i.e. four 2-segment polylines forming `⌜ ⌝ / ⌞ ⌟` brackets, leaving the centre open. If a glyph is
  used instead, the conventional choice is **`⛶` (U+26F6 SQUARE FOUR CORNERS)** — *not* `⤢`. The SVG
  is preferred because `⛶` renders inconsistently across mobile fonts.

- **Exit (Maximize, when maximized)** — the **inward "corner-contract"** mirror of the same icon
  (brackets pointing *inward* to the centre), so the toggle reads as the visual inverse of Maximize:

  ```
  Four inward brackets:  M3 3l4 4    M17 3l-4 4    M3 17l4-4    M17 17l-4-4
  ```
  (or the same four corner-bracket shapes rotated to point inward). Glyph fallback if SVG is not
  used: keep the same `⛶` mark — the **word "Exit"** carries the state change; do not invent a second
  obscure glyph.

- **Move — a directional chevron** that points to the destination edge, paired with the destination
  word:
  - Dock at bottom → **`▲ Move to top`** — an **up chevron** (SVG `M5 12l5-5 5 5`, `stroke`, round
    caps, no fill). Glyph fallback: **`▲` (U+25B2)** or a chevron `‸`/`˄` — `▲` is the conventional,
    widely-rendered choice; **do not** use `⤒`.
  - Dock at top → **`▼ Move to bottom`** — a **down chevron** (SVG `M5 8l5 5 5-5`). Glyph fallback:
    **`▼` (U+25BC)**; **do not** use `⤓`.

  *(A "dock" icon was offered as an alternative in the owner decision; the directional chevron is the
  clearer choice because it points at the destination the label names — icon and word reinforce each
  other. Use the chevron.)*

### 3.3 Resolved IP-6 — Move wording

**FIXED: "Move to top" / "Move to bottom"** (verbatim from #120 §7/§10). It names the **destination**
(the standard toggle convention), is already the shipped vocabulary, and pairs cleanly with the
directional chevron (the up chevron *is* "to top"). Reject "Dock at top/bottom" (introduces a second
verb — "dock" — for the same gesture and reads more permanent/jargony than "move").

---

## 4. Maximized mode — what hides, what stays (the Exit reachability question)

Per #135/#120 §6.3–§6.4, maximized condenses chrome and **hides the secondary region and the park
toggle** (the reader is watching, not reading; parking is meaningless when the dock *is* the screen).
With Option A's new rows, decide each row's maximized fate explicitly:

- **Action row (Curate / Not relevant): HIDDEN while maximized.** It is "decide on the clip" chrome;
  the maximized reader is watching full-screen. It returns on Exit. (Same rationale as hiding the
  secondary region — #135 §6.3.)
- **Control strip (Maximize/Move): the Move button HIDES; the Maximize→Exit button STAYS — but it
  relocates, it does not stay as a strip below a full-bleed frame.** Because maximized is `inset-0`
  with the frame flexing to fill, there is no "below the frame" strip in maximized mode. The
  **Exit** affordance lives in the **condensed top bar** alongside **✕ Close** (exactly as #120 §6.3
  specifies the maximized chrome: a thin Close bar with the credit caption, plus the Exit toggle).
  So in maximized mode the chrome is: **thin top bar = creator-credit caption + `⛶ Exit` + `✕ Close`**
  (words visible — the bar has full width), and nothing else. **Exit is therefore always reachable**
  (it must be — it is the keyboard/AT/rotation-lock way out, and the only way out for a vertical
  Short with no landscape trigger; #120 A3).

> **Net:** docked = title bar (Close) → frame → control strip (Maximize · Move) → action row →
> secondary. Maximized = thin top bar (credit · ⛶ Exit · ✕ Close) → full-bleed frame. The control
> strip and action row are a **docked-only** construct; the Exit and Close controls survive into the
> maximized thin bar.

---

## 5. Every state (ship-verbatim microcopy) — extends #120 §8 / #135 §4 and adopts #123 §5

States from #120 §8 / #135 §4 (idle, loading, playing, swap, collapsed/expanded curation,
no-embed, dismissed, top-parked, maximized) hold, **re-arranged** so Maximize/Move are on the control
strip and the curation action row is present. The action states below adopt #123 §5 **verbatim** for
mobile.

### State I — Signed-in, playing (docked) — the new default for a signed-in mobile viewer
- **Trigger:** a signed-in reader has a clip playing in the docked dock.
- **Render (top → bottom):** title bar (`＋plus` · caption · credit · **✕ Close**) → frame →
  **control strip** (`⛶ Maximize` · `▲ Move to top`) → **action row** (`✦ Curate` primary `flex-1` +
  `✕ Not relevant` secondary) → secondary region (curated: held · chips · "Context ▸"; candidate:
  match reason). Page stays interactive; non-modal (§6).
- **Action microcopy (verbatim, = #123 §3.3):**
  - **`✦ Curate`** (`✦` decorative, `aria-hidden`); `aria-label="Curate this clip: {caption}"`,
    `aria-haspopup="dialog"`.
  - **`✕ Not relevant`** (`✕` decorative); `aria-label="Dismiss as not relevant: {caption}"`.

### State J — Logged-out, playing (docked) — single CTA, no Dismiss
- **Trigger:** a logged-out reader has a clip playing.
- **Render:** title bar → frame → **control strip** (Maximize · Move) → **action row = a single
  full-width CTA**, **no Not relevant button** (= #123 §3.4 / State J). The CTA's label is
  kind-specific (the existing mobile strings, now promoted into the action-row slot):
  - **candidate:** **`✦ Curate this video`** (`flex-1`, brand fill); `aria-haspopup="dialog"`,
    `aria-label="Curate this video — log in to write a context note and vouch for it"`.
  - **curated:** **`Log in to curate videos for this topic`** (the softer join nudge — white fill,
    ink text, 2px ink border); `aria-haspopup="dialog"`.
- **Why no Dismiss logged out** (= #123 §5 State J, DW4): a logged-out dismiss cannot honestly
  optimistic-hide, so the player does not offer a Dismiss that would lie or bounce to a gate from
  inside the watch surface. (Mirrors desktop exactly.)

### State K — Curate from the player (post-action)
- **Trigger:** the reader activates **Curate** (signed in) or the logged-out CTA.
- **Behavior (= #123 §5 State K):** routes through `TopicView.promote(playing candidate)` — signed in
  → `CurateModal`; logged out → the `curate` login gate. The modal opens at `z-50` **over** the dock
  (`z-40`, #120 §9) and its focus trap governs while up; the dock + iframe stay mounted behind it. On
  **success** the clip is removed from `liveCandidates`, so on modal close the dock **advances/closes
  by the same rule as a dismiss** (State L). On **cancel** the dock is unchanged and keeps playing.
- **No new microcopy** — reuses the gate + `CurateModal` strings.

### State L — Dismiss from the player (signed in) — optimistic hide; **dock closes**
- **Trigger:** a signed-in reader activates **✕ Not relevant**.
- **Behavior (= #123 §5 State L, DW3):** routes through `TopicView.dismiss(playing candidate)` — the
  existing **optimistic-dismiss-with-rollback** (`runDismiss`): hide the card instantly, persist in
  the background, **roll back (card reappears + polite notice) on write failure**, gate on expired
  session, calm notice on rate-limit. **Reused verbatim — no #45 change.**
- **Dock closes** (state → `null`; iframe torn down; playback stops; the measured page spacer is
  removed so the page reflows). Mobile matches desktop #123: **close, not auto-advance** (no
  autoplay of an unrequested clip).
- **Focus after close:** reuse `focusBandHeading()` — focus → `#general-band h2` (`tabindex=-1`), the
  same anchor Close and on-card dismiss already use. (= #123 §5 State L / §7.)
- **On rollback:** the **card** reappears + polite notice; the dock has already closed (correct — the
  clip is recoverable from the card; the reader chose to stop watching).

### Curated-kind "act" — vote/manage, NOT Curate/Dismiss (consistency, do not build voting)
- A **curated** clip in the mobile dock is already curated, so its "act" is **#65's vote/manage**, not
  Curate/Not relevant. This spec does **not** build voting. For a curated clip the **action row is
  not the Curate/Not-relevant row**:
  - **Logged out, curated:** the action row renders the **`Log in to curate videos for this topic`**
    join nudge (State J).
  - **Signed in, curated:** the action row renders **#65's vote/manage affordance** in the **same
    below-the-frame slot with the same weight grammar** (primary action branded, secondary quiet,
    text-labeled) so curated and candidate players read as one family. **If #65's vote/manage is not
    yet built on mobile, the signed-in curated action row is simply absent** (the dock still shows
    title bar → frame → control strip → secondary region with held · chips · "Context ▸"). Do **not**
    show Curate/Not relevant on a curated clip. (This matches #123 §8's "#65's curated vote/manage is
    the *curated* analog of act; do not build #65 voting here.")
  - The curated **secondary region** (held marking · chips · `Context ▸` → the light note panel +
    `context by`) is **unchanged** from #135 — it sits below the action row, scrolling.

### Top-parked / bottom-parked (the Move label reflects the destination)
- Internal order is **identical** at either edge (title bar → frame → control strip → action row →
  secondary); only which viewport edge the whole bar hugs changes (#135 §1.1).
- The **Move button's label names the destination**: bottom-parked → `▲ Move to top`; top-parked →
  `▼ Move to bottom` (§3.1/§3.3). The measured page spacer moves with the edge (#135 §3), now sized
  to include the two new rows (§2.1, §8).

### Other states — unchanged in behavior, re-arranged in layout
- **loading / swap / no-embed / dismissed / idle:** behavior unchanged (#120 §8); the control strip +
  action row render in the same below-frame slots once playing (loading shows them immediately like
  the title bar). A swap resets the curated note to collapsed (#120 §8) and re-derives the dock
  height / spacer (#135 §3) including the new rows.

---

## 6. Accessibility contract

The #120 §9 / #135 §6 non-modal contract holds **unchanged**; the new rows live inside it.

- **Non-modal landmark preserved.** Dock root stays `<section aria-label="Video player">` — **no**
  `role="dialog"`, **no** `aria-modal`, **no** focus trap, **no** backdrop, **not** routed through
  `ModalShell`, even maximized. Adding the strip + action row does not change this.
- **Real tabbable buttons, every new control.** Maximize, Move, Curate, Not relevant (and the
  logged-out CTA) are real `<button>`s, Enter/Space operable, each ≥44px, each showing the global
  `:focus-visible` ring (`3px solid var(--color-brand)`, `offset 2px`). Tab flows **through** and
  **out** — never trapped.
- **Tab / reading order (DOM order) with the new rows:**
  **Close** (title bar) → **frame** (the embed) → **Maximize** → **Move** → **Curate** →
  **Not relevant** → (secondary) **Context ▸** → (inside the note, when expanded) its links.
  - Close is reachable first (always-needed). The control strip's chrome precedes the action row's
    decision, which precedes the secondary curation detail — a coherent "watch → adjust → decide →
    read more" narration. (In maximized mode the order condenses to: **Exit → Close → frame**, per §4.)
- **No focus-steal on open or on swap.** Opening or swapping the dock moves **no** focus (no
  autofocus, no `.focus()` on mount); `document.activeElement` stays on the originating play button.
  The new rows are present and Tab-reachable but **never focused** on open/swap.
- **Post-dismiss focus → band heading.** State L: focus moves to `#general-band h2` (`tabindex=-1`)
  via `focusBandHeading()` — never dropped to `<body>`, never trapped. (= #123 §7.)
- **Maximize is a layout, not a modality.** Entering/exiting maximize never adds a trap or
  `aria-modal`; it is exited by rotation / the **Exit** button / **Close**, not Esc (#120 §6.6/§9).
- **Never color-alone (every new control carries its word).** Maximize/Exit, Move (to top/bottom),
  Curate, Not relevant each carry a **visible word**; the icons (`⛶`/corner-expand SVG, the chevron,
  `✦`, `✕`) are `aria-hidden` reinforcement, never the sole signal. Curate's primacy is conveyed by
  size/fill **and** its label; Not relevant by label + border (it is **not** red).
- **AA contrast for each new control** (verified tokens, Indigo Press):
  - **Control strip (quiet chrome) — ink-on-white "ghost" buttons:** white fill, 2px `ink`
    (`#2C2C2C`) border, **`ink` text + `ink` (currentColor) icon** → ink-on-white ≈ **15:1 (AAA)**.
    (See §7 for why ghost/quiet, not brand fill.) The button sits on the ink dock body but is itself
    a white pill, so its own fill carries its text contrast — the boundary is the 2px ink border
    (shape), not hue. *Alternative, if the owner finds two white-ish areas busy:* the chrome may be
    **ink-bar text buttons** — white text on the `ink #2C2C2C` bar ≈ **15:1 (AAA)** with an
    underline-on-hover/focus affordance and the icon in `currentColor`; still quieter than the brand
    action because it is unfilled. §7 picks ghost-on-white as the default; either clears AA.
  - **Curate (action):** white bold text on `brand #676EB4` → meets AA at bold/large (the same combo
    already shipped on the on-card Curate + the #71 CTA; precedent verified — #123 §7).
  - **Not relevant (action):** `ink` text on `white` (≈ 15:1, AAA).
  - **The chrome strip vs. the action row** therefore differ by **fill weight** (ghost/unfilled vs.
    brand fill), not by hue alone — a reader distinguishes "adjust" from "decide" by both the words
    and the visual weight (§7), satisfying never-color-alone.

---

## 7. Visual weight — chrome strip quieter than the brand action (resolves IP-7)

The reader must never confuse **"adjust the player"** (control strip) with **"decide on the clip"**
(action row). The two rows are deliberately **weighted apart**:

- **Control strip = QUIET (ghost / outline on white).** Maximize and Move are **white-fill, 2px `ink`
  border, ink text + ink icon** pill buttons — unfilled, low-emphasis, reading as utility chrome.
  They do **not** grow (intrinsic width), sit left-aligned with a `gap`, and never use brand fill.
  This is the lightest treatment that still clears AA (§6) and meets ≥44px.
- **Action row = LOUD where it matters (the #123 weights, verbatim).**
  - **Curate** — solid **`brand #676EB4`** fill, white bold text, 2px `ink` border, **`flex-1`** so
    it dominates the row. Decorative `✦`.
  - **Not relevant** — white fill, `ink` text, 2px `ink` border, **intrinsic width** (quiet
    secondary). Decorative `✕`. Not red.
  - Logged-out: the single brand-fill `✦ Curate this video` (`flex-1`) / the white-fill curated join
    nudge.

So the eye sees a **filled brand button (Curate) as the loudest thing below the frame**, the
destructive/triage Not relevant as a quiet white button beside it, and the chrome strip above as the
*quietest* (unfilled utility). The hierarchy is **brand-filled action > white secondary action >
ghost chrome** — "decide" always outranks "adjust." (Resolves explore IP-7's recommendation; the
text-only-links alternative is rejected as the default because ghost pills read more clearly as
≥44px tap targets than text links, but ink-bar text buttons remain the documented fallback in §6.)

> **Distinguishability check (never-position/color-alone):** the rows are told apart by (a) the
> **words** ("Maximize"/"Move" vs. "Curate"/"Not relevant"), (b) the **weight** (ghost vs. brand
> fill), and (c) position (chrome above action). No single channel is load-bearing.

---

## 8. Responsive / fit — the strip + action row at 360/390px and the 780px stress viewport

Option A adds **two `shrink-0` rows (≈ 96–104px total)** below the frame. The #135 budget headroom
absorbs them. Numbers at the stressing **780px** viewport (the catalog mobile viewport is 390×850, so
real captures show *more* article than these stress numbers).

**Heaviest docked case — curated*, signed-in, 16:9** (`T` title bar 60 + `F` frame 219 @390 +
control strip ~48 + action row ~48 + `S` secondary at launch ~60 [held? · chips · "Context ▸"]):

| Width | `T` | `F` (16:9) | strip | action | `S` | `D` | article slice (780−D) |
|---|---|---|---|---|---|---|---|
| 360 | 60 | 203 | 48 | 48 | 60 | **419px** | **361px (~46%)** |
| 390 | 60 | 219 | 48 | 48 | 60 | **435px** | **345px (~44%)** |

\* *For a curated clip the action row is #65 vote/manage or absent (§5); the above sizes the row at
~48px as the upper bound. A **candidate** clip has no curated secondary block — its `S` is just the
one-line match reason (~34px) — so candidate `D` is ~26px **less** than the curated row above. A
**logged-out** clip's action row is a single CTA (~52px, ~one row) — comparable. The table is the
upper-bound case.*

- **`D ≈ 419–435px` against the 780px stress viewport ≈ 54–56%** → an article slice of **~44–46%
  (~345–361px)** — a *meaningful* slice (multiple lines + a section heading), comfortably inside the
  `88dvh ≈ 686px` ceiling. **The frame (`T`-offset … `T+F`, max `60+242=302 < 780`) is fully visible
  on open** (AC-1 holds — frame `shrink-0`).
- **9:16 vertical** (frame capped `min(46vh,380px)`; @780 = 359px): `D = 60 + 359 + 48 + 48 + 60 ≈
  575px` (74% of 780) → article slice ~205px (~26%) — smaller but still a meaningful slice (the #135
  9:16 case was ~32%; the two rows trim it to ~26%, still multiple lines + heading), and far under
  the `88dvh` ceiling. The 9:16 + **expanded-note** stress case is unchanged in kind: the note panel
  (capped `max-h-[min(40vh,320px)]`) scrolls **inside the secondary region**; the frame + title bar +
  control strip + action row stay pinned `shrink-0`, so the dock is bounded and the frame stays
  visible.
- **88dvh bound + ≥12dvh article slice still hold.** The `max-height: calc(88dvh − insets)` ceiling
  (#135 §2.6) is **unchanged** — the new rows are `shrink-0` content *under* the cap, so the cap still
  guarantees ≥12dvh of article. When the cap engages, the **secondary region is still the sole scroll
  area**; the two new rows never scroll and never give way (they are `shrink-0`), and neither does the
  frame — exactly the corrected fit invariant. The reported dock height (`onDockMetrics.height`) now
  **includes the two new rows**, so the measured page spacer (#135 §3) reserves the correct (larger)
  amount automatically — no spacer math change needed beyond the height being measured, not guessed.

**Label overflow / wrapping at narrow width.**
- **Control strip:** "Maximize" + "Move to top" + two ~16px icons + padding ≈ 200px of content —
  fits one line at 360px with room. The strip is `flex-row` with a `gap`; if a future longer label
  overflowed, the strip may `flex-wrap` to two stacked full-width ghost buttons (acceptable, adds one
  ~44px row — still inside the cap). Design for the **single-row default**.
- **Action row:** Curate `flex-1` + Not relevant intrinsic fits at 360px ("✦ Curate" + "✕ Not
  relevant" ≈ 230px). If a future longer dismiss label overflowed, the row may `flex-wrap` to two
  stacked full-width buttons (Curate on top) — the same #123 §6 rule. Both buttons keep `min-height:
  44px`. The logged-out single CTA is full-width at every in-scope width.
- **In-scope widths 360 / 390 / 414 / 430:** all hold (the 16:9 slice grows with width as `F` does;
  the two rows are width-independent ~48px each). The catalog 390×850 capture shows a larger slice
  than the 780px stress numbers.

---

## 9. Component-orientation hand-off for the mobile Dev pass (orientation only — Dev owns code)

This folds into the **#123 PR's mobile portion**. The Dev agent owns `MobilePlayerDock.tsx`,
`TopicView.tsx`, `CandidateBits.tsx`, the timeless docs, `test/`, and `e2e/screenshots/catalog.ts` —
this spec is its input, not an edit.

**`components/topic/MobilePlayerDock.tsx`:**
- **Title bar:** **remove the Maximize and Move buttons** from the title-bar controls row; **keep only
  ✕ Close** there. With one button, drop the narrow-width `sr-only` word logic (the
  `wordClass = "sr-only sm:not-sr-only …"` branch) for Close — **show Close's word visibly** at all
  widths (the text budget no longer applies). (The `showWords`/`wordClass` machinery for the removed
  Maximize/Move buttons goes away with them.)
- **Add a `shrink-0` control strip below the frame:** **Maximize** + **Move**, full text +
  conventional icon (§3.2 SVGs / glyph fallbacks), ≥44px, **ghost/outline (white-fill, 2px ink
  border, ink text)** weight (§7). Maximize toggles `maximized` and relabels to **Exit** (CSS-only,
  never `requestFullscreen` — unchanged behavior, just relocated). Move calls the existing
  `toggleEdge` and names the destination (`▲ Move to top` / `▼ Move to bottom`).
- **Add a `shrink-0` curation action row below the control strip**, reusing the **desktop #123
  treatment**:
  - signed-in **candidate**: `✦ Curate` (brand, `flex-1`) + `✕ Not relevant` (quiet) — labels/aria
    per §5 / #123 §3.3 verbatim.
  - logged-out: the single CTA (candidate `✦ Curate this video` / curated join nudge) — moved from
    the secondary region into this action-row slot (§2, §5 State J).
  - signed-in **curated**: **#65 vote/manage in this slot if it exists, else nothing** — do **not**
    render Curate/Not relevant for a curated clip (§5).
- **Maximized mode:** hide the control strip's **Move** and the action row; keep **Exit** (relabeled
  Maximize) **and Close** in the condensed thin top bar (credit caption · ⛶ Exit · ✕ Close), words
  visible (§4). The secondary region stays hidden maximized (unchanged).
- **`onDockMetrics` height accounting:** the reported `height` now naturally includes the two new
  `shrink-0` rows (the `ResizeObserver` measures the whole root) — **no formula change**, but Dev
  should confirm the spacer reserves the larger height (it will, because the measurement is of the
  real rendered root). Keep `docked:false`/`height:0` while maximized.
- **Candidate match reason:** keep in the secondary region (below the action row), one line (§2).

**`app/topic/TopicView.tsx`:**
- Wire the mobile dock's **`onCurate` → `promote(playingCandidate)`** and a **new `onDismiss` →
  `dismiss(playingCandidate)`** (both handlers already exist; the desktop #123 pass adds the same
  `onDismiss` wiring — mirror it for the mobile dock). After a player-driven **dismiss**, **close the
  dock** (drop the `mobileDock` state) and run `focusBandHeading()`, reusing `runDismiss`'s
  optimistic-hide-with-rollback (= #123 §8, mobile sibling). After a successful **curate**, close the
  dock the same way (State K). No new gate kinds, no #45 change.
- The dock's new `onDismiss` is candidate-only (a curated clip's "act" is #65 vote/manage, not
  dismiss) — pass it only for `kind="candidate"`.

**`e2e/screenshots/catalog.ts` — scenes to add/adjust (Dev applies):**
- Adjust the existing `mobile-player-candidate` and `mobile-player-curated` scenes — they now show the
  control strip + action row below the frame (the headline evidence for owner decisions 1+2).
- **New scenes (recommended):**
  - `mobile-player-candidate-signedin` — signed-in candidate: control strip + **✦ Curate / ✕ Not
    relevant** action row (the new signed-in mobile curation actions).
  - `mobile-player-controls` (or fold into the above) — a readable crop of the control strip showing
    the conventional Maximize + Move icons + words.
  - the existing `mobile-player-maximized-*` scenes confirm Exit + Close survive in the thin bar (§4).
- Refresh the committed baseline gallery (`docs/design/ui-screenshots/`) in the same PR (the mobile
  player surface changes): `scripts/dev/shots.sh --group "Players · mobile unified" --commit ui`
  (or `--all --commit ui` if the shared change ripples), and attach a focused subset to the PR with
  `--scene mobile-player-candidate-signedin,mobile-player-candidate,mobile-player-curated --pr 123`.

**Timeless-doc edits — apply during the Dev pass (INSTRUCTIONS; do NOT pre-edit these here):**
- **`docs/TOPIC_PAGE_DESIGN.md`** — in the mobile player description, state the **current** design
  (no history cruft): *"On mobile the player's adjust-the-player controls — **Maximize** and **Move
  to top/bottom** — sit on a labeled control strip directly below the frame (full word + a
  conventional fullscreen / chevron icon, ≥44px); the title bar carries only **✕ Close**. Below the
  control strip, the candidate player carries the curation **action row** — **Curate** (brand
  primary) and **Not relevant** (quiet secondary), or, logged out, a single **Curate this video**
  CTA — mirroring the desktop in-player curation model. A curated clip's action is its vote/manage,
  not Curate/Not relevant."* Do not narrate the move from glyphs to words.
- **`docs/design/unified-player-mobile.md` (#120) + `docs/design/mobile-player-launch.md` (#135)** —
  update the controls description to state the **current** arrangement: Maximize and Move are a
  **below-frame control strip** (not title-bar glyphs); the title bar holds **Close only**; the
  **conventional icons** (corner-expand fullscreen / directional chevron) replace `⤢`/`⤒`/`⤓`; the
  signed-in **curation action row** sits between the control strip and the secondary region. Update
  the §10 microcopy table: drop the `⤢`/`⤒`/`⤓` glyphs, set Maximize/Exit to the corner-expand icon
  + word, Move to the chevron + "Move to top/bottom"; add the action-row strings (`✦ Curate`, `✕ Not
  relevant`, the logged-out CTAs in the action-row slot). State current design; do not narrate the
  change. The dock-height budget note should mention the two new `shrink-0` rows (~96–104px) under
  the unchanged `88dvh` cap.

---

## 10. Acceptance-criteria → design map (the mobile portion of #123, + the owner decisions)

| Criterion | Satisfied by |
|---|---|
| Maximize + Move read clearly + are comfortably tappable on a phone (owner decision 1) | §2/§3 control strip below the frame, words + ≥44px ghost buttons, off the cramped title-bar cluster |
| Conventional icons + words; obscure `⤢`/`⤒`/`⤓` dropped; Maximize↔Exit (owner decision 2) | §3.2 (corner-expand fullscreen SVG/`⛶`, directional chevron SVG/`▲▼`), §3.1 labels |
| Mobile dock gains signed-in **Curate / Not relevant**, same #123 treatment + labels verbatim (owner decision 3) | §5 State I (= #123 §3.3), §7 weights, §9 wiring |
| Logged-out single Curate CTA, no Dismiss | §5 State J (= #123 §5 State J) |
| Post-dismiss = dock CLOSES + focus → band heading | §5 State L (= #123 §5 State L / §7), §9 wiring |
| Curated "act" = #65 vote/manage, not Curate/Dismiss (don't build voting) | §5 curated-kind, §9 |
| 88dvh bound + ≥12dvh article slice hold with the added rows; frame still fully visible on open | §8 fit math (`D ≈ 419–435px` @780 16:9 → ~44–46% slice; 9:16 → ~26%; cap unchanged; frame `shrink-0`) |
| Non-modal contract, real tabbable buttons, tab order, focus-visible, AA, never color-alone, no focus-steal, maximize ≠ modality | §6 in full |
| Chrome quieter than the brand action (IP-7) | §7 (ghost chrome < brand-fill Curate) |
| Move wording fixed (IP-6) | §3.3 ("Move to top"/"Move to bottom") |
| Baselines refreshed | §9 catalog + gallery instructions |

---

## 11. Hand-off

- **To Development (the #123 mobile pass):** build per §2–§8. In `MobilePlayerDock.tsx`: remove the
  title-bar Maximize/Move buttons + their `sr-only` word logic; show Close's word; add the below-frame
  **control strip** (Maximize · Move — conventional icons §3.2, ghost weight §7) and the **curation
  action row** (signed-in candidate `✦ Curate` + `✕ Not relevant`; logged-out single CTA; curated =
  #65 vote/manage-or-absent); keep Maximize CSS-only with Exit in the maximized thin bar (§4). In
  `TopicView.tsx`: wire the dock's `onCurate`→`promote` and a new `onDismiss`→`dismiss`, close the
  dock + `focusBandHeading()` after a player dismiss (and a successful curate), reusing `runDismiss`
  (no #45 change). Ship §3/§5/§7 microcopy verbatim. Add the catalog scenes + refresh the gallery
  (§9). Apply the §9 timeless-doc edits stating the current design (no history cruft).
- **To QA & Review + UX evaluation:** verify against §10 and the §5 state table — Maximize/Move read
  clearly on the control strip with conventional icons + words; Curate/Not relevant present + gated
  for signed-in, single CTA + no Dismiss logged out; player dismiss closes the dock + focus lands on
  the band heading; Exit + Close reachable in maximized mode; the `88dvh` bound + ≥12dvh article slice
  hold at 360/390px and the 780px stress viewport with the two added rows (frame fully visible on
  open); the §6 non-modal/keyboard/AA/never-color-alone contract holds; the chrome strip reads
  quieter than the brand Curate action (§7).
