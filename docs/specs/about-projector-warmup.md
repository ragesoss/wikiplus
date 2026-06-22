# Spec — About-page projector "warm-up" intro animation

**Type:** build · **Milestone:** Functional prototype
**Status:** Product spec (Phase 1) — feeds UX (motion/choreography spec) and Development (implementation).
**Implements the deferred follow-up named in:** `docs/specs/about-page.md` → in-scope item 10
("Build for a future plus-layer toggle/animation") + the "Out of scope" note ("The animated
centerpiece … Future follow-up.") and `docs/design/about-centerpiece-handoff/README.md` →
"Interactions & behavior" (the planned 3-step sequence; the static off/on projector + a hideable
plus layer were shipped to drive it).
**Current static implementation this animates (the end state):** the About page as it ships today on
branch `about-projector-warmup` — `app/about/page.tsx` (full-bleed dark theater, `SiteHeader
host="flat"`, content vertically centered), `components/about/Centerpiece.tsx`,
`Projector.tsx`, `Beams.tsx`, `TopicMiniature.tsx` (the separable `<PlusLayer>`-family subtree),
`HowItWorks.tsx`, and `app/globals.css` (`.about-stage` / `.about-stage-inner`, `.how-it-works-card`,
the `--color-theater-*` radial stops).

> This build adds a **one-shot, on-load "projector warm-up" intro** to the existing `/about`
> centerpiece scene. It introduces **no new content, no schema/auth/Server-Action/data change**, and
> **no change to the static final look**. It is a client-side animation only (per `docs/ARCHITECTURE.md`
> Prototype phase). The page already exists and already separates the ＋plus layer from the article
> ground precisely so this can be added without a rewrite — this is that long-planned follow-up, now
> being built.

---

## Problem / why

The About page is the product's one orientation surface: a projector throws a beam onto a Wikipedia
Topic page, and the indigo ＋plus layer of curated video *reads as the projected light*. The thesis
is "the encyclopedia is the calm ground; wiki+ is the light added on top." Today that thesis is
delivered as a **static composition** — the whole causal story (lamp → beam → page gains the ＋plus
layer) is present all at once, so the *direction* of the metaphor (the plus content is **caused by**
the projector, added **onto** an article that already exists) is something the viewer has to infer
from a still image.

Motion makes that causal story **legible as motion**: a viewer literally watches the projector strike,
the beam reach the page, and the ＋plus layer appear *because* the light arrived. The orientation
animation does not add information — it **sequences** the information already in the composition so the
projector→page→＋plus thesis reads in the order it means: Wikipedia first, wiki+ added on top. It is a
one-shot "warm-up" on page load that then settles into exactly today's static final state.

This is a long-planned, deliberately-deferred follow-up. `docs/specs/about-page.md` shipped the static
final state and explicitly structured the ＋plus layer to be revealed later without a rewrite; the
centerpiece handoff documented the intended sequence. This build cashes that in.

## User value & the persona/story it serves

**Priya — the first-time visitor / self-directed learner** (the VISION primary persona; the About
page's primary persona per `docs/design/about-page.md` §0). She arrived from the homepage hero's
"How it works" CTA or a shared link and does not yet know what wiki+ *is*.

> **Her story:** *"As a first-time visitor, I want to grasp — without reading — that wiki+ takes a
> Wikipedia article and adds a curated, contextualized video layer on top of it, so I immediately
> understand what this product is and isn't (not a fork of Wikipedia, not a video host)."*

The static centerpiece already answers "what does it look like?". The warm-up intro answers "**what
happens** — what does wiki+ *do* to an article?" by showing it happen: the article exists first; the
projector adds the ＋plus layer onto it. The motion reinforces the static composition rather than
replacing it — at rest (and under reduced motion) the page is identical to today.

Secondary value: it is a small, on-brand moment of craft that signals quality on the product's
front-door page, consistent with the Indigo Press identity, without becoming a recruitment pitch
(VISION "what good looks like").

---

## Scope

### In scope

Add a **single, one-shot, on-load intro animation** to the existing About centerpiece scene. The
animation plays the **five owner steps below in order**, then settles into **exactly today's static
final state**. No content, layout, copy, header, route, or static-look change.

The five choreographed steps (the owner's intent, verbatim in intent):

1. **Lamp flicker.** On load the projector lamp **flickers on** — a few quick, uneven flashes, like a
   real projector striking. (The lamp is the white "+" aperture + warm bloom in `Projector.tsx`.)
2. **Warm-up (dim → bright).** The lamp/aperture **ramps from dim to full brightness** after the
   flicker settles.
3. **Beam projects.** The **beam appears and extends** from the projector aperture across to the
   Topic-page miniature — the three nested warm cones in `Beams.tsx` reach the page.
4. **＋plus layer reveals.** The miniature goes from **lacking** the ＋plus content (the bare Wikipedia
   article ground only — title + body lines + section heads) to **having** it: the indigo ＋plus layer
   (the plus cards + the clips, the separable `<PlusLayer>`-family subtree in `TopicMiniature.tsx`)
   **reveals in**.
5. **Surface reaches full brightness.** The page/theater surface starts **dimmer** (darker) and
   reaches today's committed color/brightness **only when the projector is fully illuminated at max
   brightness**. ("Surface" = the scene's theater radial + the miniature's lit appearance; the overall
   scene brightens up to its final tone.)

The five steps form one continuous choreography; their exact phase boundaries, overlaps, easing, and
per-phase timing are **UX's contract** (this spec fixes the *order* and the *start/end states*, not the
motion design). The animation is decorative/visual only; it must not gate, hide, move focus to/from, or
block any content or control.

### Explicitly in scope, mechanically

- A **CSS / Web-Animations** implementation (GPU-friendly transform/opacity work; no layout-thrashing
  JS animation loop), gated as today's About-page motion conventions in `globals.css` already are
  (`@media (prefers-reduced-motion: no-preference)` for the animated path; nothing animates under
  `reduce`).
- Reuse the **already-separated** structure: the ＋plus pieces in `TopicMiniature.tsx` (plus cards +
  clips) are distinct from the article-ground pieces, so step 4 reveals the plus subtree without
  re-architecting the miniature. Do **not** introduce a parallel/duplicate miniature.
- A **refreshed UI screenshot baseline** for the About surface. The baseline captures the **settled
  final state** (the intro is not a steady state). If a capture races the intro, the catalog's About
  scene must wait for / force the settled state (e.g. a reduced-motion capture, or a "settled" readiness
  signal) so the baseline is deterministic and equals today's committed shot — see AC11.

### Out of scope (state explicitly)

- **Any change to the static final look.** The end state must be **pixel-equivalent to today's
  committed static About page** (the `233a5fc` look). This build adds an intro that *resolves into*
  that look; it does not restyle the projector, beams, miniature, card, theater, header, or tokens.
- **Real / final copy.** The explainer copy stays as-is (placeholder this round per
  `docs/specs/about-page.md`); the animation does not touch copy. The "How it works" card is **not**
  part of the warm-up choreography (it is the page's light surface and load-bearing copy; it does not
  flicker, dim, or reveal — see AC6/AC7).
- **The header.** The header stays `host="flat"` (projector-OFF mode — the page graphic is the
  projector; a second header beam would read as two projectors). No header animation; the header beam
  is not part of this.
- **Other pages.** No change to `/about/data`, the homepage hero, the Topic page, or any other surface.
- **Looping / scroll-triggered / replay-on-interaction motion.** This is **one-shot on load only** — it
  does not loop, does not replay on scroll, does not replay on hover/click, and has no continuous idle
  animation after it settles.
- **New tokens, schema, data, auth, or Server Actions.** None are needed; the colors/values already
  exist as `@theme` tokens.

---

## Acceptance criteria

Each is independently testable by a QA engineer (Vitest/RTL for DOM/structure/reduced-motion-policy
assertions; Playwright for the rendered sequence, the settled state, and reduced-motion parity) and by
UX against the motion design spec. **None depends on final/real copy.** "Final static state" means the
committed static About look as it ships on `about-projector-warmup` at `233a5fc` (the look this build
animates *into*).

**Start state, end state (the bookends)**

1. **Initial pre-illumination state on load.** When `/about` loads with motion enabled
   (`prefers-reduced-motion: no-preference`), the centerpiece scene **begins** in a pre-illumination
   state, observably distinct from the final state, in which **all three** hold at the first painted
   frame of the scene: (a) the projector lamp is **dim/off** (not at full brightness); (b) the ＋plus
   layer is **not visible** (the miniature shows the bare article ground — title + body lines + section
   heads — with the indigo plus cards + clips not yet revealed); (c) the theater/page **surface is
   dimmer** than the final committed tone. (Testable: at animation start the plus-layer elements are
   hidden/transparent and a brightness/opacity signal on the lamp/surface is below its final value.)

2. **Final state equals today's committed static look, exactly.** After the intro completes (and at all
   times once settled), the centerpiece renders **pixel-equivalent to the current committed static
   About page** — same projector at full brightness, same three beams, same fully-revealed ＋plus
   layer, same theater radial tone, same miniature glow, same "How it works" card. Verifiable two ways:
   (i) a Playwright screenshot of the **settled** scene matches the committed baseline within the
   project's normal pixel tolerance; (ii) once settled, no element carries a non-final inline
   opacity/transform/brightness left over from the intro (the animation leaves the DOM in the same
   visual state the static page has today). The intro is **additive and one-shot** — it does not
   permanently alter the static look (AC10).

**The ordered sequence (the five steps)**

3. **Order is enforced, not simultaneous.** The intro plays the five steps in this order, each
   beginning at or after the previous one's start (phases may overlap, but the *onset order* is fixed
   and observable): **(1) lamp flicker → (2) lamp warm-up dim→bright → (3) beam reaches the miniature →
   (4) ＋plus layer reveals → (5) surface reaches full brightness/color.** (Testable via timed
   sampling: the lamp shows uneven flicker before it reaches steady brightness; the beam reaches the
   page before the plus layer is fully revealed; the plus layer reveals before/as the surface reaches
   its final tone; the surface reaches full brightness no earlier than the lamp reaching max.)

