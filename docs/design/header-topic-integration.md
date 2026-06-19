# Design spec: header–Topic integration — unified projector geometry, beam-on-background, beam↔height coupling

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written
**before** implementation) · **Phase:** prototype
**Builds on / supersedes where stated:** [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) §10 / §10.1
(the universal-header principle) / §10.2 #6 (the Topic strip numbers `burnY=104`, `cyMid=28`, the
slim transition); [`docs/design/shared-header.md`](shared-header.md) (#72 — the two host configs and
the single-origin cross-fade); [`docs/design/landing-page.md`](landing-page.md) (#15/#61 — the first
`HeaderProjector` build and its `--projector-*` Tier-A token defaults `burnY=130`, `cyMid=44`).
**Inherits (not re-specified here):** the lockup anatomy, the burn-to-white metaphor, the gold-edge
signal, the responsive tiers, and the a11y name model — all from `VISUAL_IDENTITY.md` §2–§8.
**Hands off to:** Development (build the three changes below) → QA & Review verifies AC1–AC16 → UX
re-evaluates the built header (standard screenshot matrix) against this spec.

> **What this spec is.** A focused refinement contract for the **one** universal projector header
> where it touches the Topic view. It resolves three owner-named problems: (1) the home↔Topic
> **geometry drift**, (2) the **beam meeting a grey background** on Topic, and (3) the **beam-fade ↔
> band-height coupling** on scroll. It changes geometry values and one background fill; it does not
> change the lockup, the metaphor, the tiers, the seam-on-divider mechanism, or the a11y model. The
> universal-header principle (`VISUAL_IDENTITY.md` §10.1 — one parameterized component, host configs,
> never a fork) is preserved and reinforced: after this change the two hosts share **one** Tier-A
> geometry, differing only in the scroll-collapse layer Topic adds on top.

---

## 1. Personas & stories served

These are the existing wiki+ personas (full versions in `docs/design/` persona docs); only the
header-relevant stories are restated.

- **Priya, the reader who lands on a Topic page.** Arrives from a link or from Home. *"As a reader,
  I want the wiki+ header to look and feel like the same product wherever I am, so the site reads as
  one coherent place and I trust it."* She does not consciously measure pixels, but she **feels**
  drift: a header that is visibly taller/looser on Home than on Topic reads as two different sites or
  a half-finished build, and erodes trust in a product whose whole pitch is *trustworthy
  contextualization*. She also notices a **hard seam** where the white beam meets a grey page — it
  reads as a rendering bug, the opposite of the "burns seamlessly into the content" intent.
- **Same reader, scrolling.** *"As a reader scrolling into a long article, I want the big header to
  get out of my way without anything jumping or leaving an empty gap, so I can read."* The beam
  fading while the band keeps its full height would leave a dead band of empty cool-grey — wasted
  space and a broken-looking header. The fade and the shrink must read as **one** motion.
- **Casey, the curator/contributor.** Works across Home (finds a topic) and Topic (curates). Header
  consistency lowers the cognitive cost of moving between the two surfaces; the same wordmark home
  link in the same place in every state keeps "get back home" muscle-memory intact.

**Why it matters now.** The header is the single most-repeated piece of chrome in the product and the
carrier of the Indigo Press identity. Drift here is drift in the brand. These are usability/identity
defects, not features — which is why this is a refinement spec, not a new capability.

---

## 2. Decision 1 — unified Tier-A geometry (resolve the home↔Topic drift)

### 2.1 The decision

**Adopt option (c): one shared Tier-A geometry that BOTH hosts use, with Topic adding only the
slim/collapse behavior on top.** The shared Tier-A geometry is Topic's current tighter composition:

- **`burnY = 104px`** (band height / content boundary)
- **`cyMid = 28px`** (wordmark row centre from the band top)
- **cone length = `burnY − cyMid` = `76px`**

