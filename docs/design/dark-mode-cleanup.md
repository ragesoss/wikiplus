# Design spec: Dark-mode cleanup pass (home projector "off", /about dark-readable, article loading glow)

- **Status:** Design contract for build-loop (UX) — GitHub issue #156. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** Issue #156 — resolve the **broken half-dark state** in the `zine-dark` skin on three
  named surface groups: the **home page header projector** (should read clearly *off* — no beam),
  **`/about`** (must read well as a dark page — the aperture "+", the mini Topic-preview title input,
  the "How it works" card), and the **article loading glow** (the golden `projector-scan` sweep that
  only makes sense on the light skin). The light skin stays byte-for-byte unchanged.
- **Inputs read:** `docs/design/skin-system-zine-dark.md` (the skin contract — §2.1/§2.2 what a skin
  owns vs. the invariants, §4 dark palette, §6 dark header, §7.1 per-surface states + the `/about`
  exemption, §8 accessibility); `docs/VISUAL_IDENTITY.md` (§6.4 dark-mode header resolution, §7
  accessibility); `docs/ARCHITECTURE.md` "Skin system"; `docs/TOPIC_PAGE_DESIGN.md` (Indigo Press
  token language); and the affected code — `components/about/Projector.tsx`,
  `components/about/MiniatureTitleInput.tsx`, `components/about/TopicMiniature.tsx`,
  `components/about/HowItWorks.tsx`, `app/about/page.tsx`, `components/header/SiteHeader.tsx`
  (the `HomeSiteHeader` / `FlatSiteHeader` hosts), `components/wordmark/HeaderProjector.tsx`, and the
  relevant `app/globals.css` rules (the `.header-projector` Tier-A defaults ~196, `.header-shared`
  rules ~321, `@keyframes wikiplus-projector-scan` / `.projector-scan` ~1154, `.about-title-input`
  ~1380, `.about-theater-field` ~1419, `.how-it-works-card` ~1438, and the `[data-skin="zine-dark"]`
  block ~1788).
- **Hand-off:** Development authors the dark-skin overrides named here entirely inside the
  `[data-skin="zine-dark"]` token/CSS layer (the §2.2 isolation property holds — **no component
  logic / DOM / geometry change**), refreshes the screenshot baseline for the touched surfaces, and
  adds the two missing `zine-dark` capture cells named in §8. QA & Review verifies correctness +
  isolation; UX evaluates the built dark surfaces against this spec.

This is a **presentational** pass: every change is a token value or a scoped `[data-skin="zine-dark"]`
rule. **No copy, no microcopy, no DOM, no geometry, no behavior** changes (the skin invariants,
contract §2.2). Concrete hex/ratios are given so Dev never guesses.

---

## 1. Personas / stories served

Grounded in the committed skin personas (the **low-light reader**, the **dark-mode-default reader**,
the **owner/operator** — skin-system spec §1). This pass is about a single felt quality: *dark mode is
coherent — deliberate everywhere, never a half-broken light island.*

- **The low-light reader on `/about`.** *As a reader who toggled to dark and opened "How it works," I
  want the orientation page to read as a deliberate dark page — the explainer card legible, the
  projector graphic's lamp still reading as a lamp, the mini-preview's article title readable — not a
  scatter of black-on-near-black voids that look like the page failed to load.*
- **The low-light reader on the home page.** *As a dark-mode reader landing on the home page, I want
  the header to read as a clean, intentional "off" lockup — the same flat `wiki+` mark the rest of the
  app shows in dark — not a stray bright/golden projector beam pouring down a dark page.*
- **The low-light reader waiting for an article.** *As a dark-mode reader opening a Topic, I want the
  loading shimmer to feel like part of the dark page — a calm cool/neutral cue — not a warm golden
  daylight glow that belongs to the light theme, while I still clearly perceive that the page is
  loading (and with reduced motion, see a calm static cue instead of a sweep).*
