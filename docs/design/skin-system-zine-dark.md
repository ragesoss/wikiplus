# Design spec: Skin system + zine dark skin

- **Status:** Design contract for build-loop (UX) — GitHub issue #119. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** Issue #119 — establish a skin system (a well-isolated layer) and prove it by
  shipping a second skin: a **zine dark** variant of the default light Indigo Press look, with a
  **dark-but-faithful** Wikipedia article side. The light zine stays the default and is visually
  unchanged.
- **Inputs read:** `docs/VISUAL_IDENTITY.md` (§4.2 wordmark golds, §6.4 dark mode, §7.2 contrast,
  §7.3 not-color-alone, §9.3 faithful article side, §10 hand-off); `docs/TOPIC_PAGE_DESIGN.md`
  (Indigo Press identity, hardbox language, the plus surfaces, the chip vocabulary);
  `app/globals.css` (the Tailwind v4 `@theme` token block + treatment classes + article-side
  styles + the `bg-white` leaks); `app/layout.tsx` (the `<html>` shell where the skin attribute
  mounts); `mockups/inline-neon-sync.html` (dark-skin *approach*, not its neon palette) and
  `mockups/inline-indigo-sync.html` (the committed light baseline).
- **Hand-off:** Development establishes the skin seam (the `[data-skin]` scoping + the
  `WIKIPLUS_SKIN` env/cookie switch in `app/layout.tsx`), routes every enumerated skinnable surface
  through tokens / treatment classes, and authors the **zine-dark** skin block. **No
  feature/component logic changes** — the only component-level work is replacing literal color
  utilities with token-backed classes (a refactor, not a behavior change). QA & Review verifies the
  isolation property + correctness; UX evaluates the built dark skin against this spec.
- **The light zine is the default and must be byte-for-byte visually unchanged** — see §10. The
  dark skin is purely **additive**.

This is a design contract for the **seam and the dark palette**, not a CSS authoring guide. Concrete
hex values are given so Dev never guesses; the *mechanism* (Tailwind `@theme` vs a scoped
`[data-skin="zine-dark"]` override block) is Dev's to implement within the references in the issue.

---

## 1. Personas / stories served

Grounded in the existing personas (the **reader** who lands on a Topic page; the **curator**; the
project **owner/operator**). A skin is chrome, not content, so the stories are about comfort,
context, and reach — never about changing what the product *says*.

- **The low-light reader.** *As a reader viewing wiki+ at night or in a dim room, I want a dark
  presentation of the same Topic page so the bright white article column does not glare, while the
  fact-vs-opinion signals and the curation context stay exactly as legible and exactly as labeled.*
- **The dark-mode-default reader.** *As a reader whose device/browser is set to dark, I want wiki+
  to be able to meet that preference without becoming a different product — the encyclopedia still
  reads as Wikipedia, the plus side still reads as the Indigo Press zine.*
- **The owner/operator (the real near-term driver).** *As the operator, I want to prove that "a
  skin" is a self-contained layer — so that adding, changing, or theming wiki+ later (a campaign
  skin, a partner skin, an eventual user-facing dark toggle) touches only the skin definition and
  can never regress a feature.* This is the load-bearing story for #119: **the seam is the
  deliverable; the dark skin is the proof.**

Non-goal (records the boundary): a user-facing in-app theme **toggle** is **not** in scope. The
switch is operator-level (`WIKIPLUS_SKIN` env/cookie) for now. The seam this spec defines is what
makes a future toggle a small additive change.

---

## 2. The skin contract (the heart of the spec)

A **skin** is a self-contained layer with exactly four responsibilities. Everything a skin is
allowed to change is a **token value** or a **treatment-class declaration**; a skin never changes
structure, geometry, or copy.

### 2.1 What a skin owns (skinnable)

A skin is the union of these four token/treatment groups. The default light skin is the values
already in `app/globals.css`; the zine-dark skin overrides them under its scope.

