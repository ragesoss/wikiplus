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

The landing page is a **single centered column** (no wiki/plus divider — owner decision 4, so
VISUAL_IDENTITY §6.0 seam-to-column alignment is **N/A**). Top to bottom:

```
┌─────────────────────────────────────────────────────────────────────┐  ← --header-field #fafbfe
│  [ wiki + ]  …………………………………… auth chrome (Contribute · sign-in) right │      (cool fluorescent)
│   ▲ HeaderProjector, Tier A: lit "+" aperture + "pedia" ghost          │
│                                                                        │
│            ╲  the geometric "+" beam descends + flares  ╱              │
│   ═══════════════ GOLD BORDER (off both page edges) ═══════════════    │  ← content boundary (burn
│            ╲   burns to white onto the hero below      ╱               │      to white) --content-white
│                                                                        │  ← #ffffff (warm daylight)
│                    Find a topic                                        │
│            ┌───────────────────────────────────────────┐  ◄ HERO      │
│            │  Search any Wikipedia topic…           [🔍] │   the focus  │
│            └───────────────────────────────────────────┘   (AC1)      │
│            wiki+ is a curation & contextualization layer over          │  ← concise explanation
│            Wikipedia… (1–2 sentences, sourced from VISION)             │      (AC6, §3)
│                                                                        │
│  ───────────────────────────────────────────────────────────────     │
│  Explore example topics                                  ◄ SECONDARY   │  ← demoted list heading (§6)
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ topic    │ │ topic    │ │ topic    │ │ topic    │   (the old grid,  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    reframed)      │
└─────────────────────────────────────────────────────────────────────┘
```

**Hierarchy (what makes search the focus — AC1):**

1. **The projector header** is the brand statement and the literal light *pointing down at the
   search*. It is visually loud but is **chrome**, not an action — its beam *aims the eye at the
   search field*. The beam burning to white into the hero is the device that makes the search feel
   "lit / projected onto" (§4).
2. **The search is the single dominant interactive element** — full-width within the centered column
   (target measure ~`640px` max, see §7), `h-11`/`text-base` (the `variant="home"` sizing already in
   `TopicSearch`), with its visible **"Find a topic"** label. Nothing else on the first viewport
   competes with it for "the thing to click."
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
height. The mapping rule: **the strip's proportions are preserved against the live header height; the
width is the live viewport width.**

| Strip param | Strip value | Landing Tier-A target | Rationale |
|---|---|---|---|
| header field → content boundary `pageY` | `150px` of `250` | **`burnY` ≈ `168px`** from the top of the header band (default token `--projector-burn-y`) | Tall enough that the beam flares before the boundary (§4.4); see §7 for the responsive shrink. |
| wordmark row center `cyMid` | `64px` | **`~52px`** from header top | Lockup sits in the upper ~third; leaves `~116px` of flare room below the block bottom before `burnY`. |
| block height `bh` | `56px` | **`56px`** (unchanged) | The lockup is identity-fixed; don't scale the block with the header. "Wiki" stays `42px` Georgia 600 / "plus" stays `round(bh·0.46)≈26px`. |
| beam slope `tan` | `0.6` | **`0.6`** (default token `--projector-beam-tan`) | The variant-01 angle; keep it. |
| crossbar inset `eM` | `17px` | **`17px`** (default token) | The crossbar ends sit `17px` from each page edge, then the brackets continue off-page — the off-page gold border (§4.5). |
| beam horizontal apex (projection x) | `seam` (= `cw/2`) | **the lockup's aperture center** (see §4.3) | The beam projects *from the lamp*, onto the search below. |
| full page width | `cw` | **live viewport width** (the header is full-bleed) | The gold border must run off *both real page edges* (VISUAL_IDENTITY §6.3); a boxed header would make it read as an underline. |

**Flare distance (how far the beam flares before it becomes the hero).** Beam top `top0 = blockBottom
+ 6px`; with `cyMid≈52` and `bh=56`, `blockBottom ≈ 80px`, so `top0 ≈ 86px`. The crossbar sits
`crossUp` above `burnY` (default `crossUp=28px` → `crossY ≈ 140px`); the brackets then widen to
off-page by `burnY≈168px`. **Net: ~82px of vertical flare** between the block bottom and the burn
boundary — comfortably above the "~70–90px or drop to Tier B" floor (VISUAL_IDENTITY §6.3). Below
`burnY` the beam is pure white and *is* the hero/search surface; the clip at `burnY` is invisible
because white meets white.

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