- **The owner/operator (the load-bearing story, carried from #119).** *As the operator I want this
  fixed the way the skin system promised — entirely in the token/scoped-CSS layer, so it can never
  regress a feature or the light skin, and so the committed contract docs match what ships.* This pass
  is also a **fidelity correction**: it realizes commitments already in the docs (VI §6.4's "no
  dark-mode beam," the skin contract's "AA on both skins") that the build did not fully reach.

---

## 2. The half-dark root cause (why these surfaces break) — read before designing

The `zine-dark` skin re-points a set of **global** tokens (skin-system spec §4, globals.css ~1788).
Two of those re-points are the mechanism behind every defect in this issue:

- **`--color-content-white` is re-pointed to `#16161d`** under zine-dark (globals.css ~1832) — this
  is deliberate for the header (it flattens the burn-to-white illumination falloff to the dark page).
  But the `/about` centerpiece *art* reads `--color-content-white` directly for **pure-white**
  elements: the lit lamp "+" aperture (`Projector.tsx` ~185), the mini Topic-page background and its
  white clip/play-triangle/overview fills (`TopicMiniature.tsx`). Under dark, those "white" pixels
  silently become near-black `#16161d` → the lamp "+" and the article page both collapse into the dark
  field. This is the "black-on-dark void."
- **`.about-title-input` is hardcoded `color: #000`** (globals.css ~1387). On the light skin the mini
  page is white, so black title text reads. Once the mini page goes near-black (above), the title is
  black-on-near-black — unreadable. (The input never read a token; the §7.1 "exemption" was *declared*
  but the element was not actually insulated from the global re-points.)

So the committed §7.1 "centerpiece is exempt" is **not enforced in code** — the centerpiece reads
globally-re-pointed tokens and inherits the dark skin destructively. The fix is to (a) make the
centerpiece's *fixed art* genuinely independent of the global re-points so it stays its committed warm
selves, and (b) give the centerpiece's *chrome-like reading elements* (the title input) an intentional
dark treatment. This is the §7.1 reconciliation (§4 below).

The **home header** breaks for a different, structural reason (§3): the existing dark-skin beam-hide
rule is scoped to `.header-shared`, a class the home host does not carry.

---

## 3. Home page header projector — read clearly "off" in dark (no beam)

### 3.1 Decision + root cause

**Decision:** under `zine-dark`, the **home** header presents the **flat Tier-C lockup with no
descending beam, no lit-aperture glow, and no burn-to-white band** — the same "off" resolution VI §6.4
already commits for the dark skin, now actually reaching the home host. This is **realizing a committed
spec**, not new behavior (issue Notes; VI §6.4; skin-system spec §6).

**Root cause (confirmed in code):** the home header is `HomeSiteHeader` —
`<div className="relative bg-[var(--color-header-field)]"><HeaderProjector variant="projector" …></div>`
(SiteHeader.tsx ~308). It is **not** `header.header-shared` and is **not** scroll-aware
(`scrollAware = false`). Consequences:

- The existing dark-skin beam-hide rule
  `[data-skin="zine-dark"] .header-shared .projector-beamfade, … .projector-litlockup { display:none }`
  (globals.css ~1926) **cannot match the home host** — there is no `.header-shared` ancestor.
- On the non-scroll-aware home host, `HeaderProjector` renders the beam wrapper **with no class**
  (`className={scrollAware ? "projector-beamfade" : undefined}`, HeaderProjector.tsx ~806) and the lit
  lockup **with no class** (`scrollAware ? "projector-litlockup" : ""`, ~828). The `.projector-flatlockup`
  layer is **not rendered at all** on home (the flat slim card is a scroll-aware-host-only layer).

So on home in dark mode the full lit projector + descending beam render with **nothing to hide them**,
and there is no flat fallback layer to reveal. The dark-skin header treatment never reached this host.

### 3.2 What Dev must build (token/scoped-CSS only — no component change)

The home `variant="projector"` Tier-A render is built from these stable, *existing* hooks Dev can
target under `[data-skin="zine-dark"]` (these classes already exist in `HeaderProjector.tsx` —
no DOM change needed):

- `.header-projector .tier-a` — the Tier-A block (home + topic scroll-top both use it).
- `.header-projector .projector-band` — the band holding the two-temperature surface spans + beam.
- The beam wrapper and lit lockup on home are **unclassed** today. To target them without a DOM change,
  Dev scopes off the structural ancestors that *do* exist. The beam is the only `<svg>`-bearing
  descendant inside `.projector-band` that is not the lockup; the lit lockup is the `.projector-lockup-fit`
  wrapper. **Preferred, lowest-risk approach:** add a single dark-skin rule that hides the **beam +
  the lit-aperture glow on any home-host projector band**, keyed off the burn surfaces and the beam,
  using selectors that already resolve on the home DOM. Because the home host is the only
  `variant="projector"` that is *not* `.header-shared`, Dev can scope the rule as
  `[data-skin="zine-dark"] :not(.header-shared) > .header-projector …` / or, cleaner, target the
  `.tier-a` block's beam + lit-lockup descendants directly. Dev picks the exact selector; the
  **design requirement** is the rendered outcome below. (If reaching the home beam cleanly in CSS
  proves to require a class hook, adding a single presentational class to the existing beam/lit wrappers
  in `HeaderProjector.tsx` — with no logic/DOM-structure change — is acceptable as a *seam* change, the
  same category the skin contract permits for routing a literal to a token. Prefer the pure-CSS path;
  fall back to a class hook only if the selector is otherwise fragile.)

**Rendered outcome required under `[data-skin="zine-dark"]` on the home header:**

1. **No descending beam.** The geometric "+" beam (the `<Beam>` SVG and its gold border/glow) does not
   paint. (It currently does.)
2. **No lit-aperture glow.** The lamp's white-hot core, gold rim, and "+"-outline bleed do not paint —
   the wordmark presents as the **flat** indigo "+plus" lockup. On home today only the *lit* lockup is
   in the DOM; under dark it must read as the flat Tier-C lockup. Achieve this the way the rest of the
   dark skin already does the flat lockup: the indigo "+plus" block keeps `--color-accent-brand-fill`
   `#676EB4` with the white "+" (the committed AA-large exemption, contract §4.3/§6.1), and the serif
   "Wiki" uses the light wordmark ink via the existing `--wordmark-wiki-ink: #eceaf1` (globals.css
   ~1937 — already set on the skin scope; it themes for free). The lit-only decorative layers (aperture
   core/rim/bleed) are hidden.
3. **No burn-to-white band.** The band's burn-to-`--projector-burn-bg` surface and the cool fluorescent
   field already resolve to flat dark for free, because `zine-dark` re-points `--color-header-field`
   → `#1e1e27` and the burn-bg path; the home band is `bg-[var(--color-header-field)]` → `#1e1e27`. **Add
   the missing piece:** the home Tier-A beam's burn-bg fill span (`bg-[var(--projector-burn-bg)]`,
   HeaderProjector.tsx ~794) is hardcoded to `--projector-burn-bg` which is `#FFFFFF` and is **not**
   re-pointed by the skin. Under dark this paints a **white slab** below the burn line on the home
   header. Dev must re-point `--projector-burn-bg` to the flat dark band color
   (`--color-header-field` / `#1e1e27`) **under the zine-dark scope** so the home band is a single flat
   dark field with no white slab. (On the scroll-aware hosts the beam fades to opacity 0, so this slab
   is masked there; on home it is permanent and must be neutralized.)

> Net: the home dark header is a **flat dark band carrying the flat `wiki+` lockup**, identical in
> spirit to the Topic dark header's slim state — a color + layer-visibility change only.

### 3.3 States

The home host has **no scroll collapse and no loading state** — it is a single static Tier-A render.
So the only "state" is the rest state, in both auth conditions:

- **Logged-out / logged-in:** the `AuthControl` (right-anchored) themes for free via the plus-ink /
  link tokens already in the skin. No change needed beyond the header treatment above.
- **Hover / focus** on the wordmark home link: unchanged behavior; the focus ring is the dark
  `--color-focus-ring` `#9097d8` (≈6.0:1 on the dark band — contract §4.5), already in the skin.

### 3.4 Responsive — must read at every width

The Tier-A home lockup is left-anchored < md and centered ≥ md, and scales down on the smallest phones
(`.projector-lockup-fit`, globals.css ~257–274) — **all geometry unchanged**. Because the dark
treatment is purely "hide the beam + lit glow, flatten the band," the flat lockup reads identically at
every width:

- **Desktop (≥ md):** centered flat lockup on a flat dark band, no beam.
- **Tablet / narrow (< md):** left-anchored flat lockup + right auth on one row, no beam.
- **Smallest phones (< 480 / < 360):** the lockup-fit scale still applies (geometry invariant); the
  flat lockup + auth fit one row exactly as the light skin.

Acceptance: **no beam, no white slab, no orphaned gold glow at any width** in dark mode.

### 3.5 Accessibility

- The wordmark's accessible name stays `"wiki+"`; decorative layers stay `aria-hidden` (unchanged).
- Hiding the beam/aperture removes only **decorative** layers (they are already `aria-hidden`) — no
  information is lost (the gold beam is decorative-only, VI §7.3).
- Serif "Wiki" `#eceaf1` on the flat dark band `#1e1e27` ≈ **13.9:1** (AAA). White "+" on
  `#676EB4` stays the committed **AA-large** exemption (bold/large, contract §4.3).
- Focus ring `#9097d8` on `#1e1e27` ≈ **6.0:1** — a clearly visible keyboard cue.

### 3.6 Light skin unchanged (invariant)

The full Daylight Projector — lit aperture, descending beam, gold border, burn-to-white band — renders
**exactly as today** on the light home header. Every rule in §3.2 is scoped to
`[data-skin="zine-dark"]`; with no `data-skin` the `--projector-burn-bg` stays `#FFFFFF`, the beam and
lit lockup render, and the band burns to white. Zero light-skin pixels move.

---

## 4. `/about` — read well as a dark page (the §7.1 reconciliation)

### 4.1 The decision (records the resolved §7.1)

The committed skin contract §7.1 declared the `/about` centerpiece **"exempt"** from the dark skin
("fixed warm-theater art on a light/warm card, not re-themed"). The owner wants `/about` to **read well
in dark**. These are reconciled, not in conflict — and the most reasonable reading (stated, not asked):
**the owner wants `/about` to read well *as a dark page*.** `/about` is *already a dark page* on the
light skin — `.about-theater-field` is a near-black warm-theater radial (`#0a0915` → `#2c2a54`). The
problem is not that `/about` is too light; it is that the dark skin's *global* token re-points leak into
the centerpiece and corrupt its fixed art (§2). So the resolution is:

> **Narrow and *enforce* the exemption.** The centerpiece's **fixed warm-theater art stays exactly its
> committed self under both skins** (the warm-dark room, the projector body, the lit lamp, the lit
> miniature, the warm "How it works" card) — but this must be made **true in code** by insulating that
> art from the dark skin's global re-points, not merely asserted in a comment. The one centerpiece
> element that is a *reading control* rather than fixed art — the **mini-preview title input** — gets an
> intentional treatment so it stays legible. This keeps `/about` reading well as a dark page without
> redesigning the theater (which would be out of scope — issue "Scope check").

Precisely, classifying every touched centerpiece element as **fixed art (stays committed)** vs.
**chrome / reading control (re-theme/insulate)**:

| Element | Class | Dark-skin treatment |
|---|---|---|
| `.about-theater-field` (the warm-dark room) | fixed art | unchanged — reads `--color-theater-*`, not re-pointed; stays its committed near-black warm radial on both skins |
| Projector body / barrel / dial / vent (`Projector.tsx`) | fixed art | unchanged — reads `--color-indigo-*` / `--color-ink`, not re-pointed |
| The **lit lamp "+" aperture** + bloom + lamp glass | fixed art | **must stay pure white** — see §4.2 (today it collapses to `#16161d` because it reads the re-pointed `--color-content-white`) |
| The **off-state aperture "+"** (`.about-off-lens`) | fixed art | **must stay legible** as the designed dark-plus-by-geometry — see §4.2 |
| Mini Topic-page background, white clip/play/overview fills (`TopicMiniature.tsx`) | fixed art | **must stay their committed warm/white** — see §4.2 |
| Mini-preview **title input** (`.about-title-input`) | reading control (chrome-like) | **intentional dark-readable treatment** — see §4.3 |
| The **"How it works" card** (`.how-it-works-card`) | the page's one light/warm reading surface | **stays the deliberate warm-paper island** — see §4.4 (open-question 1 resolved) |

The principle: **`/about` reads well in dark by being a *correct* version of the warm-dark theater it
already is** — every pixel deliberate — rather than by inverting the theater into a charcoal page.

### 4.2 The aperture "+" + the fixed-art whites — keep the warm theater intact

**Decision:** the centerpiece's **fixed art is insulated from the dark skin's global re-points** so it
renders byte-identically on both skins. The art is *already* the right dark composition; the only defect
is that the dark skin's `--color-content-white → #16161d` re-point bleeds in.

**What Dev must build (scoped to `[data-skin="zine-dark"]`, inside or via the `.about-theater-field` /
centerpiece scope):**

1. **Re-assert the committed whites for the centerpiece art.** Within the centerpiece (scope off
   `.about-theater-field` and/or the about stage root), the elements that paint *intentional white* must
   resolve to true white again, not the dark page field. Two equivalent mechanisms — Dev picks the
   cleaner one:
   - **(preferred) Re-point `--color-content-white` back to `#ffffff` under the about-theater scope**
     (`[data-skin="zine-dark"] .about-theater-field { --color-content-white: #ffffff; }`), so every
     centerpiece element that reads it (the lit lamp "+", the mini page bg, the white clips/play
     triangles/overview blocks, the contents-card "+" glyph) returns to its committed value in one
     declaration. This mirrors how the skin already re-asserts the theater's accent *text* inside
     `.about-theater-field` (globals.css ~1882). It is the tightest fix and the strongest enforcement of
     the §7.1 exemption.
   - (alternative) re-point the specific centerpiece tokens individually — more rules, same effect; only
     choose this if the blanket `--color-content-white` re-point disturbs something else inside the
     theater (it should not, since the theater art is the only consumer there).
2. **The off-state aperture "+" needs no new value** once #1 holds — it reads `--color-aperture-off`
   `#2e2a52` / `--color-lens-off-interior` `#201c3a` / `--color-aperture-off-edge` `#433d72`, none of
   which the dark skin re-points. It already reads as the designed dark-plus-by-geometry. **But verify**
   the off-lens does not sit over a re-pointed surface; if any ancestor fill it composites against was
   re-pointed, the geometry contrast must still hold (the edge stroke `#433d72` on interior `#201c3a` is
   a faint-but-present geometric edge by design — VISUAL intent, not an AA text pairing). The issue's
   "white, not a black-on-dark void" is satisfied by #1 restoring the **lit** white "+" (the settled /
   reduced-motion rest state shows the lit lamp, not the off lens — `.about-off-lens` default opacity 0,
   globals.css ~1541).

