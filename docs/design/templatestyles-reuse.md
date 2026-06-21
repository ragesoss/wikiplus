# Design contract — reused TemplateStyles in the article column (clade · `.tmulti` · long-tail tables)

**Status:** Ready for Dev. **Owner:** UX / Design. **Input:** `docs/specs/templatestyles-reuse.md`
(Product spec, AC1–AC11) + `docs/design/templatestyles-reuse-spike.md` (Dev spike — mechanism
**fixed**: `css-tree` scope + strip, applied via `textContent`; clade ✔ / `.tmulti` ✔; taxon-band
color **not** recovered). **Generalizes:** `docs/design/wiki-style-reuse.md` (the #104 contract — same
faithful-Wikipedia/no-Indigo target, now reached for *all* TemplateStyles families by one reuse path
instead of a per-template hand-port). **Area:** the "Wiki" left article column only (`.wiki-body`).

This is the **visual + interaction target** the reused, scoped TemplateStyles must hit, and the bar for
the Phase-4 UX evaluation. It does **not** choose the mechanism — the spike did. It defines what
"faithful" *looks like* per surface, the Indigo-bleed boundary, every state, responsive behavior, the
microcopy, and the AA requirements, so Dev and the evaluator share one definition of done.

What is new vs. #104, and the whole point of #105: in #104 the clade tree was drawn by **our hand-port**
of `Template:Clade/styles.css`. Here it — and the `.tmulti` montage, and any long-tail TemplateStyles
table — is drawn by the **page's own** TemplateStyles, sanitized and scoped under `.wiki-body`. The
*visual target* is unchanged; the *source of the styling* flips from "CSS we authored" to "the article's
own CSS, made safe." This contract therefore reads as a fidelity contract for an existing system, not
net-new chrome.

## 0. The one-sentence bar

> A reader who knows Wikipedia could **not tell our cladogram, multi-image montage, taxobox, infobox, or
> data table from Wikipedia's own rendering — modulo our narrower column width** (and the explicitly
> accepted deltas in §1) — and **on any article, not only the few hand-tuned ones.** Nothing in the
> article column carries Indigo Press identity, and a held-out article we never tuned against renders just
> as faithfully as the seeded ones, with zero new per-template CSS.

"Modulo our column width" is the only general license: the article column is `~1fr` next to the right rail
and narrower than a full Wikipedia page, so a box may be proportionally narrower and a wide table or tree
may scroll within its own region (§4). The other accepted deltas are named and bounded in §1.

## 1. The accepted deltas (read this before evaluating fidelity)

The spike fixed exactly what the reuse path recovers and what it cannot. These three deltas are
**explicitly accepted** and are **not** evaluation failures — do not file them as design defects:

1. **Neutral-grey banners — taxon-band color is NOT recovered.** Wikipedia ships the per-taxon band color
   (the desaturated pinkish-tan animal/biota band) as an **inline `style`** emitted by
   `{{Taxobox colour}}`. Inline `style` is the sibling **Issue B**, still stripped here. So the taxobox /
   infobox classification banners stay **Wikipedia header grey `#eaecf0`** with the `--color-wikirule`
   (`#a2a9b1`) hairline — exactly as #74/#104 ship them today. This is a **deliberate** state, not a
   regression: structural fidelity (centered/bold banner, hairline, the rank ladder, connected branch
   lines) is the bar; color is carried by Issue B if ever. **AC8's "no color alone" requirement makes this
   safe** — the banner's meaning never depended on the band color (§6).
   - This is the one place this contract *narrows* the #104 contract: #104 listed recovering the taxon-band
     color as an "in-scope win." The spike proved that win lives in Issue B, not here. Evaluate the band as
     grey, and pass it.
