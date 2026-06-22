# Design spec — About-page projector "warm-up" intro (motion / choreography)

**Type:** UX motion/choreography design spec · **Milestone:** Functional prototype
**Status:** Design spec (Phase 2) — the buildable contract Development implements against; written
**before** any implementation code. **Branch:** `about-projector-warmup`.
**Implements / satisfies:** the Product spec `docs/specs/about-projector-warmup.md` (AC1–AC12) in full.
**Animates into (the fixed endpoint):** the committed static About **poster** on `main` at `178c148`
("Compose About as one full-page poster in a single theater field").

This spec fixes the motion design — phase boundaries, overlaps, easing, the flicker rhythm, the
dim→bright ramps, the beam-extend treatment, the ＋plus reveal treatment, the surface-brighten
mechanism, the reduced-motion end-state, the per-tier choreography, and the determinism hook for
capture. It does **not** ship code, and it does **not** restyle the static look — the settled frame is
pixel-equivalent to `178c148` (AC2).

> **Persona / story this serves.** Priya, the first-time visitor (VISION primary persona; About §0).
> *"As a first-time visitor, I want to grasp — without reading — that wiki+ takes a Wikipedia article
> and adds a curated, contextualized video layer on top of it, so I immediately understand what this
> product is."* The static poster answers *"what does it look like?"*; this intro answers *"what
> happens — what does wiki+ do to an article?"* by sequencing the causal story in the order it means:
> **the article exists first → the projector strikes → the beam reaches it → the ＋plus layer appears
> because the light arrived.** Motion conveys nothing the still doesn't; it sequences it. The thesis is
> always available in words (the card copy + the `sr-only` scene description) — the motion is craft,
> never the carrier of meaning (AC9).

---

## 0. The elements this choreography maps onto (the real markup)

All of the following already exist on `178c148`; the intro adds appearance animation over them. No new
DOM, no new tokens.

| # | Element | Component / node | Role in the intro |
|---|---|---|---|
| A | **Theater surface** | `.about-theater-field` radial on `<main>` (`app/about/page.tsx`); plus the lit miniature surface | **Step 5** — brightens from a dimmer start to its final committed tone, coupled to the lamp reaching max. |
| B | **Lamp** | the white `+` aperture (clipped to `#proj-pclip`) + the two warm `bloom` radials in `Projector.tsx` | **Step 1** flickers, **Step 2** ramps dim→bright. |
| C | **Beam** | the three nested warm cones (+ motes) in `Beams.tsx`, apex ~`(287,773)` in the 1280×880 frame | **Step 3** projects/extends from the apex outward to the page. |
| D | **＋plus layer** | the separable `<PlusLayer>`-family subtree in `TopicMiniature.tsx` — the right-gutter **overview + contents cards**, the **general strip** (3 clips), and the bottom **tall portrait clip** | **Step 4** reveals onto the already-present article ground. |
| E | **Article ground** | in `TopicMiniature.tsx` — the **title input**, the **body lines**, the **section-heading bars** | Present and fully visible from the **first painted frame**; NOT animated (AC5). |
| F | **"How it works" card** | `HowItWorks.tsx` / `.how-it-works-card` | Present + legible + lit from the first frame; **not part of the choreography** (AC6/AC7). Never flickers, dims, or reveals. |

**Stage geometry that the choreography depends on** (read from `Centerpiece.tsx` / `Beams.tsx`): the
`≥ lg` scene lives in the scaled **1280×880** `.about-stage` (clipped, `overflow:hidden`); the
projector div is at `left:8 top:600 width:420`, the miniature div at `left:700 top:270 width:560`. The
beam apex is lower-left (~`287,773`), the cones throw **up-right** to the miniature's left edge
(x ~706–722, y ~280–860). The beam grows **along its own throw axis from the apex outward**; the
miniature sits at the far (up-right) end. This axis (`~ -33°` from horizontal, i.e. up and to the
right) is the direction the plus cards stagger in Step 4.

---

## 1. The timeline / choreography (the contract)

