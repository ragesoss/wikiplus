# Design spec — About-page projector "warm-up" intro (motion / choreography)

**Type:** UX motion/choreography design spec · **Milestone:** Functional prototype
**Status:** Design spec (Phase 2) — the buildable contract Development implements against; written
**before** any implementation code. **Branch:** `about-projector-toggle`.
**Implements / satisfies:** the Product spec `docs/specs/about-projector-warmup.md` (HEAD `dba30b1`,
AC1–AC18) in full.
**Animates into (the fixed endpoint):** the committed static About **poster** on `main` at `178c148`
("Compose About as one full-page poster in a single theater field").

This spec fixes the motion design — phase boundaries, overlaps, easing, the flicker rhythm, the
lamp dim→bright ramp, the **beam opacity fade-in** (no grow), the **dim-cool→illuminate miniature
treatment**, the **＋plus fade-in** (opacity only), the **red→green status-light step**, the
**click/keyboard power toggle** (control treatment, accessible name, OFF↔ON transitions), the
**dynamic miniature title** (fit-cap + the old→new flicker on a restarted power-on), the
reduced-motion end-state, the per-tier choreography, and the determinism hook for capture. It does
**not** ship code, and it does **not** restyle the static look — the settled frame is
pixel-equivalent to `178c148` (AC2).

> **This is the post-deploy refinement iteration.** The first version shipped to production; the owner
> reviewed it live and reversed several motion decisions. This spec **supersedes** the prior version's
> background-surface dim/brighten, beam grow-along-throw, and plus scale+slide. The substantive
> motion changes this revision makes:
>
> 1. **No background change.** The whole-field surface dim/brighten and **any** `.about-stage`-scoped
>    dim overlay are **removed**. The scoped overlay revealed the stage's rectangular outline in the
>    dark start state — the deployed flaw. The background theater field (`.about-theater-field`) is
>    **static** at its final committed tone, one continuous tone across the whole page at every frame.
>    The intro animates **only** the projector, the beam, and the page/miniature.
> 2. **Beam = fade-in, not grow.** The three cones are at their **final geometry from the first frame**
>    and ramp **opacity 0 → full** as the lamp warms (reaching full at lamp-max). No `scaleX`, no
>    translate, no scale on the beam (this removes the jitter the owner disliked).
> 3. **Miniature dim-cool → illuminate.** The miniature begins **darker + cool** (an unlit-screen
>    fluorescent shade) and transitions to its committed lit appearance, reaching full at lamp-max
>    alongside the beam — via a treatment **confined to the miniature element only** (it must not bleed
>    into or dim the surrounding field).
> 4. **＋plus = fade-only.** The plus cards/clips reveal by **opacity only** — no scale, no slide.
>    Onset after the beam.
> 5. **Red→green status light is step 0.** The status light is **RED** in the off state; the **first**
>    on-step is RED → GREEN, then the warm-up begins.
> 6. **Click-to-toggle power.** The projector becomes a **real, accessible control** (a `<button>`):
>    OFF↔ON, focus-visible, state-reflecting accessible name, pointer + Enter/Space.
> 7. **Dynamic recently-curated title + old→new flicker.** The miniature title is picked from recent
>    curations that **fit** the title line (fallback `"Acer palmatum"`), re-picked on each power-on,
>    cross-flickering old→new during the lamp flicker on a restarted power-on.

> **Persona / story this serves.** Priya, the first-time visitor (VISION primary persona; About §0).
> *"As a first-time visitor, I want to grasp — without reading — that wiki+ takes a Wikipedia article
> and adds a curated, contextualized video layer on top of it, so I immediately understand what this
> product is."* The static poster answers *"what does it look like?"*; this intro answers *"what
> happens — what does wiki+ do to an article?"* by sequencing the causal story in the order it means:
> **the article exists first (dim, unlit) → the projector powers on (red→green, lamp strikes) → the
> beam reaches the page → the page lights up → the ＋plus layer appears because the light arrived.**
> Motion conveys nothing the still doesn't; it sequences it. The thesis is always available in words
> (the card copy + the `sr-only` scene description) — the motion is craft, never the carrier of
> meaning (AC9).

---

## 0. The elements this choreography maps onto (the real markup)

All of the following already exist on `178c148` / the current branch; the intro adds appearance
animation over them. No new DOM for the motion itself, save the **power-control wrapper** (§6) and the
**miniature dim-cool overlay** (§1.2-D). No new motion tokens beyond a cool-tint value (§1.2-D) and a
red status-light value (§1.2-A) — small cosmetic tokens, not data/schema.

| # | Element | Component / node | Role in the intro |
|---|---|---|---|
| A | **Status light** | a small circle on the faceplate in `Projector.tsx` (today a single green dot at `cx176 cy236`) — split into a **RED off layer** + a **GREEN on layer** | **Step 0** — RED → GREEN (the first observable action). |
| B | **Lamp** | the white `+` aperture (clipped to `#proj-pclip`) + the two warm `bloom` radials + the glass lamp radial in `Projector.tsx`, grouped as `.about-lamp-light`, **over the always-present OFF-state lens base** (`.about-off-lens`, §2.1.1) | **Step 1** flickers, **Step 2** ramps dim→bright, starting from the designed OFF lens (dark interior + geometric `+`), not a dimmed copy of the lit lamp. |
| B′ | **OFF-state lens base** | the static `.about-off-lens` `<g>` in `Projector.tsx` (dark interior `#201c3a` + geometric `+` `#2e2a52` + faint reflection) | The floor the lamp lights up over; visible by geometry from t = 0 so the lens is never an empty hole. Crossfades out by lamp-max (§2.1.1 / §2.2). |
| C | **Beam** | the three nested warm cones (+ motes) in `Beams.tsx` (the `.about-beam` group) | **Step 3** — **fades in (opacity 0 → 1) at its committed final geometry**. No grow/scale/translate. |
| D | **Topic miniature** | `TopicMiniature.tsx` as a whole — the article ground (E) + the ＋plus layer (D′) + a new **`.about-mini-cool` dim-cool overlay** (§1.2-D) scoped to the miniature element | **Step 4** — the miniature **warms from dim+cool to its committed lit appearance** (the cool overlay fades + lifts), reaching full at lamp-max. **Confined to the miniature element.** |
| D′ | **＋plus layer** | the separable `.about-plus` groups in `TopicMiniature.tsx` — the right-gutter **overview + contents cards**, the **general strip** (3 clips), and the bottom **tall portrait clip** | **Step 5** — **fades in (opacity only)** onto the already-present article ground. No scale/slide. |
| E | **Article ground** | in `TopicMiniature.tsx` — the **title input** (`MiniatureTitleInput`), the **body lines**, the **section-heading bars** | Present and visible from the **first painted frame**; NOT animated in box/opacity (AC5). The **title text** participates only in the old→new flicker on a restarted power-on (§5). |
| F | **"How it works" card** | `HowItWorks.tsx` / `.how-it-works-card` | Present + legible + lit from the first frame; **not part of the choreography** (AC6/AC7). Never flickers, dims, or reveals. |
| G | **Background theater field** | `.about-theater-field` radial on `<main>` | **STATIC — never animates** (AC4b). At its final committed tone from the first painted frame through every frame of the intro and any toggle. |

**Stage geometry the choreography depends on** (read from `Centerpiece.tsx` / `Beams.tsx`): the full
poster scene lives in the scaled **1280×880** `.about-stage` (clipped, `overflow:hidden`); the
projector div is at `left:8 top:600 width:420`, the miniature div at `left:700 top:270 width:560`. The
beam cones throw **up-right** from the apex (~`287,773`) to the miniature's left edge. **In this
revision the beam does not move** — it occupies that committed geometry from t = 0 and only its
opacity changes. The miniature width is **560** in both the full-scene stage and the miniature-alone
stage, so the title line is the same width everywhere the miniature shows (relevant to the fit-cap,
§4 / §5).