**Home changes:** its Tier-A geometry moves from `130 / 44` to the shared **`104 / 28`** (cone
`86 → 76`). **Topic is unchanged at Tier A** (it is already `104 / 28`). After this change the two
hosts render an **identical Tier-A band**; Topic alone adds the scroll-collapse layer (Decision 3).

The `--projector-*` token defaults in `globals.css` (currently `--projector-burn-y: 130px`,
`cyMid` default 44 in the component) are **re-pinned to the shared `104 / 28`** so "one configuration
of the defaults" stays true for Home — Home keeps passing **no** geometry overrides; the defaults
simply now equal the shared value. Topic continues to pass its `TOPIC_GEOMETRY` (which becomes a
no-op for `burnY`/`cyMid` since they equal the defaults, but keeps `leftInset` and the driven
`projectionX`).

### 2.2 Rationale (why (c), and why 104/28 rather than 130/44)

- **Option (c) is the only one that fully honors §10.1.** "One flexible parameterized header presented
  consistently on every page" means the *base* geometry is one value, and per-host behavior is
  **additive** (Topic adds scroll-collapse), not a **different base**. Options (a) and (b) both leave
  two different Tier-A geometries on the table; (c) collapses them to one. The component already
  supports this — both hosts read the same `--projector-*` defaults; we are removing Topic's *need* to
  override `burnY`/`cyMid` by making the defaults equal what Topic needs.
- **Pick 104/28 (not 130/44) because the chrome-row alignment constraint is load-bearing and only
  104/28 satisfies it.** The Topic header's search + auth cards sit centred in a **56px** chrome row;
  the wordmark row must centre on that row, i.e. `cyMid = SLIM_BAR_HEIGHT / 2 = 28`, and the flat 56px
  lockup must fill the slim bar exactly (`burnY` collapses to `56`, so the Tier-A band wants to be a
  small, clean multiple above it — `104` gives a `76px` cone with `48px` of collapse). Re-justifying
  rather than just inheriting: the tighter cone also reads **better** — the component's own design
  comment (`HeaderProjector.tsx` "TIGHT COMPOSITION") notes the mark should read as *a projection
  landing ON the search*, not a far-off underline. Home's `130/44` made the beam burn into a band of
  empty white above the search; `104/28` lands the burn boundary just above the hero search on Home
  too, which is the intended "burns into the search" read (Home's hero already pulls its search up to
  just below `burnY` — see `app/page.tsx`). So 104/28 is both the *constraint-satisfying* and the
  *better-looking* choice; 130/44 was the looser one.
- **Home loses nothing.** Home has no chrome row to align to, so dropping `cyMid` 44→28 just tightens
  the composition; the auth slot (absolutely positioned, height 88) re-centres on the new wordmark row
  (see §6 for the auth-slot adjustment). No content reflows.

### 2.3 Exact pixel table (the contract)

| Host / state            | burnY (band height) | cyMid (wordmark row centre) | cone length (burnY − cyMid) | slim-bar height |
|-------------------------|---------------------|-----------------------------|-----------------------------|-----------------|
| **Home — Tier A**       | **104**             | **28**                      | **76**                      | — (no collapse) |
| **Topic — Tier A**      | **104**             | **28**                      | **76**                      | —               |
| **Topic — slim**        | **56** (= band height when collapsed) | 28 (unchanged — the wordmark row centre is the slim-bar centre, `56/2`) | beam opacity 0 → no cone | **56**          |

Beam-internal geometry (unchanged, shared by both hosts): `beamSlope = 0.6`, `beamCrossUp = 28px`
(crossbar sits 28px above `burnY`), `beamEdgeInset = 17px`. These are intrinsic to the mark, not the
drift, and do not change.

> **Note on `beamCrossUp = 28` vs cone `76`.** The crossbar sits `28px` above `burnY` (i.e. at
> `y = 76`), which is below `cyMid = 28` — the cone still has `48px` of stem above the crossbar. This
> is unchanged from today; it is called out only so Dev/QA do not read the equal "28" values as a
> coincidence to collapse. `beamCrossUp` and `cyMid` are independent.

