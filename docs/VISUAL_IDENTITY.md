# wiki+ — Visual Identity: the Header Wordmark ("Daylight Projector")

**Role:** UX / Design · **Status:** LOCKED prototype identity (design decision converged over
~15 iterative rounds with the owner) — captured here to be **buildable** and **sign-off-ready**,
not re-opened · **Phase:** prototype · **Canonical render:**
[`mockups/wordmark-projector-illuminate.html?solo=01`](../mockups/wordmark-projector-illuminate.html)
— variant **`01` "Daylight — subtle glow."** The `buildScene()` function in that file is the
source of truth for geometry, layering, and color values; this document formalizes it.

> **Governance, read first (full detail in §9).** Both committed-identity tensions this direction
> raised are now **resolved by the owner**, so no gating decision remains: (a) **gold** — the owner
> has reclassified gold (`#E5AB28`) from "deliberately unused" to an **accent / tertiary color**, used
> sparingly and in a lighter, desaturated form for the wordmark (§9.1); `CLAUDE.md` and
> `TOPIC_PAGE_DESIGN.md` are updated to match. And (b) this **concentrates the committed
> split-wordmark** described in `TOPIC_PAGE_DESIGN.md` into a single seam-aligned header lockup — but
> per the owner this **preserves** the split by aligning the lockup across the wiki/plus divider
> rather than abandoning it (§9.2). The Wikipedia **article body** is unaffected — the beam burns to
> the content's *own* white and adds no chrome to the article — but the **header is new**. What
> remains is documentation reconciliation and the Dev build (§10), not sign-off.

---

## 1. Summary

The wiki+ header wordmark is a small piece of visual storytelling about what the product *is*: a
**curation-and-contextualization layer projected on top of Wikipedia**. The mark **straddles the
`wiki | plus` seam and is aligned across the page's wiki/plus divider** — a faithful Wikipedia-serif
**"Wiki"** on the source/article side, the Indigo Press **"+" zine block** on the curation side — so
the lockup **preserves the committed split by labeling both columns by position** (§2.2, §6.0). The
"+" is treated as an **aperture / projector lamp**. A strictly
geometric **"+"-shaped beam of light** descends from that aperture into the header, flaring until it
exceeds page width and **becomes the content area itself**: the plus layer literally *projects
context onto the article below*. Everything in the beam's path is **burnt to pure white**
(overexposed daylight), so the header's cool near-white and the content's warm white resolve into
one surface with no seam. With the interior all-white, **the entire light signal is carried by a
single solid gold border** tracing the burnt region. Behind the aperture, **"pedia" persists** as
the faintest dark ghost — Wikipedia is always the substrate; wiki+ never hides it.

This document covers: the conceptual framing (§2), anatomy (§3), design tokens (§4), construction &
rendering technique (§5), placement & responsive behavior incl. fallbacks (§6), accessibility (§7),
do/don't (§8), and the **brand-rule & governance flags** plus open questions and the Dev hand-off
(§9–§10).

---

## 2. Conceptual & metaphorical framing

This is the heart of the spec. The treatment is not decoration; every move encodes the product
relationship, and Dev/QA should be able to read this section and understand *why* a value is what it
is — so that, where implementation must compromise, the **meaning** is preserved even if the pixels
shift.

### 2.1 Product meaning — a layer projected onto a trusted source

wiki+ is a curation & contextualization layer **over** Wikipedia. The wordmark must hold both halves
of that relationship at once and keep them in the right order:

- **Wikipedia is the trusted source, the substrate.** It is rendered faithfully and never
  overwritten.
- **The "Indigo Press" plus is the curation layer**, and it sits *on top of* and *projects onto* the
  source — it adds context, it does not replace.

The mark earns its keep by saying this in one glance: the source on the left, the plus block on the
right, and a beam of curation-light pouring down from the plus onto the page below.

### 2.2 The wordmark straddles the `wiki | plus` seam — the seam alignment *is* the split

This **preserves and concentrates** the committed split-wordmark idea (in `TOPIC_PAGE_DESIGN.md`, the
wordmark splits to label the two columns). The split is **not abandoned and not bolted on as separate
column labels** — it is **carried by alignment**: the lockup straddles the page's actual wiki/plus
divider, so **"Wiki" labels the source/article side and "+plus" labels the curation side *by
position*.** The single header lockup therefore *is* the column labeling, by where it sits. (See §6
for the load-bearing placement requirement and §9.2 for the resolved governance note.)

- **LEFT — "Wiki," the encyclopedia/source.** Set in a faithful **Wikipedia serif (Georgia)** so it
  reads as "the encyclopedia." This is deliberately the same type voice the article side uses, and it
  sits on the **source / Wikipedia-article side** of the seam.
- **RIGHT — the "+" zine block, the Indigo Press layer.** A solid **indigo `#676EB4`** card with a
  **2px solid black (`#2C2C2C`) border** and a **hard black offset shadow**, the word **"plus"** set
  in **Source Sans Pro 900** in white. It sits on the **plus / curation side** of the seam. This is
  not a one-off: it matches the live `.plus-card` components on the +plus side **exactly**, so the
  wordmark is visibly cut from the same cloth as the product's curation surfaces.
- **The lockup's internal seam** (where "Wiki" ends and the block begins — `seam = cw/2` in the
  mockup, §4.3) is the hinge between those two worlds; aligning it to the page's real column divider
  is what makes the mark *label* both columns rather than merely sit above them.

