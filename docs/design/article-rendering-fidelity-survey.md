# Article rendering fidelity — cross-article survey + infobox/taxobox design contract

- **Issue:** #74 — *Improve Wikipedia article rendering fidelity — survey diverse articles, fix the
  infobox/taxobox layout.*
- **Status:** Phase-2 UX artifact (discovery + buildable design contract), written **before**
  implementation as the input to Development. Two parts: **Part 1** is the divergence survey/catalog
  (a primary deliverable of the issue); **Part 2** is the buildable fidelity contract for the
  in-scope items.
- **Baseline read:** `docs/design/article-fidelity.md` (the contract that restored
  citations/tables/infobox/math/tail — esp. **§4.3** the two infoboxes, **§4.4** strip list + routing),
  `docs/TOPIC_PAGE_DESIGN.md` ("The two worlds", "Two infoboxes"), `docs/ARCHITECTURE.md`
  ("Article rendering (client-side)" — the DOMPurify allowlist + the **X4** XSS guarantee), `CLAUDE.md`
  (Indigo Press palette + accessibility baseline). Grounded in the current behavior of
  `lib/wiki/article.ts` (`wrapTables`, `stripChrome`, `cleanFigures`, `cleanMath`, `prepHatnotes`) and
  `app/globals.css` (the `.wiki-infobox` / `.wiki-table` / responsive block, ~L380–495).
- **Hand-off:** Development implements the Part 2 contract; QA & Review verifies correctness (incl. the
  unchanged X4 sanitize tests); UX evaluates the built UI against this contract.

> **The governing principle (unchanged).** The **left article column IS the encyclopedia.** It keeps
> **Wikipedia's visual language** — serif headings, hairline rules, `#3366cc` wikilinks, the grey
> figure frame, the grey infobox. **No Indigo Press identity (`#676EB4` brand, the hardbox border +
> offset shadow) crosses into the article column.** The wiki+ panel (right rail, indigo) and the
> Wikipedia infobox (left column, grey) are two different objects in two different grid columns
> (`docs/design/article-fidelity.md` §4.3); #74 touches **only** the Wikipedia infobox in the left
> column.

---

## 0. The root cause in one paragraph

The article-fidelity pass (`#24–#27`) restored `table.infobox` and re-applied **one generic CSS
approximation** to every infobox: float-right, `width: 320px`, grey `th`, **left-aligned `th`**,
centered caption. Wikipedia ships each infobox's real layout in **inline `style` attributes and
TemplateStyles**, both of which the sanitizer **deliberately strips** (the X4 anti-XSS guarantee — see
ARCHITECTURE "Article rendering"). Stripping is correct and must not change. The defect is that the
**one** generic rule that stands in for the stripped styling fits a *modern, semantically-classed*
infobox tolerably but **mangles the classless taxobox shape**, where the title bar, the section
dividers, and the box width all come from inline style alone. The survey below confirms this is the
single root cause across the infobox long tail, and Part 2 specifies a **structure-keyed** CSS target
that reaches faithful layout **without re-allowing any inline `style`**.

---

# PART 1 — Survey + divergence catalog

## 1. Articles surveyed

Six articles spanning size and topic. wiki+ render = the live site (`https://wikiplus.wikiedu.org`,
reflecting `main`, which this worktree branches from — so it IS the current baseline). Reference =
`https://en.wikipedia.org/wiki/<Title>`. Parsoid structure = the REST `page/html` payload (the exact
classes/inline-style wiki+ receives, before sanitize). Screenshots are in
`docs/design/article-rendering-fidelity-survey-shots/`.

| # | Article | Size / shape | Infobox class (Parsoid) | Why chosen |
|---|---|---|---|---|
| 1 | **Dendrobium kingianum** | ~78 KB, small | `infobox biota` (**taxobox**) | The spotted bug; the anchor case. |
| 2 | **Marie Curie** | ~778 KB, large bio | `infobox biography vcard` | Person infobox (`vcard`, semantic classes). |
| 3 | **San Francisco** | ~1.7 MB, very large | `infobox ib-settlement vcard` | Place/settlement: map, coords, sub-headers, multi-image. |
| 4 | **Lion** | ~1.1 MB, large + math/tables | `infobox biota` (**taxobox** w/ temporal-range timeline) | Second taxobox; large, table/image-heavy; data tables. |
| 5 | **Petrichor** | ~124 KB, short | *(no infobox)* | Short article, no-infobox content-absent case. |
| 6 | **Aagaard Glacier** | ~81 KB, small | `infobox vcard` | Small geography stub with a minimal modern infobox. |

