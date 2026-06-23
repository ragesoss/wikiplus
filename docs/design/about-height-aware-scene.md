# Design spec — About-page height-aware full-scene gate

**Type:** UX layout/responsive design spec · **Milestone:** Functional prototype
**Status:** Design spec — the buildable contract Development implements against; written **before** any
implementation code. **Issue:** [#145](https://github.com/ragesoss/wikiplus/issues/145).
**Builds on / does not restyle:** the committed About poster + the warm-up choreography
(`docs/design/about-projector-warmup.md`, `docs/specs/about-projector-warmup.md`). This spec changes
**when** the full poster scene renders vs. the miniature-alone fallback; it changes **nothing** about
how either looks, animates, or behaves once rendered.

This is a **layout-gating** fix, not a visual or motion change. The settled poster, the warm-up
sequence, the power toggle, the reduced intro, the dynamic title, and every a11y guarantee in the
warm-up spec are all preserved verbatim. The single new rule: **the full poster scene now requires
enough viewport HEIGHT as well as enough width; when the viewport is wide enough but too short, the
page falls back to the already-designed miniature-alone layout.**

---

## 1. The problem + the user impact

The About page is the product's one orientation surface — a single dark "theater" room with the
"How it works" card, the projector, its beam, and the lit Topic-page miniature composed in it. The
full poster scene is gated on **width only** (`lg:block`, ≥ 1024px) and scales **width-driven**
(`aspect-ratio: 1280/880` + `transform: scale(100cqw / 1280)`) with **no height awareness**.

On a **wide-but-short** viewport — the canonical case is **iPad Mini landscape ≈ 1024 × 768** — this
breaks:

- The full scene shows (≥ lg width satisfied) and renders ~**682 px tall** at that width (see §2).
- Stacked under the "How it works" card inside the vertically-centered `min-h-[calc(100vh-56px)]`
  main, it overflows the short content area.
- The projector is anchored at the scene's **lower-left** (bottom of the 880-tall reference frame),
  so it is what gets pushed **out of the visible area**.
- The full-stage beam SVG still renders — an **orphaned beam** hanging in the dark with no visible
  projector source.
- The Topic-page miniature **clips off the right edge**.

**Who hits it:** landscape-tablet visitors (iPad Mini and similar short-landscape tablets) and
**short-window desktop** users (a desktop browser whose window is ≥ 1024 wide but < ~820 tall — a
docked/half-height window, a small laptop with browser chrome eating height). On a page whose entire
job is to make a first-time visitor *grok the product at a glance*, a broken composition with a beam
pointing at nothing is the worst possible first impression. Both "fine" cases today — tall desktop
(wide AND tall) and < lg phone/tablet (the miniature-alone fallback) — already render correctly; this
spec only fixes the wide-but-short gap between them.

---

## 2. The chosen min-height threshold + reasoning chain

### The value

> **Full poster scene requires `min-height: 820px` (with `min-width: 1024px`). Below 820px tall, fall
> back to the miniature-alone layout.**

### The height budget math (the derivation — not from screenshots)

**Scene rendered height** is purely a function of container width, because the stage scales by width:

```
scene height = containerWidth × (STAGE_H / STAGE_W) = containerWidth × (880 / 1280) = containerWidth × 0.6875
```

The `<main>` content column is `max-w-[1400px]` with `px-4` (16px each side), so
`containerWidth ≈ min(viewportWidth, 1400) − 32`.

| Viewport width | Container width | Scene height (`× 0.6875`) |
|---|---|---|
| 1024 (iPad landscape, lg) | ~992 px | **~682 px** |
| 1280 (desktop capture, xl) | ~1248 px | **~858 px** |
| 1400+ (max container) | ~1368 px | **~941 px** |

**Available content height** inside main is `100vh − 56px` (header), with `py` padding inside it
(`py-12` = 96px total < sm; `py-16` = 128px total ≥ sm):

| Viewport height | `min-h` (100vh − 56) | usable after py-16 (−128) |
|---|---|---|
| 768 (iPad landscape) | 712 px | **~584 px** |
| 900 (desktop capture) | 844 px | **~716 px** |

At **1024 × 768**: the scene alone needs ~682 px and the **lg…xl tier stacks the card ABOVE it**
(the card `max-w-[560px]` "How it works" block with heading + steps + `gap-10` = 40px between card and
scene — call it ~220–280 px of card+gap). Scene (~682) + card+gap (~250) ≈ **~932 px** demanded into a
~584 px usable area → a ~350 px overflow, and because the composition is bottom-anchored (projector at
the frame's bottom), the projector is what falls out. **The break is real and large at 768 tall.**

### The two hard bounds + the margins

The threshold must live in the open interval **(768, 900)**:

- **Lower bound — iPad Mini landscape (768 tall) MUST fall back (AC1).** Threshold must be **> 768**.
  At **820** the margin above 768 is **52 px**: 768-tall landscape tablets route to the fallback, and
  any short window up to **819 px** tall also falls back — comfortably covering the broken band (a
  768-tall viewport's ~584 px usable area cannot host the ~932 px stacked demand; even a generous
  819-tall viewport, ~635 px usable, still cannot).
- **Upper bound — the desktop capture (1280 × 900) MUST stay on the full scene (AC2).** Threshold must
  be **< 900** with margin. At **820** the margin below 900 is **80 px**: the committed 900-tall
  desktop baseline keeps the full poster unchanged, and a desktop window can shrink to **820 px** tall
  before it falls back — a comfortable buffer so ordinary desktop windows (and the ≥ xl poster tier,
  whose card is *overlaid*, not stacked) never trip the gate.

### Why 820 specifically (not 760 or 800)

The issue's guidance band is ~760–820. **820 sits at the top of that band**, which:

1. **Maximizes the fall-back margin above the must-fail case** (52 px over 768) — short landscape
   tablets and short windows route to the *known-good* layout decisively, not marginally. A threshold
   near the bottom of the band (760) would be *below* 768 and FAIL AC1 outright; 800 clears 768 by only
   32 px, leaving slightly-taller-than-768 short windows (which the geometry shows are still broken —
   their usable height is far under the stacked demand) on the broken full scene.
2. **Still keeps an 80 px buffer below the desktop-900 must-keep** — ample; no risk to AC2.
3. Is a clean, memorable value at a round 20 px step.

The threshold is intentionally **conservative toward the fallback**: the miniature-alone layout is
already designed, tested, and known-good at < lg, so routing an ambiguous short viewport *to* it is
strictly safer than leaving it on a scene that may break. 820 buys that safety while leaving the
desktop baseline untouched.

---

## 3. The gate rule (precise)

```
FULL POSTER SCENE   ⇔  (min-width: 1024px) AND (min-height: 820px)
MINIATURE-ALONE     ⇔  NOT the above  (too narrow OR too short)
```

This is a **single media-query gate** evaluated as one boolean:
`(min-width: 1024px) and (min-height: 820px)`.

**It covers ALL width tiers** — the gate is on the *scene-vs-miniature* choice, which sits beneath the
existing per-tier *layout* of the poster:

- **≥ xl wide AND ≥ 820 tall** → full scene, rendered in the **≥ xl overlaid-poster** layout (card
  overlaid upper-left). Unchanged.
- **lg…xl wide AND ≥ 820 tall** → full scene, rendered in the **lg…xl stacked** layout (card first,
  scene below). Unchanged.
- **≥ lg wide BUT < 820 tall** → **miniature-alone fallback** (the layout previously reserved for
  < lg). This is the new routing: it catches iPad Mini landscape (1024 × 768), 1024 × 700, **and a
  short 1280-wide window** (e.g. 1280 × 700 — wide enough for the xl poster, too short for it, so it
  also falls back). A wide-but-short viewport never shows the full scene at any width tier.
- **< lg wide** (any height) → miniature-alone fallback, exactly as today.

**Key point for Dev:** the existing Tailwind `lg:block` / `lg:hidden` split on the two stage `<div>`s
encodes *width only*. The new gate must AND-in the height condition. Because Tailwind has no built-in
`min-height` screen variant wired here, the gate is implemented in JS (§4), not a CSS class swap — the
component chooses which single stage subtree to render. The `<main>`'s per-tier layout classes
(`xl:block`, `xl:absolute` on the card, etc.) are **unchanged**; they only ever take visible effect
when the full scene is the one rendered, and are inert in the fallback (the card simply stacks above
the lone miniature, the same flow the < lg fallback already uses).

---

## 4. The matchMedia gate behavior (SSR-safe, unit-testable)

Implement the gate as a small **`matchMedia` gate inside `Centerpiece`** (already a client component
that uses `matchMedia` for reduced motion — mirror that pattern exactly).

### 4.1 The query + the state

A single media query string:

```
(min-width: 1024px) and (min-height: 820px)
```

Add a boolean state, e.g. `fullScene` (or `wideAndTall`), defaulting per the SSR rule below. In a
mount effect, evaluate `window.matchMedia("(min-width: 1024px) and (min-height: 820px)").matches`,
set the state, and subscribe to the MediaQueryList `change` event to keep it live (so resizing /
rotating a tablet, or resizing a desktop window across the threshold, re-routes without a reload).
Clean up the listener on unmount. This composes alongside — and independent of — the existing
reduced-motion `matchMedia` effect; they are two separate queries, neither gates the other.

### 4.2 The render branch

`Centerpiece` renders **exactly one** of the two stage subtrees based on the gate (it stops relying on
`lg:block`/`lg:hidden` to do the hiding):

- `fullScene === true` → render the `.about-stage--scene` subtree (projector + beam + miniature, the
  scaled 1280×880 stage, the power-control `<button>`).
- `fullScene === false` → render the `.about-stage--mini` subtree (the centered, scaled 560×660
  miniature-alone stage; **no** projector, beam, status light, or power toggle in the DOM).

> Implementation note for Dev: the cleanest form is to gate the *rendering* of each subtree on the JS
> boolean rather than CSS visibility, so the fallback truly has no projector/beam/toggle nodes in the
> DOM (matching the < lg fallback's a11y contract — §5). If Dev prefers to keep both subtrees mounted
> and toggle visibility, the **fallback subtree's projector/beam/button MUST still be removed from the
> a11y tree and the tab order when hidden** (not merely visually hidden) — but render-gating is
> preferred and simpler.

### 4.3 SSR default + post-mount correction (the hydration contract)

- **SSR / pre-mount / no-JS default: render the FULL SCENE** (`fullScene` initial state `true`). This
  matches the current server output (`lg:block` shows the scene server-side) **and** matches the most
  common real viewport (a normal desktop is wide AND tall), so the dominant case has zero post-mount
  reflow. It also mirrors the existing reduced-motion gate's "default to the static-poster CSS, correct
  on mount" idiom: server renders a sensible default, the client effect refines it.
- **Post-mount correction:** on mount the effect evaluates the real query and, on a wide-but-short
  viewport, flips `fullScene` to `false` — swapping the scene subtree for the miniature-alone subtree.
- **Hydration note:** the **initial client render must match the SSR markup** (full scene) to avoid a
  hydration mismatch — so the gate state is read in an **effect after hydration**, never during the
  first render (identical to how `motion` starts `false` and is set in `useEffect`; never read
  `matchMedia` during render). On a wide-but-short viewport the visitor may see one frame of the full
  scene before the effect swaps to the fallback; this is acceptable and matches the existing
  reduced-motion / motion-engage pattern (the page is usable either way; no layout is gated on it). The
  swap is a subtree replacement, not an animation, and carries no CLS guarantee beyond "it settles
  immediately on mount."
- **No-JS:** the full scene renders and stays (the SSR default). A no-JS wide-but-short viewport keeps
  today's behavior — acceptable; the gate is a JS progressive-enhancement refinement of an already-
  shipping default, and no-JS short-landscape-tablet is a vanishingly small intersection.

### 4.4 Composition with the existing reduced-motion gate

The two gates are orthogonal and both must hold their own contract:

- **Reduced-motion gate** (existing): decides whether the warm-up intro / toggle machinery engages.
  Affects *appearance over time*, not *which stage renders*.
- **Height-aware gate** (new): decides *which stage subtree renders*. Affects layout, not motion.

A wide-but-short viewport under reduced motion gets the **miniature-alone fallback, settled
immediately** (no intro) — the reduced-motion end-state of the fallback, which already exists. A
wide-but-short viewport with motion gets the **fallback's reduced intro** (§5). The fallback's intro
choreography is the < lg reduced intro from the warm-up spec §4.3 (P4 illuminate + P5 plus fade, no
red→green, no flicker, no beam) — inherited for free because the fallback IS the < lg subtree.

### 4.5 What the unit test asserts (offline, jsdom — no chromium)

The gate is **unit-testable in jsdom** by stubbing `matchMedia`:

- **Stub `window.matchMedia`** so the query `(min-width: 1024px) and (min-height: 820px)` reports
  `matches: true` → render `<Centerpiece>` → assert **`.about-stage--scene` is in the DOM** and
  `.about-stage--mini` is **not** (or is the only-rendered branch, per the render-gate form).
- **Stub `matchMedia`** so that query reports `matches: false` → assert **`.about-stage--mini` is in
  the DOM** and the scene subtree (including the projector power `<button>`, e.g. by its accessible
  name) is **absent**.
- Independently stub the reduced-motion query to confirm the two gates don't interfere (a `matches:
  false` height gate still renders the fallback regardless of the reduced-motion value, and vice
  versa).

Because the effect reads `matchMedia` post-mount, the test must allow the mount effect to run (e.g.
`act` / a tick) before asserting the corrected subtree — the very first render is the SSR default
(full scene) by contract (§4.3), so assert **after** the effect settles.

---

## 5. States, a11y, and per-AC confirmation

### 5.1 The fallback state (wide-but-short)

When the gate routes to the miniature-alone fallback, the visitor gets **exactly the < lg
experience**, which is already designed and tested:

- The **centered, scaled Topic-page miniature alone** on the theater field — scales cleanly, never
  clips, no overflow.
- The **"How it works" card stacked above it** (first in flow), full reading measure — the same
  reduced composition the < lg tier uses.
- The **reduced intro** (motion-enabled): the miniature illuminates (its `.about-mini-cool` overlay
  lifts) and the ＋plus layer fades in — **no on-screen projector, beam, status light, or power
  toggle** (none are in the DOM). Settled immediately under reduced motion.
- The **sr-only scene description** and the **card heading + steps** are present (they are not inside
  the gated stage; they live on the section and in `HowItWorks`).
- The **title input** is present, named, focusable, editable, Enter-navigable — the one real control,
  unchanged.

### 5.2 A11y (AC5)

- **No projector power button when in the fallback** — so there is no labeled control to mis-state;
  the toggle exists only where the projector is visibly present (≥ lg AND ≥ 820 tall), exactly as the
  warm-up spec already scopes it ("the projector isn't in the < lg composition" — now also "isn't in
  the short-landscape composition").
- The **beam SVG is not rendered** in the fallback (no orphaned decorative node, aria-hidden or
  otherwise).
- The **sr-only scene description**, the **card heading/steps**, and the **title input + its
  label/help** are outside any gated/aria-hidden subtree in both branches — unchanged from the warm-up
  spec's a11y contract.
- The render-gate (not visibility-toggle) form guarantees the fallback's a11y tree contains no
  hidden-but-present projector/button/beam nodes.

### 5.3 Per-AC confirmation

- **AC1 — no orphaned beam at landscape-tablet sizes.** At 1024 × 768 and 1024 × 700 the gate
  (`min-height: 820`) evaluates false → the miniature-alone fallback renders. No projector, no beam,
  no toggle in the DOM; the centered miniature scales cleanly with no element pushed out or clipped.
  ✔
- **AC2 — no regression on tall desktop.** At 1280 × 900 the gate is true (1280 ≥ 1024, 900 ≥ 820) →
  the full ≥ xl poster renders, byte-identical to the committed baseline (this spec changes no scene
  markup, scaling, or motion). ✔ Margin below the threshold: 80 px.
- **AC3 — no regression < lg.** At 390 and 834 the gate is false on width alone → the miniature-alone
  layout + its reduced intro render exactly as today. The width condition is unchanged for these
  widths; only a height term was AND-ed in (and < lg already fails the width term). ✔
- **AC4 — no horizontal scrollbar; controls keep working.** The fallback is the already-no-horizontal-
  scroll < lg layout; the full scene is unchanged and remains `overflow:hidden`-clipped. The warm-up
  intro / settled poster, the power toggle (present only where the full scene renders), and the title
  input all keep working in whichever branch renders. ✔
- **AC5 — a11y intact.** §5.2: sr-only description, card heading/steps, labeled power button (only
  where present), and title input/label all stay out of any aria-hidden subtree; the fallback has no
  hidden projector/beam/button nodes. ✔
- **AC6 — docs reconciled.** §7 states the rule for Dev to record. ✔ (Dev executes the doc edits.)

---

## 6. Responsive behavior table

| Viewport (W × H) | Width tier | Height ≥ 820? | Gate `(min-w:1024) and (min-h:820)` | Rendered | Projector / beam / toggle | Intro |
|---|---|---|---|---|---|---|
| 390 × 844 | < lg | (n/a) | false (width) | miniature-alone | none | reduced (P4+P5) |
| 834 × 1112 | < lg | yes | false (width) | miniature-alone | none | reduced (P4+P5) |
| 1024 × 700 | lg | no | **false (height)** | **miniature-alone (fallback)** | none | reduced (P4+P5) |
| 1024 × 768 (iPad Mini landscape) | lg | no | **false (height)** | **miniature-alone (fallback)** | none | reduced (P4+P5) |
| 1024 × 900 | lg…xl | yes | true | full scene, **stacked** | present | full sequence |
| 1280 × 700 (short desktop window) | xl | no | **false (height)** | **miniature-alone (fallback)** | none | reduced (P4+P5) |
| 1280 × 900 (desktop capture) | xl | yes | true | full scene, **≥ xl poster** | present | full sequence |
| 1440 × 900 | xl | yes | true | full scene, **≥ xl poster** | present | full sequence |

(Reduced-motion in any row: the same *rendered* branch, but settled immediately with no intro.)

---

## 7. AC6 — doc reconciliation rule for Development to record

AC6 is Dev's to execute; this spec states the rule precisely so Dev can record it without
re-deriving. **Timeless-doc rule applies: describe the rule as it IS now — no change-history
narration** (no "used to be width-only," no "added a height check," no before→after).

Dev must reconcile both warm-up docs so they state the height-aware gate as current design:

- **`docs/design/about-projector-warmup.md`** — in the responsive section (§4 and the §0 stage-geometry
  note): state that the **full poster scene renders only when the viewport is both ≥ lg wide AND
  ≥ 820 px tall**; on a viewport that is ≥ lg wide but **< 820 px tall**, the page renders the
  **miniature-alone layout** (the same reduced composition the < lg tier uses — card stacked above the
  lone miniature, reduced intro P4+P5, no projector/beam/status-light/power-toggle). The projector
  power toggle and the red→green status step therefore apply only on the **wide-AND-tall** full scene,
  not merely "≥ lg."
- **`docs/specs/about-projector-warmup.md`** — in the AC12 responsive criterion: state the same
  full-scene-requires-width-AND-height rule, and **add a wide-but-short case to the AC12 test matrix**
  (currently 390 / 834 / 1280) — e.g. **1024 × 768** (and optionally 1024 × 700) asserting the
  miniature-alone fallback renders with no projector/beam/toggle, no orphaned beam, no element clipped,
  and no horizontal scroll. The existing 1280 case should be understood as 1280 × (≥ 820) for the full
  scene; a 1280 × 700 short-window assertion (fallback) may be added.

State the threshold as **820 px** in both docs so the value has a single, citable home.

---

## 8. Out of scope (unchanged)

This spec does **not** change: the poster composition, the stage geometry (STAGE_W/H = 1280/880,
MINI_W/H = 560/660), the warm-up choreography, the power-toggle interaction model, the dynamic title /
fit-cap, the reduced-motion end-state, the theater field, the Indigo Press palette, or any token. It
adds **one** boolean gate (a `matchMedia` height-AND-width check) that selects which already-designed
stage renders. Hand-off: **Development** implements the gate per §4; **QA & Review** verifies AC1–AC6;
**UX** evaluates the built UI against this contract once chromium is available (the standard screenshot
matrix, adding the 1024 × 768 wide-but-short scene to the catalog).
