# Design spec: Landing page v1 — search-led front door + the Daylight Projector at Tier A

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written
before implementation) · **Issue:** [#15](https://github.com/ragesoss/wikiplus/issues/15) ·
**Phase:** prototype
**Builds on the contract:** [`docs/specs/landing-page.md`](../specs/landing-page.md) (Product
spec, AC1–AC13 + the owner's locked decisions + the parameterized-geometry forward note)
**Debuts:** the **Daylight Projector** header wordmark — [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md)
variant `01`, **Tier A**, its first implementation. Canonical render:
[`mockups/wordmark-projector-illuminate.html?solo=01`](../../mockups/wordmark-projector-illuminate.html)
(`buildScene()` = geometry source of truth)
**Inherits (not re-specified here):** [`docs/design/navbar-topic-search.md`](navbar-topic-search.md)
— the `TopicSearch` states S0–S8, microcopy, the APG combobox+listbox a11y model, the keyboard table.
**Hands off to:** Development (build `app/page.tsx` + the new `HeaderProjector`). After build, UX
evaluates the running header against `VISUAL_IDENTITY.md` and this spec.

> **What this spec is.** The buildable contract for the v1 landing rebuild: who it serves, the hero
> composition, the Tier-A projector mapped to the landing hero's *real* dimensions, the tier-aware
> `HeaderProjector` component API (incl. the parameterized geometry the owner asked for), **every
> state**, microcopy, responsive behavior, and the accessibility model. The **dynamic** geometry
> behavior is explicitly *not* built this round — only the parameterized API shape (AC10). The v2
> video-entry flow lives in its own spec ([`landing-page-v2-video-entry.md`](landing-page-v2-video-entry.md)).

---

## Iteration 2 — owner findings on the built header (PR #61) — DECISIONS, design to these

The owner reviewed the first build (screenshots in `docs/design/landing-page-screenshots/`) **against
the canonical mockup** (`mockups/wordmark-projector-illuminate.html?solo=01`, `buildScene()`) and
found the built header deviated from the locked identity and behaved wrong. The build's first pass
**never compared the running header side-by-side with the mockup** — that omission is the core failure
this iteration must prevent. These six findings are **decisions**; the affected sections below are
revised to embody them. Where a finding overrides a previously committed rule, it is recorded as an
**owner decision** at the point of override.

1. **Tight seam — the lockup must butt against "Wiki", no gap, no floating ghost letter.** The build
   pinned "Wiki" to a fixed `WIKI_W = 110px` deliberately over-estimated "to keep a comfortable gap."
   **The mockup has NO gap.** In `buildScene()` the block's left edge sits *at the seam* (`bx = seam`),
   which is exactly "Wiki"'s right edge; the block butts directly against the serif. The over-estimate
   pushed the indigo block right of "Wiki", opening a gap, and the ghost "Wikipedia"'s own "p" became
   visible floating in that gap. **Fix:** the block butts tight against "Wiki" at the seam at *every*
   width; the ghost "Wikipedia"/"pedia" is **covered by the block from the seam rightward** and is
   glimpsed ONLY through the lit "+" aperture — never as floating letters in open space. → §4.3, §5.4,
   §7.
2. **The projection must read as a beam burning INTO the search, not a gold underline.** The build's
   header field `#fafbfe` and content `#ffffff` are near-identical, so the white beam interior was
   invisible and only the gold stroke showed; the beam flared to near-full-width *at* `burnY`, so the
   gold edge became a near-horizontal full-width line = an "underline"; and the composition was loose
   (tiny lockup at top, search far below the boundary) so the whole thing read as a decorative divider.
   **Fix:** tighten the vertical composition (lockup → short cone → crossbar → **search sits inside the
   projected light**) so the beam + gold edge read as a projection landing on the front door, exactly
   as the mockup reads as a "+" *enclosing* the content immediately inside its brackets — NOT a line at
   the bottom of a cool box. Keep faith with the burn-to-white meaning (white-into-white, gold-edge-only
   signal) while making it actually read. → §2, §4.2, §4.4.
3. **Beam at EVERY width, with a FLUID beam width — overrides the Tier-drop on the landing page.** The
   owner wants the projector beam present at all viewport widths on the landing page, its width
   adapting to the viewport so it always flares to both page edges and burns into the search. **This is
   the owner overriding `VISUAL_IDENTITY` §6.2 (the `md` Tier-B "beam dropped") and §6.3 (the "stubby
   beam → drop to Tier B" / "gold off-page → full-bleed only → else Tier B" guidance) — for the landing
   page only.** The Topic-page tiers in `VISUAL_IDENTITY` are unchanged; this override is scoped to the
   free-standing full-bleed landing header. The mechanism that makes "beam at every width" coherent
   (not a sliver) is the **fluid beam** (§4.7) — it is already a `preserveAspectRatio="none"` full-width
   SVG, so it scales. → §4.7, §7 (the tier table is rewritten to beam-at-every-width).
4. **Remove the "Contribute" label entirely** from the landing header — gone, not relocated. → §8 (new
   header-chrome section), §11 hand-off.
5. **Auth chrome must not fold to a second row.** With Contribute gone, the single `AuthControl
   variant="home"` sits cleanly in the header at every width without wrapping to its own row under the
   lockup. → §8.
6. **Both auth states must render gracefully** — logged-out ("Log in with Wikipedia") and logged-in
   (the user's identity). → §8.

---

## 1. Personas & user stories

The landing page has **one job: be the front door — "find a topic."** Everything else is orientation
or a secondary on-ramp. Three personas land here; their stories drive the layout below.

### 1.1 Rosa — the first-time visitor (primary)

Arrives from a link or a search with **no idea what wiki+ is.** She must understand the product in
one glance and see the one action worth taking.

- **R1.** *As a first-time visitor, I want to understand in one or two sentences what wiki+ is, so I
  can decide whether it's for me without reading a list of topics.* → §3 explanation (AC6).
- **R2.** *As a first-time visitor, I want the page to point me at the single most important action
  (find a topic), so I'm not left scanning a grid wondering where to start.* → §2 hero hierarchy,
  search is dominant (AC1).
- **R3.** *As a first-time visitor, I want the page itself to say "a layer projected onto Wikipedia"
  before I read a word, so the brand's promise registers visually.* → §4 the projector (AC8).

### 1.2 Dev — the returning reader (primary)

Knows wiki+, wants a specific topic now. The explanation and the projector should **get out of his
way**; the search should be the obvious, immediate target.

- **D1.** *As a returning reader, I want to type a topic name and go straight to its page, so I reach
  any Wikipedia subject by name without browsing.* → §2/§5 search-to-route (AC3/AC4/AC5).
- **D2.** *As a returning reader, I want to see a few example topics to explore when I don't have one
  in mind, but never as the headline.* → §6 demoted topic list (AC7).

### 1.3 Cory — the future curator (secondary, v2)

A logged-in curator who wants to *contribute*. v1 serves Cory only through the same search (find the
topic → curate on its page). The **video-centric on-ramp** Cory wants is designed in the
[v2 spec](landing-page-v2-video-entry.md) and must coexist with — never displace — the anonymous
search this page leads with.

- **C1.** *As a curator, I want to start from a topic I have in mind,* served today by the search +
  the topic page's existing curate affordances. (v2 adds the paste-a-video on-ramp.)

**Story → AC trace** (the stories feed Product's criteria): R1→AC6 · R2→AC1 · R3→AC8 · D1→AC3/AC4/AC5
· D2→AC7 · component reuse→AC2/AC9 · geometry→AC10 · a11y→AC11.

---

## 2. Hero composition & visual hierarchy

The landing page is a **single centered column** (no wiki/plus divider — so VISUAL_IDENTITY §6.0
seam-to-column alignment is **N/A**). The composition is **tight from the lockup down to the search**
so the beam reads as projecting *onto* the search (Iteration-2 finding 2). Top to bottom:

```
┌─────────────────────────────────────────────────────────────────────┐  ← --header-field #fafbfe
│  [ Wiki+plus ]   …………………………………………………………… AuthControl (single)  ►│      (cool fluorescent)
│   ▲ HeaderProjector Tier A: tight lockup, lit "+" aperture, "pedia"    │      ─ NO "Contribute"
│         ╲   short narrow cone descends from the aperture   ╱           │      ─ auth NEVER a 2nd row
│        ╲     flares to the crossbar, brackets widen        ╱           │
│   ════╱══════════ GOLD BORDER (off both page edges) ══════════╲═════    │  ← content boundary (burn
│      │   …and the brackets keep going off-page, enclosing…     │       │      to white) --content-white
│      │              Find a topic                               │       │  ← #ffffff (warm daylight)
│      │   ┌─────────────────────────────────────────┐  ◄ HERO   │       │   the search sits INSIDE
│      │   │  Search any Wikipedia topic…        [🔍] │  the focus │       │   the projected light
│      │   └─────────────────────────────────────────┘   (AC1)   │       │   (bracket arms frame it)
│          wiki+ is a curation & contextualization layer over           │  ← concise explanation
│          Wikipedia… (1–2 sentences, sourced from VISION)              │      (AC6, §3)
│                                                                        │
│  ───────────────────────────────────────────────────────────────     │
│  Explore example topics                                  ◄ SECONDARY   │  ← demoted list heading (§6)
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ topic    │ │ topic    │ │ topic    │ │ topic    │   (the old grid,  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    reframed)      │
└─────────────────────────────────────────────────────────────────────┘
```

The crossbar's bracket arms widen off both page edges and **continue past `burnY`** so the
burnt-to-white region they enclose contains the "Find a topic" label + the search field — the search
literally sits **inside the projected "+"**, the way the mockup's article hint sits inside the
brackets immediately below the boundary. That enclosure is what stops the gold edge reading as an
"underline" (Iteration-2 finding 2).

**Hierarchy (what makes search the focus — AC1):**

1. **The projector header** is the brand statement and the literal light *projecting down onto the
   search*. It is visually loud but is **chrome**, not an action — its beam *aims the eye at, and
   lands on, the search field*. The beam burning to white into the hero is the device that makes the
   search feel "lit / projected onto" (§4). The composition is **deliberately tight**: lockup → short
   cone → crossbar just above the boundary → the search immediately inside the brackets below it. No
   large empty band between the gold edge and the search (that empty band is what made the build read
   as a divider).
2. **The search is the single dominant interactive element** — full-width within the centered column
   (target measure ~`640px` max, see §7), `h-11`/`text-base` (the `variant="home"` sizing already in
   `TopicSearch`), with its visible **"Find a topic"** label. Nothing else on the first viewport
   competes with it for "the thing to click." It sits **just below `burnY`**, within the projected
   light, not pushed far down the page.
3. **The explanation** sits **directly under** the search (not above the label), tight (§3). Search
   first, orientation second — a returning reader (Dev) acts without reading; a first-timer (Rosa)
   drops their eye one line and gets oriented.
4. **The topic list** is **below the fold-ish boundary**, under a quiet rule + a secondary heading,
   reframed as *examples to explore* (§6). It is never the page's headline (AC7).

**Placement of the search relative to the explanation — decision.** The visible **"Find a topic"**
label (rendered by `TopicSearch` `variant="home"`) is the hero's heading; we do **not** add a
separate `<h1>`. The explanation is a `<p>` *after* the search field. Rationale: a returning reader's
eye lands on the field, not on prose; the explanation rewards the first-timer who pauses. (If Dev
finds a screen-reader landmark needs a page `<h1>`, use a visually-hidden `<h1>wiki+</h1>` at the top
of `<main>` so the document still has a top-level heading without adding visible prose above the
search — see §8.)

---

## 3. The concise explanation (microcopy — AC6)

One-to-two sentences, faithful to `docs/VISION.md` *What it is / Why it exists*. **Use this copy
exactly:**

> **wiki+ is a curation and contextualization layer over Wikipedia.** It attaches creator-made
> videos to the topics you read about — each with a human-written note that separates the facts from
> the creator's opinion.

- Two sentences, ≤ ~40 words. First sentence = *what it is* (the headline claim, lifted from VISION
  line 5). Second = *the contribution* (the context note separating fact from opinion, VISION
  lines 13–15). No jargon ("oEmbed", "QID", "candidates") appears.
- **Styling:** `text-ink2` (`#595959`) body, `text-sm`/`text-[0.95rem]`, `max-w-[60ch]`, the first
  clause's "**curation and contextualization layer over Wikipedia**" may be `font-medium text-ink`
  to carry the one-glance claim. Centered under the search within the hero column.
- **The prototype disclaimer** ("curations are shared — everyone sees the same topics and clips")
  may be **kept as muted secondary text** (`text-ink/50`, `text-xs`), placed either as a trailing
  clause of the explanation or — preferred — moved down to head the topic list (§6), where "shared"
  is most relevant. It must not crowd the one-glance claim.

---

## 4. The Daylight Projector at Tier A in a free-standing hero (the hard design work)

This section maps VISUAL_IDENTITY §4.3's **strip-canvas** geometry to the **landing hero's real
dimensions**, fixes the single-column seam position, and states the meaning that must survive even if
pixels shift (per spec A2). The component is `HeaderProjector` (§5); this section specifies its
**Tier-A landing configuration** — *one configuration* of the parameterized component (AC10).

### 4.1 The meaning that must survive (VISUAL_IDENTITY §2 — load-bearing, never compromised)

Even where pixels shift between the mockup strip and the live header, **all of these must read:**

1. **Source + layer, in order.** Serif **"Wiki"** (the encyclopedia, Georgia) on the left of the
   seam; the indigo **"+" zine block** (the Indigo Press curation layer) on the right. The lockup is
   the irreducible core (§6.1) — it survives every tier.
2. **The "+" is an aperture / projector lamp** — a true even-odd knockout, white-hot core, thin gold
   *rim* (not a circle), "+"-outline bleed onto the indigo.
3. **The beam projects context onto the page below.** A strictly geometric "+"-shaped beam descends,
   flares past page width, and **becomes the content surface itself** — here, the hero/search area.
4. **Burn to white = one surface, no seam.** The cool `--header-field #fafbfe` above and the warm
   `--content-white #ffffff` below resolve inside the beam with no visible line.
5. **The gold border alone carries the (aesthetic) light signal** — a 2px `#EECE87` edge running
   straight off both page edges, glow clipped at the boundary. Gold is **decorative, never a
   functional signal** (§8.3 / VISUAL_IDENTITY §7.3).
6. **"pedia" persists** as the faintest dark ghost — Wikipedia is always the substrate; wiki+ never
   hides it.

If a rendering compromise is forced (perf — spec A3), **preserve meaning #1, #2, #3, #4, #6 and the
gold-edge-only signal** before any spectacle; shipping Tier A as a pre-rendered static SVG/PNG asset
is acceptable (the mark is static — VISUAL_IDENTITY §6.5).

### 4.2 Mapping the strip-canvas numbers to the real landing header

The mockup is a `1000 × 250px` strip with `pageY=150` (content boundary), `cyMid=64` (wordmark row
center), `bh=56` (block height), `tan=0.6` (beam slope), `eM=17` (crossbar inset). The live landing
header is **full-bleed width** (the page's centered content column lives *inside* it) and its own
height. The mapping rule: **the strip's proportions are preserved against the live header band; the
width is the live viewport width.** The numbers below are revised for Iteration 2 to **tighten the
composition** so the beam reads as a projection, not a divider (finding 2): the lockup sits lower (a
short cone), `burnY` is the band that puts the search *immediately inside* the brackets.

| Strip param | Strip value | Landing Tier-A target | Rationale |
|---|---|---|---|
| header field → content boundary `pageY` | `150px` of `250` | **`burnY` ≈ `150px`** from the top of the header band (default token `--projector-burn-y`) | Matches the mockup's `pageY=150` directly. Tall enough to flare; short enough that the gold edge isn't a far-off line. The search sits just below it (§4.4). |
| wordmark row center `cyMid` | `64px` | **`64px`** from header top (matches the mockup) | Lockup sits with its block bottom at ≈`92px`; leaves a **short** cone (≈`86px → crossY`) so the cone reads as a recessed-lamp beam, not a long empty corridor. |
| block height `bh` | `56px` | **`56px`** (unchanged) | The lockup is identity-fixed; don't scale the block with the header. "Wiki" stays `42px` Georgia 600 / "plus" stays `round(bh·0.46)≈26px`. |
| beam slope `tan` | `0.6` | **`0.6`** (default token `--projector-beam-tan`) | The variant-01 angle; keep it. At narrow widths the slope is unchanged but the apex→edge distance shrinks, so the cone reaches the edges sooner — the fluid-beam mechanism (§4.7). |
| crossbar inset `eM` | `17px` | **`17px`** (default token) | The crossbar ends sit `17px` from each page edge, then the brackets continue off-page — the off-page gold border (§4.5). |
| beam horizontal apex (projection x) | `seam` (= `cw/2`) | **the lockup's aperture center** (see §4.3) | The beam projects *from the lamp*, onto the search below. |
| full page width | `cw` | **live viewport width** (the header is full-bleed) | The gold border must run off *both real page edges*; a boxed header would make it read as an underline. |

**Flare distance + the tight composition (the fix for finding 2).** Beam top `top0 = blockBottom +
6px`; with `cyMid=64` and `bh=56`, `blockBottom = 92px`, so `top0 = 98px`. The crossbar sits `crossUp`
above `burnY` (default `crossUp=28px` → `crossY = 122px`); the brackets then widen to off-page by
`burnY=150px`. **Net: ~52px of vertical flare** between the block bottom and the burn boundary — a
*short* cone that reads as a recessed-lamp beam (this matches the mockup, where the cone is short and
the crossbar sits only `28px` above the boundary). **The build's mistake was a ~82px corridor with the
search far below `burnY=168`** — that empty band read as a divider. The corrected composition: short
cone, crossbar near the boundary, and **the search field's top within ~`16–24px` of `burnY`** so the
"Find a topic" label + field sit *inside* the bracket arms (§4.4). Below `burnY` the beam is pure
white and *is* the hero/search surface; the clip at `burnY` is invisible because white meets white.

### 4.3 Default seam position for the single-column hero — DECISION

The landing page has **no column divider** to align to, so the seam position is a free choice. **The
seam (and thus the whole lockup + the beam apex) is placed at the horizontal center of the centered
content column, NOT the center of the full-bleed viewport.**

- **Justification.** (a) The search field, the explanation, and the topic list are all centered in
  the content column; centering the lockup over that column means the **beam projects straight down
  onto the search field** — the metaphor ("the plus projects onto the front door") lands literally.
  (b) The gold border still runs off *both viewport edges* (it spans the full-bleed header at
  `burnY`), so the off-page signal is intact even though the lockup is column-centered. (c) It reads
  as deliberate composition, not an off-center accident.
- **Concretely:** `projectionX` (the beam apex x, a geometry prop — §5.2) defaults to the content
  column's center; the lockup is laid out so its **aperture center** sits at that x. The lockup as a
  whole is centered as a unit (serif "Wiki" to the left of the seam, the zine block to the right),
  matching the mockup's `seam = cw/2` *within the content column* rather than the full viewport.
- **Forward note:** on a future two-column Topic page the same prop is driven by the real wiki/plus
  column divider (a column-ratio, §5.2 / VISUAL_IDENTITY §6.0). On the landing page it is simply
  "content-column center." Both are *the same prop, different value* — which is the point of AC10.

**The tight seam — DECISION (Iteration-2 finding 1, the root-cause fix).** In `buildScene()` the
block's left edge sits **at the seam** (`bx = seam`), and the seam is "Wiki"'s right edge — so the
indigo block **butts directly against the serif with no gap**. The build broke this by pinning "Wiki"
to a fixed `WIKI_W = 110px` over-estimate ("to keep a comfortable gap") that pushed the block right of
the actual serif glyphs, opening a gap in which the ghost "Wikipedia"'s own "p" floated. **Respec:**

- The lockup is laid out so **"Wiki" takes its intrinsic width** (shrink-to-fit; no fixed `width`
  forcing a gap) and **the zine block butts immediately against "Wiki"'s right edge** — `marginLeft`
  between them is the mockup's seam offset (effectively `0`, or the block's own 2px ink border only),
  **not** padding. The seam is tight at *every* width.
- The ghost full-word **"Wikipedia"** is anchored left under "Wiki" (color `#6a5e46` @ .06, blur .8px)
  and the **"pedia"** halation ghost is anchored at the seam *behind the block*; the block (with its
  even-odd "+" knockout) **covers the ghost from the seam rightward**. The ghost is therefore visible
  **only through the lit "+" aperture cut** — never as floating letters in open space. If any ghost
  glyph would show *outside* the block (in a gap), the seam is wrong — fix the seam, never widen the
  block to hide it.
- **SSR-safe mechanism (no DOM measurement at first paint).** The old approach failed because it
  *guessed* "Wiki"'s width with a deliberate over-estimate. Use one of (Dev's call, both SSR-safe):
  (a) lay the lockup out as a shrink-to-fit `inline-flex` row — "Wiki" is an unsized inline span, the
  block follows with no left padding — so the seam is tight regardless of the precise glyph width and
  no constant is load-bearing for the gap; the beam apex then tracks the aperture via the same flow
  (the aperture's x = "Wiki" intrinsic width + block border + cut inset, resolved by layout, not a
  magic 110). Or (b) if a concrete apex x is needed for the SSR'd SVG path, anchor the *whole lockup*
  to the beam apex by centering it as a unit and offsetting by the **measured-once** half-lockup width
  exposed as a CSS custom property, with a tight Georgia-600-42px "Wiki" estimate (~`95px`, the real
  glyph advance — **not** an inflated 110) as the no-JS fallback. Approach (a) is preferred: it removes
  the magic constant entirely and cannot reintroduce a gap. The seam being tight is the hard
  requirement; how the apex is computed is the implementation detail.

### 4.4 The two-temperature surface in the hero

- `--header-field #fafbfe` fills the header band from its top down to `burnY`.
- `--content-white #ffffff` fills from `burnY` down — and this is the hero's own background. The hero
  (search + explanation) sits on `--content-white`, so when the beam burns to white it is
  indistinguishable from the surface the search sits on. **No cool/white seam line** appears where
  the beam lands; the search field reads as sitting *in the projected light*.
- The page `<body>` background (`#F7F7F7`) is **below** the hero; the hero block itself must paint
  `--content-white` so the burn-to-white has white to resolve into. Dev: give the hero container an
  explicit `#ffffff` background spanning at least from `burnY` through the explanation.

**Why it read as an underline before, and the rule that fixes it (finding 2).** The burn-to-white
meaning is *unchanged and correct* — the cool field above, warm white below, the white beam interior
invisible, the gold edge the only signal. That is the locked identity (VISUAL_IDENTITY §2.5/§2.6) and
we keep it. The build still read as a gold underline for **two composition reasons**, both fixed here:

1. **The bracket arms must visibly enclose the search.** In the mockup, the crossbar's arms turn
   down-and-out and the implied "+" *contains the content sitting immediately inside it*. The build
   put a near-full-width horizontal gold edge with **empty white space below it** before the search —
   so the eye read a line, not a frame. Fix: the search hero sits **directly inside the bracket
   arms**, its top within ~`16–24px` of `burnY` (§4.2), so the gold edge reads as the *top of the lit
   region the search lives in*, not a divider under a cool box. The bracket arms' off-page continuation
   (the `dn` downward expansion past the crossbar) is what frames the search — keep it.
2. **Do not let the gold edge become a flat full-width horizontal line.** The crossbar in the geometry
   is horizontal between its arm ends (`eM=17px` insets), and that is correct — but it must read as
   *the crossbar of a "+"* because the **narrow cone above it and the down-flaring brackets below it**
   are present and visible. The build effectively showed only the horizontal segment (tiny lockup, no
   visible cone, search far below). Fix: the short, clearly-narrower cone (§4.2) must be visible
   directly under the lamp, and the brackets must visibly turn down past `burnY`. The gold line is
   never *just* a horizontal — it is always the crossbar of a legible projected "+".

**Optional legibility aid for the white-on-white beam interior (Dev's call, must not break the
meaning).** The interior stays `#ffffff` per the locked identity; the gold edge carries the signal.
If, in the live render, the cone is hard to perceive at all against `#fafbfe` (the build's complaint),
Dev MAY keep the field `#fafbfe` and rely on the tightened composition + the gold edge-glow
(`drop-shadow`) to define the cone — which is the mockup's own technique (the mockup interior is also
`#ffffff` on `#fafbfe` and reads fine *because the composition is tight and the content sits inside the
brackets*). Do **not** introduce a colored or gradient beam interior to "make it show" — that would
break the burn-to-white meaning. The fix is composition + the gold edge, not paint.

### 4.5 The gold border off both page edges

At `burnY` the beam's brackets have widened past the viewport; the **2px `#EECE87` border runs
straight off both real page edges with no fade** (clipped at `burnY`, VISUAL_IDENTITY §5.6). The gold
edge-glow (`drop-shadow(0 0 4px …) drop-shadow(0 0 11px …)`) lives **only at this edge and is clipped
at `burnY`** so it never bleeds onto the white hero below. This is the single visible light signal;
the hero interior is plain white.

### 4.6 The aperture, bleed, rim, and "pedia" ghost

Render per VISUAL_IDENTITY §5.3–§5.5 exactly: white-hot `44×44` radial core; the gold **rim** is an
SVG stroke on the "+" path clipped to the interior (gold at the edge, clips to white inward — *not* a
circular glow); the **"+"-outline bleed** is two screen-blended blurred "+" shapes (a no-op over the
white cut, showing only where it spills onto the indigo); the **"pedia" ghost** is Georgia 600 42px
`#000` @ `~.24` opacity, `blur 1.45px`, **anchored at the seam behind the cut** (§4.3 — covered by the
block, glimpsed only through the aperture, never floating in a gap). On the landing page the lockup is
**centered in the content column** and the block covers the ghost from the seam rightward, so "pedia"
never clips at the viewport edge regardless of width — it lives entirely behind the block. The ghost
therefore **renders at every width** (no longer dropped on narrow — see §4.7 / §7).

### 4.7 The fluid beam — present at EVERY width (Iteration-2 finding 3, owner override)

**Owner decision:** on the landing page the projector **beam is present at all viewport widths**, its
width fluidly adapting to the viewport so it always flares to both page edges and burns into the
search. **This overrides VISUAL_IDENTITY §6.2's `md` Tier-B beam-drop and §6.3's "stubby beam → drop"
/ "gold off-page → full-bleed-only → else Tier B" guidance, for the landing page only.** (The
Topic-page tiers in VISUAL_IDENTITY are unchanged; the landing header is the free-standing full-bleed
case the override is scoped to.)

**How the beam scales fluidly (the mechanism — already supported, just drive it).** The beam is one
**full-width inline SVG** rendered with **`preserveAspectRatio="none"`** spanning the live viewport
width (`width=100%`, `viewBox = 0 0 <cw> <burnY>`). The geometry is parameterized by `beamSlope`
(`tan=0.6`), `crossUp` (28px), `edgeInset` (17px), `burnY` (150px) — **none of which change with
width**; only `cw` (the viewport width) changes. The consequence is automatic and correct:

- **The apex is fixed** at the aperture (content-column center). The cone half-width at the crossbar is
  `crossUp · tan ≈ 17px` regardless of viewport — so the cone is **always a narrow stem under the
  lamp**, never a sliver and never a wedge. Good at 320px and at 1600px.
- **The crossbar arms always reach `edgeInset` from both real page edges** (`LX = 17`, `RX = cw-17`),
  then the brackets turn down-and-out off-page. So the gold edge **always flares to both page edges and
  always burns into the search** — at a narrow viewport the horizontal crossbar segment is simply
  *shorter* (fewer px between cone and edge), at a wide viewport it is *longer*. The "+" reads at every
  width.
- **The vertical proportions (`burnY`, `crossUp`, cone height) stay constant**, so the beam never
  becomes a stubby horizontal sliver as the viewport narrows — the thing that VISUAL_IDENTITY §6.3
  warned about. The narrow case is not a degenerate beam; it is the **same beam, narrower**. This is
  precisely why the override is safe: the fluid mechanism keeps it a legible projection.

**Coherence at narrow widths.** The **lockup stays tight** (§4.3 — block butts "Wiki", no gap) and
fully visible; the **aperture/rim/bleed render at every width**; the **"pedia" ghost stays behind the
block** (§4.6, never clips). If "Wiki" + the block ever can't fit the viewport (very small phones,
~`< 360px`), the **lockup** may scale down as a unit (font + block proportionally), but the **beam
stays a beam** — apex on the (now-smaller) aperture, arms still to both edges. The composition
(lockup → short cone → crossbar → search inside) holds at every width; only the crossbar's horizontal
length and (at the smallest sizes) the lockup scale change. **No tier-drop on the landing page.**

> **Recorded override.** This §4.7 + the §7 tier table replace the landing page's previous tier-drop
> behavior. VISUAL_IDENTITY §6.2/§6.3 remain authoritative for the **Topic-page** header (shorter
> sticky header, real two-column divider) — there the beam may still drop to Tier B/C. The two are
> reconciled by scope: *landing = beam-at-every-width; Topic = tier-aware.* Same component, different
> driven config (AC10).

---

## 5. The `HeaderProjector` component API (conceptual — AC9 / AC10)

A single new reusable component (bespoke Tailwind + inline SVG; **no shadcn**, no new font — reuse the
article Georgia stack for the serif and the Source Sans Pro stack for "plus"). It is **tier-aware**
and **parameterized**. **The landing page consumes `variant="projector"` (Tier A) at every viewport
width** (Iteration-2 finding 3 / §4.7 — no responsive tier-drop on the landing page); the other tiers
+ the geometry props are defined now so the future *Topic-page* shared-header rollout is a configuration
change, not a second build (spec §Forward-looking).

### 5.1 The `variant` prop — the four tiers (AC9)

```
variant: "projector" | "lockup-lit" | "lockup-flat" | "glyph"
//          Tier A         Tier B          Tier C         Tier D
```

| `variant` | Tier | Renders (per VISUAL_IDENTITY §6.2) |
|---|---|---|
| `"projector"` | **A** | Full treatment: lockup + lit aperture + descending beam to the burn boundary + gold border off-page + "+"-bleed + "pedia" ghost. **The landing page uses this at EVERY width** (the beam scales fluidly — §4.7). |
| `"lockup-lit"` | **B** | Lockup + lit aperture (core + gold rim + tight bleed), **no beam** (nowhere to flare). *Topic-page* fallback only — **not used on the landing page.** |
| `"lockup-flat"` | **C** | Plain lockup: serif "Wiki" + a flat indigo "+" block (a drawn "+" glyph is acceptable — no lamp). No beam, glow, or "pedia". *Topic-page* fallback + `forced-colors` (§8.5) — not the landing default. |
| `"glyph"` | **D** | A single indigo "+" zine tile (the block alone) for favicon/app-icon/very-small UI. |

Default `variant` = `"lockup-flat"` (the safest, smallest treatment) so a careless call site degrades
gracefully rather than to the most expensive render. **The landing page passes `variant="projector"`
explicitly and keeps it at every width** — it does not swap to a lower tier as the viewport narrows
(§4.7). The Tier B/C/D variants remain defined for the future Topic-page header (and `forced-colors`,
§8.5), which is the only place the component still drops tiers.

`accessibleName?: string` defaults to `"wiki+"` (§8.1). `as?: "div" | "a"` + `href?` so the mark can
be a home link (on the Topic page it links home; on the landing page it may be a non-link `div` or a
no-op self-link — Dev's call, but the accessible name is `"wiki+"` either way).

### 5.2 The parameterized geometry (AC10) — props/tokens with sensible defaults

The owner's requirement: the beam geometry and the seam position are **props/tokens with defaults**,
so the v1 Tier-A landing render is *one configuration* and future dynamic work is a matter of
*driving* these props — **the dynamic behavior is NOT built this round** (spec Out of scope). Define
this `geometry` config shape (names are the contract; pin the numeric defaults as CSS variables /
tokens so the call site doesn't carry magic constants):

| Geometry prop | Token | Tier-A landing default | What it varies (future) |
|---|---|---|---|
| `beamSlope` | `--projector-beam-tan` | `0.6` | Beam arm angle — steeper/shallower flare. |
| `beamCrossUp` | `--projector-cross-up` | `28px` | How far above `burnY` the crossbar sits (flare timing). |
| `beamEdgeInset` | `--projector-edge-inset` | `17px` | Crossbar end inset from the page edge before brackets go off-page. |
| `burnY` | `--projector-burn-y` | **`150px`** (was 168 — Iteration-2 finding 2, tightened to match the mockup's `pageY`) | The content boundary — where the beam burns to white. On the landing page the search sits just below it (§4.2/§4.4). |
| `projectionX` | `--projector-projection-x` | content-column center (§4.3) | The beam apex x — **the projection's horizontal position** (page-center vs. offset; future: onto a column). |
| `seamRatio` | `--projector-seam-ratio` | `0.5` (centered) | **The wiki/plus seam position driven by a column-ratio** — 0.5 = equal; >0.5 = Plus column wider, seam shifts left, etc. On the landing page the lockup is centered as a unit; `seamRatio` is the hook the future two-column header drives from its real column widths. |
| `fullBleed` | `--projector-full-bleed` | `true` | Whether the gold border runs off real page edges. On the landing page this is **always `true` at every width** (the header is full-bleed; the beam is fluid — §4.7), so it never drops the off-page edge. (The Topic page may set `false` ⇒ Tier B per VISUAL_IDENTITY §6.3.) |

**Note (Iteration 2):** the beam's fluid scaling (§4.7) is **not** a new prop — it falls out of these
fixed geometry values applied to a `preserveAspectRatio="none"` full-width SVG whose `viewBox` width is
the live viewport width. No width-dependent prop is needed; the beam adapts because `cw` changes while
`beamSlope`/`crossUp`/`edgeInset`/`burnY` do not.

**Explicit scope statement for Dev (AC10):** build the component so these are **named props/typed
config with the defaults above**, such that the landing render is `<HeaderProjector variant="projector"
/>` with *no inline geometry numbers at the call site*. Do **not** implement the *dynamic* behavior
(no live column-ratio measurement, no runtime re-projection) — that is a future issue. You are
specifying the **API shape only**; verification is "geometry is passed via props/typed config with
defaults; the dynamic behavior itself is not implemented" (AC10 verify line).

### 5.3 Tokens to pin (VISUAL_IDENTITY §4.2 — the gold + surface tokens)

Pin in the Tailwind `@theme` / CSS variables, disciplined per the gold-as-accent rule:

| Token | Value | Use |
|---|---|---|
| `--gold-rim` / `goldE` | `#EECE87` | beam border (2px), aperture rim stroke, gold edge-glow, wider bleed "+" |
| `--gold-fill` / `gold` | `#FFECB2` | aperture core radial, *mixed toward white only* |
| `--bleed-warm-white` | `#FFFCF6` | tighter inner bleed "+" |
| `--header-field` | `#fafbfe` | cool header band above `burnY` |
| `--content-white` | `#ffffff` | hero surface + beam interior below `burnY` |
| `--pedia-ghost-brown` | `#6a5e46` @ .06, blur .8px | full faint "Wikipedia" backing word |
| `--pedia-black` | `#000` @ ~.24, blur 1.45px | "pedia" halation ghost |

These golds are **lighter/desaturated** vs. brand gold `#E5AB28` and never appear as a saturated fill
(VISUAL_IDENTITY §4.2). They live only in the wordmark; never reused as a UI/state color (§8.3).

---

## 6. The demoted topic list (AC7)

Keep the existing list (read via `store.listTopics()` — unchanged data path) but **below the hero**,
reframed as secondary "explore" content.

- **Heading microcopy:** **"Explore example topics"** (`<h2>`, `text-base`/`text-lg`, `font-medium
  text-ink`) — *not* the page headline. It sits under a quiet full-width rule (`border-t
  border-ink/10`) separating it from the hero.
- Optional muted line beneath the heading carrying the **prototype "shared" disclaimer** if not kept
  in the explanation: *"(Prototype: curations are shared — everyone sees the same topics and clips.)"*
  `text-xs text-ink/50`.
- The card grid is **unchanged in structure** (the existing `<ul className="grid gap-3
  sm:grid-cols-2">`, the `.plus-card`-adjacent card look, title + description + QID). Its prominence
  is what changes: smaller heading, below the fold-ish boundary, framed as examples.

### 6.1 Every state of the topic list (preserve existing — AC7)

| State | Condition | Render (microcopy verbatim) |
|---|---|---|
| **Loading** | `topics === null` | `Loading…` (`text-sm text-ink/50`) — unchanged. |
| **Read-error floor** | `loadError` (a server read can fail — the existing floor) | `Couldn't load topics — please refresh.` (`text-sm text-ink/50`) — **must be preserved** (AC7 verify). |
| **Empty** | `topics.length === 0` | `No topics yet.` (`text-sm text-ink/50`) — unchanged. |
| **Populated** | `topics.length > 0` | The card grid, unchanged. |

These four states are inherited from the current `app/page.tsx`; this rebuild **must not regress**
them (spec Guardrail). They simply now live under the secondary "Explore example topics" heading.

---

## 7. Responsive behavior — the beam is present at EVERY width (AC8 responsive)

Web-first, responsive. **Owner decision (Iteration-2 finding 3, overriding VISUAL_IDENTITY §6.2/§6.3
for the landing page):** the landing page renders **`variant="projector"` (Tier A) at every viewport
width** — it does **not** drop the beam to Tier B/C as the viewport narrows. The beam's width scales
fluidly (§4.7) so it always flares to both page edges and burns into the search. The principle shifts
from "shed the spectacle as it narrows" to **"keep the projection, scale it fluidly"** — the fluid
mechanism (constant vertical proportions, viewport-width `viewBox`, `preserveAspectRatio="none"`) is
what makes that safe rather than producing a sliver.

| Breakpoint | Header / projector | Search | Topic list |
|---|---|---|---|
| **`≥ lg` (desktop, ~≥1024px)** | **Tier A `"projector"`** — fluid beam to `burnY=150px`, gold border off both edges, lit aperture + bleed + "pedia" (behind the block), tight seam, lockup column-centered (§4.3). The crossbar's horizontal segment is at its widest. | Full-width within the content column (max ~`640px`), `h-11`/`text-base`, visible "Find a topic" label, **sitting inside the projected light** (top within ~16–24px of `burnY`, §4.4). | 2-col grid (`sm:grid-cols-2`). |
| **`md` (~768–1023px)** | **Tier A `"projector"`** — **same treatment, fluid beam.** The crossbar segment is shorter (apex→edge distance smaller) but the cone, crossbar, off-page brackets, gold edge, lit aperture, tight seam, and "pedia" **all still render** (§4.7). No beam-drop. | Full-width within the column; sits inside the beam. | 2-col grid. |
| **`< md` (mobile)** | **Tier A `"projector"`** — **same treatment, fluid beam, scaled to the narrow viewport.** Cone + crossbar + off-page gold edge + lit aperture + tight seam + "pedia" all render. If "Wiki" + block can't fit ~`< 360px`, the **lockup scales down as a unit** (font + block proportionally) but the beam stays a beam (§4.7). | **Full-width, never collapsed to an icon** (AC1 — the landing search must stay prominent; the `topic-disclosure` icon variant is for the *Topic* header, never the landing page). Still inside the beam. | Single column (grid reflows to 1-col). |

**What stays constant at every width (the invariants — AC8 verify against these):**

- **The beam is always a legible projected "+":** narrow cone under the lamp → crossbar near `burnY` →
  brackets off both page edges → search inside. Never a horizontal sliver, never dropped (§4.7).
- **The seam is always tight** — the block butts "Wiki" with no gap, the ghost glimpsed only through
  the aperture (§4.3). This is the most-regressed property from the build; check it at all widths.
- **The gold off-page edge always runs to both real page edges** (`fullBleed=true` always on the
  landing page — the header is full-bleed at every width).
- **"pedia" never clips** because it lives behind the block (§4.6).
- **The search hero never degrades** below "full-width, labeled, prominent, inside the projected
  light." This protects AC1 across all sizes.

There is **no tier-drop on the landing page.** (The Tier B/C variants and the VISUAL_IDENTITY §6.2/§6.3
drop logic remain in force for the future *Topic-page* header, which is out of scope this round — §10.)

### 7.5 Header chrome — auth placement, no "Contribute", both auth states (findings 4, 5, 6)

The header band contains exactly two things: the **`HeaderProjector` lockup** (centered, §4.3) and a
**single `AuthControl variant="home"`**. Nothing else.

**No "Contribute" label (finding 4).** The "Contribute" link is **removed entirely** from the landing
header — not relocated, not hidden behind a menu, gone. (A curator's contribute path is on the Topic
page, per the v1 personas §1.3; the landing header's one job is "find a topic" + sign-in.) Dev: delete
the Contribute link from `app/page.tsx`'s header; do not leave a placeholder slot.

**Auth placement — never a second row (finding 5).** The single `AuthControl variant="home"` sits in
the header at every width **without ever wrapping to its own row beneath the lockup** (the build let
it fold to a second row once Contribute was alongside it):

- **Desktop (`≥ md`):** the header is a single row — the lockup centered in the content column, the
  `AuthControl` pinned to the **right edge** of the full-bleed header (top-right), vertically aligned
  with the lockup row. Because the lockup is column-centered (not full-width), there is room on the
  right for the auth control on the same row. Use a layout that keeps the lockup centered *and* the
  auth right-anchored without the auth pushing the lockup off-center (e.g. an absolutely/grid-anchored
  right slot over a centered lockup, so the lockup's centering is independent of the auth width).
- **Narrow (`< md`):** the auth control stays in the **top-right of the header row** (top bar feel),
  the lockup below/centered — but the auth must **not** stack into a full second row that pushes the
  beam/search down. If horizontal room is tight, the **lockup may scale down** (§7) before the auth is
  allowed to wrap. The auth control is a single compact element; it fits a top-right corner at every
  width. (`variant="home"` is not `compact`; if the full "Log in with Wikipedia" label is too wide for
  the smallest phones, that is acceptable to wrap *within the button*, but the **button itself does not
  become a second header row** — keep it in the top-right.)
- The header band height is driven by the projector (`burnY=150px`, §4.2); the auth control sits within
  that band aligned to the lockup row, never adding a row that increases the band height.

**Both auth states must render gracefully (finding 6).** `AuthControl variant="home"` already encodes
both; the landing header must render each cleanly in the placement above:

| Auth state | `AuthControl` renders | Landing-header requirement |
|---|---|---|
| **Loading** (`status==="loading"`) | A neutral pulse chip (`h-[34px] w-20`, `bg-ink/10`) — **never** a flash of the signed-out button. | The chip occupies the same right-anchored slot; no layout shift when it resolves. |
| **Logged-out** | The **"Log in with Wikipedia"** button — `bg-brand text-white`, `border-2 border-ink`, the `WikiGlyph` + word label (AA 4.70, the word carries the label, not color). | Top-right slot, single row. This is the state in the current screenshots. |
| **Logged-in** | `SignedIn` — avatar/initial + the user's **username** + a Radix disclosure menu (profile link → `/contributor/<username>`, Sign out). | Same top-right slot, single row, at every width. The username text must not force the auth control to wrap to a second row — on the narrowest widths the `SignedIn` component already hides the username behind the avatar (`compact` behavior); on the landing `variant="home"` it shows the username, so ensure the right slot has room or the lockup scales (§7) rather than the auth wrapping. |

Dev must capture **both** the logged-out and logged-in header in the post-build screenshots (UX
re-evaluation needs both — the prior round only showed logged-out). The `onIndigo` skin is **not** used
on the landing page (`variant="home"` → `onIndigo=false`); the login button is indigo-on-light, never
white-on-indigo (there is no indigo block behind it in the landing header).

---

## 8. Accessibility (baseline, AA — AC11)

The wordmark is **decorative imagery built around real text** (VISUAL_IDENTITY §7); the search hero
inherits `TopicSearch`'s verified a11y model. Both are written into the build.

### 8.1 The wordmark accessible name + decorative layers

- The whole mark exposes the accessible name **`wiki+`** — `aria-label="wiki+"` on the
  `HeaderProjector` container (or its link). A screen-reader user hears **the product name**, never
  "Wiki", "plus", "pedia" as three fragments, and never the beam.
- **All decorative layers are `aria-hidden="true"`:** the SVG beam + its gold border/glow, the
  aperture core, the gold rim, the "+"-outline bleed, the "Wikipedia"/"pedia" ghosts, the
  two-temperature surface. (AC11 verify: a DOM assertion that the container is named "wiki+" and the
  decorative layers carry `aria-hidden`.)
- The "pedia" ghost is intentionally near-invisible and **must never be read aloud** — `aria-hidden`,
  never a content node.

### 8.2 Contrast on the real text (AA)

- **Serif "Wiki" `#1b1b1b` on `--header-field #fafbfe`** ≈ **17:1** — passes AA/AAA.
- **White "plus" on indigo `#676EB4`** ≈ **3.9:1** — fails AA-normal but **passes AA-large**; it is
  Source Sans Pro **900 at ~26px** (≥18.66px bold = "large" by WCAG), so keep it **bold and large**
  (the same relationship accepted on the live `.plus-card` heads). If a fallback tier ever sets
  "plus" smaller/lighter, re-check or darken the block toward `--violet #5248AF`.
- **The gold border / glow / aperture are decorative** and carry no meaning — exempt from
  text-contrast (WCAG 1.4.1/1.4.11 apply to meaningful UI, not decoration). (AC11 verify: contrast
  check on the two real-text pairs only.)

### 8.3 Gold is decorative, never a functional signal (VISUAL_IDENTITY §7.3)

The gold "carries the signal" only as an *aesthetic* (light intensity). It encodes **no** product
state, status, accuracy, stance, or interactivity. The product's real signals (fact-vs-opinion chips,
sync status) live elsewhere, text-labeled. **Rule (write into the component):** the wordmark gold must
never be reused as a functional/state color (gold is otherwise reserved/avoided in the UI).

### 8.4 Keyboard path through the search (inherited)

The hero is fully keyboard accessible via `TopicSearch` (verified by #12): **Tab** to the input,
**type**, **↓/↑** through suggestions (the no-results hint row is skipped — it is `role="presentation"`,
not an option), **Enter** to navigate (an active option selects it; otherwise the raw typed text
navigates). Visible focus is the `.search-field:has(input:focus-visible)` brand outline (already in
`globals.css`). The landing page must not interpose any focus trap or reorder the tab sequence ahead
of the search (the search is the first interactive target after the header chrome). (AC11 verify: a
keyboard pass through the search.)

### 8.5 Font-fallback + forced-colors (VISUAL_IDENTITY §7.5)

- **Web-font failure:** "Wiki"/"pedia" → Georgia (near-universal system serif); "plus" → the
  `system-ui, sans-serif` **bold** stack other Source Sans Pro headings use. The lockup must stay
  legible without the web fonts.
- **`forced-colors: active` / high-contrast:** the burn-to-white/gold treatment cannot survive a
  forced palette. **Force the flat Tier-C lockup** (serif "Wiki" + bordered "+" block) under
  `forced-colors: active` so the *shape* carries recognition; drop the beam/glow/ghost. The lockup
  shape + the search remain operable.
- **Reduced motion:** the mark is **static** — nothing animates, so there is no reduced-motion risk
  today (VISUAL_IDENTITY §6.5/§7.4). If a future lamp warm-up is added it must be
  `prefers-reduced-motion`-gated.

---

## 9. Search hero states in context (inherited from `TopicSearch` — shown here, not re-specified)

The hero renders `TopicSearch variant="home"` exactly as shipped (#12). Its states are **inherited**
from [`docs/design/navbar-topic-search.md`](navbar-topic-search.md); this section only shows how each
reads **in the hero**, under the projector, so QA can screenshot them and Dev wires nothing new (AC2 —
no fork). The route behavior (AC3/AC4/AC5) is unchanged and not re-specified.

| Search state | In the hero | Verify (AC) |
|---|---|---|
| **Idle (S0)** | Empty field, "Find a topic" label, placeholder "Search any Wikipedia topic…", magnifier submit. The beam burns to white right above it. | AC1 — dominant, full-width, above the list. |
| **Typing / in-flight (S2)** | The decorative busy dots in the fixed-width slot (no reflow). No error UI. | AC1; inherited. |
| **Suggestions (S3)** | The listbox popup drops below the field over the white hero (`border-2 border-ink`, `shadow-[4px_4px_0_…]`), arrow-navigable. | AC3 — selecting routes to `topicHref(title)`. |
| **No-results hint (S4)** | The non-blocking row "No matching articles — press Enter to open "{q}"" — **Enter still navigates** to `topicHref(typed text)` (create-on-demand / not-found downstream). | AC5 — non-blocking; no separate results page. |
| **Silent degrade (error → S4)** | A suggest fetch failure collapses to the same no-results hint — **never an error UI** in the hero. | Inherited; AC5. |

The hero adds **no** write, no `/contribute` coupling, no QID in the URL — pure navigation (AC4).

---

## 10. Shared-header compatibility note (broad strokes — owner decision 5)

This session does **not** rewire the Topic-page header (`components/topic/TopicHeader.tsx`) — that is
an explicit future session. But the landing header must be framed so that future session can **adopt
`HeaderProjector` at Tier B/C without a rewrite.** What is genuinely shareable vs. what legitimately
differs:

**Shareable now (build the landing header out of these):**

- **`HeaderProjector` itself** — the same tier-aware component; the Topic page consumes `"lockup-lit"`
  (Tier B) or `"lockup-flat"` (Tier C) in its shorter sticky header. The four-tier `variant` prop +
  the §5.2 geometry props are the shared contract.
- **`TopicSearch`** — already shared (`variant="home"` here, `topic-inline`/`topic-disclosure` there);
  no change.
- **Auth chrome** — `AuthControl` (`variant="home"` here). The Topic header places it differently
  (in the indigo +plus block `lg+`, compact `< lg`) but it is the same component family.

**Legitimately differs on the Topic page (do NOT design here):**

- **Seam-aligned to the real wiki/plus column divider** (VISUAL_IDENTITY §6.0) — the Topic page has a
  real two-column grid (`lg:grid-cols-[1fr_360px]`), so its Tier-A seam (if ever rendered) aligns to
  that divider via `seamRatio`/`projectionX`. The landing page has no divider → `seamRatio` defaults
  to centered (§4.3). **Same prop, different value.**
- **Shorter sticky header height** → the Topic page lives at Tier B/C (no room for the beam to flare);
  the landing page's tall free-standing header is what affords Tier A. The `burnY` token absorbs this.
- **The two-world split header layout** (`TopicHeader`'s grid mirroring the page columns, the indigo
  +plus block, the compact auth on the Wiki row) is Topic-specific chrome around the projector; the
  landing page wraps the projector in a single-column hero instead.

**Framing rule for Dev:** keep all geometry/seam values **in `HeaderProjector`'s props/tokens** (never
inline at the landing call site), so the future shared-header session changes *only the variant +
geometry values it passes*, not the component. This is exactly what AC10 asks for and is the setup
that makes the shared-header rollout a configuration change.

---

## 11. What Development should build (hand-off summary)

1. **`HeaderProjector`** — a new reusable, tier-aware component (bespoke Tailwind + inline SVG; no
   shadcn, no new font). `variant: "projector" | "lockup-lit" | "lockup-flat" | "glyph"` (Tiers
   A/B/C/D); the §5.2 geometry props/tokens with the Tier-A landing defaults; `accessibleName="wiki+"`;
   the §8 a11y model (aria-label, `aria-hidden` decorative layers, AA real text, forced-colors → flat
   lockup, font fallbacks). Implement Tier A per VISUAL_IDENTITY §5; define Tiers B/C/D and the
   geometry props but only Tier A is consumed this round. **Do not implement the dynamic geometry
   behavior** (AC10 — API shape only).
2. **Pin the gold + surface tokens** (§5.3) in Tailwind `@theme` / CSS variables.
3. **Rebuild `app/page.tsx`** — the single-column hero: `HeaderProjector variant="projector"` →
   `TopicSearch variant="home"` (the focus, AC1, **sitting inside the projected light** — §2/§4.4) →
   the §3 explanation (AC6) → a quiet rule → the **demoted** topic list under "Explore example topics"
   (AC7, all four states preserved). **Header chrome = the centered lockup + a single `AuthControl
   variant="home"` only — REMOVE the "Contribute" link entirely (finding 4), and place the auth control
   so it never folds to a second row (finding 5), rendering both auth states (finding 6) — §7.5.** The
   search path is **reused unforked** (AC2) — single `TopicSearch` import, no new search component.
4. **Responsive** per §7 — **`variant="projector"` (Tier A) at EVERY width** with the fluid beam (§4.7);
   the seam stays tight, the beam never drops, the search stays inside the projected light; search
   full-width/never collapsed at every width; list reflows 2-col → 1-col. **No tier-drop on the landing
   page** (finding 3).
5. **Tests** for: search-to-route (existing seeded title, created-on-demand title, unknown-title Enter
   — these largely assert #12 behavior is unchanged from the landing host); the wordmark accessible
   name (`"wiki+"`) + decorative-layer `aria-hidden` model; the topic-list read-error floor still
   renders. (AC11/AC12.)
6. **Do NOT** touch `components/topic/TopicHeader.tsx` or the article body (VISUAL_IDENTITY §9.3 / spec
   Out of scope). **Do NOT** add the v2 video-entry UI (separate spec, design-only this round).

## 12. Open design questions flagged for Dev

- **OQ-1 — exact `burnY` / header band height (revised Iteration 2).** `burnY=150px` and `cyMid=64px`
  now match the mockup's strip directly (§4.2). The composition must stay **tight**: short cone, crossbar
  near `burnY`, the search's top within ~`16–24px` of `burnY` so it sits inside the brackets (§4.4). The
  failure to avoid is the build's loose ~82px corridor with the search far below the gold edge. Dev maps
  to the real header band but **must verify, side-by-side against the mockup, that the result reads as a
  projection onto the search and not an underline** — this side-by-side check is the explicit gate this
  iteration adds.
- **OQ-2 — perf of the live mark (spec A3).** If the CSS `filter`/`mix-blend-mode` + SVG causes jank,
  ship Tier A as a **pre-rendered static SVG/PNG asset** (the mark is static) — Dev's call at build,
  not a blocker. **Caveat (Iteration 2):** a static asset must still scale fluidly to viewport width
  (§4.7) and keep the gold edge to both page edges; a fixed-width PNG would reintroduce the
  underline/boxed problem at off-design widths. If pre-rendering, render the *lockup* statically but keep
  the *beam* as the fluid full-width SVG. The accessible-name/`aria-hidden` model still applies.
- **OQ-3 — page `<h1>` for landmarks.** The hero uses the search's visible "Find a topic" label as the
  heading and no visible `<h1>`. If a screen-reader landmark audit wants a top-level heading, add a
  visually-hidden `<h1>wiki+</h1>` (§2) rather than visible prose above the search.
- **OQ-4 — SSR-safe tight seam + beam apex (Iteration 2, the root-cause area).** §4.3 prescribes the
  tight seam and gives two SSR-safe mechanisms (preferred: shrink-to-fit `inline-flex`, no fixed
  `WIKI_W`). Dev picks the mechanism; the **hard requirement is the tight seam at every width** (no gap,
  ghost only through the aperture). Flag back to UX if neither mechanism lands the aperture on the beam
  apex within ~`2px` without a layout-measurement hook — but the seam tightness is non-negotiable
  regardless of how the apex is computed.
- **OQ-5 — no Tier A↔B breakpoint on the landing page (replaces the old OQ-4).** The landing page stays
  Tier A at every width (§7, finding 3); there is no Tier A↔B breakpoint to tune here. The breakpoint
  question moves to the future *Topic-page* header session (VISUAL_IDENTITY §10.2 #6), out of scope now.
