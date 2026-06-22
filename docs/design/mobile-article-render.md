# Design spec: Mobile Wikipedia-article rendering

- **Status:** Design contract for build-loop (UX) — GitHub issue #121. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** `docs/specs/mobile-article-render.md` (Product). Resolves its four "Open questions
  for UX" and makes each of its 10 ACs satisfiable. The architecture decision (approach **b** — one
  `page/html` fetch, reproduce mobile behaviors in responsive CSS/JS) is settled; this spec designs
  **within** it and does not re-open it.
- **Inputs read:** `docs/specs/mobile-article-render.md`; `docs/ARCHITECTURE.md` §"Article rendering
  (client-side)" incl. *"Mobile rendering — one fetch, reproduce mobile behaviors"*;
  `docs/TOPIC_PAGE_DESIGN.md` ("The two worlds" — the article column **is** the encyclopedia, faithful
  Wikipedia look); `docs/VISUAL_IDENTITY.md` (palette/tokens, AA baseline, §10.1 projector header);
  `docs/design/article-rendering-fidelity-survey.md` (esp. Part 2 §B — the `< lg` infobox/table
  responsive contract this builds on); the built surface — `components/topic/ArticleBody.tsx`
  (`ArticleSections`/`ArticleLeadBlock`), `app/topic/TopicView.tsx` (the `goTo`/scroll-sync/`Toc`
  wiring), `app/globals.css` (the `.wiki-body`/`.sec`/`.wiki-tablewrap` styling surface).
- **Hand-off:** Development builds the collapse disclosure + mobile type/touch CSS in the article-column
  surface (no change to `lib/wiki/article.ts`, the DOMPurify allowlist, or the section walk). QA & Review
  verifies against the spec's ACs; UX evaluates the built mobile UI.
- **Coordinates with:** **#119** (skin system / dark Wikipedia side) — see §9. Color is expressed only
  through the existing article-column **tokens**; #119 themes them for free.

---

## 1. Who this serves (personas) and why

This build touches **one** persona's experience — the **reader on a phone** — without changing anyone
else's. The reader who lands on a Topic page (the primary persona in `docs/VISION.md` / the Topic-page
design) reaches wiki+ on a phone as often as on a laptop: a shared link, a search, an in-article
wikilink. Today that reader gets the desktop Parsoid article squeezed into a 390-px column — every
section expanded into one long scroll, with a type scale and touch targets tuned for a wide column.
They cannot scan the article's shape, and reaching section three means thumbing past sections one and
two in full.

The **curator/contributor** persona is unaffected here: the contribute flow, the rail, and clip cards
do not change. But the curator is *also* often a phone reader first — they discover an under-curated
topic by reading it on their phone — so a phone article that reads natively lowers the on-ramp to
curation too. Section-anchoring (TOC, scroll-sync, clip→section) must keep landing on the right section
on a phone so the curated layer stays reachable (AC3).

## 2. User stories (these feed Product's acceptance criteria)

- **S1 — Scan then choose.** *As a reader on my phone, I want to see the article's section headings
  collapsed so I can scan its shape and tap open only the section I care about, instead of scrolling
  past every section's full text.* (→ AC1)
- **S2 — One-tap open.** *As a phone reader, I want to open a section with a single tap on its heading,
  and have the chevron clearly tell me whether a section is open or closed — by shape, not just color
  — so the control is obvious and works for me even if I don't perceive the color.* (→ AC1, AC5, AC9)
- **S3 — Jump still lands.** *As a phone reader who taps a TOC entry (or follows a link to a section, or
  opens a clip anchored to a section), I want that section to open and scroll into view, not stay
  hidden behind a collapsed heading.* (→ AC3)
- **S4 — Tables and infoboxes fit.** *As a phone reader, I want a wide data table to scroll sideways
  inside its own region and the infobox to sit full-width at the top, so the page itself never scrolls
  sideways and I can read in one comfortable column.* (→ AC4)
- **S5 — Comfortable to read and tap.** *As a phone reader, I want body text sized for reading at arm's
  length and tap targets big enough for a thumb, so I'm not pinch-zooming or mis-tapping.* (→ AC5)