**Evidence captured (`…-shots/`):**

- `01-topic-Dendrobium-kingianum-desktop.png` / `01-https-en-wikipedia-org-wiki-Dendrobium-kingianum.png` — wiki+ vs Wikipedia, the anchor taxobox (`lg+`).
- `05-topic-Dendrobium-kingianum-mobile.png` — the taxobox at `< lg` (stacked, 760px viewport).
- `02-topic-Marie-Curie.png` / `02-https-en-wikipedia-org-wiki-Marie-Curie.png` — wiki+ vs Wikipedia, modern `vcard` bio.
- `03-topic-San-Francisco.png` — settlement infobox + multi-image.
- `04-topic-Lion.png` — second taxobox (temporal timeline) + data tables.
- `01-topic-Petrichor.png` — no-infobox short article.

**The decisive structural finding** (from the Parsoid HTML, not a guess): the *modern* infoboxes carry
**semantic Parsoid classes** on every cell — `infobox-above` (title), `infobox-header` (section
divider), `infobox-subheader`, `infobox-image`, `infobox-caption`, `infobox-label` (the `th
scope="row"` key), `infobox-data` (the value), `infobox-full-data`. The **taxoboxes carry NONE of
these** — they are raw `<th colspan="2">` / `<td>` pairs whose every visual cue (centering, the
taxon-colored band, the `200px` width) lives in inline `style` that sanitize strips. They do carry
`tr.taxonrow`, `div.species`, `span.binomial`, and `.taxobox-edit-taxonomy` hooks. **This class
divergence is the whole bug:** the generic rule's `th { text-align: left }` is right for a modern
`infobox-label` key cell but wrong for a taxobox's centered title/section `<th colspan="2">` bar.

> **Evidence limitation (stated honestly).** `WebFetch` markdownifies and would erase the class/style
> detail, so structural analysis was done on the **raw Parsoid HTML** (`curl` of the REST
> `page/html` endpoint — the exact bytes wiki+ sanitizes). Screenshots were rendered with
> `scripts/dev/shoot.sh` against the **live `wikiplus.wikiedu.org`** (current `main` baseline) and
> against Wikipedia. The taxon-band **colors** in the Wikipedia reference shots come from inline style
> Wikipedia serves to its own page; wiki+ legitimately cannot reproduce those exact colors (see the
> known limit in §0 and Part 2 §C). No evidence is fabricated.

## 2. Divergence catalog

Severity: **High** = the box reads as broken / mis-structured to a reader; **Med** = noticeably less
faithful but still legible; **Low** = cosmetic. Disposition: **In-scope-now** vs **Follow-up** (file
as a linked issue).

### 2.1 Infobox / taxobox layout (the anchor)