4. **Step coupling (step 5's dependency).** The page/theater **surface reaches its final
   brightness/color only when the projector is fully illuminated at max brightness** — i.e. the surface
   does not reach its final committed tone before the lamp warm-up (step 2) has completed. (Testable:
   sample surface brightness and lamp brightness over the timeline; surface-final must not precede
   lamp-max.)

5. **The plus reveal is the article gaining the layer.** Step 4 animates the **＋plus layer appearing on
   an already-present article ground** — the article-ground elements (title, body lines, section heads)
   are present from the start (AC1) and are **not** what reveals; only the plus cards + clips reveal in.
   (Testable: the article-ground nodes exist and are visible at animation start; the plus-layer nodes
   transition from hidden to visible during step 4.)

**Reduced motion (parity)**

6. **`prefers-reduced-motion: reduce` ⇒ no intro, final state immediately.** Under
   `prefers-reduced-motion: reduce`, the page renders the **final static state on first paint** with
   **no intro**: no flicker, no dim-start, no beam-extend, no delayed/animated ＋plus reveal, no
   surface ramp. The lamp is at full brightness, the beams present, the ＋plus layer fully visible, the
   surface at final tone — all immediately, identical to AC2's settled state. There is **no flashing**
   and **no content that appears late**. (Testable: Playwright with `reducedMotion: "reduce"` — the
   first painted scene equals the settled scene; no animation runs.)

**Accessibility (the intro is decorative-only)**

7. **All content present and reachable throughout — never gated by the intro.** During the intro and
   after it settles, in **both** motion modes: the "How it works" heading and steps and the scene's
   visually-hidden description are present in the DOM and exposed in the accessibility tree, and the
   **miniature title input** (the one real control) is present, in the tab order, focusable, editable,
   and able to navigate on Enter. The intro must **not** hide, disable, `display:none`, `aria-hidden`,
   or otherwise remove any of this content while animating, and must **not** delay its availability.
   (Testable: RTL renders the page and finds the heading text, the step list, and the named title input
   immediately, regardless of the simulated motion preference; Playwright can focus and submit the title
   input during/right after load.)

8. **The intro does not move or steal focus, and does not block input.** Loading `/about` does **not**
   programmatically move focus into the scene; the page's initial focus behavior is unchanged from
   today. A keyboard user can Tab to the title input and a pointer user can click it **during** the
   intro, and typing + Enter works immediately (no animation-gated input lock). (Testable: assert
   `document.activeElement` is not forced into the scene on load; drive the input during the intro.)

9. **No new color-only signal; decorative graphics stay decorative.** The animated projector, beams,
   bloom, and the revealing plus cards/clips remain **decorative** (`aria-hidden` as today) — the
   animation adds no information a user must perceive as motion, and conveys nothing by color/motion
   alone. The thesis remains available as the scene's visually-hidden text alternative and the "How it
   works" copy, unchanged. (Testable: the decorative SVG/graphic nodes keep `aria-hidden`; the
   sr-only scene description and the card copy are unchanged.)

