# Design spec — Slim mobile player (frame + one four-control row)

**Issue:** mobile-player slim-default (#120 / #135 lineage; #123 coherence) · **Role:** UX / Design ·
**Status:** buildable design spec — written *before* the build, from the **owner-approved** exploration
`docs/design/mobile-player-slim-explore.md`. **Surface:** `components/topic/MobilePlayerDock.tsx`
(mobile, `< lg`). **Feeds:** Development (build), then QA & Review + UX evaluation.
**Reads / respects (do not break):** `docs/design/unified-player-mobile.md` (#120 — the non-modal
contract, the state model, park/maximize, the `88dvh` bound + measured spacer), `docs/design/mobile-player-launch.md`
(#135 — frame-first, the fit math, the measured edge-aware spacer), `docs/design/in-player-curation.md`
(#123 — the desktop "watch + act" contract this mobile pass mirrors), `docs/VISUAL_IDENTITY.md`
(Indigo Press, the projector `SiteHeader` rule §10.1), `docs/CURATION_STANDARD.md` §5/§5.2 (creator
credit is a reference norm on a nonfree third-party embed — **not** a CC BY-SA obligation, and not
required on every surface).

This is the buildable contract for the **slim default** mobile player. The owner approved the
one-row slim model: a playing mobile video is **the frame plus ONE thin control row, and nothing
else** in the default chrome — so the reader keeps reading the article while the clip plays, and every
piece of metadata, every curation affordance, and the creator credit are one tap away behind two
inline expanders. This spec locks that model as the contract and supersedes the per-state heaviness of
the #135 / #120 docked default for mobile (those specs' **invariants** still govern — see §0.1).

> **What this changes vs. #135/#120.** The #135 slim title bar (eyebrow + caption + creator credit +
> a three-control row) and the always-visible secondary strip (chips · "Context ▸" · match reason ·
> CTA) are **gone from the default**. The default chrome is now exactly one 46px row of four cells:
> **Close · Move · Curate · See context**. Caption, creator, description, chips, the context note,
> the match reason, and all curation actions move **behind** the **Curate** and **See context**
> inline expanders. The custom **Maximize/fullscreen** control is **removed** entirely.
>
> **What this does NOT change** (preserved invariants — §0.1): the non-modal `<section aria-label="Video
> player">` contract, the `88dvh` bounded-height ceiling + ≥12dvh article slice, frame-first order,
> safe-area insets, the secondary/expander region as the dock's **sole** scroll area, the
> `onDockMetrics` height-reporting + measured edge-aware page spacer, swap-in-place, the embed facade,
> and **desktop** (#123 stays as-built — §7). Where this spec is silent, #120 + #135 govern.

---

## 0. Personas, stories, and preserved invariants

### 0.1 Preserved invariants (read; this spec shows they still hold)

Carried verbatim from #120 §9 / #135 and **not** re-derived here:

- **Non-modal contract.** The dock root stays `<section aria-label="Video player">` — **not**
  `role="dialog"`, **no** `aria-modal`, **no** focus trap, **no** backdrop, **no** autofocus / focus-
  steal on open, **not** routed through `ModalShell`. The two new expanders are inline reveals **inside**
  this section — they do **not** introduce a modal layer (this is exactly why they are inline expanders
  and not bottom-sheets — §3.1).
- **Bounded height + article slice.** `max-height: calc(88dvh − env(safe-area-inset-top) −
  env(safe-area-inset-bottom))`. With the slim default this is **non-binding** — the default dock is far
  below it (see §6 fit numbers, ~69% article visible for a 16:9 clip). It remains the ceiling so that
  an open expander can never grow the dock past it; when an expander's content exceeds the budget, the
  **expander body scrolls** inside the dock's sole scroll area while the frame + bar stay pinned.
- **Frame-first.** Reading/DOM order is **frame → control bar** (bottom-parked) or **bar → frame**
  hugging the parked edge (the bar is always the edge-most-after-frame row); the frame is `shrink-0`
  and never the element that scrolls or clips.
- **Safe-area insets** reserved at the parked edge (notch / home indicator) — unchanged.
- **`onDockMetrics` + measured spacer.** The dock reports `{ edge, height, docked }`; `TopicView`
  reserves exactly that height at the parked edge. **The collapsed default reports a small height**
  (frame + 46px bar); **opening Curate or See context grows the reported height** as the expander body
  is added, and the spacer tracks it live (§5, §6.4).
- **Swap-in-place, embed facade, the iframe lifecycle** — unchanged.

### 0.2 Personas

Unchanged from `docs/design/unified-player-mobile.md` §1 — **Priya** (the deciding reader on a phone),
**Cory** (keyboard / AT reader), **Mona** (curator-in-the-making). The slim model sharpens Priya's
*keep-reading-while-it-plays* need and keeps Mona's *act-where-I-watched* loop one tap away.

### 0.3 User stories this slim model serves

- **S1.** *As Priya on a phone, I want a playing video to take almost nothing but the picture, so I
  can keep reading the article beside it without metadata and buttons crowding the screen.* → the
  one-row slim default (§1, §2).
- **S2.** *As Priya, I want one obvious place to act on the clip and one obvious place to read who made
  it and why it's here — and for those to appear only when I ask.* → the **Curate** and **See context**
  inline expanders (§3, §4).
- **S3.** *As Priya, I want to move the player out of the way of the part I'm reading and close it
  whenever I want — always reachable, in plain words.* → **Move** (destination-named) + **Close** in
  the bar (§2.3, §2.4).
- **S4.** *As Mona, I want to Curate the clip I'm watching, or mark it not relevant, right from the
  player — the same two choices the desktop player gives me.* → the Curate reveal (§3), shared
  vocabulary + handlers with #123.
- **S5.** *As Priya watching in landscape, I want the video to fill the screen with no extra chrome,
  by just turning my phone — no button to hunt for.* → automatic rotate-to-maximize + the embed's own
  native fullscreen; **no custom control** (§5).
- **S6.** *As Cory, I want the four cells and both reveals to be real, labeled, keyboard-operable
  buttons with a visible focus ring, the region to never trap or steal my focus, and focus to land
  sensibly after I dismiss a clip.* → §8 a11y.

---

## 1. The locked model

A playing mobile video has **exactly four controls, in one row below (or edge-most beside) the frame,
and nothing else in the default chrome:**

1. **Close** — tears down the dock + iframe (stops playback).
2. **Move** — parks the dock at the top/bottom edge (toggle; the label names the **destination**).
3. **Curate** — an inline **expander** that reveals the curation directions (the "act").
4. **See context** — an inline **expander** that reveals the metadata (caption · creator · why /
   note · chips).

**Default playing = video frame + this one 46px row. No caption, no creator, no description, no chips
in the default chrome.** All metadata is hidden until **See context** is opened; all curation
affordances are hidden until **Curate** is opened. There is **no custom Maximize/fullscreen control**
(§5). The four controls are the whole default chrome.

This is the contract. It is **not** an option set: one row of four glyph-above-word cells is the
default; a **2×2 wrap** is the long-locale overflow fallback only (§2.5); the reveals are **inline
expanders**, never bottom-sheets (§3.1).

---

## 2. The slim default — dock anatomy

### 2.1 The four-cell control bar

One horizontal row of **four equal-width cells**, each a real `<button>`, **≥46px tall** (and ≥46px
wide each at every in-scope width), laid out **glyph-above-word** (a small plain glyph stacked over a
full word label). At 360–430px each of four cells is ~90–107px wide; the four words render legibly
without truncation (§6).

```
  ── (article visible above — the slim default leaves ~69% for a 16:9 clip, §6) ──
┌──────────────────────────────────────────────────────────┐  ← dock root: <section aria-label="Video player">
│ VIDEO FRAME — THE HERO (shared, pinned, shrink-0)          │     black backing; iframe (autoplay); frame-first
│   <iframe …> fully visible; embed's OWN native ⛶ inside it │   ← fullscreen = the embed's native button (§5)
├────────────┬────────────┬────────────┬────────────────────┤  ← ONE 46px control row, four equal cells
│     ✕      │     ⇅      │     ✦      │        ⓘ          │     glyph (aria-hidden) ABOVE…
│   Close    │ Move to top│  Curate    │   See context      │     …a full WORD label (the affordance)
└────────────┴────────────┴────────────┴────────────────────┘  ← dock pinned to the parked edge
```

*(Glyphs above are illustrative — see §2.6 for the exact glyph choices. The arrows ⤢/⤒ are NOT used —
§2.6, §5.)*

- Each cell is a separate focusable `<button>` with its own ≥46px target. They never merge.
- The bar is `shrink-0`; it is the edge-most-after-frame row and is never the element that scrolls.
- The bar height target is **46px** (one row). Above the frame there is **zero** chrome in the
  default — the slim title bar of #135 is gone.

### 2.2 Default order, docked top vs. bottom

The **visual top-to-bottom order is identical** whichever edge the dock is parked at — frame then bar,
the bar always hugging the parked edge after the frame:

- **Bottom-parked (default):** the dock pins to the **bottom** edge; frame above, the 46px bar below
  it against the bottom safe-area inset.
- **Top-parked:** the dock pins to the **top** edge; frame and the 46px bar still read top-to-bottom
  the same way, the whole dock hugging the top edge under `safe-area-inset-top`.

Only which viewport edge the whole dock hugs changes. The `TopicView` page spacer is reserved at the
**parked edge**, sized to the dock's measured height (§5).

### 2.3 Move — the label names the destination

The **Move** cell is the park toggle, ship-verbatim:

- When the dock is **bottom-parked** (default): the cell reads **Move to top** ·
  `aria-label="Move player to top of screen"`.
- When **top-parked**: the cell reads **Move to bottom** · `aria-label="Move player to bottom of
  screen"`.

The label always names where the dock will go. A plain glyph sits above the word (§2.6). Activating it
moves the dock to the other edge; the measured spacer moves with it (§5); focus **stays on the cell**
(its label flips). Motion is gated by `prefersReduced` (no transition under reduced motion).

### 2.4 Close

The **Close** cell reads **Close** · `aria-label="Close video player"`, plain glyph above the word.
Activating it removes the dock + iframe (playback stops). Focus handling on close: §8.

### 2.5 One row vs. the 2×2 wrap fallback

**Default = one row of four cells.** The four glyph-above-word cells fit one row at every in-scope
width (360–430px) — confirmed in §6. A **2×2 wrap** (Close / Move on the first sub-row, Curate / See
context on the second — the **same four cells reflowing**, never merged or dropped) is the
**overflow fallback only**, engaged when a longer-word locale would otherwise truncate a cell's word.
Implement the wrap as a natural flex wrap (`flex-wrap`) so it engages on overflow rather than at a
fixed breakpoint; the default at all in-scope English widths is one row. Each cell keeps its ≥46px
target in either layout.

### 2.6 Glyph-above-word — the glyph set (no ⤢/⤒ arrows)

Each cell stacks a **small plain glyph (`aria-hidden`)** above a **full word**. The **word is the
affordance and the accessible name**; the glyph is decorative and never the sole signal. Use plain,
legible glyphs — **never the obscure `⤢` (maximize) or `⤒`/`⤓` (the old park arrows)**, which the
exploration and owner rejected as illegible. Recommended glyphs (Dev may substitute an equally plain
equivalent, keeping the word as the label):

| Cell | Glyph (decorative, `aria-hidden`) | Word (the affordance + accessible name) |
|---|---|---|
| Close | `✕` | **Close** |
| Move | `⇅` (or a simple up/down chevron pair) | **Move to top** / **Move to bottom** |
| Curate | `✦` | **Curate** |
| See context | `ⓘ` (or a plain "i"-in-circle) | **See context** |

The `＋plus` eyebrow does **not** appear in the slim bar (it lives nowhere in the default chrome; the
caption it used to prefix is now behind See context). AA: white-on-`ink` chrome (≈15:1) for the bar;
each cell carries the global `:focus-visible` ring (`3px solid var(--color-brand)`, offset 2px). No
gold. (§8.)

---

## 3. The Curate reveal

**Curate** is an **inline expander** anchored to the bar (`aria-expanded` + `aria-controls`). Opening
it grows the dock downward (the reported `onDockMetrics` height increases — §5) while the **frame
stays pinned above**; the reveal body lives in the dock's **sole scroll area** (bounded by the `88dvh`
ceiling — if its content exceeds the budget it scrolls, the frame never moves). Opening it does **not**
steal focus (§8). It generalizes the existing `expanded` "Context ▸" pattern in the component into a
named reveal.

### 3.1 Why an inline expander, not a bottom-sheet (LOCKED)

A bottom-sheet implies a modal layer (backdrop, focus management, dismiss-on-scrim) — exactly what the
player's **non-modal `<section aria-label="Video player">` contract forbids** (§0.1). The reveal is an
inline expander: no dialog, no `aria-modal`, no trap, no backdrop, no focus-steal. It grows the dock's
reported height, the frame stays pinned, and the body is just more of the same bounded scroll region.
This is the locked decision for **both** Curate and See context.

### 3.2 Curate reveal — candidate, signed in

The reveal shows the two directions, stacked full-width, **identical in vocabulary, weight, and
`aria-label`s to the desktop #123 "watch + act" row** (so the two surfaces read as one family):

- **✦ Curate** — solid `brand #676EB4` fill, white bold, 2px `ink` border, leads. `aria-label="Curate
  this clip: {caption}"`, `aria-haspopup="dialog"`. Routes the playing candidate into the curate flow
  (the existing `promote` handler → `CurateModal` / the `curate` gate).
- **✕ Not relevant** — white fill, `ink` text, 2px `ink` border, quiet secondary. `aria-label="Dismiss
  as not relevant: {caption}"`. Routes the existing optimistic-hide + rollback dismiss (the existing
  `dismiss` handler).

`✦` / `✕` are decorative (`aria-hidden`); both are real ≥44px `<button>`s. **After a Not-relevant**
the dock follows the #123 post-dismiss behavior exactly: the candidate is optimistically hidden
(rollback on write failure), **the dock CLOSES**, and focus moves to the **General band heading**
(`focusBandHeading()`) — see §3.5, §8.

### 3.3 Curate reveal — candidate, logged out

The reveal shows a **single gated CTA** and **no dismiss**:

- **✦ Curate this video** — solid `brand` fill, white bold, 2px `ink` border, full width.
  `aria-label="Curate this video — log in to write a context note and vouch for it"`,
  `aria-haspopup="dialog"`. Routes through the `curate` login gate.
- **No "Not relevant" is shown logged out.** A logged-out dismiss cannot honestly optimistic-hide (the
  persistence boundary rejects an unauthenticated write — a false "dismissed"), so it is gated by
  simply not offering it here. This matches desktop #123 State J exactly.

### 3.4 Curate reveal — curated clip

For a **curated** clip the reveal's "act" is the **#65 vote/manage affordance** — the curated analog
of "act." **Placement (this spec):** it sits in the **same slot** the candidate directions occupy —
the top of the Curate reveal body, full-width, leading with the primary action in brand weight and any
secondary action quiet — so curated and candidate players present their "act" in one consistent place.
**Voting / manage mechanics are out of scope here** (owned by #65); this spec fixes only *where* the
affordance lives so it does not diverge. If #65 is not yet built for mobile, the Curate reveal for a
curated clip may render its existing curated affordance (or, absent one, an empty-state line) in this
slot — Dev should not invent vote mechanics in this pass.

### 3.5 Curate reveal microcopy (ship verbatim)

| Surface | Text |
|---|---|
| Bar cell | **Curate** |
| Direction 1 — candidate signed in | **✦ Curate** |
| Direction 2 — candidate signed in | **✕ Not relevant** |
| Candidate logged-out CTA (single, no dismiss) | **✦ Curate this video** |
| Curated clip "act" | the #65 vote/manage affordance (mechanics out of scope; placement only) |

`aria-label`s match #123 verbatim (`"Curate this clip: {caption}"` / `"Dismiss as not relevant:
{caption}"` / the logged-out gate label above) so mobile and desktop share one vocabulary.

---

## 4. The See-context reveal

**See context** is an **inline expander** (same grammar as Curate — §3.1): `aria-expanded` +
`aria-controls`, grows the dock, frame pinned, body in the sole scroll area, no focus-steal. It is
where **all** metadata lives — caption, **creator identity**, and the why/note/chips. **Creator
identity appears ONLY inside See context** (it is legitimately absent from the slim default — §9).

### 4.1 See context — candidate

- **Caption** (the clip title).
- **Creator credit** — `{creator.handle} · {platformLabel}` (plain creator credit; **no "(CC BY-SA)"
  framing** — §9).
- **Why suggested** — the one-line **match reason** under a heading reading **Why suggested**.

### 4.2 See context — curated

- **Caption** (the clip title).
- **Creator credit** — `{creator.handle} · {platformLabel}` (plain; no CC framing — §9).
- **Chips** — the `Stance` + `Accuracy` chips (`StanceChip` / `AccuracyChip`, verbatim; each carries
  its `sr-only` word). The held marking, when `clip.held`, shows above the chips (the existing
  `HeldMarking`).
- **Context note** — the full curator note on a light surface (white card, 2px `ink` border,
  `text-ink2`), the `Curator note` eyebrow + the untruncated note (the existing `CuratorNote`). Bounded
  so a long note scrolls inside the reveal body, never growing the dock past the `88dvh` ceiling.
- **Context by @curator** — the `ContextByLink` curator attribution, the closing element (the curator
  attribution that points **in** to the wiki+ profile — distinct from the creator credit, which points
  **out** to the platform; CURATION §"load-bearing rule").

### 4.3 See context microcopy (ship verbatim)

| Surface | Text |
|---|---|
| Bar cell | **See context** |
| Candidate match-reason heading | **Why suggested** |
| Curated chips | `Stance: …` · `Accuracy: …` (the existing chip text) |
| Curated note eyebrow | **Context note** |
| Curated attribution | **Context by @{curator}** (via `ContextByLink`) |
| Creator credit (both kinds) | `{creator.handle} · {platformLabel}` (plain — no "(CC BY-SA)") |

**See context** (not "Info" / "Details") names the wiki+ value — context, the fact-vs-opinion
separation — and is the natural verb for what the reveal shows.

---

## 5. Maximize / landscape — no chrome button (LOCKED)

There is **no custom Maximize/fullscreen control** in the four cells (the `⤢` button is **removed**
from the component — §10).

- **Fullscreen = the embed's own native button inside the iframe.** `allowFullScreen` stays on the
  iframe; the platform's player chrome owns that path. wiki+ adds **no** custom fullscreen control.
- **Rotate-to-maximize stays AUTOMATIC (CSS, no button).** The existing behavior is kept: while the
  dock is open, an `orientationchange` to landscape flips the **same `<section>` + same iframe** to
  `fixed inset-0` via CSS (never `requestFullscreen`); rotating back to portrait restores the slim
  dock. In landscape the four-cell bar is **hidden** while the video fills the screen, and a thin
  **Close** remains reachable so the reader is never stuck. This is the #135/#120 maximize behavior
  **minus the explicit Maximize button** and minus the rest of the chrome.

The seed-on-mount + listener hygiene from #120 §9 are unchanged (a portrait open opens docked; a
landscape-at-open opens maximized; the listener is added only while open and removed on dismiss).

---

## 6. Responsive / fit

### 6.1 One-row legibility at the in-scope widths

Four glyph-above-word cells, equal width. Each cell at the common phone widths:

| Width | Per-cell width (÷4) | Fits one row? |
|---|---|---|
| 360 | ~90px | yes — `Close` / `Move to top` / `Curate` / `See context` legible stacked |
| 390 | ~97px | yes |
| 430 | ~107px | yes |
| **780 (stress viewport height; same widths)** | as above | yes |

The longest words — `Move to bottom` / `See context` — wrap to two short lines **within** a cell if
needed (still legible at ~90px); the **2×2 fallback** (§2.5) is reserved for a genuinely longer-word
locale that would truncate. The default at every in-scope English width is one row.

### 6.2 The 88dvh fit numbers (slim default)

Above-frame chrome is **zero**; total dock height `D = frame F + bar B`, with `B ≈ 46px` (one row).
Against the catalog **850px** viewport (and the stress **780px**):

| Aspect | `F` @390 | `B` | `D` | article slice @850 | @780 |
|---|---|---|---|---|---|
| 16:9 | 219px | 46px | **265px** | **585px (≈69%)** | **515px (≈66%)** |
| 9:16 (capped `min(46vh,380px)`) | 380px | 46px | **426px** | **424px (≈50%)** | ~354px (≈45% @780, where 46vh≈359) |

The slim default frees a large amount of article: the 16:9 case leaves **≈69%** of the viewport for
the article (nearly double the #135 launch default), and even the tall 9:16 Short leaves **≈50%**. The
**88dvh ceiling + ≥12dvh article-slice invariant still hold and are now far from binding** — the slim
default makes them comfortable, not tight. Opening a reveal grows `D` by the reveal body's height (and
its content scrolls within the dock if it would otherwise exceed the ceiling — §0.1, §3, §4).

### 6.3 Tablet (`< lg`)

Still the mobile dock (`< lg`). The 16:9 frame is taller (e.g. `834 × 9/16 = 469px`); `D = 469 + 46 =
515px`, well under the `88dvh` ceiling against a ~1000px tablet height, still leaving a comfortable
article slice. The 9:16 frame stays capped at `min(46vh,380px)`. Fit holds.

### 6.4 Reveal growth + the spacer

The collapsed default reports a **small height** (`F + 46px`) via `onDockMetrics`; opening **Curate**
or **See context** grows the reported height by the reveal body, and the measured edge-aware spacer
tracks it live (§5 of #120 / §3 of #135 mechanism, unchanged). Closing the reveal shrinks it back.

---

## 7. Desktop coherence (#123 stays as-built)

Desktop #123 is built and approved with **Curate (primary) + Not relevant (secondary) shown directly
below the frame** — both visible at once, no expander. **Mobile uses the Curate expander** because it
is space-constrained (the whole point is a slim default; two persistent action buttons would defeat
it). **Do not change desktop in this pass.**

The two surfaces still read as one family: the *vocabulary, weight grammar, and `aria-label`s are
identical* (Curate brand-primary leads; Not relevant quiet secondary; text-labeled; same `promote` /
`dismiss` handlers; same post-dismiss close + focus-to-band). The *disclosure* differs because the
constraint differs. **Possible future follow-up (do NOT do here):** unifying desktop onto the same
expander grammar is a clean later option if the owner wants one identical interaction everywhere —
flagged only; this pass does not touch desktop files.

---

## 8. Accessibility

- **Real, labeled, keyboard-operable controls.** All four cells and both reveals' actions are real
  `<button>`s, Enter/Space operable, each with the global `:focus-visible` ring (`3px solid
  var(--color-brand)`, offset 2px). Each cell ≥46px; reveal actions ≥44px. **Never glyph- or
  color-alone** — the word is the affordance and the accessible name; glyphs are `aria-hidden`. AA:
  white-on-`ink` bar (≈15:1); brand-fill primary (white-bold clears AA at the weight, precedent #123);
  ink-on-white secondary (≈15:1). No gold.
- **`aria-expanded` / `aria-controls`.** **Curate** and **See context** each carry `aria-expanded`
  (false collapsed, true open) and `aria-controls` pointing at their reveal body. **No focus-steal on
  open** — toggling a reveal does not autofocus into it; the player stays the non-modal section (no
  dialog / `aria-modal` / trap / backdrop). Focus stays on the toggling cell; `aria-expanded` flips.
- **Tab order.**
  - *Collapsed default:* frame's embed → bar cells in DOM order **Close → Move → Curate → See
    context**. (Close reachable first among the cells.) Tab is never trapped — focus flows into and out
    of the section.
  - *With a reveal open:* the reveal body's actions are inserted into tab order **immediately after the
    cell that opened them** (i.e. after **Curate**, or after **See context**), then the remaining cells
    — a coherent narration (open the reveal → its actions are next). DOM order should place the reveal
    body adjacent to its trigger so visual and tab order agree.
- **Only one expander open at a time (LOCKED).** Opening **Curate** closes **See context** and vice
  versa. Rationale: the dock is height-bounded and the frame must stay the hero — two stacked reveals
  would compete for the budget and bury the picture; a single open reveal keeps the dock predictable
  and the article slice generous. (Re-activating an open cell closes it; opening the other closes the
  first.)
- **Post-Not-relevant focus.** After a Not-relevant from the Curate reveal (signed in), the dock
  CLOSES and focus moves to the **General band heading** (`focusBandHeading()` → `#general-band h2`,
  `tabindex=-1`) — the same anchor desktop #123 and on-card dismiss use. Never dropped to `<body>`,
  never trapped. On a touch Close (focus not in the dock), leave focus where it is; on a keyboard Close
  (focus in the dock), return it to the band heading (the existing pattern).
- **Reduced motion.** The Move slide, any reveal expand/collapse transition, and the maximize fill are
  gated by `prefersReduced` (end-state applied instantly under reduce). No new animation is introduced.
- **z-index.** Dock at `z-40`, below app modals at `z-50` (a `CurateModal` from the Curate reveal
  correctly covers the dock and governs with its own trap while up). Unchanged.

---

## 9. Creator credit & the CC-framing correction (folds in the CURATION §5/§5.2 correction)

`docs/CURATION_STANDARD.md` §5/§5.2 (just corrected) states: embedded videos are **nonfree
third-party works**; the embed itself carries creator credit; wiki+ chrome is **not** under a CC BY-SA
obligation to show it, and whether it appears on a given surface in a given state is a **UX/space
decision**. Two consequences for this spec:

1. **The slim default legitimately omits the creator credit.** It is not a CC obligation to show it on
   every surface; showing it under **See context** is a sound UX/space decision. The default chrome
   carries no creator credit, and that is correct.
2. **No "(CC BY-SA)" framing for the video creator credit, anywhere** — not in copy, not in code
   comments, not in this spec. The creator credit is plain `{creator.handle} · {platformLabel}`. (CC
   BY-SA remains the obligation on the **Wikipedia article**, unrelated to player chrome; and it remains
   the license on the **curator's context note** — neither is the *creator credit*.)

### 9.1 Stale CC-framing to CORRECT while building (explicit Dev build instructions)

The Dev pass implementing this slim component must **drop the "(CC BY-SA)" / "present on every surface"
framing on the video creator credit**, keeping plain "creator credit." At minimum, correct these in
the **same** mobile-player build pass (these are the mobile files Dev is already touching/updating):

- **`components/topic/MobilePlayerDock.tsx`** — the JSDoc near line ~75 (`/** Creator credit (CC BY-SA)
  — … present on every clip surface. */`) and the inline comment near line ~280 (`CC BY-SA creator
  credit — present in EVERY state (AC-4). CURATION §5.2.`). Reword to plain **creator credit** with no
  "(CC BY-SA)" and no "every surface / every state" claim (the slim default omits it; it lives under
  See context).
- **`docs/design/unified-player-mobile.md`** — lines ~152, ~191–193, ~225, ~260, ~742 (the "CC BY-SA
  creator credit … present in every state / on every clip surface" framing). Reword to plain creator
  credit; drop the CC framing and the "every surface" obligation language.
- **`docs/design/mobile-player-launch.md`** — lines ~135, ~140 (the "CC BY-SA non-negotiable that
  creator attribution rides every clip surface" framing). Same correction.

State the **current** design only (no history cruft — CLAUDE.md "Comments & docs"): the creator credit
is a plain reference norm shown under See context on mobile; the CC BY-SA license attaches to the
Wikipedia article and to the curator's context note, not to the video creator credit.

> **Separate cleanup (NOT this pass — route via the orchestrator).** The desktop-side CC-framing
> stragglers — `docs/design/pinned-player.md`, `docs/design/in-player-curation.md`,
> `docs/TOPIC_PAGE_DESIGN.md` (~364 / ~382 / ~409), and `components/topic/PinnedPlayer.tsx` (line ~35)
> — also carry the stale "(CC BY-SA) creator credit" framing. The mobile Dev pass **need not touch
> desktop files**; the orchestrator will route those as a separate cleanup.

---

## 10. Component-orientation hand-off for Dev (orientation only — Dev owns implementation)

What changes in **`components/topic/MobilePlayerDock.tsx`** (READ as-built; this pass revises it):

- **Remove the custom Maximize control + the sr-only-word logic.** Delete the `⤢ Maximize/Exit`
  `<button>` from the title bar (§5 — no custom fullscreen; rotate-to-maximize stays automatic CSS).
  The slim default uses **visible glyph-above-word** cells, so the `showWords` / `wordClass`
  (`sr-only sm:not-sr-only`) narrow-width logic is **removed** — the four words are always visible
  (stacked under their glyph). (Keep the maximize **state** + the orientationchange listener that flips
  to `fixed inset-0`; only the **button** is removed.)
- **Replace the slim title bar with the four-cell control bar.** The default chrome above/beside the
  frame collapses to **one 46px row of four equal cells**: Close · Move · Curate · See context (§2),
  glyph-above-word, no `＋plus` eyebrow, no caption/creator/chips in the default. The bar is `shrink-0`
  and edge-most-after-frame.
- **Generalize the existing `expanded` "Context ▸" pattern into TWO reveals.** Today there is a single
  `expanded` boolean driving the curated "Context ▸" note. Generalize to two inline expanders —
  **Curate** and **See context** — each `aria-expanded` + `aria-controls`, **only one open at a time**
  (§8), bodies in the sole scroll area below the frame, growing the reported height. **See context**
  carries the metadata the title bar + secondary strip used to show (caption, creator credit, chips +
  note + "context by", or the candidate match reason under **Why suggested**). **Curate** carries the
  curation directions.
- **Add the signed-in curation actions the mobile dock currently lacks.** In the **Curate** reveal,
  render — for a **candidate, signed in** — **✦ Curate** (primary) + **✕ Not relevant** (secondary),
  **reusing the desktop #123 treatment, microcopy, and `aria-label`s verbatim** (§3.2). For a
  candidate logged out, the single **✦ Curate this video** CTA, no dismiss (§3.3). For a curated clip,
  the #65 vote/manage slot (placement only — §3.4). New props: an `onDismiss` handler (the Not-relevant
  path), alongside the existing `onCurate` / `onJoin`.
- **Update `onDockMetrics` accounting.** The collapsed default reports the small height (`F + 46px
  bar`); opening either reveal grows the reported height; closing shrinks it. (The existing
  `ResizeObserver` report already tracks this — confirm the new reveals are inside the observed root so
  the spacer follows.)
- **Apply the CC-comment corrections** in this file (§9.1).

What **`app/topic/TopicView.tsx`** wires (mirrors desktop #123 exactly):

- Wire the mobile dock's **Curate** → `promote(pinnedCandidate)` and **Not relevant** →
  `dismiss(pinnedCandidate)` — the existing handlers (same gating + optimistic-dismiss-with-rollback as
  desktop; no #45 change).
- After a player-driven **Not relevant**, **close the dock** (drop the `mobileDock` state) and run
  `focusBandHeading()` — the same close-on-dismiss + focus-to-band behavior as desktop #123 / mobile
  Close. After a successful **Curate**, the existing candidate-removal already fires; close the dock the
  same way.
- No new gate kinds, no new persistence, **no** server/oEmbed/facade/data-model change.

Timeless-doc edits to make (state CURRENT design only — **no history cruft**, CLAUDE.md):

- **`docs/TOPIC_PAGE_DESIGN.md`** (mobile player section) — reflect the slim default (frame + one
  four-cell row; metadata + curation behind Curate / See context; no custom maximize) when the code
  lands.
- **`docs/design/unified-player-mobile.md`** + **`docs/design/mobile-player-launch.md`** — update the
  mobile-player timeless docs for the slim model, **including the CC corrections** in §9.1, current
  state only.

Catalog `Scene`s to add to **`e2e/screenshots/catalog.ts`** (group `Players · mobile unified`; add an
`openMobileDockCurate` / `openMobileDockSeeContext` helper that opens the dock then taps the
respective reveal cell):

- **`mobile-player-slim-default`** — the slim default, bottom-parked: frame + the one four-cell row,
  nothing else; the generous article slice above. (Headline evidence for the locked model.)
- **`mobile-player-slim-top-parked`** — the slim default parked at the **top** edge (Move → "Move to
  bottom").
- **`mobile-player-curate-expanded`** — the **Curate** reveal open, **candidate signed in** (✦ Curate
  + ✕ Not relevant). (`auth: ["in"]`.)
- **`mobile-player-curate-loggedout`** — the **Curate** reveal open, **candidate logged out** (single
  ✦ Curate this video, no dismiss). (`auth: ["out"]`.)
- **`mobile-player-seecontext-candidate`** — the **See context** reveal open on a candidate (caption ·
  creator · **Why suggested** match reason).
- **`mobile-player-seecontext-curated`** — the **See context** reveal open on a curated clip (caption ·
  creator · chips · **Context note** · **Context by @curator**).

Also **revise/retire the existing mobile-player scenes** that no longer describe the UI: the old
`mobile-player-curated` / `-curated-expanded` / `-candidate` / `-vertical` / `-vertical-expanded` /
`-top-parked` should be re-pointed at the slim states above (or relabeled), and the two **maximized**
scenes (`mobile-player-maximized-horizontal` / `-vertical`) must update their `prepare` — the explicit
`⤢` button they tap is removed, so maximize is now triggered by rotation (the horizontal scene already
rotates the viewport; the vertical scene must switch from "tap ⤢" to the rotation path or be dropped if
there is no non-button trigger for a portrait Short). Run the refresh per CLAUDE.md "UI screenshot
gallery": a broad/shared change → `scripts/dev/shots.sh --all --commit ui` (the slim default is a new
shared default and adds new surfaces); attach a focused subset (`mobile-player-slim-default`,
`mobile-player-curate-expanded`, `mobile-player-seecontext-curated`) to the PR with `--scene … --pr
<N>`, and commit the regenerated PNGs + `index.html` in the same PR.

---

## 11. Acceptance-criteria → design map (mobile portion)

| Criterion (slim-default model) | Satisfied by |
|---|---|
| Default playing chrome = frame + exactly one row of four cells (Close · Move · Curate · See context); no caption/creator/description/chips in the default | §1 model + §2 anatomy + §2.6 glyph set |
| Glyph-above-word cells, ≥46px, AA, focus ring, never glyph/color-alone, no ⤢/⤒ arrows | §2.1, §2.6, §8 |
| Curate + See context are inline expander reveals (not bottom-sheets); non-modal contract preserved; frame stays pinned; body in the sole scroll area; reported height grows on open | §3.1, §4, §0.1, §6.4 |
| No custom Maximize/fullscreen; fullscreen = embed's native button; rotate-to-maximize automatic CSS | §5 |
| Curate reveal: candidate signed-in (✦ Curate / ✕ Not relevant), candidate logged-out (single CTA, no dismiss), curated (#65 slot, placement only); desktop #123 vocabulary + handlers reused | §3.2–§3.5, §7, §10 |
| Post-Not-relevant: optimistic hide + rollback, dock closes, focus → band heading (reuse desktop) | §3.2, §8, §10 |
| See context: candidate (caption · creator · Why suggested) / curated (caption · creator · chips · Context note · Context by @curator); creator identity ONLY here | §4 |
| Move label names the destination; Close tears down + stops playback | §2.3, §2.4 |
| Microcopy verbatim; every control's `aria-label` | §2.3/§2.4, §3.5, §4.3, §8 |
| One-row legibility at 360/390/430 + the 780 stress; 2×2 wrap is the long-locale fallback only | §2.5, §6.1 |
| 88dvh fit numbers (~69% article for 16:9; ~50% for 9:16); invariants hold, non-binding | §6.2, §0.1 |
| Only one expander open at a time; tab order across bar + open reveal | §8 |
| CC-framing dropped from the video creator credit (slim default legitimately omits it); stale refs corrected in the mobile files | §9, §9.1 |
| Catalog scenes added/revised + baseline gallery refreshed | §10 |

---

## 12. Hand-off

- **To Development:** build to this spec — revise `MobilePlayerDock` per §10 (remove the custom
  Maximize + the sr-only-word logic; add the four-cell glyph-above-word bar; generalize `expanded` into
  the **Curate** and **See context** reveals, only one open at a time; add the signed-in **✦ Curate** /
  **✕ Not relevant** in the Curate reveal reusing the #123 treatment + `aria-label`s; update the
  `onDockMetrics` accounting; apply the §9.1 CC-comment corrections). Wire `TopicView` so the mobile
  dock's Curate → `promote` and Not relevant → `dismiss`, with close-on-dismiss + `focusBandHeading()`,
  exactly as desktop #123. Keep every preserved invariant (§0.1). Ship the §3.5/§4.3/§2.3 microcopy
  verbatim. Correct the stale CC-framing in the mobile files (§9.1) in this same pass; **do not touch
  desktop files**. Add/revise the §10 catalog scenes and refresh the baseline gallery
  (`docs/design/ui-screenshots/`). Introduce no server/oEmbed/facade/data-model change.
- **To QA & Review + UX evaluation:** verify against §11 — the slim default is frame + one four-cell
  row and nothing else; the two reveals are inline (non-modal contract intact, no focus-steal, only one
  open at a time); Curate from the player gated + ungated with the post-Not-relevant close + focus-to-
  band; See context carries the right metadata per kind and is the **only** place the creator credit
  appears; no custom fullscreen control exists; the fit numbers hold (~69% article for 16:9); and the
  CC-framing is gone from the video creator credit in the mobile files. UX evaluation judges against
  the refreshed baselines and this spec: on open the **video is the dominant element**, the article
  reads beside it, and act / context are one tap away.
