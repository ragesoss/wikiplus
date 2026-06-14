# Spec: Prototype V1 — Full Indigo Press Topic Page

**Status:** Ready for development
**Branch target:** `claude/todo-prototype-build-ob23be`
**Builds on:** current scaffold (Next.js 15, static export, localStorage DataStore)
**Reference design:** `mockups/inline-indigo-sync.html`

---

## Overview

The goal is to bring the live GitHub Pages app from its current minimal scaffold
(`TopicView.tsx` with a two-column grid, extract-only article text, and flat clip
cards) to the full **Indigo Press** design shown in the reference mockup.

Every element of the page must feel like two distinct worlds deliberately placed
side by side: the **Wiki side** (faithful Wikipedia look — Georgia serif, blue
wikilinks, hairline rules) and the **+plus side** (Indigo Press: `#676EB4`
header blocks, hardbox cards with 2px ink border + 4px offset shadow, Source
Sans Pro display type, Open Sans body).

The prototype runs entirely client-side. There is no server, no auth, and no
oEmbed resolution. The `DataStore` seam stays untouched — this spec adds UI
only, plus one new fetch in `lib/wiki/article.ts`.

**Success metric:** A reviewer can open the deployed GitHub Pages app, navigate
to a topic that has at least one seeded clip, and verify all ten acceptance
criteria below without deviation from the reference mockup's visual language.

---

## Feature 1 — Wikipedia article body (sections + headings)

**Problem:** `lib/wiki/article.ts` today fetches only the `/page/summary/` endpoint,
which returns a short extract. The reference design shows a full article body with
h2 section headings (each underlined with a hairline rule), paragraphs per section,
and wikilinks styled in Wikipedia blue (`#3366cc`).

**What to build:**

Add a second fetch to `lib/wiki/article.ts` using the MediaWiki REST API endpoint
`/api/rest_v1/page/html/{title}` (CORS-enabled for anonymous GET). Parse the
returned HTML client-side: extract h2-level sections (id, heading text, and
paragraph HTML). Sanitize the full response with DOMPurify before any insertion.
Rewrite internal wikilinks (`href` starting with `/wiki/`) to `/topic?qid=` — for
the prototype, a best-effort title-to-route mapping is fine (exact QID resolution
per ARCHITECTURE is a production concern). Strip editor chrome: `[edit]` section
links, `.mw-references-wrap`, `.navbox`, `.hatnote` navigation banners, and
`<style>` tags.

Extend `ArticleSummary` (or introduce a parallel `ArticleBody` type) to carry:

```ts
sections: Array<{
  id: string;         // slug from the heading's id attribute, e.g. "Light-dependent_reactions"
  title: string;      // plain text of the heading
  level: number;      // 2 | 3 (h2 | h3)
  html: string;       // sanitized paragraph HTML for this section
}>
```

**Acceptance criteria:**

- AC-1.1: The Wikipedia article title renders in Georgia serif, with a hairline
  `#a2a9b1` border-bottom, below a "From Wikipedia · CC BY-SA 4.0" attribution
  line linking to the article URL on en.wikipedia.org.
- AC-1.2: The article lead paragraph(s) render as sanitized HTML, matching the
  Wikipedia body font style (sans-serif, 0.95rem, line-height 1.65).
- AC-1.3: Each h2 section heading renders in Georgia serif at 1.5rem with a
  hairline `#a2a9b1` border-bottom; h3 headings render at 1.2rem with no rule.
- AC-1.4: Wikilinks render in `#3366cc`, underline on hover, and navigate to
  `/topic?qid=<title>` within the app rather than out to Wikipedia.
- AC-1.5: No raw `[edit]` buttons, reference back-links, navboxes, or `<style>`
  tags appear in the rendered article.
- AC-1.6: The DOMPurify sanitizer runs before any HTML is set via
  `dangerouslySetInnerHTML`; no unsanitized third-party HTML is ever inserted.

---

## Feature 2 — Topic page layout and header

**Problem:** The current layout is a bare `grid gap-8 lg:grid-cols-[1.2fr_1fr]`
with a simple app-wide header. The reference design has a sticky two-column
header that labels the two worlds, a three-zone body layout (masthead / general
strip / reader), and a sticky plus-rail inside the reader zone.