**Non-regression / additive**

10. **One-shot and non-destructive.** The intro plays **once per page load** and then stops; it does
    **not** loop, does **not** restart on scroll/hover/click, and leaves **no** residual animation
    running after it settles. After it settles, re-reading the DOM shows the static final state with no
    lingering animation classes/inline styles that change the rendered look (AC2). (Testable: after the
    settle window, no element is mid-animation; the scene is static.)

11. **Screenshot baseline equals the settled state, deterministically.** The committed UI screenshot
    baseline for the About surface is regenerated and captures the **settled final state** (not a
    mid-intro frame), so the About baseline shot is **unchanged from / equivalent to** today's committed
    About shot. The capture is deterministic — it must not race the intro (achieved via reduced-motion
    capture and/or a "settled" readiness signal). (Testable: the regenerated `docs/design/ui-screenshots`
    About PNGs match the prior committed About PNGs within normal tolerance; the catalog scene waits for
    a settled signal.)

**Responsive (the intro works coherently at every supported width)**

12. **Responsive choreography — defined per width tier.** The intro plays coherently at all three of the
    current centerpiece layouts, with the reduced form below `lg` defined as follows (the projector +
    beams are **only shown `≥ lg`** in the current `Centerpiece.tsx`; below `lg` the miniature shows
    **alone**):
    - **`≥ xl` (card LEFT + full scene RIGHT) and `lg`–`xl` (stacked: card first, full scene below):** the
      **full five-step choreography** runs — flicker → warm-up → beam reaches the miniature → ＋plus reveal
      → surface brightens.
    - **`< lg` (miniature ALONE, no projector / no beams):** steps 1–3 have no on-screen projector or
      beams to play, so the reduced intro is **step 4 (the ＋plus layer reveals in on the article ground)
      + step 5 (the miniature/surface brightens to its final tone)**. The plus-reveal + surface-brighten
      still play, coherently, with the same start/end-state guarantees (AC1, AC2) for the elements that
      are present. The miniature still ends pixel-equivalent to today's `< lg` static miniature.
    - In **all** tiers, the page body **never scrolls horizontally** because of the intro (no element is
      transformed/translated outside its clipped stage box), and the final state at every width equals
      today's static look at that width (AC2).
    (Testable: Playwright at mobile 390 / tablet 834 / desktop 1280 — assert the appropriate intro runs,
    no horizontal scroll appears at any frame, and the settled state matches the baseline at each width.)