### 4.4 The two-temperature surface in the hero

- `--header-field #fafbfe` fills the header band from its top down to `burnY`.
- `--content-white #ffffff` fills from `burnY` down — and this is the hero's own background. The hero
  (search + explanation) sits on `--content-white`, so when the beam burns to white it is
  indistinguishable from the surface the search sits on. **No cool/white seam line** appears where
  the beam lands; the search field reads as sitting *in the projected light*.
- The page `<body>` background (`#F7F7F7`) is **below** the hero; the hero block itself must paint
  `--content-white` so the burn-to-white has white to resolve into. Dev: give the hero container an
  explicit `#ffffff` background spanning at least from `burnY` through the explanation.

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
`#000` @ `~.24` opacity, `blur 1.45px`, behind the cut. On the landing page the lockup has horizontal
room (it sits in the wide header band), so the "pedia" ghost renders at Tier A — but see §7: when the
viewport narrows so "pedia" would clip at the edge, drop to Tier B.

---

## 5. The `HeaderProjector` component API (conceptual — AC9 / AC10)

A single new reusable component (bespoke Tailwind + inline SVG; **no shadcn**, no new font — reuse the
article Georgia stack for the serif and the Source Sans Pro stack for "plus"). It is **tier-aware**
and **parameterized**. The landing page consumes only Tier A this round; the other tiers + the
geometry props are defined now so the future shared-header rollout is a configuration change, not a
second build (spec §Forward-looking).

### 5.1 The `variant` prop — the four tiers (AC9)

```
variant: "projector" | "lockup-lit" | "lockup-flat" | "glyph"
//          Tier A         Tier B          Tier C         Tier D
```

| `variant` | Tier | Renders (per VISUAL_IDENTITY §6.2) |
|---|---|---|
| `"projector"` | **A** | Full treatment: lockup + lit aperture + descending beam to the burn boundary + gold border off-page + "+"-bleed + "pedia" ghost. **The landing page uses this.** |
| `"lockup-lit"` | **B** | Lockup + lit aperture (core + gold rim + tight bleed), **no beam** (nowhere to flare). |
| `"lockup-flat"` | **C** | Plain lockup: serif "Wiki" + a flat indigo "+" block (a drawn "+" glyph is acceptable — no lamp). No beam, glow, or "pedia". |
| `"glyph"` | **D** | A single indigo "+" zine tile (the block alone) for favicon/app-icon/very-small UI. |

Default `variant` = `"lockup-flat"` (the safest, smallest treatment) so a careless call site degrades
gracefully rather than to the most expensive render. The landing page passes `variant="projector"`
explicitly.

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
| `burnY` | `--projector-burn-y` | `168px` | The content boundary — where the beam burns to white. Shorter headers ⇒ smaller ⇒ Tier-B threshold (§7). |
| `projectionX` | `--projector-projection-x` | content-column center (§4.3) | The beam apex x — **the projection's horizontal position** (page-center vs. offset; future: onto a column). |
| `seamRatio` | `--projector-seam-ratio` | `0.5` (centered) | **The wiki/plus seam position driven by a column-ratio** — 0.5 = equal; >0.5 = Plus column wider, seam shifts left, etc. On the landing page the lockup is centered as a unit; `seamRatio` is the hook the future two-column header drives from its real column widths. |
| `fullBleed` | `--projector-full-bleed` | `true` | Whether the gold border runs off real page edges (Tier A requires `true`; a boxed header ⇒ Tier B — VISUAL_IDENTITY §6.3). |

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

## 7. Responsive behavior + the projector's fallback tiers (AC8 responsive)

Web-first, responsive. The search stays prominent and full-width at every width; the projector
**degrades in tiers** as the viewport narrows / the header shortens (the principle: *preserve the
meaning, shed the spectacle* — VISUAL_IDENTITY §6). Breakpoint **intent** (Dev maps to the app's real
header heights — spec A2; these are the design targets):

