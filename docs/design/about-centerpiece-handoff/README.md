# Handoff: wiki+ "About" page centerpiece

## Overview
A hero/centerpiece visual for the wiki+ **About** page that explains the product
thesis in one image: a **projector** throws a beam onto a Wikipedia **Topic page**,
and the light *is* the **＋plus layer** — a plus‑shaped overlay of curated video
that wiki+ adds on top of the encyclopedia article.

The package contains the finished **composition** plus each **isolated element**
(so they can be implemented/animated independently), and documents a planned
**animated** follow‑up.

## About the design files
The files in this bundle are **design references created in HTML/SVG** — prototypes
showing the intended look, not production code to copy verbatim. They are authored
as "Design Components" (`.dc.html`, which load `support.js`); treat the markup/SVG
inside as the visual spec.

**The task is to recreate these designs in the About page's real environment**
(the wiki+ app is Next.js / React + Tailwind per the repo) using its established
components, tokens, and patterns. If a value below isn't already a token in the
codebase, add it to the existing system rather than hard‑coding inline.

The whole centerpiece is illustration: the projector and beams are **inline SVG**;
the Topic page is **HTML/CSS** (divs). Recreate accordingly (an SVG component for
the projector + beams, a normal component tree for the page).

## Fidelity
**High‑fidelity.** Final colors, typography, proportions and layering are intended
as shown. Recreate pixel‑closely with the codebase's libraries. The article/clip
*contents* are intentionally abstract (placeholder lines, solid play‑button blocks)
— that abstraction is the design, not a TODO.

---

## Design tokens

### Color (WikiEdu Dashboard / "Indigo Press" palette)
| Role | Hex |
|---|---|
| Indigo (primary, plus blocks, clip bodies) | `#676EB4` |
| Deep violet (accents, hubs) | `#5248AF` |
| Indigo light (top/lit faces, barrel highlight) | `#7d83c4` |
| Indigo barrel mid | `#6970b0` |
| Indigo dark (side wall, dials, vents) | `#565d9e` |
| Teal — "accurate" chip | `#2A8270` |
| Teal dark | `#1F6757` |
| Action blue — "caveat" chip | `#1F6F95` |
| Red — "opinion" chip | `#C44949` |
| Gold — accent, **wordmark/aperture only**, never a block fill or signal | `#E5AB28` |
| Ink (borders, text) | `#2C2C2C` |
| Ink 2 / muted | `#595959` / `#717171` |
| Wiki link blue | `#3366cc` |
| Wikipedia hairline rule | `#a2a9b1` |
| Page canvas (light scenes) | `#e7e5df` |
| Card white | `#ffffff` |
| Placeholder body line (warm grey) | `#e6e2d8` |
| Section‑heading line (mid grey) | `#bdb6aa` |

### Lamp / beam (warm light)
- Glass radial (on): center `#ffffff` → `#fff7e4` → `#f4dba8`; base fill `#ffdf9f`.
- Bloom radial: `#fffbf3` (op .96) → `#fff4d8` (.74) → `#ffe4a4` (.32) → transparent.
- Beam fill: `#fff1d2` / `#fff3da` (low‑opacity, layered).
- Dark‑room background (theater): `radial-gradient(120% 96% at 34% 52%, #2c2a54 0%, #17152f 46%, #0a0915 100%)`.

### Type
- Headings / UI: **Source Sans 3** (a.k.a. Source Sans Pro), weights 400–900.
- Body: **Open Sans**, 400–700.
- Wikipedia (article) side: **Georgia** serif (title + section headings).

### "Hardbox" treatment (the zine card signature)
`border: 2px solid #2C2C2C` + **solid offset shadow** `box-shadow: Npx Npx 0 #2C2C2C`
(N = 3 for small cards/clips, 6–7 for feature cards). No blur on these shadows.
Used on: every plus card, every video clip, the explainer card, the wordmark "+" block.

---

## Elements

### 1. Topic page — `Topic Page.dc.html`
**Purpose:** the product surface the projector lights up. A Wikipedia article (the
calm "ground") with the indigo **＋plus** layer composed on top as a literal "+".

- **Card:** white, `border:1px solid #e2ddd3`, `border-radius:4px`, padding `30px 28px 34px`. Reference inner width 560px.
- **Masthead:** `display:grid; grid-template-columns:1fr 132px; gap:20px; align-items:start`.
  - Left (article): serif **title** (Georgia, 28px/1.12, color `#000`) with a `1px #a2a9b1` bottom rule; then 4–5 placeholder **body lines** (`height:10px; border-radius:5px; background:#e6e2d8`, varied widths). Only the title is real text — everything else is abstracted.
  - Right (gutter top): two indigo **plus cards** (hardbox, `#676EB4`, 3px offset): an **overview** card (three white blocks) and a **contents/TOC** card (white "+" glyph + short white rule lines = a table of contents).
- **General strip (the horizontal stroke):** `display:flex; gap:18px; margin:18px 0`. Three indigo clips — landscape `190×116`, portrait `88×116`, landscape `190×116`. Each clip: indigo `#676EB4` hardbox (3px offset), centered **white play triangle** (CSS borders), and a **curation bar** bottom‑left (`46×12`, ink border): teal `#2A8270` = accurate, red `#C44949` = opinion, blue `#1F6F95` = caveat.
- **Body:** `grid 1fr/132px`. Left = two **section headings** (rounded mid‑grey bar `#bdb6aa`, `height:14px`, same rounded shape as body lines, just thicker) each followed by body lines. Right (gutter bottom) = one tall **portrait clip** `100%×212` (caveat/blue bar).
- The vertical gutter (overview → contents → portrait clip) crossing the horizontal general strip is what reads as the **"+"**; the indigo cards alone carry the brand color over the neutral article.