### 2.3 The "+" is a CUTOUT — an aperture, conceptually a projector lamp

The "+" is **knocked out** of the indigo card (an even-odd cutout, not a drawn glyph). You are
looking *straight into the light source* — like turning around in a movie theater and looking back
at the projector bulb. Two consequences follow, and they're the crux of the "overexposure" read:

- **The center is too bright to look at** — a white-hot, blown-out core.
- **Color survives only at the very edge.** The gold is a *thin rim* at the rim of the cut, where the
  light "clips to white" as it moves inward. This is the photographic principle (see §2.9): a colored
  light source reads as its color via the **colored bloom around a white-hot, clipped core**, not via
  a fill.

### 2.4 The projection (the beam) — the central metaphor

From the aperture, a **strictly geometric "+"-shaped beam** descends into the header. This is the
single most important gesture: **the plus layer PROJECTS onto the Wikipedia article.**

The beam's growth is choreographed: it starts as a **narrow stem** at the aperture, **flares to a
horizontal crossbar**, then its bracket arms **keep widening until they exceed full page width** — so
the projected "+" grows so large it *becomes the content area itself.* The plus illuminates /
projects context onto the article below; by the time the beam reaches the content boundary, it *is*
the content surface.

### 2.5 Burn to white (overexposure / daylight)

Everything in the beam's path is **burnt to pure white** — overexposed daylight. Critically, the
**beam interior carries NO gradient**; it is simply white (`#ffffff`), indistinguishable from the
pure-white article content it becomes.

Two color temperatures resolve into one:

- The **header above** is a cool, near-white **"fluorescent" field** — brand-tinted, `#fafbfe`.
- The **content below** is warm **"daylight"** — `#ffffff`.

They meet *inside the projection* with **no visible seam** — white meets white. The beam is the
device that dissolves the temperature change, so there is no cool/white edge line where it lands.

### 2.6 The gold border carries the signal

