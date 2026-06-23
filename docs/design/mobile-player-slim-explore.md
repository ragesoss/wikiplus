# Design exploration — Slim mobile player: exactly four controls

**Issue:** mobile-player slim-default (#120 / #135 lineage; #123 coherence) · **Role:** UX / Design ·
**Status:** EXPLORATION to show + iterate — not a final spec, not a build.
**Mockup:** `mockups/inline-mobile-player-slim.html` · **Renders:** scratchpad PNGs (paths in the
hand-off below) · **Grounded in:** `components/topic/MobilePlayerDock.tsx`,
`docs/design/mobile-player-launch.md` (#135), `docs/design/unified-player-mobile.md` (#120),
`docs/design/in-player-curation.md` (#123 desktop), `docs/VISUAL_IDENTITY.md`.

This explores the owner-confirmed model: on mobile a playing video is **the frame + ONE thin control
row, and nothing else** — no caption, creator, description, or chips by default — so the reader keeps
reading the article while it plays. It renders the default slim state plus the two reveals and the
landscape note, and lists the controls/text the owner should weigh in on.

---

## 1. The model (designed exactly to the brief)

A playing mobile video has **exactly four controls**, in one bar below the frame:

1. **Close** — tears down the dock + iframe.
2. **Move** — parks the dock top/bottom (toggle; label names the destination).
3. **Curate** — a single entry point that **expands** to reveal the curation directions.
4. **See context** — a single entry point that **expands** to reveal title + creator + description /
   note + chips.

**Default playing = frame + this one row, nothing else.** All metadata (caption, creator, description,
chips, context note) is hidden until **See context** is opened. Both **Curate** and **See context**
are expanders, not direct actions — they reveal an inline panel.

**No custom Maximize/fullscreen button.** Fullscreen is the **embed's own native ⛶** inside the
iframe; rotate-to-maximize stays an **automatic CSS** behavior (the same `<section>` + iframe flip to
`inset-0` on orientationchange — never `requestFullscreen`). The four controls are the whole chrome.

**No creator credit in the default chrome.** The clips are third-party, mostly nonfree YouTube — not
CC BY-SA content — and the YouTube embed already shows the creator. Our chrome does not duplicate it;
creator info appears only under **See context**. (CC BY-SA remains the obligation on the *Wikipedia
article*, unrelated to player chrome.)

This is a meaningful simplification of the #135 launch dock: the slim title bar (eyebrow + caption +
creator + three stacked-word controls) is **gone from the default**; the chips strip and "Context ▸"
are folded into **See context**; Maximize is dropped from the chrome.

---

## 2. The slim-default layout — one row, and the fit numbers

**Recommendation: ONE row of four equal-width cells, below the frame.** (Mockup §1a–1c.)

Each cell is a real `<button>`, ≥46px tall, a **small plain glyph above a full word label**
(stacked). At 360–390px each cell is ~90–97px wide — the four words (`Close`, `Move to top`,
`Curate`, `See context`) render legibly without truncation. One row reads as a clean, even control
strip rather than a cramped glyph cluster.

### Fit (much better than the #135 launch dock)

Above-frame chrome is now **zero** (the slim title bar is gone). Total dock height
`D = frame F + bar B`, with `B ≈ 46px` (one row). Against the catalog **850px** viewport (and the
stress **780px**):

| Aspect | `F` @390 | `B` | `D` | article slice @850 | @780 |
|---|---|---|---|---|---|
| 16:9 | 219 | 46 | **265px** | **585px (≈69%)** | **515px (66%)** |
| 9:16 (capped `min(46vh,380px)`) | 380 | 46 | **426px** | **424px (≈50%)** | 354px (≈45% @780 with 46vh=359) |

Compared with the #135 launch budget (`D` 375–531px; slice 32–52%), the slim default frees a large
amount of article: the 16:9 case nearly **doubles** the visible article slice (≈69% vs ≈50%), and even
the tall 9:16 Short leaves ≈50%. The **88dvh cap + ≥12dvh article slice invariant still hold** and are
now far from binding — the slim default makes them comfortable, not tight.

The **frame stays `shrink-0`**; the **only scroll area** is an expander panel when one is open. The
collapsed default reports a **small height** via `onDockMetrics` (frame + 46px bar); opening Curate or
See context **grows** the reported height (the panel adds to `D`), and the existing edge-aware page
spacer tracks it live.

### One vs. two rows

I recommend **one row**. The four stacked-label cells fit one row at every in-scope width (360–430px).
A **2×2 wrap fallback** (Close/Move on top, Curate/See context below — mockup §1d) engages only if a
longer-word locale would truncate; it is the same cells reflowing, no merged controls. Default = one
row.

### Move (the toggle) and visual order

The visual top-to-bottom order is **identical** bottom- and top-parked (frame then bar, or the bar
hugging whichever edge) — the bar is always the edge-most-after-frame row. The **Move** label always
**names the destination**: "Move to top" when bottom-parked, "Move to bottom" when top-parked.

---

## 3. The Curate reveal — interaction + microcopy

**Recommendation: an inline expander panel** anchored to the bar (mockup §2), **not** a bottom-sheet
or popover.

- **Why inline over a sheet/popover.** A bottom-sheet implies a modal layer (backdrop, focus
  management, dismiss-on-scrim) — exactly what the player's **non-modal** contract forbids. An inline
  expander keeps the player a plain `<section aria-label="Video player">`: no dialog, no `aria-modal`,
  no trap, no backdrop. It grows the dock height (reported via `onDockMetrics`), the frame stays put
  above it, and the panel is just more of the same bounded scroll region. It also mirrors the existing
  `expanded` "Context ▸" pattern already in the component — one interaction grammar.

- **Candidate (signed in)** — the reveal shows the two directions, stacked full-width:
  - **✦ Curate** — brand fill, white bold, leads. Routes to the existing CurateModal/gate (write a
    context note / vouch).
  - **✕ Not relevant** — white/ink, quiet secondary. Routes to the existing optimistic-hide +
    rollback dismiss. *This is the single Curate entry expanding to reveal directions — NOT two
    side-by-side buttons in the default bar.*

- **Candidate (logged out)** — the reveal shows the **single gated `✦ Curate this video` CTA only**;
  **no "Not relevant"** (a logged-out dismiss can't honestly optimistic-hide — never a false hide).
  Matches desktop #123 State J.

- **Curated clip** — the revealed "act" is **#65 vote/manage**, in the same slot. *Not built here —
  shown for placement only*, so the act-affordance lives in one consistent place across kinds.

### Microcopy (Curate reveal)

| Surface | Text |
|---|---|
| Bar control | **Curate** |
| Direction 1 (candidate) | **✦ Curate** — sub: "Write a context note & vouch for it" |
| Direction 2 (candidate) | **✕ Not relevant** — sub: "Hide this suggestion for the topic" |
| Logged-out CTA | **✦ Curate this video** — "Log in to write a context note and vouch for it." |

`✦` / `✕` are decorative (`aria-hidden`); `aria-label`s match #123 verbatim
(`"Curate this clip: {caption}"` / `"Dismiss as not relevant: {caption}"`) so mobile and desktop share
one vocabulary.

---

## 4. The See-context reveal — interaction + microcopy

**See context** expands an inline panel that is the dock's **sole scroll area**, bounded by a
`max-height` so a long note never grows the dock past the 88dvh cap; the frame above stays fully
visible (mockup §3).

- **Candidate** — title (caption), creator (`@handle · platform`), and the one-line **match reason**
  under a "Why suggested" heading.
- **Curated** — title, creator, the **stance / accuracy chips**, the **context note** (fact vs.
  opinion), and **"context by @curator"**. This generalizes the existing curated "Context ▸" expander
  to all metadata kinds.

### Microcopy (bar + See context)

| Surface | Text |
|---|---|
| Bar control | **See context** |
| Candidate metadata heading | **Why suggested** |
| Curated metadata | chips (`Stance: …`, `Accuracy: …`) · **Context note** · **Context by @curator** |

**"See context"** (not "Info"/"Details") names the wiki+ value — context, the fact-vs-opinion
separation — and reads as the natural verb for what the panel reveals.

---

## 5. Accessibility of the reveals

- Each of the four is a real `<button>`, ≥46px, **full word + plain glyph** — never the obscure ⤢/⤒,
  never glyph- or color-alone. Visible `:focus-visible` ring (brand `#676EB4`; shown gold in the
  mockup for demo contrast only — the real ring is brand).
- **Curate** and **See context** carry `aria-expanded` + `aria-controls` pointing at their panel.
  Toggling **does not steal focus** (no autofocus into the panel); the player stays the non-modal
  `<section aria-label="Video player">` (no dialog / `aria-modal` / trap / backdrop / autofocus).
- The revealed panel is the **sole scroll area**; frame + bar stay pinned (`shrink-0`). Opening a
  panel **grows** the `onDockMetrics` height; the 88dvh cap + ≥12dvh slice still hold.
- Curate directions are real buttons with full `aria-label`s (per #123). Move/Close keep their
  destination-naming `aria-label`s.

---

## 6. Maximize / landscape (no chrome button)

There is no custom Maximize in the four. **Fullscreen = the embed's own native ⛶** (visible inside
every frame in the mockup). **Rotate-to-maximize** stays automatic CSS (the `<section>` + iframe flip
to `inset-0` on orientationchange — never `requestFullscreen`). In landscape the four-control bar is
hidden while the video fills the screen; a thin **Close** remains reachable so the reader is never
stuck; rotating back to portrait restores the slim dock. (This is the existing #135/#120 maximize
behavior minus the explicit Maximize button.)

---

## 7. Desktop coherence (#123)

Desktop #123 is built and approved with **Curate (primary) + Not relevant (secondary) shown directly
below the frame** — both visible at once, no expander. Mobile here uses **Curate-expands-to-reveal-
directions** because space is constrained (the whole point is a slim default; two persistent action
buttons would defeat it).

**Recommendation: deliberately differ now; flag the expander as a possible desktop follow-up.** The
*vocabulary and weight grammar are identical* (Curate brand-primary leads; Not relevant quiet
secondary; text-labeled; same `aria-label`s; same `promote`/`dismiss` handlers), so the two surfaces
read as one family. The *disclosure* differs because the constraint differs — defensible. Desktop has
room to show both directly and is already shipped; redoing it as an expander is **not** recommended
this run. If the owner later wants one identical interaction everywhere, adopting the expander on
desktop is a clean follow-up — do not redo desktop here.

---

## 8. Iteration points the owner should weigh in on

**Controls**
- **IP-1 — One row vs. two.** Recommend **one** (fits legibly at 360–430px). Alt: 2×2 grid always.
- **IP-2 — Curate reveal: inline expander vs. bottom-sheet/popover.** Recommend **inline expander**
  (keeps non-modal; mirrors existing pattern). Alt: bottom-sheet (richer, but adds a modal layer).
- **IP-3 — Glyph-above-word vs. word-only (or icon-left).** Recommend **small glyph above word** (the
  mockup default). Alts: word-only (cleanest, slightly wider) or icon-left-of-word (needs a single
  row to read, tighter at 360px).
- **IP-4 — Native fullscreen only.** Confirmed dropped-custom-Maximize; flagging only so the owner
  sees how the native ⛶ reads inside the embed (faint, bottom-right). No action unless it feels too
  hidden.

**Text**
- **IP-5 — Move label.** Recommend **"Move to top" / "Move to bottom"**. Alt: "Dock at top / bottom"
  (matches some conventions but reads more technical).
- **IP-6 — Curate (bar) vs. revealed ✦ Curate.** Recommend the bar reads **"Curate"** and the
  revealed direction reads **"✦ Curate"** (= #123). Alt: bar reads "Act" / "Curate ▾" to signal it
  expands.
- **IP-7 — "See context" wording.** Recommend **"See context"**. Alts: "Context", "Details", "Info".
- **IP-8 — Curate-direction sub-labels.** Recommend the two helper sub-lines ("Write a context note &
  vouch…" / "Hide this suggestion…"). Alt: labels only (terser, less guidance).
- **IP-9 — Desktop coherence.** Recommend **differ now** (expander mobile / direct desktop), flag the
  expander as a possible future desktop follow-up. Alt: unify later on the expander.

---

## 9. Hand-off

This is exploration. On owner sign-off of the model + the iteration points, the next artifact is a
**buildable design spec** for **Development** that revises `MobilePlayerDock`: replace the slim title
bar with the four-control bar (remove Maximize + the sr-only-word logic), make Curate / See context
the two `aria-expanded` reveals (generalizing the existing `expanded` "Context ▸" pattern), keep the
non-modal contract / `edge`/`toggleEdge` / `onDockMetrics` / 88dvh bound, and remove the creator
credit from the default chrome (it moves under See context). Curation/Editorial owns the parallel
correction to the "credit on every surface" rule.
