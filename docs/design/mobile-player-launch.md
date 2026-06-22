# Design spec — Mobile video player launch (video-first, fully visible on open)

**Issue:** [#135](https://github.com/ragesoss/wikiplus/issues/135) · **Role:** UX / Design ·
**Status:** design spec (written *before* Dev) · **Corrects:** [#120](https://github.com/ragesoss/wikiplus/issues/120)
`docs/design/unified-player-mobile.md` (§5 DOM order, §6 sizing / "fit guarantee", §6.6 spacer,
§13 AC→design map) · **Builds from:** `docs/specs/mobile-player-launch.md` (AC-1…AC-10 + the
resolved open question) · **Feeds:** Development (build), QA & Review + UX (evaluation).
**Companion:** `docs/VISUAL_IDENTITY.md` (Indigo Press), `docs/CURATION_STANDARD.md` §5.2
(creator credit) + the §"load-bearing rule" (creator credit ≠ curator attribution).

This is the buildable contract for the **corrected launch / docked layout** of `MobilePlayerDock`
(mobile, `< lg`). It is **not** a redesign of the unified player. It keeps every #120 invariant —
the personas (§1), the user stories (§2), the non-modal contract (§9 of #120), the microcopy (§10
of #120), the swap / park / maximize behavior — and changes **only** the launch/docked arrangement
so that **the video frame is the hero and is fully visible on open**, the dock is **genuinely
bounded** (no `100dvh`), and a meaningful slice of the article stays visible.

> **What this corrects.** #120 shipped the dock with the **video frame as the LAST child** of an
> `overflow-y-auto` body, **under** a stack of chrome (a title bar with three vertically-stacked
> buttons, then the chips + "Context ▸", then a full-width CTA), capped at `100dvh`, with the
> `TopicView` spacer a fixed `h-[min(60vh,500px)]` guess. The reader tapped a video and landed on
> *metadata and a button*, with the picture pushed below the fold. This spec re-orders the dock to
> **frame-first**, slims the launch chrome, moves the CTA below the frame, replaces the `100dvh` cap
> with a real content-bounded cap, and ties the page spacer to the dock's **actual** height.
>
> **What this does NOT change** (preserved invariants — read #120 for the full text, do not
> re-derive): the non-modal a11y contract (§9 of #120), maximize-on-rotate (§6.3–§6.6 of #120),
> the park toggle mechanics (§7 of #120), the embed facade, swap-in-place, the curated⇄candidate
> parameterization (§5.2 of #120), the microcopy strings (§10 of #120), and **desktop** (untouched).
> Where this spec is silent on a behavior, **#120 governs.**

---

## 0. Personas & stories (reconciled, not re-authored)

The personas and stories are **`docs/design/unified-player-mobile.md` §1–§2, unchanged**. This spec
corrects *what they get on open*. The stories this launch correction directly serves, mapped to the
Product AC:

- **S1** — *Priya taps any video and watches it right here, in a frame that fits, to judge it
  against the article.* The #120 launch broke S1 (frame pushed below the fold). → **AC-1, AC-3, AC-5**
- **S2** — *the player stays put while she scrolls / reads, and never covers the part she's looking
  at.* The dock must be bounded so a real article slice remains. → **AC-2**
- **S5** — *a clear, always-reachable way to close.* Close stays on-screen at launch. → **AC-2**
- **S6** — *creator credited; one-tap full note that never crowds the article off-screen.* Credit at
  launch; note behind the collapsed expander. → **AC-3, AC-4**
- **S7** — *the right invitation in the right place, after watching.* CTA below the frame. → **AC-3**
- **S8/S9/S10** — *the non-modal a11y contract.* Preserved verbatim from #120 §9. → **AC-6**

---

## 1. The corrected launch / docked layout

### 1.1 The core inversion — frame-first, not frame-last

The single change that fixes the regression: **the video frame is the first/primary region of the
dock, sitting directly against the un-parked edge (toward the article), with only a slim title bar
between it and the parked edge. Everything else — chips strip, "Context ▸", the CTA — is *secondary*
and sits on the far side of the frame from the article, in a bounded region that may scroll within
the dock without ever moving the frame.**

Concretely, the dock is a fixed-height flex **column** pinned to one edge (default **bottom**, §7 of
#120). Reading order and visual stacking, **bottom-parked** (the default):

```
  ── (article visible above the dock — AC-2) ──
┌──────────────────────────────────────────────────────────┐  ← dock root: <section aria-label="Video player">
│ SLIM TITLE BAR (shared, pinned)              [⋯ controls] │     ink #2C2C2C, white (AA); shrink-0
│   ＋plus · caption (clamp-1) · handle · platformLabel     │   ← credit present at launch (AC-4)
├──────────────────────────────────────────────────────────┤
│ VIDEO FRAME — THE HERO (shared, pinned)                   │     black backing; orientation-sized (§2)
│   <iframe …> fully visible, no internal scroll to reach   │   ← AC-1: whole frame box in viewport
├──────────────────────────────────────────────────────────┤
│ SECONDARY STRIP (parameterized, scrolls within the dock)  │     curated: chips · "Context ▸"; candidate:
│   curated → chips (one line) · "Context ▸"                │       match reason; logged-out → CTA below
│   candidate → match reason (one line)                     │       (the bounded scroll region — §2.4)
│   (logged-out) → CTA: "✦ Curate this video" / join nudge  │
└──────────────────────────────────────────────────────────┘  ← dock pinned to the viewport bottom edge
```

**Top-parked** mirrors this: the dock pins to the **top** edge, the **slim title bar is still the
edge-most row** (against the top edge, under the safe-area inset), the frame sits below it, and the
secondary strip is below the frame — i.e. the *visual top-to-bottom order is identical regardless of
edge*; only which viewport edge the whole bar hugs changes. (This is simpler than mirroring the
internal order and keeps the credit + controls always at the bar's leading edge.)

### 1.2 Why this order satisfies the ACs

- **AC-1 (whole frame visible, no internal scroll to reach it).** The frame is the **second** region
  from the parked edge, preceded only by the slim title bar (`shrink-0`, ~64px). The frame itself is
  `shrink-0` (it is never the flex item that shrinks or scrolls). The dock's total height is capped at
  `title + frame + a small secondary slice` (§2.5) — a value provably `< VH` at every in-scope width
  for both aspects — so the frame is fully on-screen the instant the dock opens, never clipped.
- **AC-2 (article slice stays visible).** Because the cap is content-bounded (not `100dvh`), the dock
  occupies roughly **40–55% of the viewport height** at launch (§2 budget), leaving the rest of the
  viewport showing the article at the un-parked edge. The `TopicView` spacer reserves exactly the
  dock's **actual** height at the parked edge so the article can also be scrolled fully clear (§3).
- **AC-3 (minimal, video-first chrome).** Launch chrome above the frame is **only** the slim title
  bar (one compact controls row, not three stacked buttons). The chips are a **one-line strip below
  the frame**; the full note stays behind the collapsed **"Context ▸"**; the CTA is **below the
  frame** in the secondary region. The eye lands on the picture.
- **AC-4 (creator credit at launch).** The credit lives in the **slim title bar** (`handle ·
  platformLabel`), present in every state including collapsed launch — see §1.4.
- **AC-5 (candidate parity).** Identical column; the candidate's secondary strip is its one-line
  match reason + (logged-out) the "✦ Curate this video" CTA, both below the frame.

### 1.3 What "minimal launch chrome" is (the concrete reductions)

The #120 launch chrome is too heavy. The corrected launch chrome:

1. **Collapse the three stacked title-bar buttons into one compact control row.** #120 stacks
   Maximize / Move / Close vertically (`flex-col items-end gap-1`), which both bloats the title-bar
   height and reads as a control panel. **Replace with a single horizontal row** of the three
   controls (`flex-row items-center gap-1`), right-aligned, each a compact text+glyph button (44px
   min touch target preserved via padding, but laid out inline). At the in-scope widths the caption
   is `line-clamp-1` and `truncate`s, so the title text never wraps under the controls.
2. **Slim the title bar.** Two text lines: line 1 = `＋plus` eyebrow inline-prefixed to the caption
   (or eyebrow as a small superscript-weight tag, then caption) on one clamped line; line 2 = the
   creator credit. The controls row sits to the right, vertically centered against the two text
   lines. Target title-bar height **~56–64px** (down from ~80–96px when buttons stack and the eyebrow
   takes its own line). The eyebrow may share line 1 with the caption to save a line.
3. **Chips are a compact one-line strip** (curated), placed **below the frame** (the secondary
   strip), not above it. They `flex-nowrap` on one line and may horizontally scroll if a held marking
   + two chips overflow a 360px width (rare); they never stack into multiple rows at launch.
4. **The full note stays behind the collapsed "Context ▸"** (curated) — never expanded on open
   (unchanged from #120 §5.3, but now positioned below the frame).
5. **The logged-out CTA moves below the frame** — reading-order *after* the frame and after the
   chips/Context affordance, in the secondary region. It is never above the frame at launch.

### 1.4 Where the creator credit lives (AC-4)

The **creator credit `handle · platformLabel`** stays in the **slim title bar**, on the second text
line (muted white `text-white/70`, `truncate`). It is therefore present in **every** state —
collapsed launch, expanded note, top-parked, candidate, no-embed, and (as a caption) both maximized
states. This satisfies the CC BY-SA non-negotiable that creator attribution rides every clip surface
(CURATION §5.2). The curator **"context by"** attribution remains one tap away inside the expanded
note (curated) — it is distinct from the creator credit per the CURATION §"load-bearing rule"
(creator credit points *out* to the platform; "context by" points *in* to the curator's wiki+
profile), and the collapsed state correctly carries the **creator** credit because *that* is the
CC BY-SA attribution that must be ever-present.

---

## 2. The dock-height budget (concrete numbers)

This section makes "the whole frame fits and the article still shows" a **property of the layout**,
not a hope. All numbers are for the **in-scope portrait widths 360 / 390 / 414 / 430 px**. The fit
e2e stresses a **780px-tall** viewport (the catalog mobile viewport is 390×850; QA may also
spot-check shorter). `VW` = visual-viewport width, `VH` = visual-viewport height, with the
`env(safe-area-inset-*)` reserved.

### 2.1 Chrome heights at launch (collapsed)

| Region (launch, collapsed) | Height | Notes |
|---|---|---|
| Slim title bar `T` (pinned) | **~60px** | 2 text lines (eyebrow+caption / credit) + the one-row controls, `py-2`; `shrink-0` |
| Chips strip (curated, below frame) | ~32px | one line; part of the secondary region |
| "Context ▸" row (curated, below frame) | ~28px | one line; part of the secondary region |
| Match reason (candidate, below frame) | ~34px | `line-clamp-2`; part of the secondary region |
| Logged-out CTA (below frame) | ~52px | 44px target + margin; part of the secondary region |

The **above-frame** launch chrome is **only `T` (~60px)**. Everything else is **below** the frame.

### 2.2 Frame height `F` — 16:9 horizontal (full-width `aspect-video`)

`F = VW × 9/16`:

| Width | `F` (16:9) |
|---|---|
| 360 | 203px |
| 390 | 219px |
| 414 | 233px |
| 430 | 242px |

### 2.3 Frame height `F` — 9:16 vertical (height-capped, centered, letterboxed)

A Short must not tower. Cap the **frame height** at **`min(46vh, 380px)`**, frame `aspect-ratio: 9/16`,
`mx-auto`, letterboxed on black within the full-width bar. (This trims #120's `min(45vh,420px)`
slightly so that, combined with the slim title bar and a one-line secondary strip, the whole dock
clears the 780px viewport with room for the article slice — see 2.5.) At a 780px viewport,
`46vh = 359px` → frame **height 359px**, width `359 × 9/16 ≈ 202px`, centered. At 850px (catalog),
`46vh = 391px` capped only by the `380px` arm → **height 380px**, width ≈ 214px.

### 2.4 The bounded secondary region (what may scroll, and what never does)

The dock is a flex column: **`[slim title bar: shrink-0]` → `[frame: shrink-0]` → `[secondary
region: flex-1 min-h-0 overflow-y-auto]`**. The **title bar and the frame are both `shrink-0`** — they
are never the element that scrolls or clips. The **secondary region** (chips / Context / match reason
/ CTA, and the expanded note) is the **only** `overflow-y-auto` area, with `flex-1 min-h-0`. This is
the inversion of #120, where the *frame* was the last child of the scroll area and got clipped.

At launch the secondary region's content (one chips line + Context row, or a 2-line match reason,
plus the CTA when logged out) is short — it shows in full without scrolling at every in-scope width
(see 2.5). The scroll behavior exists for the **expanded-note** case and any pathologically short
viewport: when "Context ▸" is expanded, the full note panel scrolls **inside the secondary region**
(its own bounded `max-h-[min(40vh,320px)]` per #120 §5.3), the **frame stays its size and stays
visible**, and the title bar stays pinned. Close / Move / Maximize are in the pinned title bar, so
they are **never** pushed off-screen.

### 2.5 Total dock height and the article slice — the budget, by case

Total docked height `D = T + F + S`, where `S` is the at-launch secondary-region height. The cap
(2.6) bounds `D`; here is what `D` actually is at launch, and the article slice `VH − D` it leaves,
at the **stressing 780px** viewport:

**Curated, logged out** (heaviest: `S` = chips ~32 + Context ~28 + CTA ~52 = ~112px):

| Width | `T` | `F` (16:9) | `S` | `D` (16:9) | article slice (780−D) | `F` (9:16) | `D` (9:16) | slice |
|---|---|---|---|---|---|---|---|---|
| 360 | 60 | 203 | 112 | **375px** | **405px (52%)** | 359 | **531px** | **249px (32%)** |
| 390 | 60 | 219 | 112 | **391px** | **389px (50%)** | 359 | **531px** | **249px (32%)** |
| 414 | 60 | 233 | 112 | **405px** | **375px (48%)** | 359 | **531px** | **249px (32%)** |
| 430 | 60 | 242 | 112 | **414px** | **366px (47%)** | 359 | **531px** | **249px (32%)** |

**Candidate, logged out** (`S` = match-reason ~34 + CTA ~52 = ~86px): `D` is ~26px *less* than the
curated row above at each width; article slice correspondingly larger.

**Signed in** (no CTA): `S` drops by ~52px; `D` smaller still.

**Reading of the budget:**
- **AC-1.** In every row the **frame box** (`T`-offset … `T+F`) is entirely within `[0, VH]` — the
  largest `T+F` is `60 + 380 = 440px < 780`. The frame is `shrink-0`, so it is never compressed or
  scrolled. ✔
- **AC-2.** The smallest article slice is the **9:16 case at 32% of the viewport (~249px)** — a
  *meaningful* slice (multiple lines of article text + the section heading visible), not a sliver. The
  16:9 case leaves ~47–52%. The dock never approaches `100dvh`. ✔
- The **9:16 + expanded-note** case is the true stress: even there, `T (60) + F (359, fixed) +
  expanded-note panel (capped, scrolls) ≤ cap`, and the note panel — not the frame — is what scrolls,
  so the frame stays fully visible and the title bar stays pinned (AC-1 holds; the panel's own
  `max-h` keeps `D ≤ cap`).

### 2.6 The CSS cap / strategy that guarantees fit (NOT `100dvh`)

Replace #120's `maxHeight: calc(100dvh − insets)` with a **content-bounded cap that always leaves an
article slice**:

```
max-height: calc(88dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
```

- **`88dvh`, not `100dvh`.** This guarantees ≥ **12dvh of article always visible** at the un-parked
  edge even in a degenerate case where content would otherwise want the whole screen — the dock can
  *never* fill the viewport. It is a **ceiling**, not the normal height: at every in-scope width the
  *content* height `D` (2.5) is far below `88dvh` (the largest `D ≈ 531px` is 68% of 780, well under
  88%), so the dock normally sizes to its content and the cap only ever engages on a pathologically
  short viewport or a very long expanded note — and even then it bounds the dock and the **secondary
  region scrolls inside it** (2.4) while the frame + title bar stay pinned and visible.
- **`dvh`** (dynamic viewport height) so the cap tracks the *visual* viewport as mobile browser
  chrome shows/hides — the dock never gets clipped by a retracting URL bar.
- **The frame is `shrink-0`; the secondary region is the sole scroll area** (2.4). So when the cap
  *does* engage, the element that gives way is the secondary region (note/chips), **never** the frame
  and **never** the title bar. This is the corrected fit invariant: the cap protects the article
  slice *and* the frame, simultaneously.

> **Dev note — why a cap *and* `shrink-0` frame both.** The `88dvh` cap bounds the dock from above
> (AC-2 article slice). The `shrink-0` on the frame + the `overflow-y-auto` on the secondary region
> guarantee that, within whatever height the dock has, the **frame is the protected region** and only
> the secondary content scrolls (AC-1 frame fully visible). Neither alone is sufficient: a cap with a
> shrinkable frame would clip the video (the #120 bug); a `shrink-0` frame with a `100dvh` cap would
> let a long note fill the screen (no article slice). Both together is the contract.

---

## 3. The `TopicView` page spacer — tied to the dock's *actual* height (edge-aware)

#120 reserves a **fixed `h-[min(60vh,500px)]`** guess at the parked edge — decoupled from the dock's
real height, so it over- or under-reserves. Replace it with a spacer equal to the dock's **measured
actual docked height**, edge-aware:

- **Mechanism.** The dock measures its own rendered height (a `ResizeObserver` on the dock root, or
  the dock reports its height up alongside the existing `onEdgeChange` — e.g. an `onHeightChange(px)`
  callback, or a single `onDockMetrics({ edge, height })`). `TopicView` stores `dockHeight` and
  renders the spacer at **exactly that height** (+ the relevant safe-area inset) at the parked edge:
  - **Bottom-parked:** `padding-bottom` (or a bottom spacer `div`) of `dockHeight + env(safe-area-inset-bottom)`.
  - **Top-parked:** `padding-top` (or a top spacer `div`) of `dockHeight + env(safe-area-inset-top)`.
- **Why measured, not fixed.** The dock height varies by kind, aspect, logged-in/out, and whether the
  note is expanded (2.5). A fixed `60vh` over-reserves for a short candidate dock and under-reserves
  for an expanded curated dock — leaving either dead space or a still-hidden last section. Measuring
  ties the reserved space to what's actually on screen, so the article can always be scrolled fully
  clear of the bar and there is no dead gap.
- **Updates live.** The spacer height updates when the dock's height changes (expand/collapse the
  note, swap to a different-aspect clip, park to the other edge). It is **removed on dismiss**
  (`mobileDock → null`) so the page reflows to full height (#120 §8 "dismissed").
- **Maximized needs no spacer** (it covers everything by design and restores on exit) — unchanged.
- **Reduced-motion / layout-shift note.** The spacer is the **one intentional, additive** layout
  shift, only while the dock is open and only at the parked edge (#120 §6.6). Tying it to the
  measured height does not add shifts; it makes the single existing shift correctly sized.

> **Dev note — fallback if measurement isn't wired in time.** If a `ResizeObserver`/report path is
> deferred, the spacer must still be **bounded to the dock budget, not 60vh**: use `h-[min(56vh,460px)]`
> as a static fallback that matches the *upper* end of the launch budget (2.5) so it never
> under-reserves. The measured path is preferred (no dead space); the static fallback must not be
> larger than the dock can be.

---

## 4. Every state (fit guarantee + credit confirmed)

Each state below reaffirms: **(a)** the whole frame box is within the viewport with no internal
scroll to reach it (AC-1), and **(b)** the creator credit is present (AC-4). States not re-described
here are **unchanged from #120 §8** and governed by it.

### Collapsed (default launch) — curated
- **Order:** slim title bar (credit) → frame (hero) → chips strip → "Context ▸" → (logged-out) CTA.
- **Fit:** `D` per 2.5 (375–414px @780, 16:9); frame fully visible; article slice 47–52%. **Credit:**
  title bar. The note is **not** expanded.

### Collapsed (default launch) — candidate
- **Order:** slim title bar (credit) → frame (hero) → match reason (one line) → (logged-out) "✦ Curate
  this video". **Fit:** `D` ~26px less than curated; frame fully visible. **Credit:** title bar.
- A candidate only opens the dock with an `embedUrl`; the no-embed candidate falls through to
  `window.open(watchUrl)` unchanged (#120 §8, AC-5).

### Expanded note (curated)
- **Trigger:** tap "Context ▸". The note panel (light surface, `text-ink2`, 2px ink border) + "context
  by" appear **in the secondary region, below the frame**, scrolling inside `max-h-[min(40vh,320px)]`
  (#120 §5.3). **The frame stays its size and stays fully visible** (it is `shrink-0`); the title bar
  stays pinned. `D` may approach the cap; the **note panel scrolls**, never the frame. **Credit:**
  title bar; **"context by":** at the end of the expanded note (distinct from the credit, §1.4).

### Vertical (9:16)
- Frame height-capped at `min(46vh,380px)`, centered, letterboxed (2.3). `D` per 2.5 (531px @780);
  frame fully visible; article slice ~32% (the smallest, still meaningful). **Credit:** title bar.

### No-embed (curated, no `embedUrl`)
- Frame area shows **"This clip can't be embedded."** (white on black, verbatim) in the frame's box;
  the secondary region (chips / Context / note) still renders below it. Same order, same cap. **No
  `src`-less iframe.** Frame box (the message panel) fully visible. **Credit:** title bar. (#120 §8.)

### Swap (A → B, either kind)
- The **same** dock + iframe; payload changes in place; the secondary region resets to **collapsed**;
  if B's aspect differs the frame resizes per §2 within the same column; `D` re-derives; the spacer
  re-measures (§3). Frame fully visible after the swap. **Credit:** title bar. (#120 §8.)

### Maximized (horizontal / vertical) — **kept from #120, not redesigned**
- Unchanged: the **same `<section>` + same iframe** flip to `fixed inset-0` via CSS (never
  `requestFullscreen`); chrome condenses to a thin Close bar with the credit as a caption; the
  secondary region + park toggle are hidden (#120 §6.3/§6.4). **Credit:** the thin-bar caption (AC-4
  holds in both maximized states). The launch-budget cap (§2.6) does **not** apply while maximized
  (maximized is `inset-0` by intent). **Reference #120 §6.3–§6.6 for the full maximize spec; this
  spec does not change it.**
- **AC-7 open-seed sanity (verification, not a redesign):** on open in **portrait**, a clip (either
  kind, either aspect) opens **docked**, not maximized — confirm the mount-time
  `setMaximized(mq.matches)` seed does not mis-open a portrait clip maximized. (The maximize on actual
  rotation to landscape is unchanged.)

### Top-parked
- The whole dock hugs the **top** edge (under `safe-area-inset-top`); internal order is **identical**
  to bottom-parked (§1.1): slim title bar (edge-most) → frame → secondary region. The page reserves
  `padding-top = dockHeight` (§3) so the article's top isn't permanently hidden. Frame fully visible;
  article slice below the dock. **Credit:** title bar. Park toggle reads "Move to bottom".

### Idle / loading / dismissed — unchanged (#120 §8).

---

## 5. Responsive behavior

- **In-scope portrait widths 360 / 390 / 414 / 430 px:** the budget (§2.5) holds at all four — frame
  fully visible, article slice 47–52% (16:9) / ~32% (9:16). The frame is `aspect-video` (16:9) or
  height-capped+letterboxed (9:16); the title bar's `line-clamp-1` caption + inline controls row never
  wrap at 360px (the narrowest).
- **Catalog mobile viewport (390×850):** `46vh = 391px`, so the 9:16 frame caps at the **380px** arm;
  `D` and the slice are slightly larger than the 780px stress numbers (more article shows). The
  baseline screenshots are captured here.
- **Tablet (`md`, e.g. 834px) within `< lg`:** the dock is still the mobile dock (mobile = `< lg`).
  The 16:9 frame is `834 × 9/16 = 469px` — taller, but `D = 60 + 469 + 112 ≈ 641px`; against a 1000px
  catalog tablet height that is 64%, still leaving a 36% article slice and well under the `88dvh` cap.
  The 9:16 frame stays capped at `min(46vh,380px)`. Fit holds.
- **Portrait vs. landscape (the note for #120 maximize):** in **portrait** the dock is **docked** per
  this spec (the launch correction). In **landscape**, #120's **maximize** governs (the dock fills the
  viewport, condensed chrome) — that is out of scope here and unchanged. This spec's budget is the
  **portrait docked** budget; landscape is maximize's domain.

---

## 6. Accessibility

The **non-modal contract is preserved verbatim from #120 §9** — restated here so Dev/QA do not have to
cross-reference for the launch state, and with the a11y of the newly-arranged controls called out:

- **Labeled, non-modal region.** `<section aria-label="Video player">` — **not** a dialog, **no**
  `aria-modal`, **no** focus trap, **no** backdrop, **not** routed through `ModalShell`. Unchanged.
- **No focus steal on open.** Opening the dock does **not** move focus; no autofocus; the originating
  play button keeps focus. **Re-ordering the DOM (frame-first) does not change this** — the dock still
  mounts with no `.focus()`. Unchanged.
- **Reading / tab order with the new layout.** DOM order is **title-bar controls → frame → secondary
  region (chips/Context/CTA)**. So Tab reaches **Close / Move / Maximize first** (they are at the top
  of the dock and the start of the dock's tab order), then the frame's embed, then the "Context ▸"
  expander and the CTA below. This is a sensible order: the always-needed controls (Close especially)
  are reachable first; the secondary affordances come after the video. **Tab is never trapped** —
  focus flows into and out of the dock like any region.
  - *Note:* although the **CTA is visually below the frame**, it is still a real `<button>` in normal
    tab order, reachable after the frame — it is **secondary, not unreachable**. Screen-reader users
    encounter caption → credit → controls → video → chips → Context → CTA, a coherent narration.
- **Keyboard Close / Move / Maximize / Context.** All real `<button>`s, Enter/Space operable, each
  with the global `:focus-visible` ring (`3px solid var(--color-brand)`). The **collapsed controls
  row** (the one reduction this spec makes) keeps each as a separate focusable button with its own
  44px target — collapsing them into one *row* does **not** merge them into one control.
- **Focus return.** On **keyboard** Close (focus was in the dock), focus returns to the **General band
  heading** (the existing `focusBandHeading()` anchor); on **touch** Close, focus is left where it is.
  Park toggle: focus **stays on the toggle**. Context expander: focus stays on the expander,
  `aria-expanded` flips, `aria-controls` points at the note panel. Unchanged from #120 §9.
- **AA + text-labeled signals (never color/position alone).** White-on-`ink` chrome (≈15:1); Close =
  `✕` glyph **and** the word "Close"; Move / Maximize / Context each carry their word; chips carry
  their `sr-only` words; the expanded note is `text-ink2` on white. **No gold.** The 2px ink border
  carries the dock boundary at the viewport edge (no offset shadow on mobile — it would clip). The
  **chips-strip and the CTA, now below the frame,** keep their existing AA treatments unchanged
  (`StanceChip`/`AccuracyChip` dark fills; brand-fill CTA with the white-on-brand bold word + 2px ink
  border; the join nudge ink-on-white). Position below the frame is **not** a signal — the word on
  each control carries the meaning.
- **Reduced motion.** The dock-in, the park move, and any maximize transition stay gated by
  `prefersReduced` (#120 §9). The frame-first re-order introduces no new animation. Unchanged.
- **z-index.** Dock at `z-40`, below the app modals at `z-50` (a `CurateModal`/`AddModal` from a CTA
  correctly covers the dock). Unchanged.

---

## 7. Screenshot-catalog note (for Dev to refresh the baseline)

The catalog `e2e/screenshots/catalog.ts` already has the mobile-player scenes. The **launch re-order
changes how every docked mobile-player scene *looks*** (frame now first/hero; chips + Context + CTA
now below the frame; slimmer title bar with the inline controls row), so these existing scenes must be
**re-rendered**; the helpers and IDs do not need to change. The maximized scenes are visually
unchanged (maximize is untouched) but will re-render harmlessly in a `--all` pass.

**Scenes that change (re-render the baseline):**

- `mobile-player-curated` — curated, collapsed: now **frame-first**, slim title bar above, chips +
  "Context ▸" (+ logged-out join nudge) **below** the frame. (The headline evidence for AC-1/AC-3.)
- `mobile-player-curated-expanded` — expanded note now appears **below** the frame, scrolling in the
  bounded region; the frame stays fully visible above it.
- `mobile-player-candidate` — candidate, collapsed: frame-first; match reason + "✦ Curate this video"
  (logged-out) below the frame.
- `mobile-player-vertical` — 9:16 frame height-capped at `min(46vh,380px)`, frame-first, fully visible
  with the article slice above.
- `mobile-player-vertical-expanded` — the stress case: tall 9:16 frame fully visible, expanded note
  scrolling below it; title bar pinned.
- `mobile-player-top-parked` — top-parked, internal order identical (title bar at the top edge, frame
  below, secondary below), article reflowed beneath.
- `mobile-player-maximized-horizontal` / `mobile-player-maximized-vertical` — **unchanged behavior**;
  re-render only if a `--all` refresh runs.

**New state worth a scene (recommended, not required):**

- **`mobile-player-curated-loggedin`** is already covered by the curated scene's signed-in auth arm;
  no new scene needed for the launch correction. **No new scene IDs are required** — the launch
  correction is a re-render of the existing docked scenes. (If Dev wants explicit evidence of the
  article-slice-still-visible invariant, the existing `clip: "viewport"` framing on the docked scenes
  already shows the dock *and* the article above it, which is exactly the AC-2 evidence.)

Refresh with `scripts/dev/shots.sh --group "Players · mobile unified" --commit ui` (the affected
group) — or `--all --commit ui` if the shared dock change ripples elsewhere — and attach a focused
subset (`mobile-player-curated`, `mobile-player-candidate`, `mobile-player-vertical`) to the PR with
`--scene … --pr <N>`. Commit the regenerated PNGs + `index.html` in the same PR (CLAUDE.md "UI
screenshot gallery").

---

## 8. Acceptance-criteria → design map

| Product AC (issue #135 / spec) | Satisfied by |
|---|---|
| **AC-1** Whole frame fully visible on open, no internal scroll, both kinds × both aspects × 360/390/414/430 | §1.1 frame-first order + §1.2 + §2.2–§2.5 budget (frame `T`-offset…`T+F` within `[0,VH]`, frame `shrink-0`) + §2.6 cap-with-shrink-0-frame |
| **AC-2** Dock bounded; meaningful article slice on open; spacer = actual height; removed on dismiss | §2.5 budget (slice 47–52% / ~32%) + §2.6 `88dvh` ceiling (never `100dvh`) + §3 measured edge-aware spacer |
| **AC-3** Minimal, video-first launch chrome (chips compact, note collapsed, CTA below) | §1.3 the concrete reductions (one-row controls, slim title bar, chips one-line strip below frame, Context collapsed, CTA below frame) |
| **AC-4** Creator credit present at launch (and every state) | §1.4 credit in the slim title bar (every state) + §4 per-state confirmation + §6 (maximized = thin-bar caption) |
| **AC-5** Candidate parity (frame visible, bounded, match-reason + CTA secondary) | §1.2 + §4 candidate state + §2.5 (candidate `D` < curated) |
| **AC-6** #120 invariants preserved (non-modal, swap, maximize, park, facade, AA) | §6 (non-modal contract restated) + §4 (swap, maximize, top-parked kept) + the "What this does NOT change" note up top |
| **AC-7** Maximize open-seed sanity (portrait opens docked) | §4 Maximized state (AC-7 verification clause) |
| **AC-8** Launch-state correction recorded in the #120 design doc | Dev records the §5 DOM-order, §6 sizing/fit, §6.6 spacer, §13 map correction into `docs/design/unified-player-mobile.md` when code lands (this spec is the source of the corrected layout) |
| **AC-9** Corrected fit test (assert the frame box, not just `dockTop`) | §1.1/§2.4 the frame is a discrete `shrink-0` box → measurable; §2.5 makes the assertion (frame top ≥ 0, frame bottom ≤ VH) pass corrected / fail frame-last |
| **AC-10** Screenshot baseline refreshed for the affected scenes | §7 catalog note |

---

## 9. Hand-off

- **To Development:** build to **this** launch-state spec — re-order `MobilePlayerDock` to
  **frame-first** (§1.1): a flex column of `[slim title bar shrink-0]` → `[frame shrink-0]` →
  `[secondary region flex-1 min-h-0 overflow-y-auto]`, with the controls collapsed to **one
  horizontal row** in the slim title bar (§1.3), the chips as a one-line strip + "Context ▸" + the
  logged-out CTA all **below** the frame (§1.3, the resolved Product decision), and the creator credit
  kept in the title bar (§1.4). Replace the `100dvh` cap with `max-height: calc(88dvh − insets)`
  (§2.6); make the frame `shrink-0` and the secondary region the sole scroll area (§2.4); cap the 9:16
  frame at `min(46vh,380px)` (§2.3). Tie the `TopicView` spacer to the dock's **measured** docked
  height, edge-aware (§3) — not the fixed `60vh` guess. **Keep every #120 invariant** (§6, §4 —
  non-modal contract, swap, maximize-on-rotate, park, facade) and verify AC-7 (portrait opens docked).
  Introduce **no** server / oEmbed / facade / data-model change. Re-point `e2e/mobile-player-fit.spec.ts`
  at the **frame box** (AC-9), refresh the baseline scenes (§7, AC-10), and record the launch-state
  correction into `docs/design/unified-player-mobile.md` (AC-8) + reflect the shipped behavior into
  `docs/TOPIC_PAGE_DESIGN.md` when code lands.
- **To QA & Review + UX evaluation:** verify AC-1 through AC-10 — the **frame-box fit** at every
  in-scope width × {16:9, 9:16} × {curated, candidate} (AC-1/AC-5/AC-9: frame top ≥ 0 and frame bottom
  ≤ VH, no internal scroll to reach the frame), the bounded dock + article slice (AC-2: `D < 88dvh`,
  slice present), the video-first / minimal launch chrome (AC-3), the creator credit at launch (AC-4),
  every preserved #120 invariant (AC-6) + portrait open-seed (AC-7), the doc correction (AC-8), and the
  refreshed baselines (AC-10). UX evaluation judges against the refreshed baselines and this spec: on
  open the **video is the dominant element**, a meaningful article slice shows, and chips / CTA / note
  are present-but-secondary.
