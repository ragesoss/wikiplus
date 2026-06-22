# Design spec — About page (centerpiece + "How it works")

**Role:** UX / Design · **Status:** Buildable contract (Phase 2) — the input to Development, written
**before** implementation. · **Phase:** prototype
**Implements:** `docs/specs/about-page.md` (AC1–AC19).
**Visual source of truth:** `docs/design/about-centerpiece-handoff/` — `README.md` (tokens, colors,
the hardbox treatment) + `Centerpiece.dc.html` (the assembled hero; exact px / SVG / polygons).
**Identity:** `docs/TOPIC_PAGE_DESIGN.md` + `docs/VISUAL_IDENTITY.md` (Indigo Press; the universal
projector header §10.1).

> This document is the contract Development builds from. It restates the handoff geometry pixel-close,
> resolves every layout/responsive/a11y/state question the Product spec left to UX, names the tokens
> to add, and isolates the placeholder-copy slots. Where a value is given, it is the value to hit; the
> handoff `Centerpiece.dc.html` markup is the tiebreaker for anything not pinned here. Read alongside
> the handoff, not instead of it.

---

## 0. Who this is for (personas & the story this serves)

The About page serves two of the VISION personas, in this order:

- **Priya, the first-time visitor / self-directed learner** (primary). She arrived from the homepage
  hero's "How it works" CTA, or a shared link. She does not yet know what wiki+ *is*. **Her story:**
  *"As a first-time visitor, I want to understand — at a glance, without reading — that wiki+ adds a
  curated, contextualized video layer on top of a Wikipedia article, so I can decide whether this is
  for me."* The centerpiece is the answer: the projector→page→＋plus reading makes the thesis legible
  in one image; the "How it works" steps confirm it in plain language.
- **The curious reader who wants to act now** (secondary). **Her story:** *"As a visitor who gets it,
  I want the page to take me straight into a real topic, so it isn't a dead end."* The miniature's
  article title is a live entry point — type a Wikipedia title, press Enter, land on that Topic page.

Every decision below traces to one of those two stories. The page is **not** a recruitment pitch
(VISION "what good looks like") — the contribute ask lives elsewhere.

---

## 1. Page composition (top → bottom)

The route stays `/about` and renders inside the universal chrome, unchanged from the current stub's
shell choice:

```
<SiteHeader host="page" auth={<AuthControl variant="home" />} />   ← projector header + beam-landing surface (AC2)
<main>
  ├─ §A  CENTERPIECE HERO         the dark-theater scene: projector + beams + Topic-page miniature
  │                               (+ the in-scene "How it works" zine card, desktop only)
  └─ §B  "HOW IT WORKS" EXPLAINER  a light section on the page canvas: heading + 3 numbered steps
</main>
<SiteFooter containerClassName="mx-auto max-w-[1100px] px-4" />
```

### 1.1 Explainer placement — DECISION: **both**, one copy source

The handoff places a "How it works" zine card *inside* the centerpiece's dark space (upper-left,
beneath the beam). The Product spec leaves placement to UX. **Decision: the explainer lives in both
places, fed from a single copy object** (§6), so there is no duplicated wording to keep in sync:

- **§A in-scene card (desktop only, `≥ lg`)** — renders the handoff's zine card as part of the
  illustration: it sets the scene's editorial tone and shows the beam passing *over* an explanatory
  panel. It is **layered beneath the beam** and is visible only in the full desktop scene.
- **§B below-the-fold section (every width)** — the **load-bearing, accessibility-anchored** copy.
  It is the real, reliable "How it works" a screen-reader/keyboard/mobile user reads, on a light
  canvas where AA contrast is easy to guarantee. It is the home for the heading + numbered steps.

**Rationale.** The in-scene card is beautiful but compromised as primary copy: it sits in a dark,
visually busy region, it disappears below `lg` (where the dark theater is dropped, §5), and text over
a near-busy beam is fragile for contrast. Making §B the source of truth means the explainer is
**always present and always legible** (AC14, AC19), while the in-scene card keeps the handoff's
composition intact on desktop. Both pull from the same `HOW_IT_WORKS` copy object: change the text
once, both update. Because §A's card duplicates copy that also appears in §B's accessible section, the
**in-scene §A card is `aria-hidden` decoration** (its text is exposed to AT via §B) — see §4.2 / §9.

### 1.2 The centerpiece within real page chrome

The handoff `.dc.html` is a framed *illustration* with its own page header and a `1280×720` fixed
stage on a `#e7e5df` canvas. We are building the real `/about` page, so:

- **Page canvas.** The page background is the body grey the app already uses (`--color-body-grey`
  `#f7f7f7`) — **not** the handoff's `#e7e5df` page tone. Rationale: `host="page"` emits the
  `.beam-page-illum` beam-landing surface (content-white → body grey) behind the top of the page; the
  page must be the app's body grey so the beam lands and falls off correctly, exactly like every other
  content page. The handoff's `#e7e5df` was the reference frame's own paper, not the app canvas. (We
  still **add** `#e7e5df` as a token — see §7 — because the **dark scene's own rounded panel may sit
  on a faint warm mat**; but the page itself is body grey.)
- **The dark scene is a contained panel, not full-bleed.** The `radial-gradient` dark-theater scene
  (§2.1) is a rounded `6px` panel centered in the reading column, **not** a full-bleed background. It
  must read as "an illustration on the page," consistent with the app's contained, card-based layout —
  the page does not turn into a dark theater; it *shows* one. (This also keeps the `host="page"`
  beam-landing white→grey surface readable above the dark panel.)
- **Page max-width.** The centerpiece stage maps into a `max-w-[1100px]` centered container
  (`mx-auto px-4`), matching the app's wide content measure (the home "explore" section and Topic
  shell sit in this family). The dark panel fills that container's width at `≥ lg`; the explainer
  section §B sits in a narrower reading measure beneath it (`max-w-[760px]`, see §1.3).
- **Vertical rhythm.** Top padding below the sticky header: the page content starts flush under the
  beam-landing surface (the `host="page"` `.beam-page-illum` is net-zero height, so no manual spacer).
  Add `pt-8 sm:pt-10` above the dark panel; `mt-12 sm:mt-16` between the centerpiece §A and the
  explainer §B; `pb-16` above the footer. These are the app's standard section gaps (cf. home
  `pt-10 / pb-14`).

