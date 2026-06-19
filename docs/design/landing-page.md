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
   SVG, so it scales. → §4.7, §7 (the tier table is rewritten to beam-at-every-width). **[Iteration-3
   correction: the "beam at every width" intent stands, but this `preserveAspectRatio="none"` stretch
   mechanism is RETRACTED — it caused the underline; see the Iteration-3 note above + §4.7. The beam is
   instead drawn true-scale with asymmetrical, real-length arms.]**
4. **Remove the "Contribute" label entirely** from the landing header — gone, not relocated. → §8 (new
   header-chrome section), §11 hand-off.
5. **Auth chrome must not fold to a second row.** With Contribute gone, the single `AuthControl
   variant="home"` sits cleanly in the header at every width without wrapping to its own row under the
   lockup. → §8.
6. **Both auth states must render gracefully** — logged-out ("Log in with Wikipedia") and logged-in
   (the user's identity). → §8.

---

## Iteration 3 — the owner's FINAL beam model (PR #61, 3rd review) — DECISIONS, design to these

The owner reviewed the Iteration-2 build again and the beam **still reads as a flat "gold underline"**
(`docs/design/landing-page-screenshots/landing-desktop-tierA.png`, `projector-detail.png`) next to the
mockup (`mockup-reference-solo01.png`). The **root cause is now understood and confirmed in code**, and
the spec itself prescribed the bug: §4.7 told Dev to draw the beam as **one full-width SVG with
`preserveAspectRatio="none"` and a fixed `viewBox` width (`VBW=1000`) mapped to 100%**, "so only `cw`
varies." That mechanism **uniformly stretches the whole beam horizontally** (~2.5× at desktop): the
narrow stem balloons into a wide blob, and the angled crossbar arms flatten toward horizontal — which is
*exactly* a flat full-width gold line with a tiny bump = the "underline." **That §4.7 stretch approach is
RETRACTED.** The correct model — the owner's decisions, spec these exactly:

1. **Apex locked to the aperture.** The beam always originates from the lit "+" cutout, at the cutout's
   x — wherever the cutout sits. The apex is not an independent coordinate; it *is* the aperture.
2. **The aperture can be anywhere horizontally — NOT locked to center.** Its x is **layout-driven**:
   centered on desktop (auth in the corner, one row), left-anchored at narrow widths (auth on the
   right, one row). The apex tracks it wherever it lands.
3. **Stem width = the "+" cutout width, drawn at TRUE 1:1 pixel scale.** The central stem + the angled
   flare up to the crossbar are **never horizontally stretched.** (This replaces the
   `preserveAspectRatio="none"` whole-shape stretch.)
4. **Crossbar arms are ASYMMETRICAL.** Each arm runs horizontally from the apex/crossbar out to **its
   own real page edge**; the left-arm length and right-arm length are **independent**, so an off-center
   apex yields a short arm on one side and a long arm on the other. **Arm length is the variable
   parameter that adapts to layout/width** — it is the *only* horizontal thing that changes.
5. **Angle is fixed** at the mockup's `tan = 0.6` for now (a parameter that *may* vary later — "maybe").
6. **So the ONLY things that vary by layout are the aperture/apex x and the two (asymmetrical) arm
   lengths.** Stem width, the flare angle, and all vertical proportions are **FIXED / true-scale.**

Plus two more requirements this iteration locks:

- **Narrow-width = ONE row (this replaces the top-strip).** At narrow widths the lockup and the single
  `AuthControl` share **one header row** (lockup left, auth right). The beam apex follows the now
  off-center (left-anchored) aperture, producing a short left arm + a long right arm (decision 4). There
  is **no top strip and no folded second row at any width.** At desktop the lockup may remain centered
  with auth in the corner (still one row). → §4.3, §7, §7.5.
- **Restore the lamp glow.** The lit "+" aperture must read as a **white-hot GLOWING lamp with bloom
  spilling onto the indigo** (per the mockup's `?solo=01`), **not a flat white cutout.** The build's
  aperture lost its luminosity, which is part of why the gold edge reads flat. Strengthen the core
  glow / screen-blend bleed so the lit aperture matches the mockup. → §4.6 (renamed to the lamp section).
- **The "underline" is the beam polygon's BOTTOM CLOSING EDGE drawn AT `burnY` — clip it away (owner's
  exact clarification this round).** The owner pinned the residual "gold underline" to a specific
  geometry point: it is the **full-width horizontal gold line (with glow) spanning the page at `burnY`,
  the very bottom edge of the header**, produced because the build's `Beam()` polygon **closes its two
  bottom vertices *at* `burnY`** (`[LX−dn, burnY] → [RX+dn, burnY]`), so that closing edge is stroked as
  a horizontal line. The **crossbar arms higher up (at `crossY`) and the brackets returning to their
  downward angle are CORRECT and intended** (they are in the mockup) — it is **only this bottom closing
  edge at `burnY`** that must not appear. **Fix:** the beam's bottom must extend **below** `burnY` and be
  **clipped at `burnY`** (matching the mockup, where `coneBot` sits *below* `pageY` and the scene is
  clipped at `pageY`), so the closing bottom edge is clipped away off-screen. **There must be NO
  horizontal gold line/stroke spanning the page width at `burnY`**; near the boundary only the crossbar
  arms (above it) and the diagonal brackets exiting the left/right viewport edges are visible, and the
  white beam interior meets the white content with no horizontal line. → §4.5, §4.7 (decision 4).

These supersede the Iteration-2 §4.7 "fluid beam (stretch)" mechanism wherever they conflict. The
*intent* of Iteration 2 (beam at every width, tight seam, tight composition, no underline, no
Contribute, one-row auth, both auth states) is unchanged — only the **mechanism that draws the beam** is
corrected, plus the aperture is freed from center-lock and the lamp glow is restored.

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

The crossbar's bracket arms run horizontally **from the apex out to each real page edge** (each arm an
independent length — §4.7 / Iteration-3 decision 4) and **continue past `burnY`** so the burnt-to-white
region they enclose contains the "Find a topic" label + the search field — the search literally sits
**inside the projected "+"**, the way the mockup's article hint sits inside the brackets immediately
below the boundary. That enclosure is what stops the gold edge reading as an "underline" (Iteration-2
finding 2). On desktop the apex is centered, so both arms are roughly equal; at narrow widths the apex
is off-center (lockup left, §7.5), so one arm is short and the other long — the "+" is asymmetrical but
still legibly a projected "+" because the **stem and flare angle are true-scale and never stretched**
(Iteration-3 decision 3/5).

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

