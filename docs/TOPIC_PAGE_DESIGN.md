# wiki+ — Topic Page Design Direction

The chosen design for the core Topic page, settled through the mockup rounds in `mockups/`.
The reference mockup is **`mockups/inline-indigo-sync.html`** — the committed layout/interaction
model with the committed **"Indigo Press" plus identity** (see *Plus visual identity* below).
The structure, interaction model, and color system below are the committed direction; finer
visual details will be refined during implementation. (`mockups/inline-neon-sync.html` is the
earlier same-layout exploration that used a neon palette, kept for reference.)

## The two worlds

A Topic page presents two deliberately contrasting visual languages, split by column:

- **"Wiki" (left column)** — the real Wikipedia article, styled to look like Wikipedia:
  serif title and section headings with hairline rules, sans-serif body, blue wikilinks, and
  right-floated captioned figures (Wikimedia Commons images). The article is **never disrupted**
  by video — it reads as the encyclopedia.
- **"＋plus" (right column)** — everything wiki+ adds, in a colorful, playful, short-form-video
  visual language (the "Indigo Press" treatment — see *Plus visual identity*). Practicality,
  usability, and accessibility are the baseline (contrast, focus states, keyboard support,
  text-labeled signals — never color alone).

The wordmark is **split to label the columns**: "Wiki" sits over the article column, "＋plus"
over the plus column.

> **Implementation note (per ARCHITECTURE).** The article body is fetched and rendered
> **client-side** from Wikipedia (sanitized), and its **wikilinks resolve to internal wiki+
> topics** (`/topic/…`), not out to Wikipedia. The reference mockups render the article
> statically and link externally — a mockup simplification, not the intended behavior.

## Plus visual identity — "Indigo Press"

The ＋plus side has a bold, editorial "zine" treatment, recolored from the **Wiki Education
Dashboard** brand palette so wiki+ reads as part of that brand world. Defining traits:

- **Light, editorial cards** — white/very-light panels with **2px ink (`#2C2C2C`) borders and
  solid offset drop-shadows**, big numerals for counts, chunky count tags, color-blocked panels,
  and bold oversized display headings on plus blocks.
- **Indigo-dominant**, no gold. The ＋plus header label, the **wiki+ panel** (see *Two infoboxes*),
  and the General band are **indigo `#676EB4`** color-blocks; count numerals/tags are indigo.
- **Brand fonts**: headings **Source Sans Pro**, body **Open Sans** (the dashboard's fonts).
  The Wiki side keeps its serif Wikipedia look — the two type systems reinforce the two worlds.

### Brand palette (from the WikiEdu Dashboard `_variables.styl`)

| Role | Hex |
|------|-----|
| Indigo (primary) | `#676EB4` |
| Deep violet | `#5248AF` |
| Teal ("sprout") / dark | `#2A8270` / `#1F6757` |
| Action blue | `#1F6F95` |
| Red (warning) | `#C44949` |
| Inks | `#2C2C2C` / `#595959` / `#717171` |
| Light bg / borders | `#F7F7F7` · `#F0F1F3` / `#D9D9D9` |

Gold (`#E5AB28`) exists in the brand palette but is **deliberately not used** in this identity.

### Fact-vs-opinion signal (chips)

Each clip's accuracy/stance is shown as a **text-labeled chip** (never color alone), color-coded:

- **Accurate** → teal `#2A8270`
- **Accurate with a caveat** (simplified / condensed / exam-framed / big-picture / fast-paced) → action blue `#1F6F95`
- **Opinion / anecdotal / teaching-context / classroom** → red `#C44949`
- **Stance** chip (Explainer / Short / Demonstration / Classroom …) → indigo `#676EB4`

> Open: red for the opinion group is provisional — it carries a mild "caution/weigh-this" tone;
> revisit if it reads as "error." Implementation should also confirm AA contrast for every chip.

## Layout

A two-column layout from the top (article ~1fr, plus rail ~360px):

- **Left (article):** title + attribution ("From Wikipedia · CC BY-SA 4.0"), the lead, then the
  article body sections with their real headings, wikilinks, figures, and (per the
  article-fidelity feature) the **Wikipedia infobox** float-right at the top — see *Two infoboxes*
  below.
- **Right (plus rail, sticky):** the **wiki+ panel** (video / creator / curator counts + synced
  status), then the **Table of Contents**, then the curated **section videos**. The rail is
  present and pinned from the very top.

### Two infoboxes — a naming disambiguation (do not conflate)

The Topic page has **two distinct "infobox" objects**; they live in different columns, in different
visual languages, and the docs name them distinctly (resolving the article-fidelity collision,
`docs/design/article-fidelity.md` §4.3, spec B8):

- **Wikipedia infobox** — the encyclopedia's *own* summary box (taxonomy, key facts, lead image),
  restored by the article-fidelity feature. It lives in the **left article column**, float-right at
  the top of the lead, and keeps **Wikipedia's visual language** (grey header rows, hairline
  borders) — it is part of "the Wiki world," never restyled into Indigo Press.