1. **The plus-side color token set** — the semantic color variables the plus (Indigo Press) chrome
   reads. After this issue these are *roles*, not raw brand hues, so a skin can re-point them:
   - surface tokens: `--surface` (the plus page/panel fill, light = `#FFFFFF`/`#F7F7F7`),
     `--surface-2` (recessed panel, light = `--color-bg2 #F0F1F3`), `--surface-raised` (the
     hardbox card fill, light = `#FFFFFF`).
   - border/offset tokens: `--hardbox-border` (light = `--color-ink #2C2C2C`), `--hardbox-offset`
     (the solid drop-shadow color, light = `--color-ink`).
   - plus ink: `--ink-plus` (see §3), `--ink-plus-2` (secondary), `--ink-plus-muted`.
   - accents: `--accent-brand`, `--accent-sprout`, `--accent-action`, `--accent-violet`,
     `--accent-red`, plus the chip-fill tokens (§4.4) and `--focus-ring`.
2. **The surface/border *treatment* classes** — the hardbox language. The *geometry* (2px border,
   4px/2px/6px offset, the dashed candidate outline) is **fixed**; only the **colors inside those
   treatments** are skinned. The treatment classes (`.plus-card`, `.hardbox-sm`, `.hardbox-lg`,
   `.active-glow`, `.candcard`, `.candsethead`, `.candthumb`, `.input`/`.field`) must read their
   fill / border / offset / hatch colors from tokens so a skin re-colors them without re-declaring
   the box metrics.
3. **The Wikipedia article-side palette** — the `.wiki-body` / `.sec` / `.wiki-*` surface, ink,
   links, tables, infoboxes, figures, citations (§5). This is its own token group
   (`--article-*`) precisely because article ink ≠ plus ink (§3) and the article side must stay
   *faithful* on whatever skin it sits in.
4. **The header treatment** — which wordmark tier the header presents and the band/seam colors
   (§6). Light = the lit Daylight Projector (burn-to-white). Zine-dark = the **flat Tier-C lockup**
   per §6.4.

### 2.2 What a skin must NEVER touch (the invariants)

A skin that changes any of the following is a defect. These are what make a skin *isolated*:

- **Geometry & dimensions.** Border widths, offset-shadow distances (4/2/6px), radii, the 320px
  infobox width, the 300px figure width, the `--topic-illum-falloff` distance, the
  `--projector-burn-y`/`--projector-cy-mid` band metrics, touch-target sizes, column widths,
  gutters, the 44px mobile toggle, scroll-offsets.
- **Layout & structure.** Grid/flex layout, breakpoints, DOM order, the two-world split, which
  element is where, the section-walk, focus order, the tab order.
- **Copy & microcopy.** All text, labels, chip wording, the "Scroll table →" hint, aria-labels, the
  text that carries every signal (§8). A skin re-colors a label; it never re-words one.
- **Behavior.** The scroll-linked header transition logic, the disclosure collapse, the
  pinned-player dock, animation *timing/keyframes* (a skin may re-color what animates, never
  re-time it), reduced-motion gating, forced-colors handling.
- **The chip *semantics*.** A skin may shift a chip's fill to stay AA on a dark band, but the
  accuracy/stance → color mapping (teal = accurate, action = caveat, red = opinion, indigo =
  stance) and the always-present text label are fixed by Curation/Editorial — not skinnable.

> **The litmus test for Dev and QA:** *adding or editing a skin must touch only the skin-definition
> layer (the token block + the scoped override + the header-tier selection) and never a `.tsx`
> file's logic.* The one allowed component change in *this* issue is mechanical: swapping a literal
> `bg-white` / `text-ink` / `border-ink` utility for a token-backed class so the seam can reach it.
> After #119, a third skin is a pure CSS/token addition.

---

## 3. The two ink roles (the seam's central split)

Today `--color-ink (#2C2C2C)` is overloaded: it is **both** the dark plus-side display ink **and**
the light Wikipedia article body text. It also doubles as the hardbox border/offset color. Because
it is one token, you cannot flip "ink" for a dark skin without simultaneously wrecking the article
body and the hardbox geometry color. The seam **must split ink into two independent roles**:

- **`--ink-plus`** — ink *on the plus side* (headings, body copy, labels on plus surfaces; and, as
  `--hardbox-border`/`--hardbox-offset`, the structural ink of the hardbox language).
  - Light skin: `#2C2C2C` on white/grey surfaces (unchanged).
  - Zine-dark skin: a light off-white ink on the dark plus surfaces, **and** the hardbox border /
    offset flips to a light "ink" so the hardbox still reads as a drawn box on a dark field (§4.2).
