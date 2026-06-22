# Spec: Mobile video player launch — video fully visible on open, article still browsable

**Issue:** [#135](https://github.com/ragesoss/wikiplus/issues/135) · **Type:** build (read-side — mobile player launch/docked layout) · **Status:** spec
**Owner:** Product · **Feeds:** UX (corrected launch-state design spec, *before* code), Development (build) · **Verified by:** QA & Review + UX evaluation
**Corrects:** [#120](https://github.com/ragesoss/wikiplus/issues/120) (the unified mobile dock — this completes its unmet "fit" goal) · `docs/design/unified-player-mobile.md` (§5 DOM order, §6 sizing / "fit guarantee", §6.6 spacer, §13 the AC→design map that certified the wrong invariant)
**Relates to:** `docs/TOPIC_PAGE_DESIGN.md` ("The unified mobile video player"), `docs/CURATION_STANDARD.md` §5.2 (creator credit), [#123](https://github.com/ragesoss/wikiplus/issues/123) (candidate watch+act — coordinate the CTA, don't build here), [#70](https://github.com/ragesoss/wikiplus/issues/70) (desktop vertical width cap — different surface)

---

## Problem / gap

The unified mobile dock (#120) shipped a real regression in its **launch state**: on a phone, tapping a
video does **not** land the reader on the video. The dock opens **video-last under a stack of chrome** —
the title bar (caption + creator credit + three vertically-stacked buttons), then the curation
chips + "Context ▸" expander (curated) or match reason (candidate), then a full-width login/Curate
CTA — with the **video frame as the last child of an `overflow-y-auto` body**. The consequences,
confirmed in the shipped component (`components/topic/MobilePlayerDock.tsx`) and the committed
baselines (`docs/design/ui-screenshots/mobile-player-*`):

- **Frame-last layout.** The dock body is `min-h-0 flex-1 overflow-y-auto`; the supplemental row
  (chips / Context / match reason / CTA) renders *before* the frame, and the frame is the **last
  child**. The dock is pinned `bottom-0` with `maxHeight: calc(100dvh − safe-insets)`. When chrome +
  frame exceed the available height, the dock caps at the full viewport and **the video frame is the
  element that scrolls off / is clipped below the fold** — exactly the element a reader tapped to see.
- **Launch chrome too heavy.** Maximize / Move / Close stacked in the title bar, **plus** chips + the
  Context expander **plus** a full-width CTA — all rendered *above* the frame by default. The eye lands
  on metadata and a button, not the picture. This is reading-first, inverted from tap-to-watch.
- **Not bounded to keep the article visible.** The dock cap is `100dvh` (minus safe insets) — the dock
  may fill the entire screen, leaving no slice of the article in view. The `TopicView` page-reflow
  spacer is a fixed `h-[min(60vh,500px)]` guess, decoupled from the dock's real height.
- **The fit test certified the wrong invariant.** `e2e/mobile-player-fit.spec.ts` asserts only
  `dockTop >= 0` and that Close / Move are on-screen — it **never** checks that the *video frame* is
  fully visible. So the last pass "passed" while the user-facing outcome (see the video on open) was
  broken. This is *why* the regression survived QA, and re-pointing this invariant is part of "done."

This breaks the core promise of the surface: **tap-to-watch should land you on the video.** The whole
reason the mobile player is non-modal and movable (#120) is so a reader can watch *against* the article
on a small screen — and that only works if, on open, the reader sees the whole clip and a meaningful
slice of the article remains in view to scroll and read around it.

## User value

**Who:** Priya — the deciding reader, on a phone, anonymous, who landed on a Topic page via a wikilink
and taps a video (curated **or** suggested) to weigh it against the article (persona from
`docs/design/unified-player-mobile.md` §1 — unchanged; this corrects what she gets on open).

**Value:** when she taps any clip, the player opens with **the whole video frame visible at once** —
the video is the hero, she does not scroll inside the dock to reach it, and it is never clipped below
the fold. The dock is **compact and bounded**, so a meaningful slice of the article stays visible and
scrollable beneath/above it. The trust signals she needs to *weigh* the clip (the chips, the creator
credit) are present at a glance; the full context note and the participate invitation are one tap / a
short scroll away, **secondary** to the video — never crowding it off the screen on open. For the
product, this is the difference between a tap that delivers "watch this clip" and one that delivers "here
is some metadata and a button"; it is the launch experience the #120 unification was supposed to ship.

---

## Scope

This is a **layout / chrome-weight correction to the mobile (`< lg`) `MobilePlayerDock` launch /
docked state** — the state the dock opens in. It re-orders the dock so the **frame is video-first and
fully visible on open**, makes the chrome **minimal at launch**, and makes the dock **genuinely
bounded** so the article stays visible. It re-points the fit guarantee at the video frame and refreshes
the affected baselines.

**In scope:**

- The mobile `MobilePlayerDock` **launch / docked state**: the DOM/reading order, the chrome weight at
  launch, the CTA placement, and a **real dock-height bound** that leaves the article visible.
- The `TopicView` page-reflow spacer **tied to the dock's actual docked height** (not a fixed guess),
  edge-aware (bottom-pad parked bottom / top-pad parked top), removed on dismiss.
- The corrected **fit invariant** in `e2e/mobile-player-fit.spec.ts` (assert the **video frame box** is
  fully within the viewport on open / collapsed, in addition to Close reachable).
- The **launch-state correction recorded** in `docs/design/unified-player-mobile.md` (§5 DOM order,
  §6 sizing / fit guarantee, §6.6 spacer, §13 AC→design map), superseding the parts that produced this
  regression.
- The **screenshot baseline refresh** for the affected mobile player scenes.

**Out of scope:**

- **Desktop players** (`PlayerModal` curated modal, `PinnedPlayer` candidate dock) — unchanged. This is
  a `< lg` surface only.
- **Candidate watch + act affordances** — the streamlined candidate player around watch + act is
  **#123**. *Coordinate* the CTA / action-chrome placement so the two converge on one player model
  rather than diverging; **do not build #123's action affordances here.**
- **The desktop wide-viewport vertical-clip width cap** — **#70**, a different surface.
- **The embed facade / oEmbed / URL parsing / data model** (`lib/embed/`, the `Clip` / `Candidate`
  models) — untouched. The dock already has every field it needs.
- **The maximize-on-rotate behavior itself** — **keep it** (the CSS-only maximize, the explicit
  Maximize/Exit toggle, the per-platform "never `requestFullscreen`" decision all stand). The only
  maximize-adjacent change here is a **verification**: confirm the open-state seed
  (`setMaximized(mq.matches)` on mount) does not open a portrait clip in a too-large / maximized state
  (AC-7). Do not redesign maximize.
- **The rest of the #120 non-modal contract** — §9 (no focus steal / no trap / no backdrop), swap-in-
  place, the park toggle, the embed-create-on-play / teardown-on-close lifecycle, AA + text-labeled
  signals. These are **preserved invariants**, asserted by AC-6, not redesigned.

---

## Acceptance criteria

Each is independently checkable by QA against the built mobile dock (drive the real app / real CSS —
jsdom has no layout engine). The **in-scope widths** are **360 / 390 / 414 / 430 px** portrait; the
stressing portrait height is the short end of the in-scope range (the fit spec uses 780; QA may also
spot-check a shorter viewport). "Video frame box" = the rendered frame element (the `<iframe>` /
embed-stub panel container, the orientation-sized box in `MobilePlayerDock`), not the dock root.

**AC-1 — Whole video frame fully visible on open (collapsed, default). [the corrected fit invariant —
supersedes #120's]**
On open, the **entire video frame box is within the viewport** — its top, bottom, left, and right edges
all inside `[0, viewport]` (allow a sub-pixel tolerance), with **no scrolling inside the dock required
to reach the video** and the frame **not clipped**. This holds for **both** a curated clip **and** a
candidate clip, for **both** a 16:9 (horizontal) and a 9:16 (vertical) clip, at **each** of 360 / 390 /
414 / 430 px portrait. This is the invariant `e2e/mobile-player-fit.spec.ts` must assert **against the
video-frame box** — not merely `dockTop >= 0` and Close reachable (AC-9).

**AC-2 — Dock is bounded; a meaningful slice of the article stays visible on open.**
On open (collapsed, default), the docked dock does **not** fill the whole viewport: a **meaningful slice
of the article remains visible and scrollable** at the un-parked edge (concretely, the docked dock's
height is bounded **below** the visual viewport height by a non-trivial margin — UX sets the exact
budget in the design spec, but the article must be visibly present, not a sliver). The page reserves
space at the **parked edge** equal to the dock's **actual** docked height (edge-aware: bottom-pad parked
bottom, top-pad parked top), so the article can be scrolled fully clear of the bar; the spacer is
removed on dismiss so the page reflows to full height. Close **and** the park toggle remain reachable
and on-screen.

**AC-3 — Launch chrome is minimal / video-first.**
On open the **video reads as the hero**: the frame is the dominant element, not buried under chrome. The
curation **chips remain visible** as a compact at-a-glance trust signal (curated); the **full context
note stays behind the collapsed "Context ▸" expander** (not expanded on open); and the logged-out
login/Curate CTA is **secondary** — it is **not** placed above the frame nor crowding it on open (it
sits below the frame / after it in reading order). See the resolved open question below for the exact
on-open placement of chips and CTA that UX builds to.

**AC-4 — Creator credit (CC BY-SA) remains present on the clip surface.**
The **creator credit** (`handle · platformLabel`) is present on the dock **in every state, including the
collapsed launch state** — "minimal chrome" must **not** drop it. It currently lives in the shared title
bar; it must remain on the clip surface and visible at launch. (`docs/CURATION_STANDARD.md` §5.2 +
the §"load-bearing rule": creator credit names the video's maker and must stay present and distinct from
the curator's "context by" attribution.) The curator "context by" attribution remains one tap away
inside the expanded note (curated), as in #120 — it is not required in the collapsed state because the
creator credit is the CC BY-SA attribution that must ride every surface.

**AC-5 — Candidate parity.**
A candidate clip's launch obeys AC-1 / AC-2 / AC-3 the same as a curated clip: the whole frame is visible
on open, the dock is bounded, and the match reason + logged-out "Curate this video" CTA are secondary to
the frame (not above / crowding it). A candidate still only opens the dock when it has an `embedUrl`; the
no-embed candidate new-tab fall-through (`window.open(watchUrl)`) is unchanged.

**AC-6 — The rest of #120 still holds (preserved invariants).**
Re-verify, unchanged by this correction:
- **Non-modal contract** (§9): the dock is a labeled `<section aria-label="Video player">`, **not** a
  dialog — no `aria-modal`, no focus trap, no backdrop, **no focus steal on open** (the originating play
  button keeps focus); on keyboard Close, focus returns to the General band heading.
- **Swap in place** — a second play (either kind) re-uses the one dock / one iframe; never two docks.
- **Maximize-on-rotate** — kept exactly (CSS-only, never `requestFullscreen`; the explicit Maximize/Exit
  toggle; supplemental row + park toggle hidden while maximized).
- **Park toggle** — labeled "Move to top" / "Move to bottom", keyboard-operable, never drag; focus stays
  on the toggle; the page spacer moves with the edge.
- **Embed facade** — iframe created on play, torn down on close; `embed-never-host` preserved; the facade
  `allow` list / attrs reused verbatim.
- **AA + text-labeled signals** — every control carries its word (Close / Move / Maximize / Context),
  never color or position alone; chrome white-on-`ink` (≈15:1), the expanded note on the light surface.
- **Desktop unchanged** — curated `≥ lg` is still the blocking `PlayerModal`; candidate `≥ lg` is still
  the bottom-left `PinnedPlayer`.

**AC-7 — Maximize open-seed sanity (verification only).**
On open in **portrait**, a clip (curated or candidate, 16:9 or 9:16) opens **docked** (not maximized) —
the mount-time `setMaximized(...)` seed does not mis-open a portrait clip in a maximized / too-large
state. (The maximize behavior on actual rotation to landscape is out of scope and unchanged.)

**AC-8 — Launch-state correction recorded in the #120 design doc.**
`docs/design/unified-player-mobile.md` is updated so its §5 DOM order, §6 sizing / "fit guarantee",
§6.6 spacer, and §13 AC→design map describe the **corrected** video-first launch and the **frame-box**
fit invariant — superseding the parts that certified the wrong invariant. (This is the one design doc;
the timeless `docs/TOPIC_PAGE_DESIGN.md` "unified mobile player" prose is reconciled to the shipped
behavior when code lands.)

**AC-9 — Corrected fit test.**
`e2e/mobile-player-fit.spec.ts` asserts the **video frame box is fully within the viewport on open
(collapsed)** at 360 / 390 / 414 / 430 px portrait, for curated **and** candidate, 16:9 **and** 9:16 —
**in addition to** the existing Close-reachable check. The test must be able to **fail** against the
current (frame-last) layout and **pass** against the corrected layout (i.e. it genuinely measures the
frame box, not just `dockTop`).

**AC-10 — Screenshot baseline refreshed.**
The committed baseline gallery (`docs/design/ui-screenshots/`) is refreshed for the affected mobile
player scenes (curated, candidate, vertical — at minimum) so it shows the corrected video-first launch
and tracks the change in the same PR (per CLAUDE.md "UI screenshot gallery").

---

## Resolved open question (Product decision the UX role builds to)

**Question (from issue #135):** with the video as the hero and chrome minimal, where do the curation
chips + the logged-out CTA live on open — below the frame, or fully behind the Context expander?

**Decision (use the issue's suggested default; nothing in VISION / CURATION / TOPIC_PAGE_DESIGN argues
otherwise):**

1. **Chips stay visible but compact** — a one-line at-a-glance trust signal (stance + accuracy, plus the
   held marking when held). They are how a reader *weighs* a clip before/while watching, so they are not
   hidden behind the expander; they read as a slim strip, not a stack. (Curated only; a candidate has no
   chips — CURATION §6 — so a candidate shows only its one-line match reason.)
2. **The full context note stays behind the collapsed "Context ▸" expander** — one tap away, never
   expanded on open, never crowding the frame (curated only; candidates are never expandable — A2).
3. **The logged-out CTA moves below the frame / secondary** — "✦ Curate this video" (candidate) or "Log
   in to curate videos for this topic" (curated) is reading-order *after* the frame and is **not** placed
   above it or crowding it on open. It lands after the reader has seen the clip, which is also when the
   invitation is most apt.
4. **The creator credit (CC BY-SA) stays present on the clip surface in the collapsed launch state** —
   the "minimal chrome" reduction must **not** drop it (AC-4). It remains the canonical mobile credit
   (currently the title bar); UX may relocate it within the dock, but it must stay visible at launch and
   distinct from the curator "context by" attribution (`docs/CURATION_STANDARD.md` §5.2 + the load-
   bearing rule).

**Constraint for UX:** this decision fixes *what is visible / secondary on open* and *that the frame is
the hero*; it does **not** prescribe the exact geometry (where the chips strip and the frame sit relative
to each other, the precise height budget, whether minimal launch chrome means a slimmer title bar). UX
owns that in the launch-state design spec, subject to AC-1–AC-5. **Coordinate the CTA placement with
#123** so the candidate watch+act model and this launch layout converge on one player rather than
diverging.

---

## Success metric

"Fixed" looks like:

- **The corrected fit e2e (AC-9) passes** at all in-scope widths × {portrait} × {16:9, 9:16} ×
  {curated, candidate}, asserting the **video-frame box** is fully within the viewport on open — and
  would have **failed** against the shipped frame-last layout (the test discriminates the regression).
- **UX evaluation confirms a video-first launch**: on open the video is the dominant element, a
  meaningful slice of the article is visible, and the chips / CTA / note are present-but-secondary per
  the resolved decision — judged against the refreshed baselines (AC-10) and the corrected design doc
  (AC-8).
- **No regression in the preserved #120 invariants** (AC-6 / AC-7): QA's non-modal / swap / maximize /
  park / a11y checks still pass, and desktop is unchanged.

Lead indicator once analytics exists (deferred, not built here): on mobile, tap-to-open should not be
immediately followed by a dock-internal scroll-to-find-the-video or an immediate Close — i.e. the open
lands on the content.

---

## Hand-off

- **To UX / Design:** write the **corrected launch-state design spec** (the new video-first docked
  layout — DOM order, the minimal launch chrome, the chips-strip + Context-collapsed + CTA-secondary
  placement per the resolved decision, and a concrete **dock-height budget** that satisfies AC-1 / AC-2
  at the in-scope widths for both aspects) **before** any code, as an input to Dev. Cover the states /
  responsive / a11y as the #120 contract did; keep every preserved invariant (AC-6). The personas /
  user stories are the same as `docs/design/unified-player-mobile.md` §1–§2 (this corrects what they get
  on open); reconcile your stories to AC-1–AC-5, don't re-author them.
- **To Development:** build to the UX launch-state spec — re-order the dock so the **frame is video-first
  and fully visible on open**, bound the docked dock so the article stays visible, tie the `TopicView`
  page spacer to the dock's **actual** docked height (edge-aware), keep every #120 invariant (AC-6) and
  the maximize behavior (AC-7), introduce **no** server / oEmbed / facade / data-model change. Re-point
  `e2e/mobile-player-fit.spec.ts` at the **frame box** (AC-9) and refresh the baseline scenes (AC-10).
  Record the launch-state correction in `docs/design/unified-player-mobile.md` (AC-8); reflect the
  shipped behavior into `docs/TOPIC_PAGE_DESIGN.md` when code lands (it does not edit that timeless doc
  pre-build).
- **To QA & Review + UX evaluation:** verify AC-1 through AC-10 — the **frame-box fit** at every in-scope
  width / orientation / aspect for both kinds (AC-1 / AC-5 / AC-9), the bounded dock + article slice
  (AC-2), the video-first / minimal launch chrome (AC-3), the creator credit present at launch (AC-4),
  every preserved #120 invariant (AC-6) and desktop unchanged, the portrait open-seed sanity (AC-7), the
  doc correction (AC-8), and the refreshed baselines (AC-10).