- **wiki+ panel** (formerly called "the +plus infobox") — wiki+'s *own* element in the **right
  rail**: the videos / creators / curators counts + synced status (curated), or the "0 videos
  curated" + "Be the first to curate" CTA (empty). It is **Indigo Press** (indigo header block,
  hardbox border + offset shadow). Implemented in `components/topic/Infobox.tsx` (the filename is
  retained; its doc-facing name is **the wiki+ panel**).

They **cannot collide**: at `lg+` they are in separate grid columns (the Wikipedia infobox floats
*within* the article column, the wiki+ panel is the right rail beyond the grid gap); below `lg` the
Wikipedia infobox stacks full-width in the article flow and the wiki+ panel sits in the collapsed
rail below it.

### The General strip — the one crossover

Immediately after the lead, a full-width **General strip** presents whole-topic videos that
don't map to a specific section. It is the **only** place plus content reaches into the Wiki
column, and is styled like a video-platform search row — **thumbnail-forward**, a quick visual
overview, horizontally scrollable.

## Clip placement: General vs. section-anchored

Curated videos divide into two buckets:

- **General** — whole-topic intros/overviews; shown in the General strip.
- **Section-anchored** — each tied to the article section it relates to; shown in the plus rail.

The **TOC shows a per-entry video count** (a "General" entry first, then each section with a
badge for how many videos are anchored there). Sections with no videos still appear as a normal
wiki TOC entry.

## Interaction: synchronized scrolling

The article and the plus rail are **scroll-synchronized**:

- Scrolling the **article** moves the plus rail to the active section's video(s) and highlights
  the pairing (section marker + active card + TOC entry).
- Scrolling the **plus rail** scrolls the article to that anchor.

Anchoring is at **section granularity** in the mockup; tightening it to a specific phrase/span
("the inline text") is a candidate refinement for implementation. The exact sync mechanics
(thresholds, easing, mobile single-column fallback) are an implementation-phase detail.

## Empty / zero-curation state

Every topic starts with **zero curations**. The empty state still aims to be useful and to drive
the curation flywheel, by bootstrapping the plus side with **auto-suggested, clearly unvetted
candidates** plus prominent paths to curate. Reference mockup: **`mockups/inline-indigo-empty-v2.html`**
(the settled design; `inline-indigo-empty.html` is the earlier v1 iteration, kept for history).

- **Auto-suggestion is multi-platform by design.** The General bar is populated automatically with
  candidates from a video search for the topic — **YouTube and TikTok** (and potentially other
  sources); the frontend treats all auto-candidates the same. Where a candidate's metadata
  (title/description/tags) matches a specific article section's keywords, it surfaces as a **single
  inline candidate** under that section.
  - *MVP limitation (pragmatic, not a design choice):* only **YouTube** auto-suggestion is wired up
    at first, because TikTok lacks an easily-accessible search API (see ARCHITECTURE). TikTok
    auto-suggestion switches on when it becomes practical — the design already accommodates it.
- **Manual source paths (always available).** A **"Search TikTok"** button (and possibly other
  source buttons) **launches TikTok (web/app) in a new window** for a manual search — useful
  regardless of auto-suggestion, and the interim way TikTok content gets in.
- **"Add video" (logged-in only).** Paste a **YouTube or TikTok share link** for a clip that
  auto-suggestion missed; we resolve its embed/metadata and start a curation.
- **Unvetted treatment.** Candidates are unmistakably distinct from curated clips: dashed (not
  solid) borders, no solid offset shadow, a desaturated/hatched thumbnail, an outline "SUGGESTED"
  badge, and — in place of a curator context note — an **auto-suggest reason** (source + why it
  matched) with a "no context yet" hint. No stance/accuracy chips yet. TOC badges show suggestion
  counts in a dashed/outline style, distinct from curated counts.