**States (the aperture is animated):**

- **Settled / reduced-motion / no-JS rest:** the **lit** lamp shows — pure white "+" core + warm bloom
  (default `.about-lamp-light` opacity 1; `.about-off-lens` opacity 0). Must be pure white again (#1).
- **Warm-up intro (motion-enabled):** the off-lens cross-fades out as the lit lamp rises (existing
  keyframes, unchanged timing). The off "+" reads as the designed dark-plus-by-geometry throughout; the
  lit white "+" reads white at settle. Re-coloring is forbidden from changing any keyframe (invariant).
- **Power-off toggle (motion-enabled):** the lit lamp cross-fades to opacity 0 and the off lens to
  opacity 1 (globals.css ~1963) — the off "+" by-geometry shows. Unchanged behavior; only the underlying
  whites are corrected so the *lit* states read.

**Accessibility:** the whole projector SVG is `aria-hidden` / decorative (Projector.tsx ~22). The on/off
state reaches AT via the power control's accessible name, never color (AC9) — unchanged. No AA text
pairing applies to the aperture (it is decoration). The §4.2 fix is purely "stop the art going
black-on-black."

**Light skin unchanged:** `--color-content-white` is `#ffffff` on the light skin already; the §4.2
re-point is scoped to `[data-skin="zine-dark"] .about-theater-field`, so the light `/about` is
byte-identical. (And the light `/about` is itself a dark theater, so this changes nothing visible there.)

### 4.3 The mini Topic-preview title input — readable on the lit miniature

**Decision:** the `.about-title-input` is the **one reading control** in the centerpiece, and its title
must read as the serif article title on the **lit** (white) mini page. It must not be hardcoded `#000`
that depends on the page being white; it must read a token so it is correct on both skins and against
both the lit and dim miniature states.

**What Dev must build:** replace the input's hardcoded `color: #000` with the **article ink token used
for the centerpiece's article ground**. The mini page is the "Wikipedia article ground" — its serif
title should read as faithful article ink. On the light skin that is `#000`-class near-black on white;
the value Dev points it at must equal the *current* light output (the input reads as the same near-black
serif title it is today — zero light-skin change). Concretely: route `.about-title-input` `color` to a
centerpiece-scoped variable whose **light value = the current `#000`** (or the existing article/ink
token `--color-ink` `#2C2C2C` if Dev/QA confirm the 1-shade difference is imperceptible at the title
size — prefer an exact `#000`-preserving token to guarantee the light invariant). Then, because §4.2
restores the mini page to true white under dark, the title input on dark sits on **white** and stays
the near-black serif title — **legible on both skins with one token**.

> Rationale for *not* making the title light-on-dark: the mini page is the **lit Wikipedia article**
> (faithful white "ground" the projector lights up — the whole point of the centerpiece). Faithful
> article text on a lit white page is dark ink. Making the title light would falsify the "lit white
> article" read. So the correct dark-mode treatment is: keep the page white (§4.2) + keep the title
> dark ink (this section). The title reads because its ground is restored, not because the text inverts.

**States:**

- **Default (rest, lit page):** near-black serif title on the white mini page. Legible.
- **Hover (pointer):** the faint dotted underline hint (globals.css ~1390) — unchanged; it reads on the
  white page.
- **Focus-visible (keyboard):** the brand ring on `.about-title-block` (globals.css ~1395). On the light
  skin this is `--color-brand` `#676EB4`; under dark the ring should use the **dark focus token**
  `--color-focus-ring` `#9097d8` so it is a clear cue. Dev: route the `.about-title-block:has(... :focus-visible)`
  outline color to `--color-focus-ring` (whose light value already resolves to the brand indigo, so the
  light skin is unchanged) — this also harmonizes it with the rest of the app's focus ring. **(Verify the
  light value is the brand indigo so no light change occurs; if `--color-focus-ring` light ≠ `#676EB4`,
  keep the light brand explicitly and override only under the dark scope.)**
