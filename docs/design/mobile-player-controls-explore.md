# Design exploration — Mobile player controls (Maximize · Move · Close)

**Status:** EXPLORATION to show & iterate — **not** a committed design spec, **not** a build hand-off.
**Surface:** `MobilePlayerDock` (mobile `< lg`), the slim title-bar controls row.
**Owner feedback (verbatim intent):** the **fullscreen** and **move up/down** controls "especially on
mobile, they don't read clearly and are very small."
**Context read first:** `docs/design/mobile-player-launch.md` (#135 — frame-first, 88dvh bound, the
narrow-width text budget), `docs/design/unified-player-mobile.md` (#120 contract), `docs/design/in-player-curation.md`
(#123 — the desktop "watch + act" model the mobile player must share). Indigo Press palette;
AA, ≥44px targets, text-labeled signals.
**Mockup:** `mockups/inline-mobile-player-controls.html`. **Renders:** the two PNGs reported to the
orchestrator (full comparison + a readable detail of the current problem).

---

## 1. Diagnosis — why the current controls fail on a phone

The slim title bar's right-aligned controls row holds three glyph `<button>`s — **⤢ Maximize/Exit**,
**⤒/⤓ Move to top/bottom**, **✕ Close** — each a 44px target. Below `sm` (640px — every in-scope phone
width) the visible WORD is `sr-only` (`wordClass = "sr-only sm:not-sr-only …"`). On a phone the reader
therefore sees **three bare glyphs jammed top-right, next to the caption**, and:

1. **The glyphs are unguessable.** `⤢` (maximize) and `⤒`/`⤓` (move to a screen edge) are obscure
   Unicode arrows with no platform convention behind them. Even a savvy reader can't tell them apart
   at a glance, and they read as decoration, not controls.
2. **The targets feel small and crowded.** Three 44px hit areas packed into the top-right corner, with
   only `gap-0.5` between them, abut the caption's `flex-1` text column. The *spacing* reads as small
   even though the hit area meets the 44px minimum — they look like a dense cluster, not three distinct
   buttons.
3. **Maximize and Move compete with Close for prime real estate.** All three sit in the one row at
   equal weight, so the most-frequent control (Close) and a rarely-used one (Move) look identical.
4. **The accessible name is fine; the *visible* affordance is not.** AT users get the words (the
   `aria-label` + `sr-only` span). Sighted touch users get nothing but the glyph. The a11y baseline is
   technically met, but the *usability* fails — which is exactly the owner's complaint.

**Why the words were dropped (the constraint the fix must respect).** #135 §1.3/§2.1 measured a real
**text budget**: three full-word `shrink-0` controls in the title bar consume ~270px, which at 360/390px
starves the caption (truncating to "＋…") and the credit (dropping "· platform"). Dropping the visible
words to glyphs was the trade that kept the caption + credit legible. **Any fix must not reintroduce
that overflow** — i.e. it must not put three wide word-buttons back in the title-bar row. The way out
is to **move the wide controls off the title-bar row entirely** (onto their own full-width line, or onto
the frame, or into a menu), so they have room for words without fighting the caption.

The #135 frame-first / `88dvh` fit invariants are otherwise untouched by every option below: the title
bar and frame stay `shrink-0`, the secondary region stays the sole scroll area, and the dock height
budget is unchanged (the recommended option adds one ~44px line, well inside the budget headroom — see §4).

---

## 2. Recommended — Option A: Close in the bar; **Maximize + Move as a labeled control strip below the frame**

**The move:** take Maximize and Move **out of the cramped top-right row.** The slim title bar keeps only
**✕ Close** (the one always-needed control — and with the row now holding a single button, Close's *word*
fits visibly even at 360px). Directly **below the frame**, a one-line **control strip** carries
**⤢ Maximize** and **⤒ Move to top** as full **text + glyph** buttons (outline style on the ink bar,
≥44px). The curation block / action row sits beneath the strip, exactly as #123/#135 place it.

```
┌───────────────────────────────────────────────┐
│ ＋plus · caption (clamp-1)            [✕ Close] │  TITLE BAR — Close only (word now visible)
│ @handle · YouTube                              │
├───────────────────────────────────────────────┤
│            VIDEO FRAME (hero)                   │
├───────────────────────────────────────────────┤
│ [ ⤢ Maximize ]   [ ⤒ Move to top ]             │  CONTROL STRIP — chrome, words + glyph, ≥44px
├───────────────────────────────────────────────┤
│ chips · Context ▸           (curated)           │  SECONDARY REGION (sole scroll area)
│ match reason                (candidate)         │
│ [ ✦ Curate ] [ ✕ Not relevant ]  (watch + act) │  ACTION ROW (#123 model)
└───────────────────────────────────────────────┘
```

**Why this is the recommendation:**

- **It directly fixes the complaint.** Maximize and Move become *legible words at a comfortable size*
  on their own full-width line — no longer obscure glyphs crammed in a corner. The control strip has
  room to breathe, so the targets *feel* as big as they are.
- **It respects the #135 text budget by construction.** The wide controls are no longer in the title-bar
  row, so they can't starve the caption/credit. The title bar holds Close only → the caption gets the
  whole width and Close shows its word too. The overflow problem that forced glyph-only simply can't
  recur here.
- **It's coherent with desktop #123 (the owner's coherence concern).** #123 already establishes the
  pattern "below the frame is where you act," with chrome (Close) in the title bar. Option A keeps that
  spine and adds a **visually distinct chrome strip** (outline buttons on ink) above the **action row**
  (brand-filled Curate primary + quiet Not relevant). The reader sees two clearly-separated jobs:
  *adjust the player* (chrome strip) vs. *decide on the clip* (action row). One model across desktop and
  mobile: title bar = identity + Close; below the frame = everything else, in weighted order.
- **It keeps every control top-level and one-tap** (no menu, no extra surface), preserving Move and
  Maximize as immediate actions for the reader who wants them.
- **Maximize keeps its keyboard/AT path natively** (it's a real button with a word), satisfying #120 §6.5
  / A3 without relying on an on-frame-only affordance.

**Microcopy (proposed, matches #120 §10):** `⤢ Maximize` / `⤢ Exit`; `⤒ Move to top` / `⤓ Move to
bottom`; `✕ Close`. (Glyph optional/decorative — the **word carries the meaning**. See IP-2 on whether
to keep the arrows at all.)

**Cost / trade-off:** one extra ~44px line in the docked dock (the chrome strip). At 390px the heaviest
case (curated, logged out, 16:9) goes from `D ≈ 391px` to `≈ 435px` against a 780px stress viewport —
still ~44% article slice, far inside the `88dvh` ceiling (§4). The strip is `shrink-0` like the title
bar; it does not scroll. The 9:16 + expanded-note stress case is unaffected (the note still scrolls in
the secondary region; the strip is a fixed line above it).

---

## 3. Alternative — Option B: **Maximize on the frame** (native-player convention); **Move demoted to “⋯ More”**

**The move:** question whether Move deserves prime real estate at all. **Maximize** becomes an
**on-frame affordance** — a small button overlaid at the frame's top-right, exactly where every native
video player puts fullscreen, so it's instantly recognizable with no obscure chrome glyph. The title bar
carries **✕ Close** and a single **⋯ More** button; **Move to top/bottom** lives inside the **More menu**
(it's the least-frequent action). The secondary region stays pure curation/action — no chrome competing
with the curation block at all.

```
┌───────────────────────────────────────────────┐
│ ＋plus · caption                 [⋯ More][✕]   │  TITLE BAR — More + Close
│ @handle · YouTube                              │
├───────────────────────────────────────────────┤
│            VIDEO FRAME            [⤢]           │  on-frame Maximize (native convention)
├───────────────────────────────────────────────┤
│ chips · Context ▸ / match reason / actions     │  SECONDARY — curation/action only
└───────────────────────────────────────────────┘
   ⋯ More →  [ ⤒ Move to top ] [ ⤢ Maximize ]      (menu; Maximize repeated for AT)
```

**Why it's attractive:**

- **Maximize gets the most-recognizable possible affordance** (on-frame top-right) — arguably clearer
  than any labeled button, because it matches muscle memory from YouTube/native players.
- **The title bar is the quietest of all options** (Close + a single More), and the secondary region is
  100% curation/action — the cleanest possible separation of "watch" chrome from "act."
- **It honestly demotes Move,** which is plausibly the least-used control, freeing the primary surface.

**Why it's the alternative, not the recommendation:**

- **An on-frame button must also exist as a labeled, keyboard-reachable control** (an on-frame icon over
  a third-party iframe is touch/mouse-first and easy to miss for AT) — so Maximize ends up duplicated
  (on-frame + in the More menu), which is more surface, not less.
- **A menu adds a focus surface and a second tap** for Move, and the prototype has otherwise avoided
  menus on the player. It's more machinery than the complaint requires.
- **On-frame controls can collide with the embed's own chrome** (YouTube draws its own controls in that
  region), risking overlap or accidental taps.

It's the right call **if** the owner wants the maximal native-player feel and is comfortable demoting
Move to a menu; otherwise Option A is simpler and more legible.

*(A lightweight Option C exists implicitly: keep the title-bar row but make Maximize an on-frame button
and Move a labeled button on the strip — a hybrid of A and B. Flagged under IP-3 rather than drawn,
to keep the comparison clean.)*

---

## 4. Fit check (so the recommendation is buildable, not just pretty)

The #135 budget headroom absorbs Option A's extra strip line. At the stressing 780px viewport, 390px
width, heaviest case (curated · logged out · 16:9):

| | #135 today | Option A (adds ~44px strip) |
|---|---|---|
| Title bar `T` | 60 | 60 (Close only — same height) |
| Frame `F` (16:9) | 219 | 219 |
| Control strip | — | ~44 |
| Secondary `S` (chips + Context + CTA) | 112 | 112 |
| **Dock `D`** | **391px (50%)** | **~435px (~56%)** |
| Article slice | ~389px | ~345px (~44%) |

~44% is still a *meaningful* article slice (multiple lines + a heading), and `~435px` is far under the
`88dvh ≈ 686px` ceiling. The 9:16 case (frame capped at `min(46vh,380px)`) plus the strip is still well
inside the cap, and the expanded-note case is unchanged (note scrolls in the secondary region; the strip
is a fixed `shrink-0` line). **Maximized mode is unchanged** — the thin bar already shows `⤢ Exit` +
`✕ Close` with words at full width. Option B adds **no** line (it removes the wide controls from the
column entirely), so its `D` is essentially #135's.

---

## 5. Iteration points the owner should weigh in on (controls + text/labels)

Mirroring how the desktop spec (#123) flagged IP-1…IP-7, here are the decisions to settle before this
becomes a committed spec:

- **IP-1 — Which option.** Recommend **A** (control strip below the frame): most legible, simplest, no
  menu, coherent with #123. Alt: **B** (on-frame Maximize + Move in “⋯ More”) for maximal native feel.
- **IP-2 — Keep the arrow glyphs at all?** Recommend keeping a glyph *beside the word* but **letting the
  word carry the meaning** (`⤢ Maximize`, `⤒ Move to top`). Alt: **drop the obscure arrows entirely** and
  show word-only buttons (cleanest, removes the unguessable symbol). Sub-question: if kept, swap `⤢` for
  a more conventional fullscreen glyph (corner-expand `⛶` / `⤢` / an outward-arrows icon) and `⤒/⤓` for
  up/down chevrons (`▲ Move to top` / `▼ Move to bottom`).
- **IP-3 — Does “Move” deserve a top-level control on mobile?** Recommend **yes, but secondary** (on the
  strip in A, or demoted to the menu in B). It's the action that lets a reader uncover the part of the
  article the dock is covering — useful but infrequent. Alt: drop it from mobile entirely (the dock
  always parks bottom) — *not* recommended (removes a real "get it out of my way" affordance).
- **IP-4 — Maximize label vs. on-frame icon.** Recommend the **labeled button** (A) as the primary path
  (legible + keyboard-native). Alt: **on-frame icon** (B) as primary with a labeled fallback. (Either way
  Maximize must remain keyboard-reachable per #120 A3.)
- **IP-5 — Strip vs. title-bar for the chrome (Option A internal).** Recommend the **strip below the
  frame** (frees the title bar, fits the words). Alt: keep them in the title bar but stacked under Close
  on a second row — rejected (re-creates the cramped cluster, eats title-bar height).
- **IP-6 — Move label wording.** Recommend **“Move to top” / “Move to bottom”** (names the destination,
  verbatim from #120 §10). Alt: **“Dock at top” / “Dock at bottom”**, or pair the word with up/down
  chevrons (see IP-2).
- **IP-7 — Visual weight of the chrome strip vs. the action row (coherence).** Recommend chrome =
  **outline buttons on ink** (quiet), action row = **brand-filled Curate + white Not relevant** (the
  #123 weights), so "adjust the player" never competes with "decide on the clip." Alt: make the chrome
  strip even quieter (text-only links) if the owner finds two button styles below the frame busy.

---

## 6. What happens next (not done here)

This is an exploration. On the owner's pick + IP answers, the UX role writes the **committed design
spec** (states, microcopy, responsive, a11y, fit math, catalog scenes) as the build hand-off for #123 /
the mobile player — coordinated with the Development agent currently building #123 on `MobilePlayerDock`,
`TopicView`, `CandidateBits`, and `PinnedPlayer`. No application code is touched by this exploration.