Because the interior is fully white, **all the light-intensity signal is carried by the projection's
BORDER**: a solid, full-intensity gold edge (**2px**), deliberately echoing the zine block's
stylized, "unrealistic" border weight. It is the *transition line into the burnt-to-white region* —
above the line is fluorescent header, below/inside is burnt-white content. The border runs **straight
off the page edges** (clipped at the content boundary — **no fade**). A **soft gold glow lives only at
this edge** (the beam's drop-shadow), and it is clipped so it never bleeds down onto the content.

### 2.7 The aperture bleed

The too-bright aperture **bleeds light over the indigo card surface following the "+" OUTLINE** — not
a circle. This is light escaping the cut's edges, tracing the plus shape onto the surrounding indigo.
It is **tight and contained**: it hugs the cutout and never washes across the whole block.

### 2.8 The "pedia" underneath — Wikipedia persists

Behind the aperture, the word continues: **"Wiki" + "pedia" = Wikipedia.** The "pedia" is printed
behind the cut in **deep, absorbent black**. The letter surfaces reflect no light, yet the intense
light **bleeds over them (halation)**, so they survive only as the **faintest dark ghosts** — each
letter's center only a touch darker than its light-blurred edges; you can barely make them out.

The meaning is exact and load-bearing: **Wikipedia is always the substrate beneath the plus layer;
wiki+ never hides it.** You glimpse the full "Wikipedia" through the aperture, *nearly* (but never
fully) washed out by the plus's bright contribution.

### 2.9 Photographic reference

The "burn to white" was tuned against an **overexposure reference** — an LED key-visual in which
colored bars read as *vividly colored* even though their centers are pure white. The principle we are
reproducing: **a light source reads as its color via the colored bloom around a white-hot, clipped
core.** That is why the gold lives at edges and rims, and the interiors clip to white.

### 2.10 How we got here

The direction converged across many iterative rounds. The working tree keeps only the locked mark
(`wordmark-projector-illuminate.html`); the exploration files named below were pruned in the
mockup-cleanup pass and live on in **git history**. The lineage is worth recording, because it
explains why the final mark is so restrained:

1. **Seam / negative-space studies** — `wordmark-01-butt-joint` … `wordmark-10-play-tile`,
   `wordmark-negspace-*`: how "Wiki" and the plus block meet (butt joint, hinge, interlock, negative
   space).
2. **"pedia" reveal studies** — `wordmark-pedia-float / -glow / -lit`, `wordmark-wikipedia-reveal`:
   the idea that "pedia" persists behind the plus, lit or floating.
3. **An "LCD glow in fog" idea**, which became a **"tractor beam,"** which became a **projector
   beam** (`wordmark-projector`, `-shine`, `-illuminate`).
4. **The daylight burn-to-white** — the beam stops being a colored cone and becomes overexposed white.
5. **The overexposure bloom** — color is pushed to the bloom/rim around a white-hot core (the §2.9
   reference).
6. **Gold rim following the plus** (not a circular glow) + **letter halation** over "pedia."
7. **Finally:** the **all-white beam whose solid gold border alone carries the signal** — variant
   `01`. (Variants `02`–`05` in the same file push more saturation; they are explorations only. **01
   is locked.**)

---

## 3. Anatomy

```
   cool fluorescent header field  (#fafbfe)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                                                                                │
 │                  ╎ seam ╎                                                      │
 │     ┌────────────┐      ┌──────────────────────┐                              │
 │     │            │      │ ▓▓▓  ╳ ◄ aperture ▓▓ │  plus  ◄ indigo zine block   │
 │     │   W i k i  │      │ ▓▓ (+ cutout = lamp) │        (#676EB4, 2px #2C2C2C  │
 │     │  (Georgia) │      │ ▓▓▓  (pedia ghost)▓▓ │        border + offset shadow)│
 │     └────────────┘      └─────────╎────────────┘                              │
 │                                   ╎ stem (narrow)                              │
 │                              ╱────┴────╲                                       │
 │                       ╱──────           ──────╲   crossbar flares wide         │
 │              ╱───────                            ───────╲                       │
 │ ════════════╪══════════════ GOLD BORDER ══════════════╪═════════════  ◄ content│
 └─────────────╎─────────── (runs off both page edges) ──╎────────────── boundary │
   burnt-to-white content area  (#ffffff)               │  brackets keep widening │
   = the projected "+" interior, indistinguishable      ╲  past full page width   ╱
     from the article's own white                        ──────────────────────
```

**Reading the anatomy left→right, top→bottom:**

1. **Serif "Wiki"** (Georgia) — the source, left of the seam.
2. **The seam** — where the two type/identity worlds meet; in the full header it is **aligned to the
   page's wiki/plus column divider** (§6.0), so the lockup labels both columns by position.
3. **Indigo "+" zine block** — the Indigo Press layer, right of the seam: solid indigo, 2px black
   border, hard offset shadow, white "plus."
4. **The "+" aperture** — a cutout in that block: white-hot core, thin gold rim, "+"-shaped bleed
   onto the indigo, faint black "pedia" behind.
5. **The descending geometric "+" beam** — narrow stem → horizontal crossbar → brackets widening past
   page width. Pure-white interior; solid gold edge; gold glow only at the edge.
6. **The burnt-to-white content boundary** — where the gold border runs straight off both page edges
   and the white beam becomes the white content surface, seamlessly.

---

## 4. Design tokens

All values are read directly from variant `01` in the canonical mockup. Token names are proposed for
Dev; pin them in the app's Tailwind config / CSS custom properties.

### 4.1 Type

| Element | Family | Weight | Size (mockup) | Letter-spacing | Color |
|---|---|---|---|---|---|
| **"Wiki"** (crisp, source) | **Georgia, serif** | **600** | `42px` (`FS`) | default | `#1b1b1b` (near-ink) |
| **"plus"** (zine block) | **Source Sans Pro** | **900** | `~26px` = `round(blockHeight·0.46)` | **`-1px`** | `#ffffff` |
| **"Wikipedia" / "pedia" ghost** | **Georgia, serif** | **600** | `42px` (matches "Wiki") | default | `#000` / warm-brown, see §4.2 |

Notes for Dev:
- "Wiki" and "pedia" are the **same font, weight, and size** — "pedia" is literally the continuation
  of the same word, just printed behind the cut and nearly washed out. Do not substitute a different
  weight.
- The block "plus" is sized **relative to the block height** (`0.46×`), not an absolute px — keep that
  ratio if the block scales. Letter-spacing `-1px` at `~26px` is the tight, chunky zine setting that
  matches the live `.plus-card` heads.
- Georgia is the platform Wikipedia serif used elsewhere in the article styling; **reuse the same
  serif stack** the article side uses, do not introduce a new font for the wordmark.

### 4.2 Color

**Existing brand tokens (unchanged — reused here):**

| Token | Value | Use in the mark |
|---|---|---|
| `--brand` (indigo) | `#676EB4` | the zine block fill |
| `--ink` | `#2C2C2C` | the zine block 2px border + the hard offset shadow |
| (article ink) | `#1b1b1b` | the crisp "Wiki" serif |

**New / wordmark-specific surface tokens:**

| Proposed token | Value | Meaning |
|---|---|---|
| `--header-field` (cool fluorescent) | `#fafbfe` | solid header background above the content boundary |
| `--content-white` (warm daylight) | `#ffffff` | the content surface; also the beam interior |
| `--pedia-ghost-brown` | `#6a5e46` @ `opacity .06`, `blur .8px` | the full faint "Wikipedia" backing word |
| `--pedia-black` | `#000` @ `opacity ~.24`, `blur 1.45px` | the "pedia" halation ghost (the `o.pedia` value) |

**The NEW gold tokens (the governance-flagged ones — see §9):**

| Proposed token | RGB | Hex (approx) | Role |
|---|---|---|---|
| `--gold-rim` / `goldE` | `rgb(238, 206, 135)` | **`#EECE87`** | the **light** gold: beam border (2px), aperture rim stroke, the gold drop-shadow glow, the wider bleed shape |
| `--gold-fill` / `gold` | `rgb(255, 236, 178)` | **`#FFECB2`** | the **warmer** fill gold: only used *mixed toward white* in the aperture's radial core (`mix(gold,0.5)`, `mix(gold,0.22)`) |
| `--bleed-warm-white` | `rgb(255, 252, 246)` | `#FFFCF6` | the tighter, near-white inner bleed "+" shape |

**Relationship to the forbidden brand gold (`#E5AB28`) — state this explicitly:** our golds are in
the **same hue family** but are **markedly lighter and more desaturated** (`#EECE87` / `#FFECB2` vs.
`#E5AB28`). They never appear as a *fill* at full saturation; they live as a thin rim and an edge
glow, and even the aperture core mixes them toward white. This is a deliberate softening so the mark
reads as *overexposed daylight*, not as "brand gold." **It is still gold,** however — which is why
§9 flags it for Product even though it is not the literal forbidden value.

### 4.3 Geometry, spacing & borders (variant 01)

Read from `buildScene()` at the mockup's canvas size (`cw` ≈ canvas width, height `250px`):

| Param | Value | Meaning |
|---|---|---|
| `seam` | `cw / 2` | vertical center; "Wiki" ends here, the block begins here |
| `cyMid` | `64px` | vertical center of the wordmark row |
| `pageY` | `150px` | **the content boundary** (header→content); also the beam's `fadeY` |
| zine block height `bh` | `56px` | the "+" block height |
| zine block border | **2px** solid `#2C2C2C` | matches `.plus-card` |
| zine offset shadow | hard black arms: a `6px` ink bar bottom + a `6px` ink bar right | the "+" block's offset drop shadow |
| aperture core box | `44 × 44px` | the radial white-hot core |
| beam border | **2px** solid `#EECE87` | the single signal-carrying edge |
| beam fill | `#ffffff` | no gradient |
| beam edge slope `tan` | **`0.6`** (variant 01) | the vertical arm edge angle = `(y − apex)·0.6` half-width |
| beam edge margin `eM` | `17px` | crossbar ends sit `17px` from each page edge before the brackets continue off-page |
| beam glow | `drop-shadow(0 0 4px rgba(238,206,135,.6))` + `drop-shadow(0 0 11px rgba(238,206,135,.32))` | gold edge glow, **clipped at `pageY`** |
| aperture rim stroke | width `3`, `rgb(238,206,135)` @ `0.85`, `blur .85`, **clipped to "+" interior** | gold at the edge, clipping to white inward |
| aperture bleed | screen-blended, `blur 4px`; wider `#EECE87` @ `~0.46` + tighter `#FFFCF6` @ `0.92` | "+"-outline-shaped bleed onto the indigo |

> The slope `tan = 0.6` and `fadeY = 150` are the **variant-01** values. Variants 02–05 share
> `tan: 0.6`/`fadeY: 150` but differ in the gold values — and they are **not** the locked mark. Use
> the §4.2 golds.

---

## 5. Construction & rendering techniques (buildable)

The canonical render is **SVG paths + CSS filters/blend-modes layered in a positioned container.**
Below is how each piece is built, in z-order, so Dev can rebuild it faithfully. (The mockup builds it
imperatively in `buildScene()`; in the app it should be a self-contained `Wordmark` /
`HeaderProjector` component — see §10.)

### 5.1 The two-temperature surface (z ≈ 0.3 / 0.35)

Two solid blocks, **no gradient**: header field `#fafbfe` from top to `pageY`; content `#ffffff` from
`pageY` down. The beam (below) is what dissolves the boundary between them.

### 5.2 "Wiki", the ghost word, and "pedia" (z ≈ 3 / 5 / 10)

- A faint full **"Wikipedia"** ghost: Georgia 600 `42px`, color `#6a5e46`, `opacity .06`, `blur .8px`,
  left-anchored so its "Wiki" sits exactly under the crisp "Wiki".
- The crisp **"Wiki"**: Georgia 600 `42px`, `#1b1b1b`, ending at the seam.
- The **"pedia" halation ghost**: Georgia 600 `42px`, `#000`, `opacity ~.24`, `blur 1.45px`,
  positioned to continue the word *behind* the cut. The blur + low opacity *is* the halation: centers
  read slightly darker than the blurred edges.

### 5.3 The indigo "+" zine block with the cutout (z ≈ 9)

A single SVG draws the block as an **even-odd path**: an outer rect `M0 0 H{w} V{h} H0 Z` **plus the
"+" path**, filled `#676EB4` with `fill-rule="evenodd"` — so the "+" is a *true knockout* (the lamp
shows through), not a painted glyph. A `2px` `#2C2C2C` stroke rects the block; "plus" is an SVG
`<text>` (Source Sans Pro 900, white). The "+" path is built by `plusPath(cx,cy,a,b)` (a 12-point
plus polygon; arm half-thickness `a≈8`, arm reach `b≈min(h·0.32,18)`).

### 5.4 The aperture: white-hot core + gold rim (z ≈ 2, rim inside 5.3)

- **Core:** a `44×44px` div with a `radial-gradient(circle at 50% 46%, #ffffff 0%, #ffffff 74%,
  rgb(mix gold .5) 93%, rgb(mix gold .22) 100%)` — white out to 74%, then a whisper of warmth at the
  rim. (`mix(c,t)` = blend color `c` toward white by `t`.)
- **Gold rim:** an SVG `<path>` *stroke* on the very same "+" path, `stroke-width 3`,
  `rgb(238,206,135)` @ `0.85`, **`clip-path`’d to the "+" interior** and **blurred** (`stdDeviation
  .85`). Clipping to the interior is what makes the gold **brightest at the edge and clip to white
  inward** — exactly the §2.9 overexposure read. (Do **not** substitute a circular radial glow.)

### 5.5 The "+"-shaped aperture bleed (z ≈ 12, `mix-blend-mode: screen`)

Two blurred "+" shapes drawn **over** the block and **screen-blended**: a wider one in `#EECE87`
(`opacity ~.46`) and a tighter one in `#FFFCF6` (`opacity .92`), both `blur 4px`. Screen-blend means
**over the white cut interior it is a near no-op, and the bleed only shows where it spills onto the
indigo** — tracing the "+" outline onto the card surface (§2.7). This is the key technique: the bleed
follows the *plus shape*, not a circle, because it is the same `plusPath` enlarged.

### 5.6 The geometric "+" beam (z ≈ 6) — the signal carrier

A single SVG path, an **8-point polygon** with **straight edges only**:

- Vertical arm edges run at a fixed angle: half-width `hw(y) = (y − apex)·tan`, `tan = 0.6`.
- A **completely horizontal crossbar** at `crossY` whose ends reach to `eM=17px` from each page edge.
- From the crossbar ends, the edges **return to the beam angle and expand downward** so the bracket's
  implied continuation **encloses the whole content region** (`RX+dn`, `LX−dn` at `coneBot`).
- **Fill `#ffffff`** (no gradient). **Stroke `2px` `rgb(238,206,135)`**, `stroke-linejoin: round`.
- The whole beam element gets the **gold edge glow** via CSS `drop-shadow` (two layers, §4.3).
- **Containment is critical:** the beam element is **`clip-path: inset(...)` clipped at `pageY`** (the
  content boundary). This (a) makes the gold border run *straight off the page edges* with **no fade**,
  and (b) keeps the **glow inside the header** so it never bleeds onto the white content below. Because
  the beam is pure white exactly at `pageY` and the content is pure white too, **the clip is
  invisible** — the white beam *is* the white content from there down.

### 5.7 Layer order (bottom → top)

`surface fields` → `article hint` → `Wikipedia ghost` → `aperture core` → `pedia ghost` → `beam (+
glow, clipped)` → `zine block offset-shadow arms` → `zine block + rim` → `screen-blend bleed`.

### 5.8 Technique checklist (so a rebuild stays faithful)

- [ ] geometric **polygon** beam (straight edges; no blur on the shape itself)
- [ ] **`clip-path` containment** at the content boundary (off-page border, no glow on content)
- [ ] **`screen`-blend "+"-shaped bleed** (follows the plus outline, no-op over white)
- [ ] **SVG rim stroke clipped to the plus interior** (gold at edge, clips to white inward)
- [ ] **halation** via blur + low opacity on a pure-black "pedia"
- [ ] **even-odd knockout** for the "+" cutout (true aperture, not a glyph)
- [ ] **no gradient in the beam interior**; the only gradient is the aperture core

---

## 6. Placement & responsive behavior

**This is where the locked mockup needs the most design reasoning**, because the mockup is a **wide
header strip** (a `1000px`-class canvas) while the real app is **web-first but responsive and
vertical-first** (per VISION: "Native mobile apps" is a non-goal; the product is responsive web, and
short *vertical* clips are the content focus). The full projector cannot survive at every size, so the
mark must **degrade in defined tiers**. The principle: **preserve the meaning, shed the spectacle.**

### 6.0 PLACEMENT REQUIREMENT — align the internal seam to the column divider (Tier A)

This is the load-bearing placement constraint that makes the lockup *label* the two columns (§2.2). In
the **full/wide header (Tier A)**, the lockup's **internal seam** (`seam = cw/2`, §4.3 — where "Wiki"
ends and the indigo block begins) **must be aligned to the page's actual wiki/plus column divider**, so
the mark reads as labeling both columns: "Wiki" over the source/article column, "+plus" over the
curation column. The split is delivered **by position**, not by drawing separate column labels.

