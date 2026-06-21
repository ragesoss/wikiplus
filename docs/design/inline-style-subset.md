# Design contract — recovered layout-only inline-`style` subset (montage tiling · per-cell colors · taxon band)

**Status:** Ready for Dev. **Owner:** UX / Design. **Input:** `docs/specs/inline-style-subset.md`
(Product spec, AC1–AC13) + `docs/design/inline-style-subset-spike.md` (Dev spike — mechanism
**fixed**: a pre-DOMPurify encode of an allowlisted, value-sanitized inline-`style` subset onto an
inert `data-wikiplus-style` carrier, the unchanged DOMPurify pass with an `IMG`-gated `width`/`height`
rescue, then a post-DOMPurify decode back to `style`; montage tiling ✔ / per-cell colors ✔ / taxon-band
color ✔). **Generalizes:** `docs/design/templatestyles-reuse.md` (the #105 contract — same
faithful-Wikipedia / no-Indigo target). **Area:** the "Wiki" left article column only (`.wiki-body`).

This is the **visual + interaction target** the recovered inline-`style` subset must hit, and the bar
for the Phase-4 UX evaluation. It does **not** choose the mechanism — the spike did. It defines what
"faithful" *looks like* for each recovered surface, the Indigo-bleed boundary, every state, the
responsive behavior, and the AA darken-to-pass rule, so Dev and the evaluator share one definition of
done.