- **Dim / unlit miniature (motion off-state, `.about-mini-cool` overlaid):** the cool overlay multiplies
  over the mini page (existing). The title still sits on the (dimmed-but-still-light) page. No new value
  needed — the title token from §4.3 + the §4.2 white restore keep it the most-legible element; this is
  the same relationship as the light skin's dim state.

**Accessibility:** near-black serif title on white mini page ≈ **21:1** (AAA) on both skins (the page is
white under both via §4.2). The sr-only label + `aria-describedby` helper are unchanged (microcopy
invariant). The focus ring (`#9097d8` on the white-ish title block under dark) clears the visible-focus
requirement; on white it is the same brand ring as today.

**Light skin unchanged:** the title color token's light value = current `#000`; the focus ring's light
value = brand `#676EB4`. The light mini-preview is byte-identical.

### 4.4 The "How it works" card — OPEN QUESTION 1, RESOLVED

> **Open question (issue Notes):** dark surface card vs. a deliberately-warm "paper" card with
> corrected text contrast.

**Decision: keep it a deliberately-warm "paper" card — the one warm light surface catching the
projector's light — and verify/correct its text contrast (it does not need correction; it already
clears AA, and §4.2's insulation keeps it correct on dark).**

**Rationale:**

- The card is *designed* as "the only light surface on the dark theater" (HowItWorks.tsx header comment;
  globals.css ~1433) — "the warm zine card catching the projector's light." That is **load-bearing
  art**, exactly the kind §7.1 protects. Turning it into a dark `--surface-raised` card would *delete*
  the centerpiece's core metaphor (the projector throwing light onto a lit surface), which is precisely
  the "full theater redesign" the issue tells us to avoid.