- **S6 — Keyboard / assistive parity.** *As a reader using a keyboard or a screen reader, I want each
  collapsible section to behave like a standard disclosure — focusable, toggled with Enter/Space, with
  its expanded/collapsed state announced — so the phone layout is operable without a touchscreen.*
  (→ AC9)
- **S7 — My laptop is untouched.** *As a reader on a wide screen, I want the article exactly as it is
  today — all sections open, the two-world layout, the existing fidelity — so nothing I rely on
  regresses.* (→ AC6)

## 3. The mobile reading flow

A reader opens `/topic/<Title>/` on a phone:

1. The **lead** (title, Wikidata short-description, CC BY-SA + QID attribution, lead HTML, and — if the
   article has one — the **full-width infobox/taxobox**) renders **open**, exactly as the lead does
   today. The lead is never a disclosure. *(This is `ArticleLeadBlock`, unchanged in content.)*
2. Below the lead, the **TOC** ("Contents" plus-card) renders inline in the single-column flow (it
   already stacks below the lead at `< lg`), so the reader can scan the whole section list at a glance
   and jump.
3. Below the TOC, the **section body** renders as a stack of **collapsed** top-level (`h2`) sections —
   each a tappable heading row with a closed-state chevron and no visible body. The reader scans the
   headings (S1).
4. The reader **taps a heading** → that section expands in place, revealing its body (and any nested
   `h3`/`h4` content, which renders inside the expanded section — see §4). The chevron rotates to the
   open state. Tapping again collapses it. (S2)
5. Alternatively the reader **taps a TOC entry** (or arrives via a `#sec-…` hash, or taps a clip's
   section link in the General strip / rail): the target section **expands if collapsed and scrolls to
   the heading**, reusing the existing `goTo` path. (S3)
6. Wide tables scroll horizontally inside `.wiki-tablewrap`; the page itself never scrolls sideways.
   (S4)