**Total duration chosen: 2200 ms** (within the spec's ~1.6–2.6 s range). Long enough to read as a
deliberate "warm-up," short enough that the visitor never waits to interact (interaction is *never*
gated regardless — AC7/AC8). All times are **ms from the scene's first painted frame** (t = 0). All
animated properties are **`opacity` and `transform` only** (GPU-composited; no layout/paint property
animates → zero CLS, AC's "no jank / CLS = 0"). Every element occupies its **final layout box** for
the whole intro; only its appearance changes.

### 1.1 Phase boundaries (onset order is fixed + observable — AC3)

```
 t(ms)   0      120          520    560        1180  1240          1820   1900        2200
         │ P1   │  (overlap)  │  P2  │ (overlap) │ P3  │  (overlap)   │  P4  │ (overlap) │  P5 end
 ────────┼──────┼─────────────┼──────┼───────────┼─────┼─────────────┼──────┼───────────┼─────────►
 Lamp    ███ flicker (P1)     ███████ warm-up dim→bright (P2) ██████████│ steady at max ───────────
 Beam                                  ░░░░░░░░░ grow-along-throw (P3) ░░│ steady ───────────────────
 Plus                                                   · · · · · · · · stagger reveal (P4) · · · · ·│
 Surface ▓ dimmer ────────────────────▓▓▓▓▓▓▓▓▓ brighten (P5, ends with lamp-max) ▓▓ final tone ─────│
```

- **P1 Lamp flicker** — `t = 0 → 520 ms` (≈ 520 ms window; the *uneven* part lives in the first ~320 ms).
- **P2 Lamp warm-up (dim→bright)** — `t = 520 → 1240 ms` (720 ms). Begins as the flicker resolves;
  reaches **max brightness at t = 1240**.
- **P3 Beam grow-along-throw** — `t = 560 → 1240 ms` (680 ms). Starts ~40 ms after warm-up begins (the
  lamp is lighting, so the beam emerges *from* a lighting lamp), reaches the miniature by **t = 1240**.
- **P4 ＋plus reveal (staggered)** — `t = 1240 → 2000 ms` (760 ms incl. stagger). First plus group
  begins **as the beam lands** (t = 1240); groups stagger along the throw; last group settles by **t = 2000**.
- **P5 Surface brighten** — `t = 600 → 1240 ms` for the ramp to final tone, then **held**. The surface
  reaches its **final committed tone at t = 1240 — exactly when the lamp reaches max** (AC4 coupling).
  (The surface starts dimmer at t = 0 and is a no-op-still-dimmer until the ramp window; see §1.3.)

**Settle:** the whole scene is visually static by **t = 2000 ms**; the intro is fully torn down (no
running animation, no residual inline style) by **t ≤ 2200 ms** (AC10). The 2200 ms figure is the
"settled" guarantee Dev exposes to capture (§6).

Onset order holds at every sampled frame: lamp flicker is visible before the lamp is steady-bright; the
beam reaches the page (t = 1240) before the plus layer is fully revealed (t = 2000); the plus layer
reveals before/as the surface holds final; the surface reaches final no earlier than the lamp at max
(both at t = 1240). This is the AC3 ordering, with deliberate overlaps.

### 1.2 Keyframe table (per element)

Easing names map to standard cubic-béziers; Dev may implement as CSS `animation` keyframes or the Web
Animations API (WAAPI). Values are **multipliers/opacities on existing tokens**, never new colors.

#### B — Lamp (the `+` aperture group + the two `bloom` radials)

The lamp's "brightness" is expressed as the **opacity of the lamp light layers** (the clipped white
`+` aperture fill, the `url(#proj-plamp)` glass radial, and the two `bloom` circles) over the
always-present cool lens stack beneath them. At dim, those warm/white light layers are low-opacity, so
the lens reads as a barely-lit "off-ish" lamp; at full they are opacity 1 = today's lit projector.
Treat the aperture-`+`-fill + glass radial + both bloom circles as one **`lamp-light` group** whose
group opacity is animated (a single wrapping `<g>` Dev adds, or per-node parallel keyframes — Dev's
choice; the group is cleaner).

**P1 — flicker** (`animation: lamp-flicker 520ms steps/linear, one-shot`). *Uneven* flashes — irregular
gaps, not a smooth pulse (the spec's "a few quick, uneven flashes, like a real projector striking").
Concrete rhythm (group opacity of `lamp-light`):

| % of P1 | t (ms) | opacity | note |
|---|---|---|---|
| 0%   | 0   | 0.06 | near-dark (cool lens shows; aperture barely warm) |
| 6%   | 30  | 0.55 | first strike (quick) |
| 12%  | 62  | 0.10 | drop |
| 16%  | 84  | 0.70 | second strike |
| 19%  | 100 | 0.12 | drop (uneven gap — shorter than the first) |
| 30%  | 156 | 0.40 | weak third strike |
| 34%  | 177 | 0.08 | drop |
| 52%  | 270 | 0.85 | fourth strike (longer gap before it — the "catch") |
| 58%  | 300 | 0.30 | settle dip |
| 100% | 520 | 0.30 | hold dim, ready to warm up |

Use `steps`-like hard transitions (or `linear` with near-coincident keys) so each strike reads as a
*snap*, not a fade — that is the projector-striking character. Keep peaks below 0.9 so P1 never reaches
full brightness before P2 (preserves AC3 onset order: flicker → warm-up). End P1 at **0.30** so P2 has
a clear dim→bright run.

**P2 — warm-up dim→bright** (`lamp-warm 720ms cubic-bezier(0.22,0.61,0.36,1)` — *easeOutQuart*, a
filament-like fast-then-settle ramp):

| t (ms) | `lamp-light` group opacity |
|---|---|
| 520  | 0.30 (hand-off from P1) |
| 760  | 0.78 |
| 1000 | 0.94 |
| 1240 | **1.00 (max — the committed lit projector)** |

After t = 1240 the lamp holds at opacity 1 = the static poster lamp. **No residual transform** on the
lamp; the bloom radials are not scaled (their committed radius is the final look).

#### C — Beam (the three cone `<polygon>`s + the motes `<g>`)

The beam **grows along its throw from the apex outward** — a clip/scale reveal that makes the light
*reach* the page, plus an opacity fade so it emerges softly. Mechanism (GPU-friendly, no geometry
re-draw):

- **Grow-along-throw:** animate a **`scaleX` from a transform-origin pinned at the apex** on a wrapping
  `<g transform>` around the three cones. Because the apex is the cones' shared left vertex (~x 287)
  and they fan up-**right**, `transform-origin: 287px 773px` (in the 1280×880 user space; i.e.
  `transform-origin` set on the group in scene units) + `transform: scaleX(s)` makes the cones extend
  from the lamp outward to the miniature as `s: 0.04 → 1`. (`scaleX` about the apex is the cleanest
  "throw extends" read; a wider `scale(s)` about the same origin is acceptable if Dev finds the pure
  X-stretch reads thin — both keep the apex pinned and both are transform-only.)
- **Opacity:** the group fades `0 → 1` over the same window so the beam doesn't pop at 4% width.
- **Motes:** ride the same group transform (they live in the same `<g>`), so they appear to stream out
  along the throw with the beam — no separate animation needed. (Optional polish, non-contractual: a
  tiny extra mote drift is out of scope; keep it to the shared transform.)

`beam-throw 680ms cubic-bezier(0.16,0.84,0.44,1)` (*easeOutCubic*-ish — fast reach, gentle land):

| t (ms) | group `scaleX` (origin = apex) | group opacity |
|---|---|---|
| 560  | 0.04 | 0    |
| 720  | 0.45 | 0.55 |
| 1000 | 0.86 | 0.92 |
| 1240 | **1.00 (cones reach the miniature)** | **1.00** |

After t = 1240 the beam holds at `scaleX(1)`, opacity 1 = the static cones (the per-cone `opacity`
0.16/0.24/0.36 and the gradient are the committed look — the *group* opacity returns to 1, layering
over those). **No residual group transform** at settle (`scaleX(1)` = identity).

> **AC12 horizontal-scroll guard.** `scaleX` about the apex only ever shrinks the cones *toward* the
> apex during the intro and never exceeds their final geometry (`s ≤ 1`), and the whole stage is
> `overflow:hidden` clipped to its box (`Centerpiece.tsx` `.about-stage`), so no beam frame can push
> the page wider. No element is translated outside the stage box at any frame.

#### D — ＋plus layer (the `<PlusLayer>`-family groups in `TopicMiniature.tsx`)

The plus layer reveals **onto the already-present article ground** (AC5): the title input, body lines,
and section bars are at full opacity from t = 0 and never animate. Only the indigo plus groups
transition hidden → visible. Reveal = **fade + a short scale-up + a small slide along the beam's
throw direction**, **staggered** so the cards arrive in the order the light "fills" the page (along the
throw = lower-left → upper-right, i.e. the strip/cards nearest the beam's landing edge first).

Per-group transition: `opacity 0 → 1`, `transform: translate(throw-vector) scale(0.92) → translate(0) scale(1)`.
The slide vector is small (a ~10–14 px nudge **down-left → settle**, i.e. each card eases *in along the
beam* toward its resting spot) and `transform-origin: center`. Duration **per group 380 ms**,
`cubic-bezier(0.2,0.7,0.3,1)` (*easeOutQuint*-ish — arrives and settles, no overshoot/bounce).

**Stagger order + onsets** (relative to t = 1240, the beam-land; the beam's brightest core lands on the
general strip, so the strip leads, then the gutter cards fill up the "+"):

| order | plus group (node) | onset (ms) | settled (ms) |
|---|---|---|---|
| 1 | **General strip** — the 3 clips (the horizontal stroke of the "+"), the beam's core landing | 1240 | 1620 |
| 2 | **Overview card** (right gutter, top) | 1360 | 1740 |
| 3 | **Contents/TOC card** (right gutter, below overview) | 1480 | 1860 |
| 4 | **Tall portrait clip** (right gutter, bottom — completes the vertical stroke) | 1620 | 2000 |

Last group settles by **t = 2000** (matches the §1.1 plus-reveal end). The stagger reads as the "+"
assembling along the throw — horizontal stroke first (where the beam core lands), then the vertical
gutter fills top→bottom. **No residual transform/opacity** on any plus group at settle (all at
`opacity 1`, identity transform = today's static cards).

> The article ground stays put; the plus groups occupy their **final layout boxes** the whole time
> (they animate `transform`/`opacity`, not flow), so the miniature never reflows (CLS = 0) and the
> input/ground are never displaced.

#### A — Surface (theater field + lit miniature tone)

**Mechanism: a single full-field dimming overlay that fades out** (recommended — simplest, provably
GPU-composited, leaves zero residue). A decorative `aria-hidden` overlay element is layered over the
theater field at the **lowest z** of the scene content (above `.about-theater-field`'s paint, below the
card/projector/miniature so it dims the *room*, not the legible card copy — see §5 note on the card).
It is filled with the near-black theater edge color at a starting opacity and **fades to opacity 0**,
so the field reads dimmer at t = 0 and resolves to its exact committed radial when the overlay is gone
(no change to the committed `.about-theater-field` tokens — AC2). This avoids animating
`background`/`filter` on the field itself (which can force paint) and guarantees the final tone is the
untouched committed radial.

- Overlay fill: `var(--color-theater-3)` (the field's near-black edge stop), so fading it out only ever
  *reveals* the committed warm radial — it can never overshoot past the final tone.
- Overlay starting opacity: **0.55** (the AC1 "observably dimmer" start — the warm centre is muted, the
  room reads cooler/darker).
- `surface-brighten 640ms cubic-bezier(0.33,0,0.67,1)` (*easeInOut* — a lamp warming the room):

| t (ms) | overlay opacity | reads as |
|---|---|---|
| 0    | 0.55 | dimmer room (AC1c) — held until ramp begins |
| 600  | 0.55 | (ramp onset — coincides with the lamp passing mid-warm-up) |
| 900  | 0.30 | brightening |
| 1240 | **0.00 (overlay gone — final committed tone)** | room at full brightness, lamp at max (AC4) |

**The coupling (AC4):** the overlay reaches **0 at t = 1240 — the same instant the lamp reaches max**
(P2 end). The surface therefore *cannot* reach its final tone before lamp-max. (Implementation note for
Dev: drive both off the same `t = 1240` end so the coupling is structural, not two timers that could
drift — e.g. equal-end keyframes, or a shared timeline in WAAPI.)

> **The miniature's "lit" tone.** Per the Product spec, the miniature gains **no warm halo** (AC2) — it
> keeps its soft drop shadow. Its "lit" cue is *the beam landing on it*. So the miniature's
> surface-brighten is delivered **by the same room overlay fading off it** (it sits under the overlay
> like everything else) plus the beam arriving (P3). Do **not** add a separate brightness ramp or glow
> on the miniature — that would reintroduce a halo and break AC2.

### 1.3 What animates vs. what is static (audit)

- **Animated (motion-gated):** lamp light group (B), beam group (C), each plus group (D), the dimming
  overlay (A). All `opacity`/`transform` only.
- **Static from t = 0 (never animated):** the card (F), the article ground (E — title input, body
  lines, section bars), the projector *body* (the indigo chassis, lens stack, feet, dials — only the
  *light* layers animate), the committed `.about-theater-field` radial tokens, the miniature drop
  shadow, layout/flow of every box.

---

## 2. Initial (pre-illumination) vs. final state (the bookends)

### 2.1 Initial state at the first painted frame (t = 0) — AC1

| Element | t = 0 state |
|---|---|
| Lamp light group (B) | opacity **0.06** — dim/off; the cool lens stack shows, the warm/white aperture is barely lit. (AC1a) |
| ＋plus layer (D) | **hidden** — opacity 0; the miniature shows the **bare article ground only** (title + body lines + section heads). (AC1b) |
| Beam (C) | hidden — `scaleX(0.04)`, opacity 0 (not yet thrown). |
| Surface (A) | **dimmer** — dimming overlay at opacity **0.55** over the committed radial. (AC1c) |
| Article ground (E) | **fully present + visible** (title input focusable, body/section bars painted). |
| Card (F) | fully present, lit, legible. |

All three AC1 conditions hold at the first painted frame: lamp dim, plus hidden, surface dimmer — and
each is independently testable (a brightness/opacity signal below its final value; plus nodes
hidden/transparent).

### 2.2 Final (settled) state — AC2

After t ≤ 2200 ms (and at all times once settled) the scene is **pixel-equivalent to `178c148`**:

- Lamp light group opacity **1** (committed lit projector); no residual transform.
- Beam group `scaleX(1)` identity, opacity 1; the three cones at their committed per-cone opacities.
- All four plus groups opacity 1, identity transform (committed indigo cards/clips).
- Dimming overlay opacity **0** (fully transparent; may be `display:none`/removed once at 0 — but only
  *after* it reaches 0, never as the mechanism that hides it before).
- Theater field = the untouched committed radial; miniature = soft drop shadow, **no halo**.
- Card in its tier-appropriate position (overlaid upper-left `≥ xl`; first-in-flow stacked otherwise).

**No element carries a non-final inline opacity/transform/brightness once settled** (AC2-ii / AC10):
the animations either complete to identity/opacity-1 values that equal the static CSS, or Dev tears
down the animation and the inline overlay node so the DOM re-reads as today's static poster.

---

## 3. Reduced motion — `prefers-reduced-motion: reduce` (AC6)

**The reduced-motion path renders the FINAL static state on first paint, with no intro at all** — and
it is the **safe default** the implementation falls back to (the animated path is the additive layer
gated behind `@media (prefers-reduced-motion: no-preference)`, exactly like every existing About/topic
animation in `globals.css`: the dock-in, the search-grow, the gs-fade).

Under `reduce`, on the first painted frame:
- the lamp light group is at opacity 1 (full brightness),
- the beam group is `scaleX(1)` / opacity 1 (cones present, reaching the page),
- all plus groups are opacity 1 (fully revealed),
- the dimming overlay is opacity 0 / absent (surface at final committed tone).

i.e. **identical to AC2's settled state, immediately** — no flicker, no dim-start, no beam-extend, no
delayed/animated plus reveal, no surface ramp. **No flashing, no late content.**

**Implementation mirror (binding):** wrap **all** the warm-up keyframes/animations in
`@media (prefers-reduced-motion: no-preference)` (the gate the spec mandates and `globals.css` already
uses for `wikiplus-search-grow`, `.pinned-dock-in`, `.gs-fade-in`). The element default values (the
ones that apply with **no** animation running) **are the final-state values** — so a `reduce` user, or
any pre-hydration/no-JS render, gets the static poster with nothing to suppress. Mirror the existing
`@media (prefers-reduced-motion: reduce) { … animation: none }` belt-and-braces only if Dev attaches an
animation outside the no-preference gate; the cleaner construction (final values are the defaults; the
intro lives entirely inside the no-preference block) needs no `reduce` block at all, matching the
header-projector note in `globals.css` §"reduced motion" (the end-states are the steady state; nothing
extra is needed).

---

## 4. Responsive — per width tier (AC12)

The intro plays coherently at all three poster tiers of `178c148`. The projector + beams exist **only
`≥ lg`** (they live in the `.about-stage hidden lg:block` scene in `Centerpiece.tsx`); below `lg` the
miniature is **alone**. No tier scrolls horizontally at any frame.

### 4.1 `≥ xl` — the full POSTER (all five steps)
The card is overlaid upper-left (present + lit from first paint; **not** in the choreography — AC6/AC7).
The projector sits lower-left, the diagonal beam throws up-right to the dropped miniature upper-right.
The **full five-step choreography** runs exactly as §1: flicker → warm-up → beam grows up-right to the
dropped miniature → ＋plus staggers in along the throw → surface brightens to final (coupled to lamp-max).

### 4.2 `lg`–`xl` — STACKED (card first, the full scene below; all five steps)
The same `.about-stage` scene (projector + beam + miniature) runs the **full five-step choreography**,
identical timing/easing to §4.1. Only the page layout differs (the card is stacked above the scene, not
overlaid). The beam/projector/miniature geometry is the same 1280×880 frame, scaled to the column.

### 4.3 `< lg` — STACKED, miniature ALONE (reduced intro: steps 4 + 5)
There is **no on-screen projector or beam** (`.about-stage hidden lg:block` is hidden; the
miniature-alone `.about-stage` renders). So steps 1–3 have nothing to play. The reduced intro is:

- **Step 4 — ＋plus reveal:** the `<PlusLayer>` groups stagger in onto the present article ground,
  **same per-group transition** as §1.2-D (fade + scale + small slide), same stagger order
  (strip → overview → contents → portrait). Because there is no beam landing to time against, the
  stagger **starts at t = 240 ms** (a short beat after first paint so the page reads as "article first,
  then the plus appears") and the last group settles by **t = 1000 ms**. The slide vector here is a
  neutral small upward nudge (`translateY(10px) → 0`) since there is no on-screen beam axis to ride.
- **Step 5 — surface brighten:** the **miniature's** room dimming is delivered by the **same dimming
  overlay mechanism** scoped to the miniature-alone stage (an overlay over the miniature stage that
  fades `0.55 → 0` over `t = 0 → 700 ms`, `easeInOut`). Since there is no lamp on screen, the AC4
  lamp-max coupling has no on-screen referent; the surface simply brightens to its final tone over the
  ramp. The miniature still ends pixel-equivalent to today's `< lg` static miniature (soft drop shadow,
  **no halo**).

Total `< lg` intro ≈ **1000 ms** (shorter — there's less to sequence). Start/end-state guarantees
(AC1/AC2) hold for the elements present: at t = 0 the plus layer is hidden + the miniature surface is
dimmer; at settle it equals the committed `< lg` miniature.

### 4.4 No horizontal scroll, any tier (AC12)
Every animated transform is either an opacity (no geometry), a `scaleX ≤ 1` about an interior apex
(beam, `≥ lg` only), or a sub-15-px translate **inside** an `overflow:hidden` clipped `.about-stage`
box. No element is translated outside its stage box. The overlay is `inset:0` within its field/stage
(no overflow). Verified at 390 / 834 / 1280 (AC12's test widths): the appropriate tier-intro runs, no
horizontal scrollbar appears at any frame, settled = baseline at each width.

---

## 5. Accessibility (the intro is decorative-only)

- **Content present + reachable throughout, both motion modes (AC7).** The intro animates only
  appearance; it must **not** `display:none`, `visibility:hidden`, `aria-hidden`, disable, or remove
  any content while animating, and must **not** delay availability. The "How it works" heading + steps,
  the `sr-only` scene description, and the **miniature title input** (the one real control) are in the
  DOM + accessibility tree from the first frame and stay so. The title input is in the tab order,
  focusable, editable, and Enter-navigable during and after the intro.
- **No focus steal, no input gating (AC8).** Loading `/about` must **not** move focus into the scene
  (no autofocus, no `.focus()` on mount); initial focus behavior is unchanged from today. A keyboard
  user can Tab to the title input and a pointer user can click it **during** the intro; typing + Enter
  works immediately. There is **no animation-gated input lock** — the intro is a sibling visual layer,
  not a modal or a blocker. (The dimming overlay and beam group are `pointer-events:none` so they never
  intercept a click meant for the input or any control.)
- **No new color/motion-only signal (AC9).** The lamp, beam, bloom, and the revealing plus cards/clips
  stay **decorative** — `aria-hidden` exactly as today (`Projector.tsx`, `Beams.tsx`, and the
  decorative groups in `TopicMiniature.tsx`). The animation adds **no** information a user must perceive
  as motion or color: the projector→page→＋plus thesis lives in the card copy + the `sr-only`
  `SCENE_DESCRIPTION`, which are unchanged. A user who never sees the motion (reduced-motion, slow
  device, screen reader) loses nothing.
- **The dimming overlay is `aria-hidden` and below the card copy in z-order.** It dims the *room* (the
  field + projector + miniature), not the load-bearing card text — the card stays fully legible from
  the first frame (the card is at `xl:z-20`, above the beam; keep the overlay below the card's z so the
  copy is never veiled). The overlay carries no role/label; it is pure decoration.

---

## 6. Determinism for capture (AC11) — the recommended hook for Dev + the e2e catalog

**The problem:** the current About catalog scene (`e2e/screenshots/catalog.ts` id `about`) waits via
`homeReady` (the "wiki+" link + first heading + a 300 ms settle) and the capture harness
(`scripts/dev/shots.sh` / Playwright) does **not** force reduced motion. So a capture could race a
mid-intro frame and the About baseline would no longer equal `178c148`.

**Recommendation — do both (belt-and-braces); they are independent and cheap:**

1. **A `data-about-intro="settled"` readiness signal on the scene root (primary hook).**
   Dev exposes a single attribute on the `Centerpiece` `<section>` (or the `<main>`): `data-about-intro`
   = `"running"` while any warm-up animation is in flight, flipped to `"settled"` when the intro
   completes (or set to `"settled"` immediately under `reduce` / no-preference-off). Drive the flip off
   the **last** animation's `finish`/`animationend` (WAAPI `Animation.finished` Promise, or the
   `animationend` of the longest-running keyframe), with a hard fallback timer at **t = 2200 ms** so the
   signal always resolves even if an `animationend` is missed. This is the project's existing idiom — a
   readiness attribute the capture waiter blocks on, exactly like `topicReady`/`homeReady` wait on
   real DOM signals rather than a bare timeout.

2. **Capture `/about` under forced reduced motion (secondary, makes the baseline structurally a
   no-intro render).** Add an About-scene `ready` waiter (`aboutSettled`) that (a) emulates
   `prefers-reduced-motion: reduce` for the About page context, **or** (b) waits for
   `data-about-intro="settled"`. Forcing `reduce` is the most robust: under `reduce` the **first paint
   is the final state** (§3), so there is no frame to race — the baseline is `178c148` by construction.
   Pair it with the settled-attribute wait so even a no-preference capture (if the harness ever runs
   one) still waits out the intro.

**Concrete catalog change Dev should make** (one scene edit, no new surface):

```ts
// e2e/screenshots/catalog.ts — replace the `about` scene's `ready`:
async function aboutSettled(page: Page): Promise<void> {
  await homeReady(page); // wordmark link + first heading (existing)
  // Either force the no-intro path…
  await page.emulateMedia({ reducedMotion: "reduce" });
  // …and/or wait the settled signal (covers a no-preference capture):
  await page
    .locator('[data-about-intro="settled"]')
    .waitFor({ timeout: 3000 })
    .catch(() => {});
}
// …then `ready: aboutSettled` on the `about` scene.
```

This keeps the **settled final state** as the baseline (AC11): the regenerated `docs/design/
ui-screenshots` About PNGs equal the prior committed About PNGs within the project's normal pixel
tolerance, deterministically, with no mid-intro race. **Refresh the About baseline in the same PR**
(`scripts/dev/shots.sh --scene about --commit ui` for the partial refresh, since this changes only the
About surface's capture timing, not the static look).

---

## 7. Replay policy (AC10)

- **One-shot per page load.** The intro plays **once** on each load of `/about` and then stops — it
  does **not** loop, does **not** replay on scroll/hover/click, and leaves **no** residual animation
  after it settles (§2.2). After the settle window, re-reading the DOM shows the static final state
  with no lingering animation classes/inline styles that change the rendered look.
- **Soft client-side nav back to `/about` — replay on each arrival (confirm the Product assumption).**
  The Product spec's starred decision is to replay on each *load* of the route, including an App-Router
  soft-nav that mounts the centerpiece. **UX confirms this** — to the visitor a soft-nav to `/about`
  *is* arriving at the page, so the "warm-up" replaying is coherent and matches "on page load." It must
  remain **one-shot per arrival** (not loop). A full reload always replays. Mechanism: tie the intro to
  the `Centerpiece` mount (it remounts on a soft-nav into `/about`), not to a session flag. If the owner
  later prefers "first visit per session only," that is a one-line gate (a `sessionStorage` check on
  mount) — **not blocking**, not built here.

---

## 8. Hand-off to Development

Build the intro as **CSS keyframes / WAAPI gated behind `@media (prefers-reduced-motion: no-preference)`**
(mirroring `globals.css`'s `wikiplus-search-grow` / `.pinned-dock-in` / `.gs-fade-in`), animating
**opacity/transform only**, over the **existing markup** — the lamp light layers (`Projector.tsx`),
the three beam cones + motes (`Beams.tsx`), the four `<PlusLayer>` groups (`TopicMiniature.tsx`), and a
new decorative `aria-hidden` dimming overlay over the theater field / miniature stage. Implement to the
keyframe tables in §1.2 and the bookends in §2.

Hard requirements (re-stated so Dev never guesses):
- Element **default** (no-animation) values **are the final-state values** → `reduce` and no-JS get the
  static poster for free (§3).
- **No focus move, no input gating, no `aria-hidden`/`display:none` on content, no layout animation**
  (CLS = 0) — §5.
- The surface overlay reaches 0 **exactly at lamp-max** (t = 1240) — drive both off one shared end so
  the AC4 coupling can't drift (§1.2-A).
- Expose `data-about-intro="settled"` (with a 2200 ms fallback) and add the `aboutSettled` catalog
  waiter; refresh the About baseline (§6).
- The miniature gains **no halo** (AC2) — its "lit" cue is the overlay lifting + the beam landing only.

After Dev implements and QA verifies AC1–AC12, **UX evaluates the built motion against this spec** —
render the standard About-scene screenshot evidence (settled), confirm the flicker rhythm reads as a
projector striking, the beam reaches before the plus reveals, the surface couples to lamp-max, and the
reduced-motion path is pixel-identical to `178c148`.