**Degradation, stated honestly:** when the columns **stack / reflow at narrow widths** (vertical-first
layouts), there is **no side-by-side divider to align to.** At those tiers the lockup **keeps its own
internal `wiki | +plus` split as a self-contained unit** — it still *shows* the source-vs-plus split in
its own composition; it simply cannot align to a page divider that no longer exists. So the split is
never lost: at Tier A it is *aligned to* the real divider; at narrower tiers it is *carried within* the
lockup itself. (How the seam maps to the real column layout and at which breakpoint the columns stop
sitting side-by-side is a Product/Dev reconciliation item — §10.1 #2, §10.2 #6.)

### 6.1 The core lockup that must survive everywhere

The **non-negotiable minimum** is the **`wiki | +plus` lockup**: serif "Wiki" + the indigo "+" zine
block with its black border and offset shadow. That alone carries the brand and the
source/curation-layer story. The projector beam, the bleed, the rim, and the "pedia" ghost are all
**enhancements layered on top of** that lockup.

### 6.2 Responsive tiers (proposed; needs Dev validation)

| Tier | Context | What renders |
|---|---|---|
| **A — Full projector** | Wide header, `≥ lg` (desktop), columns side-by-side, header tall enough for the beam to flare into the content | The complete §5 treatment: lockup + aperture + beam to content boundary + gold border off-page + bleed + "pedia" ghost. **Internal seam aligned to the wiki/plus column divider per §6.0** — the mark labels both columns by position. |
| **B — Lockup + aperture, no beam** | Narrower / shorter headers (`md`) where there isn't enough vertical room below the lockup for the beam to read as "becoming the content" | The `wiki \| +plus` lockup with the lit aperture (white-hot core + gold rim + tight bleed), but **the descending beam is dropped** (it has nowhere to flare). The aperture still says "projector lamp"; we just don't draw the projection. |
| **C — Flat lockup** | Tight mobile top bars / compact `TopicHeader` (`< md`), or wherever the lit aperture can't render cleanly | The plain `wiki \| +plus` lockup: serif "Wiki" + a flat indigo "+" block (a drawn "+" glyph is acceptable here, since there's no lamp to look into). No beam, no glow, no "pedia." |
| **D — Glyph / icon mark** | Favicon, app icon, very small UI, monochrome contexts | A **single indigo "+" zine tile** (the block alone, with its border) as the app glyph — the most-compressed expression of the Indigo Press identity. **Open question (§10):** whether the icon should be the bare "+" tile or carry a hint of the white-hot aperture. |

