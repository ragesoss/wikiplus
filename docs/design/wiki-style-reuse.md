# Design contract — faithful Wikipedia tables & infoboxes in the article column

**Status:** Ready for Dev. **Owner:** UX / Design. **Input:** `docs/specs/wiki-style-reuse.md`
(Product spec, commit dcef903; AC1–AC9). **Area:** the "Wiki" left article column only.

This is the **visual + interaction target** the reused Wikipedia styling must hit, and the bar for
the Phase-4 UX evaluation. It does **not** choose the loading mechanism — that is Dev's §4 discovery
step. It defines what "faithful" *looks like* per box type, the Indigo-bleed boundary, every state,
responsive behavior, and AA requirements, so Dev and the evaluator share one definition of done.

## 0. The one-sentence bar

> A reader who knows Wikipedia could **not tell our taxobox, cladogram, infobox, or data table from
> Wikipedia's own rendering — modulo our narrower column width and the stripped editor chrome /
> navboxes.** Nothing in the article column carries Indigo Press identity.

"Modulo column width" is the only license: the article column is `~1fr` next to a `360px` rail and
narrower than a full Wikipedia page, so a box may be proportionally narrower and a wide table may
scroll. Everything else — color, weight, borders, banner structure, branch lines, alignment — matches
Wikipedia. The reuse path recovers styling the bespoke #74 CSS deliberately gave up (per-taxon band
color, real clade branch lines); this contract treats those as **in-scope wins**, not nice-to-haves.

## 1. Persona & stories this serves

**The Curious Reader** (lands on a Topic page to actually read the encyclopedia beside the clips):

- *As a reader, I want the scientific-classification box to look like Wikipedia's taxobox — colored
  band, rank ladder, lead image — so the article reads as the real encyclopedia, not a broken
  fragment, and I trust the whole page.*
- *As a reader, I want the evolutionary trees (cladograms) to render as legible branching diagrams so
  I can actually read the phylogeny — the single most-broken thing on the Cat page today.*
- *As a reader on a phone, I want the infobox to drop below the lead full-width (not a squeezed
  sliver), and a wide table to scroll sideways inside its own region without breaking the page layout.*
- *As a reader using a screen reader or high-contrast needs, I want every box's structure (which row
  is a banner, what an image's subject is, which region scrolls) to survive without relying on color.*

## 2. The Indigo-bleed boundary (hard)

This is the governing constraint, restated as a contract because it is the thing most likely to slip
when you load a third-party stylesheet.

- **Faithful-Wikipedia zone = the entire article column** (everything under `.wiki-body`). Tables,
  infoboxes, the taxobox, cladograms, captions, hairlines, link blue — all keep Wikipedia's own visual
  language. This column is "the Wiki world" (`TOPIC_PAGE_DESIGN.md` §"two worlds", §"Two infoboxes").
- **Indigo Press is allowed nowhere in this column.** No `brand #676EB4`, no `sprout`, no `action`, no
  hardbox 2px-ink border, no offset drop-shadow, no Source-Sans/Open-Sans, no gold. The box frame is
  **faithful Wikipedia grey** (`#a2a9b1` border family) and band grey (`#eaecf0`), never indigo.
