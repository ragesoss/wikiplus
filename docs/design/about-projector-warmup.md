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
| B | **Lamp** | the white `+` aperture (clipped to `#proj-pclip`) + the two warm `bloom` radials in `Projector.tsx`, **over the designed OFF-state lens base** (see §2.1.1) | **Step 1** flickers, **Step 2** ramps dim→bright, **starting from the designed OFF lens** (dark interior + geometric `+`), not a dimmed copy of the lit lamp. |
| B′ | **OFF-state lens base** | a small **always-present `off-lens` group** Dev adds to `Projector.tsx` directly above the lit `about-lamp-light` group: a dark interior fill on the lamp-base ellipse, a geometric `+`, and a faint reflection (the committed handoff OFF state, adapted to the angled lens — §2.1.1) | The **floor the intro starts on**: visible by geometry from t = 0 so the lens is never an empty/edgeless hole. Static (never animates); fully occluded by the lit group once it reaches opacity 1. |
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
`+` aperture fill, the `url(#proj-plamp)` glass radial, and the two `bloom` circles) **rising over the
designed OFF-state lens base** beneath them (the new `off-lens` group — §2.1.1). At t = 0 the lit
layers are at opacity 0, so the lens reads as the **designed OFF projector**: a dark interior with the
`+` aperture visible **by geometry** (a dark `+` with a faint lighter outline), a faint glass
reflection, and **no warm bloom**. As the group's opacity rises, the white-hot `+` and warm bloom
"light up" over that off geometry; at full they are opacity 1 = today's lit projector, fully occluding
the off base.