2. **No `url()` background images.** Any TemplateStyles declaration carrying a `url()` (decorative
   backgrounds, gradient-image fills, list-marker images) is dropped by the sanitizer as an X4 exfiltration
   cost. A surface that *relied* on a `url()` background loses that background but keeps its layout
   (borders, grid, flex, spacing, alignment). In practice clade/`.tmulti`/common-table layout does not use
   `url()` backgrounds, so this is rarely visible; where it is, the box is plainer but never broken.
3. **No off-flow `position`; column-width differences.** `position: fixed|absolute|sticky` declarations
   are dropped (X4 overlay/clickjack cost); `relative`/`static` are kept (clade `td.clade-bar` uses
   `relative` and renders correctly). And every box is proportionally narrower than full-width Wikipedia
   because our column is narrower — a wide table/tree scrolls (§4) rather than widening the shell.

Everything **else** — branch-line geometry, montage grid/row layout, captions, cell borders, header
shading, alignment, the rank ladder, italics, image sizing — matches Wikipedia. If any of those is broken,
that is a defect; the three deltas above are not.

## 2. Persona & stories this serves

**The Curious Reader** (lands on a Topic page to actually read the encyclopedia beside the curated clips —
the persona from `docs/TOPIC_PAGE_DESIGN.md` and the #104 contract):

- *As a reader, I want the evolutionary trees (cladograms) to render as legible branching diagrams so I can
  read the phylogeny — the single most-broken thing on the Cat page before #104, and now drawn from the
  page's own clade styles.*
- *As a reader, I want a multi-image montage (the photo grid at the top of an article) to lay out as the
  intended grid/row of captioned images, not collapse into a broken stack of full-width photos.*
- *As a reader landing on **any** article — not just the handful the team hand-tuned — I want its styled
  tables and boxes to look like Wikipedia, so the page reads as the real encyclopedia. This is the whole
  reason to curate **over** Wikipedia rather than reproduce a curated slice.*
- *As a reader on a phone, I want the infobox/taxobox to drop below the lead full-width (not a squeezed
  sliver), and a wide table or tree to scroll sideways inside its own region without breaking the page.*
- *As a reader using a screen reader or with high-contrast needs, I want every box's structure (which row
  is a banner, what an image's subject is, which region scrolls) to survive without relying on color.*

**The wiki+ team / future contributors** (the scaling goal): *As the team, we want faithful rendering of
an arbitrary article to require **zero** per-template CSS, so article coverage scales past the seeded set
instead of paying a bespoke authoring pass per template family forever.* This story is the headline; it is
made checkable by the held-out table (§3.3 / AC3).

## 3. The faithful-Wikipedia visual target per surface

Each target is "matches Wikipedia's own rendering, modulo §1." Reference: the live en.wikipedia.org
rendering, side-by-side, is the comparison the evaluator runs — Cat for clade + taxobox + `.tmulti`, plus
the named held-out article for the long-tail table. These are the three surfaces the reuse path now
styles; the taxobox/plain-infobox structural targets carry over verbatim from the #104 contract §3.1/§3.2
(banner centered+bold on `#eaecf0`, centered captioned image, left-aligned rank/key-value ladder, faithful
grey frame, float right at `≥ lg`) — restated here only where #105 changes something.

### 3.1 Cladograms — `table.clade` (carried from #104, now drawn by reused page CSS)

The headline #104 fix, unchanged as a *target*; the only change is provenance. "Legible tree" = the reader
sees an actual **branching diagram**:

- **Branch lines drawn and connected.** The tree is painted by per-cell borders — vertical segments (a
  cell's left/right border) and horizontal segments (a cell's bottom border) that **join at fork points**
  into the classic right-angled bracket tree. Faithful rendering shows these as **thin (~1px) solid dark
  lines** that visibly **connect** ancestor to descendants — no gaps, no absent lines, no disconnected
  fragments. The lines take their color from `currentColor` (the article ink `#2c2c2c`) on the white
  column, which clears AA ≥ 3:1 for a meaningful boundary (§6).
- **Indentation / hierarchy.** Each nested clade steps **right** from its parent; sibling taxa align on a
  shared vertical line dropping from their common node; terminal taxa (leaf labels) sit at the right,
  vertically aligned where Wikipedia aligns them.
- **Leaf content faithful.** Italic binomial labels and the small (~60px) thumbnail illustrations beside
  selected taxa render at Wikipedia's size and position; labels are not clipped.
- **Containment.** The tree never widens the two-column shell; a deep/wide tree scrolls horizontally inside
  its own contained, keyboard-scrollable region (§4), with the "Scroll table →" hint (§5) on real
  overflow.

**Fail:** nested grey-bordered boxes, a flat list, or disconnected/absent branch lines → **AC1 fail**.
Legibility of the tree shape is the pass/fail test. (Verify with **no** `app/globals.css` clade port
present — the styling must come from the reused, scoped `Template:Clade/styles.css`.)

### 3.2 `.tmulti` multi-image montages — `Template:Multiple image` (new in #105, subsumes #91)

A montage is the captioned multi-photo block Wikipedia places at the top of many articles (the Cat
montage is the reference). Faithful means:

- **Intended grid/row layout.** The images lay out in their **intended grid or row** (`.tmulti .trow` is a
  row; `.tmulti .tsingle` cells sit inline-block within it), at the widths the montage sets — not a broken
  single-column stack of full-width images. A two-up row reads as two images side by side; a 2×2 grid reads
  as a grid.
- **Captions present and placed.** Each image keeps its **caption** (`.tmulti .thumbcaption`), left-aligned
  beneath/within its cell as Wikipedia places it, in the small grey caption style; the overall montage
  caption (if any) renders beneath the block.
- **Frame & spacing.** The montage sits in the faithful Wikipedia thumb frame (grey hairline on `#f8f9fa`),
  with Wikipedia's inter-image spacing; it floats/stacks per §4 like other boxes.

**Fail:** a broken vertical stack of full-width images, unstyled cells, missing captions, or images
overflowing the column → **AC2 fail**. (Verify with **no** bespoke `.tmulti` CSS authored by us — the
layout comes from the reused, scoped `Template:Multiple image` styles. This is the #91 family, now covered
with zero bespoke CSS.)

### 3.3 Long-tail styled table — a held-out unfamiliar TemplateStyles table (the scaling proof)

This is the surface that proves the per-template tax is gone. The held-out article (chosen by Dev/QA at
build time per spec A3 — an English Wikipedia article carrying a TemplateStyles-driven table from a
template family **never** hand-styled in #74/#104/#91, and **not** a build reference article) must render
its table faithfully **with zero new per-template CSS rules added for it.**

- **Layout matches Wikipedia, modulo our column.** The table's intended structure — column groups,
  alignment, header shading, cell borders, row/section spacing, any internal grid the TemplateStyles set —
  matches Wikipedia's rendering. The only general delta is **width**: where Wikipedia is wider than our
  column, the table is proportionally narrower and, if it still exceeds the column, scrolls within its
  contained region (§4) rather than widening the shell.
- **Header cells** — Wikipedia's header shading (`#eaecf0` family) and weight, alignment per the source.
- **Borders** — thin grey cell borders (`--color-wikirule` `#a2a9b1` family), as the table's own CSS sets.
- **No invented embellishment** — render only what the reused CSS applies. Do not add zebra striping,
  Indigo accents, or any treatment the source table did not have (§6, AC8). Match, don't decorate.

**Fail:** the held-out table is unstyled/garbled vs. Wikipedia, **or** reaching fidelity required authoring
any new per-template rule → **AC3 fail**. The "zero new rules" clause is as load-bearing as the visual
clause — this AC is the proof that the reuse path covers a template it was never tuned against.

## 4. Responsive behavior (AC9)

Web-first, responsive. `lg` = the existing **`1023px`** breakpoint already used for the column stack
(`@media (max-width: 1023px)` in `app/globals.css`). Three width bands, one rule each:

- **Desktop (`≥ lg`, viewport ≥ 1024px).** Infobox and taxobox **float right within the article column**
  (the existing `float:right; width:320px; max-width:42%` for `table.infobox`/`.biota`). Cladograms,
  `.tmulti` montages, and wide tables sit in the body flow; if a tree/table is wider than the column it
  scrolls within its **own contained region**, never widening the shell.
- **Tablet & mobile (`< lg`, viewport ≤ 1023px).** Infobox and taxobox **stack full-width in the article
  flow** (`float:none; width:100%; max-width:100%`) — a narrow float in a single narrow column is
  unreadable, so the stack is required, not optional. Wide tables and wide cladograms/montages **scroll
  horizontally within their own contained, keyboard-scrollable region** — the established
  `overflow-x:auto` containers: `.wiki-tablewrap` for tables, `.wiki-clade` for trees, and the equivalent
  contained wrapper for `.tmulti` montages. The reflow must **not** break the montage into a broken stack;
  it scrolls as a unit.
- **At every width.** The **article body and the two-column shell never scroll horizontally** — only the
  contained regions do. **Banner rows stay centered and grey-shaded at both breakpoints** (the banner
  rules are not breakpoint-scoped; stacking full-width must not relax the banner treatment — this is the
  bug the #74 banner rule fixed, preserved here).

A wide montage gets the **same containment + overflow-hint pattern** as wide tables and trees: if its
contained region overflows, it scrolls and shows the §5 hint; it never widens the shell.

## 5. Microcopy

Reuse the established pattern — **do not invent new copy.**

- **Wide-region scroll affordance:** the exact text **`Scroll table →`**, rendered by the existing
  `[data-overflow]::after` CSS hint at `0.7rem` in `--color-muted` (`#717171`), shown **only** when the
  contained region actually overflows (a client effect sets `data-overflow` on the wrapper after layout —
  CSS cannot detect overflow). This already serves `.wiki-tablewrap` and `.wiki-clade`; apply the **same**
  hint, same wording, to any `.tmulti` montage that lands in a horizontal-scroll region. It is
  **text-labeled, never color/glyph alone** (AC8), and it is the keyboard/touch scroll affordance. The
  word "table" reads acceptably for a tree/montage region too; keep the one established string rather than
  fork per surface. No other microcopy is introduced by this work.

## 6. Accessibility (AA — baseline, verified) (AC8)

- **Contrast.** Body text in tables/infoboxes/cladograms/montages ≥ **4.5:1** against its background; large
  text and **meaningful boundaries** (cell borders, banner hairlines, clade branch lines) ≥ **3:1**. The
  grey banner (`#eaecf0`) and the white column both clear 4.5:1 for the dark ink (`#2c2c2c`) sitting on
  them; clade branch lines use `currentColor` (ink on white) which clears the 3:1 boundary bar; cell
  borders are the `--color-wikirule` (`#a2a9b1`) family. **If a recovered Wikipedia color fails contrast in
  our column, ink/border is darkened to pass rather than shipping the failing color.** (Per §1, the
  taxon-band color is not recovered here, so the only banner background to verify is `#eaecf0`, which
  passes.)
- **No information by color alone.** A banner's "this is a banner / section divider" signal must survive in
  **greyscale**: it is carried by **position, bold weight, the hairline, and the heading text** — never by
  a band color. This is *why* the neutral-grey banner (§1, delta 1) is acceptable: the structure was never
  color-dependent. Likewise a montage's structure (which caption belongs to which image) is carried by
  layout and caption text, not color; a table's header/data distinction by shading **and** weight/scope,
  not color alone.
- **Keyboard-scrollable regions.** Every horizontal-scroll container (wide table `.wiki-tablewrap`, wide
  tree `.wiki-clade`, wide montage wrapper) is reachable and scrollable by keyboard, with the project's
  **visible focus ring** (`:focus-visible` → `3px solid var(--color-brand)`) on the scroll region. Do not
  trap; do not remove the outline. (The focus ring is wiki+ chrome on a scroll container, not article
  styling — it is permitted as the standard focus affordance and is the one indigo that may touch a
  container's outline, consistent with the existing wide-table region.)
- **Images keep `alt`.** Taxobox lead images, clade thumbnails, and montage images retain their `alt` text
  through the reuse path (the reuse changes styling, not the sanitized DOM's `alt` attributes).
- **Structure preserved.** `th scope`, `caption`, and table semantics that survive sanitize are not
  stripped or overridden by the styling; a screen reader still reads the rank ladder as a table and the
  montage as its image group.

## 7. The no-Indigo boundary (hard) (AC8)

This is the governing constraint and the thing most likely to slip when you load a third-party stylesheet,
so it is restated as a contract.

- **Faithful-Wikipedia zone = the entire article column** (everything under `.wiki-body`). Tables,
  infoboxes, the taxobox, cladograms, montages, captions, hairlines, link blue — all keep Wikipedia's own
  visual language. This column is "the Wiki world" (`TOPIC_PAGE_DESIGN.md`).
- **Indigo Press is allowed nowhere in this column.** No `brand #676eb4`, no `sprout #2a8270`, no
  `action #1f6f95`, no gold `#e5ab28`, no hardbox 2px-ink border, no offset drop-shadow, no Indigo fonts.
  Box frames stay **faithful Wikipedia grey** — `--color-wikirule` (`#a2a9b1`) hairline on `#f8f9fa`, band
  grey `#eaecf0` — never indigo. The **only** indigo that may appear in the column is the standard
  `:focus-visible` ring on a keyboard-focused scroll region (§6) — a global a11y affordance, not article
  styling.
- **Scoping is a release gate, not a nicety.** Every rule the reuse path applies is confined under
  `.wiki-body` (the spike's `css-tree` descendant-prefix mechanism). The evaluator inspects the **＋plus
  rail, the wiki+ panel, the TOC, the General strip, the projector header, the player modal, and the
  pinned candidate dock** at a wide viewport, at scroll-top and scrolled: **a single changed pixel of
  wiki+ chrome fails this.** (The *security* proof that the scoping holds against crafted CSS — AC4–AC7 —
  is QA's X4 release gate per the spike §4.6/§9; UX asserts the *visual* boundary only.)

## 8. Every state

| State | Behavior |
|---|---|
| **Populated (styled)** | The §3 targets render — clade tree, `.tmulti` montage, taxobox/infobox, and the held-out long-tail table — drawn by the reused, scoped TemplateStyles. This is the bulk of the work and the evaluation. |
| **No-styled-content article** | An article with no cladograms/montages/styled tables/infoboxes renders **exactly as today** — the reuse path is a **no-op**: no empty `<style>` artifact, no stray rule, no layout shift, no extra wrapper. This is an explicit pass condition: loading the page's CSS adds nothing when there is nothing to style (the scoper returns `""` and the apply component mounts nothing). Verify on a table-light/no-table article (e.g. `Pythagorean_theorem`). |
| **Loading** | **Unchanged** — the existing article-fetch loading skeleton is out of scope; reference current behavior, do not redesign. The reused stylesheet must not leave styled tables permanently unstyled; a brief unstyled moment before the one scoped `<style>` mounts is acceptable, a persistent unstyled table is not. |
| **Error (article fetch fails)** | **Unchanged** — the existing article-error state stands; this work does not touch it. |
| **Wide-region overflow** | The §5 `Scroll table →` text hint appears **only** on real overflow (`data-overflow` flag), on the contained table/tree/montage region. Text-labeled, never color/glyph alone. |

## 9. Acceptance / evaluation checklist (maps to spec AC1–AC11)

The Phase-4 UX evaluation is mechanical against this list. **Evidence:** render the **standard screenshot
matrix** (`scripts/dev/shots.sh` — logged-out/logged-in × widths × states across home + Topic) on the
**Cat** Topic page (clade + taxobox + `.tmulti`), plus a spot-check on the **named held-out article**
(long-tail table) and on **Lion** (taxobox) and a table-heavy article, at a **wide (`≥ lg`)** and a
**narrow (`< lg`)** viewport. This reproducible set is also the PR gallery.

- [ ] **AC1 / §3.1 — Cladograms legible.** Connected ~1px dark branch lines + stepped indentation visible;
  reads as a branching tree, not collapsed/borderless nested boxes or a flat list. Drawn by reused scoped
  clade CSS with **no `app/globals.css` clade port present**. (Headline — if not legible, fail.)
- [ ] **AC2 / §3.2 — `.tmulti` montages faithful.** Images in their intended grid/row with captions; not a
  broken full-width stack; faithful grey thumb frame; **no bespoke `.tmulti` CSS authored by us.**
- [ ] **AC3 / §3.3 — Held-out table faithful, zero new rules.** The named, never-tuned TemplateStyles table
  renders faithfully (layout matches Wikipedia, modulo column width) with **zero** new per-template CSS.
  Both clauses checked — visual fidelity **and** that no new rule was authored.
- [ ] **§1 — Accepted deltas present and correct (not failures).** Taxobox/infobox banners are **neutral
  grey `#eaecf0`** (taxon-band color *not* recovered — Issue B); no `url()` background images; boxes
  proportionally narrower. None of these is filed as a defect.
- [ ] **AC8 / §7 — No Indigo bleed.** No Indigo color/treatment anywhere in the article column; box frames
  faithful grey on `#f8f9fa` with the `--color-wikirule` hairline; the only indigo permitted is the
  `:focus-visible` ring on a focused scroll region. **The ＋plus rail, wiki+ panel, TOC, General strip,
  projector header, player modal, and candidate dock are pixel-unchanged** at scroll-top and scrolled,
  wide and narrow.
- [ ] **AC8 / §6 — AA.** Body contrast ≥ 4.5:1, large text + boundaries (cell borders, banner hairlines,
  clade branch lines) ≥ 3:1; banner signal survives in greyscale (carried by position/weight/hairline/
  heading text, no color-alone); scroll regions keyboard-reachable with the visible focus ring; taxobox/
  clade/montage images keep `alt`; `th scope`/`caption` semantics preserved.
- [ ] **AC9 / §4 — Responsive containment.** Infobox/taxobox stack full-width below `lg`; cladograms,
  `.tmulti` montages, and wide tables scroll horizontally within their own contained region below `lg`;
  the article body and two-column shell **never** scroll horizontally at any width; banners stay
  centered+grey-shaded at both breakpoints.
- [ ] **§8 — States.** No-styled-content article is **artifact-free** (reuse path is a no-op); loading &
  error states unchanged; the `Scroll table →` text hint appears **only** on actual overflow, on table,
  tree, and montage regions.
- [ ] **AC11 — No regression (visual).** Math (SVG fallback), citation popover, hatnotes, figures,
  scroll-sync highlight, TOC, section anchors, and wikilink routing on Cat and on `Photosynthesis` /
  `Cellular_respiration` / `Lion` / `Pythagorean_theorem` look and behave as before. (The functional/test
  side of AC10–AC11 and the X4 security gate AC4–AC7 are QA's, not UX's.)

> **Out of this contract's scope (other roles own):** AC4–AC7 (the X4 anti-XSS re-proof for the CSS-block
> boundary — `url()` exfil, off-column overlay, `@import`, scope escape, and the `</style>`-injection
> application-path vector) are a **security release gate verified by QA & Review** per the spike §4.6/§9,
> not by UX. UX asserts the *visual* no-Indigo boundary (§7) and the fidelity/responsive/AA targets only.
> The mechanism (`css-tree` scope+strip, `textContent` application) is fixed by the spike — Dev implements
> against it; this contract does not re-open it.