- **Scoping is a release gate, not a nicety.** Every rule the reuse path loads MUST be confined under
  `.wiki-body` and MUST NOT match the `＋plus` rail, the wiki+ panel, the TOC, the General strip, the
  projector header, the player modal, or the pinned candidate dock. The evaluator will inspect the
  rail and header at a wide viewport and at scroll-top/scrolled: if any reused selector changes a
  single pixel of wiki+ chrome, this fails (maps to **AC6**). Practical expectation: the loaded
  Wikipedia/MediaWiki CSS is injected scoped (prefixed/nested under `.wiki-body`) so a bare
  `table`, `.infobox`, `.clade`, `td`, `caption`, `figure` rule from Wikipedia cannot leak out of the
  column. (The *security* side of scoping — that the CSS comes only from the trusted MediaWiki origin,
  never the page body — is the spec's X4 gate / AC5, verified by QA, not re-litigated here.)

## 3. Fidelity target per box type

Each target is "matches Wikipedia's own rendering, modulo our column width." Reference: the live
en.wikipedia.org/wiki/Cat page, side-by-side, is the comparison the evaluator runs.

### 3.1 Taxobox — `table.infobox.biota` (the "Felis catus" scientific classification)

Faithful means, top to bottom:

- **Title banner** — the taxon name (e.g. *Cat* / *Felis catus*) as a **centered, bold** band spanning
  the full box width, on the **taxon-band color** (see below), with a hairline below. Not left-aligned.
- **Taxon-band color present** — the colored band behind the classification banner rows is the
  **animal/biota band** Wikipedia uses (a desaturated pinkish-tan, `#d3d3a4`-family for animals), not
  a neutral grey. This is the color the #74 decision gave up and that the reuse path is expected to
  recover. The band appears on the classification banner rows (the "Scientific classification" header
  and rank-group dividers), consistent with Wikipedia.
- **Lead image, centered**, full box width, with a **small grey caption** centered directly beneath it.
  Multiple stacked images each keep their caption (the Cat taxobox shows several phenotype photos).
- **Taxon rank ladder** — a **left-aligned two-column** key/value list: rank label (Kingdom, Phylum,
  Class, Order, Family, Genus, Species, …) on the left, value on the right, in standard (not heavy)
  weight, tight vertical rhythm. Clade/rank italics preserved. Binomial (*Felis catus*) and authority
  ("Linnaeus, 1758") render as Wikipedia shows them; the **Synonyms** block stays left-aligned (it is
  not an image caption — do not center it).
- **Frame & width** — faithful grey hairline frame; the box is **narrower than a dense modern infobox**
  (Wikipedia's taxon column is slim). Floats **right** at `≥ lg`.

### 3.2 Plain modern infobox — `table.infobox`

- **Title banner** — centered, bold, on Wikipedia's header grey (`#eaecf0`), hairline below.
- Optional **sub-caption** under the title — centered, smaller, muted (not a banner).
- **Image** — centered, full box width, small grey caption.
- **Key/value rows** — left-aligned two-column ladder (`th scope=row` label + data cell), Wikipedia's
  rhythm and hairlines.
- **Frame** — faithful grey hairline; floats **right** at `≥ lg`. No Indigo treatment.

### 3.3 Cladograms — `table.clade` (the signature fix)

This is the headline. There are 16 on the Cat page; today they collapse into borderless nested tables
and are unreadable. "Legible tree" means the reader sees an actual **branching diagram**:

- **Branch lines are drawn and connected.** `Template:Clade` paints the tree using **per-cell borders**
  — vertical line segments (a cell's left border) and horizontal line segments (a cell's bottom/top
  border) that join at fork points into the classic right-angled bracket tree. Faithful rendering shows
  these as **thin solid dark lines** (Wikipedia's ~1px black/`#000`-family clade lines) that visibly
  **connect** ancestor to descendants — not gaps, not absent lines. (The plain-text view of the page
  loses these lines; the rendered page draws them — that connected bracket is the target.)
- **Indentation / hierarchy** — each nested clade steps **right** from its parent; sibling taxa align
  on a shared vertical line dropping from their common node. Terminal taxa (leaf labels, e.g.
  *Pantherinae*, *Felinae*, the domestic-cat lineage) sit at the right, vertically aligned where
  Wikipedia aligns them.
- **Leaf content faithful** — italic binomial labels and the small (~60px) thumbnail illustrations
  beside selected taxa render at Wikipedia's size and position; labels are not clipped.
- **Containment** — the tree never widens the two-column shell; if a deep/wide tree exceeds the column
  it scrolls horizontally within its own contained region (see §5).

A cladogram that renders as nested grey-bordered boxes, as a flat list, or with disconnected/absent
branch lines **fails AC3** — legibility of the tree shape is the pass/fail test.

### 3.4 Ordinary data tables — `table.wikitable` and plain `<table>`

- **Header cells** — Wikipedia's header grey shading (`#eaecf0`), bold, centered or left per the
  source's alignment.
- **Borders** — thin grey cell borders (`#a2a9b1`-family), collapsed, on every cell — the standard
  `wikitable` frame.
- **Alignment** — honor the cell's intended alignment (left for text, right/center where the source
  sets it); do not force-left every cell.
- **Zebra** — Wikipedia's default `wikitable` is **not** zebra-striped; do **not** invent striping.
  Only render striping if the reused Wikipedia CSS itself applies it for that table class. Match
  Wikipedia, don't embellish.
- **Captions** — left-aligned bold caption above the table, Wikipedia-style.

(The Cat article happens to be table-light; AC4 is still verified on Cat for any plain tables present,
and on the data-table-heavy article in the success-metric sample.)

## 4. Responsive behavior

Web-first, responsive. `lg` = the existing `1023px` breakpoint already used for the column stack.

- **Infobox & taxobox** — float **right within the article column at `≥ lg`**; **stack full-width in
  the article flow below `lg`** (`float:none; width:100%`). A narrow float in a single narrow column is
  unreadable, so the stack is required, not optional (**AC8**).
- **Cladograms** — never widen the shell. On a narrow viewport a wide tree **scrolls horizontally
  within its own contained, keyboard-scrollable region** (same containment pattern as wide tables); it
  does not reflow into a broken stack and does not push the rail. Branch-line fidelity is preserved
  inside the scroll region.
- **Wide data tables** — keep the existing contained `overflow-x:auto` wrapper: the table scrolls
  sideways inside its region, the page body and the two-column shell never scroll horizontally.
- **Banner rows stay centered + shaded at both breakpoints** — stacking full-width must not relax the
  banner/band treatment. (This is the bug the #74 banner rule fixed; preserve it.)

## 5. Every state

| State | Behavior |
|---|---|
| **Populated (faithful)** | The §3 targets render. This is the bulk of the work and the bulk of the evaluation. |
| **Loading skeleton** | **Unchanged** — the existing article-fetch loading skeleton is out of scope; reference current behavior, do not redesign. The reused stylesheet must not flash unstyled tables in a way that regresses perceived load (if styles arrive after the DOM, the brief unstyled moment is acceptable but should not leave tables permanently unstyled). |
| **Error (article fetch fails)** | **Unchanged** — the existing article-error state stands; this work does not touch it. |
| **No-tables article** | An article with no tables/infoboxes/cladograms renders exactly as today — the reuse path adds no visible artifact (no empty wrapper, no stray rule, no layout shift). This is an explicit pass condition: loading Wikipedia CSS must be a no-op when there's nothing to style. |
| **Wide-table overflow hint** | The existing **text** hint **"Scroll table →"** (shown only when a wrapped table actually overflows, set via the `data-overflow` flag) **stays** — it is text-labeled, never color/glyph alone, and serves the keyboard/touch scroll affordance. Apply the same hint pattern to any cladogram that ends up in a horizontal-scroll region. |

## 6. Accessibility (AA — baseline, verified)

- **Contrast** — body text in tables/infoboxes/cladograms ≥ **4.5:1** against its background; large
  text and meaningful boundaries (cell borders, banner hairlines, clade branch lines) ≥ **3:1**. The
  taxon-band color and the header grey must clear 4.5:1 for the band's banner text sitting on them
  (dark ink on `#d3d3a4` and on `#eaecf0` both clear it; verify after the reuse path sets the exact
  band value). **AA is a release gate (AC7)** — if a recovered Wikipedia color fails contrast in our
  column, ink/border is darkened to pass rather than shipping the failing color.
- **No color alone** — a banner's "this is a banner / section divider" signal must survive in
  greyscale: it is carried by **position, bold weight, the hairline, and the heading text**, not by the
  band color. The taxon-band color is decoration on top of an already-legible structure (**AC7**).
- **Keyboard-scrollable regions** — every horizontal-scroll container (wide table, wide cladogram) is
  reachable and scrollable by keyboard, with the project's **visible focus ring** on the scroll region.
  Do not trap; do not remove the outline.
- **Images keep `alt`** — taxobox lead images and clade thumbnails retain their `alt` text through the
  reuse path (the reuse changes styling, not the sanitized DOM's alt attributes).
- **Structure preserved** — `th scope`, `caption`, and table semantics that survive sanitize are not
  stripped or overridden by the styling; a screen reader still reads the rank ladder as a table.

## 7. Acceptance / evaluation checklist (maps to spec AC1–AC9)

The Phase-4 UX evaluation is mechanical against this list. Evidence: render the standard screenshot
matrix on the **Cat** Topic page (the in-scope article), plus a spot-check on Lion (taxobox) and a
data-table article, at a **wide (`≥ lg`)** and a **narrow (`< lg`)** viewport.

- [ ] **AC1 / §3.1 — Taxobox faithful.** Centered bold title banner; **taxon-band color present** (not
  grey); centered lead image + caption; left-aligned rank ladder; Synonyms left-aligned; floats right
  at `≥ lg`. Side-by-side with Wikipedia reads as the same box (modulo width).
- [ ] **AC2 / §3.2 — Plain infobox faithful.** Centered banner, key/value ladder, centered image,
  faithful grey frame, floats right at `≥ lg`.
- [ ] **AC3 / §3.3 — Cladograms legible.** Connected branch lines + indentation visible; reads as a
  branching tree, not collapsed/borderless nested boxes. (Headline fix — if not legible, fail.)
- [ ] **AC4 / §3.4 — Data tables faithful.** Header shading, grey cell borders, source alignment
  honored, no invented zebra; wide tables scroll in a contained region, shell never widens.
- [ ] **AC6 / §2 — No Indigo bleed.** No Indigo color/treatment anywhere in the article column; box
  frames faithful grey; **the ＋plus rail, wiki+ panel, TOC, General strip, and projector header are
  pixel-unchanged** at scroll-top and scrolled, wide and narrow. (Reused CSS is scoped under
  `.wiki-body`.)
- [ ] **AC7 / §6 — AA.** Contrast ≥ 4.5:1 body / ≥ 3:1 large + boundaries; banner signal survives in
  greyscale (no color-alone); scroll regions keyboard-reachable with visible focus; images keep `alt`.
- [ ] **AC8 / §4 — Responsive.** Infobox/taxobox stack full-width below `lg`; cladograms & wide tables
  scroll horizontally within their region below `lg`; shell never scrolls horizontally; banners stay
  centered+shaded at both breakpoints.
- [ ] **§5 — States.** No-tables article is artifact-free; loading & error states unchanged; the
  "Scroll table →" text hint still appears only on actual overflow.
- [ ] **AC9 — No regression (visual).** Math (SVG fallback), citation popover, hatnotes, figures,
  scroll-sync highlight, TOC, and wikilink routing on Cat and on Photosynthesis / Cellular respiration
  / Lion / Pythagorean theorem look and behave as before. (Functional/test side of AC5 + AC9 is QA's.)

> **Out of this contract's scope (other roles own):** AC5 (the X4 anti-XSS guarantee — that reused CSS
> comes only from the trusted MediaWiki origin and no page-body `style`/`<style>`/TemplateStyles is
> trusted) is a **security gate verified by QA & Review**, not by UX. UX only asserts the *visual*
> boundary (§2 / AC6). If a safe mechanism cannot recover the taxon-band color without violating X4,
> the spec's A4 fallback applies — AC1's color clause degrades to the #74 neutral grey band as an
> accepted partial, but the **structural** taxobox faithfulness and the **cladogram** legibility (AC3)
> remain hard requirements of this contract.