> **Iteration 4 (owner, 2026-06-18) — top-space trim.** The live band was later tightened to cut the
> empty space above the wordmark + auth card: `cyMid` `64 → 44` and `burnY` `150 → 130` (**both
> −20px**). This shifts the whole composition up 20px and shortens the band by 20px; the **beam
> geometry is unchanged** — the cone length (`burnY − cyMid = 86px`), crossbar offset (`crossUp`), and
> slope are all held constant, so only the top padding shrinks. The strip-canvas numbers
> (`pageY=150`, `cyMid=64`) still describe the *mockup*; the **landing-target** column below carries
> the trimmed live values.

| Strip param | Strip value | Landing Tier-A target | Rationale |
|---|---|---|---|
| header field → content boundary `pageY` | `150px` of `250` | **`burnY` = `130px`** from the top of the header band (default token `--projector-burn-y`; trimmed from `150`, Iteration 4) | Tall enough to flare; short enough that the gold edge isn't a far-off line *and* that there's little dead space above the wordmark. The search sits just below it (§4.4). |
| wordmark row center `cyMid` | `64px` | **`44px`** from header top (trimmed from `64`, Iteration 4) | Lockup sits with its block bottom at ≈`72px`; leaves the same **short** cone (length `burnY − cyMid ≈ 86px → crossY`) so the cone still reads as a recessed-lamp beam — just with less padding above it. |
| block height `bh` | `56px` | **`56px`** (unchanged) | The lockup is identity-fixed; don't scale the block with the header. "Wiki" stays `42px` Georgia 600 / "plus" stays `round(bh·0.46)≈26px`. |
| beam slope `tan` | `0.6` | **`0.6`** (default token `--projector-beam-tan`) | The variant-01 angle; **FIXED, drawn true-scale, never flattened by width** (Iteration-3 decision 5). At narrow widths the stem + angle are unchanged; only the two arm lengths shrink/grow (asymmetrically) — the true-scale beam mechanism (§4.7). |
| crossbar inset `eM` | `17px` | **`17px`** (default token) | The crossbar ends sit `17px` from each page edge, then the brackets continue off-page — the off-page gold border (§4.5). |
| beam horizontal apex (projection x) | `seam` (= `cw/2`) | **the lockup's aperture x — wherever the aperture sits** (see §4.3; centered on desktop, left at narrow widths) | The beam projects *from the lamp*, onto the search below. Apex is locked to the aperture, not to center (Iteration-3 decision 1/2). |
| full page width | `cw` | **live viewport width** (the header is full-bleed) | The gold border must run off *both real page edges*; a boxed header would make it read as an underline. **`cw` is read at TRUE 1:1 scale — the beam is NOT a fixed `viewBox` stretched to fit (Iteration-3, §4.7).** The crossbar arms reach the real edges by being drawn the real arm-length, not by scaling the shape. |

**Flare distance + the tight composition (the fix for finding 2).** Beam top `top0 = blockBottom +
6px`; with the Iteration-4 `cyMid=44` and `bh=56`, `blockBottom = 72px`, so `top0 = 78px`. The
crossbar sits `crossUp` above `burnY` (default `crossUp=28px` → `crossY = 102px`); the brackets then
widen to off-page by `burnY=130px`. **Net: ~52px of vertical flare** between the block bottom and the
burn boundary — unchanged from the pre-trim composition (every y shifted up 20px uniformly) — a
*short* cone that reads as a recessed-lamp beam (this matches the mockup, where the cone is short and
the crossbar sits only `28px` above the boundary). **The build's mistake was a ~82px corridor with the
search far below `burnY=168`** — that empty band read as a divider. The corrected composition: short
cone, crossbar near the boundary, and **the search field's top within ~`16–24px` of `burnY`** so the
"Find a topic" label + field sit *inside* the bracket arms (§4.4). Below `burnY` the beam is pure
white and *is* the hero/search surface; the clip at `burnY` is invisible because white meets white.

### 4.3 Aperture/apex position — layout-driven, NOT center-locked (Iteration-3 decisions 1 & 2)

**The apex is locked to the aperture; the aperture's x is driven by the header layout — it is NOT
hard-locked to center.** Wherever the lit "+" cutout lands in the header row, the beam originates there.
This replaces the Iteration-2 rule that pinned the apex to the content-column center at every width.

