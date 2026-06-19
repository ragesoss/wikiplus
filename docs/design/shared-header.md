# Design spec: the shared "Daylight Projector" header across Home + Topic — seam-on-divider, scroll-aware beam

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written
**before** implementation) · **Issue:** [#72](https://github.com/ragesoss/wikiplus/issues/72) ·
**Phase:** prototype
**Builds on the contract:** [`docs/specs/shared-header.md`](../specs/shared-header.md) (Product
spec, AC1–AC15 + the four resolved decisions a–d + assumptions A1–A5)
**Extends:** [`docs/design/landing-page.md`](landing-page.md) (#15/#61 — the first `HeaderProjector`
build at Tier A; this spec **reuses** that component and its geometry props, adding a second,
*driven* configuration for Topic) and [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) §2.2
(the seam *is* the split), §6.0 (align the internal seam to the column divider), §6.2/§6.3 (tiers),
§9.2/§9.3.
**Inherits (not re-specified here):** [`docs/design/navbar-topic-search.md`](navbar-topic-search.md)
(`TopicSearch` states S0–S8, microcopy, the APG combobox a11y model) and the issue-C `AuthControl`
spec (the three skins, the no-flash loading chip, both session states).
**Hands off to:** Development (build the one shared header) → QA & Review verifies AC1–AC15 → UX
re-evaluates the built header against `VISUAL_IDENTITY.md` §10.3 + this spec.

> **What this spec is.** The buildable contract for **one** header used by both `app/page.tsx`
> (Home) and the Topic view: who it serves, the unified anatomy, the **exact seam-to-divider pixel**
> at ≥ lg, the **Tier-A and slim-sticky compositions** + the scroll transition (threshold, fade,
> reduced-motion), **every state** (logged-out/in × scroll-top/scrolled × ≥ lg / md–lg / < md ×
> search collapsed/revealed, plus the < lg stacked layout), microcopy, and the accessibility model.
> It resolves the spec's assumption flags **A3** (variant gap) and **A4** (slim-state title cue).

---

## 0. Summary of the load-bearing decisions (read this first)

The numbers and calls Dev must build to — each is justified in the section cited.

| Decision | Call | Where |
|---|---|---|
| **The "divider" pixel (≥ lg)** | The **gutter centre** — the midpoint of the `gap-7` (28px) channel between the `1fr` article column and the `360px` rail. The lockup's **visual seam** (where "Wiki" ends / the indigo block begins) lands on it (±4px, AC2). | §3 |
| **Tier-A Topic header height** (`burnY`) | **`116px`** band (cool field → burn boundary), with the wordmark row at **`cyMid = 40px`**. Shorter than the landing's 130 — Topic is a sticky chrome bar, not a hero. | §4.1 |
| **Slim-bar height** | **`56px`** (the flat Tier-C lockup row). | §4.2 |
| **Scroll threshold** | Collapse when `scrollY > burnY` (**≈116px**), restore when `scrollY < burnY − 40` (**≈76px**) — a **40px hysteresis** band so it never flickers on a pixel boundary (AC11). | §4.3 |
| **A4 — slim-state title cue** | **YES — add a muted article-title cue, slim state only.** Justified in §4.4. It appears *only* in the collapsed bar (where the article `<h1>` has scrolled away), never at Tier A. |
| **A3 — variant gap** | **No new variant needed.** `TopicSearch` (`topic-inline` / `topic-disclosure`) and `AuthControl` (`topic-compact`) cover every state. One **placement caveat** for the logged-out compact control is flagged to Dev (§5.5), not a new variant. |

---

## 1. Personas & user stories

The header serves three people. Every layout decision below traces to one of these stories.

### 1.1 Rosa — the reader on a Topic page (primary)

Landed on a Topic page (from the landing search, a wikilink, or a shared URL). She is here to
*read*, and the header has to tell her — at a glance, without a caption — what the two columns are.

- **R1.** *As a reader, I want the wordmark to sit across the boundary between the encyclopedia and
  the curation layer, so the mark itself tells me "Wikipedia here, wiki+ there" by where it sits.*
  → §3 seam-on-divider (AC2).
- **R2.** *As a reader on any page, I want to click the wordmark to get home,* so the logo behaves
  like every other site's logo. → §2 / AC3.
- **R3.** *As a reader scrolling a long article, I don't want a tall header eating my screen — but I
  still want the wordmark, search, and login within reach.* → §4.2/§4.3 the slim sticky bar (AC4).
- **R4.** *As a reader deep in a long article, I want a quiet reminder of which article I'm in* once
  its title has scrolled off. → §4.4 the slim-state title cue (A4).

### 1.2 Cory — the curator who must be able to log in everywhere (primary)

Cory wants to contribute. The login control is his on-ramp, and it has failed before by being
**duplicated** (two code paths) and by **disappearing at some widths**. He needs it reachable at
*every* breakpoint and in *both* scroll states.

- **C1.** *As a curator, I want to find and operate the login/account control at every screen size —
  phone, tablet, desktop — and whether or not I've scrolled,* so I'm never stuck unable to sign in.
  → §5 every state (AC8/AC9); §4.2 auth persists into the slim bar.
- **C2.** *As a signed-in curator on a phone, I want a compact identity (my initial) that doesn't
  shove the wordmark or search off-screen.* → §5.4/§5.5 (AC8).

### 1.3 Pat — navigating home via the wordmark (secondary, both hosts)

Pat is anywhere in the product and wants the front door. The wordmark is the universal affordance.

- **P1.** *As anyone, I want the wordmark to be a real link to `/` with the accessible name "wiki+",*
  so a keyboard or screen-reader user reaches home the same way a mouse user does. → §2 / §7 (AC3/AC13).

**Story → AC trace** (feeds Product's criteria): R1→AC2 · R2/P1→AC3 · R3→AC4 · R4→A4(§4.4) ·
C1→AC9 · C2→AC8 · one-header→AC1 · landing-unchanged→AC12 · a11y→AC13.

---

## 2. The unified header anatomy — one component, two host configs

There is **one** header. It is a thin **page-host wrapper** around the existing `HeaderProjector`
(do **not** fork the mark — AC1/A1) plus two slots. The wrapper owns four things; the two hosts
differ only in how they fill the slots and which behaviors they switch on.

```
 The single header component owns:
 ┌───────────────────────────────────────────────────────────────────────┐
 │  [search slot]        ●  HeaderProjector (wordmark + beam)        [auth]│
 │   (optional)          │  as="a" href="/"  → home (AC3)            slot │
 │                       └─ the lit "+" aperture = the beam apex            │
 └───────────────────────────────────────────────────────────────────────┘
   1. The wordmark + beam  → HeaderProjector, as="a" href="/", name "wiki+"
   2. The auth card        → ONE AuthControl instance (never two — AC9)
   3. An OPTIONAL search slot (a render-prop / child; unset = no search node)
   4. The scroll-aware behavior (Tier A ↔ slim) — switched on per host
```

**Host A — Home (`app/page.tsx`).** Unchanged from #61 (AC12). The wrapper renders with:
- **no search slot** (the landing hero owns search as the page's dominant element);
- `HeaderProjector variant="projector"` at every width, the single `AuthControl variant="home"`
  right-anchored on the wordmark row, beam at every width, **no scroll-aware collapse**
  (the landing header is a free-standing hero, not sticky — see §4.5).
- This is exactly today's `app/page.tsx` header markup, now expressed through the shared wrapper.
  **Nothing about the landing header's look or behavior changes.**

**Host B — Topic (`app/topic/TopicView.tsx`, replacing `components/topic/TopicHeader.tsx`).** The
wrapper renders, `sticky top-0 z-40`:
- a **search slot at the upper-left** (`TopicSearch`, `topic-inline` ≥ md / `topic-disclosure` < md);
- the **wordmark shifted right** so its seam lands on the article↔plus divider (§3);
- the single **`AuthControl`** at the right (`topic-plus`-style skin ≥ lg context / `topic-compact`
  < lg — see §5 for the exact mapping);
- **scroll-aware:** Tier A (lit aperture + full beam) at scroll-top, collapsing to the slim Tier-C
  bar when scrolled (§4).

The bespoke `TopicHeader.tsx` two-block markup (the fake "Wiki" + separate "＋plus" label, the
duplicated auth, the unlinked wordmark) is **retired** (AC1) — deleted, or reduced to a re-export of
the shared wrapper (Dev's call).

> **`HEAD = 64` reconciliation (note to Dev).** `TopicView` uses `const HEAD = 64` as the
> scroll-sync offset (the sticky header's occupied height, used to compute section scroll targets).
> The slim sticky bar is **56px** (§4.2). At scroll-top the header is taller (Tier A, `burnY=116`),
> but scroll-sync only matters once the reader has scrolled — by which point the header is the slim
> 56px bar. **Set `HEAD = 56`** to match the slim bar (the steady-state sticky height). This is a
> one-constant change in `TopicView`, called out so the sync math stays correct; it is not new UI.

---

## 3. The seam-to-divider mapping (geometry) — ≥ lg only

This is the whole point of the issue (VISUAL_IDENTITY §2.2/§6.0): the lockup's internal seam labels
the two columns *by position*. It applies **only at `≥ lg`**, where the Topic grid is two columns and
a real divider exists. Below `lg` the columns stack and there is no divider (§5.6 / AC10).

### 3.1 Which pixel is "the divider" — the call: the **gutter centre**

The committed Topic grid (unchanged) is:

```
<div className="mx-auto max-w-[1200px] px-5">                    ← 20px padding each side
  <div className="grid ... gap-7 lg:grid-cols-[1fr_360px]">     ← 28px gap, 1fr article, 360px rail
```

The boundary between the article column and the plus rail is a **28px gutter** (`gap-7`), not a
line. There are three candidate "divider" pixels: the article column's right edge, the rail's left
edge, or the gutter's centre. **Decision: the gutter centre.** Rationale:

1. It is the **visual midpoint** between the two worlds — the seam reads as "between," not "biting
   into" either column, which is what §2.2's "the seam is the hinge between the two worlds" means.
2. It is **symmetric** — equidistant from both columns, so the mark doesn't appear to favour one.
3. It is **layout-derived and stable**: `gutter_centre = content_left + article_width + gap/2`,
   computed from the same grid tokens, so it tracks the columns at any viewport ≥ lg.

### 3.2 The gutter-centre x, measured (from the viewport left edge)

The header band is **full-bleed** (spans the viewport), so the seam target is an absolute x within
that band. Because the content is centred (`mx-auto`) and capped at `max-w-[1200px]`, the gutter
centre is:

```
container      = min(viewport, 1200)
container_left = (viewport − container) / 2          // mx-auto centring
content_left   = container_left + 20                 // inside px-5
article_width  = (container − 40) − 28 − 360          // inner − gap − rail
gutter_centre  = content_left + article_width + 14    // +half the 28px gap
```

Worked values (the contract Dev's measurement must reproduce ±4px — AC2):

| viewport | container | article col | **gutter centre x** | rail left x |
|---:|---:|---:|---:|---:|
| 1024 (lg start) | 1024 | 596 | **630** | 644 |
| 1100 | 1100 | 672 | **706** | 720 |
| 1200 (cap) | 1200 | 772 | **806** | 820 |
| 1280 | 1200 | 772 | **846** | 860 |
| 1440 | 1200 | 772 | **926** | 940 |
| 1920 | 1200 | 772 | **1166** | 1180 |

### 3.3 Driving `HeaderProjector` off real column geometry (no per-frame measurement)

The component's apex (`apexX`) is the **aperture** x (the lit "+" cutout), and the beam projects
from it. But the **seam** (where "Wiki" ends and the block begins) sits ~27px **left** of the
aperture (the cut is `CUT_CX ≈ 27px` into the block, and the block butts the seam). AC2 requires the
**seam** — not the aperture — to land on the divider. So:

> **The contract:** position the lockup so **seam_x = gutter_centre**, which means
> **apexX (aperture x) = gutter_centre + apertureOffsetWithinLockup − wikiAdvance**, i.e. the
> aperture lands ~27px to the **right** of the divider while the **seam sits on it**. Concretely the
> existing component already exposes `apertureX` (= "Wiki" advance + 2 + `CUT_CX`) and `wikiAdvance`
> (the measured "Wiki" offset). The Topic host drives the lockup's left position so the **seam**
> (`wikiAdvance` from the lockup's left edge) equals `gutter_centre`, then the aperture/apex follow
> by construction. The beam still originates from the aperture, ~27px right of the seam — which is
> correct: the "+" block (the curation layer) sits over the **plus rail**, and the beam pours down
> over that side, exactly the §2.2 reading.

**How to feed it (AC11 — cheap, not per-frame):** the gutter centre is **layout-derived**, so Dev
computes it from the grid tokens (the formula in §3.2) — either:
- **(a, preferred)** measure the real gutter once via a zero-height **probe element placed in the
  grid** (an empty `div` spanning the gap, or read the article column's `getBoundingClientRect`
  right edge + half the gap) on mount and on **resize** (a `ResizeObserver` on the grid container) —
  **not on scroll**; expose it as `projectionX` (a 0..1 fraction `gutter_centre / bandWidth`) or a
  px CSS custom property the component reads. The existing component already resize-tracks `cw`; this
  adds one resize-time read of the column boundary. **No `getBoundingClientRect` on scroll** (AC11).
- **(b)** compute `gutter_centre` purely from the formula in §3.2 using the live band width (no DOM
  read of the columns at all). This is the cheapest and is acceptable since the grid ratio is fixed;
  (a) is more robust if the grid ever changes.

Either way the value flows through the **existing** `projectionX` / `seamRatio` props (A1/A2 — the
"reserved hook" the landing spec §5.2 named) — this is the *second, dynamic consumer* AC15(c) records.

### 3.4 Tier-A Topic geometry — the numbers

The Topic Tier-A header is **shorter** than the landing hero (it is sticky chrome, not the hero), so
the beam flares over a shorter band:

| param | Topic Tier-A value | vs. landing | why |
|---|---|---|---|
| `burnY` (band height / burn boundary) | **`116px`** | landing `130` | Tall enough for a legible short cone; short enough that a sticky bar isn't oppressive. Cone length `burnY − cyMid = 76px` (vs landing's 86) — still a clear projection. |
| `cyMid` (wordmark row centre) | **`40px`** | landing `44` | Block bottom at ≈68px; leaves the 76px cone. |
| `beamSlope` (`tan`) | `0.6` (token default) | same | the variant-01 angle, true-scale (never flattened). |
| `beamCrossUp` | `28px` (token default) | same | crossbar sits 28px above `burnY` → `crossY = 88px`. |
| `beamEdgeInset` | `17px` (token default) | same | crossbar ends 17px from each page edge, then off-page. |
| `apexX` (aperture x) | **driven** = seam_x(gutter centre) + ~27px | landing: layout-anchored | §3.3. The beam's two arms are asymmetrical: short on the rail side, long on the article side (the apex sits right-of-centre). |
| `fullBleed` | `true` | same | the band is full-bleed; the gold border runs off both viewport edges. |

These are passed as a **`geometry` override** on the Topic `HeaderProjector` instance (the landing
instance still passes none — its token defaults stand, AC12). Pin the Topic values as a second token
set or pass them inline via the prop; **do not** mutate the landing `--projector-*` defaults.

---

## 4. The two compositions + the scroll transition (Topic only)

### 4.1 Tier A — scroll-top (lit aperture + full beam, seam on divider)

At `scrollY ≈ 0` the Topic header is the **full projector** (AC4): the lit GLOWING aperture
(white-hot core + gold rim + "+"-outline bleed onto the indigo + the "pedia" ghost), the descending
true-scale beam to `burnY=116`, the gold border off both viewport edges. The lockup's **seam sits on
the gutter centre** (§3). Layout of the band (full-bleed, height `burnY`):

```
 ┌─────────────────────────────────────────────────────────────────────────────┐  ← --header-field
 │ [🔍 search]                    ● wiki│+plus              [ Avatar ▾ / Log in ] │     #fafbfe
 │  upper-left, ≥md inline          ╲  seam on gutter centre   ╱   auth, right    │
 │                            ╲────── short cone ──────╱                          │
 │ ══════════════ GOLD BORDER (off both viewport edges) ═══════════════           │  ← burnY=116
 └───────────────────────────────────────────────────────────────────────────────┘     burn-to-white
```

- **Search** sits at the **upper-left** of the cool field, vertically centred on the wordmark row
  (`cyMid=40`). The wordmark having shifted right (its seam on the divider, ~630–1166px from the
  left), the upper-left is free for search (§2/AC6).
- **Auth** sits at the **right**, vertically centred on the wordmark row.
- Both search and auth are in the **cool field above `burnY`** — never in the burnt-to-white region,
  so the beam burns to the article's own white below them, unobstructed.
- The wordmark is `HeaderProjector variant="projector"` with the Topic `geometry` (§3.4),
  `as="a" href="/"` (AC3).

### 4.2 The slim sticky bar — scrolled (flat Tier-C lockup, beam faded out)

Once scrolled past the threshold (§4.3) the header **collapses to a slim, sticky bar** (AC4),
**height `56px`**, flat **Tier C** (decision c — no lit aperture, no beam, no glow), `sticky top-0`:

```
 ┌───────────────────────────────────────────────────────────────────────────────┐  56px
 │ [🔍] wiki│+plus   ·  Jane Austen (muted)                  [ Avatar ▾ / Log in ] │  flat Tier C
 └───────────────────────────────────────────────────────────────────────────────┘  bg --header-field
```

**What persists across the transition (no content jump):** the **wordmark** (now flat Tier C), the
**search** control, and the **auth** control are the *same instances* — they do **not** unmount/
remount on scroll. Only the **beam + the tall cool band collapse**. Specifically:

- **Wordmark:** swaps from `variant="projector"` (Tier A) to `variant="lockup-flat"` (Tier C) — the
  flat indigo "+" block, no lamp, no beam, no ghost. In the slim bar the seam **no longer aims at the
  divider** — the slim bar is a normal app top-bar (lockup left-of-search or directly after the
  search icon), so the lockup carries its own self-contained `wiki|+plus` split (the same self-
  contained read as the < lg case, §5.6). *(Justification for dropping seam-alignment here: the slim
  bar is `56px` chrome; the beam — the thing the seam-on-divider labels — is gone, so aligning a
  flat seam to an invisible projection adds nothing and would cost a per-scroll column measurement,
  against AC11.)*
- **Search:** unchanged control, same variant per breakpoint (inline ≥ md, disclosure < md). Moves
  to the slim bar's left.
- **Auth:** unchanged `AuthControl` instance, right-anchored.
- **NEW: a muted article-title cue** appears (slim state only) — see §4.4.

- **Background:** `--header-field #fafbfe`, with a `border-b-2 border-ink` (the committed Topic
  header's bottom rule) so the slim bar reads as a defined chrome edge over the scrolling article.

### 4.3 The transition — threshold, fade, durations, reduced-motion

**Threshold + hysteresis (AC4/AC11).** A single threshold with a hysteresis band — **not** a
continuous scroll-linked scrub (cheaper, predictable):

- collapse to slim when `scrollY > burnY` (**> 116px**);
- restore Tier A when `scrollY < burnY − 40` (**< 76px**);
- between 76 and 116 the state is **sticky** (keeps whatever it last was) — the 40px hysteresis
  prevents flicker on a pixel boundary.

**The scroll handler (AC11).** A **passive** scroll listener, **rAF-gated** (or throttled), reading
only `window.scrollY` (a cheap read — no layout flush). It sets a single boolean state
(`collapsed`). It does **not** re-measure the column divider or call `getBoundingClientRect` per
scroll event (the divider is measured at mount/resize only — §3.3). The slim state renders **Tier C**
(no `mix-blend-mode`, no filters) — the cheap render for an element repainted on a sticky scroll.

**The fade mechanism (AC4).** On the `collapsed` flip:
- the **beam + the lit-aperture layers** fade `opacity 1 → 0` (compositor-friendly, reversible);
- the **band height** collapses `116px → 56px`;
- the lockup cross-fades Tier A → Tier C (the flat block fades in as the lit one fades out, both
  centred on the same lockup origin so there is no horizontal jump);
- **search and auth do not move vertically beyond the band-height change** — they are anchored to
  the row centre, which is stable, so no content jump.

**Durations.** Beam opacity + band height + lockup cross-fade over **~180ms**, `ease-out`. (Inside
the 150–200ms window the spec names; short enough to feel instant, long enough to read as a
deliberate collapse, not a pop.)

**Reduced motion (AC5).** When `prefers-reduced-motion: reduce` is set, the transition applies the
**end states with no animated tween** — the beam is present at scroll-top and absent (opacity 0,
`display:none` acceptable) when scrolled; the band is `116px` or `56px` with **no height
animation**; the lockup is Tier A or Tier C with no cross-fade. The slim sticky state is still
reached. (Implement by gating the `transition` properties behind
`@media (prefers-reduced-motion: no-preference)`, exactly the project's existing pattern — the
pinned-player dock-in gate.)

### 4.4 A4 decision — YES, a muted article-title cue in the slim state only

**Decision: add a muted article-title cue, rendered ONLY in the slim sticky bar.** Justification:

1. **The need is real.** At Tier A (scroll-top) the article's own `<h1>` ("Jane Austen — From
   Wikipedia · CC BY-SA 4.0", the `ArticleLeadBlock`) is right there, so a header echo would be a
   redundant duplicate (the exact problem the spec's decision (d) removed from the old `TopicHeader`).
   But **once scrolled**, that `<h1>` is gone from view — a reader deep in a long article has no
   always-visible "what am I reading" cue. Decision (d) anticipated exactly this and sanctioned the
   refinement: a title cue **in the slim state only**.
2. **It earns its place only in the slim state.** Showing it at Tier A re-creates the duplicate-title
   problem; showing it only when the article title has scrolled away makes it additive, not
   redundant. This is the "natural refinement" the spec's A4 named.
3. **It keeps the slim bar genuinely slim.** It is *one muted line*, truncated, not a second row.

**Spec for the cue:**
- **Content:** the article **display title** (`displayTitle` — e.g. `bell hooks`, not the canonical
  `Bell hooks`), the same string `ArticleLeadBlock` shows. Plain text, no "From Wikipedia" suffix
  (that lives in the lead block).
- **Placement:** in the slim bar, **after the wordmark**, separated by a muted middot (`·`) or a thin
  vertical rule. It sits on the article side (left-of-centre), reinforcing "this is the article you're
  reading." It must **not** push the auth off the row — it `truncate`s (single line, ellipsis) and
  `min-w-0` so it yields space to the wordmark and auth first.
- **Styling:** `text-slate-500` (the muted serif echo the old header used), `font-serif`,
  `text-sm`/`text-[0.95rem]`, `truncate`. It is **not** a heading element (the page already has the
  article `<h1>` in the lead block) — render it as a `<span>` so it adds no second `<h1>` (avoids the
  duplicate-landmark problem decision (d) flagged). Give it `aria-hidden="true"` **only if** the
  article `<h1>` remains in the DOM (it does — it has just scrolled out of the *viewport*, not the
  DOM), so a screen-reader user still reaches the real `<h1>`; the cue is a *visual* convenience.
  *(If Dev finds the article `<h1>` is conditionally unmounted while scrolled, drop the `aria-hidden`
  so the cue is announced — but the lead block is always mounted, so `aria-hidden` is correct.)*
- **Responsive:** present at all breakpoints in the slim state, but it is the **first thing to
  truncate/drop** under width pressure (after the wordmark and before search/auth): at `< md`, where
  the search is a disclosure icon and space is tightest, the title cue may be hidden entirely if
  wordmark + search-icon + auth already fill the row (Dev's call by available width). Search and auth
  reachability (C1) outranks the title cue.

### 4.5 Home host — no scroll-aware collapse (AC12)

The Home header is **not** scroll-aware and **not** sticky — it is the free-standing landing hero,
unchanged from #61. The shared wrapper exposes the scroll-aware behavior as an **opt-in**
(`stickyScrollAware` / a `host="home" | "topic"` discriminator — Dev's naming). Home leaves it
**off**; the landing header keeps Tier A at every width, one row, beam at every width, no slim
collapse. The wrapper must not introduce *any* observable change to the landing header (AC12 is a
screenshot-diff against the pre-change build).

---

## 5. EVERY state (the gate)

The matrix is: **session** (logged-out / logged-in / loading) × **scroll** (scroll-top Tier A /
scrolled slim) × **breakpoint** (≥ lg / md–lg / < md) × **search** (inline / disclosure-collapsed /
disclosure-revealed). Below, organized by breakpoint, with the slim-vs-Tier-A and the two session
states inside each. *(The "loading" session state is the `AuthControl` neutral pulse chip — it
occupies the same right slot in every cell below; called out once here, not repeated per cell.)*

### 5.1 ≥ lg (≥ 1024px) — side-by-side columns, seam on divider

**Search:** `TopicSearch variant="topic-inline"` (the compact inline field, `h-9`), upper-left.
**Auth:** the single `AuthControl` at the right.

| | Tier A (scroll-top) | Slim (scrolled) |
|---|---|---|
| **Layout** | Full band (`116px`): search upper-left · wordmark seam on gutter centre (§3) · auth right. Lit aperture + full beam, gold border off-page. | Slim bar (`56px`): search-inline · flat Tier-C wordmark (self-contained split) · muted title cue · auth right. Beam faded out. |
| **Logged-out** | Auth = "Log in with Wikipedia" button (`bg-brand text-white`, WikiGlyph + word). On the cool `#fafbfe` field — the `home`-skin login (indigo-on-light), **not** the `topic-plus` white-on-indigo (there is no indigo block behind it now — see §5.7). | Same login button, slim bar. |
| **Logged-in** | Auth = `SignedIn`: avatar initial + **username** + `▾` Radix menu (My curations / Sign out). Full username shows (room at ≥ lg). | Same, slim bar. |

> **Auth skin at ≥ lg — a deliberate change from the retired header.** The old `TopicHeader` put
> auth *inside* an indigo `+plus` block (`topic-plus`, white-on-indigo). The unified header has **no
> indigo block** behind the auth (the wordmark's indigo is the "+" block of the lockup, far left-of-
> the-auth). So the auth sits on the cool field and uses the **`home` skin** (indigo-on-light login /
> ink-on-light account) — the AA-safe pairing for that surface. See §5.7. This consolidates to one
> skin choice driven by *surface*, not a second control.

### 5.2 md–lg (768–1023px) — columns stacked, search still inline

At `md–lg` the Topic grid is **already single-column** (`grid-cols-1` below `lg`), so the columns are
**stacked** — there is **no divider** (AC10). The header is a normal top-bar.

**Search:** `topic-inline` (still ≥ md, so the inline field, not the icon). **Auth:** single control.

| | Tier A (scroll-top) | Slim (scrolled) |
|---|---|---|
| **Layout** | Full band (`116px`): search left · wordmark **self-contained split** (no divider to aim at — §5.6) · auth right. Beam still renders (true-scale, apex on the aperture wherever the lockup is anchored — left-anchored here, asymmetrical arms). | Slim bar (`56px`): search-inline · flat Tier-C wordmark · muted title cue · auth right. |
| **Logged-out** | "Log in with Wikipedia" button, right. | Same, slim. |
| **Logged-in** | `SignedIn` avatar + username + menu, right. | Same, slim. |

*(The seam-on-divider logic is **not applied** below lg — the lockup carries its own split, §5.6.
At md–lg the beam may still flare since the band is tall enough at Tier A; its apex sits on the
aperture wherever the left-anchored lockup places it. This mirrors the landing page's narrow-but-
beamed behavior — same `HeaderProjector`, driven config.)*

### 5.3 < md (< 768px) — columns stacked, search collapses to an icon

**Search:** `TopicSearch variant="topic-disclosure"` — a labeled **magnifier icon** that reveals the
field on tap (AC7). **Auth:** the single `AuthControl variant="topic-compact"` (AC8).

| | Tier A (scroll-top) | Slim (scrolled) |
|---|---|---|
| **Layout — search collapsed (default)** | Full band: search **icon** (upper-left) · wordmark self-contained split · compact auth right. Beam true-scale, apex on the aperture (left-anchored), asymmetrical arms; lockup may scale down on the smallest phones (the existing `.projector-lockup-fit`, transform-origin = aperture) before auth wraps. | Slim bar: search **icon** · flat Tier-C wordmark · (title cue dropped if tight, §4.4) · compact auth right. |
| **Layout — search revealed (after tap)** | The disclosure expands the **same field** inline (it already manages its own expand/collapse + focus, returning focus to the trigger on close — #12). The revealed field + close (✕) sit in the search slot; the wordmark/auth stay put (the field is `max-w-[280px]`). | Same revealed field in the slim bar. |
| **Logged-out** | `topic-compact` signed-out → a **compact "Log in"** control with the WikiGlyph (see §5.5 caveat). | Same, slim. |
| **Logged-in** | `topic-compact` `SignedIn` → **avatar initial only** (username hidden behind the avatar at `< sm` via the existing `compact ? "hidden sm:inline"` rule) + `▾` menu. | Same, slim. |

### 5.4 The collapsed mobile affordances — confirmed against the existing variants

- **Search icon-reveal (AC7):** `TopicSearch variant="topic-disclosure"` already renders a labeled
  magnifier button (accessible name "Search topics") that expands the field on click and returns
  focus to the trigger on Escape/close. **No change needed** — the header just places it `< md`.
- **Auth first-initial signed-in (AC8):** `AuthControl variant="topic-compact"` + `SignedIn`
  `compact` already shows the avatar initial and hides the username text `< sm`. **No change needed.**

### 5.5 A3 resolution — variant gap check (flagged to Dev, **not** a new variant)

**Finding: no new variant is required.** The existing variants cover every state. **One placement
caveat** for Dev (the spec's A3 explicitly asked UX to check the narrow logged-out compact control):

- `AuthControl variant="topic-compact"` **logged-out** renders the label **"Log in"** (not the full
  "Log in with Wikipedia") + the WikiGlyph, with `aria-label="Log in with Wikipedia"` carrying the
  full name. That is a **short control** (glyph + two-word label), not an icon-only button, and it has
  `min-h-[44px]` (a proper touch target). It reads cleanly at `< md` and does **not** overflow — it
  is materially narrower than the `home` button. **This satisfies AC8** ("a compact login affordance
  that reads as an icon/short control").
- **Caveat to verify in the built UI (not a re-spec):** at the very narrowest widths (`< 360px`) with
  the search **revealed** (the `max-w-[280px]` field open) **and** the wordmark, the row is tight. The
  search disclosure is *collapsed by default* (just the icon), so the common case is fine; the only
  pressure is the transient revealed-field case. Mitigation already in the toolbox: when the search is
  revealed `< md`, the field is `max-w-[280px]` and the row can let the **wordmark scale down** (the
  existing `.projector-lockup-fit`) — but in the slim bar (flat Tier C, no scale rule yet) Dev should
  ensure the flat lockup + revealed field + compact auth fit, e.g. by letting the **title cue drop**
  (§4.4) and the flat wordmark shrink. **If Dev finds the three cannot coexist at `< 360px` with the
  field revealed**, the sanctioned fix is to **collapse the wordmark to the Tier-D glyph tile**
  (`variant="glyph"` — the "+" tile alone, which already exists) in that narrow-revealed case, *not*
  a new auth variant. Flag back to UX if even that doesn't fit. **No new `TopicSearch`/`AuthControl`
  variant is needed** for any state in this spec.

### 5.6 < lg stacked layout — the split carried within the lockup (AC10)

At `< lg` (md–lg and < md both) the columns are stacked and **there is no divider**. The header must
**not** attempt to align the seam to a nonexistent divider (AC10). Instead the lockup shows its
**self-contained `wiki | +plus` split** (§6.3 / VISUAL_IDENTITY): serif "Wiki" butting the indigo "+"
block as one intact unit. Nothing is stretched across or aimed at an absent divider.

- **Mechanism:** the Topic host applies the seam-on-divider `geometry` (the driven `projectionX`/
  `seamRatio`) **only at `≥ lg`**. Below `lg`, it passes **no** divider-driven position — the lockup
  is laid out as a normal left-anchored unit (its aperture/apex resolved from its own layout, exactly
  as the landing page does at narrow widths). A test asserts that below `lg` the seam-to-divider
  positioning is not applied (AC10 verify).
- This is the same self-contained read in **both** the Tier-A < lg state (beam present, lockup left-
  anchored) and the slim < lg state (flat Tier C lockup).

### 5.7 Auth consolidation — one instance, every breakpoint (AC9)

The unified header renders **exactly one** `AuthControl` instance (AC9) — the old two-places
duplication (`topic-plus` inside the block *and* `topic-compact` on the row) is **gone**. The single
instance picks its **skin by breakpoint**:

- **≥ md:** `AuthControl variant="home"` (the full "Log in with Wikipedia" / `SignedIn` with
  username + menu) — sits on the cool field, indigo-on-light (there is no indigo block behind it now,
  §5.1). *(Alternative: keep a `topic-`prefixed variant if Dev prefers a distinct skin name, but the
  **surface is light**, so the `home` skin's color pairing is the correct one — not `topic-plus`'s
  white-on-indigo.)*
- **< md:** `AuthControl variant="topic-compact"` (avatar-initial / short "Log in").

It is **keyboard-reachable and operable at every breakpoint and in both scroll states** (AC9/AC13) —
it is the *same DOM node* across the Tier-A ↔ slim transition (it does not unmount), so focus is
never lost on collapse.

---

## 6. Microcopy (use verbatim)

All search + auth microcopy is **inherited** from #12 / issue C and used unchanged. Listed here so
Dev wires nothing new and QA can assert it.

| Element | Accessible name / text | Source |
|---|---|---|
| **Wordmark (link)** | accessible name **`wiki+`** (`aria-label="wiki+"` on the link/container) | VISUAL_IDENTITY §7.1; HeaderProjector `accessibleName` default |
| **Search field** (inline ≥ md) | programmatic name **"Search Wikipedia topics"** (`aria-label`; no visible label in the topic variants) | TopicSearch `LABEL_SR` |
| **Search submit** | **"Search"** | TopicSearch `SUBMIT_NAME` |
| **Search disclosure trigger** (< md, collapsed) | **"Search topics"** | TopicSearch `DISCLOSURE_OPEN_NAME` |
| **Search disclosure close** (< md, revealed) | **"Close search"** | TopicSearch `DISCLOSURE_CLOSE_NAME` |
| **Search placeholder** | **"Search any Wikipedia topic…"** | TopicSearch `PLACEHOLDER` |
| **Login (≥ md, logged-out)** | visible label **"Log in with Wikipedia"** | AuthControl `home` |
| **Login (< md, logged-out)** | visible **"Log in"**, `aria-label="Log in with Wikipedia"` | AuthControl `topic-compact` |
| **Account (logged-in)** | trigger `aria-label="Account: {username}"`; menu items **"My curations"**, **"Sign out"** | AuthControl `SignedIn` |
| **Slim-state title cue** (NEW) | the article `displayTitle` as plain text (no "From Wikipedia" suffix); not a heading; `aria-hidden` (the real `<h1>` is in the lead block) | §4.4 |

No new strings are introduced by this header except the **title cue**, which is data (the article
title), not new copy.

---

## 7. Accessibility (AC13)

The header is decorative imagery built around real text + two interactive controls. The model is
inherited from #15's a11y work and **re-asserted for the Topic host + the new scroll states**.

### 7.1 The wordmark accessible name + decorative layers
- The wordmark exposes the accessible name **`wiki+`** (`aria-label="wiki+"` on the
  `HeaderProjector` link). It is `as="a" href="/"` (AC3), so it is a real link, keyboard-focusable,
  Enter-activatable, routes home from both hosts.
- **All decorative layers `aria-hidden`:** the SVG beam + gold border/glow, the aperture core, the
  gold rim, the "+"-outline bleed, the "Wikipedia"/"pedia" ghosts, the two-temperature surface, the
  flat "+" block's "plus" text. A screen-reader user hears **"wiki+"**, never "Wiki"/"plus"/"pedia"
  as fragments, never the beam, never the title cue duplicating the `<h1>`.

### 7.2 Contrast on the real text (AA)
- **Serif "Wiki" `#1b1b1b` on `--header-field #fafbfe`** ≈ **17:1** — passes AA/AAA (both Tier A and
  the flat Tier-C lockup; the flat block's "Wiki" sits on the same field).
- **White "plus" on indigo `#676EB4`** ≈ **3.9:1** — fails AA-normal but **passes AA-large** (Source
  Sans Pro 900 ≥ ~26px = "large/bold" by WCAG). Keep it bold + large (same as `.plus-card`).
- **The login button** (`home` skin: `bg-brand #676EB4` + white text) is the issue-C verified pairing
  (the word carries the label, never color alone). The compact "Log in" word + glyph likewise.
- **The slim-state title cue** `text-slate-500 (#64748b)` on `#fafbfe` ≈ **4.6:1** — passes AA for
  normal text. (It is also `aria-hidden` and non-essential, but it still meets AA as visible text.)
- **The gold border / glow / aperture are decorative** — exempt from text-contrast (carry no meaning).

### 7.3 Gold is decorative, never a functional signal
The wordmark gold (`#EECE87`/`#FFECB2`) encodes **no** product state, status, accuracy, stance, or
interactivity — it is an aesthetic light-intensity cue only (VISUAL_IDENTITY §7.3). It must never be
reused as a UI/state color. The scroll transition uses **no** gold signaling (the beam *fades*, it
does not change gold meaning).

### 7.4 Keyboard reachability in BOTH Tier-A and slim states (AC13)
- **Tab order (both hosts, both scroll states):** wordmark link → search → auth. (On Topic, search
  is upper-left, so it precedes auth.) This is a sensible reading order (logo, then the page's search,
  then account).
- **At Tier A:** Tab to the wordmark (Enter → home); Tab to the search (type, ↓/↑ suggestions, Enter
  to navigate — the #12 keyboard model, unchanged); Tab to the auth (operate the login button or open
  the `SignedIn` Radix menu).
- **At slim:** the wordmark, search, and auth are the **same DOM nodes** (they persist across the
  collapse, §4.2), so the tab path is identical and **focus is never lost on the Tier-A↔slim
  transition**. If a control had focus when the header collapsed, it keeps focus (no remount).
- **< md disclosure:** Tab to the search trigger → Enter/Space reveals the field and moves focus into
  it (#12); Escape collapses and returns focus to the trigger. Operable in both scroll states.
- **Visible focus:** the search field's `.search-field:has(input:focus-visible)` brand outline and
  the auth controls' default focus rings (both inherited) — visible in both scroll states.

### 7.5 Font-fallback, forced-colors, reduced-motion
- **Web-font failure:** "Wiki"/"pedia" → Georgia system serif; "plus" → the system-ui bold stack.
- **`forced-colors: active`:** force the **flat Tier-C lockup** (the existing `.forced-colors-flat`
  rule) at every scroll state — the burn-to-white/gold cannot survive a forced palette; the lockup
  shape + search + auth stay operable.
- **Reduced motion (AC5):** the Tier-A↔slim transition applies end states with no animated tween
  (§4.3). No other motion is introduced.

---

## 8. What Development should build (hand-off summary)

1. **One shared header wrapper** around `HeaderProjector` (do not fork the mark — AC1/A1) with two
   slots (search, auth) and an opt-in scroll-aware behavior. Consumed by **both** `app/page.tsx`
   (Home, no search slot, no scroll-aware — unchanged, AC12) and the Topic view (search upper-left,
   seam-on-divider ≥ lg, scroll-aware, wordmark→home, one consolidated auth). **Retire**
   `components/topic/TopicHeader.tsx` (AC1).
2. **Seam-to-divider (§3):** drive the Topic `HeaderProjector`'s `projectionX`/`seamRatio` off the
   **gutter centre** (the formula in §3.2 or a mount/resize-time measure — **never per-scroll**,
   AC11) so the **seam** lands on it ±4px (AC2). Apply **only at ≥ lg**; below lg pass no
   divider-driven position (self-contained split — AC10).
3. **Tier-A Topic geometry (§3.4):** `burnY=116`, `cyMid=40`, the rest at token defaults, as a
   `geometry` override on the Topic instance (do not mutate the landing defaults — AC12).
4. **Scroll transition (§4):** Tier A at scroll-top → slim **Tier-C** bar (height **56px**) when
   scrolled; threshold `scrollY > 116` collapse / `< 76` restore (40px hysteresis); beam opacity 1→0
   + band height 116→56 + lockup Tier A→C cross-fade over ~180ms; **passive, rAF-gated** scroll
   listener reading only `scrollY` (AC11); **reduced-motion** end-states (AC5). Wordmark/search/auth
   **persist** across the transition (same nodes, no jump).
5. **A4 — the muted article-title cue (§4.4):** slim state **only**, `displayTitle` plain text,
   `text-slate-500 font-serif truncate`, a `<span>` (not a heading), `aria-hidden`, first to truncate/
   drop under width pressure.
6. **Auth consolidation (§5.7):** exactly **one** `AuthControl` instance; `home` skin ≥ md (light
   surface), `topic-compact` < md; reachable + operable at every breakpoint and both scroll states.
7. **Search slot (§5):** `TopicSearch` `topic-inline` ≥ md / `topic-disclosure` < md (icon-reveal —
   AC7). No new search component, no new variant (A3 — §5.5).
8. **`HEAD = 56` in `TopicView`** to match the slim sticky height (§2 note) so scroll-sync math is
   correct.
9. **A11y (§7):** `aria-label="wiki+"` link, decorative layers `aria-hidden`, AA real-text pairs, tab
   order wordmark→search→auth in both scroll states, focus preserved across collapse, forced-colors →
   flat lockup, reduced-motion end-states.
10. **Doc reconciliation (AC15):** update `TOPIC_PAGE_DESIGN.md` (split-wordmark wording → single
    seam-aligned lockup straddling the divider), `VISUAL_IDENTITY.md` §10 (mark §10.1 #3 / §10.2 #6
    resolved; record the scroll-transition decision), and `docs/design/landing-page.md` §5 (note the
    second dynamic consumer of `projectionX`/`seamRatio`). *(Product owns the prose of these per the
    spec, but the diff must be present — Dev includes the edits.)*
11. **Tests (AC1–AC14)** as the spec enumerates. **Do not** touch the article body (VISUAL_IDENTITY
    §9.3) or add new auth functionality.

---

## 9. Open design questions flagged for Dev

- **DQ-1 — gutter-centre measurement technique (§3.3).** Formula-only (§3.2(b)) vs. a mount/resize
  probe (§3.2(a)). Both satisfy AC2/AC11; pick whichever lands the seam ±4px most robustly. If the
  formula drifts >4px from the real gutter at some viewport (e.g. a scrollbar-width discrepancy
  between `100vw` and the document width), use the probe. Flag back to UX if neither holds ±4px.
- **DQ-2 — the `< 360px` revealed-search-in-slim-bar squeeze (§5.5).** The sanctioned fallback is the
  Tier-D **glyph tile** for the wordmark in that one narrow-revealed case; confirm it fits, and flag
  to UX if it still doesn't.
- **DQ-3 — band-height collapse without article content jump.** The Topic article content begins
  below the header. When the header collapses 116→56 (60px shorter), the *sticky* header reserving
  less space could shift the article up. Verify the article's top offset is driven by the **slim**
  height (the steady state) so the collapse does not jump the article; the Tier-A extra height
  overlays the cool field, not the article. Flag to UX if a jump is unavoidable.
- **DQ-4 — UX re-evaluation gate (VISUAL_IDENTITY §10.3).** After build, UX evaluates: (a) the seam
  visibly lands on the gutter centre at ≥ lg with "Wiki" over the article and "+plus" over the rail;
  (b) the Tier-A beam matches the mockup (glowing lamp, true-scale stem, no underline); (c) the slim
  bar reads as a deliberate flat lockup (not an orphaned glow); (d) no content jump / no jank on the
  transition; (e) the a11y model holds in both scroll states. This is distinct from QA's correctness
  pass.