| ID | What breaks | Root cause | Severity | Disposition |
|---|---|---|---|---|
| **D1** | **Taxobox title bar** ("Pink rock orchid") is **left-aligned and unshaded**; on Wikipedia it is a **centered banner** at the box top. | The classless taxobox title is a raw `<th colspan="2" style="text-align:center;background-color:…">`. The `style` is stripped (X4 — correct); the generic `.wiki-infobox th { text-align:left }` then forces it left. | **High** | **In-scope** |
| **D2** | **Taxobox section dividers** ("Conservation status", "Scientific classification", "Binomial name", "Synonyms") render as **left-aligned blue links indistinguishable from data rows** — they should be **centered banner rows** separating the box into sections. | Same: classless `<th colspan="2" style="text-align:center;background-color:…">` section headers; style stripped; generic `th` rule mis-aligns them; nothing marks them as dividers vs. the key/value rows. | **High** | **In-scope** |
| **D3** | **Box width** is forced to **320 px**; Wikipedia's taxobox is **~200 px** (it ships `width:200px` inline). The over-wide box stretches the taxonomy rows and looks unlike Wikipedia. | The generic `.wiki-infobox { width:320px }` overrides the (stripped) inline `width:200px`. 320px suits a dense modern infobox, not a narrow taxobox. | **Med** | **In-scope** |
| **D4** | **Taxon-colored bands** (the green `rgb(180,250,180)` on Dendrobium / olive on Lion) are **absent** — the title/section banners have no fill. | The band color is inline `style` Wikipedia ships per-taxon; sanitize strips it (X4). It is **not recoverable** without re-allowing inline style. | **Med (known limit)** | **In-scope: render a *neutral grey* band so the banner structure reads; the exact per-taxon color is explicitly NOT the bar for "done"** (see Part 2 §C). |
| **D5** | The **taxonomy hierarchy rows** (Kingdom: Plantae … Species: *D. kingianum*) read acceptably *today* (plain `td`/`td`), but the key column ("Kingdom:", "Clade:") and value column are not visually distinguished and the rank labels lose the italic on clade ranks. | These are raw `<td>`/`<td>` in `tr.taxonrow`; the italic clade label comes from `<i>` in the source (kept) but the key/value column treatment is generic. | **Low–Med** | **In-scope (light): left-align the key/value rows, keep the kept `<i>`; no heavy restyle.** |
| **D6** | The **"edit this classification" pencil icon** (`.taxobox-edit-taxonomy`) shows as a stray icon in the "Scientific classification" header — it is a Wikipedia editing affordance with no meaning in wiki+. | A `span.taxobox-edit-taxonomy` Parsoid emits; not in the strip list. | **Low** | **In-scope (strip it — it is editor chrome, like `.mw-editsection`).** |

### 2.2 Modern infoboxes (vcard / settlement / biography)