- **Where the aperture sits, per breakpoint (the layout drives it — §7.5):**
  - **Desktop (`≥ md`): centered.** The lockup is centered in the header row (auth pinned in the
    top-right corner, one row), so the aperture sits at the **content-column center** and the apex is
    centered. Both crossbar arms are then roughly equal length. The metaphor ("the plus projects onto
    the front door") lands literally because the search column is centered too.
  - **Narrow (`< md`): left-anchored.** The lockup sits at the **left** of the one header row and the
    single auth control sits at the right (one row — §7.5). The aperture is therefore **left of center**,
    and the apex follows it. The crossbar's **left arm is short** (apex→left edge) and the **right arm is
    long** (apex→right edge) — the asymmetry of Iteration-3 decision 4. This is correct, not an
    off-center accident.
- **What stays true at every aperture position:** the gold border still runs off **both real page
  edges** at `burnY` (`fullBleed=true` always on the landing page), so the off-page signal is intact
  whether the apex is centered or left. The stem under the lamp and the flare angle are **true-scale and
  identical** at every position; only the two arm lengths differ (§4.7).
- **Concretely:** `projectionX` (the beam apex x, a geometry prop — §5.2) **= the live aperture x** for
  the current layout. It is no longer a static "content-column center" constant; it is resolved from the
  lockup's actual placement (centered vs. left) — see §4.3-seam for the SSR-safe way to land the apex on
  the aperture without DOM measurement at first paint. The apex and the aperture are the same point by
  construction.
- **Forward note:** on a future two-column Topic page the same prop is driven by the real wiki/plus
  column divider (a column-ratio, §5.2 / VISUAL_IDENTITY §6.0). On the landing page it is driven by the
  lockup's per-breakpoint anchoring (centered/left). Both are *the same prop, different driver* — which
  is the point of AC10.

<a id="seam"></a>**The tight seam — DECISION (Iteration-2 finding 1, the root-cause fix).** In `buildScene()` the
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
  no constant is load-bearing for the gap; the aperture's x = (lockup left x) + "Wiki" intrinsic width +
  block border + cut inset, resolved by layout, not a magic 110. Or (b) if a concrete apex x is needed
  for the SSR'd SVG path, offset the lockup from its anchor (centered on desktop / left at narrow
  widths) by the **measured-once** "Wiki"-advance + block-margin + cut-inset exposed as a CSS custom
  property, with a tight Georgia-600-42px "Wiki" estimate (~`95px`, the real glyph advance — **not** an
  inflated 110) as the no-JS fallback. Approach (a) is preferred: it removes the magic constant entirely
  and cannot reintroduce a gap. The seam being tight is the hard requirement; how the apex is computed
  is the implementation detail.
- **The apex must reach the aperture x wherever the lockup is anchored (Iteration-3 decision 1/2).**
  Because the aperture moves between centered (desktop) and left (narrow), the value handed to the beam
  (`projectionX` / the SVG's apex-x) must be the **live aperture x in the current layout**, not a static
  half-width. With approach (a) the same flow that places the aperture also yields its x; expose that x
  to the beam (e.g. a CSS custom property `--projector-apex-x` updated per layout, or read once after
  layout) and the beam's two arm endpoints are computed from it (left arm: apex→`edgeInset`; right arm:
  apex→`cw−edgeInset`). The apex-on-aperture alignment is the requirement; the technique is Dev's call,
  but it must hold at **both** the centered desktop and the left-anchored narrow layouts within ~`2px`.

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

**The "gold border off both edges" is NOT a full-width horizontal line — the exact defect to avoid
(owner, Iteration-3 underline clarification).** The visible gold at the boundary is *only* the two
**diagonal brackets** turning down-and-off the **left and right viewport edges** (the off-page `dn`
expansion of the arms), plus the **crossbar arms** that sit *above* `burnY`. There must be **NO
horizontal gold line or stroke spanning the page width at `burnY`** (the very bottom edge of the
header). The mechanism that guarantees this is in §4.7: **the beam polygon's bottom must extend
*below* `burnY` and be *clipped at* `burnY`, so the polygon's closing bottom edge is clipped away
off-screen — it is never drawn as a stroke at the boundary.** At/near the boundary the gold therefore
**exits at the two sides** (the brackets running off the edges); it does **not** cross the page
horizontally. The white beam interior meets the white content **seamlessly, with no horizontal line.**
(Confirm against `mockups/wordmark-projector-illuminate.html?solo=01`: there is no full-width
horizontal gold line at the content boundary — the gold leaves the frame at the sides.)

### 4.6 The lit aperture — a GLOWING lamp, not a flat cutout (Iteration-3: restore the glow)

The lit "+" aperture must read as a **white-hot lamp glowing through the block, with bloom spilling
onto the indigo** — matching the mockup's `?solo=01` (`mockup-reference-solo01.png`). The Iteration-2
build lost this: its aperture reads as a **flat white cutout** with no luminosity, which is part of why
the gold edge reads flat (the eye gets no "this is a light source" cue at the apex). **Restore the glow
to the mockup's luminosity.** Render per VISUAL_IDENTITY §5.3–§5.5 and the mockup's `buildScene()`
*exactly* — these four layers together make the lamp, and **none may be dropped or weakened:**

