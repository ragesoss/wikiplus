# Spec: Mobile Wikipedia-article rendering

- **Status:** Draft for build-loop (Product) — GitHub issue #121
- **Owner:** Product
- **Inputs:** `docs/ARCHITECTURE.md` (§"Article rendering (client-side)" — incl. the new
  *"Mobile rendering — one fetch, reproduce mobile behaviors"* decision this spec implements);
  `docs/design/article-rendering-fidelity-survey.md` (the desktop infobox/taxobox/table fidelity
  contract this builds *on*, esp. Part 2 §B's responsive `lg+` / `< lg` states); `docs/VISION.md`
  ("What 'good' looks like"; web-first, non-goals); `docs/TOPIC_PAGE_DESIGN.md` ("The two worlds" —
  the article column IS the encyclopedia, faithful Wikipedia look); `CLAUDE.md` (accessibility
  baseline; "the Wiki article side keeps a faithful Wikipedia look"). Existing code:
  `lib/wiki/article.ts` (the single `page/html` fetch + sanitize + section walk — **unchanged**),
  `components/topic/ArticleBody.tsx` (`ArticleSections` / `ArticleLeadBlock` — where per-section
  disclosure attaches), `app/globals.css` (the `.wiki-body` / `.sec` article-column styling
  surface), `test/article*.test.ts` (the X4 sanitization invariants — must stay green).
- **Hand-off:** UX (personas/stories → flows + a buildable design spec for the mobile article
  column: the collapse affordance, type scale, touch targets, the responsive table/infobox states,
  and how the TOC behaves on a phone), then Development (CSS/JS in the article-column surface; no
  change to `lib/wiki/article.ts` or the allowlist). QA & Review verifies against the Acceptance
  criteria; UX evaluates the built mobile UI.
- **Coordinates with:** **#119** (skin system / dark Wikipedia side) — see §Coordination.

---

## Problem

On a phone, the Wikipedia article column does not read like **mobile Wikipedia**. wiki+ fetches
**desktop Parsoid HTML** (`/api/rest_v1/page/html/{title}`) and restyles it responsively, so on a
narrow screen the reader gets a desktop article squeezed down — every section expanded into one long
scroll, a type scale and touch targets tuned for a wide column — rather than the well-tuned mobile
experience Wikipedia itself serves to phones: **collapsible/expandable sections**, mobile-sized
infoboxes, horizontally-scrollable wide tables, comfortable touch targets and reading measure.

The desktop article column is good and is **out of scope** here (it is the product of #74 /
#104/#105 / #91–#93 fidelity work). The gap is specifically the **phone** experience of that same
column.

## User value

A reader who opens a Topic page on a phone gets an article that **feels native to the phone** — they
can scan section headings and expand only what they want to read, wide tables and infoboxes fit the
column instead of overflowing it, and text and tap targets are sized for touch. This protects the
core promise that the article column **is the encyclopedia, faithfully** — on a phone that means
*mobile* Wikipedia, the rendering hundreds of millions of readers already know. The curation layer
(TOC, scroll-sync, clip→section anchoring) keeps working in both layouts, so a mobile reader can
still reach the curated clips for any section.

## The architecture decision (recorded; states the central fork's resolution)

**Approach (b): keep the single desktop `page/html` fetch + the existing sanitize/rewrite/section-walk
pipeline, and reproduce mobile-Wikipedia *behaviors* in our own responsive CSS/JS, branched by
viewport.** We do **not** fetch `page/mobile-html` (the Page Content Service) and do **not** do
server User-Agent detection. The full rationale + trade-offs are recorded in `docs/ARCHITECTURE.md`
§"Article rendering" → *"Mobile rendering — one fetch, reproduce mobile behaviors."* In brief, from
direct inspection of both endpoints for the same article (Earthquake, Lion):

1. **Section anchors are identical across endpoints.** Heading `textContent` is byte-for-byte the
   same in `page/html` and `page/mobile-html`, and our kebab slugs derive from `textContent` — so
   keeping the desktop fetch keeps the **section-anchoring contract** (#8) stable *by construction*,
   with no re-derivation or mapping.
2. **The mobile-html collapse behavior is not free from the endpoint.** PCS implements collapsible
   sections and lazy images with a bundled **`<script>` runtime + inline `style="display:none"` +
   toggled classes** — precisely what the DOMPurify allowlist strips (X4). After sanitize the
   `mobile-html` DOM would arrive **fully expanded with no script**, so we would re-implement the
   collapse ourselves *anyway*. The endpoint buys a new DOM contract to maintain, not the behavior.
3. **`mobile-html` is a second, divergent DOM surface.** It carries PCS-specific structures
   (`pcs-ref-*` citations, `pcs-edit-section-*` chrome, `pcs-collapse-table`,
   `pcs-widen-image-ancestor`) that would need a parallel sanitize/strip/citation/section-walk path,
   while all existing fidelity work is tuned against desktop Parsoid output.
4. **No ISR cache-splitting.** The article is fetched and transformed **client-side**; one cached
   shell serves every device, and the mobile experience is a presentational branch in the browser.
   (Approach (a) would have forced device-class cache keys or UA sniffing.)
5. **Sanitization is unchanged.** No new HTML source, no allowlist change → X4 holds untouched.

## Scope decision: full build in this PR

Because approach (b) introduces **no new fetch/sanitize/section-walk path** — it is responsive
CSS plus a small client-side disclosure toggle over the *already-sanitized* per-section DOM — the
build is **not** the large second-fidelity-surface that the issue's scope-risk note flagged for
approach (a). Therefore: **land the full build in this PR** (architecture decision + the mobile
behaviors + tests + mobile screenshots). **No follow-up split is recommended** for the core
deliverable.

Two presentational refinements are *explicitly deferred* (they are not blockers for "reads as mobile
Wikipedia" and are cheap to add later — Product will judge whether to file): (i) a per-section
"expand all / collapse all" control, and (ii) animating the disclosure expand/collapse. The MVP
collapse is a plain, instant, accessible disclosure.

## Scope

**In scope** — the **mobile** (narrow-viewport) presentation of the Wikipedia article column:

- **Collapsible sections.** On a phone, each top-level (`h2`) section is a collapsible disclosure
  that starts **collapsed** (the lead stays open), expandable by tapping its heading — matching
  mobile Wikipedia. Nested `h3`/`h4` content lives inside its parent section. (Exact default-state
  and nesting behavior is a UX call within "reads like mobile Wikipedia"; see Open questions.)
- **Mobile type scale & touch targets.** Reading-comfortable body type and heading scale for a
  narrow column; the collapse affordance and any in-article controls meet a **≥44×44px** touch
  target; spacing tuned for touch.
- **Responsive tables & infoboxes on mobile.** Wide data tables scroll horizontally inside their
  existing `.wiki-tablewrap` region rather than overflowing the column; the Wikipedia infobox/taxobox
  stacks full-width at the top of the lead (the `< lg` state already specified in the fidelity survey
  Part 2 §B) — confirmed/kept faithful at phone widths.
- **The TOC on a phone.** The section list / table of contents remains usable on a narrow viewport
  and stays wired to the (unchanged) section anchors. (Its exact mobile presentation is UX's call.)
- The architecture-decision doc update (done in this spec's commit), the mobile-path tests, and the
  screenshot-baseline refresh for the article surface's **mobile** states.

**Out of scope** (do not touch in this build):

- **The desktop article column** — visually and behaviorally **unchanged**. The existing fidelity
  work (#74, #104/#105, #91–#93) stays exactly as-is.
- **The fetch / sanitize / link-rewrite / section-walk pipeline** in `lib/wiki/article.ts` — **no
  change**, no new endpoint, no DOMPurify allowlist change, no new inert attribute.
- **`page/mobile-html` (PCS)** — not fetched; rejected with rationale above.
- **Server User-Agent detection / device-class ISR cache-splitting** — not introduced.
- **The plus / curation surfaces** — the rail, the General strip, clip cards, players, candidate
  pipeline. Section-anchoring must keep working on mobile, but **its UI does not change here**; this
  is the *article column only*.
- **The #119 dark skin / skin system** — coordinate (see §Coordination) but do not build skinning.
- **Routing / resolution** — `titleToQid`, `/topic/<Title>` routing, redirects: unchanged.
- **Offline / PWA, article editing.**
- A per-section "expand/collapse all" control and disclosure animation (deferred — see above).

## Acceptance criteria (testable; map to the issue's "Done when")

Viewport thresholds: **"mobile" = a narrow/phone viewport** (the build chooses the exact breakpoint
in the article column's existing responsive system, e.g. `< lg` / a phone-width media query; UX
fixes the precise value). "Desktop/wide" = the wide two-column layout.

1. **AC1 — Collapsible sections on mobile.** On a phone-width viewport, each top-level (`h2`) article
   section renders as a **collapsible disclosure** that can be expanded and collapsed by activating
   its heading; sections start collapsed (the lead is shown). On a wide viewport, all sections render
   expanded as today (no disclosure). *(QA: render the article column at a phone width and assert a
   section's body is collapsed by default and toggles on heading activation; at a wide width assert
   all section bodies are present/expanded.)*

2. **AC2 — Section anchors unchanged.** The set of section **kebab slugs** produced for an article is
   **identical** to the current desktop set, byte-for-byte, for a sample of articles (at minimum:
   Earthquake, Lion, Marie Curie). No slug is added, removed, or renamed by the mobile path.
   *(QA: assert `fetchFullArticle(title).sections.map(s => s.slug)` is unchanged from the current
   baseline for the sample — the fetch/walk is untouched, so this must hold.)*

3. **AC3 — Curation still resolves on mobile.** On a phone-width viewport, the **TOC, scroll-sync,
   and clip→section anchoring (#8)** resolve to the correct section: activating a TOC entry / a
   clip's section anchor reveals (expanding the collapsed section if needed) and scrolls to that
   section. *(QA: with a section collapsed, navigating to its anchor expands and reveals it.)*

4. **AC4 — Wide tables and infoboxes fit the column on mobile.** On a phone-width viewport, a wide
   data table **scrolls horizontally within its region** rather than overflowing the article column
   or forcing the page to scroll sideways; the Wikipedia infobox/taxobox **stacks full-width** at the
   top of the lead (not a narrow float). *(QA: at a phone width, assert the article column does not
   overflow the viewport horizontally for an article with a wide table — e.g. Lion — and that the
   infobox is full-width-stacked.)*

5. **AC5 — Touch targets & type scale.** On a phone-width viewport, the section collapse affordance
   (and any in-article control introduced here) presents a touch target of **≥44×44px**, and the
   article body type is set at a reading-comfortable mobile scale. *(QA: measure the collapse
   control's hit area ≥44×44px; confirm body font-size/line-height match the mobile design spec.)*

6. **AC6 — Desktop column unchanged.** On a wide viewport, the article column is **visually and
   behaviorally unchanged** from the current baseline — same expanded sections, same fidelity
   (infobox/taxobox/table/math), no new collapse affordance. *(QA: compare the wide-viewport article
   screenshots to the current baseline; the existing desktop article screenshots in the gallery do
   not change.)*

7. **AC7 — Sanitization invariants hold (X4).** No `style` attribute, `<style>`, `<script>`,
   `<iframe>`, `<math>`, or `<svg>` survives into the rendered article; the existing
   `test/article*.test.ts` invariants pass unchanged, and **no DOMPurify allowlist change** was made.
   *(QA: the full `test/article*.test.ts` suite is green with no allowlist edit in the diff.)*

8. **AC8 — One fetch, no UA / cache split.** The build fetches **only** `page/html` (no
   `page/mobile-html`), branches the mobile presentation **by viewport** (client-side), and
   introduces **no** server User-Agent detection and **no** device-class ISR cache key. *(QA:
   grep the diff — no `mobile-html`, no UA-sniffing/`User-Agent`-keyed branch, no per-device cache
   variant; the mobile branch is CSS/JS over the existing client-fetched DOM.)*

9. **AC9 — Accessibility.** The collapse disclosure is **keyboard operable** (focusable, toggles on
   Enter/Space) and exposes correct ARIA disclosure semantics (`aria-expanded`, controls/labelled
   association), the expand/collapse state is conveyed by **more than color** (the heading text + a
   text/icon indicator), AA contrast is preserved, and `:focus-visible` shows the focus ring.
   *(QA: keyboard-toggle each section; assert `aria-expanded` reflects state and the control is in
   the tab order with a visible focus ring.)*

10. **AC10 — Mobile screenshots in the baseline.** The UI screenshot baseline gallery
    (`docs/design/ui-screenshots/`) includes the article surface's **mobile** states (collapsed + an
    expanded section; an article with a wide table/infobox at phone width), added as `Scene`(s) to
    `e2e/screenshots/catalog.ts`. *(QA: the new mobile scenes are present and rendered in the
    refreshed gallery.)*

## Coordination with #119 (skin system / dark Wikipedia side)

#119 (`status: ready`, not yet started) introduces a **skin system** for the Wikipedia side
(including a dark theme), which will also style the **`.wiki-body` / `.sec` article-column surface**.
This spec's mobile behaviors live in that same surface. To avoid the two CSS efforts fighting:

- Treat the article column as **one shared structure** with two orthogonal axes — **#119 = theme /
  color tokens** (light/dark), **this spec = layout / disclosure / type scale / touch** (mobile vs
  wide). They must compose: a collapsed section on mobile must render correctly in the dark skin, and
  the skin's tokens (background, text, rule colors) must apply to the collapse affordance.
- The mobile build should **not hardcode article-column colors** that #119 will tokenize; where a
  color is needed for the collapse affordance, use the existing article-column color variables/tokens
  (the same ones #119 will theme) rather than literals, so the dark skin themes them for free.
- UX should produce the mobile design spec **against the shared article-column structure** so Dev
  builds collapse + skin against one set of selectors/tokens, not two competing ones. Whichever of
  #119 / #121 lands first leaves the surface in a shape the other extends without rework.

This is a coordination note, not a dependency: #121 does not block on #119 and does not build
skinning.

## Success metric

**Primary:** A phone reader can reach and read any section of the article without a desktop-squeezed
scroll — operationalized as: on a phone-width viewport, **(a)** sections are collapsible and the
reader can expand a chosen section in one tap, **(b)** the article column **never scrolls
horizontally** (no overflow) on the survey articles, and **(c)** every section anchor still resolves
(TOC / clip→section) — all verified by QA across the sample articles (Earthquake, Lion, Marie Curie,
plus a no-infobox short article). The build "worked" when a mobile reader's path to a curated
section's clips is as direct as on desktop, on an article that reads as mobile Wikipedia rather than
a shrunk desktop page.

**Qualitative check (UX evaluation):** side-by-side, the wiki+ mobile article column reads
recognizably like mobile Wikipedia (collapsed sections, fitted tables/infoboxes, touch type scale),
while the desktop column is unchanged.

*(Analytics is deferred until there is traffic; no event instrumentation is required for this build.
The metric above is QA/UX-verifiable from the running app.)*

## Open questions for UX (resolve in the design spec, before Dev)

- **Default collapsed vs. expanded, and depth.** Mobile Wikipedia starts sections collapsed below the
  lead; confirm wiki+ matches that, and decide whether only `h2` sections collapse (with `h3`/`h4`
  inside) or nested headings also collapse. Recommendation: match mobile Wikipedia (collapse `h2`,
  lead open).
- **The collapse affordance's exact form** (chevron + heading row, the indicator, the tap region) and
  the **mobile TOC presentation** (where the section list lives on a phone and how it interacts with
  collapsed sections) — UX's call, within "reads like mobile Wikipedia" and the accessibility ACs.
- **The exact mobile breakpoint** within the article column's existing responsive system.