| ID | What breaks | Root cause | Severity | Disposition |
|---|---|---|---|---|
| **D7** | Modern infoboxes (Marie Curie, San Francisco, Aagaard Glacier) **render largely faithfully** — title centered, key/value rows aligned — because their semantic `infobox-*` classes degrade gracefully under the generic CSS. Minor: the title (`infobox-above`) and section headers (`infobox-header`) are not explicitly centered/shaded, so they're slightly flatter than Wikipedia. | The generic rule happens to suit `infobox-label`/`infobox-data`; `infobox-above`/`infobox-header` are not specifically styled. | **Low** | **In-scope (cheap win): add `infobox-*`-keyed rules so titles/headers center + shade, since the same structure-keyed approach covers them.** |
| **D8** | **Settlement sub-headers** (`infobox-subheader`, e.g. "Consolidated city-county" under "San Francisco") render as plain left text, not the centered sub-caption Wikipedia shows. | `infobox-subheader` not styled. | **Low** | **In-scope (covered by the `infobox-*` rules).** |
| **D9** | **Multi-image montages** at the infobox top (San Francisco's collage) **stack vertically as separate images** instead of the gridded collage. | The collage layout is pure TemplateStyles (`.tmulti .trow{display:flex}` etc.) stripped at sanitize; the images survive but un-gridded. | **Low** | **Follow-up** (a distinct TemplateStyles-layout problem, not the infobox-frame bug; see §3). |
| **D10** | **Geo-coordinates / map** in the settlement infobox: the coordinate string renders; the locator **map image** renders if present but any pushpin overlay (absolutely-positioned via inline style) collapses. | Pushpin overlays are inline-`style`-positioned; stripped. | **Low** | **Follow-up.** |

### 2.3 Tables, math, and the rest of the column (confirmed still-faithful or pre-tracked)

| ID | What breaks | Root cause | Severity | Disposition |
|---|---|---|---|---|
| **D11** | **Data tables** (Lion's tables, Petrichor's) render faithfully (grey `th`, hairline borders) and wide ones scroll in `.wiki-tablewrap`. No new break found. | — | — | **No action** (working per `article-fidelity.md` §4.1/§4.2). |
| **D12** | **Wide-table overflow hint** (`Scroll table →`) has a known **race** where the `data-overflow` flag can lag layout. | Pre-existing; tracked in **#68**. | Med | **Out of scope** (issue #74 defers to #68 unless same root cause — it is not). |
| **D13** | **Math** (Lion, science topics) renders the SVG fallback faithfully, inline + display. No new break. | — | — | **No action** (working per `article-fidelity.md` §5). |
| **D14** | **`wikitable`-class data tables** that themselves carry per-cell `background` (e.g. colored comparison cells, conservation-status color keys) lose the cell colors. | Per-cell `background` is inline style; stripped (X4). | **Low** | **Follow-up** (same class of "inline-style color lost" as D4; cataloged, not fixed). |

## 3. Follow-up issues to file (deferred tail)

Each links back to this catalog. None weakens X4; all are deliberately out of this run because they
are a *different* root cause (TemplateStyles flex layout, or per-cell inline-color loss) than the
infobox-frame bug #74 fixes.

1. **Multi-image infobox montages render un-gridded (D9).** The `.tmulti` collage relies on stripped
   TemplateStyles flex rules. Decide whether to approximate a simple stacked/2-up grid via class-keyed
   CSS. Med-low priority.
2. **Locator-map pushpin overlays collapse (D10).** Absolutely-positioned pin overlays use inline
   style. Low priority; the base map + coordinate text still read.
3. **Per-cell colored table backgrounds lost (D14).** Conservation-status keys, colored comparison
   cells. Same "inline-style color lost" family as the taxon bands. Low priority; consider a small
   class-keyed palette only if a high-traffic topic needs it.
4. *(Reference only — already tracked)* **Wide-table overflow-hint race (#68).** Not re-filed; noted
   so the catalog is complete.

---

# PART 2 — Buildable fidelity design contract (in-scope items)

This is the contract Development builds to. It specifies **what faithful looks like and how each
element is structured** — not the sanitizer mechanism. The issue offers three mechanisms: **(a)
WP-class-keyed CSS in `globals.css` mirroring the common infobox/taxobox structures (no allowlist
change — the recommended, safest option)**, (b) a tightly-restricted layout-only inline-`style`
allowlist, (c) structural normalization in `article.ts`. **This contract is fully reachable via option
(a)** — every target below keys off a Parsoid class or element type that survives sanitize; **none
requires re-allowing inline `style`**. Dev records the chosen mechanism + rationale in
`docs/ARCHITECTURE.md` "Article rendering" and/or `article-fidelity.md`. **Whatever the mechanism, the
X4 sanitize tests stay green and `style`/`<style>`/`<script>`/`<math>`/`<svg>` stay disallowed.**

## A. What "faithful" means structurally — the common infobox shapes

### A.1 The taxobox (`table.infobox.biota`) — the anchor

Faithful structure, top to bottom (matching the Wikipedia reference shot
`01-https-en-wikipedia-org-wiki-Dendrobium-kingianum.png`):

1. **Title bar** — the first row, a `<th colspan="2">` (the taxon common name, e.g. "Pink rock
   orchid"). Target: **full-width banner, horizontally centered, bold, shaded band, with a hairline
   below.** Reads as the box's heading.
2. **Image cell + caption** — a `<td colspan="2">` holding the lead image, then a `<td colspan="2">`
   caption. Target: **image centered, full box width, `max-width: 100%`; caption centered, small grey
   type** (reuse the figure-credit type scale, `~0.78–0.82rem`, `var(--color-ink2)`). Commons
   credit/license per `article-fidelity.md` §4.5 (unchanged).
3. **Section divider rows** — each is a `<th colspan="2">` ("Conservation status", "Scientific
   classification", "Binomial name", "Synonyms"). Target: **centered, bold, shaded banner spanning the
   full width** — visually identical to the title bar's band so a reader sees the box partitioned into
   labeled sections, exactly as on Wikipedia. **This is the most important single fix (D1/D2):** these
   must NOT look like the data rows.
4. **Taxonomy hierarchy rows** — `tr.taxonrow` with a `<td>` rank key ("Kingdom:", "Clade:", "Order:")
   and a `<td>` value (the linked taxon, italic for clades/genus). Target: **two left-aligned columns**
   — key column not bold (Wikipedia doesn't bold them), value column links route via `rewriteLinks`
   (unchanged). Keep the source `<i>` italics. Tight vertical rhythm (`~2px 4px` cell padding) so the
   ladder reads compactly like Wikipedia.
5. **Binomial / synonym blocks** — `<td colspan="2">` value cells under their section banners; the
   binomial centered and bold-italic (`span.binomial`/`div.species` carry the hooks), the synonyms a
   left-aligned `<ul>`. Target: keep the source emphasis; render the list as an ordinary infobox list.
6. **Strip the edit affordance (D6):** remove `span.taxobox-edit-taxonomy` (and any
   `a[title="Edit this classification"]`) — it is editor chrome with no function in wiki+, same family
   as `.mw-editsection`. Add it to the `stripChrome` list.

**Width (D3):** the taxobox should be **narrower than the dense modern infobox** — target **~`width:
22em` / `max-width: 320px`** at `lg+` so it matches Wikipedia's slim taxon column rather than the
320px modern-infobox width. (A fixed `200px` is too rigid once the float frame and our font apply;
`22em`/`max 320px` reads faithfully and still floats cleanly. Dev may tune within "visibly slimmer
than a vcard infobox.")

### A.2 The generic / modern infobox (`infobox-*` semantic classes — vcard, settlement, biography)

These already render acceptably (D7); the contract makes the title/header rows faithful, keyed off the
**semantic classes** (all survive sanitize):

- **`.infobox-above`** (title) — centered, bold, larger (`~1.05rem`), shaded band, full width. The box
  heading.
- **`.infobox-subheader`** (e.g. "Consolidated city-county") — centered, smaller, muted; a sub-caption
  under the title (D8).
- **`.infobox-image`** + **`.infobox-caption`** — image centered full-width; caption centered small
  grey (same as taxobox image caption).
- **`.infobox-header`** (section divider, e.g. "Career", "Geography") — centered, bold, shaded band,
  full width — the modern equivalent of the taxobox section banner. Same treatment as `.infobox-above`
  minus the larger size.
- **`.infobox-label`** (the `th scope="row"` key) — left-aligned, bold-ish, top-aligned, the key
  column; **`.infobox-data`** / **`.infobox-full-data`** — left-aligned value column;
  `infobox-full-data` spans both columns (full width).
- Keep the box frame faithful: `border: 1px solid var(--color-wikirule)`, `background: #f8f9fa`,
  `font-size: 0.82–0.88rem`.

### A.3 The shared "banner" treatment (the unifying rule)

The taxobox title/section `<th colspan="2">` rows and the modern `.infobox-above` / `.infobox-header`
rows are **the same visual primitive**: a centered, bold, shaded, full-width banner. Specify it once:

- **Background:** the Wikipedia table-header grey already in the theme — **`#eaecf0`** (the same grey
  used by `.wiki-table th` and the current infobox `caption`). **Grey, never indigo** — this is the
  article column.
- **Text:** `var(--color-ink)` `#2c2c2c`, bold, **centered**. (`#2c2c2c` on `#eaecf0` ≈ 11:1 — far
  above AA; QA re-verifies.)
- **Full width** (the row already spans both columns via `colspan="2"` / the `infobox-above`/`-header`
  semantic).
- Hairline `border-bottom: 1px solid var(--color-wikirule)` to seat the band.

For the **taxobox**, target this banner via the **structural selector** that distinguishes a
section/title `<th colspan="2">` from a key `<th>` — e.g. `table.infobox th[colspan]` (taxoboxes use
`colspan="2"` only on the banners; key cells are plain `<td>`, so this does not catch data rows). Dev
confirms the exact selector against the live markup; the **outcome** is: banners centered+shaded, data
rows left-aligned. This is the precise fix for the current `th { text-align: left }` over-reach.

## B. Every responsive state (the "Done when" requires the taxobox faithful at both)

| Element | `lg+` (two-column; article = `1fr`, `min-w-0`) | `< lg` (single column, < 1024px) |
|---|---|---|
| **Taxobox / Wikipedia infobox** | **float-right** in the article column, **`width: 22em`/`max 320px`** (taxobox) or `320px`/`max 42%` (modern), `margin: 0.2em 0 0.8em 1em`, `clear: right` (shares the right-float lane with figures). | **Stacks full-width at the top of the lead**: `float: none; width: 100%; max-width: 100%; margin: 0 0 1em`. A narrow float is unreadable in a single narrow column. (Current behavior — keep.) |
| **Banner rows** (title/section) | centered, shaded, full box width | identical — centered, shaded, full column width |
| **Taxonomy / key-value rows** | two left-aligned columns | identical |
| **Image cell** | centered, `max-width: 100%` | centered, `max-width: 100%` (the box is now full-column, so the image is larger — fine, matches mobile Wikipedia) |

**Both infoboxes never collide on any breakpoint** (unchanged from `article-fidelity.md` §7/B4): at
`lg+` they are in different grid columns separated by the gap; at `< lg` the Wikipedia infobox is a
full-width block in the article flow and the wiki+ panel is in the collapsed rail below. The taxobox
fix changes only the *internal* layout of the left-column box; the no-collision guarantee stands.

**Verification anchor:** the `< lg` stacked taxobox is `05-topic-Dendrobium-kingianum-mobile.png`
today (banners left-aligned, no bands) → after the fix it must show centered, grey-shaded banner rows
at both `lg+` and `< lg`. This is the issue's explicit "Done when."

## C. The known limit, stated in the contract (taxon colors)

Wikipedia's taxon-colored banner bands (green for plants, etc.) and any per-cell infobox background
come from **inline `style` Wikipedia ships per taxon**. The sanitizer strips inline `style` (X4) and
**this run does not change that.** Therefore:

- **Faithful *structure* is the bar for "done," not pixel-exact taxon colors.** The banners render as
  **neutral Wikipedia grey (`#eaecf0`)** — the same grey every other infobox/table header uses. The
  reader sees a correctly *partitioned, centered, banded* infobox that reads as Wikipedia; the bands
  are grey rather than taxon-green.
- This is a **deliberate, recorded trade-off** (the issue's owner-level constraint: do not weaken the
  XSS guarantee). If a future run wants exact taxon colors, that is **option (b)** — a
  tightly-restricted, layout-only inline-`style` allowlist that must independently prove X4 holds — and
  is explicitly **out of scope here**. Dev records this in the architecture decision note.
- **Option (a) is reachable** for everything else in this contract (banners, alignment, width, image
  cell, key/value rows, sub-headers, edit-affordance strip) because each keys off a class or element
  structure that survives sanitize. The contract requires Dev to confirm option (a) reaches this
  target; only if it provably cannot (it can) would (b)/(c) be considered.

## D. No-Indigo-Press-bleed constraint (applied per element)

- **Banner background = `#eaecf0` (grey), never `#676EB4` (indigo)** or any brand/sprout/action color.
- **Banner/label text = `var(--color-ink)` / value links = `var(--color-wikilink)` `#3366cc`** — the
  Wikipedia palette, never indigo as a functional color.
- **Box frame = `1px solid var(--color-wikirule)` on `#f8f9fa`** — the hairline grey frame, **never**
  the hardbox `2px solid #2c2c2c` + `4px 4px 0` offset shadow that marks the wiki+ panel.
- No band, border, or shadow on the infobox may read as a +plus card. The only indigo anywhere near the
  article column remains the **shared site-wide `:focus-visible` ring** and the scroll-sync active-bar
  — both unchanged, both not infobox-specific.

## E. Accessibility (Dev builds to it; QA verifies)

Restating the CLAUDE.md baseline for the new infobox structure:

- [ ] **AA contrast:** banner text `#2c2c2c` on `#eaecf0` (≈11:1, verified — value, not a guess);
      key/value text `#2c2c2c` on `#f8f9fa`; value wikilinks `#3366cc` on `#f8f9fa` (≥4.5:1). QA
      re-runs the checks.
- [ ] **Never color alone:** a section banner is conveyed by **position + centering + bold + a hairline
      rule + the heading text**, not by the grey fill alone — so a reader who cannot perceive the grey
      band still sees a distinct, centered, bold, ruled heading row. (This is why the band loss in D4 is
      acceptable: the *structure* carries the signal.)
- [ ] **Semantics preserved:** the title row stays a `<th>` (a header), section dividers stay `<th>`,
      the key cells stay `<th scope="row">` (modern) / `<td>` (taxobox, per Wikipedia's own markup) and
      values `<td>` — Dev must not flatten the table semantics. A screen reader reads the infobox as a
      table with header cells.
- [ ] **Focus:** the global 3px indigo `:focus-visible` ring applies to every link inside the infobox
      (value wikilinks) — unchanged, inherited.
- [ ] **Keyboard:** infobox value links are ordinary `<a>` — tabbable and activatable. The infobox is
      not itself a scroll region (it floats / stacks; only wide *data tables* get the
      `role="region" tabindex="0"` wrapper, unchanged).
- [ ] **Image alt:** infobox images keep their Parsoid `alt`; the taxobox lead image's alt is preserved
      (don't strip it during the edit-affordance cleanup).

## F. Microcopy / labels

**No new affordance, copy, or label is introduced.** The infobox is faithful Wikipedia chrome: its
title, section headings ("Scientific classification", "Binomial name", "Synonyms"), and rank labels are
**Wikipedia's own text, kept verbatim**. The only removal is the non-functional "Edit this
classification" pencil (D6) — and removing it also removes its tooltip text, which is correct (it had no
function here). No wiki+ voice anywhere in the infobox.

## G. What Development should build (summary of the contract)

1. **Add the edit-affordance to `stripChrome`:** remove `.taxobox-edit-taxonomy` (and the
   `a[title="Edit this classification"]` it wraps) — editor chrome, like `.mw-editsection` (D6).
2. **Re-target the infobox CSS in `globals.css`** so the **one generic rule** becomes
   **structure-keyed** (option (a)):
   - A shared **banner** rule (centered, bold, `#eaecf0`, hairline) applied to **taxobox section/title
     `<th colspan>` rows** AND **`.infobox-above` / `.infobox-header`** (A.3).
   - **`.infobox-subheader`** centered sub-caption (D8); **`.infobox-image`/`.infobox-caption`** centered
     image + grey caption.
   - **Key/value rows** (`.infobox-label`/`.infobox-data`, and the taxobox `tr.taxonrow td`) **left-aligned** — replacing the over-broad `th { text-align: left }` that currently mis-aligns the banners (D1/D2/D5).
   - **Taxobox width** slimmer than a modern infobox (`~22em`/`max 320px`) (D3).
   - Keep the float-right `lg+` / full-width-stacked `< lg` responsive behavior (B) and the grey
     faithful frame (D).
3. **(Cheap win) the modern-infobox banner rules** (`.infobox-above`/`-header`/`-subheader`) — same
   structure-keyed approach, fixes D7/D8 in the same pass.
4. **Record the mechanism decision** (option (a)) + the taxon-color known-limit (C) in
   `docs/ARCHITECTURE.md` "Article rendering" and/or `article-fidelity.md`.
5. **Tests:** extend `test/article-fidelity.test.ts` for the new structure/class handling (taxobox
   banner vs. data-row distinction; `.taxobox-edit-taxonomy` stripped; `infobox-*` classes survive);
   **re-assert the X4 sanitize tests unchanged** (`style`/`<style>`/`<script>`/`<math>`/`<svg>` still
   dropped, no `style=` survives).
6. **File the follow-ups** (§3): multi-image montage (D9), locator-map pushpins (D10), per-cell table
   colors (D14) — each linked to this catalog.

**Out of UX's lane (Dev/elsewhere):** the sanitizer mechanism choice + the exact Parsoid selector
strings (verified against live markup); the X4 allowlist entries; the math/citation/table behavior
(unchanged). UX has resolved the in-lane questions: **option (a) is the reachable target**, the
**banner = grey `#eaecf0` centered** treatment, the **taxon-color = known structural-only limit**, and
the **responsive float/stack** behavior at both breakpoints.

---

## H. Evaluation (post-build, UX)

After Development ships, UX evaluates the running UI against this contract:

- **Fidelity:** does the Dendrobium taxobox read as Wikipedia — narrow box, **centered grey-banded
  title and section dividers**, left-aligned taxonomy ladder — at `lg+` **and** `< lg`? Compare to
  `01-https-en-wikipedia-org-wiki-Dendrobium-kingianum.png`. Same check on Lion (second taxobox).
- **Modern infoboxes** (Marie Curie, San Francisco, Aagaard Glacier) keep/improve their faithful
  layout; titles/headers now centered+banded.
- **No-bleed:** the infobox is unmistakably Wikipedia-grey, not a +plus indigo card; the wiki+ panel
  (right rail) is unchanged and never collides.
- **Content-absent:** a no-infobox article (Petrichor) renders no infobox and no empty band — unchanged.
- **A11y-in-practice:** banner rows read as headings (structure, not color); value links keyboard-
  reachable and focus-ringed; image alts intact.

Design defects route back to **Development**; a pass signals the infobox/taxobox fidelity meets intent.