1. **White-hot radial core** — a `44×44` radial-gradient core behind the cut: `#ffffff` from 0% to 74%,
   warming only at the very rim (`mix(GOLD_FILL, 0.5)` at 93%, `mix(GOLD_FILL, 0.22)` at 100%). The
   interior reads as **blown-out white**, brightest at center — an over-exposed lamp, not a paper cutout.
2. **Gold rim** — an SVG stroke on the "+" path, clipped to the interior and blurred (`stdDeviation
   0.85`): gold brightest right at the edge, clipping to white inward. **Not** a circular glow.
3. **The "+"-outline screen-blend bleed (the spill — this is the layer the build under-rendered).** Two
   blurred "+" shapes drawn **over** the block, `mix-blend-mode: screen`, `blur ~4px`, positioned on the
   aperture center: a wider gold "+" (`#EECE87` @ `~.46`) and a tighter warm-white "+" (`#FFFCF6` @
   `~.92`). Over the white cut interior `screen` is a near-no-op; the bleed shows **where it spills onto
   the indigo block**, tracing the "+" outline. **This spill onto the indigo is the visible "glowing
   lamp" read and must be present and strong enough to see at desktop scale** — the mockup's `o.glow =
   0.92`, `o.glowBlur = 4` are the target intensities; do not dim them. If the live render shows a hard
   white "+" with no warm halation onto the surrounding indigo, the bleed is too weak — strengthen it
   toward the mockup before considering this section met.
4. **"pedia" ghost behind the cut** — Georgia 600 42px `#000` @ `~.24` opacity, `blur 1.45px`, anchored
   at the seam behind the block (covered by the block from the seam rightward, glimpsed only through the
   aperture, never floating in a gap — §4.3-seam). The blown-out core washes over it so it reads as the
   faintest dark ghost inside the lit "+".

The lockup as a unit may be **centered (desktop) or left-anchored (narrow)** (§4.3) — but in *either*
placement the block covers the ghost from the seam rightward, so "pedia" lives entirely behind the block
and **never clips** at the viewport edge regardless of width. The lit aperture (core + rim + spill +
ghost) therefore **renders at every width** — no longer dropped on narrow (§4.7 / §7).

> **Acceptance cue for the lamp (UX will check this in re-eval).** Side-by-side with
> `mockup-reference-solo01.png`, the lit "+" must show a **glowing white core with a visible warm bloom
> bleeding onto the indigo around it** — not a crisp flat white "+". This is the explicit gate this
> iteration adds for the lamp, paired with the beam gate (OQ-1).

### 4.7 The beam — true-scale stem + fixed angle + asymmetrical arms to each real edge (Iteration-3, the root-cause fix)

> **RETRACTED — the Iteration-2 stretch mechanism.** Iteration-2 §4.7 said the beam was *one full-width
> SVG with `preserveAspectRatio="none"` and a fixed `viewBox` (`VBW=1000`) mapped to 100%, so only `cw`
> varies.* That **uniformly stretches the entire beam shape horizontally** (~2.5× at desktop): the narrow
> stem balloons into a wide blob and the angled arms flatten toward horizontal — producing a flat
> full-width gold line with a small bump = the "underline." **Do not draw the beam this way. The
> `preserveAspectRatio="none"` whole-shape stretch is removed.** What follows replaces it.

**The beam is present at all viewport widths** on the landing page (this part of the Iteration-2 owner
override stands — it still overrides VISUAL_IDENTITY §6.2's `md` Tier-B beam-drop and §6.3's
stubby-beam/full-bleed guidance, **for the landing page only**; the Topic-page tiers are unchanged). What
changes is *how* it adapts to width: **not by stretching, but by drawing each crossbar arm its real
length.** The beam is three conceptually separate things composed at the apex:

1. **The central stem + angled flare — drawn at TRUE 1:1 pixel scale, NEVER horizontally stretched
   (decision 3/5).** Under the lit "+" the beam is a **narrow stem whose width = the "+" cutout width**,
   flaring outward at the **fixed angle `beamSlope = tan = 0.6`** up to the crossbar. This is the
   mockup's `buildScene()` geometry rendered at its real scale: the cone half-width at any height `y` is
   `(y − apexY) · 0.6`, so at the crossbar (`crossUp = 28px` above `burnY`) the half-width is `≈ 17px` —
   a genuinely narrow stem, **the same px width at 320px and at 1920px.** Because the stem is true-scale,
   the flare angle reads as the mockup's ~31° off-vertical at every width — it never flattens.
2. **The two crossbar arms — horizontal, ASYMMETRICAL, each reaching ITS OWN real page edge (decision
   4).** From where the flare meets the crossbar, a horizontal segment runs **left** to `edgeInset` (17px)
   from the **left** page edge, and another runs **right** to `edgeInset` from the **right** page edge.
   **Left-arm length and right-arm length are independent**, computed from the apex x:
   - left arm length `≈ apexX − edgeInset`
   - right arm length `≈ (cw − edgeInset) − apexX`
   When the apex is centered (desktop) the two are roughly equal; when the apex is left-of-center
   (narrow, §4.3) the **left arm is short and the right arm is long.** Past `edgeInset` the brackets
   return to the beam angle and **expand down off-page past `burnY`** (the `dn` downward expansion),
   enclosing the content region. **Arm length is the ONLY horizontal parameter that varies with layout
   or width** — everything else (stem width, angle, vertical proportions) is fixed.