The **plus side** (General strip below the article, the rail) is unchanged; it already stacks below the
article at `< lg`. Section-anchoring from a clip resolves through the same `goTo`, so a clip card's
"section" link expands and reveals its section just like a TOC tap (#8 / AC3).

## 4. Resolved open questions (the four Product flagged)

### OQ1 — Default collapse state + depth → **match mobile Wikipedia: lead open; collapse at `h2`; `h3`/`h4` render inside their parent `h2`'s expanded body**

- **Default state:** every top-level (`h2`) section starts **collapsed**; the **lead is always open**
  (it is not a section). This matches mobile Wikipedia, where a phone reader sees the lead then a list
  of collapsed section headings. (AC1)
- **Collapse depth — only `h2` collapses.** `h3`/`h4` subsection headings and their content live
  **inside** the expanded `h2` section's body; they are **not** independently collapsible. This matches
  mobile Wikipedia (only top-level sections toggle) and is the right fit for our data model: the
  section walk emits a **flat sibling stream** of `<section class="sec">` — an `h3` section is a DOM
  *sibling* of its `h2`, not a child. So "collapse `h2`, nest `h3`/`h4`" is implemented by **grouping
  the flat stream into `h2`-led runs**: an `h2` section opens a disclosure group; every following `h3`/
  `h4` section (until the next `h2`) is part of that group's collapsible body and renders with its
  heading + body in document order. A section with no following `h3`/`h4` is a group of one. (AC1)
- **How nested headings render inside an expanded `h2`:** unchanged from today — the `h3`/`h4` heading
  uses the existing `.sec h3` / `.sec h4` serif type scale and the section body its `.wiki-body` styling.
  Nesting is **visual/document-order only**; there is no second level of chevrons. Each `h3`/`h4`
  remains its own `<section id="sec-…">` so its anchor is unchanged (AC2) and a TOC tap on an `h3`
  scrolls to that `h3` *within* its expanded parent (see OQ3).
- **A `general` / lead-only or section-less article:** if the walk yields **no `h2` sections** (a short
  article — e.g. Petrichor at phone width, or an empty article), there is **nothing to collapse**: the
  lead renders open and any body renders expanded with no disclosure chrome. The collapse affordance
  appears only where there is an `h2` to toggle. (See §6 "Empty / short article" state.)

### OQ2 — The collapse affordance's exact form → **the whole `h2` heading row is the toggle button; a leading chevron rotates 0°→90°; ≥44×44 px touch target; state conveyed by chevron rotation + `aria-expanded` text, never color**

- **Tap target = the entire `h2` heading row.** The reader taps anywhere on the heading line (the
  heading text *and* the chevron and the full-bleed row to the column edge), not a tiny glyph. The row
  is a single `<button>` spanning the article column's full width.
- **Indicator = a leading chevron**, placed at the **start (inline-start)** of the heading row, before
  the heading text, vertically centered. It is a CSS/inline-SVG triangle/chevron drawn in
  `currentColor` (so it inherits the heading's ink token and #119 themes it for free — §9). No raster
  asset, no `<svg>` injected into sanitized HTML (the chevron is React/CSS chrome **outside**
  `.wiki-body`, so X4 is untouched — AC7).
  - **Collapsed:** chevron points **inline-end** (▶, a 0° rotation of a right-pointing chevron — in RTL
    it mirrors via `currentColor`/logical properties).
  - **Expanded:** chevron points **down** (▼, rotated +90°). The rotation is the primary, color-free
    state cue (shape changes — AC9). A short rotation transition is allowed and is gated by
    `prefers-reduced-motion: reduce` (instant under reduced motion), matching the existing
    `.sec.active` transition discipline.
- **Touch target ≥ 44×44 px (AC5):** the heading-row button has **`min-height: 44px`** and vertical
  padding such that the hit area is ≥ 44 px tall at the mobile body scale; the chevron's own box is ≥
  24 px but the *hit area* is the whole row, so the effective target far exceeds 44×44. The chevron has
  adequate inline padding so the leading edge is comfortably tappable.
- **The heading text keeps its faithful Wikipedia look** — the existing serif `.sec h2` type, hairline
  `--color-wikirule` bottom rule, and size. The chevron is the *only* added glyph; the row does not
  gain an Indigo Press border, fill, or shadow (no plus-side chrome bleeds into the article column —
  the governing article-fidelity principle). The active-section highlight (`.sec.active`, the indigo
  left-bar + faint gradient) continues to apply to the heading and is compatible with the button.
- **Microcopy (screen-reader only):** the disclosure's accessible name is the **section heading text
  itself** (the `<button>` wraps/labels the heading text), and state comes from `aria-expanded`
  (true/false), which AT announces as "expanded"/"collapsed". No separate visible "Show"/"Hide" label
  is added (mobile Wikipedia shows none, and the chevron + heading carry the meaning). For belt-and-
  braces clarity an `sr-only` suffix may be appended to the button's accessible name — **" — tap to
  expand section"** when collapsed / **" — tap to collapse section"** when expanded — but this is
  optional polish; `aria-expanded` is the required mechanism (AC9). If included, it must read naturally
  appended to the heading text and must not be visible.

### OQ3 — Mobile TOC presentation + its interaction with collapsed sections → **keep the existing "Contents" plus-card inline below the lead; a TOC tap (and a clip anchor) routes through `goTo`, which expands the target's parent `h2` group then scrolls**

- **Presentation:** the mobile TOC is the **existing `Toc` plus-card**, unchanged in form — it already
  stacks full-width below the lead at `< lg` (it sits in the masthead `<aside>` that drops below the
  lead in the single-column grid). No new mobile TOC component, no off-canvas drawer, no bottom sheet.
  This is the simplest design that "reads like mobile Wikipedia" (a contents list before the body) and
  reuses the dual curated/suggested badges the reader already understands. The TOC's own internal
  scroll (`max-h-[55vh]`, `overflow-y-auto`) keeps a long contents list from dominating the phone
  viewport.
- **Interaction with collapsed sections (AC3) — the load-bearing behavior:** activating a TOC entry
  calls the existing `goTo(slug)`. On a phone the target section (or, for an `h3`/`h4` entry, its
  **parent `h2` group**) may be collapsed. `goTo` must therefore, **before** computing the scroll
  target: **(a)** identify the disclosure group that owns `slug` (the `h2` group containing that
  section), **(b)** set that group's state to **expanded** if collapsed, then **(c)** scroll to the
  target section's element (the existing `scrollIntoView`/`scrollTo` math), and **(d)** set
  `activeSlug`. Because expansion changes layout height, the scroll must be computed **after** the
  expand commits (e.g. in the same effect/rAF that the existing code already uses for layout-stable
  scrolls). Net: a TOC tap on any entry — `h2`, `h3`, or `h4` — always **reveals and lands on** that
  exact section.
- **Same for a clip's section anchor and a `#sec-…` hash (AC3, #8):** the clip card's "section" link and
  any incoming hash resolve through the same `goTo`, so a clip anchored to a collapsed section expands
  the owning group and scrolls — identical to a TOC tap. The scroll-sync that highlights the active TOC
  row as the reader scrolls (`.sec.active`) continues to work; on a phone it only meaningfully tracks
  **expanded** sections (a collapsed group has no visible body to cross the reading line), which is
  correct — a collapsed section is not "active."

### OQ4 — The exact mobile breakpoint → **collapse fires below `md` (`max-width: 767px`, an existing boundary); infobox/table stacking stays at the existing `< lg` (`max-width: 1023px`)**

There are **two** distinct, already-existing thresholds, and they correctly differ:

- **Layout single-column + infobox stacks full-width + table wraps go full-bleed:** at **`< lg`
  (`max-width: 1023px`)** — *unchanged*. This is the existing grid breakpoint (`lg:grid-cols-[1fr_360px]`)
  and the existing `@media (max-width: 1023px)` infobox-stacking rule from the fidelity survey Part 2
  §B. Tablet (834 px) already reads as a single full-width column with a stacked infobox; that stays.
- **Collapsible sections (the disclosure) fire at `< md` (`max-width: 767px`)** — **true phone widths
  only**. `md` (768 px) is an established boundary in this codebase: the article-side header already
  switches to the compact magnifier-disclosure search **`< md`** (`docs/ARCHITECTURE.md` — "inline
  compact … ≥ md; a labeled magnifier icon-disclosure < md"). Reusing it keeps the "phone vs. not-phone"
  line consistent and invents no new breakpoint.
  - **Rationale for the split:** a tablet's single ~800-px column reads comfortably with sections
    *expanded* (it is close to desktop Wikipedia's tablet view); collapsing it would hide content
    without the cramped-thumb problem that motivates collapse. Mobile Wikipedia itself collapses on
    phones, not on a roomy tablet column. So collapse = a **phone** behavior (`< md`); infobox stacking
    = a **single-column** behavior (`< lg`). On a phone both apply; on a tablet only the stacking does.
- **The mobile type scale + ≥44 px touch targets (AC5)** apply on the **same `< md`** phone branch as
  the collapse (they are the phone reading-comfort layer). The desktop/tablet body type is unchanged.

> **Implementation note for Dev (not a new decision):** because the disclosure must be keyboard- and
> AT-operable and must toggle in JS (the `goTo` expand-on-jump), the recommended mechanism is a real
> React state-driven `<button aria-expanded>` + a hidden/shown body region, with the **`< md` gate
> applied so that on `≥ md` the disclosure renders inert/expanded and the button chrome is absent**
> (no chevron, no toggle, all bodies shown — identical DOM order, just no collapse) — preserving the
> desktop column exactly (AC6). A pure CSS `<details>`/`:has()` approach is **not** sufficient because
> `goTo`/anchor-jump must programmatically expand a collapsed group; JS-driven state is required.

## 5. Component & interaction breakdown (the buildable contract)

The change is scoped to **`components/topic/ArticleBody.tsx`** (`ArticleSections`) and the article-column
CSS in **`app/globals.css`** (`.sec` / `.wiki-body` surface). No change to `lib/wiki/article.ts`, the
DOMPurify allowlist, the section walk, or the section slugs (AC2, AC7, AC8).

### 5.1 Grouping the flat section stream into `h2` disclosure groups

`ArticleSections` receives `sections: ArticleSectionBody[]` (a flat list, each with `slug`, `level`,
`title`, `html`). Build a derived grouping for render: walk the list; each `level === 2` starts a new
group `{ h2: section, members: [section] }`; each subsequent `level >= 3` is pushed into the current
group's `members`. Any leading `level >= 3` section before the first `h2` (rare; defensive) forms a
"loose" group rendered expanded with no toggle. The **rendered DOM keeps every section as its own
`<section id="sec-${slug}">`** (so anchors/slugs are byte-identical — AC2); grouping only governs the
disclosure wrapper and which heading bears the toggle.

### 5.2 The disclosure (`< md` phone state)

For each `h2` group:

- The **`h2`'s `<section>`** carries the toggle. The `h2` heading becomes (or is wrapped by) a
  full-width `<button type="button">` with:
  - `aria-expanded={open}` — reflects state (AC9).
  - `aria-controls="<groupBodyId>"` — points at the group body region's `id` (AC9 controls
    association).
  - accessible name = the heading text (optionally + the `sr-only` "tap to expand/collapse section"
    suffix from OQ2).
  - a leading chevron span (`aria-hidden="true"`, `currentColor`) that rotates by state.
  - `min-height: 44px`; full-column width; the existing serif heading type + hairline rule preserved.
- The **group body** is one region `<div id="<groupBodyId>" role="region" aria-labelledby="<h2 id>">`
  (or simply a container hidden via `hidden`/`display:none`) holding: the `h2`'s own `.wiki-body` HTML
  **and** every member `h3`/`h4` section (heading + body) in document order. When `open` is false the
  region is **not rendered visible** — use the `hidden` attribute or `display:none` (so collapsed
  bodies are removed from the a11y tree and tab order — AC9) rather than visually clipping; this also
  means a collapsed section's links/citations are not tabbable until expanded, which is correct.
- **Toggle interaction:** click/tap toggles `open`. Keyboard: because it is a native `<button>`,
  **Enter and Space** toggle it for free and it is in the tab order with the global
  `:focus-visible` 3 px brand ring (AC9). No custom key handling needed.

### 5.3 The desktop/tablet state (`≥ md`)

On `≥ md` the same component renders **all sections expanded, no button, no chevron** — i.e. exactly
today's output: the `h2`/`h3`/`h4` as plain headings, each body shown. The simplest correct
implementation is to drive `open` to "always true and non-interactive" above `md` (e.g. a viewport
hook / matchMedia, or render the heading as a plain heading rather than a button above `md`). The DOM
order and ids are identical across breakpoints; only the wrapper-as-button + the hidden body differ.
This guarantees AC6 (desktop unchanged) and keeps anchors stable across breakpoints (AC2/AC3).

### 5.4 `goTo` / anchor-jump expansion (in `TopicView`)

Extend the existing `goTo(slug)` (and the hash-arrival path) so that before scrolling it **expands the
disclosure group that owns `slug`** when on the phone branch (see OQ3). Mechanically: `ArticleSections`
owns the per-group `open` state; `TopicView`'s `goTo` needs a way to request "expand the group for this
slug." Recommended seam: lift the open-state into a small controller shared by `ArticleSections` and
`goTo` (e.g. a `Set<openH2Slug>` in `TopicView` passed down, with a `requestExpand(slug)` that maps
`slug`→its owning `h2` slug and adds it), so `goTo` can expand then scroll in the existing
layout-stable rAF. Dev may choose the exact wiring; the **contract** is: *a `goTo`/anchor to any slug
whose owning group is collapsed expands that group and then scrolls to the slug's heading* (AC3). On
`≥ md` `requestExpand` is a no-op (everything is already shown).

### 5.5 Tables and infoboxes on the phone (AC4) — mostly already done

- **Wide data tables:** unchanged — they already live in `.wiki-tablewrap` with `overflow-x: auto` and
  the `data-overflow` "Scroll table →" hint wired by the existing MutationObserver/ResizeObserver in
  `TopicView`. This already prevents horizontal page overflow at any width, including 390 px. **No
  change needed**; the spec only requires verifying it holds at phone width inside a collapsed-then-
  expanded section (the observers already bind newly-injected wrappers, so a table revealed on expand
  is flagged correctly).
- **Infobox/taxobox:** unchanged — the existing `@media (max-width: 1023px)` rule stacks it full-width
  at the top of the lead. At 390 px it is full-column with a larger centered image, matching mobile
  Wikipedia (fidelity survey Part 2 §B). The infobox sits in the **lead**, which is always open, so it
  is never hidden by a collapse. **No change needed.**
- The only net-new CSS for AC4 is none; the AC is satisfied by the existing responsive contract + the
  collapse not touching the lead/infobox. (The spec lists AC4 so QA verifies it at phone width.)

### 5.6 Mobile type scale & touch (AC5) — `< md` only

On the `< md` phone branch, set a reading-comfortable scale on the article column without altering
desktop/tablet:

- **Body text:** `.wiki-body` font-size **1rem** (16 px) with **line-height ~1.6** on `< md` (today it
  is `0.95rem`/1.65 at all widths — the slightly larger 16 px reads better at arm's length and avoids
  iOS tap-zoom on inputs; line-height stays generous). Dev may tune within "16 px body, comfortable
  measure"; the requirement is a **legibly larger-than-desktop** phone body that reads like mobile
  Wikipedia, never smaller than 16 px.
- **Heading scale:** the `.sec h2` may stay at its current size or step down slightly so a tappable row
  is comfortable; keep the serif + hairline rule. `h3`/`h4` unchanged.
- **Touch:** the disclosure button `min-height: 44px` (OQ2). The existing in-article controls (citation
  links, wikilinks) are Wikipedia's own inline links and are not re-targeted here; this AC's "any
  in-article control introduced here" = the disclosure button only, which meets ≥44×44.
- All of the above is gated behind the **same `< md`** media query as the collapse; `≥ md` is byte-for-
  byte today (AC6).

## 6. Every state (the buildable state table)

Each state below is the **phone (`< md`)** rendering unless noted; the `≥ md` column is "unchanged from
today" throughout (AC6).

| State | Phone (`< md`) rendering | Notes / AC |
|---|---|---|
| **Article loading** | Existing `ArticleSkeleton` (shimmer bars, `aria-busy`, `role="status"` "Loading article…"). No collapse chrome — there are no sections yet. | Unchanged; reuse as-is. |
| **Load error** | Existing `ArticleError` card ("Couldn't load the article" + "Try again" + "Open on Wikipedia ↗"). The plus side stays useful below. | Unchanged; reuse as-is. |
| **Populated — collapsed (default)** | Lead open (with full-width infobox if any) → TOC card → a stack of **collapsed `h2` heading rows**, each with a closed chevron (▶) and no visible body. | The default. AC1, AC5, AC9. |
| **A section expanded** | One (or more) `h2` group open: chevron rotated (▼), `aria-expanded="true"`, the `h2` body + its nested `h3`/`h4` (heading + body) shown in document order; the rest stay collapsed. | AC1, AC3, AC9. Multiple may be open at once (independent toggles; no accordion-collapse-others). |
| **Wide-table article (e.g. Lion)** | A revealed section containing a wide data table shows the table inside `.wiki-tablewrap` with horizontal scroll + the "Scroll table →" hint; the **page never scrolls sideways**. | AC4. Existing wrap + observers; verify on expand. |
| **Infobox/taxobox article (e.g. Dendrobium, Lion, Marie Curie)** | The infobox/taxobox is **full-width at the top of the lead** (always open), banners centered + grey-shaded, image centered, never a narrow float. | AC4 + fidelity survey Part 2 §B. Existing `< lg` rule. |
| **Empty / short / no-`h2` article (e.g. Petrichor, or an empty body)** | Lead open; **no collapse chrome** (nothing to toggle); any body renders expanded. If truly empty, just the lead/attribution. The plus side still renders. | OQ1. The disclosure appears only where an `h2` exists. |
| **Active section (scroll-sync)** | The expanded `h2` whose heading last crossed the reading line gets the existing `.sec.active` highlight (indigo left-bar + faint gradient) on its heading-row button. | AC3 continuity; only expanded sections can be active. |

## 7. Accessibility-in-practice (AC9 — written into the contract)

- **Keyboard operation:** the disclosure is a native `<button type="button">`, so it is focusable in
  source order, and **Enter and Space** toggle it with no custom handler. The reader tabs heading →
  (when expanded) the section's links → next heading. A **collapsed** section's body is `hidden` /
  `display:none`, so its links are **not** in the tab order until the section is expanded — correct
  disclosure behavior, no focus traps on hidden content.
- **ARIA disclosure semantics:** `aria-expanded` on the button reflects open/closed; `aria-controls`
  points to the group body region; the body region is `aria-labelledby` the heading (or is the button's
  controlled region). AT announces the heading text + "collapsed"/"expanded". This is the WAI-ARIA
  Disclosure pattern.
- **State by more than color (never color alone):** the **chevron rotates** (▶ vs ▼ — a *shape* change)
  and `aria-expanded` carries the state to AT; color is not the signal. The active-section indigo
  highlight is decorative reinforcement, not the disclosure-state cue.
- **Focus-visible:** the global `:focus-visible { outline: 3px solid var(--color-brand) }` applies to
  the button, giving a visible keyboard ring; mouse/touch activation shows no heavy ring (the global
  rule already distinguishes `:focus-visible`).
- **AA contrast:** the heading text keeps the faithful Wikipedia ink (`#1b1b1b` on the white/`bg`
  article surface — well above AA). The chevron is `currentColor` (the same ink) — AA by construction.
  Under #119's dark skin the tokens flip together (§9), so contrast is preserved by the skin's token
  set, not by this build hardcoding a color.
- **Reduced motion:** the chevron rotation transition (and any expand transition, though MVP expand is
  instant per Product's deferral) is gated by `prefers-reduced-motion: reduce` → instant, matching the
  existing `.sec.active` transition discipline.
- **Touch target:** the toggle's hit area is the full heading row, `min-height: 44px` (≥44×44 — AC5).
- **Forced-colors / high-contrast:** the chevron, drawn in `currentColor` with shape-based state, and
  the native `<button>` survive a forced palette (it does not rely on a custom fill the way the
  projector beam does); no special handling beyond using `currentColor` is required.

## 8. What is explicitly NOT in this design (matches the spec's scope/out-of-scope)

- No **"expand all / collapse all"** control and no **expand/collapse animation** (Product deferred
  both; the MVP collapse is a plain, instant, accessible disclosure — the chevron-rotation micro-
  transition is the only motion, and it is reduced-motion-gated).
- No change to the **desktop/tablet** article column (AC6), the **plus/curation** surfaces, the
  **fetch/sanitize/section-walk** pipeline (AC7/AC8), the **DOMPurify allowlist**, **routing**, or the
  **section slugs** (AC2).
- No new **endpoint** (`page/mobile-html`), no **UA detection**, no **device-class cache key** (AC8) —
  the mobile branch is a viewport-gated presentational layer over the one client-fetched DOM.
- No off-canvas TOC drawer / bottom sheet (the inline "Contents" card is the chosen mobile TOC — OQ3).

## 9. Coordination with #119 (skin system / dark Wikipedia side)

This build and #119 share the `.wiki-body` / `.sec` article-column surface on **orthogonal axes** —
**this spec = layout / disclosure / type scale / touch (mobile vs. wide); #119 = color / theme tokens
(light vs. dark).** To compose without rework:

- The disclosure's **only color** is the chevron and the (existing) active-section highlight, and both
  are expressed through **tokens**: the chevron is `currentColor` (it inherits the heading's ink token,
  which #119 themes); the active highlight already uses `--color-brand`. **No literal hex** is added for
  the affordance. So when #119 introduces a dark token set for the article column, a collapsed/expanded
  section and its chevron theme **for free** — dark heading text → dark chevron, correct contrast.
- The disclosure is built on the **shared `.sec` / `.wiki-body` selectors** (the `h2` button wraps the
  existing `.sec h2`; the body is the existing `.wiki-body` div). #119 themes the *same* selectors. The
  two are one structure with two stylesheets layered: whichever lands first leaves the surface in a
  shape the other extends. (Dev building this should not introduce a parallel set of article-column
  class names that #119 would then have to re-theme.)
- Light/dark **and** mobile/wide must compose: a collapsed section on a phone in the dark skin must
  render correctly (dark row, dark chevron, hidden body). Because mobile = layout and skin = color, and
  both key off the same tokens/selectors, this holds without either build knowing the other's specifics.

## 10. Screenshot baseline (AC10) — scenes to add to the catalog

Add `Scene`(s) to `e2e/screenshots/catalog.ts` so the **mobile** article states enter the committed
gallery (`docs/design/ui-screenshots/`). The `mobile` viewport is **390 px** (existing). Recommended
scenes (Dev/QA add the exact `Scene` objects; UX confirms the set covers the states):

1. **`topic-article-mobile-collapsed`** — a curated topic at the **mobile** viewport, scrolled to the
   section body, showing the **stack of collapsed `h2` heading rows** (closed chevrons) below the lead +
   TOC. *(Collapsed-default state — AC1, AC10.)*
2. **`topic-article-mobile-expanded`** — same, with **one section expanded** (open chevron, body +
   nested `h3`/`h4` visible). *(Expanded state — AC1, AC3, AC10.)*
3. **`topic-article-mobile-infobox`** — an article with an infobox/taxobox at the **mobile** viewport,
   showing the **full-width stacked infobox** at the top of the lead. *(AC4 — reuse a taxobox fixture,
   e.g. the Dendrobium/Lion shape.)*
4. **`topic-article-mobile-table`** *(optional but recommended)* — a section (expanded) with a **wide
   table scrolling horizontally** inside `.wiki-tablewrap`, demonstrating no page-level horizontal
   overflow. *(AC4.)*

Each is captured at the `mobile` viewport (and logged-out is sufficient for the article column; the
disclosure is auth-independent). The existing **desktop** article scenes (`topic-body`, etc.) must be
re-rendered and **unchanged** (AC6) — refresh the gallery in the same PR (`scripts/dev/shots.sh --group
"Topic · body" --commit ui` plus the new scenes; or `--all --commit ui` since this adds new surfaces and
touches the shared article surface). New scenes are captured + indexed automatically once added to the
catalog.

## 11. AC traceability (how this design makes each design-dependent AC satisfiable)

- **AC1 (collapsible sections; collapsed by default on phone; expanded on wide):** §4 OQ1 (collapse
  `h2`, lead open, default collapsed) + §5.2 (native `<button aria-expanded>` per `h2` group) + §5.3
  (`≥ md` renders all expanded, no button) + §4 OQ4 (`< md` gate). State table §6 rows
  "populated-collapsed" / "expanded" / `≥ md` unchanged.
- **AC3 (curation resolves on mobile — TOC / clip anchor expands + scrolls a collapsed section):** §4
  OQ3 + §5.4 — `goTo`/hash/clip-anchor calls `requestExpand(owning h2 slug)` then the existing layout-
  stable scroll; on `≥ md` it's a no-op. Slugs unchanged (§5.1) so the anchor set is identical (AC2).
- **AC4 (tables/infoboxes fit on mobile):** §5.5 — wide tables already scroll in `.wiki-tablewrap`
  (existing observers re-bind on expand); infobox stacks full-width via the existing `< lg` rule and
  lives in the always-open lead. State table §6 "wide-table" / "infobox" rows.
- **AC5 (touch targets ≥44×44 + mobile type scale):** §4 OQ2 (`min-height:44px` full-row button) +
  §5.6 (16 px body / ~1.6 line-height on `< md`). §7 touch-target note.
- **AC9 (accessibility — keyboard, ARIA, state-not-by-color, focus ring, AA):** §4 OQ2 + §5.2 (native
  `<button>` → Enter/Space; `aria-expanded` + `aria-controls`/`aria-labelledby`; chevron rotation =
  shape cue; `currentColor` ink = AA; global `:focus-visible` ring; collapsed body `hidden` → out of
  tab order; reduced-motion-gated). §7 enumerates each.

(AC2, AC6, AC7, AC8, AC10 are made satisfiable by *not changing* the pipeline/allowlist/slugs/desktop
column and by adding mobile scenes — covered in §5.1, §5.3, §8, §10.)