---

## Open product decisions (resolved here; assumptions for UX/Dev to refine)

These are Product calls made to keep the build unblocked. UX owns the motion design (easing, exact
phase timing/overlap, the flicker rhythm); Dev owns the mechanism. The starred ones are worth an owner
glance but should **not** block.

- **Replay policy — DECISION: play once per page load.** The owner said "upon page load," so the intro
  runs on each full page load of `/about` and does not replay thereafter (no loop, no scroll/hover
  replay) — AC10.
- ★ **Client-side navigation back to `/about` — DECISION: replay on each *load* of the route, including a
  client-side (App Router) navigation that mounts the centerpiece.** Rationale: the intro is the page's
  "warm-up," and a soft-nav to `/about` is, to the visitor, arriving at the page — replaying it is
  coherent and matches "on page load." It must remain one-shot per arrival (not loop). If the owner
  prefers "first visit per session only," that is a one-line gate UX/Dev can add later; **not** blocking.
  (A full reload always replays.)
- **Performance posture — DECISION: CSS / Web-Animations only, GPU-friendly.** Animate **opacity** and
  **transform** (and SVG/filter brightness via opacity-style layers) — **no** animation of layout
  properties, no per-frame JS layout reads, no long main-thread tasks. The intro must not introduce
  jank or **cumulative layout shift** (it animates appearance, not box flow — elements occupy their
  final layout boxes throughout, so nothing reflows). This matches the existing About/topic motion in
  `globals.css` (gated `@media (prefers-reduced-motion: no-preference)` keyframes on transform/opacity).
- **Total duration — TARGET RANGE for UX to finalize: ~1.6–2.6s** end-to-end (flicker is the first few
  hundred ms; the warm-up/beam/reveal/brighten fill the rest). This is a **range**, not a contract —
  long enough to read as a deliberate "warm-up," short enough not to make the visitor wait to interact
  (and interaction is never gated regardless — AC7/AC8). UX sets the precise timing and easing; this
  spec does **not** over-specify easing curves.