**What to build:**

Replace `app/layout.tsx`'s generic header with the two-column sticky topic
header exactly as in the mockup:

- Left slot: `Wiki` in Georgia serif 24px + `the encyclopedia article` small-caps
  label + topic title (truncated, muted, right-aligned) — all at `h-16`, sticky,
  `border-b-2 border-ink`.
- Right slot (lg+ only): `＋plus` indigo block (`bg-[#676EB4]`, hardbox-sm border,
  `plus-disp` Source Sans Pro 900, white text) + `curated video` label.

The header is topic-specific. The home page and contribute page keep a simpler
header (they are out of scope for this spec's visual redesign).

Restructure `TopicView.tsx` into three layout zones:

1. **Masthead** (`max-w-[1200px] mx-auto px-5 pt-5 grid lg:grid-cols-[1fr_360px]`):
   left = article title + attribution + lead paragraph(s); right = sticky
   `top-16` aside containing the +plus infobox card and the TOC card.
2. **General strip** (full-bleed `border-y-2 border-ink bg-[#676EB4] my-7`):
   indigo band spanning both columns, containing the horizontally scrollable
   general clip tiles.
3. **Reader** (`max-w-[1200px] mx-auto px-5 grid lg:grid-cols-[1fr_360px]`):
   left = article body sections; right = sticky plus rail (mini-TOC + section
   clip cards).

**Acceptance criteria:**

- AC-2.1: The sticky header is exactly `h-16`, has a `border-b-2 border-[#2C2C2C]`
  rule, and does not overlap article content at any scroll position.
- AC-2.2: The `＋plus` header block is rendered in `bg-[#676EB4]` with 2px ink
  border and 4px ink offset shadow (hardbox-sm), visible only at `lg:` breakpoint
  and above.
- AC-2.3: The masthead left column shows the article title and lead; the right
  column shows the +plus infobox card and TOC card, both sticky at `top-16`.
- AC-2.4: The general strip is visually full-bleed (no max-width container clipping
  the indigo band itself), with the strip content constrained inside the standard
  `max-w-[1200px] px-5` wrapper.
- AC-2.5: The reader right column is a sticky scrollable aside (`sticky top-16
  h-[calc(100vh-4rem)] overflow-y-auto`) independent of the main page scroll.
- AC-2.6: Below the `lg:` breakpoint the layout is single-column (article above,
  plus rail below or hidden); no horizontal overflow occurs on a 375px viewport.

---

## Feature 3 — +plus infobox card

**Problem:** There is no infobox. The reference shows an indigo-header card with
three stat cells (video count, creator count, curator count) and a "synced"
status line.

**What to build:**

A `PlusInfobox` component inside the masthead right-column aside. Receives
`clipCount`, `creatorCount`, and a synced status string as props computed from
the `clips` array in `TopicView`. For the prototype, `curatorCount` can be derived
by counting distinct `clip.creator.handle` values (a stand-in; production will use
a real curator field).

Structure:

- Outer `.plus-card` (white background, 2px ink border, 4px ink offset shadow).
- Header row: `bg-[#676EB4]` with `＋plus this topic` label in white Source Sans
  Pro, `border-b-2 border-ink`.
- Stat grid: 3 equal columns, `divide-x-2 divide-ink`. Each cell: big number in
  `#676EB4` Source Sans Pro 900, small all-caps label in `#595959`.
- Synced row: `border-t-2 border-ink`, teal dot (`#2A8270`), text `"synced · N
  shown"`.

**Acceptance criteria:**

- AC-3.1: The infobox card shows clip count, creator count, and a third count cell.
  All three are derived from the live `clips` state, not hardcoded.
- AC-3.2: The indigo header block is `bg-[#676EB4]` and the stat numerals use
  Source Sans Pro 900.
- AC-3.3: The card uses the hardbox style: `border-2 border-[#2C2C2C]
  shadow-[4px_4px_0_#2C2C2C]`.
- AC-3.4: When there are zero clips the stat cells show `0` (not blank or
  undefined).

---

## Feature 4 — Table of contents with clip-count badges

**Problem:** There is no TOC. The reference shows two TOC instances: a full one
in the masthead right-column card and a collapsible mini-TOC at the top of the
right clip rail.

**What to build:**

A `TableOfContents` component that accepts `sections` (from `ArticleBody`) and
`clipsBySection` (a `Record<string, Clip[]>` keyed by `sectionAnchor`) plus a
`currentSectionId` string prop (driven by scroll spy, see Feature 6).

TOC rows:

- First row: `＋ General` linking to `#general` strip; badge shows count of clips
  with no `sectionAnchor` (or `sectionAnchor === "general"`).
- One row per article section; indent by `(level - 2) * 12px`; badge shows count
  of clips anchored to that section (omit badge if 0).
- Active row (`currentSectionId` match): text `#676EB4`, `font-bold`.
- Clicking a row smooth-scrolls to the section heading (or the general strip for
  the General row).

The full TOC renders in the masthead aside (dark `#2C2C2C` header card, `Contents`
label in Source Sans Pro). The mini-TOC renders in the reader right-rail: a
collapsible (`aria-expanded`) toggle button showing the current section title,
expanding to the same row list.

**Acceptance criteria:**

- AC-4.1: The TOC lists `＋ General` first, then every h2/h3 section from the
  article body, in document order.
- AC-4.2: Sections with at least one anchored clip show a count badge styled as
  a `border-2 border-ink text-[#676EB4] bg-white` chip.
- AC-4.3: The currently-in-view section's TOC row is highlighted `text-[#676EB4]
  font-bold` in both the full TOC and the mini-TOC.
- AC-4.4: Clicking a TOC row scrolls the article to that section (smooth, offset
  by the sticky header height so the heading is not hidden behind the bar).
- AC-4.5: The mini-TOC button is keyboard operable, shows `aria-expanded`, and
  shows the name of the current section when collapsed.

---

## Feature 5 — General strip

**Problem:** There is no general strip. The reference shows a full-bleed indigo
band with horizontally scrollable tile cards for clips with no section anchor.

**What to build:**

A `GeneralStrip` component. Receives the subset of `clips` where `sectionAnchor`
is absent or equal to `"general"`.

Each tile: fixed width 176px (`w-44`), thumbnail placeholder (gradient in brand
colors), platform tag badge (YouTube red, TikTok pink), play button circle in
indigo, clip title (two-line clamp), creator handle in muted white.

For the prototype, thumbnails are static gradient placeholders — no oEmbed fetch.
The placeholder gradient uses brand colors (`from-[#676EB4] to-[#5248AF]` for
YouTube, `from-[#ec4899] to-[#be185d]` for TikTok). Clicking a tile opens the
embed modal (see Feature 7).

The strip header shows: `＋ General` display type, a clip-count badge, and a
`see all` link that scrolls back to the strip anchor.

**Acceptance criteria:**

- AC-5.1: The strip background is `bg-[#676EB4]`, `border-y-2 border-[#2C2C2C]`,
  full viewport width.
- AC-5.2: The tile row scrolls horizontally; the right edge fades with a CSS mask
  (`gridfade`); custom scrollbar uses ink color.
- AC-5.3: Each tile shows a thumbnail placeholder, a platform badge, the clip
  title (truncated to 2 lines), and the creator handle.
- AC-5.4: The clip-count badge renders as an ink-bordered white chip with indigo
  text, e.g. `3 videos`.
- AC-5.5: When there are no general clips the strip is hidden entirely (not just
  empty).
- AC-5.6: The strip has a `scroll-mt-20` so TOC navigation lands correctly below
  the sticky header.

---

## Feature 6 — Section-synced clip rail

**Problem:** The current right column is a flat list of `ClipCard` components with
no section awareness, no scroll sync, and no visual highlighting.

**What to build:**

Replace the flat right-side clip list with a section-synced rail. Clips in the
rail are ordered by their `sectionAnchor` (in article-section document order).
Only clips with a `sectionAnchor` that is neither absent nor `"general"` appear
here.

**Scroll sync** (bidirectional, via `IntersectionObserver` or `getBoundingClientRect`
on RAF-throttled scroll):

- **Article → rail:** as the user scrolls the article, when a section heading
  crosses the reading threshold (`64px` sticky header + `120px` offset), the
  corresponding clip card becomes *active*: `border-color: #676EB4`,
  `box-shadow: 6px 6px 0 #676EB4`. The rail scrolls to bring that card into view
  (offset by the mini-TOC sticky header).
- **Rail → article:** when the user scrolls the right rail, the article scrolls to
  the section whose clip card is nearest the vertical center of the rail.
- Both directions use a lock flag (180ms debounce) to prevent feedback loops.

The section heading in the article corresponding to the active card gains an
indigo left-bar highlight: `box-shadow: -10px 0 0 #676EB4` with a light indigo
gradient tint on the background.

**Acceptance criteria:**

- AC-6.1: Each section-anchored clip card renders in the right rail in article
  section order.
- AC-6.2: Scrolling the article to a section that has clip(s) causes the
  corresponding card(s) to gain `border-[#676EB4]` and `shadow-[6px_6px_0_#676EB4]`
  within one animation frame.
- AC-6.3: The active article section heading gains the indigo left-bar treatment
  (`box-shadow: -10px 0 0 #676EB4`) while it is active.
- AC-6.4: Scrolling the right rail drives the article scroll to the corresponding
  section (bidirectional sync).
- AC-6.5: No infinite scroll loop: the lock flag prevents article-rail-article
  ping-pong.
- AC-6.6: Each card shows a `↳ Section name` section-link button above the
  thumbnail; clicking it scrolls the article to that section.

---

## Feature 7 — Clip card (full Indigo Press style)

**Problem:** `ClipCard.tsx` is a minimal card. The reference design has a richly
structured hardbox card: duotone thumbnail, platform badge, play button, stance
chip, accuracy chip, curator note block, creator avatar, upvote count, and curator
credit.

**What to build:**

Rewrite `ClipCard.tsx` to match the reference exactly. The component receives a
`Clip` (from `lib/data/types.ts`) and renders:

- **Thumbnail area**: aspect-ratio container (`aspect-[9/16]` for vertical,
  `aspect-video` for horizontal) with a gradient placeholder (`from-[#676EB4]
  to-[#5248AF]` default). Overlaid: platform badge (top-left), indigo play-circle
  button (centered). Duotone overlay: `linear-gradient(135deg, rgba(103,110,180,.45),
  rgba(82,72,175,.22))` at `mix-blend-mode: multiply`. Clicking the play button
  opens the embed modal.
- **Creator row**: circular avatar (gradient placeholder), `creator.displayName`
  bold 12px, `creator.handle · platform` muted 11px.
- **Chips row**: stance chip (`bg-[#676EB4]`, white text, 2px ink border) + accuracy
  chip (teal `#2A8270` for accurate, action blue `#1F6F95` for caveated, red
  `#C44949` for opinion/mixed, white text, 2px ink border). Both chips are
  text-labeled (never color alone).
- **Context note block**: left-border `border-l-4 border-[#676EB4]`, `bg-[#F0F1F3]`
  background, `Curator note` small-caps label in `#5248AF`, body text 12px in
  `#595959`.
- **Footer row**: upvote count in indigo, curator credit + date in muted ink.

The card outer container uses `border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C]`
(hardbox). Active-state classes (`border-[#676EB4]`, `shadow-[6px_6px_0_#676EB4]`)
are applied by the parent rail when the card is section-active (Feature 6).

**Embed modal:** clicking the play button on a YouTube clip opens a modal overlay
(`fixed inset-0 bg-black/80`) with an `<iframe>` for the embed URL. TikTok and
other platforms open in a new tab (`window.open`). The modal closes on overlay
click, close button click, or `Escape` key. The close button and overlay backdrop
are keyboard-accessible.

**Accuracy chip color mapping** (from `AccuracyFlag` in `lib/data/types.ts`):

| `accuracyFlag` value | Chip color |
|---|---|
| `"accurate"` | teal `#2A8270` |
| `"mostly-accurate"` | action blue `#1F6F95` |
| `"mixed"` | action blue `#1F6F95` |
| `"misleading"` | red `#C44949` |
| `"inaccurate"` | red `#C44949` |

**Acceptance criteria:**

- AC-7.1: The clip card renders the thumbnail placeholder with the duotone overlay,
  platform badge, and centered play-circle button.
- AC-7.2: Stance chip background is `#676EB4`; accuracy chip background follows
  the mapping table above. Both chips carry text labels readable without color.
- AC-7.3: The context note block has `border-l-4 border-[#676EB4]` and displays
  the `Curator note` label above the `contextNote` text.
- AC-7.4: Clicking the play button on a YouTube clip opens the modal with an
  embedded `<iframe>`; the `Escape` key and close button both dismiss it.
- AC-7.5: The card outer box is `border-2 border-[#2C2C2C] shadow-[4px_4px_0_#2C2C2C]`
  at rest.
- AC-7.6: All text within the card meets AA contrast against its background
  (verified manually against the palette).

---

## Feature 8 — Home page search

**Problem:** The home page lists seeded topics but has no way to look up an
arbitrary Wikipedia article.

**What to build:**

Add a search input to `app/page.tsx` that queries the MediaWiki
`opensearch` API (`https://en.wikipedia.org/w/api.php?action=opensearch&...&origin=*`)
as the user types (debounced 300ms). Display up to 5 suggestions as a dropdown
list. Selecting a suggestion navigates to `/topic?qid=<resolved_title>` — for the
prototype, pass the Wikipedia title as a query param and let `TopicView` resolve
it to a QID via the existing `qidToTitle` call (or, more simply, rewrite the
search to pass `title=` and resolve in `TopicView`). The search input is the
primary call to action on an otherwise sparse home page.

**Acceptance criteria:**

- AC-8.1: A text input is visible on the home page with placeholder text indicating
  it searches Wikipedia articles.
- AC-8.2: Typing at least 2 characters triggers an `opensearch` request (debounced
  300ms) and renders up to 5 suggestions below the input.
- AC-8.3: Clicking a suggestion navigates to the topic page for that Wikipedia
  article.
- AC-8.4: The input and suggestion list are keyboard navigable (arrow keys move
  focus through suggestions, Enter activates the focused suggestion, Escape closes
  the dropdown).
- AC-8.5: The existing topic list below the search box is unchanged and continues
  to render topics from localStorage.

---

## Feature 9 — Contribute page: Wikipedia title auto-resolve

**Problem:** The contribute form requires a QID but provides no helper to find one.

**What to build:**

On the existing contribute form (`app/contribute/page.tsx`), add:

- A **Wikipedia article URL or title** text input (above the QID field, or
  replacing it as the primary input). On blur (or after a debounced 500ms), if
  the value looks like a Wikipedia URL or a plain title string, resolve it to a
  QID via the existing `qidToTitle` helper (or its inverse: title → QID via the
  Wikidata sitelinks API) and auto-fill the QID field.
- Display the resolved article title alongside the QID as a confirmation hint, e.g.
  `"Resolved: Photosynthesis (Q34687)"`.

This does not change any other part of the contribute form.

**Acceptance criteria:**

- AC-9.1: A "Wikipedia article title or URL" input appears on the contribute form.
- AC-9.2: On blur, if the input is a valid Wikipedia article title or a
  `en.wikipedia.org/wiki/` URL, the QID field is auto-populated.
- AC-9.3: A confirmation hint shows the resolved article title and QID.
- AC-9.4: If resolution fails (article not found), a clear inline error message
  is shown and the QID field is not modified.
- AC-9.5: The rest of the contribute form (video URL, context note, stance,
  accuracy flag) is unchanged and continues to submit correctly.

---

## Feature 10 — Accessibility and CC BY-SA baseline

**Problem:** The current scaffold has no explicit accessibility work beyond default
HTML semantics, and the CC BY-SA attribution is a small text line that will be
easy to lose in a redesign.

**What to build:**

No separate component — this is a cross-cutting constraint on all of the above
features.

- **CC BY-SA attribution:** the article title area in the masthead left column
  must include `From Wikipedia · CC BY-SA 4.0` with a link to the article's
  Wikipedia URL, visible on every topic page render, at every viewport size.
- **Focus-visible states:** every interactive element (TOC links, clip play
  buttons, modal close, embed buttons, search input, search suggestions) must
  show `:focus-visible` outline `3px solid #676EB4 offset 2px`.
- **Color-alone prohibition:** stance and accuracy information must always include
  a text label alongside the color chip. No signal should be expressed by color
  alone anywhere in the product.
- **Keyboard navigation:** the modal must trap focus while open; the mini-TOC
  toggle, the embed play buttons, and the search suggestion dropdown are all
  keyboard-operable (per ACs in their respective features).
- **ARIA:** the article `<main>` has `aria-label="Wikipedia article"`, the plus
  rail `<aside>` has `aria-label="wiki+ curated videos"`, the general strip has
  `role="list"` on the tile row.

**Acceptance criteria:**

- AC-10.1: `From Wikipedia · CC BY-SA 4.0` with a working external link to the
  Wikipedia article is visible in the article masthead on every topic page.
- AC-10.2: Tab-cycling through the topic page reaches every interactive element;
  each receives a visible `3px solid #676EB4` focus ring.
- AC-10.3: No information is conveyed by color alone: all chips include text labels,
  all status states include text or icon-with-label.
- AC-10.4: Pressing `Escape` closes the embed modal from any focused element
  within it.
- AC-10.5: `yarn build` produces no TypeScript errors and no React
  `key`-prop or `aria` warnings in the build output.

---

## Non-goals for this spec

- Server-side rendering, Postgres, Redis, Auth.js, Docker — all deferred.
- Full Wikipedia article text beyond parsed sections (lead + h2/h3 headings +
  paragraph HTML is sufficient).
- Real oEmbed thumbnail fetching — static gradient placeholders throughout.
- Upvote interactivity — render `upvotes` from the Clip record (defaulting to 0)
  but no click handler.
- Mobile single-column scroll-sync collapse — single-column layout is required
  (AC-2.6) but the scroll-sync behavior on mobile is not required; the right rail
  can simply stack below the article on narrow viewports.
- Empty-state auto-suggestion candidates — the contribute form + seeded localStorage
  data is the only clip-population path in the prototype.
- Moderation, reputation, or multi-user concerns.

---

## Data model notes

No changes to `lib/data/types.ts` are required. The existing `Clip` type already
carries all fields needed: `sectionAnchor` (maps to section-sync), `stance`,
`accuracyFlag`, `contextNote`, `creator`, `platform`, `videoId`, `timestampSeconds`.

The `ArticleSummary` interface in `lib/wiki/article.ts` needs a `sections` array
added (see Feature 1). That is the only data-shape change.

For scroll-sync, `TopicView` will need to derive two maps from the clip list:
`generalClips` (where `!sectionAnchor || sectionAnchor === "general"`) and
`clipsBySection` (`Record<string, Clip[]>` keyed by `sectionAnchor`). These are
in-component derived values, not stored state.

---

## Open questions

1. **Section-anchor matching:** `clip.sectionAnchor` stores a slug string (e.g.
   `"Light-dependent_reactions"`). The parsed article sections have an `id` from
   the MediaWiki HTML. Are these reliably the same slug format? If not, a
   normalize-and-fuzzy-match step is needed. Dev should verify against a real
   article and add a fallback to `"general"` on mismatch (per ARCHITECTURE).

2. **`/api/rest_v1/page/html/` response size and latency:** the full article HTML
   for a long Wikipedia article can be several hundred kilobytes. Dev should
   measure load time on a mobile connection and decide whether to lazy-load the
   article body sections (render the lead first, then fetch the body in a
   subsequent call) or accept a single larger fetch with a loading skeleton.

3. **Orientation detection for prototype clips:** `Clip.platform` is available but
   there is no `orientation` field in the current `types.ts` (ARCHITECTURE names
   it on the production `clip` table). Should the prototype add `orientation?:
   "vertical" | "horizontal"` to `Clip` in `types.ts`, defaulting to `"vertical"`
   for TikTok/Instagram and `"horizontal"` for YouTube? This affects clip card
   thumbnail aspect ratio. Decision deferred to Dev; default-to-vertical is the
   safe prototype choice.

4. **Seed data:** the existing seed data in localStorage may not have `sectionAnchor`
   values populated. Dev should update the seed fixture in `lib/data/` with at
   least two clips that carry distinct `sectionAnchor` values so the scroll-sync
   feature can be demonstrated end-to-end.