**When the full poster scene renders (the height-aware gate).** The full poster scene — projector,
beam, status light, and the dropped miniature in the 1280×880 stage — renders only when the viewport
is **both ≥ lg wide (1024px) AND ≥ 820px tall**. On a viewport that is ≥ lg wide but **< 820px tall**
(e.g. iPad-Mini landscape 1024×768, or a short ≥ lg desktop window), the width-scaled stage is too
tall for the vertically-centred content area, so the page renders the **miniature-alone layout**
instead — the same reduced composition the < lg tier uses (the "How it works" card stacked above the
lone miniature, the reduced intro of P4+P5, **no** projector, beam, status light, or power toggle).
So the **status-light red→green step (P0) and the projector power toggle (§3 / §6) apply only on the
wide-AND-tall full scene**, not merely "≥ lg." The threshold is **820px**
(`docs/design/about-height-aware-scene.md`).

---

## 1. The timeline / choreography (the contract)

**Total duration chosen: 2000 ms** (within the spec's ~1.6–2.6 s range). Long enough to read as a
deliberate "warm-up," short enough that the visitor never waits to interact (interaction is *never*
gated regardless — AC7/AC8). Shorter than the prior 2200 ms because the plus reveal is now a single
synchronized fade (no per-card stagger to play out) rather than a staggered slide. All times are **ms
from the scene's first painted frame** (t = 0, the power-on moment). All animated properties are
**`opacity`, `filter`, and one tiny non-layout `transform` (the status-light crossfade is opacity
only)** — GPU-composited; **no layout/paint property and no position/scale on beam, plus, or any
element** → zero CLS. Every element occupies its **final layout box** for the whole intro; only its
appearance changes. **The background field has no keyframe at all.**

### 1.1 Phase boundaries (onset order is fixed + observable — AC3)

```
 t(ms)   0    180        320   520        1180  1240                         2000
         │ P0 │   P1      │  P1 │   P2      │     │  (P3+P4 reach full)        │ P5 end
 ────────┼────┼───────────┼─────┼───────────┼─────┼────────────────────────────┼────────►
 Status  ██ RED→GREEN (P0, 0–180)  ── GREEN held ─────────────────────────────────────────
 Lamp         ███ flicker (P1, 180–520) ████ warm-up dim→bright (P2, 520–1240) ── max ─────
 Beam                              ░░░░░░░ opacity fade-in (P3, 560→1240) ░░│ full ─────────
 Mini-cool                         ▒▒▒▒▒▒▒ cool overlay fades 1→0 (P4, 560→1240) ▒│ lit ────
 Plus                                                  · · · · plus fade-in (P5) · · · · · ·│
 Background  ───────────── STATIC, final tone, NEVER animates (AC4b) ──────────────────────
```

- **P0 Status light RED → GREEN** — `t = 0 → 180 ms`. The **first observable action**: the red layer
  crossfades to the green layer over **180 ms** (`ease-in-out`). Nothing else changes before P0; the
  flicker begins only after the light has gone green.
- **P1 Lamp flicker** — `t = 180 → 520 ms` (≈ 340 ms window of uneven strikes; begins after P0).
- **P2 Lamp warm-up (dim→bright)** — `t = 520 → 1240 ms` (720 ms). Begins as the flicker resolves;
  reaches **max brightness at t = 1240**.
- **P3 Beam opacity fade-in** — `t = 560 → 1240 ms` (680 ms). The cones are at final geometry the whole
  time; the group's opacity ramps **0 → full**, reaching full **at lamp-max (t = 1240)** alongside the
  lamp. Starts ~40 ms after warm-up begins (the lamp is lighting, so the beam emerges *from* a lighting
  lamp). **No transform.**
- **P4 Miniature illuminate (dim-cool → lit)** — `t = 560 → 1240 ms` (680 ms). The miniature's dim-cool
  overlay (§1.2-D) fades/lifts in lock-step with the beam, reaching the **committed lit appearance at
  lamp-max (t = 1240)** — the AC4 coupling. Same window as the beam.
- **P5 ＋plus fade-in** — `t = 1240 → 2000 ms` (760 ms). **Onset after the beam** — the plus layer
  begins fading in **as the beam lands and the page lights up** (t = 1240), opacity 0 → 1 with **no
  motion**, settled by **t = 2000**.

**Settle:** the whole scene is visually static by **t = 2000 ms**; the intro is fully torn down (no
running animation, no residual inline style) by the **2000 ms** settle guarantee Dev exposes to
capture (§7). (Dev may keep a small fallback margin — the readiness signal flips at the last
animation's finish, with a hard fallback timer; see §7.)

Onset order holds at every sampled frame (AC3): the status light reads **red at the first frame** and
flips **green before the lamp begins to flicker**; the lamp shows uneven flicker before steady
brightness; the beam's opacity rises from 0 toward full as the lamp warms, reaching full **at**
lamp-max; the miniature's illumination rises with the beam, reaching full **at** lamp-max; the plus
layer's onset is **after** the beam (t = 1240). **The background field never animates.**

### 1.2 Keyframe table (per element)

Easing names map to standard cubic-béziers; Dev may implement as CSS `animation` keyframes or WAAPI.
Values are **opacities / a filter ramp on existing markup**, never new geometry.

#### A — Status light (RED → GREEN) — step 0

The status light today is one green circle (`Projector.tsx`, `cx176 cy236 r5`,
`fill var(--color-sprout)`). Split it into **two stacked circles of identical geometry**: a **red off
layer** beneath (`fill: var(--color-status-off-red)` — a new cosmetic token, e.g. `#C0392B`, a
saturated indicator red that holds AA-adjacent contrast against the indigo faceplate) and the existing
**green on layer** above (`fill: var(--color-sprout)`). Animate **only opacity** — the green layer
crossfades **0 → 1** while the red layer crossfades **1 → 0**, both over `t = 0 → 180 ms`,
`cubic-bezier(0.4,0,0.2,1)` (*ease-in-out*).

| t (ms) | red layer opacity | green layer opacity | reads as |
|---|---|---|---|
| 0   | 1.00 | 0.00 | **RED** — projector off (AC1d) |
| 90  | 0.50 | 0.50 | the indicator flipping |
| 180 | 0.00 | **1.00** | **GREEN** — projector powering on; the warm-up may begin |

**Defaults (no-animation / settled / reduced-motion):** red layer opacity **0**, green layer opacity
**1** — so the committed static poster (green light) is the rest state; the red layer only appears
while the intro/toggle drives the OFF state. The status light is **decorative** (AC9) — `aria-hidden`
as part of the SVG; the on/off state reaches assistive tech via the control's accessible name (§6).

#### B — Lamp (the `.about-lamp-light` group, over the `.about-off-lens` base)

The lamp's "brightness" is the **opacity of the `.about-lamp-light` group** (white `+`, glass radial,
two blooms) **rising over the always-present designed OFF-state lens base** (`.about-off-lens`,
§2.1.1). At t = 0 the lit group is at opacity 0, so the lens reads as the **designed OFF projector** (a
dark interior with the `+` visible by *geometry*, a faint reflection, no bloom). As the group's opacity
rises, the white-hot `+` and warm bloom "light up" over that off geometry; at full they are opacity 1 =
today's lit projector, fully occluding the off base (§2.2).

> **Not a 6 %-opacity glow.** The intro must **not** start the projector as the lit lamp at near-zero
> opacity. It starts as the committed **OFF** state — the `+` is legible while off because it reads by
> *geometry*. The lit-layer opacity below is what *animates*; the off base (B′) is the static floor it
> animates over (and crossfades out — §2.1.1).

Fold the flicker (P1) and warm-up (P2) into **one keyframe** over `t = 0 → 1240 ms` (so no
animation-list order can override the strikes), but **the lit layers stay at 0 until t = 180 ms** so
the red→green flip (P0) is the unambiguous first action — the lamp does not strike before the light is
green. `about-lamp-up 1240ms linear 1 both` (linear so every strike keyframe actually renders; the
snap is in near-coincident key pairs):

| t (ms) | `.about-lamp-light` opacity | what reads on screen |
|---|---|---|
| 0    | **0.00** | the designed OFF lens (lit layers absent); status light still flipping red→green |
| 180  | 0.00 | P0 done (light is green); lamp about to strike |
| 210  | 0.55 | first strike (quick) — white `+` + bloom flash over the off `+` |
| 250  | 0.06 | drop — back toward the bare OFF lens |
| 290  | 0.70 | second strike |
| 320  | 0.08 | drop (shorter gap — uneven) |
| 380  | 0.40 | weak third strike |
| 410  | 0.05 | drop — nearly the OFF lens again |
| 470  | 0.85 | fourth strike — the "catch" (longer gap before it) |
| 500  | 0.30 | settle dip |
| 520  | 0.30 | flicker end — hold low, hand off to the warm-up ramp |
| 760  | 0.78 | warm-up — white `+` + warm bloom now dominate; off geometry mostly buried |
| 1000 | 0.94 | off base all but fully occluded by the glow |
| 1240 | **1.00 (max — the committed lit projector)** | lit group fully opaque → OFF base completely hidden |

Use near-coincident key pairs (a ~4 ms rise/fall window around each peak) so each strike reads as a
*snap*, not a fade — that is the projector-striking character. Keep peaks below 0.9 so P1 never reaches
full brightness before P2 (preserves the onset order: flicker → warm-up). After t = 1240 the lamp holds
at opacity 1 = the static poster lamp; **no residual transform** (the blooms are not scaled — their
committed radius is the final look). The `.about-off-lens` base crossfades `1 → 0` over `t = 180 →
1240` (held near full through the flicker, gone by lamp-max — §2.1.1).

#### C — Beam (the three cone `<polygon>`s + the motes `<g>`) — fade-in, no motion

The beam **fades in into its committed final geometry** (AC5b). The three cones are at their **final
size/position from the first frame they animate** — there is **no `scaleX` grow, no extend-along-the-
throw, no translate/scale**. Animate **group opacity only** on the wrapping `.about-beam` `<g>`:

`about-beam-fade 680ms cubic-bezier(0.33,0,0.67,1)` (*ease-in-out* — light arriving softly), `560ms`
delay (starts ~40 ms after warm-up begins), reaching full **at lamp-max (t = 1240)**:

| t (ms) | `.about-beam` group opacity | geometry |
|---|---|---|
| 560  | 0.00 | final (committed) — fixed |
| 720  | 0.30 | final — fixed |
| 1000 | 0.72 | final — fixed |
| 1240 | **1.00** | final — fixed |

After t = 1240 the beam holds at opacity 1 (the per-cone opacities 0.16/0.24/0.36 and the gradient are
the committed look — the *group* opacity returns to 1, layering over those). **No transform key at any
frame.** The motes ride the group opacity (same `<g>`), so they simply fade in with the cones — no
separate animation. **The beam is `pointer-events:none`** so it never intercepts a click meant for the
projector control or the title input.

> **AC12 / AC4b horizontal-scroll + continuity guard.** Because the beam never scales or translates, it
> occupies its committed box at every frame and can never push the page wider, and there is no
> growing/shrinking edge to read as motion against the static field. The whole stage is
> `overflow:hidden` clipped to its box.

#### D — Topic miniature: dim-cool → illuminate (confined to the miniature element)

The miniature begins **darker + cool** (the dim, cool-fluorescent shade of an unlit screen) and warms
to its committed lit appearance, reaching full **at lamp-max (t = 1240)**, alongside the beam (AC4
coupling). **The mechanism is confined to the miniature element — it must not dim or brighten the
surrounding background field** (AC4b). There is **no warm halo** (AC2): the brightening removes the
dim/cool tint from the miniature's *own surface*; it does not add a glow tracing the page's rectangle.

**Mechanism (recommended): a single cool-tinted dim overlay scoped INSIDE the miniature**
(`.about-mini-cool`). A decorative `aria-hidden`, `pointer-events:none` veil positioned `inset:0`
**inside the `TopicMiniature` root** (which is `position:relative; overflow:hidden`, so the overlay is
clipped to the miniature's own rounded rectangle and **cannot bleed past its edge into the field**). It
sits at the **highest z inside the miniature** (above the article ground and the plus layer, below
nothing outside the miniature), filled with a **cool blue-grey** at a starting opacity, using
`mix-blend-mode: multiply` so it **darkens-and-cools** the miniature's bright white/grey surface (a
multiply of a cool grey reads as the bluish dim of an unlit indoor screen) without painting a flat
slab. It **fades opacity → 0** over the illuminate window, so the miniature resolves to its **exact
committed lit surface** when the overlay is gone (no change to any committed miniature token — AC2).

- **Cool tint (off-state) — new cosmetic token** `--color-mini-cool: #2A3550` (a desaturated cool
  blue-grey; the "cool fluorescent / unlit screen" shade). Multiplied over the miniature's white/grey
  ground it yields a dim, slightly-blue cast — clearly *unlit indoor*, not black.
- **Overlay starting opacity: 0.62** (the AC1c "darker + cool, observably below the committed lit
  brightness and warmth" off state). At 0.62 multiply, the white ground reads as a muted blue-grey and
  the body/section bars dim — unmistakably an unlit screen, while the title text stays **readable**
  (AC17 — multiply darkens but does not hide; the black title on the dimmed-white ground keeps high
  contrast; see §5). The plus layer is hidden at this point anyway (it has not faded in).
- **Belt-and-braces (optional, Dev's choice):** if multiply-only does not read cool *enough* at the
  start, pair it with a tiny `filter: saturate(0.85) brightness(0.9)` on the miniature root that ramps
  to `saturate(1) brightness(1)` over the same window. The overlay alone is the contract; the filter is
  a permitted reinforcement (still GPU-composited, still confined to the miniature). **Do not** put any
  brightness/filter on the `.about-stage` or `<main>` — that would dim the field (AC4b violation).

`about-mini-illuminate 680ms cubic-bezier(0.33,0,0.67,1)` (*ease-in-out*), `560ms` delay (same onset as
the beam), reaching full **at lamp-max (t = 1240)**:

| t (ms) | `.about-mini-cool` overlay opacity | reads as |
|---|---|---|
| 560  | 0.62 | dim + cool unlit screen (AC1c) — held until the beam begins |
| 720  | 0.42 | the page starting to light under the arriving beam |
| 1000 | 0.16 | warming, cool cast lifting |
| 1240 | **0.00 (overlay gone — committed lit miniature)** | fully lit, warm/bright, cool tint gone — at lamp-max (AC4) |

**Defaults (no-animation / settled / reduced-motion):** `.about-mini-cool` opacity **0** (the committed
lit miniature shows through untouched), any optional filter at its identity values. The coupling (AC4)
is structural: this overlay reaches **0 at t = 1240**, the same instant the lamp reaches max and the
beam reaches full — so the miniature cannot reach full illumination before lamp-max. Drive all three
(lamp, beam, mini-cool) off the same `t = 1240` end (equal-end keyframes or a shared WAAPI timeline) so
the coupling is structural, not three timers that could drift.

> **`< lg` parity.** At `< lg` (miniature alone, no projector/beam) the same `.about-mini-cool` overlay
> on the same miniature element fades `0.62 → 0`; without a beam to couple to, it simply runs over the
> reduced-intro window (§4.3). Same mechanism, same element — no second implementation.

#### D′ — ＋plus layer (the `.about-plus` groups in `TopicMiniature.tsx`) — fade-in, no motion

The plus layer reveals **onto the already-present article ground** (AC5): the title input, body lines,
and section bars are at full opacity from t = 0 and never animate in box/opacity. Only the indigo plus
groups transition hidden → visible, by **opacity only** — **no scale, no slide, no translate** (AC5).
Each group occupies its **final layout box** the whole time.

All four plus groups fade in **together** (a single synchronized fade — no stagger, since there is no
beam-fill direction to time against now that the beam doesn't grow): `about-plus-fade 520ms
cubic-bezier(0.33,0,0.67,1)` (*ease-in-out*), `1240ms` delay (onset **after** the beam lands), opacity
`0 → 1`, settled by **t = 1760** (within the t = 2000 window; the slightly-early settle leaves margin).

| group (node) | property | onset (ms) | settled (ms) |
|---|---|---|---|
| **General strip** (`.about-plus--strip`) | opacity 0 → 1 | 1240 | 1760 |
| **Overview card** (`.about-plus--overview`) | opacity 0 → 1 | 1240 | 1760 |
| **Contents/TOC card** (`.about-plus--contents`) | opacity 0 → 1 | 1240 | 1760 |
| **Tall portrait clip** (`.about-plus--portrait`) | opacity 0 → 1 | 1240 | 1760 |

> The article ground stays put; the plus groups occupy their **final layout boxes** the whole time
> (they animate `opacity` only — no `transform`), so the miniature never reflows (CLS = 0) and the
> input/ground are never displaced. **No residual transform/opacity** on any plus group at settle (all
> at `opacity 1` = today's static cards). The `.about-plus--strip` group is `aria-hidden` and
> `pointer-events:none`, so a fade-in plus group never intercepts a click meant for the title input.

> **Removing the prior stagger + slide is deliberate (owner directive #4):** the prior version slid
> each card ~10–14 px along the throw and staggered the four groups 120 ms apart. This revision is a
> single synchronized **opacity** fade — no motion — so QA should assert **no `transform` keyframe** on
> any `.about-plus` group and **no per-group `animation-delay` difference** (all four share one delay).

### 1.3 What animates vs. what is static (audit)

- **Animated (motion-gated):** the status-light red/green layers (A), the lamp light group (B) +
  the off-lens crossfade (B′), the beam group (C, opacity only), the miniature cool overlay (D, opacity
  + optional filter, scoped inside the miniature), each plus group (D′, opacity only). **All
  `opacity`/`filter` only — no `transform`, no position/scale on any element.**
- **Static from t = 0 (never animated):** **the background theater field (G — `.about-theater-field`):
  it has NO keyframe and is at its final committed tone every frame (AC4b)**; the card (F); the article
  ground (E — title input, body lines, section bars; the title *text* swaps only on a restarted
  toggle-ON, §5); the projector *body* (chassis, lens stack, feet, dials, faceplate — only the *light*
  layers + the status light animate); the miniature drop shadow; layout/flow of every box.

---

## 2. Initial (pre-illumination) vs. final state (the bookends)

### 2.1 Initial state at the first painted frame (t = 0) — AC1

| Element | t = 0 state |
|---|---|
| Status light (A) | **RED** (`≥ lg`) — red layer opacity 1, green layer 0. (AC1d) |
| Lamp light group (B) | opacity **0.00** — lit layers fully absent; the projector renders in its **designed OFF state** via the always-present `.about-off-lens` base beneath it (§2.1.1, AC1a). |
| OFF-state lens base (B′) | **fully present + visible** (the dark off interior, geometric `+`, faint reflection) — this is what reads as "the projector is off." |
| Beam (C) | **hidden** — group opacity 0, **at final geometry** (not scaled, not translated). (AC1a) |
| Topic miniature (D) | **dim + cool** — `.about-mini-cool` overlay at opacity **0.62** (below committed lit brightness/warmth, cool-tinted), **confined to the miniature**. (AC1c) |
| ＋plus layer (D′) | **hidden** — opacity 0; the miniature shows the **bare article ground only** (title + body lines + section heads). (AC1b) |
| Article ground (E) | **fully present + visible** — title input focusable + **readable** (the picked title, §5), body/section bars painted (dimmed by the cool overlay but present). |
| Background field (G) | **at its final committed tone** — NOT dimmed, no overlay, no stage outline. (AC1, AC4b) |
| Card (F) | fully present, lit, legible. |

All AC1 conditions hold at the first painted frame: **status light red** (≥ lg), **lamp off** (designed
OFF lens, lit layer opacity 0), **beam absent** (opacity 0), **plus hidden**, **miniature dim+cool**,
and **background at final tone** — each independently testable. The off state differs from settled-on
**only** by: lamp off, beam absent, ＋plus absent, miniature dim+cool, red status light. **The
background field tone equals its settled value** (no full-field dim, no stage-box overlay).

#### 2.1.1 The designed OFF-state lens base (`.about-off-lens` group)

This is **already implemented** on the current branch (`Projector.tsx`) and is **unchanged** this
revision — it is the static floor the lamp lights up over. Restated for completeness: a small static
`<g className="about-off-lens">` painted **above** the cool lens ellipse stack and **below** the
`.about-lamp-light` group, composed of (1) a **dark off interior** (`#201c3a`, the lit-glass extent so
no warm rim shows around the off lens), (2) a thin interior rim stroke, (3) a **geometric `+`** clipped
to `#proj-pclip` (`fill #2e2a52`, faint `#433d72` edge at 0.6 — read by *geometry*, never a glow,
sized to nearly fill the glass, inset of the lit `+`'s path so its edge is occluded pixel-for-pixel at
settle), and (4) a **faint glass reflection** (`#8086ca` at ~0.2, rotated ~−32°). Its **CSS default
opacity is 0** (`.about-off-lens` in globals.css), so a reduced-motion / no-JS / settled render never
shows the OFF lens. During the intro it is visible from t = 0 and **crossfades out `1 → 0` by lamp-max
(t = 1240)** so the settled lens is byte-identical to the committed lit poster (§2.2). The whole group
is `aria-hidden` (the SVG is). All tokens (`--color-lens-off-interior`, `--color-lens-off-rim`,
`--color-aperture-off`, `--color-aperture-off-edge`, `--color-glass-sheen`) already exist.

### 2.2 Final (settled) state — AC2

After t ≤ 2000 ms (and at all times once settled) the scene is **pixel-equivalent to `178c148`**:

- Status light: red layer opacity 0, **green layer opacity 1** (the committed green light).
- Lamp light group opacity **1** (committed lit projector); no residual transform.
- **OFF-state `.about-off-lens` base** at opacity 0 (crossfaded out + occluded; present in the DOM,
  painting nothing the viewer can see — see the AC2 occlusion note below).
- Beam group **opacity 1** at its committed geometry (the three cones at their committed per-cone
  opacities); **no transform was ever applied**, so identity by construction.
- All four plus groups opacity 1 (committed indigo cards/clips); no transform.
- Miniature cool overlay opacity **0** (fully transparent; the committed lit miniature surface).
- **Background field = the untouched committed radial** (it never changed); miniature = soft drop
  shadow, **no halo**.
- Card in its tier-appropriate position (overlaid upper-left `≥ xl`; first-in-flow stacked otherwise).

**No element carries a non-final inline opacity/transform/brightness/tint once settled** (AC2-ii /
AC10): the animations complete to identity/opacity-1 values equal to the static CSS, and `<Centerpiece>`
tears down the `.about-intro` class so the DOM re-reads as today's static poster.

> **AC2 — the settled lens is pixel-equivalent to the committed lit `Projector.tsx`.** The
> `.about-off-lens` group adds DOM but contributes **zero visible pixels once lit** — both by its
> opacity reaching 0 (crossfade, §2.1.1) and by paint-order occlusion (it sits below the opaque lit
> group; the lit glass radial and white `+` paint over the off interior + off `+`, the blooms over the
> reflection). Net: the visible lens is byte-for-byte the committed lit lens. The off base is **never**
> `display:none`'d (so a re-mount/replay starts cleanly from the off lens again).

---

## 3. The OFF↔ON power toggle — interaction model (AC13–AC15)

The projector becomes a **real, accessible power control** wherever it is present (`≥ lg` only — see §4).
This section is the interaction contract; §6 is the control's structure + accessible-name wording.

### 3.1 On-load auto-intro (unchanged behavior, additive control)

On load with motion enabled, the scene **auto-plays the full power-on sequence once** (§1) and settles
to the ON state (AC2). The control's existence does **not** change this: it does **not** auto-focus, does
**not** move focus into the scene, and the auto-intro runs exactly as §1 regardless of the control (AC15).
This is the **first power-on** — no old→new title flicker (§5).

### 3.2 Activating when ON → power OFF

Activating the control (click or Enter/Space) when the projector is **ON** powers it **OFF**: the scene
returns to the **initial pre-illumination OFF state** (AC1) — **status light → RED**, **lamp off**
(designed OFF lens shows), **beam → opacity 0**, **miniature → dim + cool** (the `.about-mini-cool`
overlay → 0.62), **＋plus → hidden** — while the **background field stays at its final tone** (it does
not dim — AC4b). The control's accessible name/state updates to "off" (§6).

**Powering-off transition — RECOMMENDATION: a brief coordinated FADE, not a hard snap (motion-enabled
only).** A real projector lamp does not blink off — it cools. Power-off plays a short reverse:

- **Status light GREEN → RED** over ~140 ms (opacity crossfade, the reverse of P0).
- **Lamp** dims `opacity 1 → 0` over ~260 ms (`ease-in` — a quick cool-down), with the off-lens base
  crossfading **back in** `0 → 1` over the same window (so the lens never becomes an empty hole).
- **Beam** fades `opacity 1 → 0` over ~220 ms.
- **Miniature** re-cools: `.about-mini-cool` overlay `0 → 0.62` over ~220 ms.
- **＋plus** fades `1 → 0` over ~200 ms.

Total power-off ≈ **300 ms** (all overlapping). It is brief and reads as "the lamp shut off and the
room went dim" — the inverse gesture of the warm-up, without re-running the flicker. **No old→new title
flicker on power-off** (the title swap, if any, happens on the *next* power-ON during the flicker — §5).
The OFF state then **holds steady** (no animation running) until the next power-on (AC10). Under reduced
motion, power-off **snaps** instantly to the OFF state (§3.4).

> Why a fade, not a snap, for power-off: the owner's added behavior is "powers it OFF … and ON again to
> replay." A snap-off would read as a glitch against the deliberate warm-up; a 300 ms cool-down keeps
> the projector metaphor coherent. (This is a UX recommendation; the spec leaves the power-off
> treatment to UX — AC14 only requires it reach the OFF state. If the owner prefers a hard snap-off,
> it is a one-line change: drop the power-off keyframes and set the OFF values directly.)

### 3.3 Activating when OFF → power ON (replay)

Activating the control when **OFF** powers it **ON** and **replays the full power-on sequence** (§1:
red→green → flicker → warm-up → beam fade-in → miniature illuminate → plus fade-in), settling to the ON
state (AC2). This power-on **re-picks the miniature title** (§5) — and, because there is now a *prior*
title on screen, this is a **restarted power-on**: if the re-pick differs, the title **flickers old→new
during the lamp flicker** (§5). The control's accessible name/state updates to "on."

### 3.4 Reduced motion — the toggle snaps (AC6)

Under `prefers-reduced-motion: reduce` there is **no on-load auto-intro** (the lit poster on first
paint, §4-RM). The toggle still works (it is user-initiated) but **snaps** instantly between the OFF
state (AC1) and the ON state (AC2) with **no warm-up, no flicker, no fades, no ramps** — an immediate
state swap in both directions. A re-picked toggle-ON under reduced motion simply **shows the new title**
with no old→new flicker (§5). Mechanism: the toggle sets the OFF/ON values directly (toggling the
`.about-intro` / an `.about-off` state class) with the keyframes gated out by the reduced-motion media
query — exactly the existing gate idiom.

### 3.5 Replay policy + no focus steal (AC10/AC15)

- **One power-on per arrival, plus the toggle.** The intro auto-plays once on each load/mount of
  `/about` (App-Router soft-nav remounts `<Centerpiece>` → one replay per arrival; a full reload always
  replays). It does **not** loop, scroll-replay, or hover-replay. The **only** other replay path is the
  user-initiated toggle.
- **No focus steal, no input gating (AC8/AC15).** Loading `/about` does **not** move focus into the
  scene; the control is **not** auto-focused; `document.activeElement` is not forced into the scene on
  load. The control changes power state **only** on explicit activation. The intro never gates input —
  a user can Tab to / click the title input during the intro and type + Enter immediately.

---

## 4. Responsive — per width tier (AC12)

The intro plays coherently at all three poster tiers of `178c148`. The projector + its status light +
beams exist **only on the wide-AND-tall full poster scene** (≥ lg wide AND ≥ 820px tall — the
height-aware gate, §0); on a wide-but-short viewport (≥ lg wide, < 820px tall) and below `lg` the
miniature is **alone**. So the **status-light red→green step (P0) and the power toggle (§3 / §6) apply
only on the wide-AND-tall full scene**; the **miniature illuminate (P4) and ＋plus fade (P5) still play
in the miniature-alone fallback**. No tier scrolls horizontally at any frame (nothing scales/translates
— §1.2; the stage is `overflow:hidden`).

### 4.1 `≥ xl` — the full POSTER (all steps)
Card overlaid upper-left (present + lit from first paint; **not** in the choreography — AC6/AC7).
Projector lower-left (the **interactive control**), diagonal beam to the dropped miniature upper-right.
The **full sequence** runs: **red→green → flicker → warm-up → beam fade-in → miniature illuminate →
plus fade-in.** Background field static (AC4b — no surface step).

### 4.2 `lg`–`xl` — STACKED (card first, the full scene below; all steps)
The same `.about-stage--scene` (projector + status light + beam + miniature) runs the **full sequence**,
identical timing/easing to §4.1, and the projector is the **interactive control**. Only the page layout
differs (the card is stacked above the scene, not overlaid).

### 4.3 Miniature ALONE — STACKED (reduced intro: P4 + P5 only; NO toggle, NO red→green)
This is the fallback composition: it renders on a **< lg** viewport (too narrow) **and** on a **≥ lg
wide but < 820px tall** viewport (the height-aware gate routes a wide-but-short viewport here too —
§0). There is **no on-screen projector, status light, or beam** (the `.about-stage--scene` subtree is
not rendered; the `.about-stage--mini` miniature-alone stage renders). So P0–P3 have no elements to
play and **there is no power toggle** (no projector control present). The reduced intro is:

- **P4 — miniature illuminate:** the **same `.about-mini-cool` overlay** on the same miniature element
  fades `0.62 → 0`. Without a beam to couple to, it runs over `t = 240 → 940 ms` (a short beat after
  first paint, so the page reads as "article first, then it lights up"). Same mechanism, same element,
  same off-state cool token — no second implementation.
- **P5 — ＋plus fade-in:** the four `.about-plus` groups fade in **together** (opacity only, no motion,
  same as §1.2-D′), onset `t = 240 ms` alongside the illuminate (no beam-land to wait for), settled by
  `t = 940 ms`.

Total miniature-alone intro ≈ **940 ms** (shorter — there's less to sequence; no flicker/beam/red→green).
Start/end-state guarantees (AC1/AC2) hold for the elements present: at t = 0 the miniature is dim+cool
with no plus; at settle it equals the committed miniature-alone composition (soft drop shadow, **no
halo**). A narrow OR short-landscape visitor cannot interactively power-toggle (the projector isn't in
the miniature-alone composition — a flagged, accepted limitation per the spec's "assumptions the owner
may want to reconsider").

### 4.4 No horizontal scroll, any tier (AC12)
Every animated property is an **opacity** (or the miniature's confined filter/multiply) — **no geometry
animates**, no element is translated/scaled. The miniature cool overlay is `inset:0` **inside** the
`overflow:hidden` miniature (clipped to its rounded rect — cannot bleed into the field). Verified at
390 / 834 / 1280×(≥820) plus the wide-but-short **1024×768** (AC12's test sizes): the appropriate
tier-intro runs, the toggle is present + operable **only on the wide-AND-tall full scene**, no
horizontal scrollbar appears at any frame, settled = baseline at each size.

### Reduced motion (RM) — all tiers (AC6)
Under `prefers-reduced-motion: reduce`, on the first painted frame: status light **green**, lamp at
opacity 1 (the OFF lens never shows — occluded), beam at **opacity 1** (committed geometry), miniature
cool overlay at **opacity 0** (fully lit), all plus groups at **opacity 1**, background field at its
final tone. i.e. **identical to AC2's settled state, immediately** — no red→green, no flicker, no
dim-cool start, no beam fade, no illuminate ramp, no delayed plus reveal, **and the background never
animated in either mode** (nothing to suppress there). No flashing, no late content. The **toggle still
works but snaps** (§3.4). The picked title shows directly with **no old→new flicker** (§5).

**Implementation mirror (binding):** the element **default (no-animation) values ARE the final-state
values** (status light green, lamp opacity 1, off-lens opacity 0, beam opacity 1, mini-cool opacity 0,
plus opacity 1, **field at final tone with no overlay at all**). Wrap **all** warm-up keyframes in
`@media (prefers-reduced-motion: no-preference)` (the gate `globals.css` already uses for
`wikiplus-search-grow` / `.pinned-dock-in` / `.gs-fade-in`). A `reduce` user, no-JS, or pre-hydration
render gets the static poster with nothing to suppress.

---

## 5. The dynamic miniature title (AC16–AC18) — fit-cap + the old→new flicker

### 5.1 The fit-threshold — a character-count cap of **20 characters** (AC16)

The title line is the **left column** of the miniature masthead grid: in the 560-wide miniature
(`padding 30px 28px`, masthead grid `1fr | 132px`, `gap 20px`), the `1fr` title column is **352 px**
wide, rendering the serif title at **28 px Georgia** (`MiniatureTitleInput`, `.projector-serif
text-[28px]`). The same 352 px line applies at every tier (the miniature is 560 wide at `≥ lg` and
`< lg` alike — §0).

**Recommended cap: 20 characters** (server-derived, the spec's approach (a)). Rationale, measured
against the 352 px / 28 px-Georgia line:
- A pessimistic wide-glyph title (avg advance ~0.60 em — e.g. many caps/`m`/`w`) at 20 chars ≈ **336 px
  < 352 px** → fits on one line with headroom.
- Typical title-case Latin titles (avg ~0.48–0.52 em) at 20 chars ≈ **269–291 px** → comfortable.
- The fallback `"Acer palmatum"` (15 chars) is well within the cap.

So **a title of length ≤ 20 characters is admitted to the pool; a title of length > 20 is excluded**
(never truncated, wrapped, or shrunk — the cap is a **filter**, AC16). 20 is deliberately conservative
(it sacrifices a few medium-long titles to guarantee no wrap at the worst glyph density rather than
risk a two-line title at the cap). If a future audit shows the pool is starved, the cap can rise toward
~22 with a measured check, or fall back to spec approach (b) (client-measured fit) for the affected
tier — but **20 is the value to ship**. Dev applies the cap **server-side** when deriving the eligible
pool from `listCuratedTopicsAction()` (per the spec's architecture note), passing **the pool + the
fallback** to the client. Title source, ordering, and the read seam are Dev's per the spec — UX fixes
only the **cap value (20)** and the line geometry it is tuned to.

> **CLS / determinism:** because the cap guarantees one line at every tier, a picked title never wraps
> and never changes the miniature's height → zero layout shift when a re-pick swaps the title. (The
> input is single-line `text` and the masthead row height is driven by the 28 px line; a ≤20-char title
> cannot push it to two lines.)

### 5.2 The title is readable in every state (AC17)

The title is a **real, readable article title in all states** — dim/off and lit alike — and is **never
hidden behind a placeholder/skeleton bar**. In the OFF / dim-cool state the title text is present and
legible: the `.about-mini-cool` overlay *multiplies* (darkens-and-cools) the white ground but the
**black title text on the dimmed-white ground keeps high contrast** (a multiplied dim white is still
far lighter than black). At first paint (AC1) the bare article ground — including its title — is
visible. There is **no skeleton bar, no shimmer, no "loading" placeholder** for the title at any point.

### 5.3 The old→new flicker on a restarted power-on (AC17) — synced to the lamp strikes

On a **restarted power-on** — a toggle-ON (§3.3) that re-picks a title **different** from the one
previously shown — the title **text transitions OLD → NEW during the lamp's flicker phase (P1, t = 180
→ 520 ms)**, synchronized with the lamp strikes, as if the projector is re-focusing on a different
article. There is **no** such flicker on the **first / on-load auto-play** (no prior title). If a
re-pick happens to choose the **same** title, there is **no visible change** (it stays stable as it
lights up). Under reduced motion there is **no flicker** — the new title simply shows (§3.4).

**Mechanism — title cross-flicker keyed to the lamp strikes (recommended).** The flicker is the title
*text content* swapping in time with the lamp's opacity strikes — the title "catches" on the new value
the way the lamp catches on. Concretely:

- The miniature renders the title as the editable `MiniatureTitleInput` (E). For a restarted power-on,
  Dev holds **two values** for the flicker window: the OLD title (the displayed value entering the
  flicker) and the NEW picked title (the value to settle on). The title's **opacity** is keyed to the
  **same strike rhythm as the lamp** (it tracks `.about-lamp-light`'s P1 keyframe — see §1.2-B: strikes
  at ~210/290/380/470 ms with drops between), and the **displayed text is swapped to the NEW title at
  the strike where the lamp first reaches its strongest catch** (the fourth strike, ~470 ms). So the
  reader sees: OLD title flicker-dims with the lamp's first strikes → on the strong catch the text is
  now the NEW title → it settles bright as the warm-up ramps. The swap is **a single content change at
  one strike**, masked by the flicker dimming, so there is no half-rendered or scrambled text — it
  reads as the projector re-focusing.
- Implementation seam: a short title-flicker animation on `.about-title-block` (or a wrapper) —
  `about-title-flicker ~340ms` over the **P1 window (180–520 ms)** keying **opacity** to the strike
  rhythm — combined with a one-shot JS text swap at ~470 ms (driven off the same timeline as the lamp,
  not an independent timer, so they cannot drift). Title **opacity only** flickers (no transform, no
  layout change — the input box is fixed; CLS = 0). After P1 the title holds at opacity 1 with the NEW
  value and warms up with the rest of the page.
- **Reduced motion / first play:** no flicker animation, no opacity keying — Dev sets the picked title
  as the input value directly (first play: it is simply there at t = 0; reduced-motion re-pick: it
  appears on the snap). The flicker is gated inside `@media (prefers-reduced-motion: no-preference)` +
  the restarted-power-on condition (a prior title existed AND it differs from the new pick).

> **A11y of the flicker (AC7/AC9):** the title flicker is **opacity only** on a decorative-looking
> transition; the **input remains present, named, focusable, editable, and Enter-navigable throughout**
> (it is never `display:none`/`aria-hidden`/disabled — §6 / AC18). The text swap changes the input's
> *value* (so a screen-reader user who focuses it reads the settled new title); it does not announce or
> interrupt. If the user has **typed into the field** within a power-on, the animation must **not**
> clobber their text (the re-pick reseeds only on a fresh power-on, never over a user edit — AC18).

### 5.4 The title stays the one real control (AC18)

The miniature title remains the **named, keyboard-operable `MiniatureTitleInput`** — present in the tab
order, focusable, editable, navigating to the corresponding topic on **Enter** (via `topicHref`). The
**only** change is that its **starting value for a power-on is the picked title (§5.1)** rather than the
hard-coded `"Acer palmatum"`. A user may still edit the field and press Enter to navigate to *their*
title; the pick sets the **initial** value only and does **not** lock, disable, or overwrite the field
after the user types, and does **not** auto-navigate. The input's accessible name + helper
(`TITLE_INPUT_LABEL` / `TITLE_INPUT_HELP`) are unchanged.

---

## 6. The projector power control — structure + accessible name (AC13–AC15)

Where present (`≥ lg`), the projector is a **real control** — a focusable, keyboard-operable element,
**not** a click handler on a decorative `aria-hidden` SVG.

### 6.1 Structure

Wrap the projector SVG in a `<button type="button">` (the control wrapper carries the semantics; the
inner SVG stays `aria-hidden`/`role="presentation"`/`focusable="false"` exactly as today). The button
fills the projector's layout box (the `position:absolute; left:8 top:600 width:420` div in
`Centerpiece.tsx` becomes / contains the button). It is:

- **In the tab order** (a native `<button>` — no `tabindex` gymnastics).
- **Pointer-activatable** (click) **and keyboard-activatable** (Enter/Space — native button behavior).
- **`pointer-events`:** the button is clickable; the beam and miniature cool overlay are
  `pointer-events:none` so they never intercept its activation, and vice-versa the button does not
  overlap the title input's hit area (the projector is lower-left, the title input upper-right —
  disjoint).
- **Not auto-focused; does not steal focus on load** (AC15 / §3.5).

### 6.2 Visual treatment + focus-visible

- **At rest** the button is **visually transparent** — the projector graphic must still read as the
  committed static poster (AC2), so the button adds **no** border/background/box of its own at rest.
- **`:focus-visible`** (keyboard): a **visible focus ring** matching the app convention — the brand
  ring used elsewhere: `outline: 3px solid var(--color-brand); outline-offset: 4px;` drawn around the
  projector's box (offset so it doesn't crop the bloom). This is the conventional, obvious keyboard cue
  (same family as `.about-title-block`'s focus ring).
- **Mouse focus** (`:focus:not(:focus-visible)`): **no ring** — click-to-toggle doesn't pop a heavy
  ring (the same pattern as `.about-title-input` / `.auth-account-trigger`).
- **Hover (pointer):** `cursor: pointer` and an optional **very subtle** affordance is permitted (e.g. a
  faint brightness lift on hover) — but discoverability is acceptably "easter-egg" for a decorative
  front-door moment (the spec flags discoverability as a non-blocking owner call). Keep any hover hint
  subtle enough that the at-rest projector still equals the static poster.

### 6.3 Accessible name (state-reflecting) — the wording

The control exposes a **state-reflecting accessible name** so its on/off state reaches assistive tech
**by name, not by the light's color** (AC9/AC13). Recommended wording (an **action-label** that names
what activating it does, which flips with state):

- **When ON:** accessible name = **"Turn the projector off"**
- **When OFF:** accessible name = **"Turn the projector on"**

Implement via `aria-label` on the button, swapped with the power state. (An equivalent pressed-state
semantic — `aria-pressed` with a stable name like "Projector power" — is acceptable per the spec; the
**action-label is the recommendation** because it reads naturally to a screen-reader user activating a
front-door control and needs no mental mapping of "pressed = on or off?".) The name updates the instant
the state changes (on power-off and power-on). The inner SVG stays `aria-hidden`; the **button is the
only newly-exposed node** in the scene's accessibility tree.

> **AC9 — no new color-only signal.** The red/green status light is **decorative** (`aria-hidden`); the
> projector's on/off state is conveyed to assistive tech by the **button's accessible name** above, not
> the light color. A user who never perceives the color loses no information.

---

## 7. Determinism for capture (AC11) — settle signal + a PINNED title

**The problem:** the About catalog scene must capture the **settled-on final state** (not a mid-intro
frame, not the OFF state) **and** — now that the title is dynamic — must pin the title to a fixed value
so the About baseline does not churn as real curations change.

### 7.1 Settle determinism (already in place — keep)

`<Centerpiece>` exposes a `data-about-intro` attribute on the scene root: `"running"` while the warm-up
is in flight, `"settled"` when it completes (driven off the last animation's finish, with a hard
fallback timer at the **2000 ms** settle window), and `"settled"` immediately under reduced motion. The
catalog's `aboutSettled` waiter (in `e2e/screenshots/catalog.ts`) already (a) forces
`reducedMotion: "reduce"` (under which the first paint **is** the settled poster — no frame to race)
and (b) waits for `data-about-intro="settled"`. **Keep both.** (Update the fallback constant in
`Centerpiece.tsx` from `INTRO_SETTLE_MS = 2200` to **2000** to match this revision's total.)

### 7.2 Title pinning (new this revision — the deterministic-capture hook)

Because the miniature title is now dynamic (AC16), the capture must **pin the title to a fixed,
deterministic value** so the About baseline is reproducible and equals today's committed About shot
(which shows `"Acer palmatum"`).

**Recommendation — pin to the fallback `"Acer palmatum"` via the screenshot stub, so no live data is
read at capture time.** The About catalog scene already uses `stub: "plain"` (a deterministic data
context for capture). The hook:

- **Make the eligible-title pool come back EMPTY under the screenshot stub**, so the client falls to the
  fallback `"Acer palmatum"` deterministically (AC16's empty-pool path). Concretely: when `/about` reads
  `listCuratedTopicsAction()` under the screenshot/test data context (the `stub: "plain"` path the
  catalog drives), the recently-curated read returns an empty / no-fitting-title set, so the derived
  pool is empty and the title is the fallback. This needs **no new prop and no test-only branch in the
  component** — it falls out of the existing stub returning no curated topics. The title is then
  `"Acer palmatum"` at every capture, matching the prior baseline.
- **Alternative (if the stub returns curated topics):** pass a **capture-pinned title** via the same
  stub mechanism — seed the recently-curated read with a **single fixed title** (`"Acer palmatum"`) so
  the pool has exactly one fitting entry and the pick is deterministic. Either way the rule is: **under
  the capture data context the pick is forced to `"Acer palmatum"`**, with **no production code path
  that special-cases the screenshot** beyond the data the stub already supplies.

Dev confirms which the `stub: "plain"` context yields and wires whichever produces a deterministic
`"Acer palmatum"`. **No catalog scene change is needed beyond the existing `aboutSettled` waiter** (the
stub already pins the data context); the only requirement is that the title resolves to the fallback
under that context.

### 7.3 Baseline refresh

With both guards, the settled scene = today's committed poster (green light, lit, `"Acer palmatum"`),
deterministically. **Refresh the About baseline in the same PR**:
`scripts/dev/shots.sh --scene about --commit ui` (a partial refresh — this changes only the About
surface's capture path/timing, not the static look, so the regenerated About PNGs equal the prior
committed About PNGs within normal tolerance — AC11). If the new control's `:focus-visible` ring needs a
captured state later, that is a separate scene addition; the default `about` scene captures the settled,
unfocused poster.

---

## 8. Accessibility (the intro is decorative-only)

- **Content present + reachable throughout, both motion modes (AC7).** The intro animates only
  appearance; it must **not** `display:none`, `visibility:hidden`, `aria-hidden`, disable, or remove any
  content while animating, and must **not** delay availability. The "How it works" heading + steps, the
  `sr-only` scene description, and the **miniature title input** (in the tab order, focusable, editable,
  Enter-navigable) are in the DOM + accessibility tree from the first frame and stay so — including
  during the title old→new flicker (§5.3) and during the power-off/on toggle.
- **No focus steal, no input gating (AC8/AC15).** Loading `/about` does **not** move focus into the
  scene (no autofocus, no `.focus()` on mount); the power control is **not** auto-focused. A keyboard
  user can Tab to the title input and a pointer user can click it **during** the intro; typing + Enter
  works immediately. The intro is a sibling visual layer, not a modal/blocker. The beam group and the
  miniature cool overlay are `pointer-events:none`; the power button does not overlap the title input.
- **No new color/motion-only signal (AC9).** The lamp, beam, bloom, miniature, the revealing plus
  cards/clips, and **the red/green status light** stay **decorative** — `aria-hidden` exactly as today.
  The animation adds **no** information a user must perceive as motion or color: the projector→page→＋plus
  thesis lives in the card copy + the `sr-only` `SCENE_DESCRIPTION` (unchanged), and the projector's
  on/off state is exposed by the **power control's accessible name** (§6), not the light's color. A user
  who never sees the motion or color (reduced-motion, slow device, screen reader) loses nothing.
- **The one intentional exception** to "decorative graphics stay `aria-hidden`" is the **power control
  wrapper** (§6) — a labeled, focusable button whose inner SVG stays `aria-hidden`. It is the only
  newly-exposed node.

---

## 9. Hand-off to Development

Build the intro as **CSS keyframes / WAAPI gated behind `@media (prefers-reduced-motion: no-preference)`**
(mirroring `globals.css`'s `wikiplus-search-grow` / `.pinned-dock-in` / `.gs-fade-in`), animating
**`opacity` and `filter` only — NO `transform`/position/scale on the beam, plus, or any element, and NO
animation of the background field** — over the existing markup. Implement to the keyframe tables in §1.2
and the bookends in §2. **This revision removes** the prior whole-field surface dim/brighten and the
`.about-room-dim` overlay, the beam `scaleX` grow (`.about-beam-grow` / `about-beam-throw`), and the
plus scale+slide stagger — replace them per below.

**What changes from the shipped version (the build delta):**

1. **Remove the background animation entirely (AC4b).** Delete the `.about-room-dim` overlay element
   (both the `≥ lg` and `< lg` instances in `Centerpiece.tsx`) and its keyframes (`about-room-brighten`
   / `about-room-brighten-mini`) and the `.about-room-dim` rule in `globals.css`. The
   `.about-theater-field` has **no** keyframe and is at its committed tone every frame. There must be
   **no** `.about-stage`-scoped dim overlay (the deployed flaw — it exposed the stage outline).
2. **Beam → fade-in, no grow (AC5b).** Replace `about-beam-throw` (the `scaleX` grow) with an
   **opacity-only** `about-beam-fade` on the beam group (rename `.about-beam-grow` → `.about-beam`,
   drop `transform-box: view-box` — no transform is used). Cones at committed geometry the whole time;
   group opacity `0 → 1` over `t = 560 → 1240` (§1.2-C). QA asserts **no transform keyframe** on the
   beam.
3. **Miniature dim-cool → illuminate, confined to the miniature (AC4).** Add a decorative `aria-hidden`,
   `pointer-events:none` `.about-mini-cool` overlay **inside** the `TopicMiniature` root (`inset:0`,
   clipped by the miniature's `overflow:hidden`), `background: var(--color-mini-cool)` (new token
   `#2A3550`), `mix-blend-mode: multiply`, default opacity **0**; keyframe `about-mini-illuminate`
   fading `0.62 → 0` over `t = 560 → 1240` (`≥ lg`) and `t = 240 → 940` (`< lg`) — reaching 0 at lamp-max
   (`≥ lg`). **Do NOT** dim the `.about-stage` or `<main>`. Optional reinforcing
   `filter: saturate(0.85) brightness(0.9) → 1` on the miniature root over the same window (§1.2-D).
4. **＋plus → fade-only, no motion (AC5).** Replace `about-plus-reveal` (scale + slide) with an
   **opacity-only** `about-plus-fade`, and drop the per-group stagger (all four `.about-plus` groups
   share **one** delay `1240ms` `≥ lg` / `240ms` `< lg`). QA asserts **no transform keyframe** and **no
   per-group delay difference**.
5. **Red→green status light, step 0 (AC1d/AC3).** In `Projector.tsx`, split the status dot into a
   **red off layer** (`fill var(--color-status-off-red)`, new token e.g. `#C0392B`) beneath the existing
   **green layer** (`var(--color-sprout)`). Keyframe the green layer opacity `0 → 1` and the red layer
   `1 → 0` over `t = 0 → 180`. Defaults: red 0 / green 1 (the static poster). Hold the lamp at opacity 0
   until t = 180 so the flip is the first action; shift the lamp keyframe's first strike to ~210 ms
   (§1.2-B). **`< lg` has no status light** (no projector) — the red→green step has no element there.
6. **The projector power control (AC13–AC15).** Wrap the projector in a `<button type="button">` with a
   state-reflecting `aria-label` ("Turn the projector off" when on / "Turn the projector on" when off),
   `:focus-visible` brand ring (`outline: 3px solid var(--color-brand); outline-offset: 4px`), no rest
   border/background, `cursor:pointer`; inner SVG stays `aria-hidden`. Local client state holds the
   power on/off; activating toggles it. **Powering OFF → the AC1 OFF state** (red light, lamp off + off
   lens back, beam opacity 0, miniature cool overlay → 0.62, plus → 0; background unchanged) via a brief
   ~300 ms cool-down fade (§3.2) under motion, **snap** under reduced motion. **Powering ON → replay the
   full sequence** (§1) and re-pick the title (§5). Present + operable **only `≥ lg`**. **No focus steal
   on load; the auto-intro is unaffected by the control existing** (§3.5 / §6.1).
7. **The dynamic title (AC16–AC18).** Make `/about` **read `listCuratedTopicsAction()` server-side**
   (the spec's architecture note), derive the **eligible-title pool** applying a **20-character cap**
   (exclude titles > 20 chars; never truncate — §5.1), and pass **the pool + the fallback
   `"Acer palmatum"`** to the client miniature. The client **(re)picks** a title on each power-on
   (auto-play + toggle-ON), **seeds** `MiniatureTitleInput` with it (still editable, still Enter-navigates
   — AC18), keeps the title **readable in every state** (no placeholder bar — §5.2), and **flickers the
   title old→new during the lamp flicker on a restarted power-on only** (the §5.3 mechanism: title
   opacity keyed to the lamp strikes + a one-shot text swap at the strong catch ~470 ms, driven off the
   same timeline; **no** flicker on first/auto-play; **none** under reduced motion; **never** clobber a
   user edit). `/about` must **fall back cleanly** to `"Acer palmatum"` on an empty/failed read.
8. **Determinism + baseline (AC11).** Keep the `data-about-intro` settle signal + the `aboutSettled`
   catalog waiter (force reduced motion + wait the signal); update `INTRO_SETTLE_MS` to **2000**. Ensure
   the title resolves to the fallback `"Acer palmatum"` under the screenshot data context (§7.2) so the
   baseline is pinned. **Refresh the About baseline** (`scripts/dev/shots.sh --scene about --commit ui`)
   in the same PR.

**Hard requirements (re-stated so Dev never guesses):**
- Element **default** (no-animation) values **are the final-state values** → `reduce` and no-JS get the
  static poster for free (§4-RM). For the lamp: `.about-lamp-light` default opacity 1; `.about-off-lens`
  default opacity 0; status-light red layer default 0 / green default 1; beam group default opacity 1;
  `.about-mini-cool` default opacity 0; every `.about-plus` default opacity 1.
- **The background field never animates** (AC4b) — no `.about-room-dim`, no `.about-stage`-scoped dim,
  no `filter`/`brightness` on `.about-stage`/`<main>`. The miniature cool overlay stays **confined to
  the miniature element** (clipped inside its `overflow:hidden` box).
- **Couple the three illumination ramps to lamp-max:** the lamp warm-up, the beam fade, and the
  miniature illuminate all reach full at **t = 1240** — drive off one shared end so the AC4 coupling
  can't drift.
- **No `transform`/position/scale on the beam, the plus, or any element** (CLS = 0; AC5/AC5b). The only
  transform in the whole intro is none — everything is opacity/filter.
- **No focus move, no input gating, no `aria-hidden`/`display:none` on content** (§8). The miniature
  gains **no halo** (AC2).
- Total intro **2000 ms** (`≥ lg`) / **940 ms** (`< lg`); power-off cool-down ~300 ms; status flip
  180 ms; title flicker over the P1 window (180–520 ms).

After Dev implements and QA verifies AC1–AC18, **UX evaluates the built motion against this spec** —
render the standard About-scene screenshot evidence (settled), and confirm: the red→green flip is the
first action; the flicker reads as a projector striking; the beam **fades in** (no grow/jitter) and the
miniature **lights up cool→warm** without any background change (no stage outline at any mid-intro
frame); the plus layer **fades** in (no slide); the toggle powers off/on and replays with a labeled,
focus-visible control; the title is picked from recent curations, fits one line, is readable dim+lit,
and cross-flickers old→new on a restarted toggle; and the reduced-motion path is pixel-identical to
`178c148` with a snapping toggle.