### 6.3 Specific small-size guidance

- **The beam must not render as a thin sliver.** If the header is shorter than roughly the beam's
  flare distance (`pageY − blockBottom`, ~`70–90px` in the mockup), drop to Tier B — a stubby beam
  reads as a glitch, not a projection.
- **The gold border running off-page only reads on a full-width header.** In a centered/boxed header
  it would terminate mid-strip and look like an underline; constrain Tier A to **full-bleed headers**,
  else use Tier B.
- **The "pedia" ghost needs horizontal room** behind the block. On narrow layouts it gets clipped by
  the viewport edge; drop it (Tier B/C) rather than show a half-word.
- **Seam alignment only applies where columns sit side-by-side.** The §6.0 requirement to land the
  internal seam on the page's column divider holds for Tier A. Once the layout **stacks/reflows** (the
  vertical-first narrow tiers), there is no divider to hit — keep the lockup's own `wiki | +plus` split
  as a self-contained unit (it still shows the split) and do **not** try to stretch it across a
  divider that isn't there.

### 6.4 Dark mode

The whole mark is built on a **light/overexposure metaphor** — "daylight," "burn to white,"
"fluorescent header." **It does not translate literally to a dark UI.** wiki+ ships **no dark mode
today**, so this is an **open question (§10)**, but the recommended direction is: dark mode keeps the
**flat lockup (Tier C)** — indigo block + a serif "Wiki" in a light ink — and **does not attempt** the
burn-to-white projector (you cannot "overexpose to white" on a dark field without inverting the entire
concept). Re-deriving a true dark-mode treatment (e.g. a *spotlight in a dark theater* inversion) is a
**future design task, explicitly out of scope here.**