3. **The vertical proportions are FIXED:** `burnY = 130px` (Iteration 4; was 150), `crossUp = 28px`, the cone height, the `dn`
   bracket drop. They do not change with width. So the beam is never a stubby horizontal sliver and never
   a flattened line — it is always a legible projected "+": **narrow true-scale stem under the lamp →
   crossbar → arms to both real edges → brackets off-page enclosing the search.**
4. **The beam's bottom extends BELOW `burnY` and is CLIPPED AT `burnY` — so its closing bottom edge is
   never drawn at the boundary (owner, Iteration-3 underline clarification — the precise root-cause
   fix).** The defect in the current build: the beam polygon **closes its two bottom vertices sitting
   *at* `burnY`** (the closing edge runs `[LX−dn, burnY] → [RX+dn, burnY]`), so that bottom edge is
   stroked as a **full-width horizontal gold line with glow, spanning the page at the very bottom of the
   header** = the "underline." **Fix (this is how the mockup avoids it):** the beam geometry must extend
   **below** the burn/clip boundary (in the mockup's `buildScene()`, `coneBot` is *below* `pageY`) and
   then be **clipped at `burnY`** (the mockup clips at `pageY`). Because the polygon's bottom closing
   edge lies *below* the clip line, **it is clipped away off-screen and is NEVER rendered as a stroke at
   `burnY`.** What remains at/near the boundary is **only** the two **diagonal brackets running off the
   left/right viewport edges** (the `dn` off-page turn-downs) — plus the **crossbar arms above the
   boundary**. The white beam interior meets the white content **seamlessly: NO horizontal gold
   line/stroke spanning the page width at `burnY`.** This is non-negotiable and is the single most
   important geometry point of this iteration.

**SSR-safe way to reach the real edges without stretching the stem (the requirement; technique is Dev's
call).** The hard requirement: **the stem and flare are drawn at true pixel scale and the angle is never
distorted, while the two horizontal arms still reach the actual viewport edges.** Because horizontal arms
are *horizontal* — they carry no angle to distort — a horizontally-scaled element can draw them safely; it
is **only the angled stem/flare that must not be stretched.** Two SSR-safe shapes that satisfy this (Dev
picks; both avoid DOM measurement at first paint):

- **(a) Split the beam into a true-scale center piece + plain horizontal arm bars.** Draw the central
  stem + the two short angled flares + the small fixed-width crossbar caps as **one small SVG sized in
  real px at the apex** (no `preserveAspectRatio` override — `viewBox` width = the element's real px
  width, 1:1). Then draw the **two horizontal arms** as separate full-bleed elements (e.g. two `2px`-tall
  gold rules, or a horizontally-scalable SVG that contains *only horizontal* geometry) running from the
  crossbar caps out to each page edge — the left one `width: apexX − edgeInset`, the right one `width: cw
  − edgeInset − apexX`, plus the off-page bracket turn-downs. The arms may scale horizontally freely
  because they're horizontal; the **stem never does.** This is the cleanest expression of "stem true-scale,
  arms variable-length."
- **(b) One full-width SVG, but with `preserveAspectRatio` NOT `"none"` and a viewBox whose width = the
  live `cw` in real px (1:1).** Use `width: 100%; height: burnY; viewBox="0 0 {cw} {burnY}"` with
  **no** non-uniform scaling — the path coordinates are real pixels, so the apex sits at the real `apexX`,
  the stem is `± (y−apexY)·0.6` wide in real px, and the arm endpoints are `edgeInset` and `cw − edgeInset`
  in real px. Since `viewBox` width already equals the rendered width, there is **no horizontal scale
  factor at all** — nothing stretches. (This is exactly what the *mockup's* `buildScene()` does: its SVG
  `viewBox="0 0 {cw} {svgH}"` uses the real canvas width with no `preserveAspectRatio` override, so it
  renders 1:1.) The cost is the SVG must know `cw` (a resize listener / CSS-var width), which is the
  trade-off vs. (a). Either way: **`cw` enters as a real-px length, never as a stretch ratio.**

The non-negotiable contract for Dev, regardless of technique: **the central stem width = the "+" cutout
width and the flare angle = `0.6`, both at true 1:1 scale at every viewport width; the two horizontal arms
are asymmetrical and each reaches `edgeInset` from its own real page edge; arm length is the only thing
that varies; AND the beam's bottom extends *below* `burnY` and is *clipped at* `burnY`, so its closing
bottom edge is clipped away and NO horizontal gold line/stroke spans the page width at `burnY` (§4.5,
decision 4 above).** If a render shows the stem widened or the angle flattened as the viewport changes,
the stretch bug is back — reject it. If a render shows **any full-width horizontal gold line at the
bottom edge of the header** (at `burnY`), the closing-edge "underline" bug is back (the polygon was
closed *at* `burnY` instead of below it and clipped) — reject it. At/near the boundary the gold must
exit only at the **two sides** (brackets off the left/right edges), never across the page.

**Coherence at narrow widths.** The **lockup stays tight** (§4.3-seam — block butts "Wiki", no gap) and
fully visible; the **lit aperture (glowing lamp + bleed) renders at every width** (§4.6); the **"pedia"
ghost stays behind the block** (never clips). The apex sits on the (now left-of-center) aperture, so the
left arm is short and the right arm long — still a legible "+". If "Wiki" + the block + the auth control
can't all fit one row at the smallest phones (~`< 360px`), the **lockup may scale down as a unit** (font +
block proportionally, transform-origin at the aperture so the apex stays put) **before** the auth is
allowed to wrap (§7.5) — but the **beam stays a true-scale beam** (stem width and angle scale *with the
lockup*, not with the viewport). **No tier-drop, no top strip, no second row, at any width.**

