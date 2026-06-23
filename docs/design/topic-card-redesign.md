# Design spec: the Topic card — Wikipedia-article identity + at-a-glance curation stats

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written before
implementation) · **Issue:** [#126](https://github.com/ragesoss/wikiplus/issues/126) — redesign the
Topic card in the homepage's "recently-curated" section · **Phase:** prototype

**Builds on the contract:**
- [`docs/design/homepage-recently-curated.md`](homepage-recently-curated.md) (issue #125 / PR #137) —
  the section this card lives **inside**. That spec set the heading/eyebrow/spacing framing **around**
  the grid and explicitly **deferred the card-body redesign to this issue** (its §5.4 / §7). This spec
  picks up exactly there: it redesigns the **card body**; it does **not** touch the section heading,
  eyebrow, supporting line, data states' *strings*, recency ordering, or the grid's column behavior —
  all of which #125 owns and ships.
- [`components/topic/Infobox.tsx`](../../components/topic/Infobox.tsx) — the existing **3-up
  Videos / Creators / Curators** `Stat` grid. **Prior art to reuse / adapt, never fork.**
- [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) §2 — the `Wiki | +plus` split: the article/"Wiki"
  side keeps a **faithful Wikipedia look** (serif); the "+plus" curation layer is **Indigo Press**
  (the hardbox language). The card is a **miniature of that split** and must hold both halves without
  them fighting.
- [`docs/TOPIC_PAGE_DESIGN.md`](../TOPIC_PAGE_DESIGN.md) — the article-vs-plus split the card mirrors.

**Hands off to:** Development — build the redesigned card in `app/page.tsx` (extract a `TopicCard`
component if it earns reuse), wired to a per-card `stats`. The **data-delivery decision is Dev's
discovery** (issue #126 data note) and is recorded in `docs/ARCHITECTURE.md` by Dev — this spec
designs *as if* `stats` is available per card and specifies **exactly which counts** the card shows
and **how a zero-curation topic renders** (§4, §6.2). After build, UX evaluates the running cards
against this spec + the stories (§9).

---

> **What this spec is.** The buildable contract for the **card body** inside the recently-curated
> grid. It specifies: the persona/story; the card anatomy top-to-bottom (the article-side serif title
> treatment + the "Wikipedia article" mark decision + the plus-side stat block); **exact microcopy**
> (stat labels, the singular/plural rule, the zero-curation label string); **every state** (curated /
> zero-curation / long title / no description / loading / empty / read-error); the article-vs-plus
> visual coexistence; responsive behavior; accessibility; and **exactly which counts come from where**.
> It makes a firm recommendation on the two open product calls (§10).

---

## 1. Persona & story served

This card lives in the homepage's **last band** — the "somewhere to go when you don't have a topic in
mind" beat (#125 §1). It serves the same primary persona, now at a finer grain: the reader **scanning
the grid, deciding which topic to open.**

### 1.1 Rosa — the reader browsing the recently-curated grid (primary)

Rosa has scrolled past the search and the hero. She sees a grid of topic cards. The current card is a
plain bordered box with a sans-serif title, a description, and a raw QID — it tells her almost nothing
about *what kind of thing* a topic is or *how much* curation it carries. She can't triage.

- **TC1 — "what is this?"** *As a reader, I want each card to read at a glance as **the Wikipedia
  article on X** — not a generic app tile — so I immediately understand a topic is an encyclopedia
  article that wiki+ sits on top of.* → §3.2 the serif title treatment + §3.3 the article mark.
- **TC2 — "how curated is it?"** *As a reader, I want to see **how much plus** a topic carries —
  curated videos, from how many creators, vouched by how many curators — so I can choose the richest
  topic to open without opening each one.* → §3.4 the plus stat block; §4 the counts.
- **TC3 — "is this one worth my time, or empty?"** *As a reader, I want a **not-yet-curated** topic to
  say so honestly rather than show a dead row of zeros, so I'm not misled into opening an empty
  topic — and so the grid still looks alive.* → §6.2 the zero-curation state.
- **TC4 — "I can open it."** *As a reader, I want the **whole card to be one click/tap/Enter** to the
  topic, with a clear focus ring, so opening a topic is effortless on mouse, touch, and keyboard.* →
  §3.1 (the card is one link), §8 accessibility.

### 1.2 Dev — the returning reader (secondary)

Knows wiki+; usually searches. When idle-browsing, the stat block lets him spot the **freshly,
heavily curated** topics at a glance — the payoff of the recency-ordered grid (#125 §4).

**Story → AC trace** (feeds Product's criteria; reconcile, don't duplicate): TC1 → "card reads as a
Wikipedia article (serif title; mark only if it improves clarity)"; TC2 → "card shows curated videos ·
creators · curators, matching the overview card's derivation, correct at the singular boundary"; TC3 →
"a zero-curation topic renders sensibly, never broken/empty-looking"; TC4 → "the whole card is a
keyboard-activable link to the topic; AA contrast + focus + text-labeled stats."

---

## 2. The design problem — one small card holding two worlds

The card is a **miniature of the `Wiki | +plus` split** (VISUAL_IDENTITY §2). It must say two things
at once without the two voices fighting on a ~280–460px-wide tile:

- **The article half ("Wiki" / the source):** *this is the Wikipedia article on X.* Faithful
  Wikipedia look — a **serif title** is the dominant signal (the owner's assumption: the serif does
  most of the work).
- **The plus half (Indigo Press / the curation layer):** *here is how much wiki+ has added.* The same
  topline counts the Topic overview card highlights — **videos · creators · curators** — in the
  Indigo-Press stat language.

**Governing principle:** the article identity **leads** (it's what the topic *is*); the plus stats
**support** (they're what wiki+ *added*). They are stacked top→bottom, separated by a quiet divider,
so the eye reads "article, then its plus" — never two competing blocks side-by-side. The card itself
sits in a **white plus-card frame** (the Indigo-Press container), with the **article content faithful
inside it** — exactly the wordmark's relationship: the plus layer frames; the source sits faithfully
within.

---

## 3. Card anatomy, top to bottom

A single `<li>` whose entire content is **one `<Link href={topicHref(t.title)}>`** (TC4 — the whole
card is the click target). Top to bottom inside the link:

```
┌──────────────────────────────────────────┐  ← plus-card frame (white, 2px ink, hard offset shadow)
│  Photosynthesis                            │  ← ARTICLE HALF: serif title (Georgia), the lead signal
│  WIKIPEDIA ARTICLE                         │  ← tiny article eyebrow (the "mark" — see §3.3)
│  Biological process converting light to…   │  ← description (sans, muted, ≤2 lines, optional)
│  ──────────────────────────────────────   │  ← quiet divider = the wiki | plus seam (§3.5)
│  ┌─────────┬─────────┬─────────┐           │  ← PLUS HALF: compact 3-up stat grid (Indigo Press)
│  │   12    │    7    │    3    │           │     bignum indigo numerals
│  │ VIDEOS  │ CREATORS│ CURATORS│           │     uppercase text labels (never number/color alone)
│  └─────────┴─────────┴─────────┘           │
└──────────────────────────────────────────┘
```

### 3.1 The card frame (the Indigo-Press container)

- Use the committed **`.plus-card`** primitive (`bg-white`, `border: 2px var(--color-ink)`,
  `box-shadow: 4px 4px 0 var(--color-ink)` — the hard offset shadow), **not** the current soft
  `rounded-xl border-ink/10 shadow-sm` box. This makes the card visibly **cut from the same cloth as
  the product's curation surfaces** (the Infobox, the hero CTAs, the wordmark block) — it resolves the
  #125 §7 note that the unchanged soft cards looked stylistically out of step with the hardbox hero.
- `.plus-card` is **square-cornered** (the hardbox language has no border-radius) — drop `rounded-xl`.
- **Padding:** `p-4` (keep the existing comfortable inset). The stat grid (§3.4) reaches edge-to-edge
  within that padding.
- **Hover/active (mouse):** the hardbox press — on hover, `translate-x-1 translate-y-1` and drop the
  shadow (`hover:shadow-none`), exactly as the hero CTAs do (`app/page.tsx`). This gives the card the
  same tactile "press into its shadow" feel as the rest of the Indigo-Press surfaces and is a clearer
  interactive affordance than the current `hover:border-brand/40`. **Reduced-motion:** the transform
  is a static state change, not an animation; acceptable, but Dev may gate the `transition` under
  `motion-reduce:transition-none` for consistency with project conventions.
- **The whole `.plus-card` is the link.** `block` display; one focusable element per card (§8).

### 3.2 The article-side title (the LEAD signal — TC1)

**This is the primary "Wikipedia article" cue. The serif does most of the work** (owner's assumption,
confirmed).

- **Font:** the committed **`.projector-serif`** stack (`Georgia, "Times New Roman", serif`) — the
  *exact* serif the wordmark's "Wiki" and the article body use (`app/globals.css`). **Reuse it; do not
  introduce a new font.** This is what makes the title read as "the encyclopedia."
- **Size / weight / color:** `text-lg sm:text-xl`, `font-bold` (Georgia bold reads as a confident
  article headline at this size), `text-ink` (`#2C2C2C`). Leading `leading-snug`.
- **Content:** `t.title` (the Wikipedia article title — verbatim, already the display title).
- **Truncation (long titles — TC, §6.3):** allow up to **2 lines**, then ellipsis
  (`line-clamp-2`). A 2-line clamp keeps card heights close across the grid while not chopping a
  legitimately long article title to one word. The title is **never** truncated to a single line (a
  one-line clamp would cut common titles like "Cellular respiration" awkwardly on a narrow column).

### 3.3 The "Wikipedia article" mark — DECISION

**Decision: include a tiny *text* article eyebrow — the words `WIKIPEDIA ARTICLE` — and do NOT add a
Wikipedia-logo / "W" icon.** Rationale and exact treatment:

- **Why a mark at all, given the serif "does the work"?** The serif strongly *suggests* "encyclopedia"
  to a design-literate eye, but on a small card in an unfamiliar product it is **ambient, not
  explicit** — a first-time visitor (Rosa) may not consciously decode "serif = Wikipedia article." A
  *two-word text label* makes TC1 **explicit and certain** at negligible cost, and it doubles as the
  thing that names the article half of the split in words (the plus half is already named in words by
  its stat labels — §3.4 — so labeling only one half would leave the split lopsided). It is the
  cheapest possible disambiguation and it reinforces, rather than competes with, the serif.
- **Why text, not an icon/logo?** (a) A Wikipedia "W"/puzzle-globe logo is a **third-party trademark**;
  using it as a wiki+ UI affordance invites brand-confusion and licensing questions for a marginal
  clarity gain — out of proportion for a prototype card. (b) At card scale a tiny logo is visual
  clutter and a low-contrast speck; the text label is unambiguous and AA-legible. (c) The project's
  own discipline is **text-labeled signals, never icon/color alone** (CLAUDE.md) — a word is on-brand;
  a bare glyph is not. So: **no icon.** The serif title + the word `WIKIPEDIA ARTICLE` together carry
  the article identity.
- **Treatment:** a small uppercase eyebrow **directly under the title**, `text-[10px] sm:text-[11px]
  font-bold uppercase tracking-wide text-ink2` (`#595959`). It mirrors the plus-side stat labels'
  type (§3.4) so the card's two labels read as one type system, and it is deliberately **quiet** (it
  must not rival the serif title). It sits `mt-1` under the title.
- **No accent rule.** Do **not** add the hero's indigo `bg-brand` eyebrow rule here — that device is
  the *section* eyebrow (#125 §5.1); repeating it on every card would multiply it and muddy the
  section/card hierarchy. The card's article eyebrow is plain text.

> **For Product (OQ-A):** UX recommends the two-word `WIKIPEDIA ARTICLE` text eyebrow. If Product
> judges the serif alone sufficient and wants the cleanest possible card, dropping the eyebrow is a
> safe, low-risk simplification (the serif still carries TC1 ambiently) — UX's recommendation is to
> keep it for explicit certainty, but it is the most droppable element here. The icon/logo is **not**
> recommended in either case.

### 3.4 The plus-side stat block (the SUPPORT signal — TC2)

The same topline the Topic overview Infobox highlights, in a **compact adaptation** of its `Stat`
3-up grid. **Reuse the Infobox stat's visual language; adapt the scale — do not fork or reinvent it.**

- **Structure (mirrors `Infobox.tsx`):** a 3-cell grid, `grid grid-cols-3`, the cells divided by the
  Indigo-Press hairlines: `divide-x-2 divide-ink border-2 border-ink` (the exact treatment from the
  Infobox grid). Order, left→right: **Videos · Creators · Curators** (same order as the Infobox).
- **Compact scale (the adaptation):** the Infobox `Stat` uses `bignum text-3xl` + `text-[10px]`
  labels with `px-2 py-3`. On a homepage card that is too tall and heavy. Use a **compact `Stat`
  variant**: numerals `bignum text-xl sm:text-2xl text-brand` (the indigo `.bignum` numeral — the
  Indigo-Press numeral voice, kept), labels `text-[9px] sm:text-[10px] font-bold uppercase
  tracking-wide text-ink2`, cell padding `px-1.5 py-2`, each cell `text-center`. This is the Infobox's
  identical *language* (indigo bignum over an uppercase ink2 label, ink-divided cells) at a smaller
  size — the family is unmistakable; the proportions suit the card.
- **The numbers are text-labeled, never number/color alone (TC2 / §8):** each numeral always has its
  word label beneath it (`Videos`/`Creators`/`Curators`). The indigo color is decorative emphasis, not
  the signal — the label carries the meaning.
- **Where the stat block sits:** full-width within the card padding, below the divider (§3.5), as the
  card's foot. It is visually the **plus layer** — Indigo numerals, ink hairlines — clearly distinct
  from the faithful-serif article half above it.

**Reuse mechanics (for Dev):** the Infobox's `Stat` is a small internal component. Either (a) export a
shared `Stat` that takes a `size`/`compact` prop and use it in both places, or (b) lift the shared
`Stat` into a small shared module both import. Either way the **visual tokens (indigo bignum + uppercase
ink2 label + ink-divided cells) must be the single source** — do not hand-copy divergent numbers. (Dev
picks the refactor; the spec's requirement is "one stat primitive, two sizes," not a fork.)

### 3.5 The wiki | plus seam (the divider between the two halves)

Between the article half (title + eyebrow + description) and the plus half (stat grid) sits a **quiet
full-width hairline** — the card's miniature of the page's wiki/plus seam. `border-t border-ink/15`,
with `mt-3 pt-3` breathing room. It is a calm separator, **not** the heavy 2px ink hardbox border (that
weight belongs to the card frame and the stat grid, not to an internal divider — using it here would
make the card feel like two stacked boxes). The seam says "article above, its plus below."

### 3.6 The description (optional, supporting)

- `t.description` when present: `text-sm text-ink2` (note: `text-ink2` `#595959`, **not** the current
  `text-ink/60` — see §8 contrast), `line-clamp-2` (≤2 lines, ellipsis), `mt-1.5` under the eyebrow.
- It belongs to the **article half** (it describes the article), above the seam.
- **The raw QID is REMOVED from the card.** The current card shows `t.qid` (e.g. `Q11982`) in indigo
  as a third line. A raw Wikidata QID is **developer-facing noise** to a reader browsing topics — it
  carries no scanning value for TC1/TC2 and it currently mis-uses indigo (the plus color) for a piece
  of source metadata. Dropping it declutters the card and frees the indigo for the stat numerals where
  it belongs. (The QID remains the canonical key in data + the URL via `topicHref`; it simply isn't
  displayed.) This is a deliberate change from the #125-preserved markup, scoped to **this** card
  redesign.

---

## 4. Exactly which counts come from where (the data contract for Dev)

**The card shows three counts, identical in derivation to the Topic overview Infobox** (issue #126
"Done when": *the stats match the counts the overview card shows for the same topic*):

| Card stat | Source field | Derivation (must match the overview card) |
|---|---|---|
| **Videos** | `stats.videos` | `deriveStats(clips).videos` = `clips.length` — the count of **curated clips** for the topic (`lib/data/index.ts`). **Curated clips only** — never the unvetted candidate count. |
| **Creators** | `stats.creators` | `deriveStats(clips).creators` = distinct `clip.creator.handle` count. |
| **Curators** | `stats.curators` | `deriveStats(clips).curators` = distinct non-empty `clip.curatedBy` count. |

- These are the **`TopicStats` `videos`/`creators`/`curators`** fields (`lib/data/types.ts`). The
  card does **not** show `TopicStats.synced` (out of scope — no freshness this build) and shows **no
  upvotes/thumbnails** (out of scope).
- **`deriveStats` is reused unchanged** (issue #126 out-of-scope: no change to derivation). The card
  must reflect *the same numbers* the overview card shows, because both derive from the same clip set.
- **Delivery is Dev's discovery (record in `docs/ARCHITECTURE.md`), not designed here.** Today
  `store.listTopics()` returns only `qid/title/description` (the `Topic` type) and carries **no
  per-topic stats**; deriving them per card naively = N clip reads. Dev must choose **one cheap read
  for the whole list** (the issue's likely answer: extend the `listTopics()` payload to include the
  derived `stats` per topic, computed DB-side in a single query — e.g. a grouped count join — rather
  than N round-trips) and record the decision. **This spec designs as if each list item carries a
  `stats: { videos; creators; curators }`.** If a topic has no clips, the cheap read should yield
  zeros (or omit `stats`) — see §6.2 for how the card renders that.

---

## 5. Exact microcopy (the buildable strings)

| Element | Exact copy | Rule |
|---|---|---|
| **Article eyebrow (§3.3)** | `WIKIPEDIA ARTICLE` | Displayed all-caps (via CSS `uppercase`); singular always ("article", it labels the card's one article). |
| **Stat labels (§3.4)** | `Videos` · `Creators` · `Curators` | Authored in title-case, **displayed uppercase** via CSS (matches the Infobox `Stat` labels). The label string is **constant** (it does not switch singular/plural — the label names the *category*; the *number* above it carries count). This matches the Infobox, whose labels are likewise constant `Videos`/`Creators`/`Curators`. |
| **Zero-curation label (§6.2)** | `Not yet curated` | Sentence case. Replaces the stat grid entirely when the topic has 0 curated videos. See §6.2 for treatment. |

### 5.1 The singular boundary — where it applies

Issue #126 "Done when": *correct at the singular boundary (1 video, not "1 videos")*. **In the 3-up
grid the label is a constant category word and is never pluralized** (the Infobox does the same:
`Videos`/`Creators`/`Curators` regardless of count) — so the grid itself has no "1 videos" hazard; the
numeral `1` over the constant label `Videos` is correct and is read by a screen reader as "1, Videos"
(§8 names the cell so it reads naturally). **The singular/plural rule therefore binds only on the
accessible name and any prose summary**, where a number and noun are joined into a phrase:

- **The card's accessible name (§8)** joins counts into a sentence — *there* the rule applies:
  `"Photosynthesis — Wikipedia article. 1 video, 7 creators, 3 curators."` (`1 video`, not `1 videos`;
  `0 videos` would not occur because a zero-curation card uses the §6.2 label, not "0 videos").
- **Rule for any count+noun phrase:** `n === 1 ? "1 " + singular : n + " " + plural` — `video/videos`,
  `creator/creators`, `curator/curators`. Apply it in the accessible-name builder.

---

## 6. Every state — exact treatment

The **section-level** states (loading / empty / read-error) are owned and shipped by #125 and render
**in place of the whole grid** (the section heading is always present). This card redesign changes
**none of their strings or behavior** — it inherits them verbatim. The **per-card** states (curated /
zero-curation / long title / no description) are this spec's new work.

### 6.1 Section states — INHERITED from #125, unchanged (do not regress)

| Section state | Condition | Treatment (verbatim from #125 §3.2) |
|---|---|---|
| **Loading** | `topics === null` & not `loadError` | `Loading recently curated topics…` — muted helper text (`text-sm text-ink/50`). **No skeleton cards this build** (out of scope; the one-line helper is the shipped behavior). |
| **Empty** | `topics.length === 0` | `No topics curated yet — be the first by searching for one above.` — muted helper text. |
| **Read-error** | `loadError` (server read failed) | `Couldn't load topics — please refresh.` — muted helper text. **Verbatim, preserved.** |

Visual harmonization note: these three are single muted lines that sit under the (always-present)
section heading. They render **before/instead of** any card, so the card redesign cannot regress them.
No change. (If Dev later wants loading **skeleton cards**, that is a separate enhancement, **not** in
scope here — keep the one-line helper.)

### 6.2 Per-card: ZERO-CURATION topic — DECISION

A topic can appear in the list with **0 curated clips** (`stats.videos === 0`). The issue flags the
open call: show a dead row of zeros, or a label?

**Decision: replace the stat grid with a single quiet `Not yet curated` label. Do NOT render an
all-zeros 3-up grid.** Rationale and exact treatment:

- **Why not zeros:** a `0 / 0 / 0` indigo grid reads as **broken or dead** (TC3) — three big indigo
  zeros shout "empty" and undercut the "the product is alive" job of the section. It also wastes the
  card's most valuable real estate on no information.
- **Why a label:** `Not yet curated` is **honest, scannable, and inviting** — it tells Rosa this topic
  is an article waiting for curation (a candidate for *her* to curate), turning a dead card into a
  gentle prompt, while keeping the card visibly a real, openable topic.
- **Treatment:** in the stat block's place, a single line: `Not yet curated` in
  `text-xs font-bold uppercase tracking-wide text-ink2`, left-aligned (or centered to match the grid's
  alignment — Dev's call; left-aligned reads as a status, which is preferred). It sits in the **same
  vertical slot** the grid would occupy, below the seam (§3.5), so card heights stay consistent across
  the grid. **No dashed box, no indigo, no zeros.** (This is deliberately quieter than the Infobox's
  empty "uncurated videos" dashed panel — that panel belongs to the Topic page where curation is the
  call to action; on a *browse* card the label is enough and a dashed box would add weight.)
- **The article half is unchanged** in this state — the serif title, the `WIKIPEDIA ARTICLE` eyebrow,
  and the description all render normally. A zero-curation card is a **fully legitimate article card**;
  only its plus half says "not yet."

> **For Product (OQ-B):** UX recommends `Not yet curated` (label) for `videos === 0`, and the 3-up
> stat grid for `videos ≥ 1`. This matches the issue's own recommendation. The exact string
> `Not yet curated` is **proposed** — Product/Curation own final voice; an acceptable alternative is
> `Awaiting curation` or `No videos yet`. The *behavior* (label, never a zero grid) is the firm
> recommendation regardless of the final string.

### 6.3 Per-card: LONG TITLE

- The serif title clamps to **2 lines** then ellipsis (`line-clamp-2`, §3.2). A very long article
  title (e.g. "List of Nobel laureates in Physiology or Medicine") fills two lines and truncates
  cleanly; the description and stat block keep their positions below it.
- Because titles vary in height (1 vs 2 lines), cards in a row may differ slightly in height. That is
  acceptable in a `grid` (rows size to their tallest card); the **2-line clamp caps the variance** so
  rows never blow out. Do **not** force a fixed card height (it would clip short cards' breathing room
  and crop nothing useful).

### 6.4 Per-card: MISSING DESCRIPTION

- When `t.description` is absent/empty, the description line is **simply omitted** (the existing
  markup already conditionally renders it). The eyebrow → seam → stat block close up naturally; no
  placeholder, no empty space reserved. The card remains balanced because the title + eyebrow + stat
  block still give it structure.

### 6.5 Per-card: CURATED topic (the populated default — `videos ≥ 1`)

The full anatomy (§3): serif title + `WIKIPEDIA ARTICLE` eyebrow + (optional) description + seam +
the compact 3-up Videos/Creators/Curators grid with live counts. This is the primary state the design
optimizes for.

---

## 7. Article-vs-plus visual coexistence (how the two halves don't fight)

The two voices are kept legible and unconfused by **separation, not contrast escalation**:

- **Stacked, not side-by-side.** Article half on top (serif, faithful), plus half on the bottom
  (Indigo numerals + ink hairlines). The eye reads top→bottom: *what it is, then what wiki+ added.*
- **The seam (§3.5) is the hinge** — one quiet hairline marks where "Wiki" ends and "+plus" begins,
  exactly as the wordmark's seam does, scaled to the card.
- **Type voices are assigned, not mixed:** **serif (Georgia)** is *only* the title (the article
  voice); **Source Sans bignum** is *only* the stat numerals (the plus voice); the two **uppercase
  ink2 labels** (the article eyebrow + the stat labels) share one quiet type so the card has a single
  "label system" tying the halves together. No serif on the plus side; no bignum on the article side.
- **Color is assigned:** **indigo (`brand`)** appears *only* in the stat numerals — it is the plus
  layer's signal. The article half is all ink/ink2 (faithful, neutral, Wikipedia-like). Removing the
  old indigo QID line (§3.6) is part of this discipline — indigo now means "plus stat," nothing else
  on the card. **Gold is not used on the card** (reserved for the wordmark; never a card signal).
- **The container is the plus frame holding the faithful source** — the hardbox `.plus-card` frame is
  the Indigo-Press wrapper; the article content sits faithfully inside it. This is the wordmark's
  exact relationship (plus layer over a faithful source) rendered as a card.

---

## 8. Accessibility (baseline, AA)

- **The whole card is one keyboard-activable link (TC4).** It stays a single `<Link>` wrapping all
  card content — one Tab stop per card, `Enter`/click/tap all navigate to `topicHref(t.title)`. **Do
  not** add nested interactive elements (the stat cells are not separately clickable). Tab order is the
  natural document order (the grid comes after the search + hero + section heading — #125 §8; this
  redesign does not reorder anything).
- **Visible focus.** The link must have a clear focus ring: `focus-visible:outline
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink` (the same focus
  treatment the hero CTAs use). Verify the ring is visible against the white card and the body-grey
  section background — `ink` outline clears both. (The current soft card relied on a hover border; the
  redesign adds an explicit focus-visible ring, an a11y improvement.)
- **Accessible name — the card announces what it is + its stats as a sentence.** A screen-reader user
  scanning the grid should hear a complete, useful phrase, not "Photosynthesis, link" followed by
  three bare numbers and three labels. Give the `<Link>` an `aria-label` built from the title + the
  article mark + the counts, applying the §5.1 singular rule:
  - **Curated:** `"{title} — Wikipedia article. {v} {video|videos}, {c} {creator|creators}, {k}
    {curator|curators}."` e.g. `"Photosynthesis — Wikipedia article. 12 videos, 7 creators, 3
    curators."`
  - **Zero-curation:** `"{title} — Wikipedia article. Not yet curated."`
  - With the `aria-label` set on the link, mark the **decorative numerals and labels inside** so AT
    doesn't double-read them — either set `aria-hidden` on the visual stat grid (the `aria-label`
    already conveys the counts), or omit the `aria-label` and instead ensure each stat cell reads as
    "{n} {label}" via visually-hidden text. **Preferred: the composed `aria-label` on the link + the
    visual stat grid `aria-hidden`** — it gives the cleanest, most natural announcement and guarantees
    the singular boundary is correct in speech. (The visible labels remain on screen for sighted
    users; only their *redundant* AT reading is suppressed.)
- **Text-labeled signals, never number/color alone (issue "Done when").** Every numeral has its word
  label on screen (`Videos`/`Creators`/`Curators`); the zero state is the **word** `Not yet curated`,
  not a color or an empty grid. Indigo is decorative emphasis on the numerals, never the sole carrier
  of meaning.
- **Contrast (AA).** Title `text-ink` (`#2C2C2C`) on white ≈ 13:1 — passes. Article eyebrow + stat
  labels `text-ink2` (`#595959`) on white ≈ 7:1 at small bold — passes. **Description must use
  `text-ink2` (`#595959`), not the current `text-ink/60`** — `ink` at 60% opacity on white drops to
  ≈ 4.0:1, **below** AA for normal text; `text-ink2` at `text-sm` clears AA. The stat numerals are
  `text-brand` (`#676EB4`) on white ≈ 4.6:1 — passes AA for the large/bold `text-xl`+ bignum. The
  `Not yet curated` label is `text-ink2` (passes). **No essential text on the card uses a faint
  opacity tint.**
- **Touch target.** The whole card is the tap target (comfortably ≥ 44px tall on every breakpoint —
  the title + stat block guarantee height), so the link meets the touch-target minimum without a
  dedicated button.

---

## 9. Responsive behavior (web-first, responsive)

The card lives in the inherited grid `grid gap-3 sm:grid-cols-2` (2-col ≥`sm`, 1-col below — #125 §6;
unchanged). The card's internals scale across breakpoints:

| Breakpoint | Card width (approx) | Title | Stat grid | Notes |
|---|---|---|---|---|
| **Mobile (`< sm`, 1 col)** | full content width (~320–600px) | `text-lg` serif, 2-line clamp | compact 3-up, `text-xl` numerals, `text-[9px]` labels, `px-1.5 py-2` | Card is wide → the 3-up grid is comfortable; labels read fine. |
| **Tablet/desktop (`≥ sm`, 2 col)** | ~280–460px per card (half of `max-w-5xl`) | `text-xl` serif | 3-up, `text-2xl` numerals, `text-[10px]` labels | The 2-col tile is the **tightest** case for the 3-up grid — verify the three labels (`CREATORS`, `CURATORS`) don't wrap awkwardly; if they do at the narrowest 2-col width, the labels may wrap to 2 lines centered (acceptable) but the **grid stays 3-up** (do not drop to a stacked list — the 3-up *is* the Infobox language). |

- **The 3-up grid never collapses to a vertical list or a single line.** Reusing the Infobox's 3-up is
  the whole point (TC2 visual continuity with the overview card); a narrow 2-col tile is still wide
  enough for three short numerals with their labels beneath. If a label is too long for its cell at the
  tightest width, it wraps within the cell (the cell is `text-center`); the numerals stay aligned.
- **Card height variance** across a row is capped by the 2-line title clamp (§6.3); rows size to their
  tallest card — acceptable, no fixed height.
- The redesign **adds no horizontal scroll** and **does not change the grid's column behavior** (#125
  owns that and it is out of scope here).

---

## 10. Recommendations on the two open product calls (summary)

- **OQ-A — the "Wikipedia article" mark (§3.3).** **Recommend: a tiny `WIKIPEDIA ARTICLE` text
  eyebrow; no icon/logo.** The serif title leads; the two-word eyebrow makes the article identity
  *explicit* at negligible cost and names the article half of the split in words (balancing the
  word-labeled plus half). A Wikipedia logo is rejected (trademark, clutter, off the project's
  text-labeled-signals discipline). If Product wants the absolute cleanest card, the eyebrow is the
  single most droppable element (the serif still carries TC1 ambiently) — but UX recommends keeping it.
- **OQ-B — the zero-curation display (§6.2).** **Recommend: a quiet `Not yet curated` label in place
  of the stat grid when `videos === 0`; never an all-zeros 3-up grid.** The article half renders
  normally. This matches the issue's own recommendation and protects TC3 (no dead-looking cards). The
  exact string is Product/Curation's to finalize; the behavior is the firm call.

---

## 11. Assumptions flagged for Product

- **A1 — `stats` is delivered per card by one cheap read (Dev's discovery, recorded in
  `docs/ARCHITECTURE.md`).** This spec designs as if every list item carries
  `stats: { videos; creators; curators }` derived identically to the overview card. If Dev's discovery
  finds the cheap one-read path is genuinely infeasible for the prototype, the **fallback that still
  ships the article-identity redesign** is: render the serif title + `WIKIPEDIA ARTICLE` eyebrow +
  description + frame (TC1, the article half) and **omit the stat block** (treat every card as the §6.2
  no-stats state) rather than do N reads. UX's strong preference is the cheap-read path so TC2 ships;
  the fallback exists only so a data dead-end doesn't block the article-identity win. Flagged for
  Product to confirm the cheap read is in scope for this build (the issue says it is).
- **A2 — seed-data stats may be uniform/low.** As with #125's recency note, seeded topics may carry
  small or similar clip counts, so the stat grid won't dramatically vary across seed cards until real
  curation accrues. Expected and acceptable; flagged so a post-build screenshot of seed data (small
  numbers, possibly several `Not yet curated` cards) isn't mistaken for a bug.
- **A3 — QID removal from the card (§3.6).** The redesign **stops displaying the raw `t.qid`** on the
  card (it was developer-facing and mis-colored). The QID remains the canonical key in data and the
  URL. Flagged because #125 explicitly *preserved* the QID span; this spec deliberately changes it as
  part of the card-body redesign #126 owns.

---

## 12. What Development must build (hand-off summary)

**Build — the card body (in `app/page.tsx`, the recently-curated grid's `<li>`; extract a `TopicCard`
component if it earns reuse):**

1. **Frame:** replace `block rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition
   hover:border-brand/40` with the **`.plus-card`** hardbox frame (`bg-white`, 2px ink border, hard
   `4px 4px 0` ink offset shadow, square corners), keep `p-4`, and add the **hardbox press hover**
   (`hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition`) + the **focus-visible ink
   ring** (§3.1, §8). Keep the whole card as one `<Link href={topicHref(t.title)}>` (§8).
2. **Title:** the article serif — `.projector-serif`, `text-lg sm:text-xl font-bold text-ink
   leading-snug`, `line-clamp-2` (§3.2).
3. **Article eyebrow:** `WIKIPEDIA ARTICLE` in `text-[10px] sm:text-[11px] font-bold uppercase
   tracking-wide text-ink2`, `mt-1` (§3.3).
4. **Description:** keep conditional; change color to **`text-ink2`** (a11y, §8), `text-sm`,
   `line-clamp-2`, `mt-1.5` (§3.6, §6.4).
5. **Remove the QID span** (`<span class="…text-brand">{t.qid}</span>`) — no longer displayed (§3.6, A3).
6. **Seam:** a `border-t border-ink/15` divider with `mt-3 pt-3` between the article half and the stat
   block (§3.5).
7. **Stat block (`videos ≥ 1`):** a **compact reuse** of the Infobox `Stat` 3-up grid — `grid
   grid-cols-3 divide-x-2 divide-ink border-2 border-ink`, cells `px-1.5 py-2 text-center`, numerals
   `bignum text-xl sm:text-2xl text-brand`, labels `text-[9px] sm:text-[10px] font-bold uppercase
   tracking-wide text-ink2`, order **Videos · Creators · Curators**, wired to `stats.videos /
   .creators / .curators`. **Reuse the Infobox `Stat` primitive at a smaller size — one stat primitive,
   two sizes; do NOT fork its visual tokens** (§3.4).
8. **Zero-curation (`videos === 0`):** render `Not yet curated` (`text-xs font-bold uppercase
   tracking-wide text-ink2`) in the stat block's slot instead of the grid (§6.2). Article half
   unchanged.
9. **Accessible name:** compose the link's `aria-label` per §8 (singular rule from §5.1) and
   `aria-hidden` the visual stat grid so counts aren't double-read.

**Wire (Dev's discovery — record in `docs/ARCHITECTURE.md`):**

10. Deliver `stats: { videos; creators; curators }` per list item via **one cheap read** for the whole
    list (likely: extend `listTopics()` with DB-side derived counts in a single grouped query),
    matching `deriveStats`' derivation. **Reuse `deriveStats`' derivation semantics; do not change
    them.** Record the chosen path in ARCHITECTURE (§4, A1).

**Leave untouched (boundaries):**

11. **The section heading / eyebrow / supporting line / recency ordering / the three section-level
    state strings** — all owned and shipped by #125; do not edit (§6.1).
12. **The Topic page's own Infobox / overview card** — *reuse* its `Stat` language; do not redesign it.
13. **`deriveStats` logic, the search, the hero, the projector header** — unchanged / out of scope.
14. **No** upvotes, freshness badges, thumbnails, per-card "curated N ago", or skeleton cards (all out
    of scope this build).

**Screenshot baseline (per CLAUDE.md):** this changes a shared homepage surface — refresh the homepage
UI screenshot baseline (`docs/design/ui-screenshots/`) in the same PR. The relevant catalog scene is
**`home`** (group "Home", `fullPage`) — captured at mobile/tablet/desktop, logged-out and logged-in.
Use `scripts/dev/shots.sh --scene home --commit ui` for the partial refresh (or `--group "Home"` if
`home-header` framing shifts). Verify the populated (curated) cards, a `Not yet curated` card, a long
title, and a no-description card all appear in the captured grid (seed data permitting — A2); if the
seed lacks a zero-curation topic, note it for the UX evaluation rather than forcing one.

---

*This spec is the input to Development for issue #126. After build, UX evaluates the running cards
against §1's stories and this spec (serif article identity reads at a glance; the 3-up stats match the
overview card and the singular boundary; the zero-curation label; the a11y model — composed accessible
name, focus ring, AA contrast), distinct from QA's correctness/security pass.*