### 1.3 Section measures

| Region | Container | Notes |
|---|---|---|
| Centerpiece §A (dark panel) | `mx-auto max-w-[1100px] px-4` | the stage scales to fit this width (§2.6) |
| Explainer §B (heading + steps) | `mx-auto max-w-[760px] px-4` | a comfortable reading measure for prose |
| Footer | `mx-auto max-w-[1100px] px-4` | aligns the footer rule to the centerpiece width |

---

## 2. The centerpiece, pixel-close (AC5–AC8)

**Fidelity is high (AC7/AC8): final colors, proportions, layering as shown in `Centerpiece.dc.html`.**
The abstracted contents (placeholder lines, solid play blocks, the indigo cards) **are** the design,
not TODOs. The projector + beams are **inline SVG**; the Topic-page miniature is an **HTML/CSS**
component tree (divs). All values below are read directly from `Centerpiece.dc.html`.

### 2.0 Reference frame & layering

The reference stage is `1280 × 720`. Everything is positioned within it. Z-order, bottom → top:

1. **Dark-theater background** (the scene panel's own radial fill).
2. **Beams** — the three-cone SVG (`z-index:1` in the handoff), with the faint motes.
3. **In-scene "How it works" zine card** (`z-index:0` in the handoff — i.e. **beneath** the beam, so
   the beam passes over it). Desktop only.
4. **Projector** SVG (`z-index:2`, lower-left).
5. **Topic-page miniature** (`z-index:2`, right) with its warm outer glow.

> The handoff puts the card at `z-index:0` and the beam at `z-index:1` so the beam visibly crosses the
> card — preserve that (the card is *behind* the beam).

### 2.1 Scene background

A rounded `6px`, `overflow:hidden` panel filling the stage, filled with the dark-theater radial:

```
background: radial-gradient(120% 96% at 34% 52%, #2c2a54 0%, #17152f 46%, #0a0915 100%);
```

Tokenized as the three theater stops (§7). The "warm centre at 34%/52%" is where the projector sits,
so the room is subtly brighter behind the lamp.

### 2.2 The angled "on" projector (lower-left)

Inline SVG, positioned `left:8px; top:360px; width:540px` in the stage, drawn in a `viewBox="0 0 660
440"` with `overflow:visible`. Build it as the exact paths in `Centerpiece.dc.html` lines 79–127. The
load-bearing parts:

- **`defs`:**
  - `radialGradient #plamp` (lamp glass): `#ffffff` → `#fff7e4` @0.62 → `#f4dba8` @1.
  - `radialGradient #pbloom` (warm bloom): `#fffbf3` op .96 → `#fff4d8` op .74 @0.34 → `#ffe4a4` op .32
    @0.66 → `#ffe4a4` op 0 @1.
  - `clipPath #pclip`: `ellipse cx=438 cy=272 rx=31 ry=46` (clips the lamp + the white plus to the
    aperture).
- **Body (indigo prism, yawed ~25°):** contact shadow ellipse (`#2C2C2C` op .08); back-left leg
  (`#2C2C2C`); **side wall** path (`#565d9e`, 2.5px `#2C2C2C` stroke); two front feet (`#2C2C2C`);
  **faceplate** path (`#676EB4`, 2.5px `#2C2C2C` stroke); green power light (`circle r=5 #2A8270`);
  focus dial (`circle r=14 #565d9e` + `circle r=6 #5248AF`); vent grille (three 3px `#565d9e` lines).
- **Lens (ellipse stack, vertical major axis for the yaw):** `#6970b0` rim → `#565d9e` collar →
  `#2C2C2C` bezel → `#ffdf9f` glass base → `#plamp` clipped glass.
- **Bloom:** two `circle cx=438 cy=272` of `#pbloom` at `r=150` and `r=96` (the warm light bleed over
  the bezel/body).
- **The white plus aperture:** a 12-point plus `path` filled `#ffffff`, clipped to `#pclip`
  (`d="M429,225 h18 v33 h23 v28 h-23 v33 h-18 v-33 h-23 v-28 h23 v-33 z"`). The vertical stroke is
  narrower than the horizontal — the yaw distortion the handoff calls for. **This white "+" is the lamp
  the beams originate from**; do not recolor it (yellow appears only as the bloom spill, never the "+").

### 2.3 The three nested beam cones

A single SVG over the scene, `viewBox="0 0 1280 720"`, `position:absolute; inset:0; z-index:1;
pointer-events:none`. One shared linear gradient + three polygons + faint motes:

```
<linearGradient id="cbeam" x1=0 y1=0 x2=1 y2=0>
  stop 0   #fff3da op 0.95
  stop 0.5 #fff3da op 0.5
  stop 1   #fff3da op 0.16
</linearGradient>
```

Three polygons, all originating at the projector aperture (`x≈368`) and falling rightward toward the
page (faint→bright, outer→center):

| Cone | `points` | `fill` | `opacity` | Lands on |
|---|---|---|---|---|
| **outer** | `368,558 368,606 686,715 686,78` | `url(#cbeam)` | `0.16` | top-left & bottom-left **corners of the page** (frames the whole topic) |
| **middle** | `368,564 368,600 712,618 712,112` | `url(#cbeam)` | `0.24` | **top & bottom of the gutter** |
| **center** | `368,574 368,588 712,426 712,264` | `url(#cbeam)` | `0.36` | the **general strip** (brightest, widest core; bottom lands just below the strip) |

Plus the five faint motes (`fill #fff3da`, the small circles at lines 50 of the handoff). The overlap
of the three cones is what reads as a **soft plus** over the dark room. **The beams are volumetric only
against the dark room — they do not paint a light gradient onto the page** (AC7); the page reads as
evenly/brightly lit via its own warm outer glow (§2.4).

### 2.4 The Topic-page miniature (HTML/CSS)

Positioned `left:686px; top:78px; width:560px` in the stage; `z-index:2`. A white card:

```
background:#ffffff; border:1px solid #e2ddd3; border-radius:4px; overflow:hidden;
box-shadow: 0 0 78px 8px rgba(255,243,210,0.42), 0 24px 64px rgba(0,0,0,0.55);
padding: 30px 28px 34px;
```

The `box-shadow` is the **warm outer glow** (first layer) + the drop shadow into the dark room (second
layer). Reference inner width 560px. Three stacked regions:

**(a) Masthead** — `display:grid; grid-template-columns:1fr 132px; gap:20px; align-items:start`.
- **Left (article):** the serif **title** — Georgia, `28px / 1.12`, `font-weight:400`, color `#000`,
  with `border-bottom:1px solid #a2a9b1` (the Wikipedia hairline rule, `--color-wikirule`) and
  `padding-bottom:9px; margin:0 0 13px`. **This title is the live input (§3).** Below it, **5
  placeholder body lines** in a `flex column gap:10px`: `height:10px; border-radius:5px;
  background:#e6e2d8`, widths `100% / 100% / 100% / 88% / 54%`.
- **Right (gutter top): two indigo plus cards** (each a hardbox: `background:#676EB4;
  border:2px solid #2C2C2C; box-shadow:3px 3px 0 #2C2C2C; padding:11px`):
  - **Overview card** — `flex gap:8px`, three white blocks (`flex:1; height:30px; border-radius:3px;
    background:#fff`).
  - **Contents / TOC card** — `flex-column gap:8px`: a header row (`white ＋ glyph` at `font-size:11px;
    font-weight:800` + a `42×6` white rule), then five short white rule lines at `rgba(255,255,255,.6)`,
    `height:5px`, widths `64% / 46% / 72% / 38% / 56%`, `border-radius:2.5px`.

**(b) General strip (the horizontal stroke)** — `display:flex; gap:18px; align-items:flex-start;
margin:18px 0`. Three indigo clips (each `background:#676EB4; border:2px solid #2C2C2C;
box-shadow:3px 3px 0 #2C2C2C`):
- landscape **190×116**, portrait **88×116**, landscape **190×116**.
- Each clip: a centered **white play triangle** (CSS borders: `border-top/bottom:11px transparent;
  border-left:18px solid #fff; margin-left:3px`, centered via `inset:0` flex), and a **curation bar**
  bottom-left: `position:absolute; left:8px; bottom:8px; width:46px; height:12px; border-radius:2px;
  border:2px solid #2C2C2C`. Bar fills, in strip order: **teal `#2A8270`** (clip 1) · **red `#C44949`**
  (clip 2) · **teal `#2A8270`** (clip 3). (The red here is the brighter handoff illustration red — see
  §7 token note: this is **not** the AA-text token `--color-accred`; the bar is decorative, not text.)

**(c) Body** — `display:grid; grid-template-columns:1fr 132px; gap:20px; align-items:start`.
- **Left:** a **section heading** bar (`height:14px; width:188px; border-radius:7px;
  background:#bdb6aa`) then 4 body lines (`100%/100%/94%/58%`); then a second heading bar
  (`width:150px`) then 5 body lines (`100%/100%/96%/100%/46%`). Body-line greys are `#e6e2d8`; section
  heads are `#bdb6aa`.
- **Right (gutter bottom): one tall portrait clip** — `width:100%; height:212px`, same indigo hardbox,
  white play triangle, curation bar **blue `#1F6F95`** (caveat).

The **vertical gutter** (overview → contents → tall portrait clip) crossing the **horizontal general
strip** is what reads as the **"+"**. The indigo cards alone carry the brand color over the neutral
article — the article ground stays calm grey/white (faithful Wikipedia look).

### 2.5 The in-scene "How it works" zine card (desktop only)

The light hardbox card the handoff places at `left:60px; top:64px; width:392px; z-index:0`:

```
background:#faf8f1; border:2px solid #2C2C2C; box-shadow:7px 7px 0 #2C2C2C; padding:20px 24px 20px;
```

Contents (decorative duplicate of §B — `aria-hidden`, §4.2): eyebrow row (a `24×2` gold rule
`#E5AB28` + "How it works" in Source Sans 3 11px/700/uppercase/`.2em` tracking, color `--color-brand`
`#676EB4`); an `h`-styled heading (Source Sans 3, 24px/800, `#2C2C2C`); a lead paragraph (Open Sans
13.5px/1.62, `#5f5a52`); then the 3 numbered steps (`01/02/03` in Source Sans 3 12px/800 brand indigo
+ Open Sans 12.5px/1.5 `#5f5a52`). **This is the only place gold appears on the page** (the eyebrow
rule), and only as a thin accent — never a fill, never a signal (Indigo Press rule). It pulls its text
from the same `HOW_IT_WORKS` copy object as §B.

> Build this card so it is **suppressed `< lg`** (hidden with the rest of the dark scene per §5) and so
> it is a self-contained block inside the scene's layer 3 (§2.0). Because it sits beneath the beam, the
> center/middle cones visibly cross its lower-right corner — that overlap is intended.

### 2.6 Responsive scaling of the stage (sharp & proportional) — DECISION

The handoff stage is a fixed `1280×720` illustration. To keep it sharp and proportional in a fluid
container, **map the whole scene to a fixed-ratio stage that scales to its container width**, NOT a set
of hard-coded pixel positions:

- The dark panel is a `position:relative` box with **`aspect-ratio: 1280 / 720`** and `width:100%`
  (capped by the `max-w-[1100px]` container). At the `1100px` cap it renders at `~0.86×` the reference;
  it scales down with the container, never up past the cap.
- **Inside the stage, position everything in `%` of the `1280×720` frame**, OR wrap the entire scene's
  contents in an inner `1280×720` box and apply `transform: scale(var(--scale))` with
  `transform-origin: top left`, where `--scale = containerWidth / 1280`. **Recommended: the SVG layers
  (projector, beams) already use `viewBox`, so they scale natively — keep them at `width:100%
  height:100%` of the stage.** For the HTML Topic-page miniature + the in-scene card, the cleanest
  faithful approach is the **scaled inner stage**: an absolutely-positioned `1280×720` inner layer,
  `transform: scale()` to fit, so all the exact px values (card padding, clip sizes, the `1fr 132px`
  grids) are preserved verbatim and merely scaled as a unit. This keeps the masthead grid, the
  `190×116` clips, etc. pixel-faithful at any width and avoids re-deriving every measurement in `%`.
- Dev's choice between the two mechanisms is fine as long as: (i) text in the live title input stays
  crisp (the input is real HTML; a CSS `scale()` transform keeps it sharp — it is vector text, not a
  raster), and (ii) proportions never distort (no independent x/y scaling). Prefer the **scaled inner
  stage** for faithfulness.
- The input remains a **real, focusable, editable control** at any scale — scaling is visual only; the
  hit target and caret scale with it, which is acceptable at desktop sizes (the input is only shown in
  the full scene at `≥ lg`, where the scale is `≥ ~0.86`).

---

## 3. The title-input → navigate interaction (the one real behavior · AC9–AC12, AC16)

The miniature's article title is a **real, editable text input** that **looks exactly like the static
serif article title**, and on **Enter** navigates to the corresponding Topic page. It is the **only
interactive part** of the otherwise-decorative miniature.

### 3.1 What it is (implementation shape)

- A controlled `<input type="text">` (NOT `type="search"` — no browser search affordances/clear-`✕`),
  in a small client component (the page §A scene is a client component; the rest can be server). It
  reuses **only** the navigation primitive `router.push(topicHref(value.trim()))` from
  `@/lib/wiki/topicRoute` — **not** the `TopicSearch` combobox/typeahead/listbox (no suggestions, no
  debounce, no listbox; the header's own `TopicSearch` already provides full search on this page).
- **Prepopulated default:** `"Acer palmatum"` (the handoff value; AC9). Owner may swap the cosmetic
  default later (spec Assumption ★). Define it as a single constant `DEFAULT_TITLE`.
- It is **not a `<form>` with a visible submit** — there is no magnifier, no button. Enter is the only
  trigger. (Optionally wrap in a `<form role="search">` so Enter submits semantically and a `submit`
  handler centralizes the navigate; if so, the form has NO visible submit control and NO visible search
  chrome — it must still read as the serif title.)

### 3.2 Resting state — looks EXACTLY like the serif title (AC10)

The input inherits the title's exact type and renders with **no form-control affordance**:

```
font-family: Georgia, "Times New Roman", serif;   /* = .projector-serif */
font-size: 28px; line-height: 1.12; font-weight: 400; color: #000;
background: transparent; border: 0; padding: 0; margin: 0;
width: 100%;            /* fills the title column; the hairline rule sits beneath the whole block */
appearance: none; outline: none;   /* at rest only — focus restores a visible ring, §3.4 */
```

The `1px #a2a9b1` hairline rule + `padding-bottom:9px` stays on the **wrapper** (the title block), not
the input, so the rule reads as the article's title underline, not an input underline. At rest there is
**no box, no border, no background, no visible caret affordance** distinguishing it from surrounding
serif text — it reads as the article title (AC10).

### 3.3 Hover — DECISION: a faint, low-commitment editability hint

At rest the field gives no field affordance (by design). On **hover** (pointer only), add the smallest
possible "this is editable" invitation **without** turning it into a search box:

- A **1px dotted underline** under the title text in `--color-wikirule` `#a2a9b1` at ~50% opacity,
  appearing on `:hover` (offset just above the existing hairline rule so the two don't collide), and a
  `cursor: text`.
- Nothing else — no background, no border, no icon. This is deliberately subtle: the page is an
  illustration; we don't want a chrome-y field competing with the serif title. (If Dev finds the dotted
  underline reads as a spelling-error squiggle, fall back to **`cursor: text` + no underline** — the
  cursor alone is an acceptable hover hint. Specify the dotted underline as the default.)

### 3.4 Focus — a clearly visible keyboard focus indicator (AC16)

Keyboard focus MUST be obvious (AC16) but must NOT make the title a chrome-y search box. Use the app's
established **`focus-visible` convention, adapted to "looks like text"**:

- On `:focus-visible`, draw a **focus ring around the title block** consistent with the site default
  (`outline: 3px solid var(--color-brand); outline-offset: 2px;` — the global rule in `globals.css`).
  Because the input is transparent and borderless, the ring around the text region is the clear,
  conventional indicator a keyboard user expects, and it matches every other focus ring in the app.
- The native text caret (`|`) is visible while focused (do not hide it) — it confirms edit mode.
- **Mouse focus** (`:focus:not(:focus-visible)`) shows **no ring** (only the caret), so a click-to-edit
  doesn't pop a heavy ring — same pattern as `.auth-account-trigger` and the search field in
  `globals.css`.
- Do **not** reuse the `.search-field` border-recolor treatment (that one recolors a 2px field border —
  there is no border here). The site-default outline ring is the right cue for a borderless control.

### 3.5 Editing / typing / Enter / empty

- **Editing/typing:** the value updates normally (controlled input); the serif look is preserved as the
  user types (it's still the serif title, now with the user's text).
- **Enter:** `router.push(topicHref(value.trim()))` → `/topic/<Title>/`. The title is passed **raw** to
  `topicHref` (no hand-encoding; `titleToSlug` encodes — AC11). This holds for the **unchanged**
  prepopulated value (Enter on "Acer palmatum" → `/topic/Acer_palmatum/`) **and** an **edited** value
  (AC11). Prevent the default Enter behavior so the page does not reload.
- **Empty / whitespace-only:** **no-op** — no navigation, no error (AC12). Guard with `if
  (!value.trim()) return;` — exactly the existing `TopicSearch.navigateTo` `value.trim()` guard. (The
  field should not be left submittable-to-nowhere; an empty Enter simply does nothing.)
- **Escape / blur:** no special behavior required. (Optional nicety: Escape restores `DEFAULT_TITLE` —
  not required; do not block on it.)

### 3.6 Accessible name & how AT perceives it (AC16, AC15)

The visible "title" is *also* the field's value, so it cannot serve as the field's label. The control
needs a **real, programmatic accessible name** that does not rely on the visible placeholder title:

- Attach a **visually-hidden `<label>`** (or `aria-label`) with the accessible name:
  **`"Wikipedia article title — edit and press Enter to open that topic"`**. A screen-reader user hears
  it as an editable text field named that, with the current value ("Acer palmatum") — i.e. a **real
  control**, not decoration (the AC15 exemption: the input is named, not `aria-hidden`).
- Provide a **visually-hidden helper / hint** associated via `aria-describedby`:
  **`"Type any Wikipedia article title and press Enter to open its wiki+ Topic page."`** This gives SR
  users the "what happens on Enter" that sighted users infer from context. (Sighted users get no
  visible helper text — the resting state is just the serif title; keeping the page clean is the point.
  The hint is SR-only.)
- The field must be **reachable and operable by keyboard** (it is a native input → naturally in the tab
  order) and show the visible focus indicator of §3.4 (AC16).

### 3.7 Microcopy (the input)

| Slot | Value | Notes |
|---|---|---|
| Accessible label (sr-only) | `Wikipedia article title — edit and press Enter to open that topic` | the programmatic name (AC16) |
| Helper / description (sr-only, `aria-describedby`) | `Type any Wikipedia article title and press Enter to open its wiki+ Topic page.` | the "what Enter does" hint |
| Default value | `Acer palmatum` | the handoff default (AC9); `DEFAULT_TITLE` constant |

These are **functional microcopy**, not marketing copy — they are part of the contract and ship as
written (unlike the lorem in §6, which is placeholder).

---

## 4. Every state

There is **no real data state** here — the centerpiece content is static (illustration + placeholder
copy). State the absence explicitly:

- **No loading state.** The page renders its static content immediately; there is no async data fetch
  for the centerpiece or the explainer. (The header's own `AuthControl` has its session-loading chip,
  unchanged — not part of this page's content.)
- **No error state.** Nothing here can fail to load (no DB read, no Wikipedia fetch). A typed title that
  doesn't resolve is handled by the **Topic page** the user navigates to (its own not-found state),
  **not** here. The About page itself has no error UI.
- **No empty state.** The content is fixed; there is nothing to be empty.

The states that **do** exist:

### 4.1 Populated (default)

The full page as described: `≥ lg` shows the complete dark-theater scene (projector + beams + miniature
+ in-scene card) plus the §B explainer below; `< lg` shows the responsive treatment of §5 plus §B.

### 4.2 The title-input states

Resting / hover / focus / typing / Enter / empty — fully specified in §3.

### 4.3 The decorative illustration's a11y state (AC15)

The projector, the beams, the abstracted page graphics (placeholder lines, plus cards, clips, play
triangles, curation bars), and the **in-scene §A card** are **decorative** — they convey no information
that exists only as the picture. They are hidden from assistive tech:

- The **projector + beams SVG** layers: `aria-hidden="true"` (and `role="presentation"` /
  `focusable="false"` on the SVGs). They are pure illustration.
- The **Topic-page miniature container** is `aria-hidden="true"` **with one exception**: the **title
  input** is a real, named control and must remain in the accessibility tree. Implementation note for
  Dev: an `aria-hidden` ancestor would also hide a descendant input. So **do not** put `aria-hidden` on
  an ancestor of the input. Instead, mark the decorative *siblings* (the body-line blocks, the plus
  cards, the clips, the play triangles, the curation bars) `aria-hidden="true"` individually (or wrap
  them in an `aria-hidden` group that does **not** contain the input), and leave the input + its
  label/description outside any `aria-hidden` subtree. The result: a screen-reader user encounters
  exactly one meaningful control on the centerpiece (the named title input) and none of the placeholder
  graphics.
- The **in-scene §A "How it works" card** is `aria-hidden="true"` — its copy is exposed to AT via the
  §B section, so reading it twice would be redundant; AT reads §B.
- Provide a concise **text alternative for the whole scene** so a SR user gets the thesis the picture
  carries (the metaphor is meaningful even if the graphics are decorative). Put a **visually-hidden
  paragraph** at the top of §A: *"A projector casts a beam of light onto a Wikipedia article. The light
  forms a plus shape made of curated video clips — the wiki+ layer added on top of the encyclopedia."*
  (This is the picture's meaning in words; it is the AC15 "appropriate text alternative." It is
  functional copy, ships as written.)

---

## 5. Responsive behavior (AC13, AC14)

Breakpoint: the app's existing **`lg` = 1024px** (the Topic side-by-side↔stacked breakpoint; the
catalog desktop width is 1280, tablet 834, mobile 390).

### 5.1 `≥ lg` (desktop) — the full dark-theater scene

The complete centerpiece (§2): dark panel, projector lower-left, three beams, Topic-page miniature
right, in-scene card upper-left. The projector→page **left-to-right relationship is preserved** (AC5,
AC13). The stage scales to the `max-w-[1100px]` container (§2.6). §B explainer below.

### 5.2 `< lg` (tablet & mobile) — DECISION: **the Topic-page miniature alone**, in a simplified
on-brand frame (no dark theater)

The full dark-theater projector scene is **wrong on a phone** — the projector + three beams + the
560px miniature cannot survive a 390px column without becoming a thin, illegible sliver, and a shrunk
dark theater reads as a glitch, not a metaphor. So below `lg`:

- **Drop the dark theater, the projector, the beams, and the in-scene §A card.** Do **not** render a
  shrunken full scene.
- **Show the Topic-page miniature alone**, centered, on a **light on-brand frame** (the page body
  grey), at a size that fills the column comfortably (`max-w-[560px] mx-auto`, scaling down with the
  viewport via the same fixed-ratio mechanism §2.6 applied to just the miniature). Keep its warm outer
  glow softened (the dark-room drop shadow is wrong on a light field — reduce the second shadow layer
  to a faint neutral `0 12px 32px rgba(0,0,0,.12)` and keep a gentle warm `0 0 40px 4px
  rgba(255,243,210,.5)` so it still reads as "lit"). The miniature still reads as the product surface
  with the ＋plus layer composed as a "+".
- **The metaphor is carried by §B at narrow widths.** Since the projector/beam is gone, the §B
  explainer (always present) does the explaining; the miniature shows *what* the product looks like.
  This is the honest tradeoff the handoff's *Responsive notes* sanction ("swap the centerpiece for the
  Topic-page element alone").
- The Topic-page miniature **collapses to a single column internally at the smallest widths** if needed
  (the handoff notes the real Topic page does this), but for the *illustration* the simplest faithful
  approach is to keep the miniature's two-column composition and just scale the whole miniature down —
  it is a picture, not the live Topic layout. Prefer scaling the whole miniature as a unit.

### 5.3 Invariants at every width (AC13, AC14)

- **The page body never scrolls horizontally** at any supported width. The dark panel is
  `max-width:100%`; the scaled stage never exceeds its container; the miniature is capped and scales
  down. No fixed `1280px` element may bleed past the viewport.
- **The title-input interaction (§3) is present and functional at every width** — it lives in the
  miniature, which is shown at every width (full scene `≥ lg`, miniature-alone `< lg`). On touch, the
  field is tappable to focus and edit; the on-screen keyboard's "Go"/"Enter" submits.
- **The §B explainer is present and functional at every width** (it is a normal responsive section).
- Representative capture widths: **mobile 390 / tablet 834 / desktop 1280** (the catalog viewports).

### 5.4 Width-tier summary

| Tier | Width | Centerpiece §A | Explainer §B |
|---|---|---|---|
| Desktop | `≥ lg` (≥1024) | full dark scene: projector + 3 beams + miniature + in-scene card | full section below |
| Tablet | `md`–`< lg` (768–1023) | **miniature alone** on light frame, centered, scaled | full section below |
| Mobile | `< md` (<768) | **miniature alone** on light frame, centered, scaled to column | full section below (single column) |

---

## 6. Microcopy & copy slots (AC19)

The page ships with **lorem-ipsum placeholder copy** (owner supplies real copy later — spec ★). The
contract is the **copy structure**, isolated so real copy drops into text values only — **no structural
change**. Define a single exported copy object the page reads from:

```ts
// Placeholder copy — owner replaces the text values later (spec ★). Structure is fixed.
const HOW_IT_WORKS = {
  eyebrow: "How it works",
  heading: "Lorem ipsum dolor sit amet consectetur",
  lead:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor " +
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.",
  steps: [
    { n: "01", label: "Lorem ipsum dolor",  body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod." },
    { n: "02", label: "Tempor incididunt",  body: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi." },
    { n: "03", label: "Duis aute irure",    body: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum." },
  ],
} as const;
```

Both §A (in-scene card) and §B (the section) read from this object. **3 steps** by default (the handoff
shows 3); the structure supports 3–4 (AC19 allows "a small number, 3–4") — adding a 4th step is a
one-line array push, no structural change.

### 6.1 §B section structure (the load-bearing explainer)

```
<section §B>
  <p eyebrow>      gold rule + HOW_IT_WORKS.eyebrow   (eyebrow: Source Sans / .plus-disp, 12px/700,
                                                       uppercase, .18em tracking, color --color-brand)
  <h2 heading>     HOW_IT_WORKS.heading               (.plus-disp, ~1.75rem/800, --color-ink)
  <p lead>         HOW_IT_WORKS.lead                  (Open Sans body, --color-ink2)
  <ol steps>       each step:
     <li>  <span n>HOW_IT_WORKS.steps[i].n</span>      (.bignum/.plus-disp, 800, --color-brand)
           <div>  <h3 label>steps[i].label</h3>        (.plus-disp, ~1rem/700, --color-ink)
                  <p body>steps[i].body</p>            (Open Sans body, --color-ink2)
```

The numbered list is a real `<ol>` (semantic ordered list — the steps are a sequence). The number
glyph is decorative styling on top of the list semantics (`aria-hidden` on the duplicate visible `n` is
fine since `<ol>` numbers the items). Eyebrow uses the **gold accent rule** (consistent with the
home hero's pattern, but home uses an indigo rule — match the handoff's gold eyebrow rule **here in the
About context** since gold is sanctioned as a sparing accent; keep it a thin `2px` rule only, never a
fill).

The §B heading is the page's primary visible heading. The page also needs a programmatic top-level
heading — see §8 metadata.

---

## 7. Tokens (AC18)

Every color/value introduced for the centerpiece that is **not already a token** is added to `@theme`
in `app/globals.css` and referenced via the token (Tailwind utility or CSS var) — never hard-coded
inline. Existing Indigo Press tokens are reused where they apply.

### 7.1 Reused existing tokens (no change)

| Token | Value | Use here |
|---|---|---|
| `--color-brand` | `#676eb4` | indigo plus cards, clip bodies, projector faceplate, eyebrow text, step numbers |
| `--color-violet` | `#5248af` | projector focus-dial hub |
| `--color-sprout` | `#2a8270` | teal "accurate" curation bar, projector power light |
| `--color-action` | `#1f6f95` | blue "caveat" curation bar |
| `--color-ink` | `#2c2c2c` | all hardbox borders + offset shadows, projector strokes/feet, headings |
| `--color-ink2` | `#595959` | body prose color in §B (close to the handoff's `#5f5a52`; see note) |
| `--color-wikirule` | `#a2a9b1` | the title hairline rule |
| `--color-content-white` | `#ffffff` | miniature card fill, lamp/play-triangle white |
| `--color-body-grey` | `#f7f7f7` | the page canvas |

> Note on the explainer body color: the handoff uses `#5f5a52` (a warm grey) for body text on the
> `#faf8f1` card. For the §B section on the page (light grey/white ground) use the existing
> **`--color-ink2` `#595959`** — it is AA-safe and already in the system, and the difference is
> imperceptible. **Add `--color-prose-warm #5f5a52` only if** Dev wants the in-scene §A card to match
> the handoff exactly on its `#faf8f1` panel (AA verified, §9). Recommended: reuse `--color-ink2` for
> §B and add `--color-prose-warm` for the §A card's body so §A matches the handoff pixel-for-pixel.

### 7.2 New tokens to add to `@theme`

| Proposed token | Hex | Role |
|---|---|---|
| `--color-projector-violet` | `#5248af` | **already `--color-violet`** — reuse, do not duplicate (listed for clarity: the handoff "deep violet" = the existing violet) |
| `--color-indigo-light` | `#7d83c4` | projector lens collar / barrel highlight (lit faces) |
| `--color-indigo-barrel` | `#6970b0` | projector lens rim (barrel mid) |
| `--color-indigo-dark` | `#565d9e` | projector side wall, dial ring, vent strokes, lens collar |
| `--color-clip-opinion` | `#c44949` | the **illustration** "opinion" curation bar (brighter than `--color-accred`; decorative bar only — see note) |
| `--color-canvas-warm` | `#e7e5df` | warm paper mat (the handoff page tone; optional faint mat behind/under the dark panel) |
| `--color-theater-1` | `#2c2a54` | dark-theater radial stop 0% |
| `--color-theater-2` | `#17152f` | dark-theater radial stop 46% |
| `--color-theater-3` | `#0a0915` | dark-theater radial stop 100% |
| `--color-lamp-core` | `#fff7e4` | lamp glass radial mid stop (core is `#fff`, base `#ffdf9f`) |
| `--color-lamp-edge` | `#f4dba8` | lamp glass radial outer stop |
| `--color-lamp-base` | `#ffdf9f` | lamp glass base fill |
| `--color-bloom-1` | `#fffbf3` | bloom radial inner stop |
| `--color-bloom-2` | `#fff4d8` | bloom radial mid stop |
| `--color-bloom-3` | `#ffe4a4` | bloom radial outer stop (→ transparent) |
| `--color-beam-warm` | `#fff3da` | beam-cone fill + motes (the `#cbeam` gradient color) |
| `--color-line-body` | `#e6e2d8` | placeholder body-line grey (miniature) |
| `--color-line-section` | `#bdb6aa` | placeholder section-heading grey (miniature) |
| `--color-card-hairline` | `#e2ddd3` | the miniature card's `1px` border (warm hairline) |
| `--color-card-warm` | `#faf8f1` | the in-scene §A "How it works" card fill |
| `--color-prose-warm` | `#5f5a52` | (optional, §7.1 note) warm body prose on the §A card |

Notes:
- **`--color-clip-opinion #c44949` vs `--color-accred #b0353b`.** The existing `--color-accred` is the
  AA-text-safe red used for *text/state signals*. The curation bars in the miniature are **decorative
  solid blocks**, not text, and the handoff specifies the brighter `#c44949` for the illustration's
  visual balance. Use the new `--color-clip-opinion #c44949` for the **illustration bars only**. It is
  **not** a functional/text color and must never be used for AA-text. (The bars carry no meaning the
  user must read — they are part of the picture; their fact/opinion meaning is decorative here, and is
  text-labeled for real on the actual Topic page. So no color-only-signal violation — §9.)
- **Gold stays an accent.** The eyebrow rule (§A and §B) uses the brand gold `#E5AB28` as a thin `2px`
  rule **only** — never a fill, never a signal. This is the sanctioned sparing accent
  (VISUAL_IDENTITY §9.1). It is **not** the wordmark daylight golds (`--color-gold-rim` etc.) — those
  are the header's; do not reuse them here. Reference `#E5AB28` directly or add `--color-gold-accent
  #e5ab28` if Dev prefers a token (recommended: add `--color-gold-accent` so it's not a literal).
- Where the projector violet equals an existing token, **reuse the existing token** — do not create a
  duplicate (the table marks `--color-projector-violet` as "reuse `--color-violet`").

---

## 8. Fonts — DECISION: reuse the existing system/fallback setup (no new font loaders)

The handoff loads Source Sans 3 + Open Sans as Google web fonts and uses Georgia for the article serif.
**The app already wires these** via the system/fallback setup in `globals.css`:

- Body = **Open Sans** with a system fallback stack (`body` rule).
- Plus-side display = **Source Sans Pro / Source Sans 3** via **`.plus-disp`** / `.bignum`.
- Article serif = **Georgia** via **`.projector-serif`** (and `.wiki-title`).

**Recommendation (the lighter path): reuse these; do NOT add Google Font loaders.** Rationale:

- The whole app already renders its headings/body/serif through this setup with accepted fidelity; the
  About page's type is the same families. Adding `next/font` loaders for this one page would introduce
  a font-loading path the rest of the app doesn't have, for a marginal fidelity gain.
- The handoff fidelity that matters (the chunky Source Sans 800/900 zine headings, the Open Sans body,
  the Georgia serif title) is delivered by `.plus-disp` / body / `.projector-serif` exactly as the home
  hero and Topic page deliver it today. Consistency with the rest of the app is worth more than matching
  the reference's exact Google-font render.
- Web-font failure stays graceful (Georgia is near-universal; Source Sans falls back to the system
  sans), same as the rest of the app (VISUAL_IDENTITY §7.5).

So: title input + miniature title = `.projector-serif` (Georgia). Eyebrow, headings, step numbers =
`.plus-disp` (Source Sans). Body/lead = the body Open Sans stack. **No new font wiring.**

---

## 9. Accessibility (AC15–AC17)

Accessibility is baseline. The page's a11y contract:

### 9.1 Contrast (AA, AC17)

- **§B explainer (light ground).** Eyebrow `--color-brand #676eb4` on body grey `#f7f7f7` — verify;
  for the small uppercase eyebrow, if it does not clear 4.5:1, set the eyebrow text to `--color-ink`
  `#2c2c2c` and keep only the *rule* gold/indigo (the eyebrow's meaning is the word, carried by the
  ink text; color is decorative). Heading `--color-ink #2c2c2c` and body `--color-ink2 #595959` on
  `#f7f7f7` both pass AA comfortably. **Action for Dev: compute the eyebrow ratio; if `< 4.5:1`, darken
  the eyebrow text to `--color-violet #5248af` or `--color-ink`.**
- **§A in-scene card.** Body `#5f5a52` (`--color-prose-warm`) on the card `#faf8f1` ≈ **6.3:1** —
  passes AA. Heading `#2c2c2c` on `#faf8f1` passes easily. Eyebrow `--color-brand #676eb4` on
  `#faf8f1`: indigo on near-white ≈ **4.6:1** — passes AA for normal text (and the eyebrow is bold) —
  acceptable. (The §A card is `aria-hidden` decoration anyway, so this is a visual-comfort check, not a
  strict SC; still keep it AA.)
- **No light-on-dark body text.** We deliberately do **not** place readable prose directly on the dark
  theater background — the only thing on the dark field is the illustration + the light §A card (which
  has its own light panel). This sidesteps the dark-background contrast risk entirely.
- **The title input** at rest (`#000` Georgia on `#fff` miniature card) ≈ 21:1 — passes.
- **Decorative graphics** (projector, beams, bloom, gold beam warmth, curation bars) are exempt from
  text-contrast SC — they are decoration (WCAG 1.4.1/1.4.11 apply to meaningful UI, not decoration).

### 9.2 Keyboard & focus (AC16)

- The **title input** is keyboard-reachable (native input, in tab order), operable (type + Enter), and
  shows the **visible `focus-visible` ring** (§3.4). The resting "looks like text" treatment does NOT
  remove the focus state.
- The §B step list and the page are static content (no other interactive controls beyond the header's
  own search/auth and the footer's links, all unchanged). No keyboard traps.

### 9.3 Decorative-graphic hiding (AC15)

Per §4.3: projector + beams + miniature graphics + in-scene card are `aria-hidden` (with the title
input carefully kept out of any `aria-hidden` subtree), and a visually-hidden scene description gives
SR users the picture's meaning. The input is the one exposed control.

### 9.4 No color-only signals (AC17)

- The **curation bars** (teal/red/blue) in the miniature are **decorative** — they are part of the
  illustration and convey no information the user must act on *here*. They are not a functional
  fact/opinion signal on this page (that signal lives, text-labeled, on the real Topic page). So the
  page introduces **no color-only signal**.
- The §B steps are **numbered (`01/02/03`) and labeled** (each has a text label) — order and identity
  are carried by text + the `<ol>` semantics, never by color.
- The eyebrow's meaning is its word ("How it works"), not its rule color.

---

## 10. Build hand-off (what Development implements)

Implement `/about` from this spec (the route + `host="page"` chrome already exist in the stub —
replace the body):

1. **`app/about/page.tsx`** — replace the "Coming soon" body. Keep `SiteHeader host="page"` +
   `SiteFooter`. Set metadata `<title>` (§8 / AC4) — a non-empty title, e.g. `"How it works"` (matches
   today's stub title; placeholder, may change with real copy). Add a visually-hidden `<h1>` for the
   document landmark if the §B `<h2>` is not promoted to the page `<h1>` (prefer: §B heading is an
   `<h2>` and an sr-only `<h1>How it works — wiki+</h1>` provides the landmark, mirroring the home
   page's sr-only `<h1>`).
2. **A `<Centerpiece>` component** — the §A scene. Inline-SVG projector + beams (§2.2–§2.3) + the
   HTML/CSS Topic-page miniature (§2.4) + the in-scene card (§2.5), composed in the fixed-ratio scaled
   stage (§2.6). **Compose so the ＋plus layer (the indigo cards + clips) is a separable group** that
   can be hidden/revealed/animated later without a rewrite (spec in-scope item 10) — e.g. the plus
   cards + clips render from one `<PlusLayer>` subtree distinct from the article-ground subtree. **Build
   no animation now.**
3. **A `<MiniatureTitleInput>` client component** — the editable serif title wired to
   `router.push(topicHref(value.trim()))` (§3), with the sr-only label + description and the
   `focus-visible` ring. Reuses `topicHref` only (no `TopicSearch`).
4. **The §B `<HowItWorks>` section** — heading + `<ol>` steps, reading from the `HOW_IT_WORKS` copy
   object (§6), copy isolated for one-edit replacement.
5. **Tokens** — add the §7.2 tokens to `@theme`; reference via tokens, not inline literals (AC18).
6. **Responsive** — `≥ lg` full scene; `< lg` miniature-alone (§5); no horizontal scroll at any width.
7. **A11y** — the §4.3 / §9 model.
8. **Screenshot baseline** — add an About scene to `e2e/screenshots/catalog.ts` and capture it (§11).

### 11. Screenshot baseline (catalog scene)

Add **one new About scene** to `e2e/screenshots/catalog.ts` so the new surface is captured across
mobile/tablet/desktop × logged-out/logged-in and indexed automatically (CLAUDE.md gallery). Suggested
scene (Dev to place in the "Other pages" group, near `about-data`):

```ts
{
  id: "about",
  group: "Other pages",
  label: "About — centerpiece + how it works",
  note: "The projector→page→＋plus thesis hero (full scene ≥ lg; miniature-alone < lg) + the How-it-works steps.",
  route: "/about",
  stub: "plain",
  ready: homeReady,          // /about is a home-host-family page (no Wikipedia fetch) — use the homeReady waiter
  clip: "fullPage",
},
```

Then refresh the committed baseline gallery: `scripts/dev/shots.sh --scene about --commit ui` (partial
— the About surface is new/changed) or, since it is a new surface, the full `--all --commit ui` is also
acceptable; commit the PNGs + `index.html` alongside the change. For the PR, attach the focused subset
with `--scene about --pr <N>`.

---

## 12. Traceability — design ↔ acceptance criteria

| AC | Where in this spec |
|---|---|
| AC1 route renders new page | §1, §10.1 |
| AC2 `SiteHeader host="page"` + `SiteFooter` | §1 |
| AC3 `/about/data` unaffected | not touched (we replace only `/about` body) |
| AC4 metadata title | §8, §10.1 |
| AC5 desktop projector→page L-to-R | §2, §5.1, §5.4 |
| AC6 SVG projector+beams / HTML miniature | §2.2–§2.4 |
| AC7 three nested beams, page evenly lit | §2.3, §2.4 |
| AC8 miniature elements (title/lines/cards/clips/"+") | §2.4 |
| AC9 editable input prepopulated "Acer palmatum" | §3.1 |
| AC10 looks like serif title, not a form control | §3.2 |
| AC11 Enter → `router.push(topicHref(raw value))` | §3.5 |
| AC12 empty/whitespace = no-op | §3.5 |
| AC13 desktop L-to-R; no horizontal scroll | §5.1, §5.3 |
| AC14 `< lg` degrades gracefully; input + explainer present at every width | §5.2, §5.3 |
| AC15 decorative illustration hidden from AT; input exempt | §4.3, §9.3 |
| AC16 input named, keyboard-operable, visible focus | §3.4, §3.6, §9.2 |
| AC17 AA contrast; no color-only signal | §9 |
| AC18 new values are tokens | §7 |
| AC19 copy-injection-ready explainer (heading + 3–4 numbered steps) | §6 |

---

## 13. Open question for Development

- **Stage scaling mechanism (§2.6).** Two faithful options (a `transform: scale()` scaled inner
  `1280×720` stage, or `%`-positioned children). The spec **recommends the scaled inner stage** for
  pixel-faithfulness with the least re-derivation, and confirms the live title input stays crisp under
  a CSS transform (vector text). If Dev finds the transform interferes with the input's caret/focus
  ergonomics at some width, fall back to `%` positioning for the miniature layer — either is acceptable
  as long as proportions never distort and the body never scrolls horizontally (§5.3). No other open
  questions; everything else is pinned.
```