- **`--ink-article`** — ink *inside the `.wiki-body` / `.sec` article column only*. This is the
  faithful Wikipedia body text and is governed by §9.3's faithful-look rule, **independently** of
  the plus ink.
  - Light skin: `#2C2C2C` body / `#1B1B1B` headings (unchanged — faithful Wikipedia black).
  - Zine-dark skin: a faithful **dark-mode Wikipedia** ink (`#E8E6E3`-class off-white), per §5.

Dev's mechanical task: every plus-chrome `text-ink` becomes `--ink-plus`; every `.wiki-body`/`.sec`
ink reference becomes `--ink-article`; the hardbox border/offset color becomes
`--hardbox-border`/`--hardbox-offset` (which the light skin sets to `--ink-plus`, preserving exact
current output). The current `--color-ink` may remain as the light-skin *value* these roles point
at — the point is that the *roles* are now separately addressable.

---

## 4. The zine dark palette (plus side)

Derived from the Indigo Press palette, not from the neon mockup. The character is **a printed zine
under low light**: a deep near-neutral charcoal field (a hair cool/indigo-tinted, never pure black,
never the neon `#0b0b14`), the hardbox drawn in a light "ink," and the brand hues lifted just enough
to sing on dark while staying recognizably Indigo Press. All foreground/background pairings below
are AA-checked; ratios are stated.

### 4.1 Plus surfaces

| Token | Value | Role |
|---|---|---|
| `--surface` | `#16161D` | plus page field (the dark body background) |
| `--surface-2` | `#1E1E27` | recessed panels / secondary fills (the dark `--color-bg2`) |
| `--surface-raised` | `#22222C` | the **hardbox card fill** (`.plus-card`, modals, chip backdrop) |

Rationale: a slightly indigo-tinted charcoal (not `#000`) keeps the "zine" warmth and avoids the
harsh OLED-black/neon feel the issue explicitly rejects. Raised surfaces step *up* in lightness
(card lighter than page) — the inverse of the light skin (card white, page grey) but the same
depth logic.

### 4.2 Hardbox ink (border + offset) on dark

The light skin draws the hardbox with `#2C2C2C` ink on white. On dark, a near-black border/offset
vanishes. The hardbox "ink" flips to a light drawn line:

| Token | Value | Role |
|---|---|---|
| `--ink-plus` | `#ECEAF1` | plus body/heading ink, on `--surface`/`--surface-raised` |
| `--ink-plus-2` | `#C5C3CE` | secondary plus ink |
| `--ink-plus-muted` | `#9A98A6` | muted plus ink (timestamps, `context by …` lead-ins) |
| `--hardbox-border` | `#ECEAF1` | the 2px box border (now a light line) |
| `--hardbox-offset` | `#000000` at ~55% on dark, i.e. `#000000` solid reads too heavy — use `#0B0B10` | the solid offset shadow |

The offset shadow on a dark skin is the *opposite* problem from the border: a light offset would
glow oddly, a pure-black offset disappears into the field. Use a **near-black, slightly darker than
the page** (`#0B0B10`) so the hardbox still reads as a lifted, drawn block (the page sits at
`#16161D`; the offset is a touch darker). The **box metrics are unchanged** (2px border, 4/2/6px
offset).

Contrast (AA):
- `--ink-plus #ECEAF1` on `--surface-raised #22222C` ≈ **13.0:1** (AAA) — body text on cards.
- `--ink-plus #ECEAF1` on `--surface #16161D` ≈ **15.0:1** (AAA) — body text on the page field.
- `--ink-plus-2 #C5C3CE` on `--surface-raised #22222C` ≈ **9.0:1** (AAA).
- `--ink-plus-muted #9A98A6` on `--surface-raised #22222C` ≈ **5.6:1** (AA, normal text) — muted
  text still clears the 4.5:1 bar (it is not "decorative").

### 4.3 Accents (lifted Indigo Press hues)

The light brand hues (`#676EB4`, `#2A8270`, `#1F6F95`) are tuned for *dark text/elements on light*.
On a dark field they are used both as accent fills (with light text on them) and as accent text/glyphs
(on the dark surface). Two jobs need two checks. The dark skin lifts the hues slightly for legibility
as text-on-dark while keeping the indigo/teal/blue identity:

| Token | Value | Notes |
|---|---|---|
| `--accent-brand` | `#9097D8` | lifted indigo — the brand accent as **text/glyph on dark** |
| `--accent-brand-fill` | `#676EB4` | the indigo **fill** (active-glow, stance chip) keeps the brand hex; white text sits on it (the AA-large exemption, §7.2, holds exactly as today) |
| `--accent-sprout` | `#3FB39A` | lifted teal — link-glyph / accurate accent as text on dark |
| `--accent-action` | `#4FA6CE` | lifted action blue as text/glyph on dark |
| `--accent-violet` | `#7E76C9` | lifted deep-violet |
| `--accent-red` | `#E0696E` | lifted AA-safe red as text on dark |

Contrast (AA, text/glyph on dark surfaces):
- `--accent-brand #9097D8` on `--surface #16161D` ≈ **6.0:1** (AA) — indigo affordance text.
- `--accent-sprout #3FB39A` on `--surface #16161D` ≈ **6.6:1** (AA) — the chrome link-green analog.
- `--accent-action #4FA6CE` on `--surface #16161D` ≈ **6.9:1** (AA).
- `--accent-red #E0696E` on `--surface #16161D` ≈ **5.5:1** (AA).
- White `#FFFFFF` on `--accent-brand-fill #676EB4` — VI §7.2 commits this pairing as **≈ 3.9:1,
  AA-large only** (the same fill/weight relationship the light `.plus-card` heads and the wordmark
  `+plus` already use). This spec defers to that committed figure: treat it as AA-large and **keep
  chip/CTA text on indigo bold and ≥ the large threshold**, or darken toward `--accent-violet` for
  small text — identical to the light-skin rule. (Because the dark skin reuses the **exact** indigo
  fill, this is the existing, already-accepted exemption, not a new one.)

### 4.4 Chips (the fact-vs-opinion signal) on dark

Chips are **text-labeled, never color-alone** (§8) and the accuracy/stance→hue mapping is fixed by
Curation/Editorial. On the dark skin the chip stays the same *mapping* and the same *label*; only the
fill/text are tuned for AA on the dark band. Two viable patterns — Dev picks one and applies it
uniformly:

- **A (recommended): outlined chip.** Transparent/`--surface-2` fill, a 1px accent-colored border,
  accent-colored text. Reads as ink-on-paper, matches the zine character, and each accent above
  already clears AA as text on `--surface`/`--surface-2`. Example: accurate chip = `--accent-sprout`
  text + border on `--surface-2` (≈ 6.3:1).
- **B: solid chip (matches light skin's solid fills).** Keep solid fills but use AA-darkened fills
  with white text. Because white-on-color must clear 4.5:1 for the small chip text, the fills must be
  the *darker* brand variants (`--color-violet #5248AF` for stance ≈ 8.0:1 white-on-fill; teal-dk
  `#1F6757` for accurate ≈ 6.5:1; action `#1F6F95` ≈ 5.9:1; `--color-accred #B0353B` for opinion ≈
  6.4:1). This mirrors `TOPIC_PAGE_DESIGN.md`'s note that chips carry their own AA-safe fills so the
  indigo band never touches chip text.

Either way: the chip **text label is always present** and the **shape/label** carries the signal, so
the color shift between skins changes nothing about meaning (§8).

### 4.5 Focus ring

| Token | Value | Notes |
|---|---|---|
| `--focus-ring` | `#9097D8` (the lifted brand indigo) | the global `:focus-visible` 3px outline |

On dark, the light skin's `#676EB4` focus ring is muddy against `--surface`. The lifted
`--accent-brand #9097D8` ring on `--surface #16161D` ≈ 6.0:1 — a clearly visible keyboard cue
(WCAG 2.4.13 focus-appearance is comfortably met by the 3px/offset-2px ring already in globals).
The surface-adaptive `.auth-account-trigger` and `.search-field` cues use `currentColor` already, so
they adapt to the dark ink for free.

---

## 5. The dark Wikipedia article side (dark-but-faithful)

Governing rule (VI §9.3): **the article column reads as Wikipedia.** On the dark skin it must read
as **Wikipedia's own dark mode** — faithful to MediaWiki's dark theme character, not as the Indigo
Press zine inverted. No Indigo Press bleed into the article column on either skin; the only indigo in
the article column stays the scroll-sync/active-pairing accent (which uses `--accent-brand` and
themes for free).

These are a distinct token group (`--article-*`) so the article palette is governed independently of
the plus palette. Values track MediaWiki's Vector dark-mode palette (a familiar "faithful dark"
reference):