> **Not a 6 %-opacity glow.** The intro must **not** start the projector as the lit lamp at a near-zero
> opacity (which nearly hides it). It starts as the committed **OFF** state — the `+` is legible while
> off because it reads by *geometry* (a dark plus on a darker field), exactly as the handoff specifies
> (*"the lens interior is dark, and the plus-shaped aperture … reads by geometry, not glow. We'll light
> it up when it's on."*). The lit-layer opacity below is what *animates*; the off base is the static
> floor it animates over.

Treat the aperture-`+`-fill + glass radial + both bloom circles as one **`lamp-light` group** whose
group opacity is animated (a single wrapping `<g>` Dev adds, or per-node parallel keyframes — Dev's
choice; the group is cleaner). The `off-lens` base group (§2.1.1) sits directly **beneath** it and does
**not** animate.

The transition both phases drive is **the lens lighting up**: the static OFF base (§2.1.1) — a dark
geometric `+` on a dark interior, no bloom — is **overtaken by the lit `lamp-light` group** (the
white-hot `+`, the warm glass radial, and the two bloom circles) as that group's opacity rises 0 → 1.
The flicker is the lamp *striking* (uneven flashes of the LIT layer over the still-present off lens);
the warm-up is the steady ramp of the lit `+` + bloom to full while the off-state's dark geometric `+`
is progressively buried by the glow. **The OFF base never animates and never leaves** — so the lens is
never empty/edgeless at any frame; only the lit layer + bloom animate on top of it.

**P1 — flicker** (`animation: lamp-flicker 520ms steps/linear, one-shot`). *Uneven* flashes — irregular
gaps, not a smooth pulse (the spec's "a few quick, uneven flashes, like a real projector striking").
Concrete rhythm (group opacity of `lamp-light`, **layered over the static OFF base**):

| % of P1 | t (ms) | `lamp-light` opacity | what reads on screen |
|---|---|---|---|
| 0%   | 0   | **0.00** | the **designed OFF lens** — dark interior, geometric `+`, faint reflection, no bloom (§2.1.1). The lit layer is fully absent. |
| 6%   | 30  | 0.55 | first strike (quick) — the white `+` + bloom flash *over* the off `+` |
| 12%  | 62  | 0.06 | drop — falls back almost to the bare OFF lens |
| 16%  | 84  | 0.70 | second strike |
| 19%  | 100 | 0.08 | drop (uneven gap — shorter than the first) |
| 30%  | 156 | 0.40 | weak third strike |
| 34%  | 177 | 0.05 | drop — nearly the OFF lens again |
| 52%  | 270 | 0.85 | fourth strike (longer gap before it — the "catch") |
| 58%  | 300 | 0.30 | settle dip |
| 100% | 520 | 0.30 | hold low, ready to warm up — off `+` still reading through the partial glow |

Use `steps`-like hard transitions (or `linear` with near-coincident keys) so each strike reads as a
*snap*, not a fade — that is the projector-striking character. The drops fall to **near 0** (the lit
layer all but vanishes) so each gap snaps back toward the visible OFF lens, which makes the strikes
read as a lamp catching against a real dark lens rather than a dimmer wobbling. Keep peaks below 0.9 so
P1 never reaches full brightness before P2 (preserves AC3 onset order: flicker → warm-up). End P1 at
**0.30** so P2 has a clear dim→bright run.

**P2 — warm-up dim→bright** (`lamp-warm 720ms cubic-bezier(0.22,0.61,0.36,1)` — *easeOutQuart*, a
filament-like fast-then-settle ramp). This is the off `+` being **overtaken** by the lit `+` + bloom:

| t (ms) | `lamp-light` group opacity | what reads on screen |
|---|---|---|
| 520  | 0.30 (hand-off from P1) | off `+` geometry still visible through a partial glow |
| 760  | 0.78 | the white `+` + warm bloom now dominate; off geometry mostly buried |
| 1000 | 0.94 | off base all but fully occluded by the glow |
| 1240 | **1.00 (max — the committed lit projector)** | lit group fully opaque → OFF base completely hidden beneath it |

After t = 1240 the lamp holds at opacity 1 = the static poster lamp, and the lit group **fully occludes
the OFF base** (the lit lamp-base radial + white `+` + bloom paint over the off interior + off `+`; see
§2.2 AC2 confirmation). **No residual transform** on the lamp; the bloom radials are not scaled (their
committed radius is the final look). The OFF base group remains in the DOM beneath, unanimated and
covered — never `display:none`'d, so a re-mount/replay starts cleanly from the off lens again.

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
  *light* layers animate), **the `off-lens` base (B′ — the designed OFF interior + geometric `+` +
  reflection; the floor the lit layers animate over, occluded once lit — §2.1.1 / §2.2)**, the
  committed `.about-theater-field` radial tokens, the miniature drop shadow, layout/flow of every box.

---

## 2. Initial (pre-illumination) vs. final state (the bookends)

### 2.1 Initial state at the first painted frame (t = 0) — AC1

| Element | t = 0 state |
|---|---|
| Lamp light group (B) | opacity **0.00** — the lit layers (white `+`, glass radial, both blooms) are **fully absent**; the projector renders in its **designed OFF state** via the always-present `off-lens` base beneath it — dark interior + `+` aperture visible **by geometry** + faint reflection, **no warm bloom** (§2.1.1, AC1a). |
| OFF-state lens base (B′) | **fully present + visible** (static): the dark off interior, the geometric dark `+` with its faint lighter outline, and the faint glass reflection. This is what reads as "the projector is off" at first paint. |
| ＋plus layer (D) | **hidden** — opacity 0; the miniature shows the **bare article ground only** (title + body lines + section heads). (AC1b) |
| Beam (C) | hidden — `scaleX(0.04)`, opacity 0 (not yet thrown). |
| Surface (A) | **dimmer** — dimming overlay at opacity **0.55** over the committed radial. (AC1c) |
| Article ground (E) | **fully present + visible** (title input focusable, body/section bars painted). |
| Card (F) | fully present, lit, legible. |

All three AC1 conditions hold at the first painted frame: **lamp off (designed OFF lens, lit layer at
opacity 0)**, plus hidden, surface dimmer — and each is independently testable (the lit-layer opacity
is 0 / below its final value; plus nodes hidden/transparent). The lamp's AC1a "observably not-yet-lit"
signal is now **stronger and truer to the handoff**: the lens is unmistakably a dark, off projector
whose aperture you can still *see* (by geometry), not a near-invisible 6 %-opacity ghost of the lit lamp.

#### 2.1.1 The designed OFF-state lens base (`off-lens` group) — what Dev adds + how it maps onto the angled lens

The committed handoff defines the projector's OFF state on the **front round lens**
(`docs/design/about-centerpiece-handoff/Projector.dc.html`): a **dark bezel `#2C2C2C`**, a **glass
off-mode dark interior `#201c3a`** (stroke `#16132a`), a **large `+` aperture that reads by GEOMETRY,
not glow** — fill `#2e2a52`, faint stroke `#433d72` at 0.6 opacity, "magnified to nearly fill the
visible glass" — and a **faint glass reflection** (`#8086ca` at ~0.2, a small rotated ellipse). The
shipped `Projector.tsx` uses the **ANGLED ON lens** (the ellipse stack with a vertical major axis for
the yaw), so the OFF treatment is **adapted onto that angled geometry**, not the round-lens coordinates
verbatim. Dev adds a small static `off-lens` `<g>` directly **above** the existing cool lens stack and
directly **below** the `about-lamp-light` group in `Projector.tsx` (i.e. it paints on top of the
`lamp-base` ellipse, under the lit layers), composed of three nodes:

1. **Dark off interior** — fill the lens interior in the handoff's off-mode dark tone. The lit lens
   already has a `lamp-base` ellipse at `cx438 cy272 rx32 ry47`; lay an off-interior ellipse of the
   **same geometry** (`cx438 cy272 rx32 ry47`, optionally `rx31 ry46` to sit just inside the ink rim)
   filled **`#201c3a`** (the handoff `--`-class off interior; introduce a token e.g.
   `--color-lens-off-interior: #201c3a` rather than a raw hex, per AC18-style token discipline) with a
   thin **`#16132a`** stroke. This replaces the *visual role* of the handoff's `r47` off-mode glass
   circle, mapped to the angled ellipse.
2. **Geometric `+` aperture** — a `+`-shaped `<path>` **clipped to `#proj-pclip`** (the same clip the
   lit white `+` uses, ellipse `cx438 cy272 rx31 ry46`), sized to **nearly fill the visible glass**
   (use the lit `+`'s own path bounds — `d="M429,225 h18 v33 h23 v28 h-23 v33 h-18 v-33 h-23 v-28 h23
   v-33 z"` — or a path of equivalent extent), filled **`#2e2a52`** with a faint **`#433d72` stroke at
   stroke-opacity 0.6**. This is the load-bearing element: the `+` must be **legible while off**, read
   by *geometry* (a dark plus sitting on the slightly-darker `#201c3a` interior, edged by the faint
   lighter outline) — **never** a glow. Tokens e.g. `--color-aperture-off: #2e2a52`,
   `--color-aperture-off-edge: #433d72`.
3. **Faint glass reflection** — a small rotated ellipse, fill **`#8086ca` at opacity ~0.2**, placed
   high-left on the glass and rotated ~`-32°` (the handoff reflection), scaled to the angled lens (a
   small ellipse, e.g. `rx ~11 ry ~7`, positioned upper-left of the lens centre at roughly
   `cx ~424 cy ~250`, `transform="rotate(-32 424 250)"`). Decorative sheen only; it persists from the
   off state and is harmless under the lit glow (the lit bloom/radial sit above it). Token e.g.
   `--color-glass-sheen: #8086ca`.

The whole `off-lens` group is **static** (never keyframed), `aria-hidden` like the rest of the SVG, and
carries no functional signal. It exists so the lamp's "off" state is the **designed** off lens — dark
interior + geometric `+` + reflection — and so the lens is **never an empty or edgeless hole** at any
frame of the intro (the lit layers animate *over* it). Concrete intent for Dev: keep all three nodes on
the same `cx438 cy272` centre as the angled lens stack, reuse `#proj-pclip` for the `+` so it can't
spill past the glass, and place the group's three nodes in paint order interior → `+` → reflection.

### 2.2 Final (settled) state — AC2

After t ≤ 2200 ms (and at all times once settled) the scene is **pixel-equivalent to `178c148`**:

- Lamp light group opacity **1** (committed lit projector); no residual transform.
- **OFF-state `off-lens` base fully occluded** (see the AC2 note below) — present in the DOM, painting nothing the viewer can see.
- Beam group `scaleX(1)` identity, opacity 1; the three cones at their committed per-cone opacities.
- All four plus groups opacity 1, identity transform (committed indigo cards/clips).
- Dimming overlay opacity **0** (fully transparent; may be `display:none`/removed once at 0 — but only
  *after* it reaches 0, never as the mechanism that hides it before).
- Theater field = the untouched committed radial; miniature = soft drop shadow, **no halo**.
- Card in its tier-appropriate position (overlaid upper-left `≥ xl`; first-in-flow stacked otherwise).

**No element carries a non-final inline opacity/transform/brightness once settled** (AC2-ii / AC10):
the animations either complete to identity/opacity-1 values that equal the static CSS, or Dev tears
down the animation and the inline overlay node so the DOM re-reads as today's static poster.

> **AC2 — the settled lens is pixel-equivalent to today's static `Projector.tsx`, with the OFF base
> present underneath.** The `off-lens` group adds DOM but must contribute **zero visible pixels once
> the lamp is lit**, so the settled projector equals the committed lit projector exactly. This holds by
> **paint-order occlusion**, no fade-out needed: the `off-lens` group sits **below** `about-lamp-light`,
> and at settle the lit group is fully opaque (group opacity 1). The lit group's **clipped glass-lamp
> radial** (`ellipse cx438 cy272 rx32 ry47 fill=url(#proj-plamp)`) is an **opaque** radial (its stops
> are solid colours — `content-white` → `lamp-core` → `lamp-edge`, no transparency), painting over the
> **entire** off interior + off `+` (both bounded by the same `cx438 cy272 rx32 ry47` ellipse / the
> `#proj-pclip` clip), and the lit white `+` paints over the off `+`. The two warm **bloom** radials
> (`r150`, `r96`, centred on the lens) paint over the faint reflection's region. Net: every off-state
> pixel lies beneath an opaque lit pixel at settle → the visible lens is byte-for-byte the committed lit
> lens. **Therefore the off base needs no settle-time fade** (it is hidden by occlusion, not by opacity)
> and is **never** `display:none`'d. *Verification Dev/QA owes:* if for any reason the lit glass radial
> does **not** fully cover the off interior/`+` at settle (e.g. a future tweak makes a lit stop
> translucent or shrinks the lit lamp-base/glass ellipse below the off interior's extent), then add a
> belt-and-braces `off-lens` opacity fade `1 → 0` completing **by lamp-max (t = 1240)** so the off base
> is gone by settle. Default = occlusion (no fade); the fade is the fallback only if occlusion is not
> total. Either way the settled lens equals `178c148`.

---

## 3. Reduced motion — `prefers-reduced-motion: reduce` (AC6)

**The reduced-motion path renders the FINAL static state on first paint, with no intro at all** — and
it is the **safe default** the implementation falls back to (the animated path is the additive layer
gated behind `@media (prefers-reduced-motion: no-preference)`, exactly like every existing About/topic
animation in `globals.css`: the dock-in, the search-grow, the gs-fade).

Under `reduce`, on the first painted frame:
- the lamp light group is at opacity 1 (full brightness) — **the designed OFF lens is never shown**
  (it is part of the intro; the lit group occludes it from the first paint exactly as at settle),
- the beam group is `scaleX(1)` / opacity 1 (cones present, reaching the page),
- all plus groups are opacity 1 (fully revealed),
- the dimming overlay is opacity 0 / absent (surface at final committed tone).

i.e. **identical to AC2's settled state, immediately** — no flicker, no dim-start, no beam-extend, no
delayed/animated plus reveal, no surface ramp, **and no off→on light-up: the projector is lit from the
first frame.** The `off-lens` base is in the DOM but contributes zero visible pixels (occluded by the
opaque lit group), so a `reduce` user sees only the lit poster. **No flashing, no late content.**

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

**One new static element this revision adds:** the **`off-lens` base group** in `Projector.tsx` (§2.1.1)
— the designed OFF lens (dark interior `#201c3a`-class + geometric `+` `#2e2a52` with a faint `#433d72`
edge + a faint `#8086ca` reflection), adapted onto the angled lens, painted **between** the cool lens
ellipse stack and the `about-lamp-light` group. It is **static** (never keyframed) and the floor the
lit-layer light-up animates over. New colour tokens (off interior / off aperture / off-aperture edge /
glass sheen) per the project's token discipline, not raw hex in the component.

Hard requirements (re-stated so Dev never guesses):
- Element **default** (no-animation) values **are the final-state values** → `reduce` and no-JS get the
  static poster for free (§3). For the lamp specifically: the `about-lamp-light` group's **default
  opacity is 1** (lit). The `off-lens` base is the floor it animates *over* in the no-preference path
  only — under `reduce`/no-JS the lit group at opacity 1 occludes it, so the OFF state never shows.
- The projector's t = 0 (no-preference) **off state is the designed OFF lens** (§2.1.1) — dark interior
  + `+` visible **by geometry** + faint reflection, **no bloom** — **not** a near-zero-opacity copy of
  the lit lamp. The lit `lamp-light` group **animates from opacity 0** (not 0.06) over that off base.
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
