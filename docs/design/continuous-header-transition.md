# Design spec — Continuous, scroll-linked Topic header transition (issue #96)

**Role:** UX / Design · **Status:** design contract, written **before** implementation — Dev builds
from this · **Phase:** prototype · **Supersedes:** Decision 3 of `docs/design/header-topic-integration.md`
(the PR #89 boolean coupling) and the `~180ms` boolean-tween clause in `docs/VISUAL_IDENTITY.md` §10.2
#6. Everything else in #89 and §10.2 #6 **stands unchanged** — the unified 104/28 Tier-A geometry, the
seam-on-divider mechanism, the white-beam + two-temperature (cool `#fafbfe` field / warm `#ffffff`
content) colors and their **end-states**. This spec changes only **how those end-states transition**.

---

## 0. Summary — one value drives everything

Today the Topic header collapse is a **boolean**: a `[data-collapsed]` flag flips at `scrollY > 104`
(restores at `< 64`, a 40px hysteresis band), and three things react on their own clocks — the band
**height** and the beam/lockup **opacity** each run a fixed **180ms CSS tween**, while the header's
internal cool→white temperature boundary is laid out at a **fixed** `burnY = 104px` inside an
`overflow-hidden` beam layer that does **not** collapse with the band. Because these are not driven by
the same value, three defects appear (issue #96):

1. **Mid-scroll color seam** — a hard beam-white / Topic-grey boundary is visible while scrolling
   inside/above the hysteresis band, because the projector's internal cool-field (`#fafbfe`) → warm
   content-white (`#ffffff`) edge sits at a fixed 104px and is revealed/clipped independently of the
   collapsing band edge.
2. **Height doesn't track the beam** — the band height only changes at the threshold flip (then tweens
   to the other fixed value), so it does not recede *with* the beam as you scroll.
3. **Border appears abruptly** — the 2px ink bottom rule toggles on instantly with `[data-collapsed]`
   instead of fading in as the beam fades out.

**The new model.** Replace the boolean with a single **normalized scroll progress** `p ∈ [0, 1]`
computed from `window.scrollY` over a fixed range, and drive **every** transitioning property from that
one `p`, in lockstep, every frame. `p = 0` is the full Tier-A projector (scroll-top); `p = 1` is the
slim Tier-C bar. There is no threshold, no flip, no per-property tween — the only animator is the
scroll position itself. Because one value drives band height, beam opacity, the burn-boundary position,
and the border opacity together, no property can lag another and no independently-scrolling edge can
form (the crux of defect #1).

This is user-facing polish: the header should feel like it is *physically receding* as the reader
scrolls into the article — one continuous gesture — rather than snapping between two states.

---

## 1. Who this serves (user stories)

The personas are the committed Topic-page personas (`docs/design/topic-page-v1.md`); this is a
refinement of an existing surface, so the stories are narrow:

- **As a reader scrolling into an article,** I want the header to recede smoothly and predictably as I
  scroll, so the chrome feels like one calm continuous motion and never a jarring snap or a flicker —
  so my attention stays on the article, not on the header redrawing itself.
- **As a reader who scrolls slowly (or drags a scrollbar / uses trackpad inertia),** I want to never
  see a stray grey/white seam or a border pop in mid-gesture, so the surface reads as finished and
  trustworthy.
- **As a reader who scrolls back up to the top,** I want the full projector to return exactly as
  smoothly as it left (perfect reversibility), so up and down feel like the same motion run backward.
- **As a reader with `prefers-reduced-motion: reduce`,** I want the header to settle into a sensible
  state without any motion that isn't the scroll I'm already driving — the header must never *add*
  motion of its own.
- **As a keyboard or screen-reader user,** I want the home-link wordmark and the search/auth chrome to
  stay reachable, named, and AA-legible at **every** point in the transition, not just at the two ends.

These feed Product's acceptance criteria; they do not replace them.

---

## 2. What does NOT change (inherited from #89 / VISUAL_IDENTITY §10)

Locked by prior contracts — Dev must preserve these exactly:

- **Tier-A geometry:** `burnY = 104` (`TOPIC_BURN_Y`), `cyMid = 28` (`TOPIC_CY_MID`), `SLIM_BAR_HEIGHT
  = 56`, `beamSlope = 0.6`, `crossUp = 28`, `edgeInset = 17`. (`SiteHeader.tsx`,
  `HeaderProjector.tsx`.)
- **Slim end height = 56px** (`SLIM_BAR_HEIGHT`) — confirmed; the chrome row (search + title cue +
  auth) is laid out at this height and must remain reachable in both states.
- **Two-temperature surface & colors:** cool fluorescent field `--color-header-field` (`#fafbfe`) above
  the burn boundary, warm content white `--color-content-white` (`#ffffff`) at/below it; the beam
  interior is `#ffffff`; the gold edge (`#EECE87`) carries the beam signal. **Unchanged.**
- **Seam-on-divider:** the mount/resize `projectionX` probe (≥ `lg`), self-contained left-anchored
  lockup (< `lg`), the `SQUEEZE_BREAKPOINT = 380` glyph fallback. **Unchanged** — `p` is orthogonal to
  the horizontal seam math; it never triggers a re-measure (§6).
- **The single-origin cross-fade** (DEFECT-B): lit lockup + beam and the flat slim lockup share one
  lockup origin in one `HeaderProjector` instance, so only opacity changes between them. **Unchanged** —
  we are replacing the *driver* of that opacity (boolean → `p`), not the single-origin structure.
- **Lockup anatomy, the aperture/rim/bleed/"pedia" ghost, search & auth chrome, the article body.**
  Untouched.

The end-states (`p = 0` and `p = 1`) are **pixel-identical** to today's Tier-A and slim states. Only
the path between them changes.

---

## 3. The progress model

### 3.1 The driving value `p`

```
p = clamp((scrollY − P_START) / (P_END − P_START), 0, 1)
```

- **`P_START = 0px`** — the transition begins the instant the reader leaves the very top.
- **`P_END = 104px`** — the transition completes exactly as the document has scrolled by the Tier-A
  band height (`TOPIC_BURN_Y`). At `p = 1` the original full-height band has scrolled entirely out of
  view, so completing the collapse precisely here is what makes the receding band feel "attached to" the
  page it is sliding under.

**Why `0 → 104` (chosen range).** The issue proposes `~0 → 104` and asks us to confirm. We confirm
**`0 → 104`**, for three reasons:

1. **It ties the motion to a meaningful physical distance** — the band's own full height. The header
   finishes collapsing exactly as a band-height of article has passed beneath it, so the gesture reads
   as the band receding *with* the scroll rather than over an arbitrary distance.
2. **104px is long enough not to feel twitchy.** A shorter range (e.g. `0 → 56`) makes the full→slim
   collapse complete in a flick of the wheel and reads as abrupt; 104px gives the eye time to register
   one continuous recession. A much longer range (e.g. `0 → 240`) makes the header feel like it's
   "lagging" the scroll. 104px is the natural middle, and it equals geometry we already commit to.
3. **It starts at 0**, so there is **no dead zone** at the top where scrolling does nothing — the
   beam begins receding immediately, which is what makes the motion feel scroll-*linked* rather than
   threshold-triggered.

`P_START`/`P_END` are the only two new tunables. Pin them as constants next to the existing
`COLLAPSE_AT`/`RESTORE_AT` (which are removed — §3.4), e.g. `PROGRESS_START = 0`, `PROGRESS_END =
TOPIC_BURN_Y`.

### 3.2 What `p` drives (the four properties, in lockstep)

| # | Property | Maps from | To | Curve | Notes |
|---|---|---|---|---|---|
| 1 | **Band height** | `104px` (`TOPIC_BURN_Y`) | `56px` (`SLIM_BAR_HEIGHT`) | **linear** | `height = 104 − 48·p`. The crux of defect #2 — height now tracks `p` continuously, not a flip. |
| 2 | **Burn boundary** (the projector's internal cool→white edge) | `104px` | `56px` | **linear, identical to #1** | Pinned to the band bottom at every `p` — this is the crux of defect #1 (see §4). |
| 3 | **Beam + lit-lockup opacity** | `1` | `0` | **eased — `easeOutCubic`** | Beam fully gone slightly before `p = 1` (see §3.3). |
| 4 | **Flat-lockup opacity** | `0` | `1` | **eased — `easeInCubic`** (mirror of #3) | Cross-fades against the beam; the interactive home link. |
| 5 | **Bottom-border opacity** | `0` | `1` | **eased — `easeInQuad`**, gated to the back half (see §3.3) | 2px solid `--ink` (`#2C2C2C`); the crux of defect #3. |

Note: the band-height **edge** (#1) and the internal burn-boundary (#2) are driven by the *same* linear
expression on purpose — they must be the **same number at every `p`** so the projector's white→cool edge
sits exactly on the band's bottom edge and can never separate (§4). Treat #1 and #2 as one value.

### 3.3 Curves — why each is what it is

- **Height & burn boundary → linear.** Position-following layout should track the scroll 1:1, with no
  ease, so the band edge feels rigidly *attached* to the scroll distance. Any easing here would make the
  band appear to drift ahead of or behind the finger/wheel and re-introduce a perceived lag. Linear is
  the honest mapping of "the band recedes as the page scrolls."
- **Beam / lit-lockup opacity → `easeOutCubic` (fast at the start, settling near the end).** The beam
  should begin dissolving immediately and noticeably as the reader leaves the top (reinforcing "this is
  scroll-linked"), then ease so the **last** of the beam is gone by roughly `p ≈ 0.85`, not lingering as
  a faint ghost exactly when the slim bar is meant to read as solid. Map the opacity over a slightly
  compressed sub-range so it completes before `p = 1`:
  `beamOpacity = 1 − easeOutCubic(clamp(p / 0.85, 0, 1))`.
  This guarantees the beam is fully `0` for the final stretch and the slim bar is unambiguous at the end.
- **Flat-lockup opacity → `easeInCubic`, the mirror.** `flatOpacity = easeInCubic(clamp((p − 0.15) /
  0.85, 0, 1))` — it starts rising a touch after the beam starts fading (a short overlap, not a
  hard hand-off) and reaches `1` by `p = 1`. Because both lockups sit at the **identical** origin
  (single-origin, §2), this is a pure opacity cross-fade with no positional movement. The two cubic
  curves crossing produce a clean dissolve with no muddy mid-point where both read at full strength.
- **Bottom-border opacity → `easeInQuad`, gated to the back half.** `borderOpacity =
  easeInQuad(clamp((p − 0.5) / 0.5, 0, 1))`. The border is the slim bar's defining edge; it should
  **not** be visible while the beam is still clearly present (that would read as two competing bottom
  edges — the beam's gold glow and the ink rule at once). Holding it at `0` until `p = 0.5` and easing
  it in over the back half means it fades up exactly as the beam fades out, arriving at full strength as
  the slim bar lands — the crux of defect #3. (See §4.4 for the contrast consequence.)

All easing functions are standard, cheap, allocation-free scalar math; no library. `easeOutCubic(t) =
1 − (1 − t)³`, `easeInCubic(t) = t³`, `easeInQuad(t) = t²`.

### 3.4 Hysteresis — **dropped**

**Decision: remove the 40px hysteresis band** (`COLLAPSE_AT = 104` / `RESTORE_AT = 64`). Justification:
hysteresis exists to stop a **boolean** from chattering when `scrollY` dithers across a single
threshold pixel. A continuous mapping has **no threshold** — `p` is a smooth function of `scrollY`, so a
one-pixel scroll jitter produces a one-pixel-worth change in `p` (sub-1% of the range) and renders as an
imperceptible nudge, never a flip. Keeping hysteresis with a continuous model would actually *hurt*:
it would make the down-scroll and up-scroll paths asymmetric (violating the reversibility story in §1)
and create a 40px zone where `p` is frozen — a visible "stuck" patch mid-gesture. So hysteresis is
**not needed and is removed**; `p` is computed identically regardless of scroll direction, which makes
the transition perfectly reversible by construction (§5.6).

---

## 4. Defect #1 — killing the color seam (the crux)

This is the heart of the spec, so it is called out separately.

### 4.1 Why the seam exists today

The Topic header renders the projector inside `header-beam`, an `absolute … overflow-hidden` layer
whose height is hard-pinned to `TOPIC_BURN_Y` (104px) — it does **not** collapse with the outer
`header-band`. Inside the projector band the cool field (`#fafbfe`) is painted from `top` to `burnY`
and the warm content-white (`#ffffff`) from `burnY` down; the beam burns to white exactly at `burnY`.
So the projector contains an internal cool→warm temperature edge fixed at `y = 104`. When the outer band
collapses to 56px (boolean flip) but the inner beam layer stays 104px tall behind a separately-fading
opacity, that fixed internal edge is revealed against, and clipped by, the moving band edge on a
**different clock** — the reader sees a hard `#fafbfe`/`#ffffff` (cool-grey vs white) boundary slide
through the band. That is the seam.

### 4.2 The fix — pin the burn boundary to the band edge at every `p`

**Make the projector's burn boundary equal the live band height at all times.** Concretely, the value
that drives the cool/warm split and the beam's burn-to-white **is `p`-derived band height (#2 = #1),
not a constant `104`.** Two equivalent implementation routes (Dev's choice, §6):

- **(A) Drive `burnY` as a CSS variable.** Expose `--topic-burn-y` (and feed it into the
  `HeaderProjector` band: the cool field `height`, the content-white `top`, and the beam clip height)
  set each frame to the same `104 − 48·p`. Then the cool→warm edge **is** the band's bottom edge by
  construction; there is no second edge to scroll independently. The beam's interior is white right at
  that edge and the content below is white, so the boundary is invisible (exactly the #89 burn-to-white
  intent), and as the band shrinks the white simply takes over more of the band until, at `p = 1`, the
  56px slim bar is uniform.
- **(B) Clip the whole projector layer to the live band height** *and* collapse the internal cool/warm
  split with it. Equivalent end result; (A) is preferred because it keeps the burn-to-white seamless
  rather than hard-clipping a cool field against the article.

Either way the **invariant** is: *at every `p`, the projector's internal cool→white edge is at the same
y as the band's bottom edge.* No independently-positioned white/grey edge can exist, because there is
only **one** edge and it is `p`-driven. This is what makes the seam structurally impossible, not merely
tuned away.

### 4.3 The beam recedes, it does not just clip

Because `burnY` now decreases with `p`, the beam's flare room (`burnY − cyMid`) shrinks continuously
from `76px` (104 − 28) toward `28px` (56 − 28) as it also fades to 0 opacity. The beam genuinely
*recedes and compresses* into the slim bar rather than holding full size behind a fading curtain — this
is what defect #2 ("height doesn't track the beam") asks for, and it falls out of #2 = #1 for free.
The beam is fully transparent by `p ≈ 0.85` (§3.3), so the final compression is not even visible — by
the time the band is near 56px the beam is already gone and only the flat lockup remains.

### 4.4 Contrast holds across the transition (AA)

The cool field never gets darker than `#fafbfe` and the content/beam interior is `#ffffff`; the serif
"Wiki" (`#1b1b1b`) and the flat-lockup text sit on one of those two near-white surfaces at every `p`, so
the ~17:1 "Wiki"-on-field ratio (VISUAL_IDENTITY §7.2) holds throughout — there is no intermediate
surface color that degrades contrast. The flat lockup's "plus" keeps its AA-large exemption (white on
indigo `#676EB4`, ≥ 18.66px bold) at every `p` since the block color does not change. **Border caveat:**
the 2px ink rule is decorative (a zine-block edge, not a meaningful signal — §3.3 holds it out of the
beam-present range), so its fade-in carries no contrast requirement; but it lands at full `#2C2C2C`
(AA-strong against both `#fafbfe` and `#ffffff`) by `p = 1`.

---

## 5. Every state (the spec contract)

Geometry per state, for Dev to build and for UX to evaluate against. "Band" = outer band height; "Beam"
= beam+lit-lockup opacity; "Flat" = flat-lockup opacity; "Border" = bottom-rule opacity. Values from the
§3 formulas; rounded for legibility.

| State | `scrollY` | `p` | Band h | Burn-y (=band h) | Beam | Flat | Border | Reads as |
|---|---|---|---|---|---|---|---|---|
| **Scrolled-to-top** | `0` | `0.00` | 104 | 104 | 1.00 | 0.00 | 0.00 | Full Tier-A projector: lit aperture, full beam burning to white at the band bottom, seam on divider (≥ lg). **Pixel-identical to today's Tier A.** |
| **~25%** | `26` | `0.25` | 92 | 92 | ~0.58 | ~0.01 | 0.00 | Beam visibly receding & dimming; band lower; no border yet; cool→white edge still pinned to the (lower) band bottom — no seam. |
| **~50%** | `52` | `0.50` | 80 | 80 | ~0.13 | ~0.06 | 0.00 | Beam nearly gone; flat lockup emerging; border just about to begin. The cross-over point — clean dissolve, no double-strength wordmark. |
| **~75%** | `78` | `0.75` | 68 | 68 | 0.00 | ~0.42 | ~0.25 | Beam fully gone (past 0.85 sub-range is close); flat lockup dominant; ink rule fading up. |
| **Fully-slim** | `≥ 104` | `1.00` | 56 | 56 | 0.00 | 1.00 | 1.00 | Slim Tier-C bar: flat wordmark + search + title cue + auth, 2px ink bottom rule at full strength. **Pixel-identical to today's slim state.** |
| **Scroll-up reversibility** | any, decreasing | recomputed | — | — | — | — | — | `p` is a pure function of `scrollY` (§3.4), so scrolling up retraces the identical path in reverse — frame-for-frame symmetric with scroll-down. No hysteresis asymmetry. |
| **Deep-link / refresh mid-article** | `> 104` on mount | `1.00` | 56 | 56 | 0.00 | 1.00 | 1.00 | The initial `p` is computed on mount from the restored `scrollY` (the existing `evaluate()` initial call), so a refresh deep in the article paints the correct slim state with no flash of Tier-A. |

**Empty / loading / error:** the header transition is independent of article/clip data state — it is
chrome. In all of those Topic-page states the header behaves exactly as above (driven only by
`scrollY`); there is no header-specific empty/loading/error variant to design. (The slim title cue is
absent until `articleTitle` is known, per the existing `articleTitle && collapsed` gate — see §5.1.)

### 5.1 The slim title-cue (`A4`) under the continuous model

Today the muted article-title cue renders on `articleTitle && collapsed`. With `collapsed` gone (§3.4),
gate it on a derived boolean **`isSlim = p >= 0.5`** (or fade its opacity with the same back-half curve
as the flat lockup if Dev prefers a fade — either is acceptable; a hard show at `p ≥ 0.5` is fine since
it is a muted, aria-hidden span, not a focus target). It must never appear while the beam still reads
(it would clutter the lit state), and it must be present once the slim bar has landed. Keep it
`aria-hidden`, `truncate`, `md:`-gated, yielding first under width pressure — unchanged from #89.

---

## 6. Implementation guidance (cheap, no layout thrash)

This is design intent; Dev owns the code. But the performance contract is part of the spec because a
naive build would thrash.

- **One source of truth.** A single passive, **rAF-gated** scroll handler (the existing pattern in
  `TopicSiteHeader`) reads **only** `window.scrollY`, computes `p`, and writes it out **once per frame**.
  It must **not** read layout (no `getBoundingClientRect`, no `offsetHeight`) in the scroll path — `p`
  is pure arithmetic on `scrollY`. The seam `projectionX` probe stays **mount/resize only** (§2); `p`
  never triggers a re-measure.
- **Write `p` as a CSS custom property on the header**, e.g. `--p` (and/or the derived
  `--topic-burn-y`, `--beam-opacity`, `--flat-opacity`, `--border-opacity`), then let CSS `calc()` /
  the projector consume them. Writing one or a few custom properties on a single element per frame is
  cheap and avoids React re-render churn — prefer a `ref` + `style.setProperty` over `setState(p)` so a
  120Hz scroll does not re-render the tree 120×/s. (A `setState`-per-frame approach is acceptable for
  the prototype if measured smooth, but the `ref`/CSS-var path is the recommended one.)
- **Safe to animate per-frame: `opacity` and `transform`** (compositor-only, no layout/paint). The
  beam, lit-lockup, flat-lockup, and border are all **opacity** — cheap.
- **Animate `height` with care.** Band height is a **layout** property; changing it every frame relays
  out the header. This is acceptable because (a) the header is `position: sticky` and its descendants
  are absolutely positioned (the chrome row, the beam layer), so the band-height change does **not**
  reflow the article body — it only resizes the sticky header box; and (b) it changes by ≤ 48px total
  over the gesture. **Do not** also animate any property that would force a synchronous layout read in
  the same frame. If Dev measures jank on low-end devices, the fallback is to drive the visual collapse
  with a `transform: scaleY` / `translateY` on inner layers (compositor-only) while snapping the actual
  `height` less frequently — but start with the straightforward `height` write and only optimize if a
  real measurement shows thrash. Either way, the **burn boundary must stay equal to the visible band
  bottom** (§4.2) — that invariant is non-negotiable; the perf technique is not.
- **No per-property CSS `transition`.** Remove the `transition: height 180ms` and `transition: opacity
  180ms` rules from `.header-shared` (globals.css §169–179). With `p` driven every frame, a CSS
  transition would *fight* the scroll (double-animating) and reintroduce lag. The scroll **is** the
  animation. (Keep a transition only where §7 calls for it under reduced motion.)
- **Clamp and guard.** `p` clamps to `[0,1]`. Guard the initial mount read (the existing `evaluate()`
  call) so a deep-linked scroll position paints the right `p` on first frame (§5 last row).

---

## 7. Reduced motion (`prefers-reduced-motion: reduce`)

**Stance.** A scroll-linked position that the user is *directly driving* with their own scroll is not
vestibular, self-propelled "motion" in the WCAG 2.3.3 sense — it is the same class as a sticky header or
a scroll position itself, which reduced-motion does not forbid. So the continuous transition is, in
principle, allowed under reduced motion. **However**, the safe and predictable degradation — and the
one consistent with VISUAL_IDENTITY §6.5/§7.4 and the existing `.header-shared` reduced-motion handling
(which currently applies end-states with no tween) — is:

- **Under `prefers-reduced-motion: reduce`, snap to end-states.** Treat `p` as **quantized to {0, 1}**:
  `p = 0` while `scrollY ≤ P_END/2` (≈ 52px), `p = 1` above it. The header is either the full projector
  or the slim bar — no intermediate frames, no continuous recession. This guarantees zero added motion
  beyond the discrete state the reader's own scroll selects, and it is the most conservative reading.
- **No CSS `transition` is added back** under reduced motion either — the end-states apply instantly at
  the midpoint crossing (exactly today's reduced-motion behavior). The only change from today is the
  crossover point (a single `p = 0.5` boundary) instead of the 64/104 hysteresis pair.
- Because the reduced-motion path collapses `p` to a boolean, a **tiny** dead-band around the `0.5`
  crossover is acceptable here (e.g. flip to slim at `p ≥ 0.55`, back to full at `p ≤ 0.45`) purely to
  avoid a 1px chatter in this *quantized* path — this is the only place hysteresis returns, and only
  because the quantized path is boolean again. The continuous (no-preference) path keeps **no**
  hysteresis (§3.4).

This keeps the reduced-motion experience identical in spirit to today (two clean states, no tween)
while the default experience gains the continuous gesture.

---

## 8. Accessibility (beyond reduced motion)

- **Contrast at every `p`:** holds — §4.4. No intermediate surface color is introduced; all text sits on
  `#fafbfe` or `#ffffff` throughout.
- **Focus states:** the flat-lockup home link, search, and auth are the **same DOM nodes** at every `p`
  (single-origin, unchanged from #89), so focus is never lost during the transition. The existing rule
  that reveals the flat lockup's focus ring even when it is `opacity: 0` at `p = 0`
  (`.projector-flatlockup:focus / :focus-within { opacity: 1 }`) **must be preserved** — a keyboard user
  tabbing to the wordmark at scroll-top must see a visible focus ring even though the flat layer is
  transparent there. (Verify it still fires when opacity is driven by a CSS var rather than the
  `[data-collapsed]` selector — the `:focus`/`:focus-within` override must win over the var-driven
  opacity. If a CSS-var opacity can't be overridden by a later rule, set the focus opacity via a
  higher-specificity rule or `!important`, or have the focus handler bump the var.)
- **Reachability:** no node is added or removed across the transition (the title cue's show/hide is the
  one exception and it is `aria-hidden` decoration). Keyboard tab order is stable from `p = 0` to `1`.
- **Forced colors:** unchanged — the existing `@media (forced-colors: active)` rules drop the beam/lit
  layers and pin the flat lockup visible at every scroll state; `p` does not affect this path.

---

## 9. Acceptance checklist (for UX evaluation of the build)

Build is done (for UX sign-off, distinct from QA) when, on the running Topic page:

1. Scrolling slowly from top, the beam **continuously** dims and the band **continuously** shrinks in
   lockstep — no snap, no flip, no stalled patch. (defects #1/#2)
2. At **no** scroll offset is a hard `#fafbfe`/`#ffffff` (grey/white) seam visible inside or below the
   band. (defect #1 — the structural fix, §4.2)
3. The 2px `#2C2C2C` bottom rule **fades in** over the back half of the gesture and is absent while the
   beam still reads; it is at full strength when the slim bar lands. (defect #3)
4. Scrolling back up retraces the identical path in reverse with no asymmetry or "stuck" zone (no
   hysteresis). (§3.4 / §5.6)
5. `p = 0` and `p = 1` are visually identical to today's Tier-A and slim states (no regression to the
   end-states). (§2)
6. Under `prefers-reduced-motion: reduce`, the header shows only the two end-states with no intermediate
   frames. (§7)
7. Keyboard focus on the wordmark shows a visible ring at scroll-top; focus is never lost across the
   transition. (§8)
8. Smooth on a mid-range device (no visible jank / dropped frames during a continuous scroll); the
   scroll handler reads only `scrollY`. (§6)

UX should capture this as the standard screenshot matrix (`scripts/dev/shots.sh`) plus, because this is
a **motion** change a static matrix can't fully show, a few mid-transition offsets (~25/50/75%) on the
Topic route to document the absence of the seam and the border fade.

---

## 10. Hand-off to Development — what to build

- In `components/header/SiteHeader.tsx` (`TopicSiteHeader`): replace the boolean `collapsed`
  state + `COLLAPSE_AT`/`RESTORE_AT` hysteresis with a `p`-computing rAF-gated scroll handler
  (`PROGRESS_START = 0`, `PROGRESS_END = TOPIC_BURN_Y`), writing `p` (and/or the derived properties) as
  CSS custom properties via a `ref` — not per-frame `setState` (§6). Drive the band height, the
  `--topic-burn-y` fed to the projector, and the layer opacities from `p` per §3.2.
- In `components/wordmark/HeaderProjector.tsx`: accept a continuous progress (or the derived
  `burnY`/opacities) instead of (or in addition to) the boolean `collapsed`, so the cool-field height,
  content-white top, beam clip height, and the beam/lit/flat opacities all read from the same `p`-driven
  values. Preserve the single-origin cross-fade structure (§2). The `burnY` the beam draws into must be
  the **live** `p`-driven value, so the burn boundary equals the band bottom at every `p` (§4.2).
- In `app/globals.css` (`.header-shared` block, ~§118–193): remove the `[data-collapsed]` opacity flips,
  the `transition: height/opacity 180ms` rules, and the `[data-collapsed]` border toggle; replace with
  var-driven opacities/height/border-opacity. Add the reduced-motion **quantized** path (§7). Preserve
  the `:focus`/`:focus-within` flat-lockup reveal (§8) and the `forced-colors` rules.
- **Do not** change: the Home header, the Tier-A 104/28 geometry or the beam/falloff **colors &
  end-states**, the seam-on-divider probe, the squeeze/glyph fallback, the lockup anatomy, the
  search/auth chrome, or the article body.

After build: **QA & Review** verifies correctness/perf/a11y against acceptance criteria; **UX**
evaluates the running transition against §9 (the seam absence, the border fade, reversibility, reduced
motion) — distinct from QA's pass.

---

*Supersedes Decision 3 of `docs/design/header-topic-integration.md` and the `~180ms` boolean clause of
`docs/VISUAL_IDENTITY.md` §10.2 #6. All other geometry, color, end-state, and seam-on-divider contracts
from those documents stand unchanged.*