### 6.5 Static, not animated

The mark is **static** (a single rendered state). No reveal/animation is specified or implied. If a
future "lamp warm-up" animation is ever proposed, it must be **`prefers-reduced-motion`-gated** — but
none is in scope now (see §7.4).

---

## 7. Accessibility

Accessibility is baseline, not a pass. The wordmark is **decorative imagery built around real text**,
which shapes how it's marked up.

### 7.1 The text must be real and named

- The whole mark must expose the accessible name **"wiki+"** (or "wiki plus") to assistive tech —
  e.g. an `aria-label="wiki+"` on the wordmark link/container, with the SVG/decorative layers
  `aria-hidden="true"`. A screen-reader user hears the product name, **not** "Wiki," "plus," and
  "pedia" as three fragments, and never the decorative beam.
- The "pedia" ghost is **purely decorative** and must be `aria-hidden` — it is intentionally
  near-invisible and must never be a content the user is expected to read.

### 7.2 Contrast (AA)

- **White "plus" on indigo `#676EB4`:** contrast ratio ≈ **3.9:1**. That **fails** AA for *normal*
  text (4.5:1) but **passes AA for large text** (≥3:1). The "plus" is set in **Source Sans Pro 900 at
  ~26px** — comfortably "large/bold" by WCAG (≥18.66px bold) — so it **passes AA-large**. This is the
  same fill/weight relationship already used and accepted on the live `.plus-card` heads; keep "plus"
  **bold and large** so the exemption holds. (If "plus" is ever set smaller/lighter in a fallback
  tier, re-check, or darken the block toward `--violet #5248AF` for that use.)
- **Serif "Wiki" `#1b1b1b` on `#fafbfe`:** ~**17:1** — passes AA/AAA easily.
- **The gold border / glow / aperture are DECORATIVE** and are **never** the sole carrier of any
  meaning, so they are **exempt** from text-contrast requirements (WCAG 1.4.1/1.4.11 apply to
  meaningful UI, not decoration). This is by design: §2.6's "the gold carries the signal" is an
  *aesthetic* signal (light intensity), **not** a UI state — see §7.3.

### 7.3 Not color alone / the gold is decorative, never functional

The gold beam-border looks like it "carries the signal," and in the *metaphor* it does — but it
**carries no product information.** It does not indicate state, status, accuracy, stance, or
interactivity. The product's actual signals (fact-vs-opinion chips, sync status, etc.) live elsewhere
and are already text-labeled (`TOPIC_PAGE_DESIGN.md` §"Fact-vs-opinion signal"). **Rule:** the
wordmark's gold must **never** be reused to encode a functional state, precisely because it is
decorative and because gold is otherwise reserved/avoided in the UI.

### 7.4 Reduced / no motion

The mark is **static** — there is nothing to animate, so there is no reduced-motion risk today. The
spec records that any future motion (a lamp warm-up, a beam sweep) is **gated by
`prefers-reduced-motion`**, reusing the project's existing reduced-motion handling (e.g. the
pinned-player dock-in gate).

### 7.5 Legibility & robustness