- **Curation entry points.** Every candidate carries **Promote** (opens "Curate this clip" — write
  the context note, set stance + accuracy, confirm the section; publishing turns it into a vetted
  curated clip) and **Not relevant** (rules it out). Browsing is anonymous; **promoting or adding a
  video requires login**.

## The pinned candidate player (in-app preview)

Curated clips play in a **blocking, focus-trapping modal** (`PlayerModal` / `ModalShell`). That is
wrong for *evaluating* auto-suggested candidates, which is a triage loop: watch, compare against the
article, promote or dismiss, then watch the next. So **candidate** videos use a different surface — a
**persistent, non-modal pinned player** that keeps playing while the reader keeps reading and lets a
second click swap what's playing. (Full spec: `docs/design/pinned-player.md`; issue #10.)

- **Candidates only, this run.** Only **YouTube** candidates (with an `embedUrl`) open the pinned
  player. Curated clips keep the blocking modal; **non-YouTube** candidates and YouTube candidates
  **with no `embedUrl`** keep the existing **new-tab** behavior (`window.open(watchUrl)`). The
  curated-modal / candidate-pinned split is a **recorded inconsistency / follow-up** (whether the
  pinned model should later replace the modal everywhere), not a defect.
- **Standard position + size.** **Desktop (`lg`+):** a fixed dock in the **bottom-left** corner
  (`bottom/left: 1rem`), width capped at `min(380px, calc(100vw − 2rem))`; vertical 9:16 Shorts are
  height-capped (`min(60vh, 460px)`) and the dock narrows to that frame. Bottom-**left** is deliberate
  — the sticky plus rail and every candidate's **Promote / Not relevant** controls live on the right,
  so docking left keeps them visible and operable while the player is open (no overlap, no layout
  shift). **Mobile (< `lg`, vertical-first):** a **full-width bottom bar / sheet** flush to the bottom
  edge (with `env(safe-area-inset-bottom)`), 16:9 full-width and 9:16 height-capped + centered; while
  open it reserves bottom padding on the page so the last candidate's controls scroll clear of the bar.
- **Persistent + single instance.** `position: fixed`, survives scroll (iframe never re-mounts), one
  player and one iframe at a time; a second candidate click **swaps the iframe `src` in place** rather
  than stacking. The iframe is **created on explicit play and torn down on dismiss** (embed-never-host;
  autoplay only because the user clicked).
- **Dismiss affordance.** A real, keyboard-operable **"✕ Close"** button (glyph **and** word) in the
  title bar; activating it removes the dock and its iframe from the DOM (playback stops).
- **Metadata alongside.** Minimal — the **caption** plus **creator credit** (`handle · platformLabel`,
  the CC BY-SA attribution), reusing the strip/card footer pattern. No match reason, no Promote/Dismiss
  inside the dock (those stay on the candidate card).
- **Accessibility model (non-modal).** The dock is a **labeled landmark** (`<section
  aria-label="Video preview">`), **not** a dialog: no `aria-modal`, **no focus trap**, no backdrop. It
  **does not steal focus on open** (no autofocus) and does not block the page. Dismiss is keyboard
  reachable with the project's visible focus ring; on keyboard dismiss focus returns sensibly (reuse
  the General-band-heading focus pattern), never dropped to `<body>`. Any dock-in motion is gated by
  the existing `prefers-reduced-motion` signal. All chrome is **white-on-`ink`** (AA, no gold) and the
  Close control is signaled by its **word**, never color alone.

## Data implications (already reflected in the clip model)

These map onto the `clip` entity in [`ARCHITECTURE.md`](ARCHITECTURE.md):

- `general` (boolean) + `sectionId` / `sectionLabel` — drives General vs. anchored placement and
  the TOC counts.
- `creator` (handle, name, platform, followers/avatar), `context` note, `stance`, `accuracy`,
  `orientation` (vertical/horizontal), `thumbnail`, `embed_url`, `watch_url` — drive the cards.
- Topic-level counts (videos / creators / curators) feed the wiki+ panel (the right-rail
  counts/sync element; see *Two infoboxes*).

## Open refinements (deferred to implementation)

- Phrase-level anchoring instead of section-level.
- Mobile / single-column behavior (the two-pane sync collapses on narrow screens).
- TikTok embedding (thumbnails are signed URLs that can expire; embeds are unreliable) — likely
  thumbnail + link-out, with YouTube using a click-to-load iframe facade.
- How much of the larger set (`stats.totalClips`) to surface and the "see all" / browse flow.