| Surface | Token | Value | Contrast / note |
|---|---|---|---|
| article page field | `--article-bg` | `#101418` | the faithful dark article background |
| body ink | `--ink-article` | `#E8E6E3` | body text on `--article-bg` ≈ **14.6:1** (AAA) |
| headings | `--article-ink-strong` | `#F8F9FA` | serif headings; on `--article-bg` ≈ **17:1** |
| heading hairline | `--article-rule` | `#54595D` | the `h2` bottom hairline (faithful grey, dimmed) |
| wikilink (blue) | `--article-link` | `#6EA8FF` | faithful Wikipedia link blue, dark-mode value; on `--article-bg` ≈ **7.0:1** (AA) |
| visited link (if surfaced) | `--article-link-visited` | `#B197FC` | dark-mode visited violet ≈ 6.8:1 |
| table border | `--article-table-border` | `#54595D` | the 1px cell rule (faithful grey) |
| table header fill | `--article-th-bg` | `#27292D` | Wikipedia's dark table-header grey (not indigo); `--ink-article` on it ≈ 11:1 |
| table cell fill | `--article-td-bg` | `#16191D` | a hair above the page so the grid reads |
| infobox / figure frame fill | `--article-box-bg` | `#1B1F23` | the `#f8f9fa` analog (the figure/infobox/citation-popover background) |
| infobox banner fill | `--article-banner-bg` | `#27292D` | the `#eaecf0` header-grey analog (the centered taxobox/infobox band) |
| caption / credit ink | `--article-ink-muted` | `#A2A9B1` | figure captions, infobox sub-rows; on `--article-box-bg #1B1F23` ≈ 6.5:1 (AA) |
| citation target flash | `--article-target-flash` | `#3A3320` | the dark analog of `#fdf3d8` (a dim warm flash, not the light yellow) |
| citation popover border | `--article-rule` | `#54595D` | the neutral 1px popover border |

Notes:
- **Citations** stay the faithful superscript bracketed wikilink — `--article-link` blue on
  `--article-bg`, brackets are literal text (color is never the sole signal — A7 holds).
- **The citation popover** (`.wiki-cite-popover`) is our control surface but reads as part of the
  page: `--article-box-bg` fill, `--article-rule` border, a heavier dark drop-shadow
  (`rgba(0,0,0,0.55)`), the focus ring is the shared `--focus-ring`.