What is new vs. #105, and the whole point of #106: #105 recovered the page's `<style>`/TemplateStyles
*blocks* (sanitized + scoped under `.wiki-body`) — so the `.tmulti .trow{display:flex}` scaffold, the
clade tree, and long-tail styled tables draw from the page's own CSS. But #105 still **fully stripped
inline `style` attributes**, so the montage flex row had nothing to size against and collapsed to a
**stacked, full-width single column**, per-cell colored backgrounds vanished, and the taxon band stayed
neutral grey (#74's accepted partial). This contract is the fidelity target for the layout/color that
**only ships inline** and that #105 therefore could not reach. It reads as a fidelity contract for an
existing system, not net-new chrome.

## 0. The one-sentence bar

> A reader who knows Wikipedia could **not tell our multi-image montage, our per-cell colored tables,
> or our taxobox classification band from Wikipedia's own rendering — modulo our narrower column width**
> (and the accepted limits in §1) — on **Cat** and **San Francisco** specifically, and on any article
> that ships the same inline layout. Montages tile side-by-side with a uniform crop instead of stacking;
> recovered colors render in their cells/band (AA-darkened where they would fail contrast); and nothing
> in the article column carries Indigo Press identity.

"Modulo our column width" is the only general license: the article column is `~1fr` next to the right
rail and narrower than a full Wikipedia page, so a montage tiles within its narrower container and a
wide table scrolls within its own region (§5). The other accepted limits are named and bounded in §1.

## 1. The accepted limits (read this before evaluating fidelity)

The spike fixed exactly what the inline-`style` subset recovers and what it deliberately cannot. These
are **explicitly accepted** and are **not** evaluation failures — do not file them as design defects:

1. **#92 pushpin locator-map overlays stay un-recovered (still broken / out of scope).** A pushpin
   locator map (a coordinate dot positioned over a base map) places its marker with
   `position:absolute`. `position` is **never** allowlisted inline (any value, including `relative` and
   `static`) — it is the clickjack/overlay surface this boundary exists to keep closed. So a pushpin map
   renders without its positioned marker, exactly as today. This is a **deliberate** limit, not a
   regression; recovering #92 is **not** a goal of this issue and must not motivate admitting
   `position`. Evaluate a pushpin map as un-recovered, and pass it.
   - The geologic `#Timeline-row` timebar graphic stays **removed** by `stripChrome` for the same reason
     (its layout needs `position:absolute`). Unchanged from today.
2. **`url()` backgrounds are dropped.** Any inline declaration carrying a `url()` / `image-set()` /
   `-moz-element()` token is dropped (X4 exfiltration cost), **including** on an allowlisted property
   (e.g. `background-color:url(...)`, `border:1px solid url(...)` → the whole declaration dies). A cell
   that *relied* on a `url()` background image loses that image but keeps its layout and any explicit
   `background-color`. In montage/colored-cell/taxon-band markup this is rarely visible; where it is, the
   cell is plainer, never broken.
3. **Only the explicit `background-color` longhand is recovered, never the `background` shorthand.** The
   `background` shorthand can carry a `url()`, so it is **not** allowlisted; per-cell color is recovered
   from the `background-color` longhand only. Wikipedia's per-cell color and the taxon band both ship as
   `background-color`, so this is the safe subset that still reaches AC2/AC3.
4. **Column-width differences.** Every montage/box is proportionally narrower than full-width Wikipedia
   because our column is narrower; a wide colored table scrolls within its contained region (§5) rather
   than widening the shell.

Everything **else** — montage grid/row layout, uniform crop, per-cell colors, the taxon-band color,
cell borders, alignment — matches Wikipedia. If any of those is broken, that is a defect; the limits
above are not.

## 2. Personas & stories this serves

**The Curious Reader** (lands on a Topic page to actually read the encyclopedia beside the curated clips
— the persona from `docs/TOPIC_PAGE_DESIGN.md`, carried from the #104/#105 contracts):

- *As a reader, I want a multi-image montage (the photo grid at the top of an article, or the "Various
  types of cats" grid in the Cat taxobox) to lay out as the intended side-by-side grid of uniformly
  cropped images, not collapse into a broken vertical stack of full-width photos — the live failure the
  owner reported on **Cat** and **San Francisco**.*
- *As a reader, I want a table that colors its cells (a legend swatch, a status/category shading) to show
  those colors, so the cell's meaning reads as it does on Wikipedia — not as a flat, uncolored grid.*
- *As a reader of the Cat taxobox, I want the "Scientific classification" band to read in its faithful
  taxon-band color, so the box looks like the encyclopedia's, not a greyed-out approximation.*
- *As a reader on a phone, I want the montage to reflow with the taxobox (drop full-width below the lead)
  and still tile its images as a unit — never break into a stack or push the page sideways.*
- *As a reader using a screen reader or with high-contrast needs, I want a colored cell's or band's
  meaning to survive without relying on color: the recovered color is decoration over structure (text,
  position, weight, hairline) that already carries the signal, and any recovered color that would fail
  contrast is darkened to pass.*

**The wiki+ team / scaling goal** (carried from #105): *As the team, we want a faithful Wikipedia look
to extend to the per-element layout and color Wikipedia ships **inline** — montage tiling, colored
cells, the taxon band — through one auditable allowlist + the reused #105 value sanitizer, so we close
the last large fidelity gap after #105 (#91, #93, and #74's partial) **without** expanding the
inline-`style` XSS surface.* The narrow, allowlisted boundary — not "inline `style` is back on" — is the
point; faithfulness scales to any article that ships the same inline layout, with no per-article tuning.

## 3. The montage tiling visual target (AC1 — the headline)

A `.tmulti` montage (`Template:Multiple image`) is a block of images Wikipedia tiles **side-by-side in
their grid, each uniformly cropped** to the template's per-image dimensions. The structure (confirmed
against the live `Cat`/`San Francisco` markup in the spike) nests:

```
.multiimageinner  style="width:Wpx;max-width:Wpx;border:none"    ← overall montage width
  .trow                                                          ← a row (flex, from #105's block CSS)
    .tsingle      style="width:Cpx;max-width:Cpx"                ← a column cell, sets the cell width
      <div>       style="height:Hpx;overflow:hidden"             ← the UNIFORM CROP band
        <img      width="Ipx" height="Ipx" class="mw-file-element">   ← the scaled image, clipped by the crop
      .thumbcaption                                              ← the per-image caption (if present)
```

Faithful tiling requires **all three recovered geometries together** (the spike confirmed neither alone
tiles): the `.tsingle`/`.multiimageinner` `width`/`max-width` (the side-by-side **column widths** the
#105 flex row sizes against), the crop `<div>`'s `height` + `overflow:hidden` (the **uniform crop
band**), and the `<img>`'s `width`/`height` **presentational attributes** (the **scaled image size**
clipped inside the crop). With #105's `.trow{display:flex}` scaffold sizing against real column widths,
the row lays out left-to-right; each image renders at its scaled size inside a fixed-height
`overflow:hidden` band, so the crop is uniform across the row.

**Fail (AC1):** a montage that still renders as a **vertical stack of full-width images**, or with images
at **wildly mismatched sizes** / **no crop** (images at full height, the crop band ignored), or images
**overflowing the column**. The pass/fail test is "side-by-side, uniformly cropped, like Wikipedia."

### 3.1 Cat — the taxobox "Various types of cats" montage

The Cat taxobox carries a `.tmulti` montage of cat photos **inside the narrow taxobox** at desktop. The
faithful target: the montage tiles **~2-up per row** within the taxobox's narrow width (the
`.multiimageinner` width ~267px from the live markup, with `.tsingle` cells ~183px → the row carries the
images side-by-side at the template's column widths, wrapping to the next `.trow` as the template
structures it), each image uniformly cropped by its `height:…px;overflow:hidden` band. The exact
per-row count and image count are **whatever the live Parsoid `Template:Multiple image` markup carries**
— do not invent or hardcode a grid; recover the template's own `.trow`/`.tsingle` structure and let it
tile. The pass bar is: side-by-side, uniformly cropped, inside the taxobox — not a stack of full-width
cat photos running down the box.

### 3.2 San Francisco — the lead collage

San Francisco opens with a `Template:Multiple image` **lead collage** of city landmarks (skyline,
Golden Gate Bridge, etc.) in the body flow above the lead (or in the geobox), wider than the Cat taxobox
montage. The faithful target: the collage tiles in its intended multi-row grid (the template's `.trow`
rows of `.tsingle` cells) at the widths the montage sets, each image uniformly cropped — the
recognizable rectangular photomontage, not a single column of full-width landmark photos. As with Cat,
the row/grid shape is the template's own; recover it, don't impose one.

### 3.3 Responsive behavior — the reflow must match Wikipedia, not break the stack

`lg` = the existing **`1023px`** breakpoint (`@media (max-width: 1023px)` in `app/globals.css`), the same
column-stack breakpoint #105 uses. Two width bands:

- **Desktop (`≥ lg`, viewport ≥ 1024px).** The montage tiles at the widths its inline `style` sets —
  inside the taxobox for Cat (the taxobox floats right within the article column per the #105 contract),
  in the body flow for San Francisco's lead collage. Side-by-side rows, uniform crop, as §3.
- **Narrow (`< lg`, viewport ≤ 1023px).** The taxobox stacks full-width in the article flow (per the
  #105 contract: `float:none;width:100%;max-width:100%`), so the Cat montage reflows into a **full-width
  taxobox** and still tiles its images **as a unit** — it does **not** degrade into a broken vertical
  stack of full-width photos. A montage whose recovered width would exceed the narrow column **scrolls
  within its own contained region** (the same `overflow-x:auto` containment + `Scroll table →` hint
  pattern as wide tables/trees, §5) — it scrolls as a tiled unit; it never widens the shell. This matches
  Wikipedia's reflow: a narrower container with the grid preserved, not a collapse to one image per row
  unless the template's own narrow-width rule reflows it that way.
- **At every width:** the article body and the two-column shell **never** scroll horizontally — only a
  contained montage/table region does.

**AC1 is verified LIVE** at **desktop (~1366px)** and **narrow (~768px)** on the deployed `Cat` and `San
Francisco` pages (not only a unit fixture) — see §9.

## 4. Per-cell colored backgrounds (AC2) + taxobox taxon band (AC3)

### 4.1 Per-cell colored table backgrounds (AC2 — recovers #93)

A table cell that ships `style="background-color:…"` (a legend swatch, status/category shading), and the
`color:…` Wikipedia pairs with it where present, renders with the **faithful Wikipedia cell color**
(subject to §6's AA darken-to-pass). The recovered color is **scoped to that cell** — it does not bleed
to sibling cells or the table frame, and the table frame stays faithful Wikipedia grey (§7). This
recovers #74's grey-only limit for colored cells.

**Fail (AC2):** the colored cells render uncolored (flat grid), or a cell's color bleeds onto siblings /
the frame, or a recovered color ships below AA (§6).

### 4.2 The taxobox taxon band (AC3 — recovers #74's partial)

The taxobox "Scientific classification" banner band ships its color as `background-color` on the banner
`<th>` (`{{Taxobox colour}}` — e.g. `background-color:rgb(180,250,180)` on Cat, the desaturated
biota/animal band). It renders in that **faithful taxon-band color** (subject to §6's AA darken-to-pass),
recovering #74's neutral grey. The band's **structural signal is preserved regardless of the color**:
centered, bold, with the `--color-wikirule` (`#a2a9b1`) hairline — so the band still reads as a banner if
the color is AA-darkened or in greyscale (this is why recovering it is safe under "no color alone," §6).

**Fail (AC3):** the band ships its neutral grey when the live markup carries a recoverable color, or the
band's centered/bold/hairline structure is lost, or the recovered band color ships below AA (§6).

## 5. AA on recovered colors — the darken-to-pass rule (AC10)

Recovered colors are Wikipedia's own, but our column must still clear **AA**, and meaning must never
depend on color alone. The rule, concrete enough to evaluate:

**Contrast targets.** For every recovered per-cell `background-color` (§4.1) and the recovered taxon band
(§4.2): text on that background ≥ **4.5:1** (≥ **3:1** for large text — ≥ 24px, or ≥ 18.66px bold); any
meaningful **boundary** (a recovered `border` color, the band hairline) ≥ **3:1**.

**The darken-to-pass policy — when a recovered pair fails AA.** When a recovered `background-color` +
its text `color` (or band color + the article ink `#2c2c2c`) fails the target above, **adjust the
rendering to pass rather than shipping the failing color** — and **keep the background hue** so the cell
still reads as "the green band / the yellow legend cell," just at passing contrast. The order of
preference:

1. **Darken (or lighten) the text/ink** on the recovered background until the pair clears 4.5:1 (3:1 for
   large), keeping the recovered background hue. For the taxon band, the band text is the article ink
   `#2c2c2c`; against a light recovered band (e.g. `rgb(180,250,180)`) the ink already clears 4.5:1, so
   no adjustment is needed there — the typical taxon bands are light pastels under dark ink. Adjust only
   when a specific recovered pair actually fails.
2. **If the failing pair is a recovered `background-color` + a recovered `color`** (Wikipedia paired a
   light text with a mid/dark fill, or vice versa), darken/lighten the **recovered text `color`** toward
   the passing end while keeping the recovered background; if that still cannot reach 4.5:1 without
   inverting the design, **darken the background** toward the same hue's darker shade and pair it with
   the lighter text — again keeping the hue so the cell reads the same.
3. **For a boundary color** (a recovered `border`) below 3:1 against the column white / the cell fill,
   darken the border to the nearest passing shade of its hue (or fall back to the faithful Wikipedia grey
   `--color-wikirule` `#a2a9b1` family, which clears 3:1).

**Never ship a recovered color below AA, and never let meaning rest on color alone.** A colored legend
cell's or status cell's meaning survives in greyscale via its **text label, position, and weight** (the
recovered color is decoration over structure that already carries the signal); the taxon band's meaning
survives via centered/bold/hairline (§4.2). A recovered color that ships below AA, or a cell/band whose
signal exists only in the color, **fails AC10.**

**Where to verify:** the recovered taxon band on **Cat**, and any recovered colored cells on a
colored-table article (Dev/QA pick a real one carrying `background-color` cells). The check is mechanical
— sample the recovered background + the text on it, compute the ratio against the target.

## 6. No-Indigo boundary (AC11 — hard) + responsive containment

Restated as a contract because loading recovered third-party color is exactly where Indigo could slip:

- **Recovered colors are Wikipedia's own, never Indigo Press.** No recovered inline-`style` value
  introduces `brand #676eb4`, `sprout #2a8270`, `action #1f6f95`, gold `#e5ab28`, the hardbox 2px-ink
  border, the offset drop-shadow, or the Indigo fonts into the article column. A recovered cell color is
  the faithful Wikipedia value (AA-darkened within its own hue per §5, never recolored toward Indigo); a
  recovered band color is the taxon-band value, never indigo.
- **Box frames stay faithful Wikipedia grey.** A recovered `border` is the cell's own Wikipedia rule (or
  the `--color-wikirule` `#a2a9b1` grey family); the taxobox/table frame is unchanged faithful grey —
  recovering a cell's `background-color` must not retint the frame.
- **No Indigo bleed, the only exception.** The single indigo permitted to touch the article column is the
  standard `:focus-visible` ring (`3px solid var(--color-brand)`) on a keyboard-focused horizontal-scroll
  region (a wide montage/table wrapper) — a global a11y affordance, not article styling, consistent with
  the #105 contract. Nothing else.
- **The boundary is a release gate.** The evaluator inspects the **＋plus rail, the wiki+ panel, the TOC,
  the General strip, the projector header, the player modal, and the pinned candidate dock** at a wide
  viewport, at scroll-top and scrolled: **a single changed pixel of wiki+ chrome fails this.** (The
  *security* proof that the recovered subset cannot escape its cell — AC5–AC9, the X4 re-proof — is QA's
  release gate; UX asserts the *visual* boundary.)

**Responsive containment (AC11).** Below `lg`, a recovered-color table and a tiled montage stay
**contained**: a wide colored table or a wide montage scrolls within its **own** `overflow-x:auto` region
(`.wiki-tablewrap` for tables; the equivalent contained wrapper for `.tmulti` montages, per the #105
contract), showing the `Scroll table →` text hint **only** on real overflow. The **article body and the
two-column shell never scroll horizontally** at any width. A tiled montage that would overflow the narrow
column degrades to a **contained/scrolled tiled unit**, not a shell-widening row and not a broken stack
(consistent with §3.3 and AC1's narrow-width verification). The `Scroll table →` hint is the established
microcopy — reuse it verbatim, text-labeled (never color/glyph alone); no new microcopy is introduced.

## 7. Every state

| State | Behavior |
|---|---|
| **No-inline-`style` content (no-op)** | An element whose inline `style` carries **only** non-allowlisted or sanitized-away declarations renders **exactly as today** — no stray attribute, no broken layout, no `data-wikiplus-style` artifact. An article with no recoverable inline layout/color (no `.tmulti` montage, no colored cells, a grey-only taxobox) renders identically to pre-#106. The recovery is **additive for the allowlisted subset and a no-op everywhere else** (AC4). Verify on a montage-free / colored-cell-free article. |
| **Recovered-color / montage populated** | The §3/§4 targets render — montages tile side-by-side with a uniform crop (Cat taxobox + San Francisco collage), per-cell colors render in their cells (AA-adjusted), and the taxon band renders in its faithful color (AA-adjusted). This is the bulk of the work and the evaluation. |
| **Accepted limits (un-recovered, by design)** | A **#92 pushpin locator-map** renders without its positioned marker (no `position` recovered) — un-recovered, **pass**, not a defect (§1.1). A cell relying on a **`url()` background** loses the image but keeps its layout and any `background-color` (§1.2). A `background` **shorthand** color is not recovered (only the `background-color` longhand is, §1.3). The `#Timeline-row` timebar stays removed. None of these is filed as a defect. |
| **Wide-region overflow** | A wide recovered-color table or wide montage shows the `Scroll table →` text hint **only** on real overflow (`data-overflow` flag), within its contained region (§6). |
| **Loading / error** | **Unchanged.** The recovery is a no-op on the loading/error states; reference current behavior, do not redesign. A brief moment before the recovered geometry applies is acceptable; a montage that stays permanently stacked is not. |

## 8. Accessibility (AA — baseline, verified)

- **Contrast (AC10).** Per §5: recovered backgrounds clear 4.5:1 (3:1 large) under their text; recovered
  boundaries clear 3:1; failing pairs are darkened-to-pass within their hue, never shipped below AA.
- **No information by color alone.** A recovered colored cell's meaning survives in greyscale (text,
  position, weight); the taxon band's meaning survives via centered/bold/hairline. The recovered color is
  decoration over a structure that already carries the signal.
- **Images keep `alt`.** Montage images retain their `alt` text through the recovery — the recovery
  carries the img `width`/`height` presentational attributes and the inline geometry; it changes layout,
  not the sanitized DOM's `alt` (or `th scope`, `caption`) attributes.
- **Keyboard-scrollable regions.** A wide montage/table contained region is keyboard-reachable and
  scrollable with the project's visible focus ring (`:focus-visible` → `3px solid var(--color-brand)`);
  do not trap, do not remove the outline (§6).
- **Structure preserved.** A screen reader still reads a colored table as a table (header `scope`, data
  cells) and a montage as its image group with captions; the recovered color/geometry does not strip or
  override that semantics.

## 9. Acceptance / evaluation checklist (Phase-4 UX evaluation — maps to AC1–AC4, AC10–AC11)

The Phase-4 UX evaluation is mechanical against this list. **Evidence:** render the **standard
screenshot matrix** (`scripts/dev/shots.sh`, driven by the scene catalog `e2e/screenshots/catalog.ts` —
logged-out/logged-in × mobile/tablet/desktop × surface/state) on the **Cat** Topic page (taxobox montage
+ taxon band) and the **San Francisco** Topic page (lead collage), plus a spot-check on a colored-cell
table article, at a **wide (`≥ lg`, ~1366px)** and a **narrow (`< lg`, ~768px)** viewport. **AC1 is
verified LIVE** on the deployed Cat + San Francisco pages — not only a unit fixture. This reproducible
set is also the PR gallery (`--scene … --pr <N>`), and the committed baseline gallery
(`docs/design/ui-screenshots/`) is refreshed in the same PR (partial refresh of the affected Topic
surfaces, or `--all` if a new scene is added).

- [ ] **AC1 / §3 — Montages tile faithfully, verified LIVE on Cat + San Francisco at desktop AND narrow.**
  Images side-by-side in their grid/row, each **uniformly cropped** — **not** a vertical stack of
  full-width images, not mismatched sizes, not no-crop. **Cat:** the taxobox "Various types of cats"
  montage tiles ~2-up within the (floated, desktop / full-width, narrow) taxobox. **San Francisco:** the
  lead collage tiles in its multi-row grid. Narrow: the montage reflows with the full-width taxobox and
  tiles as a unit (or scrolls contained), never a broken stack. **Headline — if either article stacks at
  either width, fail.**
- [ ] **AC2 / §4.1 — Per-cell colors render faithfully.** A `background-color` cell (and paired `color`)
  renders its faithful Wikipedia color, scoped to the cell, no bleed to siblings/frame; not a flat grid.
- [ ] **AC3 / §4.2 — Taxon band renders faithfully.** The Cat taxobox "Scientific classification" band
  renders in its faithful taxon-band color (AA-adjusted per §5), **recovering #74's neutral grey**; the
  band's centered/bold/hairline structure is intact.
- [ ] **AC10 / §5 — AA on recovered colors; never color alone.** Every recovered background clears 4.5:1
  (3:1 large) under its text; recovered boundaries clear 3:1; a failing pair is darkened-to-pass within
  its hue (not shipped failing); every colored cell/band reads in greyscale via text/position/weight/
  hairline. A recovered color below AA, or a color-only signal, fails.
- [ ] **AC11 / §6 — No Indigo bleed; responsive containment.** No Indigo color/treatment anywhere in the
  article column from a recovered value; recovered colors are Wikipedia's own; box frames stay faithful
  grey; the only indigo is the `:focus-visible` ring on a focused scroll region. The **＋plus rail, wiki+
  panel, TOC, General strip, projector header, player modal, and candidate dock are pixel-unchanged** at
  scroll-top and scrolled, wide and narrow. Below `lg`, montages and colored tables scroll within their
  own contained region; the article body and shell **never** scroll horizontally.
- [ ] **AC4 / §7 — No-op where style is dropped.** An element whose inline `style` is entirely
  non-allowlisted/sanitized-away renders as today (no stray attr, no `data-wikiplus-style`, no layout
  shift); a montage-free / colored-cell-free article is artifact-free. Recovery is additive only.
- [ ] **§1 — Accepted limits present and correct (not failures).** A #92 pushpin map renders without its
  marker (un-recovered); `url()` backgrounds dropped; only the `background-color` longhand recovered (not
  the `background` shorthand); `#Timeline-row` timebar still removed. None filed as a defect.
- [ ] **§8 — AA / a11y.** Montage images keep `alt`; colored tables keep `th scope`/`caption` semantics;
  wide montage/table regions keyboard-scrollable with the visible focus ring; `Scroll table →` hint on
  real overflow only, text-labeled.

> **Out of this contract's scope (other roles own):** the X4 anti-XSS re-proof for the inline-`style`
> boundary — AC5–AC9 (property allowlist, `url()` exfil, off-column `position` overlay,
> `behavior`/`expression()`/`-moz-binding`, escape/comment/whitespace obfuscation), **plus the
> carrier-hijack vector** (source HTML supplying its own `data-wikiplus-style`) and the singleton no-leak
> — is a **security release gate verified by QA & Review** per the spike §5/§10. AC12 (build/typecheck/
> Docker CI/full suite incl. the **revised** §8-of-spec inline-`style` assertions) and AC13 (no #105 or
> article-column regression) are QA's. UX asserts the *visual* no-Indigo boundary (§6) and the
> fidelity/responsive/AA targets only. The mechanism (pre-encode carrier + reused `cssScope.ts` value
> sanitizer + post-decode + `IMG`-gated `width`/`height` rescue) is fixed by the spike — Dev implements
> against it; this contract does not re-open it.