> **Recorded override.** This §4.7 + the §7 tier table replace the landing page's previous tier-drop
> behavior. VISUAL_IDENTITY §6.2/§6.3 remain authoritative for the **Topic-page** header (shorter
> sticky header, real two-column divider) — there the beam may still drop to Tier B/C. The two are
> reconciled by scope: *landing = beam-at-every-width (true-scale, asymmetrical arms); Topic =
> tier-aware.* Same component, different driven config (AC10).

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
| `"projector"` | **A** | Full treatment: lockup + lit GLOWING aperture (§4.6) + descending true-scale beam (narrow stem + fixed angle + asymmetrical arms to each real edge — §4.7) to the burn boundary + gold border off-page + "+"-bleed + "pedia" ghost. **The landing page uses this at EVERY width** (apex tracks the aperture; arm length adapts — §4.7). |
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
| `beamSlope` | `--projector-beam-tan` | `0.6` | Beam **flare angle** (the angled stem edges) — **FIXED at every width** (Iteration-3 decision 5; "maybe" varies later). Steeper/shallower flare if ever changed. Never distorted by width. |
| `beamCrossUp` | `--projector-cross-up` | `28px` | How far above `burnY` the crossbar sits (flare timing). Fixed. |
| `beamEdgeInset` | `--projector-edge-inset` | `17px` | Each crossbar arm's end inset from **its own** real page edge before the bracket goes off-page. Fixed. |
| `burnY` | `--projector-burn-y` | **`130px`** (was 168 → 150 in Iteration-2 to match the mockup's `pageY`; → 130 in Iteration 4 with `cyMid` 64→44 to trim the top space — beam unchanged) | The content boundary — where the beam burns to white. On the landing page the search sits just below it (§4.2/§4.4). Fixed. |
| `projectionX` | `--projector-projection-x` | **the live aperture x** (centered on desktop / left-anchored at narrow widths — §4.3) | The beam apex x = **the aperture x** (decision 1/2). The apex is locked to the aperture, not to viewport center; this is the value the layout drives. The two arm lengths are derived from it (`apexX − edgeInset` left, `cw − edgeInset − apexX` right). |
| `seamRatio` | `--projector-seam-ratio` | `0.5` (centered) | **The wiki/plus seam position driven by a column-ratio** — 0.5 = equal; >0.5 = Plus column wider, seam shifts left, etc. Reserved hook the future two-column header drives from its real column widths. (On the landing page the lockup's *anchor* — centered/left — is what places the aperture, not `seamRatio`.) |
| `fullBleed` | `--projector-full-bleed` | `true` | Whether the gold border runs off real page edges. On the landing page this is **always `true` at every width** (the header is full-bleed; both arms reach their real edges — §4.7), so it never drops the off-page edge. (The Topic page may set `false` ⇒ Tier B per VISUAL_IDENTITY §6.3.) |

**Note (Iteration 3, replaces the Iteration-2 note):** the beam adapts to width by **drawing each
crossbar arm its real length** (`apexX − edgeInset` and `cw − edgeInset − apexX`), **NOT** by stretching
a fixed `viewBox` to fit. The central stem width and `beamSlope` angle are drawn at **true 1:1 pixel
scale** and never change with width. So the inputs that vary with layout/width are the **apex x
(`projectionX` = aperture x)** and the **two derived arm lengths** — every other geometry value is fixed.
The retracted Iteration-2 `preserveAspectRatio="none"` whole-shape stretch is the bug; see §4.7.

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

Web-first, responsive. **Owner decision (Iteration-2 finding 3, refined by Iteration-3):** the landing
page renders **`variant="projector"` (Tier A) at every viewport width** — it does **not** drop the beam
to Tier B/C as the viewport narrows (this overrides VISUAL_IDENTITY §6.2/§6.3 for the landing page only).
The beam adapts by **drawing each crossbar arm its real length** (asymmetrical; the apex tracks the
aperture) — **NOT** by stretching a fixed `viewBox` (the retracted Iteration-2 mechanism, §4.7). The
principle is **"keep the projection, draw it true-scale, vary only the arm lengths"** — the constant
vertical proportions + true-scale stem + per-edge arm lengths are what keep it a legible projection at
every width rather than a flattened underline.

**The header is ONE row at every width (Iteration-3, replaces the top-strip).** The lockup and the single
`AuthControl` share one header row at every width — lockup centered with auth in the corner on desktop;
lockup left, auth right at narrow widths (§7.5). The beam apex follows the aperture wherever the lockup is
anchored, so narrow widths produce asymmetrical arms (short left, long right). **No top strip, no folded
second row, at any width.**

| Breakpoint | Header / projector | Search | Topic list |
|---|---|---|---|
| **`≥ md` (desktop/tablet, ~≥768px)** | **Tier A `"projector"`, ONE row** — lockup **centered** in the content column, auth pinned top-right (§7.5). True-scale narrow stem + fixed `0.6` angle + GLOWING lamp (§4.6) + asymmetrical arms each to its real edge (roughly equal here, since the apex is centered) + gold border off both edges + tight seam + "pedia" (behind the block). Beam to `burnY=150px`. | Full-width within the content column (max ~`640px`), `h-11`/`text-base`, visible "Find a topic" label, **sitting inside the projected light** (top within ~16–24px of `burnY`, §4.4). | 2-col grid (`sm:grid-cols-2`). |
| **`< md` (mobile), one row** | **Tier A `"projector"`, ONE row** — lockup **left-anchored**, auth on the **right** (§7.5). The apex follows the now off-center aperture: **short left arm, long right arm** (§4.7 decision 4). True-scale stem + `0.6` angle + glowing lamp + gold edge to both real edges + tight seam + "pedia" **all still render** (§4.6/§4.7). If "Wiki" + block + auth can't fit one row (~`< 360px`), the **lockup scales down as a unit** (transform-origin at the aperture) **before** the auth wraps — the beam scales *with the lockup*, staying true-scale. **No top strip, no second row.** | **Full-width, never collapsed to an icon** (AC1 — the landing search must stay prominent; the `topic-disclosure` icon variant is for the *Topic* header, never the landing page). Still inside the beam. | Single column (grid reflows to 1-col). |

**What stays constant at every width (the invariants — AC8 verify against these):**

- **The beam is always a legible projected "+":** narrow **true-scale** stem under the lamp (never
  widened) → fixed-`0.6` flare (never flattened) → crossbar arms each reaching its real page edge
  (asymmetrical when the apex is off-center) → brackets off-page → search inside. **Never a flat
  full-width line, never a stretched blob, never a sliver, never dropped (§4.7).**
- **The apex sits on the aperture** wherever the lockup is anchored (centered desktop / left narrow) —
  decision 1/2. The aperture is never hard-locked to viewport center.
- **The header is ONE row** — lockup + single auth, never a top strip, never a folded second row (§7.5).
- **The lit aperture GLOWS** — white-hot core + warm bleed spilling onto the indigo (§4.6), at every
  width; not a flat cutout.
- **The seam is always tight** — the block butts "Wiki" with no gap, the ghost glimpsed only through
  the aperture (§4.3-seam). This is the most-regressed property from the build; check it at all widths.
- **The gold off-page edge always runs to both real page edges** (`fullBleed=true` always on the
  landing page — the header is full-bleed at every width).
- **"pedia" never clips** because it lives behind the block (§4.6).
- **The search hero never degrades** below "full-width, labeled, prominent, inside the projected
  light." This protects AC1 across all sizes.

There is **no tier-drop on the landing page.** (The Tier B/C variants and the VISUAL_IDENTITY §6.2/§6.3
drop logic remain in force for the future *Topic-page* header, which is out of scope this round — §10.)

### 7.5 Header chrome — ONE row at every width, no "Contribute", both auth states (findings 4, 5, 6 + Iteration-3 one-row)

The header band contains exactly two things: the **`HeaderProjector` lockup** and a **single
`AuthControl variant="home"`**. Nothing else. **They share ONE header row at every width** (Iteration-3,
replacing the Iteration-2 narrow "top strip"). The lockup's horizontal anchor is what places the
aperture, and the beam apex tracks it (§4.3):

**No "Contribute" label (finding 4).** The "Contribute" link is **removed entirely** from the landing
header — not relocated, not hidden behind a menu, gone. (A curator's contribute path is on the Topic
page, per the v1 personas §1.3; the landing header's one job is "find a topic" + sign-in.) Dev: delete
the Contribute link from `app/page.tsx`'s header; do not leave a placeholder slot.

**One row, never a second row (finding 5 + Iteration-3).** The single `AuthControl variant="home"` sits
on the **same row** as the lockup at every width — **never** a second row beneath it, and **never** a
narrow "top strip" with the lockup dropped below (the Iteration-2 approach is retracted):

- **Desktop/tablet (`≥ md`): lockup centered, auth top-right, one row.** The lockup is centered in the
  content column; the `AuthControl` is pinned to the **right edge** of the full-bleed header, vertically
  aligned with the lockup row. Use a layout that keeps the lockup centered *and* the auth right-anchored
  without the auth pushing the lockup off-center (e.g. an absolutely/grid-anchored right slot over a
  centered lockup, so the lockup's centering is independent of the auth width). **The aperture is at the
  content-column center → the beam apex is centered → arms roughly equal** (§4.3).
- **Narrow (`< md`): lockup LEFT, auth RIGHT, one row.** The lockup is **left-anchored** and the auth
  control sits at the **right** of the same row — a normal app top-bar (lockup left, sign-in right). The
  lockup is **not** dropped below the auth; there is **no top strip and no second row.** Consequently the
  **aperture is left-of-center → the beam apex is left-of-center → the left crossbar arm is short and the
  right arm is long** (the asymmetrical-arm model, §4.7 decision 4). If "Wiki" + block + auth can't all
  fit one row at the smallest phones (~`< 360px`), the **lockup scales down as a unit** (font + block
  proportionally, transform-origin at the aperture so the apex stays put) **before** the auth is allowed
  to wrap. `variant="home"` is not `compact`; if the full "Log in with Wikipedia" label is too wide for
  the smallest phones, it may wrap *within the button*, but the **button stays on the lockup's row** —
  it never becomes a second header row.
- The header band height is driven by the projector (`burnY=150px`, §4.2); the auth control sits within
  that band on the lockup row, never adding a row that increases the band height.

**Both auth states must render gracefully (finding 6).** `AuthControl variant="home"` already encodes
both; the landing header must render each cleanly in the placement above:

| Auth state | `AuthControl` renders | Landing-header requirement |
|---|---|---|
| **Loading** (`status==="loading"`) | A neutral pulse chip (`h-[34px] w-20`, `bg-ink/10`) — **never** a flash of the signed-out button. | The chip occupies the same right-anchored slot; no layout shift when it resolves. |
| **Logged-out** | The **"Log in with Wikipedia"** button — `bg-brand text-white`, `border-2 border-ink`, the `WikiGlyph` + word label (AA 4.70, the word carries the label, not color). | Top-right slot, single row. This is the state in the current screenshots. |
| **Logged-in** | `SignedIn` — avatar/initial + the user's **username** + a Radix disclosure menu (profile link → `/contributor/<username>`, Sign out). | Right of the one header row, at every width. The username text must not force the auth control to wrap to a second row — on the narrowest widths the `SignedIn` component already hides the username behind the avatar (`compact` behavior); on the landing `variant="home"` it shows the username, so ensure the right slot has room or the **lockup scales** (§7.5 narrow) rather than the auth wrapping or the lockup dropping to a second row. |

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
   (AC7, all four states preserved). **Header chrome = the lockup + a single `AuthControl variant="home"`,
   sharing ONE row at every width — REMOVE the "Contribute" link entirely (finding 4); on desktop the
   lockup is centered with auth top-right, at narrow widths the lockup is LEFT and auth is RIGHT (one row,
   no top strip, no second row — finding 5 + Iteration-3); render both auth states (finding 6) — §7.5.**
   The search path is **reused unforked** (AC2) — single `TopicSearch` import, no new search component.
4. **The beam — true-scale stem + fixed `0.6` angle + asymmetrical arms (Iteration-3, §4.7).** Draw the
   central stem at the "+" cutout width and the flare at the fixed `0.6` angle at **TRUE 1:1 pixel
   scale — never `preserveAspectRatio="none"` stretched** (the retracted Iteration-2 mechanism that
   caused the underline). The apex is locked to the **aperture** (centered desktop / left narrow — §4.3);
   the two crossbar arms are **asymmetrical**, each drawn its real length to its own page edge (`apexX −
   edgeInset` left, `cw − edgeInset − apexX` right). **Arm length is the only horizontal thing that
   varies.** Restore the **glowing lamp** at the aperture (white-hot core + warm bleed onto the indigo,
   §4.6) — not a flat cutout.
5. **Responsive** per §7 — **`variant="projector"` (Tier A) at EVERY width** with the true-scale beam
   (§4.7), the apex tracking the aperture, asymmetrical arms; the seam stays tight, the beam never drops,
   the search stays inside the projected light; one header row at every width; search full-width/never
   collapsed at every width; list reflows 2-col → 1-col. **No tier-drop, no top strip, on the landing
   page** (finding 3 + Iteration-3).
6. **Tests** for: search-to-route (existing seeded title, created-on-demand title, unknown-title Enter
   — these largely assert #12 behavior is unchanged from the landing host); the wordmark accessible
   name (`"wiki+"`) + decorative-layer `aria-hidden` model; the topic-list read-error floor still
   renders. (AC11/AC12.)
7. **Do NOT** touch `components/topic/TopicHeader.tsx` or the article body (VISUAL_IDENTITY §9.3 / spec
   Out of scope). **Do NOT** add the v2 video-entry UI (separate spec, design-only this round).

## 12. Open design questions flagged for Dev

- **OQ-1 — beam fidelity + lamp glow, verified side-by-side against the mockup (Iteration-3, the
  explicit gate).** Render `mockups/wordmark-projector-illuminate.html?solo=01` and put the live header
  **next to it** at desktop. The desktop result MUST match the mockup's beam: a **narrow true-scale stem**
  under the lamp, a **clearly-angled `0.6` flare** (not flattened), crossbar arms to both edges, and a
  **glowing white-hot lamp with warm bloom onto the indigo** (§4.6) — **not** a flat full-width gold line
  with a tiny bump (the Iteration-2 underline bug) and **not** a flat white cutout. If the stem looks
  widened or the angle looks flattened as the viewport changes, the `preserveAspectRatio="none"` stretch
  is back (§4.7) — reject. `burnY=150px` / `cyMid=64px` match the mockup's strip (§4.2); keep the
  composition **tight** (short stem, crossbar near `burnY`, search top within ~`16–24px` of `burnY`,
  §4.4). The side-by-side check (beam shape + lamp glow) is the gate.
- **OQ-2 — perf of the live mark (spec A3).** If the CSS `filter`/`mix-blend-mode` + SVG causes jank,
  ship Tier A as a **pre-rendered static SVG/PNG asset** (the mark is static) — Dev's call at build,
  not a blocker. **Caveat (Iteration 3):** the beam can NOT be a single fixed-width raster — its arm
  lengths are asymmetrical and width-driven (§4.7), so a fixed-width PNG would reintroduce the
  underline/boxed problem at off-design widths. If pre-rendering, render the **lockup + glowing lamp**
  statically but keep the **beam as the true-scale SVG** (real-px coordinates, apex on the aperture, arms
  drawn to the real edges — never a stretched fixed `viewBox`). The accessible-name/`aria-hidden` model
  still applies.
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