- The mark must remain legible if **web fonts fail to load** (Georgia is a near-universal system
  serif, so "Wiki" is safe; "plus" should fall back to the same `system-ui, sans-serif` bold stack as
  other Source Sans Pro headings).
- It must remain recognizable **without color** (e.g. forced-colors / high-contrast mode): in that
  case the **lockup shape** (serif "Wiki" + bordered "+" block) carries recognition; consider forcing
  the flat Tier-C lockup under `forced-colors: active`.

---

## 8. Do / Don't

**Do**
- Keep the **`wiki | +plus` lockup** as the irreducible core; layer the projector on top of it.
- **Align the lockup's internal seam to the page's wiki/plus column divider (Tier A)** so "Wiki"
  labels the source/article column and "+plus" labels the curation column by position — this is how
  the lockup *preserves* the committed split (§6.0). Where columns stack, keep the lockup's own
  internal split as a self-contained unit.
- Match the zine block to the live `.plus-card` **exactly**: indigo `#676EB4`, 2px `#2C2C2C` border,
  hard offset shadow, white Source Sans Pro 900.
- Keep the beam **interior pure white**, edges **straight**, and the **gold only on the border / rim /
  edge-glow**.
- Keep "Wiki" and "pedia" the **same** serif/weight/size — it's one word.
- Treat the beam as **burning to the content's own white** — it adds **no chrome to the article body**.
- Provide and use the **fallback tiers (§6)** at small sizes / favicon / dark mode.

**Don't**
- **Don't** fill the beam interior with gold or a gradient (it must read as overexposed white, not a
  colored cone).
- **Don't** make the aperture glow a **circle** — the rim and the bleed follow the **"+" outline**.
- **Don't** let the gold glow **bleed onto the content** below the boundary (clip it at `pageY`).
- **Don't** raise the gold to the brand gold `#E5AB28` or full saturation — it must stay the lighter,
  desaturated daylight gold (§4.2).
- **Don't** reuse the wordmark gold anywhere as a **functional/state color** (§7.3).
- **Don't** draw "pedia" legibly or read it aloud to AT — it is a faint, `aria-hidden` ghost by design.
- **Don't** restyle the **Wikipedia article body**; this treatment is the *header* only.
- **Don't** stretch the full projector into headers too short for the beam to flare (use Tier B).

---

## 9. Brand-rule & governance flags — RESOLVED BY OWNER

Two committed-identity rules were in tension with this direction; **both are now resolved by the
owner** (§9.1, gold; §9.2, the split), so **no Product sign-off gates this direction.** What remains is
documentation reconciliation and the Dev build (§10). They are recorded here for the trail.

### 9.1 RESOLVED — gold is now an accent / tertiary color

The Indigo Press identity previously held gold (**`#E5AB28`**) as **"deliberately unused."** The owner
has **reclassified gold as an accent / tertiary color** — permitted, used sparingly, never indigo's
equal and never a functional signal color. `CLAUDE.md` and `TOPIC_PAGE_DESIGN.md` are updated to match.
This wordmark is the first and principal use. How the design already keeps it disciplined:

- The golds used (`#EECE87`, `#FFECB2`) are **lighter and desaturated**, not the brand gold, and never
  appear as a saturated fill — only as a thin rim and edge glow, mixed toward white.
- The gold is **decorative, not functional** (§7.3) — it never competes with the chip color system.
- It is confined to the **wordmark**, not introduced into the broader UI.