- **The per-taxon recovered infobox band colors** (the inline-style subset, #106): on dark these
  recovered light pastel band colors would glare and clash. **Decision:** on the dark skin, the
  *recovered* inline band background is **suppressed/neutralized to `--article-banner-bg`** and the
  band relies on its structural signal (centered/bold/hairline) — which already carries the band in
  greyscale "regardless of color" per the existing globals comment. This keeps the dark article
  legible and faithful to MediaWiki dark mode (which likewise neutralizes biota band colors). State
  for Dev: the recovered-color path is gated to the light skin; the dark skin uses the grey band
  default. (The structural meaning is preserved; only the decorative recovered hue is dropped.)

### 5.1 Article media — the explicit decision

**Media is left FAITHFUL; only chrome is themed.** Diagrams, charts, photos, and PNG/SVG figures
sourced from Commons frequently assume a light/white background (line diagrams on transparent or
white, scanned plates, charts with white plot areas). Theming or filter-inverting them would
**falsify the encyclopedia's content** and break diagrams. Therefore:

- **Themed (chrome):** the figure frame fill (`--article-box-bg`), the figure border
  (`--article-table-border`), the caption/credit ink (`--article-ink-muted`), the infobox frame.
- **Faithful (untouched):** the `<img>`/media itself. No CSS filter, no invert, no
  background-injection on article images.
- The figure frame fill is the *one* deliberate nuance: a light-background diagram sitting in a dark
  `--article-box-bg` frame gets a subtle visible edge (the frame is darker than a white diagram),
  which reads as "an image pasted into a dark page" — exactly the faithful MediaWiki-dark behavior,
  not a defect. Do **not** add a white mat behind media to "fix" this; faithful means faithful.

---

## 6. The dark header treatment (flat Tier-C) and the §6.4 resolution

Per VI §6.4, the burn-to-white Daylight Projector **does not translate** to a dark field — you cannot
"overexpose to white" on dark without inverting the whole concept (a true dark-theater inversion is an
explicit future task, out of scope here). So:

- **The zine-dark skin uses the FLAT Tier-C lockup at every scroll state.** That is: the serif
  "Wiki" + the bordered indigo "+plus" block — no lit aperture, no beam, no burn-to-white band, no
  scroll-linked glow fade.
- **This resolves §6.4/§10 for this skin** as follows: §6.4's *recommended direction* ("dark mode
  keeps the flat lockup; does not attempt the burn-to-white projector") is now the **committed
  behavior for the zine-dark skin**. The §10 open question ("confirm no dark-mode projector; flat
  lockup only — for now") is answered **yes** for zine-dark. A true dark-theater spotlight inversion
  remains a future task and is explicitly **not** built here.

### 6.1 Dark header treatment, concretely

The header host (`SiteHeader` + `HeaderProjector`) is the app's one header (CLAUDE.md universal-header
rule). The skin changes only the **treatment**, never the host or the geometry:

- **Wordmark:** the existing flat Tier-C card (`.projector-flatlockup`) — which is already always in
  the DOM, focusable, and is the interactive `wiki+` → `/` link. On the dark skin it is the **only**
  wordmark layer; the lit/beam layers (`.projector-litlockup`, `.projector-beamfade`) are **hidden**
  (`display:none`) under the skin scope — the same mechanism already used for `forced-colors: active`.
  So the dark-header path reuses a proven code path; no new header logic.
  - The "+plus" block keeps `--accent-brand-fill #676EB4` with white "+", bold/large (AA-large, §4.3).
  - The serif "Wiki" uses `--ink-plus #ECEAF1` (light ink on the dark band) — analogous to the light
    skin's `#1b1b1b` "Wiki" on the cool field.
- **Header band:** flat `--surface-2 #1E1E27` (no white burn, no cool fluorescent field). No
  illumination falloff into the page — the `.topic-illum` / `.beam-page-illum` white→grey gradient is
  a **light-skin treatment**; on the dark skin the band meets the page at a flat `--surface` field
  (the gradient resolves to flat dark, so the page top is simply `--surface`). The band metrics
  (`--projector-burn-y` height, the slim-bar collapse, the 56px slim row) are **unchanged** — the
  band still collapses on scroll exactly as today; only its *colors* change and the *beam glow has
  nothing to fade* (the flat card is already opacity-1).
- **Bottom rule:** the 2px chrome rule uses `--hardbox-border #ECEAF1` (a light rule on the dark band)
  at the same `--border-opacity` schedule — it fades in on scroll exactly as today.
- **Search field + auth:** the in-chrome `--color-link` green affordance becomes `--accent-sprout`;
  the search field border/focus uses `--hardbox-border` / `--focus-ring`; the auth trigger's
  `currentColor`-based ring adapts for free.

Because the flat Tier-C path is already the forced-colors and the always-present-card path, the dark
header is a **color + layer-visibility** change only — no change to the scroll-transition behavior,
the `p` progress var, or focus order (the §2.2 invariants hold).

---

## 7. States and responsive behavior

The skin is orthogonal to state and to breakpoint: **every state and every breakpoint that exists in
the light skin exists identically in the dark skin**, recolored through tokens. The light skin's
states/responsive behavior are unchanged. For the dark skin, each surface's states map as:

### 7.1 Per-surface states (dark skin)

- **Topic page — populated.** Plus rail cards = `--surface-raised` with the light-ink hardbox; the
  curation block's indigo band keeps `--accent-brand-fill` with white text + AA-safe chips; the
  article column = the §5 dark-faithful palette. Active-pairing highlight uses `--accent-brand`.
- **Topic page — empty (no curated clips).** The empty-state hardbox/candidate language
  (`.candcard` dashed outline, `.candsethead`) uses `--hardbox-border` (light dashed line on dark),
  `--surface-raised` fill, and the candidate hatch (`.candthumb`) recolors its
  `rgba(44,44,44,…)` stripes to a light-ink stripe (`rgba(236,234,241,0.10)`) so the hatch reads on
  dark. The "unvetted set" header copy is unchanged.
- **Loading.** `.skeleton-bar` / `.animate-pulse` use `--surface-2` as the shimmer base (instead of
  `--color-bg2` light grey); the shimmer keyframe/timing is unchanged (geometry/behavior invariant).
- **Error / not-found.** `ArticleNotFound` and error surfaces use `--surface`/`--ink-plus`; any
  `bg-white` panels there route through `--surface-raised`. Copy unchanged.
- **Modals** (`AddModal`, `DeleteConfirmDialog`, `RemoveConfirmDialog`, the curate form): the modal
  card = `--surface-raised`, the scrim stays a dark translucent overlay (it already is), form fields
  (`.input`/`.field`) = `--surface-2` fill + `--hardbox-border` border + `--focus-ring`. The
  stance/accuracy selectors keep the §4.4 chip treatment. No layout/field-order change.
- **Pinned / mobile player dock** (`MobilePlayerDock`, `PinnedPlayer`): the dock chrome = the plus
  surfaces; the embedded video is faithful (it is third-party content, like article media). The
  dock-in animation is recolored-only, timing unchanged.
- **Standalone pages** `/contribute`, `/contributor` (profiles), `/about/data`: each currently has
  literal `bg-white`/`text-ink` surfaces — they route through `--surface*`/`--ink-plus` and adopt
  `SiteHeader` if they have not (the universal-header rule). **`/about`** (the projector theater
  centerpiece) is a special case: it is an *intentional dark warm-theater illustration already*,
  with its own committed `--color-theater-*` palette. **Decision:** `/about`'s centerpiece scene is
  **exempt** from the skin (it is fixed art, not chrome); only its surrounding page chrome/header
  follows the skin. State this so Dev does not re-theme the warm-up animation.

### 7.2 Responsive (mobile / tablet / desktop)

Unchanged by skin — the skin carries no breakpoints. Every responsive behavior already specified
(the `< lg` infobox/table stacking, the `< md` mobile article disclosure + 16px reading scale, the
one-row header at every width, the mobile search reveal) holds identically; the dark skin only
supplies the colors those same elements paint with. Specifically: the `< md` chevron and mobile
heading already use `currentColor`/the article ink token (per the issue-#121 globals comment that
anticipated #119), so they theme for free.

---

## 8. Accessibility (carried into the dark skin)

AA is baseline on **both** skins — the dark skin is not exempt because it is "the alternate."

- **Text contrast.** Every plus-ink/surface and article-ink/surface pairing above is AA-or-better;
  ratios are stated inline (§4.2, §4.3, §5). Body text clears AAA on both skins; muted text clears AA
  (4.5:1) — muted is dimmed, never below the bar.
- **Accents & links.** Every accent used as text/glyph (§4.3) and every article link (§5) clears AA
  on its surface. White-on-indigo stays AA-large only and is held to the bold/large rule exactly as
  the light skin — never used for small body text.
- **Focus.** The `--focus-ring` (3px, offset 2px) clears the visible-focus and focus-appearance
  requirements on the dark field (≈6.0:1). The surface-adaptive auth/search cues adapt via
  `currentColor`.
- **Never color alone — explicitly preserved on dark.** Every signal that is text-labeled on the
  light skin stays text-labeled on dark: the fact-vs-opinion chips (label + shape, §4.4), the held
  marking, the "Scroll table →" hint, the disclosure state (chevron *rotation*, not color), the
  candidate state (dashed border + hatch *texture*, not just color). The dark skin recolors these;
  it never converts a labeled signal into a color-only one. The wordmark gold rule (VI §7.3 — gold
  is decorative, never a functional state) holds; the dark skin introduces **no gold** as a signal.
- **Forced-colors / high-contrast.** Unchanged — the existing `forced-colors: active` handling
  (flat Tier-C lockup, drop the beam) already governs regardless of skin; the dark skin sits *under*
  the forced-colors override, not in conflict with it.
- **Reduced motion.** Unchanged — the skin re-colors animated elements but never re-times them; all
  existing `prefers-reduced-motion` gates apply identically.

---

## 9. The light zine is unchanged (additive-only)

This is a hard acceptance condition, not a courtesy:

- The default skin's rendered output must be **identical** to today. The seam is introduced by
  (a) splitting `--color-ink` into the `--ink-plus` / `--ink-article` / `--hardbox-*` roles whose
  **light-skin values resolve to the exact current hexes**, and (b) replacing literal color
  utilities with token-backed equivalents whose **light-skin token equals the literal it replaced**
  (`bg-white` → `bg-[--surface-raised]` where `--surface-raised` = `#FFFFFF`, etc.).
- No light-skin pixel moves. UX's evaluation will diff the **light** baseline gallery
  (`docs/design/ui-screenshots/`) before/after the seam refactor and require **zero** visual change
  on the default skin. Any light-skin drift is a defect routed back to Dev.
- The dark skin is reached only when `WIKIPLUS_SKIN` (env/cookie) selects it; with it unset, wiki+ is
  the light Indigo Press zine, exactly as shipped.

---

## 10. What Development should build

1. **The seam in `app/layout.tsx`.** Read `WIKIPLUS_SKIN` (env, overridable by a cookie per the
   issue's referenced spike) and set `data-skin="<skin>"` on `<html>` (default = light, where the
   attribute may be absent or `"zine"`). This is the only switch.
2. **Tokenize the seam.** Split `--color-ink` into `--ink-plus` / `--ink-article` /
   `--hardbox-border` / `--hardbox-offset`; introduce the `--surface*`, `--accent-*`, chip-fill,
   `--focus-ring`, and `--article-*` role tokens. Light-skin values **= current output** (§9).
3. **Route the leaks through tokens** — every enumerated skinnable surface, with **no component
   logic change**: the ~43 `bg-white` literals (the 21 files in §"Known leaks"), the standalone pages
   `/contribute`, `/contributor`, `/about/data`, the chips (§4.4), the modals, and the article-side
   palette (§5). Replace literal `bg-white` / `text-ink` / `border-ink` utilities with the
   token-backed classes; route `.plus-card`/`.hardbox-*`/`.candcard`/`.candsethead`/`.candthumb`/
   `.input`/`.field` fills, borders, offsets, and hatch through the new tokens.
4. **Author the `[data-skin="zine-dark"]` override block** — the §4 plus palette, the §5 article
   palette, the §4.4 chips, §4.5 focus ring, and the §6 header (hide the lit/beam layers, flat band
   colors, the `.topic-illum`/`.beam-page-illum` resolving to flat `--surface`). Exempt the `/about`
   centerpiece scene (§7.1).
5. **Refresh the screenshot baseline.** This is a broad/shared change → run a **full refresh**
   (`scripts/dev/shots.sh --all --commit ui`) so the light baseline is re-verified unchanged; add a
   **zine-dark capture path** (a `WIKIPLUS_SKIN=zine-dark` pass / a `data-skin` scene variant in
   `e2e/screenshots/catalog.ts`) so the dark skin is captured and indexed automatically.

## 11. What UX will evaluate (after Dev)

- **Isolation property.** Confirm the dark skin lives entirely in the token/override layer — spot
  that no `.tsx` *logic* changed (only literal→token utility swaps). If a component's behavior had to
  change to theme it, that is a seam defect.
- **Light skin unchanged.** Diff the light baseline gallery before/after — zero visual change.
- **Dark skin fidelity & feel.** Against §4–§6: the plus side reads as the Indigo Press zine under
  low light (not neon, not flat black); the article side reads as **faithful Wikipedia dark mode**
  (not an inverted zine, media untouched); the header is the flat Tier-C lockup with no orphaned beam
  artifacts at any scroll position; every state (populated/empty/loading/error/modal) and breakpoint
  (mobile/tablet/desktop, logged-out/logged-in) renders correctly via the standard screenshot matrix.
- **Accessibility-in-practice.** Re-check the stated contrast ratios on the built dark surfaces;
  keyboard-tab the dark Topic page and confirm the focus ring is visible everywhere; confirm every
  signal is still text-labeled (chips, held marking, disclosure, candidate state) on dark.
- Design defects route back to **Development**; a pass signals the build-loop forward.