- The card reads only `--color-card-warm` `#faf8f1`, `--color-ink` `#2C2C2C`, `--color-prose-warm`
  `#5f5a52`, `--color-violet`, `--color-brand`, `--color-gold-accent` — **none of which the dark skin
  re-points** (the violet/brand/sprout *text* lifts are already undone inside `.about-theater-field`,
  globals.css ~1882). So once §4.2 insulates the centerpiece, the card is **already correct on dark with
  no further work** — it stays the warm paper card it is on the light skin. This is the lowest-risk,
  most coherent outcome.

**The exact surface + text contrast pairings (state AA ratios), to verify on dark:**

| Element | Color | On surface | Ratio | Grade |
|---|---|---|---|---|
| Card surface | `--color-card-warm` `#faf8f1` | the theater field | (warm paper island — by design a light surface on the dark room) | — |
| Heading (`h2`) + step labels (`h3`) | `--color-ink` `#2C2C2C` | `#faf8f1` | ≈ **13.1:1** | AAA |
| Lead + step body prose | `--color-prose-warm` `#5f5a52` | `#faf8f1` | ≈ **6.4:1** | AA (AAA-large) |
| Eyebrow label | `--color-violet` `#5248AF` | `#faf8f1` | ≈ **6.8:1** | AA (AAA-large) |
| Step number glyph (`.bignum`) | `--color-brand` `#676EB4` | `#faf8f1` | ≈ **4.4:1** | AA-large only — **decorative** (`aria-hidden`); order is carried by the `<ol>`, not the glyph color (HowItWorks.tsx ~50) — so the sub-4.5:1 is acceptable for this decorative numeral exactly as on the light skin |
| Eyebrow rule (gold) | `--color-gold-accent` `#e5ab28` | `#faf8f1` | decorative accent only (VI §9.1) — never a signal, never the sole carrier | exempt |