### 2. Projector — `Projector.dc.html` (off) & `Projector On.dc.html` (on)
**Purpose:** the device that "projects" the plus layer. A friendly **mini‑LED
projector** in indigo. Front‑on view.

- Rounded‑rect body (`#676EB4`, 2px ink border) with a shallow depth extrusion, top **vent grille** by the lens (`#565d9e` strokes), a **focus dial** (`#565d9e` ring + `#5248AF` hub), small **green power light** (`#2A8270`), two ink feet.
- **Big round lens** is the hero (concentric rings: collar `#7d83c4`/`#565d9e`, ink bezel, glass).
- **Aperture = a plus shape**, magnified to nearly fill the visible glass:
  - **Off (`Projector.dc.html`):** dark interior (`#201c3a`); the "+" reads by *geometry only* — a barely‑lighter fill `#2e2a52` with a faint `#433d72` edge. No glow, no gold ring.
  - **On (`Projector On.dc.html`):** pointed at the viewer and **blown out** — warm radial glass + a large **white** "+" (`#ffffff`), with warm **light bleed** (`bloom` radials, r≈90 & 150) spilling over the bezel onto the body; yellow appears only as the spill, the "+" itself goes pure white.

### 3. Angled projector — `Projector On Angled.dc.html`
**Purpose:** the version used in the composition. Same projector **yawed ~25° to the
right, on a flat surface at eye level** (pure yaw — **no top face visible**).

- Body modeled as a **rounded‑rect prism**: the rounded faceplate is the *cross‑section*; a **rear plate** of the same shape sits receded up‑left; a **curved side wall** (SVG path, rounded corners that follow the silhouette) spans between them. Faceplate **tapers shorter on the right** (lens side reads farther). Front feet tuck *behind* the faceplate; one **back leg** peeks at lower‑left.
- **Lens rim is an ellipse** (vertical major axis) to match the yaw; barrel crescent shows just left of the aperture. The "on" plus is distorted to match — **vertical stroke narrower than the horizontal stroke** — both reaching the aperture edge.
- Casts a warm beam toward the viewer + slightly right.

### 4. Composition — `Centerpiece.dc.html`  ← the deliverable
**Purpose:** the assembled About‑page hero (static "final state").

- **Scene:** dark theater room (radial gradient above), reference frame `1280×720`.
- **Projector:** the angled "on" projector, **lower‑left**, lamp blazing.
- **Beams:** three **nested warm cones, all originating at the aperture**, layered (outer faint → center brightest) — the overlap reads as a soft plus:
  - **outer** beam → meets the **top‑left & bottom‑left corners of the page** (frames the whole topic).
  - **middle** beam → the **top & bottom of the gutter**.
  - **center** beam (brightest, widest core) → the **general strip** (its bottom lands just below the strip).
- **Topic page:** right side, rendered as a **brightly, evenly‑lit screen** (no light gradient on the page itself) with a warm outer glow `box-shadow: 0 0 78px 8px rgba(255,243,210,.42), 0 24px 64px rgba(0,0,0,.55)`. The beams are volumetric **only against the dark room**; they do not paint a transition onto the page.
- **Explainer:** a light **zine hardbox card** ("How it works" — eyebrow `#676EB4`, ink heading, `#5f5a52` body, numbered lorem steps) in the upper‑left dark space, layered **beneath the beam** (beam passes over it). Copy is placeholder **lorem ipsum** — replace with real "how it works" content.

---

## Interactions & behavior
The handed‑off composition is **static** (the chosen "final state"). A planned
**animated** version (not yet built) should, in sequence:
1. Projector **flickers on** (lamp warms, aperture lights, bloom blooms).
2. A **dim Topic page with no ＋plus overlay** is visible (article only).
3. The **bright beam hits** the page and the **＋plus layer appears** — the general
   **strip** and the **gutter** cards fade/scale in along the beam.
Gate any motion behind `prefers-reduced-motion`. Build the page so the plus layer
can be toggled/animated separately from the article (that's why the elements are
shipped in isolation).

Static states already provided to drive that animation: projector **off** vs **on**,
and the Topic page (whose plus cards can start hidden and be revealed).

## Responsive notes
Reference layouts are fixed‑width illustrations. For the real About page: keep the
projector→page left‑to‑right relationship at desktop; below `lg` consider stacking
(projector above, page below) or swapping the centerpiece for the Topic‑page element
alone. The Topic page's own product layout collapses to a single column at small
widths (article, then plus rail) per the app's existing topic‑page behavior.

## Assets
No external image assets — everything is vector/CSS. Fonts: Source Sans 3 + Open Sans
(Google Fonts), Georgia (system serif). Use the app's existing font setup if present.
The video "thumbnails" are intentionally solid indigo blocks with a play glyph, not
real imagery.

## Files
- `Centerpiece.dc.html` — the assembled centerpiece (primary reference).
- `Topic Page.dc.html` — isolated Topic‑page element.
- `Projector.dc.html` — projector, **off**, front‑on.
- `Projector On.dc.html` — projector, **on** (blown‑out aperture), front‑on.
- `Projector On Angled.dc.html` — projector, on, **yawed 25°** (used in the composition).
- `support.js` — DC runtime, only so the `.dc.html` files render if opened in a browser. Not part of the design; do not port it.

Open any `.dc.html` in a browser to view. They are references — implement the
equivalent in the wiki+ codebase using its own components and tokens.