So gold is now sanctioned as a restrained accent; the disciplines above are the standing usage rules
(see also §8 Don'ts), not conditions awaiting approval.

### 9.2 CONFIRMED — the split is preserved via seam alignment (not replaced, not bolted on)

`TOPIC_PAGE_DESIGN.md` commits a **split wordmark** ("Wiki" over the article column, "+plus" over the
plus column) and a two-world header. The owner has confirmed the direction: this treatment **preserves
the split by aligning the single header lockup across the wiki/plus seam** (§2.2, §6.0). It neither
*replaces* the split with an unrelated mark nor *coexists* with a separate set of column labels —
instead it **concentrates the split into one seam-aligned lockup** whose internal seam lands on the
page's real column divider, so "Wiki" labels the source/article column and "+plus" labels the curation
column **by position.** This is consistent with the committed split wordmark in *both spirit and
mechanics* (two worlds, source + plus layer, divider-aligned); it is a concentration of that idea, not
a discarding of it.

**Product action (documentation reconciliation, not a decision):** update the split-wordmark
description in `TOPIC_PAGE_DESIGN.md` so it reflects the **seam-aligned header lockup** (one lockup
straddling the column divider) rather than two separate per-column labels. The replace-vs-coexist
question is **answered** — there is nothing to gate here. (Confirming exactly *how* the internal seam
maps to the real column layout and breakpoints is a layout-mapping item, §10.1 #2 / §10.2 #6, not a
brand decision.)

### 9.3 CONFIRMED — the Wikipedia article side keeps its faithful look

To close the loop on the principle "the Wiki article side keeps a faithful Wikipedia look": **this
treatment does not touch the article body.** The beam **burns to the content's own white** and stops
at the content boundary; it adds **no border, no tint, no chrome** to the article. The only new
surface is the **header**. The article-fidelity work (serif headings, citations, infobox, etc.)
stands unchanged. **What is new is strictly the header treatment** — and with §9.1 (gold) and §9.2
(the seam-aligned split) both resolved by the owner, the only follow-up is reconciling the
`TOPIC_PAGE_DESIGN.md` split-wordmark wording (§9.2) and the Dev build (§10).

---

## 10. Open questions & next steps

### 10.1 Items for Product

1. **Gold (§9.1) — RESOLVED.** The owner has reclassified gold as an accent / tertiary color; the
   "no gold" wording in `CLAUDE.md` + `TOPIC_PAGE_DESIGN.md` is updated accordingly. No decision
   remains here.
2. **Split-wordmark reconciliation (§9.2) — RESOLVED, doc + layout follow-up.** The split is
   **preserved via seam alignment** per the owner — not replaced, not bolted on. No replace-vs-coexist
   decision is needed. Product to: (a) **update `TOPIC_PAGE_DESIGN.md`** so its split-wordmark wording
   reflects the single seam-aligned header lockup (lockup straddling the column divider) rather than
   two separate per-column labels; and (b) confirm with Dev **how the lockup's internal seam maps to
   the real column layout/breakpoints** — i.e. at which width the columns stop sitting side-by-side and
   the seam-alignment requirement (§6.0) hands off to the self-contained-split fallback (§6.3, §10.2 #6).
3. **Scope of adoption — RESOLVED: BOTH pages, one shared header.** The `HeaderProjector`
   lockup is the header for **both** the home page (a free-standing Tier-A hero) **and** the
   Topic page (the shared "Daylight Projector" header). One component, two host configs — there is
   no separate Topic-page header implementation. Tier appearance by scroll state on Topic: **Tier A**
   (lit aperture + full beam) at scroll-top, collapsing to **Tier C** (flat lockup, beam faded) when
   scrolled (see §10.2 #6 + the scroll-transition decision below). On home, Tier A at every width (no
   scroll collapse). See `docs/specs/shared-header.md` + `docs/design/shared-header.md`.

### 10.2 Open design questions (resolve with Product/Dev)

4. **Favicon / app-icon mark (Tier D).** Bare indigo "+" tile, or a "+" tile with a hint of the
   white-hot aperture? (Must read at `16px`.) *(Still open — no favicon mark is wired yet.)*
5. **Dark mode (§6.4).** Confirm "no dark-mode projector; flat lockup only" for now, and whether a
   true dark inversion is a future task. *(Still open — the current behavior is the `forced-colors`
   → flat-lockup fallback; no dark inversion.)*
6. **Responsive breakpoints + seam-to-column mapping — RESOLVED.** The side-by-side ↔ stacked
   handoff is the existing **`lg` (1024px)** Topic-grid breakpoint (`lg:grid-cols-[1fr_360px]`). At
   `≥ lg` the seam aligns to the **gutter centre** — the midpoint of the `gap-7` (28px) channel
   between the `1fr` article column and the `360px` rail — driven onto the lockup via the
   `projectionX`/`seamRatio` hook off the **measured** column geometry (a mount/resize probe, never a
   per-scroll measure). The mockup's strip-canvas numbers are mapped to the real Topic band as
   `burnY=116`, `cyMid=40` (a shorter sticky chrome band than the landing hero's `burnY=130`). Below
   `lg` the columns stack, there is no divider, and the lockup carries its `wiki | +plus` split
   **within itself** (§6.3) — no seam-alignment is applied. **Scroll transition:** on
   the Topic page the header is **Tier A** (lit aperture + full beam, seam on the divider) at
   scroll-top and collapses to a **flat Tier C** slim sticky bar (`56px`, beam opacity → 0, band
   height `116 → 56`) once `scrollY > 116` (restore `< 76`, a 40px hysteresis); the transition is
   `~180ms` and **gated on `prefers-reduced-motion`** (reduced motion → end-states, no tween).
   **Tier B is not used** here (it remains defined for future shorter-header contexts). See
   `docs/design/shared-header.md` §3–§4.
7. **Performance.** The mark uses CSS `filter` (drop-shadows, blurs) + `mix-blend-mode` + SVG. Confirm
   it's cheap enough to render in the SSR'd header without layout jank; if not, consider shipping it as
   a **pre-rendered static SVG/PNG asset** for Tier A rather than live DOM (it is static, §6.5).

### 10.3 Hand-off to Development (what to build)

- A self-contained **`Wordmark` / `HeaderProjector`** component (bespoke Tailwind + inline SVG; no new
  font, no shadcn), implementing **variant 01** per §4–§5, with the **fallback tiers (§6)** behind
  size/context props (e.g. `variant="projector" | "lockup-lit" | "lockup-flat" | "glyph"`).
- Pin the **new gold tokens** (§4.2) and surface tokens (§4.1/§4.2) in the Tailwind config / CSS
  variables.
- Wire the **accessibility model** (§7): `aria-label="wiki+"` on the container, decorative layers
  `aria-hidden`, font fallbacks, `forced-colors`/high-contrast → flat lockup.
- **Do not** modify the article-body rendering (§9.3).
- After build, **UX evaluates** the running header against this spec (visual fidelity of the burn-to-
  white seam, the gold-edge-only signal, the "pedia" halation, the fallback tiers, and the a11y
  model), distinct from QA's correctness/security pass.

---

*Canonical render: [`mockups/wordmark-projector-illuminate.html?solo=01`](../mockups/wordmark-projector-illuminate.html)
— variant `01`, "Daylight — subtle glow." `buildScene()` is the source of truth for any value not
pinned above.*