All meaningful text clears AA; the only sub-AA pairing is the **decorative** step numeral, whose order
is carried semantically by the `<ol>` (not color) — identical to the light skin, so it is not a defect.

**The card's shadow on dark:** `.how-it-works-card` uses a warm outer glow + a dark drop (globals.css
~1443) — *not* the ink hardbox offset (which "ink on near-black does not read"). This is already
authored for the dark theater and is unchanged. **It must stay** — it is the "catching the light" read.

**States:** the card has a single rest state (a static reading card); no hover/focus/loading on the card
itself (its links/controls, if any, are standard). No per-state work.

**Light skin unchanged:** every token the card reads is byte-identical on the light skin; the card is
unchanged there (and the light `/about` is the same dark theater, so this is a no-op visually on light).

### 4.5 Responsive (`/about`)

Unchanged by this pass — the centerpiece's reflow (poster ≥ lg; card-first stacked < lg;
`about-landscape-tablet` height-aware variant) is geometry/layout owned by `Centerpiece` and is a skin
invariant. The dark fixes are color-only, so every breakpoint reads correctly:

- **≥ lg (poster):** warm card upper-left, projector lower-left, beam diagonal, lit white miniature
  right — all on the warm-dark room.
- **< lg (stacked):** warm card first, graphic below — same color correctness.
- The mini-preview title input is legible at every width (white ground + dark ink).

---

## 5. Article loading glow — OPEN QUESTION 2, RESOLVED

> **Open question (issue Notes):** suppress the `projector-scan` golden sweep entirely under
> `zine-dark`, vs. re-color it to a cool/neutral dark-appropriate sweep.

**Decision: re-color the sweep to a cool/neutral dark-appropriate band under `zine-dark` — do NOT
suppress it.** The loading cue stays a moving sweep (motion-enabled) and a static centered band
(reduced-motion), recolored from warm daylight gold to a cool light-ink wash that reads on the dark
article/plus skeletons.

**Rationale:**

- Suppressing the sweep entirely would leave the dark loading skeleton with *only* the `animate-pulse`
  shimmer — a weaker, more generic cue, and a visible *behavioral* divergence between skins (the light
  skin gets a projector sweep; the dark skin gets nothing). The skin contract's spirit is "every state
  exists identically, recolored through tokens" (§7) — re-coloring honors that; suppressing breaks it.
- The sweep's *meaning* is decorative anyway (the real "loading" signal is `aria-busy` + the
  `role="status"` text — globals.css ~1150, AC7), so re-coloring carries no information risk.
- A cool/neutral wash on the dark skeleton reads as "the page is illuminating into view" — consistent
  with the dark theme, where a warm gold daylight band would look like a light-theme artifact.

**What Dev must build (scoped to `[data-skin="zine-dark"]`, token/CSS only — keyframes & timing
unchanged):** re-color the `.projector-scan::before` gradient (and the `.projector-scan-plus::before`
variant) from the warm daylight golds (`rgb(238 206 135)` / `rgb(255 252 246)`, globals.css ~1176–1200)
to a **cool light-ink wash** built from the dark plus-ink, e.g.:

```
[data-skin="zine-dark"] .projector-scan::before {
  background: linear-gradient(100deg,
    transparent 0%,
    rgb(236 234 241 / 0.10) 28%,   /* --ink-plus at low alpha */
    rgb(236 234 241 / 0.18) 50%,   /* the band crest, brighter */
    rgb(236 234 241 / 0.10) 72%,
    transparent 100%);
}
[data-skin="zine-dark"] .projector-scan-plus::before { /* a touch stronger crest, e.g. 0.24 */ }
```

Dev MAY instead introduce a pair of skin tokens (`--scan-warm` / `--scan-crest`) the light skin sets to
the current golds and the dark skin re-points to the cool inks, then have the single gradient read the
tokens — this is the cleaner, contract-preferred mechanism (recolor via token, one gradient
declaration). The **alpha values are the design intent**: the crest must be visibly present over the
dark skeleton (`--surface-2` `#1e1e27` base) yet remain a *soft* sweep, not an opaque bar. The
`mix-blend-mode: screen` + `blur(8px)` stay (they are geometry/technique, not color) — note that
`screen` over a dark base *lightens*, so a light-ink wash brightens the skeleton as it passes, exactly
the desired "illuminating into view" read.

> No new gold, no functional brand gold — and on dark, no gold at all in the loading cue (consistent
> with the skin's "no gold as a signal," contract §8 / VI §7.3).

**States:**

- **Motion-enabled (default):** the cool band sweeps left→right via the unchanged
  `wikiplus-projector-scan` keyframe at the unchanged 1.8s timing (geometry/behavior invariant). It
  reads as a calm cool illumination passing over the dark skeleton.
- **Reduced-motion (`prefers-reduced-motion: reduce`):** the existing fallback (globals.css ~1328)
  makes the sweep a **static centered band** (`animation: none; left:50%; width:46%`). The dark
  re-color applies to this static band too (it inherits the recolored `::before` background), so the
  reduced-motion dark cue is a soft static cool glow across the skeleton's middle. **This must keep
  working — do not break the reduced-motion gate.** The `aria-busy` + `role="status"` announcement is
  identical regardless of motion or skin.

**Accessibility:**

- The loading *meaning* is carried by `aria-busy` + `role="status"` text — never by the sweep color
  (AC7) — so the recolor changes no information.
- `prefers-reduced-motion` is respected unchanged (the static-band fallback inherits the recolor).
- The cool wash is decorative (not a text/UI signal), so no AA text pairing applies; the requirement is
  perceptibility — the crest must be **visible** over the dark skeleton (the ≈0.18–0.24 screen-blended
  light-ink crest over `#1e1e27`/`#16161d` is clearly perceptible, satisfying "the loading cue still
  reads").

**Light skin unchanged:** the warm daylight gold sweep (and the `-plus` variant) render exactly as today
on the light skin — the recolor is scoped to `[data-skin="zine-dark"]` (or, with the token mechanism,
the light token values = the current golds). Zero light-skin change.

---

## 6. Cross-cutting invariants (apply to every surface above)

- **Skin isolation (contract §2.2).** Every change is a token value or a scoped
  `[data-skin="zine-dark"]` CSS rule. **No component logic, no DOM structure, no geometry, no copy, no
  behavior, no keyframe/timing change.** The one *seam-category* change permitted (and only if the pure
  CSS path for the home beam proves fragile, §3.2): adding a presentational class hook or routing a
  literal `#000` to a token — never a logic/structure change. QA's litmus test: a `git diff` should show
  CSS/token changes + at most literal→token utility swaps; no `.tsx` *logic* moved.
- **Light skin byte-unchanged.** Every rule is dark-scoped or token-light-value-preserving. UX will diff
  the light baseline gallery before/after and require **zero** light-skin visual change. Any light drift
  is a defect routed back to Dev.
- **Microcopy unchanged.** This is purely presentational — no label, helper, status text, or aria-label
  changes anywhere.
- **Never color alone.** No signal is converted to color-only: the loading cue keeps its `role="status"`
  text; the projector states keep their accessible-name routing; the card's step order stays in the
  `<ol>`. The dark skin introduces **no gold** as a signal on any of these surfaces.

---

## 7. What Development should build (checklist)

1. **Home header "off" (§3):** under `[data-skin="zine-dark"]`, on the **home** host (the non-`.header-shared`,
   non-scroll-aware `variant="projector"` render): hide the descending beam + the lit-aperture glow,
   present the flat indigo "+plus" + light-ink "Wiki" lockup, and **re-point `--projector-burn-bg` to the
   flat dark band color** so no white slab paints below the burn line. Prefer a pure scoped-CSS selector;
   fall back to a single presentational class hook on the existing beam/lit wrappers only if needed (no
   logic/DOM-structure change).
2. **`/about` centerpiece insulation (§4.2):** under `[data-skin="zine-dark"] .about-theater-field`,
   re-point `--color-content-white` back to `#ffffff` (preferred) so the lit lamp "+", the mini page
   background, and all white centerpiece fills render their committed white again. Confirm the
   off-state aperture "+" reads as designed (its tokens are not re-pointed — should need no change).
3. **`/about` title input (§4.3):** route `.about-title-input` `color` from hardcoded `#000` to a token
   whose light value = current `#000` (exact-preserving), so it stays near-black serif on the (now-white)
   mini page on both skins; route the `.about-title-block` focus-visible outline to `--color-focus-ring`
   (light value = brand indigo, so no light change).
4. **`/about` "How it works" card (§4.4):** **no code change** beyond #2's insulation — verify the card
   stays the warm paper island and its text pairings clear AA (table in §4.4). (If the card visibly
   inherits any dark re-point after #2, that is the defect to fix, scoped to the theater.)
5. **Article loading glow (§5):** under `[data-skin="zine-dark"]`, re-color `.projector-scan::before` +
   `.projector-scan-plus::before` from the warm golds to a cool light-ink wash (preferably via a pair of
   skin tokens the light skin sets to the current golds). Keep the keyframe, timing, `screen` blend,
   blur, and the reduced-motion static-band fallback unchanged.
6. **Screenshot baseline (§8):** add `skins: ["light", "zine-dark"]` to the `home-header` and
   `topic-loading` scenes in `e2e/screenshots/catalog.ts` (the two touched surfaces that lack a dark
   capture cell), then refresh the touched scenes' baseline (`home`, `home-header`, `about`,
   `topic-loading`) for both skins per CLAUDE.md gallery rules — `--scene home,home-header,about,topic-loading
   --commit ui` (a partial refresh; this is not a shared-token-wide change). If the session cannot run
   chromium (a cloud loop), defer the gallery refresh to a chromium-capable run / CI and flag the
   deferral in the PR.
7. **Tests (§8):** acceptance checks where practical — the home dark header does not render the beam
   layer (or renders the flat lockup) under `[data-skin="zine-dark"]`; `.about-title-input` carries a
   dark-skin-correct color (a token, not `#000`); the centerpiece's white tokens are restored under the
   theater scope; the loading sweep carries a dark-skin override.

---

## 8. What QA & UX should verify (mapped to the issue's "Done when")

| Issue "Done when" bullet | Verify |
|---|---|
| In zine-dark, the home header shows the projector clearly **off** — no descending beam — at every width. | Render the home page in `zine-dark` at mobile / tablet / desktop, logged-out + logged-in: **no descending beam, no lit-aperture glow, no white slab below the burn line**; the flat indigo "+plus" + light-ink "Wiki" lockup reads on a flat dark band. (Scene `home-header` + `home`, `zine-dark`.) |
| In zine-dark on `/about`: the aperture "+" is legible (not dark-on-dark). | Render `/about` in `zine-dark` (settled): the **lit lamp "+" is pure white** (not `#16161d`); during the warm-up the off-state "+" reads as the designed dark-plus-by-geometry. (Scene `about`, `zine-dark`.) |
| In zine-dark on `/about`: the mini Topic preview's title text is readable (not black on dark). | The mini page is **white** and the serif title is **near-black ink** (≈18:1) — legible at every width; hover/focus cues read. |
| In zine-dark on `/about`: the "How it works" card reads as an intentional card, not a jarring bright island. | The card is the **deliberate warm paper island** (its committed `#faf8f1` + warm glow), heading/prose/eyebrow clear the AA ratios in §4.4; nothing inherits a dark re-point. |
| In zine-dark, the article loading skeleton's glow no longer uses the warm daylight gold; the cue still reads AND respects `prefers-reduced-motion`. | Render `topic-loading` in `zine-dark`: the sweep is a **cool light-ink wash**, no gold; it is clearly perceptible over the dark skeleton; under `prefers-reduced-motion: reduce` it is the **static centered band** (no animation); `role="status"`/`aria-busy` unchanged. (Scene `topic-loading`, `zine-dark`.) |
| No light-skin regressions on any touched surface. | Diff the **light** baseline (`home`, `home-header`, `about`, `topic-loading`) before/after — **zero** change. The full Daylight Projector still renders on light home; the light `/about` warm theater is byte-identical; the light loading sweep is the warm gold. |
| `docs/VISUAL_IDENTITY.md` (+ skin contract) reflect the resolved `/about` decision; §7.1 no longer contradicts shipped behavior. | The skin contract §7.1 and VI §6.4/§7 state the **enforced** exemption (centerpiece art insulated; title input + loading cue treated) — no "exempt but actually broken" gap, no history cruft. |
| Screenshot baseline refreshed for the touched surfaces. | `home`, `home-header`, `about`, `topic-loading` re-rendered for both skins; `home-header` + `topic-loading` now carry a `zine-dark` cell. |

**Isolation (UX evaluates, distinct from QA correctness):** confirm the diff is token/scoped-CSS only —
no `.tsx` *logic* changed; the dark fixes live entirely in the skin layer; and the built dark `/about`
*feels* like a deliberate dark page (a coherent warm-dark theater with a legible lit miniature and a warm
explainer card), the home dark header *feels* like a clean "off" lockup, and the dark loading cue *feels*
like part of the dark page — not a half-broken light theme.