| Breakpoint | Header / projector | Search | Topic list |
|---|---|---|---|
| **`≥ lg` (desktop, ~≥1024px)** | **Tier A `"projector"`** — full beam to `burnY≈168px`, gold border off both edges, "pedia" ghost, lockup column-centered (§4.3). Header band tall enough to flare. | Full-width within the content column (max ~`640px`), `h-11`/`text-base`, visible "Find a topic" label, lit by the beam. | 2-col grid (`sm:grid-cols-2`). |
| **`md` (~768–1023px)** | **Tier B `"lockup-lit"`** — lockup + lit aperture, **beam dropped** (header band shortened; the flare no longer reads as "becoming the content" — VISUAL_IDENTITY §6.3). Gold border + "pedia" dropped with the beam. | Full-width within the column; unchanged behavior. | 2-col grid. |
| **`< md` (mobile)** | **Tier C `"lockup-flat"`** — plain `wiki \| +plus` lockup, flat indigo "+" block, no beam/glow/"pedia". The lockup keeps its own internal split as a self-contained unit (no divider to align to — N/A here anyway). | **Full-width, never collapsed to an icon** (AC1 — the landing search must stay prominent; the `topic-disclosure` icon variant is for the *Topic* header, never the landing page). | Single column (grid reflows to 1-col). |

**Tier-drop triggers (design intent; AC8 / VISUAL_IDENTITY §6.3):**

- **Beam → drop to Tier B** when the header band is shorter than the beam's flare distance (≈`70–90px`
  below the block) — a stubby beam reads as a glitch, not a projection. At `md` the header shortens
  below this floor.
- **"pedia" ghost → drop** with the beam (Tier B/C): it needs horizontal room behind the block; on
  narrow layouts it clips at the viewport edge. Never show a half-word.
- **Gold off-page border → Tier A only / full-bleed only:** in a boxed/narrow header it would
  terminate mid-strip and read as an underline. Constrain to full-bleed headers (`fullBleed=true`).

The **search hero never degrades** below "full-width, labeled, prominent." Only the projector chrome
sheds layers. This protects AC1 across all sizes.

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
   `TopicSearch variant="home"` (the focus, AC1) → the §3 explanation (AC6) → a quiet rule → the
   **demoted** topic list under "Explore example topics" (AC7, all four states preserved). Keep
   `AuthControl variant="home"` + the Contribute link in the header chrome (as today). The search
   path is **reused unforked** (AC2) — single `TopicSearch` import, no new search component.
4. **Responsive** per §7 — Tier A `≥ lg`, Tier B `md`, Tier C `< md`; search full-width/never collapsed
   at every width; list reflows 2-col → 1-col.
5. **Tests** for: search-to-route (existing seeded title, created-on-demand title, unknown-title Enter
   — these largely assert #12 behavior is unchanged from the landing host); the wordmark accessible
   name (`"wiki+"`) + decorative-layer `aria-hidden` model; the topic-list read-error floor still
   renders. (AC11/AC12.)
6. **Do NOT** touch `components/topic/TopicHeader.tsx` or the article body (VISUAL_IDENTITY §9.3 / spec
   Out of scope). **Do NOT** add the v2 video-entry UI (separate spec, design-only this round).

## 12. Open design questions flagged for Dev

- **OQ-1 — exact `burnY` / header band height.** `burnY≈168px` and `cyMid≈52px` are design targets
  derived from the strip proportions (spec A2). Dev maps them to the real rendered header band; keep
  the ~82px flare distance above the Tier-B floor. If the natural header band is shorter, raise the
  band height for Tier A rather than shipping a stubby beam.
- **OQ-2 — perf of the live mark (spec A3).** If the CSS `filter`/`mix-blend-mode` + SVG causes jank,
  ship Tier A as a **pre-rendered static SVG/PNG asset** (the mark is static) — Dev's call at build,
  not a blocker. The accessible-name/`aria-hidden` model still applies to the asset wrapper.
- **OQ-3 — page `<h1>` for landmarks.** The hero uses the search's visible "Find a topic" label as the
  heading and no visible `<h1>`. If a screen-reader landmark audit wants a top-level heading, add a
  visually-hidden `<h1>wiki+</h1>` (§2) rather than visible prose above the search.
- **OQ-4 — Tier A↔B breakpoint number.** §7 gives the *intent* (`≥ lg` Tier A, `md` Tier B); the exact
  px is Dev's mapping to the app's real header heights (spec A2 / VISUAL_IDENTITY §10.2 #6).