- **Flicker character — note for UX:** "a few quick, uneven flashes" (the owner's words) — irregular,
  not a smooth pulse, evoking a real projector striking. Exact count/rhythm is UX's. Keep it brief so a
  reduced-motion user loses nothing meaningful (they get the final state instantly — AC6).

---

## Success metric

Analytics is deferred (no instrumentation ships here), so success is **observable conditions** the
owner / QA / UX confirm:

- **Primary (qualitative, confirmable now):** the projector→page→＋plus thesis **reads as motion** — a
  first-time viewer watching the page load sees, in order, the projector strike, the beam reach the
  page, and the ＋plus layer appear *on* the article, and comes away understanding that wiki+ **adds a
  curated video layer on top of a Wikipedia article**. The motion reinforces (does not contradict or
  obscure) the static composition. Confirmed by UX evaluation against the motion design spec and an
  informal owner read.
- **Zero layout shift / no jank.** The intro animates appearance only; there is **no cumulative layout
  shift** and no visible main-thread stutter on a normal laptop/phone. (Confirmable now via devtools /
  Playwright; the deferred metric to instrument later is CLS = 0 on `/about` and no long tasks during
  the intro window.)
- **Reduced-motion parity.** Under `prefers-reduced-motion: reduce`, the page is **identical** to
  today's static About page on first paint — no flashing, no late content, full a11y. (AC6.)
- **Static-look fidelity.** The settled state is pixel-equivalent to today's committed static About
  look at every supported width (AC2, AC11) — the animation is provably additive.

---

## Assumptions / follow-ups

- This is the long-deferred follow-up named in `docs/specs/about-page.md` (in-scope item 10 +
  the "animated centerpiece" out-of-scope note) and the centerpiece handoff's "Interactions &
  behavior." It is built on top of the **current** (post-redesign) About implementation
  (`233a5fc`: full-bleed dark theater, `host="flat"`, card + scene), **not** the older
  contained-panel composition described in `docs/design/about-page.md`. UX should write the motion spec
  against the current components (`Centerpiece.tsx` / `Projector.tsx` / `Beams.tsx` /
  `TopicMiniature.tsx`), whose ＋plus subtree is already separated for exactly this reveal.
- **No new tokens/schema/data/auth/Server-Action.** This is a pure client-side animation over existing
  markup and existing `@theme` tokens (`--color-theater-*`, the lamp/bloom/beam warms, the indigo
  hardbox tokens) — confirm none is introduced (AC consistency).
- ★ **Replay-on-soft-nav** policy (above) — owner may prefer first-visit-only; non-blocking.
- The motion design (easing, exact phase timing/overlap, flicker rhythm, total duration within the
  ~1.6–2.6s range) is **UX's contract**, refined in the design spec; this spec fixes order + bookend
  states + the a11y/reduced-motion/non-regression guarantees only.

---

## Hand-off

- **UX (next):** write the motion / choreography design spec for the warm-up at
  `docs/design/about-projector-warmup.md` (or extend `docs/design/about-page.md` with a motion
  section) — the exact phase boundaries/overlaps and easing for the five steps, the flicker rhythm,
  the dim→bright ramp values for the lamp + surface, the beam-extend treatment, the ＋plus reveal
  treatment (fade/scale per `<PlusLayer>` group), the total duration within the ~1.6–2.6s range, the
  reduced-form choreography `< lg` (step 4 + step 5), and the `prefers-reduced-motion: reduce`
  end-state. Work against the current components named above; the static final state is the fixed
  endpoint. Confirm: no static-look change, no focus move, content never gated (AC2, AC6–AC10).
- **Development (after UX):** implement the intro as CSS/Web-Animations gated behind
  `@media (prefers-reduced-motion: no-preference)` (mirroring the existing About/topic motion in
  `globals.css`), animating opacity/transform only, over the existing markup — the lamp (the white "+"
  aperture + bloom in `Projector.tsx`), the three beam cones (`Beams.tsx`), the separable ＋plus subtree
  (`TopicMiniature.tsx`), and the scene surface (the `.about-stage`/theater radial + miniature). Keep the
  article-ground present from the start; reveal only the plus layer. No focus move, no input gating, no
  layout shift. Ensure the screenshot-baseline capture settles deterministically (AC11) and refresh the
  About baseline. Hand to QA & Review for verification against AC1–AC12, then UX evaluates the built
  motion against the design spec.
