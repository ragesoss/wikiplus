# Design spec: Article fidelity — citations, tables & infobox, math, navigational tail

- **Status:** Buildable design spec (UX). Written **before** implementation as the input to
  Development for the bundled build-loop run covering issues #24–#27.
- **Designs to:** `docs/specs/article-fidelity.md` (the Product contract — acceptance-criterion
  groups A1–A7, B1–B8, C1–C4, D1–D7, X1–X5). Every section below traces to those criteria.
- **Baseline read:** `docs/TOPIC_PAGE_DESIGN.md` ("The two worlds", the +plus identity, the
  +plus infobox), `docs/ARCHITECTURE.md` ("Article rendering (client-side)", "Licensing &
  attribution"), `CLAUDE.md` (Indigo Press palette + accessibility baseline). Grounded in the
  current behavior of `lib/wiki/article.ts` (`DROP_SECTIONS`, `stripChrome`, the DOMPurify
  allowlist, `rewriteLinks`, `externalize`, `cleanFigures`), `app/globals.css` (`.wiki-body`),
  and the Topic page components (`components/topic/ArticleBody.tsx`, `Toc.tsx`, `Infobox.tsx`,
  `app/topic/TopicView.tsx` scroll-sync).
- **Hand-off:** Development implements; QA & Review verifies correctness; UX evaluates the built
  UI against this spec + the user stories below.

> **The governing principle (from "The two worlds").** The **left column IS the encyclopedia.**
> Everything restored here — citations, tables, the Wikipedia infobox, equations, the
> navigational tail, hatnotes — is **Wikipedia chrome** and keeps **Wikipedia's visual language**
> (serif headings, hairline rules, `#3366cc` wikilinks, the grey figure frame). The **Indigo
> Press identity does not cross into the article column.** Indigo (`#676EB4`) appears on the
> article side **only as the existing scroll-sync active-section accent** — never as a citation
> color, table header, or reference style. Where a restored element needs an interactive control
> that is *ours* (the citation popover surface, the back-link affordance), it is styled minimally
> and neutrally so it reads as part of the page, not as a +plus card. This is the single rule
> that resolves most of the per-element styling questions below.

---

## 1. Personas & user stories

The persona this feature serves is the one already central to wiki+ (`docs/VISION.md`, "what good
looks like" = *a reader understands how to weigh each clip*):

**Persona — "Mara, the reader weighing a clip against the encyclopedia."** She lands on a Topic
page (e.g. `Photosynthesis`) from search or a curated link. She watches a curated short, reads its
context note, and then turns to the article to check it for herself. Today she hits a wall: the
prose says "the Calvin cycle fixes carbon[12]" but there is no `[12]`, no References section, no
data table, no equation, no See-also. She cannot *verify*, which is the whole point of putting the
encyclopedia next to the clip. (Secondary personas — curator, moderator — are unaffected by this
feature; it is purely about article-reading fidelity.)

User stories (these feed Product's acceptance criteria; reconcile, don't duplicate):

- **U1 (Group A).** *As a reader, I want to see the citation behind a statement so I can judge how
  well-sourced it is before I trust it — the same as I would on Wikipedia.*
- **U2 (Group A).** *As a reader, I want to open a citation in place without losing my spot, and
  also reach a full References list at the foot, so I can check one source quickly or audit them
  all.*
- **U3 (Group B).** *As a reader, I want to read the data tables and the infobox the prose refers
  to, so the numbers and key facts the clip discusses are actually there.*
- **U4 (Group B).** *As a reader on a phone, I want a wide table to stay usable without breaking
  the page, so the article is readable on the device I'm holding.*
- **U5 (Group C).** *As a reader on a science topic, I want to see the equations rendered legibly,
  because the formula is often the substance the clip simplifies.*
- **U6 (Group D).** *As a reader, I want to follow the article's "See also" links into related
  topics, so the encyclopedia's own graph carries me deeper into wiki+.*
- **U7 (a11y, all groups).** *As a keyboard or screen-reader user, I want every restored element —
  citation reveal, table, infobox, equation, tail link — to be operable and labeled, never
  signalled by color alone.*

---

## 2. Information architecture — where each restored element lives

The Topic page regions are unchanged (`TopicView`): **Masthead** (article title + attribution +
lead, left; +plus infobox + TOC, right), **General band** (full-bleed crossover), **Reader**
(article body sections, left; sticky video rail, right). This feature adds content *inside the
left article column* and *one new section type at its foot*. Nothing moves to the +plus side.

| Restored element | Region | Position in the article column |
|---|---|---|
| Inline `[n]` citation markers (A1) | Lead + each section body | inline in prose, where Wikipedia shows them |
| Citation popover (A2) | overlay anchored to a marker | floats over the article column; never in the rail |
| References section (A3) | **new, at the foot of the article body** | after the last content section, before the tail |
| Wikipedia data tables (B1) | within the section that contains them | block-level, in normal flow |
| Wikipedia infobox (B3) | **top of the lead/first section**, float-right | right-floated in the left column (like a `wikifig`) |
| Inline / display math (C1/C2) | within prose / as its own block | inline in line; display centered as a block |
| Hatnotes (D2) | **top of the article**, above the lead prose | full-width, above the first paragraph |
| See also / Further reading / External links (D1) | **foot of the article**, after References | as ordinary sections in the section walk |

**Order at the foot of the article (top→bottom):** last content section → **References** → **See
also** → **Further reading** → **External links** → (explanatory **Notes**, if any). This mirrors
Wikipedia's own ordering.

> **Implementation note for the section walk.** Today `fetchFullArticle` drops these sections via
> `DROP_SECTIONS` and de-links in-page anchors. The walk that produces `sections[]` is what feeds
> the TOC and scroll-sync (`TopicView.tocEntries`, `setSectionRef`). The References section and the
> tail sections must come **through the same walk** as ordinary `ArticleSectionBody` entries (so
> they get a slug, a heading, a TOC row, and a `.sec` wrapper) — they are **not** special-cased
> appendages. This is what makes D5/D6 fall out naturally. The *render mechanism* (how Parsoid's
> reference `<ol>` and back-ref anchors are preserved) is Dev's, but the **outcome** is: each is a
> normal section. See §6.

---

## 3. Group A — Citations & references

### 3.1 Decision: popover **AND** a References section (both)

Confirmed per Product's recommendation and U2. Two complementary surfaces:

1. **A popover** on the inline `[n]` marker — in-context reading, matches the modern Wikipedia
   reference-preview behavior. For "what's this one source?" without leaving the line.
2. **A References section** at the foot — the full numbered list with working back-links, for
   "show me everything / audit the sourcing."

The marker is the entry point to both: activating it opens the popover; the popover offers a path
to the full entry in the References list; the References entry's back-link returns to the marker.

### 3.2 Inline `[n]` marker styling (A1, A7)

The marker stays **faithful to Wikipedia**, not Indigo Press. On Wikipedia an inline reference is a
small superscripted bracketed number in the wikilink blue. We keep exactly that:

- Rendered as `sup` containing the bracketed number, e.g. `[12]`. The brackets are **literal text**
  (`[` and `]`), not CSS-generated — so the citation is conveyed by **text, not color alone** (A7).
- Color: the Wikipedia wikilink blue already in the palette, `--color-wikilink: #3366cc`. (AA: 4.6:1
  on the `#fff`/`#F7F7F7` article background — passes for the small superscript. Verified value, not
  a guess; QA re-checks.)
- Size: `font-size: 0.75em`, `line-height: 0` superscript (so markers never alter the prose
  leading). `white-space: nowrap` so `[12]` never wraps.
- The marker is a **`<button>` or `<a role="button">`** styled to look like the Wikipedia
  superscript — it must be a real focusable, keyboard-activatable control (A7), not a bare `<sup>`.
  It carries `aria-label="Citation {n}"` (or "Footnote {n}") so a screen reader announces the
  citation, not just the digit. **No new color is introduced** — the marker looks like a Wikipedia
  reference link.
- Hover/focus: underline on hover (same as `.wiki-body a:hover`); the global `:focus-visible` 3px
  indigo ring applies (this indigo is the *focus* system, shared site-wide — acceptable; it is not
  a citation-specific color).

### 3.3 Popover trigger, content, positioning, dismissal (A2, A7)

**Trigger.** Open on **click/activation** (mouse click, `Enter`, or `Space`) — the reliable,
keyboard-equivalent, touch-equivalent trigger. **Hover-open is an optional progressive enhancement
for fine pointers only** (`@media (hover: hover) and (pointer: fine)`), with a ~120 ms open delay
and a forgiving close (stays open while the pointer is over the marker *or* the popover). Hover must
**never** be the only way to open — click/keyboard is the contract; hover is convenience. On touch,
the first tap opens (no hover state to fight).

**Content.** The popover shows the **full citation text** for that marker — the same content as the
References-list entry: the formatted citation, with any publisher link / DOI / ISBN / archive link
live. It is the citation, not a page preview. Max width `min(360px, calc(100vw − 2rem))`; max height
`min(50vh, 320px)` with internal scroll if a citation is unusually long. A footer link **"View in
References ↓"** jumps to (and focuses) the matching entry in the foot References section.

**Positioning.** Anchored to the marker, preferring **below-and-aligned-start**; flips above if it
would overflow the viewport bottom, and shifts horizontally to stay within the article column /
viewport (use a headless positioning primitive — **Radix Popover** is the sanctioned headless option
per ARCHITECTURE/CLAUDE; it gives collision-aware positioning + focus management for free, styled
bespoke). It renders in a **portal** at the page level so it is never clipped by the section's
`overflow` (relevant because table wrappers introduce `overflow-x`, §4.2) — but it stays visually
within/over the article column.

**Coexistence with scroll-sync (A2 — the load-bearing interaction).** This is the explicit risk
called out in the Product open question. The rules:

- **The popover must not move the page.** Opening it does **not** scroll, does **not** call `goTo`,
  and does **not** set `activeSlug`. The active-section highlight (`.sec.active`, the indigo left-bar
  on the heading) is driven only by the scroll position; the popover is an overlay that leaves scroll
  untouched, so the active section the reader is in stays highlighted. No fight.
- **While the popover is open, a scroll gesture closes it** (it is anchored to a marker that scrolls
  away; a Radix Popover closes on scroll-of-the-anchor by default — keep that). Scroll-sync then
  proceeds normally. This is the correct behavior: the reader chose to scroll, so dismiss the
  transient overlay and let the page track.
- **The "View in References" jump DOES use the normal anchor path.** It scrolls to `#sec-references`
  (the References section's own `.sec` wrapper) — i.e. it behaves exactly like a TOC click to that
  section, so scroll-sync highlights References as the active section, consistently. No special
  scroll code; reuse the section anchor. (References is a real section in the walk — §6.)
- **The popover is *not* a modal.** No focus trap on the page, no backdrop, no `aria-modal`
  (consistent with the project's non-modal-overlay precedent, the pinned player). It is a
  `role="dialog"` *popover* labeled by its citation number; focus moves into it on open and returns
  to the triggering marker on close (Radix handles this). It must not steal the page or block
  scroll-sync.

**Dismissal.** `Esc` (focus returns to the marker), click/tap outside, scroll (above), or
re-activating the marker. All keyboard-reachable.

### 3.4 References section at the foot (A3, A4)

A real article section titled **"References"** (heading styled like any `wiki-body h2` — serif,
hairline rule), rendered at the foot of the article body, **before** the navigational tail.

- **Layout:** Wikipedia's numbered ordered list (`<ol>`), in source order. Faithful Wikipedia
  styling — small text (`~0.82rem`), the citation text per entry, links live (publisher/DOI/ISBN/
  archive open out, §3.5; internal `/wiki/` route in, §3.5). Long lists are fine in normal flow (the
  page scrolls); **no internal scroll box** on the References section — it reads like Wikipedia.
- **Back-links (A4):** each entry begins with its number as a working **back-reference link** (the
  Parsoid `↑` / `^` / `a b c` back-ref anchors, kept functional, not de-linked). Activating a
  back-ref scrolls to the corresponding inline marker and **moves focus to that marker**, so a
  keyboard user is returned to where they were reading. The back-ref carries a text label
  (`aria-label="Back to citation {n}"`); the caret/`^` glyph alone is never the only signal.
  - **Multiple back-references (content-absent / multi state):** when one reference is cited from
    several places, Wikipedia emits multiple back-ref anchors (`a`, `b`, `c`…). **Render all of
    them**, each labeled `aria-label="Back to citation {n}, instance a"` etc. (the letter is also
    visible text, matching Wikipedia). The popover's "View in References" still lands on the single
    list entry.

### 3.5 Citation link routing (A5, A6) — reuse existing helpers

Links *inside* citations and References go through the **same** routing as body links — no new
mechanism:

- **External source links** (publisher URL, DOI `doi.org`, ISBN special-page, archive.org) →
  `externalize` (`target="_blank" rel="noopener"`), opening in a new tab (A5). They carry the
  "opens in new tab" affordance — §8 microcopy.
- **Internal `/wiki/` links inside citations** (a citation that links an article) → `rewriteLinks` →
  internal `/topic/` route with `data-topic-title` (A6), exactly like body wikilinks. **Not**
  de-linked.
- The current `rewriteLinks` de-links in-page `#` anchors to plain text — that rule must now
  **exempt the citation/back-ref anchors** (the marker↔reference round-trip is the whole point).
  Marker→reference and reference→marker anchors stay functional. This is a routing change Dev owns;
  the **outcome** is: cite/backref anchors work, everything else routes as before.

---

## 4. Group B — Tables & the two infoboxes

### 4.1 Data-table styling (B1) — faithful, legible

Un-hide tables (remove `.wiki-body table { display: none }`) and style them to read as Wikipedia,
not as Indigo Press:

- Base: `border-collapse: collapse`; `font-size: 0.85rem`; full width of its container up to its
  natural width.
- Cells: `th`/`td` get `border: 1px solid var(--color-wikirule)` (`#a2a9b1`, the existing Wikipedia
  hairline already in the theme), `padding: 4px 8px`, `text-align: left` (numerics may be
  right-aligned by Parsoid classes — keep).
- Header shading: `th` gets `background: #eaecf0` (Wikipedia's table-header grey) and `font-weight:
  700`. **Grey, not indigo** — the article side stays Wikipedia. (`#eaecf0` with `#202122` text =
  well above AA.)
- `caption`: `font-weight: 700`, `font-size: 0.9rem`, `text-align: left`, `margin-bottom: 0.4em` —
  readable as the table's title (B1).
- `.wikitable` and Parsoid's default table classes map to this; bare `<table>` gets the same via the
  `.wiki-body table` selector.

### 4.2 Wide-table responsive behavior (B2, U4) — **decision: horizontal-scroll wrapper**

**Chosen treatment: wrap every data table in a horizontally-scrollable container** — *not* a
stacking/reflow transform. Rationale: stacking breaks the data relationships (a comparison table
becomes unreadable as stacked key/value pairs), and reflowing arbitrary Wikipedia tables is
unreliable. A contained horizontal scroll keeps the table intact and the rest of the article column
unbroken (B2), on both the narrow desktop article column and mobile (U4).

Spec:

- Each table is wrapped in `<div class="wiki-tablewrap" role="region" tabindex="0"
  aria-label="{caption or 'Data table'}">` with `overflow-x: auto; -webkit-overflow-scrolling:
  touch; max-width: 100%`.
- `tabindex="0"` + `role="region"` makes an overflowing table **keyboard-scrollable** and a
  landmark a screen-reader user can reach (a11y requirement, not optional — a scroll container that
  only a mouse can pan fails U7).
- When the table is wider than the wrapper, show a subtle right-edge **scroll affordance** (a soft
  inset shadow on the right via CSS) **and** a text hint below: *"Scroll table →"* (visible only when
  overflowing; text, not color/glyph alone — A7/B2). Hidden when the table fits.
- The wrapper must not let the table push the two-column grid wider: the article column already has
  `min-w-0`; the wrapper's `max-width: 100%` + `overflow-x` contains it. QA verifies the two-column
  shell does not widen (B2 guardrail / X3).

### 4.3 The two infoboxes — naming + placement (B3, B4, B8)

This resolves the **naming collision**. Two distinct objects, two distinct names, used everywhere
(docs + this spec + any component the spec drives):

| Name | What it is | Where | Visual language |
|---|---|---|---|
| **Wikipedia infobox** | The encyclopedia's own summary box (`table.infobox` from Parsoid) — taxonomy, key facts, the lead image. | **Left article column**, float-right at the top, like a `wikifig`. | **Faithful Wikipedia** (grey header rows, hairline borders). |
| **wiki+ panel** (formerly "the +plus infobox") | wiki+'s own counts/sync element — videos / creators / curators + synced status, or the empty-state "0 videos curated" CTA. `components/topic/Infobox.tsx`. | **Right rail**, top, sticky. | **Indigo Press** (indigo header block, hardbox border + offset shadow). |

**Decision (B8):** rename the wiki+ right-rail element from "+plus infobox" to **"wiki+ panel"** in
`docs/TOPIC_PAGE_DESIGN.md` and this spec, and reserve **"Wikipedia infobox"** exclusively for the
restored left-column encyclopedia box. (Renaming the *component file* `Infobox.tsx` is **out of
scope** per the Product spec — only the *naming in docs/design* is in scope; Dev may keep the
filename, but its doc-facing name is "the wiki+ panel.") This removes the ambiguity where "infobox"
could mean either.

**Wikipedia infobox styling & placement (B3):**

- It keeps **Wikipedia's visual language** — it is **not** restyled into Indigo Press (Product
  recorded assumption; "two worlds"). Style it like the existing `figure.wikifig` frame so it sits
  naturally in the float-right column flow:
  - `float: right`, `width: 320px`, `max-width: 42%` (matching `wikifig`'s float discipline so it
    and figures share one right-float lane in the article column), `margin: 0.2em 0 0.8em 1em`,
    `clear: right` (so it never overlaps a figure that floats below it), `border: 1px solid
    var(--color-wikirule)`, `background: #f8f9fa`, `font-size: 0.82rem`.
  - Header/`th` rows: `background: #eaecf0`, bold, centered (Wikipedia's infobox look).
  - Its image carries Commons credit + license (§4.5).
- **Position in the walk:** it floats at the **top of the lead** (it precedes the lead prose in
  Parsoid; keep it there so prose wraps around it, exactly as on Wikipedia).

> **#74 refinement (taxobox/infobox fidelity).** This round's single generic infobox CSS rule
> (`th { text-align: left }`, fixed `width: 320px`) mangled the classless **taxobox** (`infobox biota`),
> whose banners are raw `<th colspan="2">` rows styled only by stripped inline `style`. Issue #74
> re-targets `globals.css` to **structure-keyed** rules (mechanism option (a) — no DOMPurify allowlist
> change; `style` stays disallowed, X4 unchanged), per the build-time contract
> `docs/design/article-rendering-fidelity-survey.md` (Part 2): a **shared banner** primitive
> (`table.infobox th[colspan]` **and** modern `.infobox-above`/`.infobox-header`) renders centered,
> bold, grey `#eaecf0`, hairline-ruled at **both** breakpoints; key/value rows (`.infobox-label`/
> `.infobox-data`, taxobox `tr.taxonrow td`) are left-aligned; the taxobox floats slimmer
> (`width:22em`/`max 320px`); and `stripChrome` drops the non-functional `.taxobox-edit-taxonomy`
> pencil (D6). The per-taxon band **color** is a deliberate structural-only limit (banners are neutral
> grey; structure, not color, carries the section signal). See `docs/ARCHITECTURE.md` "Article
> rendering" → the infobox/taxobox layout decision.

**No-collision with the wiki+ panel (B4) — the key reassurance.** They **cannot** collide because
they are in **different grid columns**: the Wikipedia infobox floats *inside* the left article
column (`1fr`, `min-w-0`); the wiki+ panel lives in the right rail (`360px`). The grid gap (`gap-7`)
separates the columns. So at `lg+` there is structurally no overlap — the Wikipedia infobox floats
right *within its own column*, against the gutter, and the wiki+ panel is a separate column beyond
the gap. The spec requirement is simply: **the Wikipedia infobox's `max-width: 42%` keeps it from
consuming the article column**, and it must not be confused with the wiki+ panel — they are visibly
distinct (Wikipedia grey vs. Indigo Press indigo+hardbox). QA verifies both render with no overlap
at each breakpoint (§7).

### 4.4 Table & infobox link routing + precise strip list (B6, B7)

- Links inside tables and the Wikipedia infobox route via the **same** helpers: internal `/wiki/` →
  `/topic/` (`rewriteLinks`), external → new tab (`externalize`) — B6, no new mechanism.
- **Keep stripping genuine chrome (B7):** `.navbox`, `.metadata`, `.mbox-text`, `.ambox`,
  `table.sidebar`, `table.vertical-navbox` stay in `stripChrome`. **Remove only** `table.infobox`
  (now kept) from the strip list. The strip list must stay **precise**: data tables (`.wikitable`,
  bare `<table>`) and the Wikipedia infobox (`table.infobox`) are **not** caught; navboxes/metadata
  **are**. This is a Dev correctness concern verified against the live Parsoid markup of the seeded
  topics (per the Product build-session prerequisite); the **design outcome** is: the reader sees
  data tables + the infobox, and never sees a navbox or a maintenance banner.

### 4.5 Commons image credit + license (B5)

Images inside tables and the Wikipedia infobox carry the **same Commons credit + license** treatment
the lead/section figures already get (`cleanFigures`, the `.credit` block in `globals.css`, and the
"Wikimedia Commons images are individually licensed" rule in ARCHITECTURE):

- Each Commons image links to its **file page** (kept link, opening out per `externalize`), and shows
  its **credit + license** (e.g. the author + CC license string) in the small grey caption/credit
  type already defined (`figure.wikifig .credit`, `0.7rem`, `#72777d`).
- For an infobox lead image, the credit sits beneath the image within the infobox in the same small
  grey type. The article-text CC BY-SA 4.0 line (already in the masthead attribution) does **not**
  cover images — the per-file credit is required (ARCHITECTURE "Licensing & attribution").
- **Content-absent:** a table/infobox with no images simply has no credit block — nothing renders.

---

## 5. Group C — Math

The **render mechanism is Dev's** (it depends on inspecting live Parsoid output for the seeded
science topics — Product open question #2, recommendation: Parsoid MathML with the SVG/PNG fallback
image; C4 records the decision in code + ARCHITECTURE). UX specifies **how each should look** so the
result is legible, aligned, and non-overflowing regardless of mechanism:

### 5.1 Inline equations (C1)

- Sit **on the prose line** without disturbing leading: `vertical-align: middle` (or `-0.25em`
  baseline nudge as the markup requires); height capped to roughly the line box so a tall inline
  fraction does not blow up line spacing.
- Inherit prose color (`--color-ink`) and scale with surrounding text (relative units), so a
  fallback image is not pixelated and MathML matches the body. **No color introduced** — math is
  ink-colored, like the prose.
- Never overflow horizontally: an over-wide inline expression is allowed to wrap with the line, or
  (if atomic) gets the same `overflow-x` containment treatment as a tiny inline scroll is undesirable
  — so cap inline math at `max-width: 100%` and let it shrink/scroll only as a last resort.

### 5.2 Display (block) equations (C2)

- Render as their **own block**: `display: block`, `margin: 0.8em 0`, **horizontally centered**
  (Wikipedia convention) within the article column, `text-align: center`.
- **Must not overflow** the narrow article column or mobile: wrap a display equation in an
  `overflow-x: auto` container (same `wiki-tablewrap` discipline as wide tables, §4.2) with the
  keyboard-scrollable `role="region" tabindex="0" aria-label="Equation"` so a wide equation scrolls
  rather than breaking the layout — and is reachable by keyboard (U7).
- A MathML/SVG equation scales crisply; a PNG fallback image is `max-width: 100%; height: auto` so it
  never exceeds the column.

### 5.3 Math accessibility note (C, U7)

- **Prefer MathML** for the accessibility story (screen readers can read it); if Dev chooses a
  fallback **image**, it **must carry the equation's `alt`** (the TeX/`alttext` Parsoid provides) so
  it is not an unlabeled image (U7). This is a binding a11y requirement on whatever mechanism Dev
  picks — the spec does not pick the mechanism, but it does require the equation be **non-visually
  perceivable**.
- **Content-absent:** an article with no math (most non-science topics) renders no equation markup —
  nothing changes for it; the allowlist widening is inert when there is no math.

---

## 6. Group D — Navigational tail & hatnotes

### 6.1 Tail sections (D1, D3, D4)

**See also**, **Further reading**, **External links** (and genuinely explanatory **Notes** that are
not footnotes — Product recorded assumption) render as **ordinary article sections** at the foot,
removed from `DROP_SECTIONS`. (References is handled in Group A but is the first foot section, §2.)

- **Styling = faithful Wikipedia.** Same `wiki-body h2` serif heading + hairline rule as any section.
  **See also** is typically a bulleted list of internal links; **Further reading** a list of
  citations/works; **External links** a list of outbound links. They use the existing `.wiki-body
  ul/li/a` styles — no special styling, because they ARE ordinary article sections. They are visually
  distinct from prose simply by being lists under their own headings (as on Wikipedia).
- **Link routing (D3/D4):** See-also and internal hatnote/Further-reading links → `/topic/`
  (`rewriteLinks`, D3); External-links entries and external Further-reading entries → new tab
  (`externalize`, D4). Each external link carries the "opens in new tab" affordance (§8).

### 6.2 Hatnotes (D2)

Top **hatnotes** (disambiguation / "Not to be confused with…" / "See also" notes) render **above the
lead prose**, no longer stripped — but **styled distinctly from prose** so the reader reads them as
the editorial asides they are (D2 explicitly requires distinct-from-prose):

- Keep Wikipedia's hatnote convention: **italic, indented**, smaller (`font-size: 0.88rem`,
  `font-style: italic`, `color: var(--color-ink2)` `#595959`, `margin: 0 0 0.6em 1.6em`,
  `padding-left: 0`). This is Wikipedia's own hatnote look (indented italic) — faithful, and clearly
  not body prose. **No Indigo Press treatment** — it stays encyclopedia chrome.
- Internal links inside hatnotes route via `rewriteLinks` (D3). They sit in the masthead/lead block,
  above the first lead paragraph.
- A hatnote is **not** a callout card; do not give it a border/background/indigo accent.

### 6.3 Tail sections in the TOC & scroll-sync (D5, D6) — **video-less entries**

This is where the tail meets the existing scroll-sync, and it must be **real**, not hypothetical.
Grounding in current behavior: `TopicView.tocEntries` already maps **every** `article.sections`
entry to a TOC row, and `countFor(slug)` yields `0` for any section with no clip/candidate — those
already render today as a normal TOC row **with no count badge** (the `e.count > 0 && …` guard in
`Toc.tsx`). The tail sections, coming through the same walk (§2), inherit exactly this. So D5 is
mostly **free** — but the Product criterion asks for a *zero-video badge* consistent with the
existing empty-section treatment, and "video-less" should be legible, not just an absent badge.

**Spec (D5):**

- Tail sections (References, See also, Further reading, External links, Notes) appear as **ordinary
  TOC rows** via the same `tocEntries` mapping — **not special-cased out**. Their `count` is `0`
  (no clips/candidates anchor to them, and none should — they are reference/navigation, not topical
  content).
- **Video-less badge.** Add, for **zero-count** TOC rows, a small **text** badge **"no video"** (in
  the muted grey `--color-muted` `#717171`, `0.6rem`, uppercase, no border) right-aligned where the
  count badge would sit. This makes "this section has no curated video" an explicit, **text-labeled**
  signal (never color alone — A7/U7), rather than silence. It applies uniformly to **any**
  zero-count section (a content section with no videos today shows nothing; under this spec it shows
  "no video"), so the tail is not special-cased — it is the general zero-video treatment, which the
  tail happens to always hit.
  - *Curated mode:* "no video" muted text badge.
  - *Empty mode:* same "no video" badge (there are no curated clips at all in empty mode; the
    suggestion `~n` badges already cover sections with candidates, and a zero-candidate section shows
    "no video"). Keep it consistent with the existing dashed `~n` suggestion-badge language by
    *omitting* a dashed border on "no video" (it is an absence, not a suggestion count).
  - This is a **change to `Toc.tsx`'s badge logic** the spec drives: replace the bare `e.count > 0`
    silence with "show the count badge when `> 0`, else show the muted 'no video' text badge."
- **Scroll-sync (D6).** Because tail sections are real `.sec` wrappers with `setSectionRef`, the
  article→rail sync already tracks them: scrolling into "See also" sets it active and highlights its
  heading. But they bear **no rail item** (`railItems.find` returns nothing), so the rail does **not**
  scroll/jump for them — which is correct (there is no video to pair). The active-heading highlight
  still applies. **No clip is mis-anchored to a tail section (D6):** clips/candidates only anchor to
  content sections via `sectionSlug`; the matching pipeline already never targets dropped sections,
  and now that they are present, the rule stands — a tail section's `count` is `0`. QA verifies an
  active tail section highlights correctly and no clip lands on one (D6 / X3).
- **Notes-vs-footnotes (D7).** A "Notes" block that is actually footnotes is treated as **citations**
  (Group A — it feeds the popover/References system), not duplicated as a tail section. A genuinely
  explanatory "Notes" section is a tail section. Dev disambiguates per the live markup (Product
  recorded assumption); the **design outcome**: the reader never sees a "Notes" section duplicated,
  and footnotes always reach the citation system.

---

## 7. Responsive behavior (all groups)

Supported breakpoints follow the existing Topic page: **single column `< lg` (1024px)**, **two
column `lg+`** (`grid-cols-[1fr_360px]`). The rail/panel collapses below the article on `< lg`.

| Element | `lg+` (two-column) | `< lg` (single column) |
|---|---|---|
| Citation marker | inline in prose | identical (inline) |
| Citation popover | floats over article column, collision-flips | width `min(360px, 100vw − 2rem)`; flips/shifts to stay on-screen; on small screens may anchor centered-below |
| References section | foot of article, full width of article column | foot, full width |
| Data table | `wiki-tablewrap` horizontal scroll within `1fr` column | `wiki-tablewrap` horizontal scroll full bleed of the single column; "Scroll table →" hint shows when overflowing |
| Wikipedia infobox | float-right `320px / max 42%` in article column | **stacks full-width at the top of the lead** (no float on narrow — a 42% float in a single narrow column is unreadable). At `< lg`, drop the float: `float: none; width: 100%; max-width: 100%; margin: 0 0 1em`. This is the responsive intent for B2/B4 on mobile. |
| wiki+ panel | right rail, sticky | collapses to the top of the stacked rail (existing behavior) — no change |
| Inline math | on the line | on the line |
| Display math | centered block, scroll-wrap if wide | centered block, scroll-wrap if wide |
| Hatnotes | above lead, indented italic | above lead, indented italic |
| Tail sections / TOC rows | foot / TOC rows with "no video" badge | foot / TOC rows with "no video" badge |

**The two infoboxes never collide on any breakpoint:** at `lg+` they are in different grid columns;
at `< lg` the Wikipedia infobox is full-width-stacked in the article flow and the wiki+ panel is in
the collapsed rail below — different stacked blocks, no overlap (B4).

---

## 8. Microcopy

| Context | Copy |
|---|---|
| Inline citation marker `aria-label` | `Citation {n}` (or `Footnote {n}`) |
| References section heading | **References** (Wikipedia's own heading text is kept if present; default "References") |
| Popover "go to list" footer link | **View in References ↓** |
| Reference back-link `aria-label` | `Back to citation {n}` (multi: `Back to citation {n}, instance a/b/c`) |
| External link "opens in new tab" affordance | a trailing **↗** glyph **plus** `aria-label="… (opens in new tab)"` / `title="opens in new tab"` — text label, never the glyph alone (A7) |
| Wide-table overflow hint | **Scroll table →** (shown only when the table overflows its wrapper) |
| Table region `aria-label` | the table's `caption` text, else `Data table` |
| Display-math region `aria-label` | `Equation` |
| Video-less TOC badge | **no video** (muted grey, uppercase, no border) |
| Wikipedia-infobox region label (a11y) | the infobox keeps Wikipedia's own caption/title; no extra label needed |

Tone: neutral, encyclopedic on the article side (these are Wikipedia-chrome labels), matching the
faithful-Wikipedia voice — not the playful +plus voice.

---

## 9. Every state — what renders

For each restored element, the **loading**, **error**, **populated**, and **content-absent** states:

| Element | Loading | Error | Populated | Content-absent |
|---|---|---|---|---|
| Citations | covered by `ArticleSkeleton` (whole article fetch); no separate skeleton | covered by `ArticleError` (whole-article fetch failure) | markers + popover + References section | **No `[n]` in the article** → no markers, no References section renders (don't render an empty "References" heading). **A citation with no external link** → popover/entry shows the citation text with no outbound link (no broken/empty link). **A reference cited from multiple places** → multiple labeled back-refs (§3.4). |
| Data tables | within `ArticleSkeleton` | within `ArticleError` | styled table in scroll-wrap | **No tables** → nothing renders; `.wiki-tablewrap` never appears. |
| Wikipedia infobox | within `ArticleSkeleton` | within `ArticleError` | float-right infobox at lead top | **No infobox** (many articles) → nothing renders; lead prose simply starts full-width. The wiki+ panel is unaffected (it is always present on the right). |
| Math | within `ArticleSkeleton` | within `ArticleError` | inline/display equation | **No math** → no equation markup; inert. |
| Hatnotes | within `ArticleSkeleton` | within `ArticleError` | indented italic note above lead | **No hatnote** → nothing above the lead; lead starts normally. |
| Tail sections | within `ArticleSkeleton` | within `ArticleError` | foot sections + TOC rows | **No See-also/etc.** → that section and its TOC row simply do not exist (the walk produced no such section). The TOC has no orphan row. |

There are **no new top-level loading/error states** — every restored element rides the existing
single article fetch (`fetchState` loading → `ArticleSkeleton`; error → `ArticleError`; ready →
content). The popover has its own micro-states: closed (default), open (content shown). The popover
never shows a spinner — the citation text is already in the fetched article HTML, so it is
synchronous on open. **Content-absent is the common case for infobox/tables/math/hatnotes** on most
articles, and the rule is uniform: **render nothing, change nothing** — the feature is additive and
inert when the content is not present.

---

## 10. Accessibility checklist (Dev builds to it; QA verifies it)

Restating the CLAUDE.md baseline as a verifiable checklist for this feature (A7 and U7 across all
groups):

- [ ] **Keyboard — citation marker:** focusable (`Tab`), activatable (`Enter`/`Space`), opens the
      popover. (A7)
- [ ] **Keyboard — popover:** focus moves into it on open; `Esc` closes and **returns focus to the
      marker**; "View in References" jumps focus to the reference entry. No focus trap on the page
      (non-modal). (A7)
- [ ] **Keyboard — back-link:** activatable; returns focus to the inline marker. (A4)
- [ ] **Keyboard — table:** an overflowing `wiki-tablewrap` is `tabindex="0"` `role="region"` and
      scrollable by keyboard. (B2)
- [ ] **Keyboard — display math:** a wide equation's scroll region is `tabindex="0"` `role="region"`.
- [ ] **Focus visibility:** the global 3px indigo `:focus-visible` ring is present on every new
      control (marker, back-link, popover controls, table region). (CLAUDE.md)
- [ ] **AA contrast:** citation marker `#3366cc` on article bg (≥4.5:1 verified); table header text on
      `#eaecf0`; "no video" badge `#717171` on white (≥4.5:1 verified — value, not assumption); the
      "Scroll table →" hint and the "opens in new tab" affordance all meet AA. QA re-runs the checks.
- [ ] **Never color alone:** citation = literal `[n]` text; external-link = ↗ **glyph + label**;
      video-less = the word **"no video"**; table-overflow = the words **"Scroll table →"**;
      table-header shading is reinforced by `<th>` semantics + bold, not color only. (A7/U7)
- [ ] **Text labels / ARIA:** marker `aria-label`, back-link `aria-label`, table region
      `aria-label`, equation region `aria-label`, "opens in new tab" `aria-label`/`title`. (A7)
- [ ] **MathML a11y:** prefer MathML (reader-legible); a fallback image **must** carry the equation
      `alt`/`alttext` — no unlabeled equation image. (C / U7)
- [ ] **Scroll-sync not broken by the popover:** opening a popover does not move scroll or change the
      active-section highlight; a screen-reader/keyboard user's reading position is preserved. (A2)
- [ ] **Reduced motion:** any popover open animation is gated by `prefers-reduced-motion` (reuse the
      existing pattern in `globals.css`). (existing baseline)
- [ ] **Hatnotes** are perceivable as asides (italic + indent) and their links are keyboard-operable.

---

## 11. What Development should build (summary of the contract)

1. **Group A — citations:** keep `sup.reference` markers (stop stripping); render them as focusable
   Wikipedia-blue `[n]` buttons (§3.2); build the click/keyboard-triggered **Radix-based popover**
   (§3.3) showing the citation text, non-modal, scroll-closing, not touching scroll-sync; keep the
   **References section** as a real foot section with working numbered **back-links** (§3.4);
   exempt cite/backref anchors from de-linking and route citation links via `rewriteLinks`/
   `externalize` (§3.5).
2. **Group B — tables & infobox:** remove `.wiki-body table { display:none }`, style tables faithfully
   (§4.1) and wrap each in a keyboard-scrollable `wiki-tablewrap` with the overflow hint (§4.2);
   stop stripping `table.infobox`, float it right in the article column with the `wikifig`-style
   frame (§4.3), stacking full-width `< lg`; keep the precise navbox/metadata strip list (§4.4);
   carry Commons credit+license on table/infobox images (§4.5). **Rename "the +plus infobox" → "the
   wiki+ panel"** in docs (B8, §4.3).
3. **Group C — math:** widen the allowlist for the chosen math markup (Dev decides the mechanism from
   live Parsoid output, records it per C4); style inline (§5.1) and display (§5.2) per spec; ensure
   the equation is non-visually perceivable (§5.3).
4. **Group D — tail & hatnotes:** remove tail sections from `DROP_SECTIONS` so they come through the
   walk as real sections (§6.1); render hatnotes above the lead, distinct (§6.2); update `Toc.tsx` so
   zero-count rows show a **"no video"** text badge (§6.3); verify scroll-sync tracks tail sections
   and no clip mis-anchors (§6.3 / D6).
5. **All states + a11y:** implement the content-absent rules (§9 — render nothing when absent) and the
   accessibility checklist (§10).

**Out of UX's lane (Dev/elsewhere):** the math *render mechanism* (depends on live Parsoid output —
C4); the link-routing *mechanics* (reuse `rewriteLinks`/`externalize`); the exact DOMPurify allowlist
entries and the sanitize-still-blocks-XSS guarantee (X4); the precise Parsoid class selectors for the
strip list (verified against live markup). UX has resolved every open question in its lane:
citation-interaction = **both** (§3.1), infobox naming (§4.3, B8), responsive treatment of wide
tables = **scroll-wrap** (§4.2) and the infobox = **float `lg+` / stack `< lg`** (§7), video-less TOC
= **"no video" text badge** (§6.3).

---

## 12. Evaluation (post-build, UX)

After Development ships, UX evaluates the running UI against this spec + the user stories (U1–U7),
distinct from QA's correctness pass:

- **Fidelity:** does the article column *read as Wikipedia*? Markers, tables, infobox, math, tail all
  in Wikipedia's visual language; no Indigo Press bleed into the article (the governing principle).
- **Interaction feel:** popover opens where expected, doesn't fight scroll-sync, dismisses naturally;
  the marker↔reference round-trip is quick; wide tables scroll without breaking the page.
- **Usability heuristics:** content-absent cases render nothing (no empty headings, no orphan TOC
  rows); the "no video" badge reads as informative, not as an error.
- **A11y-in-practice:** keyboard-walk every control; screen-reader-announce a marker, a back-link, a
  table region, an equation; confirm color-blind legibility (text labels carry the signal).

Design defects route back to **Development**; a pass signals the feature meets design intent.