---

## 3. Decision 2 — the beam burns to the host's real background (fix the grey seam)

### 3.1 The problem, precisely

The beam interior and the area beneath the burn boundary are painted **`--content-white` (#FFFFFF)**
(`HeaderProjector.tsx` `Beam` fill + the band's "warm content white" fill below `burnY`). On **Home**
the hero immediately under the header is also `#FFFFFF` (`app/page.tsx` wraps the hero in
`bg-[var(--color-content-white)]`), so the white beam resolves seamlessly into the hero — exactly the
intended "two temperatures meet, no seam." On **Topic**, the page body is **`#F7F7F7`** (the
`globals.css` `body` rule); the Topic header sits sticky over a `#F7F7F7` page, so the white beam edge
meets grey and a **visible horizontal seam** appears at the burn boundary — a rendering-bug read.

### 3.2 The decision

**Parameterize the burn/landing color per host (the beam burns to the host's own page background),
rather than forcing the Topic page region white.** Add a single token the host sets:

- **`--projector-burn-bg`** — the color the beam interior, the "warm content white" band fill below
  `burnY`, and the area immediately beneath the header all resolve to. The `Beam` SVG fill and the
  band's below-boundary fill read this token instead of the hardcoded `#ffffff`.

Per host:

- **Home:** `--projector-burn-bg = #FFFFFF` (`--content-white`). Unchanged behavior — the hero is
  white, the beam burns to white. (Home is the canonical "daylight" case; keep it.)
- **Topic:** `--projector-burn-bg = #F7F7F7` (the body grey). The beam burns to the **same grey the
  Topic page already uses**, so the beam edge and the page meet with **no seam** — the projection
  lands on the page's own surface, whatever it is.

### 3.3 Why burn-to-background, not force-the-page-white

- **It preserves the metaphor faithfully.** The identity (`VISUAL_IDENTITY.md` §2.5/§9.3) is "the beam
  **burns to the content's OWN** surface and adds no chrome." The content's own surface on Topic *is*
  `#F7F7F7`. Forcing a white strip under the Topic header would (a) add chrome the article side did not
  ask for, and (b) create a *new* white→grey seam a little lower down — moving the seam, not removing
  it. Burning to the real background removes the seam outright at every point.
- **It keeps the article-faithful look intact (§9.3).** The Topic article column and rail already sit
  on `#F7F7F7`; the header projecting onto that same grey reinforces "the plus layer projects onto the
  page as it is," and touches nothing in the article body.
- **The gold edge still carries the signal on grey.** The single signal-carrying element is the **gold
  border + glow** (`#EECE87`), which is decorative and reads clearly on both `#FFFFFF` and `#F7F7F7`
  (the two backgrounds differ by ~3%); the burn-to-white *interior* was never the signal, so changing
  its terminal color to grey costs nothing in the metaphor. The aperture core stays white-hot
  (`#FFF`), unchanged — it is the lamp, independent of where the beam lands.
- **One token, no per-host forking.** This is exactly the §10.1 model: one parameterized component, a
  per-host token value. No new component, no Topic-only beam.

### 3.4 Terminal color + what's beneath, per host and state (the contract)

| Host / state        | Beam interior fill | Band fill below burnY | Area immediately beneath the header | Gold edge |
|---------------------|--------------------|-----------------------|-------------------------------------|-----------|
| **Home — Tier A**   | `#FFFFFF`          | `#FFFFFF`             | hero `#FFFFFF`                      | `#EECE87` |
| **Topic — Tier A**  | `#F7F7F7`          | `#F7F7F7`             | page body `#F7F7F7`                 | `#EECE87` |
| **Topic — slim**    | n/a (beam opacity 0) | n/a (band is the 56px slim bar; bottom shows the 2px ink rule) | page body `#F7F7F7` | n/a (beam gone) |

The cool fluorescent field **above** the burn boundary stays `--header-field` `#FAFBFE` on both hosts
(unchanged — it is the "fluorescent header" temperature, not the landing surface).

---

## 4. Decision 3 — beam-fade ↔ band-height coupling on scroll

### 4.1 The decision

**The beam fade and the band-height collapse are one coupled transition, and scroll-collapse is a
Topic-only affordance — Home does not collapse.**

- **They animate together, same timing/easing.** On the Topic host, crossing the collapse threshold
  drives a single `[data-collapsed]` state that simultaneously: (a) fades the beam, the lit lockup, and
  the lit→flat lockup cross-fade by **opacity** (`projector-beamfade` / `projector-litlockup` →
  opacity 0; `projector-flatlockup` → opacity 1); and (b) collapses the band **height** `104 → 56`.
  Both use **`180ms ease-out`** (the existing `.header-shared` transitions). Because they share the
  same trigger, duration, and easing, the beam visibly disappears *as* the band shrinks — there is
  never a frame where the beam is gone but the band still reserves its height (no dead empty band), and
  never a frame where the band has shrunk but a clipped beam is still drawn.
- **Coupling relationship (precise):** the band height and the beam opacity are **driven by the same
  boolean**, not by a shared continuous scroll-progress value. This is deliberate: a single
  threshold-flipped boolean + equal-duration CSS transitions is simpler, jank-free (no per-scroll
  layout), and reads as one motion. The beam does not need to be *proportionally* tied to height; it
  needs to **start and finish its fade in lockstep** with the height change, which equal-trigger
  equal-duration transitions guarantee.
- **Why a boolean, not scroll-linked:** scroll-linked opacity would require reading layout per scroll
  frame (jank) and gives no usability benefit here — the band is either "big at the top" or "slim while
  reading." The threshold + hysteresis (below) is the right model.

### 4.2 Threshold + hysteresis (unchanged, restated as contract)

- **Collapse** when `scrollY > COLLAPSE_AT` where `COLLAPSE_AT = TOPIC_BURN_Y = 104`.
- **Restore** when `scrollY < RESTORE_AT` where `RESTORE_AT = TOPIC_BURN_Y − 40 = 64`.
- **Between 64 and 104** the state is **sticky** (keeps its last value) — a **40px hysteresis band** so
  the header never flickers on a pixel boundary.
- The scroll listener is **passive + rAF-gated**, reading only `window.scrollY` (a cheap read, no
  layout flush). It **never** re-measures the seam/divider on scroll (that is mount/resize only).

### 4.3 Home does not collapse — justification

- **Home has nothing to collapse into.** Home is a free-standing hero, not a sticky bar over scrolling
  article content; there is no long scroll surface where a shrinking sticky header earns its keep. The
  hero (search + explanation) is the page's purpose and scrolls away normally.
- **Home's header is not sticky.** Making Home collapse would require making it sticky and inventing a
  slim Home state that serves no reading task — added complexity, no user benefit, and a new way for
  the two hosts to drift. Keeping collapse Topic-only is the *consistent* choice: both hosts share one
  Tier-A geometry (Decision 1); Topic alone adds the scroll layer because Topic alone has the
  long-article reading task that needs it.
- **Consistency is preserved because Tier A is identical.** A reader landing on Home and then a Topic
  sees the *same* header at rest (same 104/28 band, same lockup, same beam-to-background); the only
  difference appears *after they scroll into an article*, which is a different task on a different kind
  of page. That is felt as "the header gets out of the way to let me read," not as drift.

### 4.4 Reduced motion (binding)

- Under **`prefers-reduced-motion: reduce`**, the height + opacity **transitions are removed** (the
  existing `@media (prefers-reduced-motion: no-preference)` gate already scopes the transitions, so a
  reduce preference gets **end-states with no tween**). The slim state is still **reached** — the band
  is 56px and the flat lockup is shown when collapsed — it simply snaps rather than animates. No
  motion is ever *required* to use the header.
- This matches the project's standing reduced-motion posture (`globals.css` §"Reduced motion") and
  `VISUAL_IDENTITY.md` §6.5/§7.4.

---

## 5. Every state of the header (the full matrix)

Each cell is the contract for that state. Logged-out vs logged-in differs only in the auth slot
content (the `AuthControl` skin — inherited from the issue-C spec, not re-specified here); the
**header geometry/beam/background** is identical between the two, so they are not split out as separate
rows except where noted.

### 5.1 Home — static (no collapse)

- Band height **104**, wordmark row centre **28**, beam burns to **`#FFFFFF`**, hero beneath is
  `#FFFFFF` — no seam. Beam always lit (no `collapsed` prop). One row: lockup + single right-anchored
  `AuthControl`. No search slot. Wordmark is the home link.
- **Responsive:** lockup centred ≥ md (apex at `cw/2`), left-anchored < md (apex at
  `leftInset + apertureX`); the lockup scales down on the smallest phones (`.projector-lockup-fit`,
  transform-origin = the aperture) so the left lockup + right auth fit one row. Beam is true-scale at
  every width (no tier-drop).

### 5.2 Topic — Tier A (scroll-top, `scrollY ≤ 64` after a restore, or initial top)

- Band height **104**, wordmark row centre **28**, beam burns to **`#F7F7F7`**, page beneath is
  `#F7F7F7` — no seam. Lit aperture + full beam. `projector-flatlockup` opacity 0 (present + focusable
  in the DOM but invisible — see a11y §7). Bottom rule: **none** (the beam burns into the page).
- **Seam-on-divider ≥ lg (1024px):** the lockup's internal seam aligns to the article↔rail gutter
  centre, driven onto the apex via the measured `projectionX` (`gutterCentre + APERTURE_SEAM_OFFSET`)
  ÷ band width. Measured at **mount + resize only**, never per scroll.
- **< lg (stacked):** no divider — the lockup is self-contained, left-anchored past the reserved search
  box (`leftInset = SEARCH_RESERVE = 64`), so it never overlaps the upper-left search.
- **Search slot:** inline compact field **≥ md**; icon-disclosure **< md** (exactly one interactive per
  width, CSS-gated). Upper-left.
- **Auth:** single `AuthControl`, right-anchored, same DOM node in both scroll states.

### 5.3 Topic — slim (scrolled, `scrollY > 104`)

- Band collapses to **56**. Beam + lit lockup faded to opacity 0; **flat Tier-C lockup** faded to
  opacity 1 at the **same shared origin** (no horizontal jump, no double wordmark — the single-origin
  cross-fade, #72 DEFECT-B). Bottom rule: **2px solid `--ink`** (the committed Topic slim-bar rule —
  a defined edge over the scrolling article).
- **Slim-state title cue (A4):** a muted serif `<span>` of the article display title appears in the
  chrome row middle, ≥ md only, `aria-hidden`, truncating first under width pressure. Not a heading
  (the real `<h1>` is in the lead block). Slim state only.
- Search + auth: same nodes as Tier A (no remount, focus preserved).
- **Seam-on-divider holds in the slim bar too** (the flat lockup is at the same shared origin, so at
  ≥ lg the flat wordmark's seam still lands on the gutter centre).

### 5.4 Topic — the in-between transition (`64 < scrollY < 104` crossing)

- The 40px hysteresis band: the state **keeps its last value** while in this range — it does not
  oscillate. The visible transition (when a threshold is actually crossed) is the single coupled
  180ms ease-out: band height `104↔56` + beam/lockup opacity, together (Decision 3). Under reduced
  motion, the end-state snaps with no tween.

### 5.5 Topic — squeeze (`< SQUEEZE_BREAKPOINT = 380px`)

- The full lockup would crowd the upper-left search, so the wordmark collapses to the sanctioned
  **Tier-D `glyph` tile** (the "+" block alone) as the home link, left-anchored at `leftInset`, no
  beam, no full lockup — so search + auth always have room. This is unchanged from #72 (DEFECT-A) and
  is restated only for completeness; the geometry change (Decision 1) does not affect it.

### 5.6 Forced-colors / high-contrast (every host/state)

- The burn-to-white/grey + gold beam cannot survive a forced palette: drop the beam + lit lockup and
  keep the **flat lockup** (serif "Wiki" + bordered "+" block) visible at every scroll state, plus
  search + auth operable. Driven by `@media (forced-colors: active)` (no JS). Unchanged.

---

## 6. Auth-slot adjustment (consequence of Decision 1 on Home)

Home's auth slot is absolutely positioned with a fixed `height: 88` to centre on the **old** `cyMid=44`
wordmark row (`SiteHeader.tsx` `HomeSiteHeader`, `style={{ height: 88 }}` ≈ `cyMid·2`). With `cyMid`
now **28**, the auth slot must re-centre on the new row: set its height to **`56`** (= `cyMid·2`) so it
stays vertically centred on the wordmark row. (Topic's auth lives in the 56px chrome row and already
centres correctly — no change there.) This is the only call-site consequence of the geometry change on
Home; the lockup itself re-centres automatically from the token defaults.

---

## 7. Accessibility

Accessibility is baseline (`CLAUDE.md`). This refinement does not change the a11y *model*
(`VISUAL_IDENTITY.md` §7) but must hold it through the new values.

- **Wordmark contrast in every state.** The serif "Wiki" is `#1B1B1B` on the cool field `#FAFBFE`
  (~17:1 — AA/AAA) — unchanged by `cyMid`/`burnY`. The flat slim lockup serif "Wiki" sits on the slim
  bar's `#FAFBFE` (same ~17:1). The "plus" block keeps white on `#676EB4` (~3.9:1, **AA-large** at
  Source Sans Pro 900 ~26px — the exemption holds; do not shrink it). **No wordmark text ever lands on
  the `#F7F7F7` grey** — the lockup sits in the cool field above the burn boundary; only the
  *decorative* beam burns down to grey. So the background change (Decision 2) touches no text contrast.
- **The gold beam edge is decorative, never the sole carrier of meaning** (§7.2/§7.3) — exempt from
  text-contrast on both `#FFFFFF` and `#F7F7F7`. It must still never encode a functional state.
- **Focus states.** The wordmark home link (the flat lockup) stays in the DOM and **focusable in both
  scroll states**, including when opacity 0 at Tier A — `:focus-within`/`:focus` reveals it (opacity 1)
  so the focus target is never invisible (existing `.header-shared .projector-flatlockup:focus*` rule).
  Search field + auth keep their existing focus cues (the search-field border-recolor; the
  surface-adaptive auth-trigger ring). Tab order: wordmark → search → auth, identical in both scroll
  states.
- **Reduced motion.** Decision 3 §4.4 — transitions removed, end-states reached, no tween. Binding.
- **The slim title cue is `aria-hidden`** and not a heading (the real `<h1>` is the lead). Unchanged.
- **Accessible name** remains the single `aria-label="wiki+"` on the container; every decorative layer
  `aria-hidden`. Unchanged.

---

## 8. Acceptance criteria (the contract Dev builds to, QA verifies against)

Numbered, testable. "Equal" / pixel claims are measurable from the rendered DOM (computed band height,
the `--projector-*` token values, the data-attributes the beam already exposes).

**Decision 1 — unified geometry:**

- **AC1.** Home and Topic render an **identical Tier-A band height of `104px`** at the same viewport
  width (logged-out and logged-in, ≥ lg and < lg). No host shows a `130px` band.
- **AC2.** Home and Topic Tier-A **wordmark row centre is `28px`** from the band top (cyMid), and the
  cone length (`burnY − cyMid`) is **`76px`** on both.
- **AC3.** The `--projector-*` token **defaults** (in `globals.css` and the mirrored JS defaults in
  `HeaderProjector.tsx`) are `burnY = 104`, `cyMid = 28`; **Home passes no `geometry` overrides** (it
  is one configuration of the defaults — the §10.1 no-fork rule).
- **AC4.** Topic's Tier-A wordmark row centres on the **56px chrome row** (search + auth cards), i.e.
  `cyMid = SLIM_BAR_HEIGHT / 2`; the lit lockup visually aligns with the search + auth cards.
- **AC5.** No other view forks the header or introduces a bespoke header; both hosts use `SiteHeader` →
  the one `HeaderProjector` (the universal-header principle, §10.1).

**Decision 2 — beam-to-background:**

- **AC6.** A new token **`--projector-burn-bg`** drives the beam interior fill **and** the band's
  below-`burnY` fill (replacing the hardcoded `#ffffff` in `Beam` + the band).
- **AC7.** On **Home**, `--projector-burn-bg = #FFFFFF`; the beam burns to white and resolves into the
  white hero with **no visible seam** at the burn boundary.
- **AC8.** On **Topic**, `--projector-burn-bg = #F7F7F7` (the body grey); at Tier A there is **no
  visible horizontal seam** where the beam edge meets the page background (the prior white→grey seam is
  gone).
- **AC9.** The cool fluorescent field **above** the burn boundary stays `#FAFBFE` on both hosts; the
  aperture white-hot core stays `#FFFFFF` on both. The gold edge stays `#EECE87`.
- **AC10.** No chrome (no border, tint, or strip) is added to the **article body** by this change
  (§9.3 — article fidelity preserved).

**Decision 3 — coupling:**

- **AC11.** On Topic, crossing `scrollY > 104` (down) collapses the band **`104 → 56`** AND fades the
  beam + lit lockup to opacity 0 AND fades the flat lockup to opacity 1 — all from the **same
  `[data-collapsed]` state**, with the **same `180ms ease-out`** timing, so there is no frame with a
  faded beam over a full-height band or vice-versa.
- **AC12.** Restore at `scrollY < 64` (up); between 64 and 104 the state **holds its last value** (40px
  hysteresis) — no flicker on a pixel boundary.
- **AC13.** The scroll listener reads only `window.scrollY` (passive, rAF-gated) and **never** measures
  the seam/divider on scroll (mount/resize only).
- **AC14.** **Home does not collapse** — it has no `collapsed` prop, no sticky behavior, no slim state;
  its header is unchanged in behavior by this spec (only its Tier-A geometry values move per Decision 1).
- **AC15.** Under `prefers-reduced-motion: reduce`, the collapse reaches the **end-state with no tween**
  (band 56, beam gone, flat lockup shown); no transition animates.

**Cross-cutting / regression:**

- **AC16.** Home's auth slot stays **vertically centred on the new `cyMid=28` wordmark row** (slot
  height re-pinned to `56`); the auth control does not drift above/below the wordmark and never folds
  to a second row at any width.
- **AC17.** All a11y holds: wordmark "Wiki" ≥ AA on its field in every state; the wordmark home link is
  focusable in both scroll states (revealed on focus when opacity 0); tab order wordmark → search →
  auth identical in both states; the single `aria-label="wiki+"` name and `aria-hidden` decorative
  layers are unchanged.
- **AC18.** UX evaluation evidence is the **standard screenshot matrix** (`scripts/dev/shots.sh` —
  logged-out/logged-in × widths × states across Home + Topic), showing: equal Tier-A band on both
  hosts; no beam seam on Topic; the coupled collapse on Topic; Home unchanged behavior.

---

## 9. Out of scope (route elsewhere)

- The context-note / stance / accuracy vocabulary → **Curation/Editorial**.
- Any change to the lockup anatomy, the burn metaphor, the tiers, or the seam-on-divider *mechanism* →
  not this spec (those are `VISUAL_IDENTITY.md` LOCKED; this only changes geometry *values*, one
  background token, and confirms the coupling).
- A dark-mode projector → still an open question (`VISUAL_IDENTITY.md` §6.4 / §10.2 #5); not here.
- Implementation/code → **Development** (this spec is the input; they build).
- Correctness/security verification → **QA & Review**.
