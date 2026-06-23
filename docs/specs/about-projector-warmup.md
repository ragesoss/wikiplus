# Spec — About-page projector "warm-up" intro animation

**Type:** build · **Milestone:** Functional prototype
**Status:** Product spec (Phase 1) — **post-deploy refinement iteration** (the first version shipped to
production; this revision captures the owner's reviewed-live changes: beam fade-in, dim-cool topic that
warms, plus fade-only, red→green status-light first step, the click/keyboard power toggle, a
dynamic miniature article title sourced from the home page's "recently curated" data — re-picked on each
power-on, with an old→new flicker on a restarted power-on — **and the removal of the whole-field
surface dim/brighten so the intro animates only the projector, the beam, and the page/miniature against a
static, continuous background**). Feeds UX (motion/choreography + control spec) and Development
(implementation).
**Implements the deferred follow-up named in:** `docs/specs/about-page.md` → in-scope item 10
("Build for a future plus-layer toggle/animation") + the "Out of scope" note ("The animated
centerpiece … Future follow-up.") and `docs/design/about-centerpiece-handoff/README.md` →
"Interactions & behavior" (the planned 3-step sequence; the static off/on projector + a hideable
plus layer were shipped to drive it).
**Current static implementation this animates (the end state):** the committed static About **poster**
on `main` at `178c148` ("Compose About as one full-page poster in a single theater field") — the look
this build animates *into*. It is **one full-page warm-dark "theater" field** (`.about-theater-field`
on `<main>`) with **four elements composed within that one field**: the "How it works" card, the
projector, its beam, and the lit Topic-page miniature. There is **no separate scene box** — the
`.about-stage` is **transparent**, so the page field shows through it; the projector's bloom and the
miniature's glow read as light in one continuous room. The files: `app/about/page.tsx`
(`SiteHeader host="flat"`, content vertically centered in the field), `components/about/Centerpiece.tsx`,
`Projector.tsx`, `Beams.tsx`, `TopicMiniature.tsx` (the separable `<PlusLayer>`-family subtree),
`HowItWorks.tsx`, and `app/globals.css` (`.about-theater-field`, `.about-stage` / `.about-stage-inner`,
`.how-it-works-card`, the `--color-theater-*` radial stops).

> This build adds an **on-load "projector warm-up" intro** to the existing `/about` centerpiece scene
> **and makes the projector an interactive power toggle** (click/keypress powers it OFF back to the
> initial dark state, and ON again to replay the warm-up). It introduces **no new content, no
> schema/auth/Server-Action/data change**, and **no change to the static *settled-on* look**. It is a
> client-side animation + a small interactive control only (per `docs/ARCHITECTURE.md` Prototype phase).
> The page already exists and already separates the ＋plus layer from the article ground precisely so
> this can be added without a rewrite — this is that long-planned follow-up, now being built.
>
> **Post-deploy refinement (this revision).** The first version shipped to production; the owner
> reviewed the live result and requested an iteration. The changes, captured below: the **beam fades in**
> into its final geometry (no grow/scale/position motion — the old grow-along-throw jittered and read
> unnaturally); the **topic miniature starts darker + cool** (dim indoor fluorescent shade) and **warms
> to its lit appearance alongside the beam**; the **＋plus layer fades in with no motion** (no
> scale/slide); the **status light starts RED and the animation's first step is RED → GREEN** before the
> warm-up begins; and the **projector becomes a click/keyboard power toggle** (OFF → initial dark state,
> ON → replay). The settled-ON state is still exactly today's committed static poster (which already
> shows the green status light) — so AC2 still holds.
>
> **This revision also removes the whole-field surface dim/brighten (owner directive).** The earlier
> version dimmed the whole field at the start and brightened it to its final tone coupled to lamp-max;
> the owner reversed this: *"animation should be restricted to the projector, beam and page… no
> background change except for what the beam covers."* So the **background theater field is now STATIC
> and CONTINUOUS** — at its final committed tone from the first painted frame, never dimming or
> brightening. The **only** animated elements are the **projector** (lamp flicker + warm-up + the
> red→green status light), the **beam** (opacity fade-in), and the **page/miniature** (its dim-cool →
> illuminate transition). The only "illumination" change over the background area is the **beam itself
> fading in over it** (the beam covers part of the field; as it fades in, that covered area lights up —
> the underlying background does not change). **This fixes a real deployed flaw:** the old surface-dim
> overlay was scoped to the `.about-stage` box, not the whole page, so in the dark start state the
> stage's rectangular **outline** became visible against the rest of the page until the beam reached
> full. Removing the surface dim removes that artifact — the field reads as one continuous tone at every
> frame. See the revised AC1 and AC4, and the new AC4b.
>
> **This revision also folds in a dynamic miniature article title.** The miniature's article title —
> today the hard-coded `"Acer palmatum"` (`DEFAULT_TITLE`) — becomes **a real title chosen from the home
> page's "recently curated" articles** (issue #126; read via the existing `listCuratedTopicsAction()`
> seam), filtered to titles that **fit the miniature's single title line** (a too-long title is excluded,
> never truncated/wrapped). `"Acer palmatum"` is the **fallback** when nothing fits or the list is empty.
> The title is **(re)picked on each power-on** (the on-load auto-play *and* every toggle-ON), so it may
> **change between power-ons**; it is **readable in every state** (dim/off and lit); on a **restarted**
> power-on (one that re-picks a *new* title) the title text **flickers old→new during the lamp flicker**,
> synchronized with the lamp strikes (no such flicker on the first/auto-play, which has no prior title);
> and it remains the **editable, Enter-to-navigate input** (`MiniatureTitleInput`), now **seeded** with
> the picked value. See AC16–AC18; the architecture note records that `/about` now reads the
> recently-curated data server-side (a read of existing data — no schema/policy change).

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

Add an **on-load "power-on" intro animation** to the existing About centerpiece scene **and a
click/keyboard power toggle on the projector**. On load (motion enabled) the intro auto-plays the
**ordered steps below**, then settles into **exactly today's static settled-on poster**. Clicking (or
activating via keyboard) the projector **powers it OFF** to the initial dark state and **ON again to
replay** the full power-on sequence. No content, layout, copy, header, route, or settled-on static-look
change.

The choreographed steps (the owner's intent, verbatim in intent), in order:

0. **Status light RED → GREEN (the first step).** The OFF/initial state shows the projector's status
   light **RED**. The animation's **first action** is the status light turning **RED → GREEN**; only
   *then* does the warm-up begin. (The status light is the projector's power indicator in
   `Projector.tsx`; the committed static poster shows it GREEN.)
1. **Lamp flicker.** After the light goes green, the projector lamp **flickers on** — a few quick,
   uneven flashes, like a real projector striking. (The lamp is the white "+" aperture + warm bloom in
   `Projector.tsx`.)
2. **Warm-up (dim → bright).** The lamp/aperture **ramps from dim to full brightness** after the
   flicker settles.
3. **Beam fades in (no motion).** The **beam fades in (opacity) into its final geometry** as the lamp
   warms up — the three nested warm cones in `Beams.tsx` appear *in place*, at their committed final
   size/position, with **no `scaleX` grow, no extend-along-the-throw, no position/scale change**. The
   beam's final geometry is unchanged from today's poster; only its opacity ramps from 0 → full. (This
   replaces the prior grow-along-throw, which jittered and read unnaturally.)
4. **Topic miniature warms to full illumination.** The miniature starts **darker and cool** — without
   illumination it is dimmer and carries a **cool/fluorescent indoor shade** (a dim indoor location). As
   the beam fades in, the miniature **transitions to full illumination** — brightening and warming to
   its committed lit appearance — reaching full **alongside the beam** (i.e. at lamp-max). This treatment
   is **confined to the miniature element itself** — it must not dim or brighten the surrounding
   background field.
5. **＋plus layer fades in (no motion).** The miniature goes from **lacking** the ＋plus content (the
   bare Wikipedia article ground only — title + body lines + section heads) to **having** it: the indigo
   ＋plus layer (the plus cards + the clips, the separable `<PlusLayer>`-family subtree in
   `TopicMiniature.tsx`) **fades in (opacity only)** — **no scale, no slide, no motion**. Onset is after
   the beam.

> **The background theater field does NOT animate (owner directive).** There is **no** whole-field
> surface dim/brighten step. The page/theater field (`.about-theater-field`) is at its **final committed
> tone from the first painted frame and never changes** — it does not start dimmer and brighten to final.
> The only thing that "lights up" any of the background area is the **beam fading in over it** (step 3):
> the beam layer covers part of the field, and as its opacity ramps 0 → full that covered region brightens
> — but the underlying field tone underneath is unchanged. There is **no surface/room-dim overlay**, and
> in particular **no overlay scoped to the `.about-stage` box** (which would reveal the stage's rectangular
> outline against the rest of the page — the deployed flaw this removes). The page field reads as **one
> continuous tone across the whole page at every frame**.

These steps form one continuous choreography; their exact phase boundaries, overlaps, easing, and
per-phase timing are **UX's contract** (this spec fixes the *order* and the *start/end states*, not the
motion design). The intro animation is decorative/visual only; it must not gate, hide, move focus
to/from, or block any content or control. The **power toggle** is a real, keyboard-operable control
(see "interactive control" below and AC13–AC15).

### Explicitly in scope, mechanically

- A **CSS / Web-Animations** implementation (GPU-friendly transform/opacity work; no layout-thrashing
  JS animation loop), gated as today's About-page motion conventions in `globals.css` already are
  (`@media (prefers-reduced-motion: no-preference)` for the animated path; nothing *auto-*animates on
  load under `reduce`). The intro animates **opacity / brightness / color-tint** (the beam and plus
  fade; the lamp and the miniature brightness-and-warmth ramp; the status-light color) — **not**
  position or scale, and **not** the background field (it never animates — AC4b).
- **The projector becomes an interactive power control.** Where the projector is present (`≥ lg` — see
  AC12), it is a real, keyboard-operable, accessibly-labeled control (e.g. a `<button>`) — **not** a
  click handler on a decorative `aria-hidden` SVG. It has a **state-reflecting accessible name** (an
  ON/OFF or "turn projector on/off" sense), a **visible focus indicator**, and is operable by pointer
  and keyboard (Enter/Space). The decorative graphics inside it stay decorative; the *control wrapper*
  carries the semantics. (UX designs the exact control treatment and label wording; the spec requires
  the control exists and is accessible — AC13–AC15.)
- Reuse the **already-separated** structure: the ＋plus pieces in `TopicMiniature.tsx` (plus cards +
  clips) are distinct from the article-ground pieces, so the plus-fade step reveals the plus subtree
  without re-architecting the miniature. Do **not** introduce a parallel/duplicate miniature.
- **A dynamic miniature article title sourced from the home page's "recently curated" data.** `/about`
  (today a static server component) **reads `listCuratedTopicsAction()`** server-side (the existing
  DataStore-seam read the homepage uses — recency-ordered, `videos ≥ 1`), derives the **eligible title
  pool** (the recent-curation titles that **fit** the miniature's single title line — see AC16 and the
  fit-threshold note in *Open product decisions*), and passes **the pool + the fallback** (`"Acer
  palmatum"`, today's `DEFAULT_TITLE`) to the client miniature. The client picks one on each power-on. See
  AC16–AC18 and the architecture note below. This is a **read of existing data — no schema, no new
  policy, no new Server Action**; it likely shifts `/about` from static-prerender to a dynamic/ISR read
  (acceptable for the prototype — the production ISR/Redis read path is deferred per
  `docs/ARCHITECTURE.md`).
- A **refreshed UI screenshot baseline** for the About surface. The baseline captures the **settled
  final state** (the intro is not a steady state). If a capture races the intro, the catalog's About
  scene must wait for / force the settled state (e.g. a reduced-motion capture, or a "settled" readiness
  signal) so the baseline is deterministic and equals today's committed shot — see AC11. **Because the
  miniature title is now dynamic, the capture must also pin the title deterministically** (e.g. force the
  fallback, or stub/seed the recently-curated read to a fixed title) so the baseline does not churn as
  real curations change — see AC11 and the deterministic-capture note.

### Out of scope (state explicitly)

- **Any change to the settled-on static look.** The **settled-ON** state must be **pixel-equivalent to
  the committed static About poster on `main` at `178c148`** (the one full-page theater field; card
  overlaid upper-left, projector lower-left — with its status light **green** — long diagonal beam,
  dropped miniature upper-right at `≥ xl`). This build adds an intro + a power toggle that *resolve into*
  that look; it does not restyle the projector, beams, miniature, card, theater field, header, the
  responsive composition/tiers, or tokens. (Note: the miniature today has **no** warm rectangular halo
  glow — just a soft drop shadow; the beam landing on it is the "lit" cue. The miniature's
  warm-and-brighten must not add a halo back — it brightens the *miniature's existing surface tone* and
  removes the dim/cool tint, not a new glow, and stays confined to the miniature element.) The **OFF**
  state is *not* a new static look to design — it is the intro's own initial pre-illumination state
  (AC1), reused as the toggle's off rest state (AC13).
- **Any animation of the background theater field.** The full-page theater field
  (`.about-theater-field`) is **static and continuous** — it is at its final committed tone from the
  first painted frame and **does not** dim or brighten at any point, in either the auto-intro or a
  toggle. The intro animates **only** the projector, the beam, and the page/miniature (AC4b). There is
  **no** whole-field surface dim/brighten step and **no** surface-dim overlay — in particular none scoped
  to the `.about-stage` box (which would expose the stage outline — the deployed flaw this removes).
- **Real / final copy.** The explainer copy stays as-is (placeholder this round per
  `docs/specs/about-page.md`); the animation does not touch copy. The "How it works" card is **not**
  part of the warm-up choreography (it is the page's light surface and load-bearing copy; it does not
  flicker, dim, or reveal — see AC6/AC7).
- **The header.** The header stays `host="flat"` (projector-OFF mode — the page graphic is the
  projector; a second header beam would read as two projectors). No header animation; the header beam
  is not part of this.
- **Other pages.** No change to `/about/data`, the homepage hero, the Topic page, or any other surface.
- **Looping / scroll-triggered / hover / idle motion.** The intro **auto-plays once on load** and does
  not loop, does not replay on scroll, does not replay on hover, and has no continuous idle animation
  after it settles. The **only** replay path is the **user-initiated power toggle** (a click/keypress on
  the projector control — AC13/AC14): OFF then ON replays the power-on sequence once. There is no
  pointer-hover replay and no automatic re-trigger.
- **New tokens, schema, data, auth, or Server Actions.** None are needed; the colors/values already
  exist as `@theme` tokens. The dynamic title (AC16–AC18) **reuses the existing
  `listCuratedTopicsAction()` read** — it adds **no new** schema, data model, policy, auth, or Server
  Action; it only consumes data the homepage already reads. (It does change `/about`'s render mode from
  static to dynamic/ISR — see the architecture note — which is a render-path change, not a data/schema
  change.)

---

## Acceptance criteria

Each is independently testable by a QA engineer (Vitest/RTL for DOM/structure/reduced-motion-policy
assertions; Playwright for the rendered sequence, the settled state, reduced-motion parity, and the
power toggle) and by UX against the motion design spec. **None depends on final/real copy.** "Settled-on
state" / "final static state" means the committed static About **poster** as it ships on `main` at
`178c148` — the one full-page theater field with the card, projector (status light **green**), beam, and
dropped miniature composed within it (the look this build animates *into*). "OFF / initial state" means
the intro's own pre-illumination start state (AC1), which the power toggle reuses as its off rest state.

**Start state, end state (the bookends)**

1. **Initial pre-illumination ("OFF") state on load.** When `/about` loads with motion enabled
   (`prefers-reduced-motion: no-preference`), the centerpiece scene **begins** in a pre-illumination
   "off" state, observably distinct from the settled-on state, in which **all of the following** hold at
   the first painted frame of the scene: (a) the projector lamp is **dim/off** (not at full brightness)
   and the **beam is not visible** (opacity 0); (b) the ＋plus layer is **not visible** (the miniature
   shows the bare article ground — title + body lines + section heads — with the indigo plus cards +
   clips not yet revealed); (c) the topic miniature is **darker and cool-tinted** (its dim-indoor
   fluorescent shade, below the committed lit brightness and warmth); (d) where the projector is present
   (`≥ lg`), the **status light is RED**. The **background theater field is already at its final
   committed tone** in this off state — it is **not** dimmed (it never dims; see AC4b) — so the only ways
   the off state differs from the settled-on state are: lamp off, beam absent, ＋plus absent, miniature
   dim+cool, and (≥ lg) the red status light. (Testable: at animation start the plus-layer and beam
   elements are hidden/transparent, a brightness/opacity signal on the lamp and miniature is below its
   final value with a cool tint on the miniature, the status-light state is "red"/"off", and the
   `.about-theater-field` background tone equals its settled-on value — no full-field dim and no
   stage-box overlay.)

2. **Settled-on state equals the committed static poster (`178c148`), exactly.** After the intro
   completes (and at all times once settled-on, including after a toggle back ON settles), the
   centerpiece renders **pixel-equivalent to the committed static About poster on `main` at `178c148`** —
   same one full-page theater field, same projector at full brightness with its status light **green**,
   same three diagonal beams (at their committed geometry) reaching the dropped miniature, same
   fully-revealed ＋plus layer, same fully-lit (warm, bright) miniature, same theater radial tone, same
   miniature drop shadow (no warm halo), same "How it works" card in its tier-appropriate position
   (overlaid upper-left at `≥ xl`; first-in-flow above the scene when stacked). The committed static
   poster **already shows the green status light**, so the settled-on green light is not a new look.
   Verifiable two ways: (i) a Playwright screenshot of the **settled-on** scene matches the committed
   baseline within the project's normal pixel tolerance; (ii) once settled-on, no element carries a
   non-final inline opacity/transform/brightness/tint left over from the intro (the animation leaves the
   DOM in the same visual state the static poster has today). The intro is **additive** — it does not
   permanently alter the settled-on static look (AC10).

**The ordered sequence**

3. **Order is enforced, not simultaneous.** The intro plays the steps in this order, each beginning at
   or after the previous one's start (phases may overlap, but the *onset order* is fixed and
   observable): **(0) status light RED → GREEN → (1) lamp flicker → (2) lamp warm-up dim→bright → (3)
   beam fades in to its final geometry → (4) topic miniature warms to full illumination → (5) ＋plus
   layer fades in.** The **status-light RED → GREEN flip is the first observable action** — the warm-up
   (flicker onward) begins only *after* the light has gone green; nothing else changes before it. (There
   is **no** background-surface brighten step; the background field never animates — AC4b.) (Testable via
   timed sampling: the status light reads red at the first frame and flips to green before the lamp
   begins to flicker; the lamp shows uneven flicker before it reaches steady brightness; the beam's
   opacity rises from 0 toward full as the lamp warms, reaching full alongside the lamp; the topic
   miniature's brightness/warmth rises with the beam, reaching full at lamp-max; the plus layer's onset
   is after the beam.)

4. **Step coupling (the brighten dependency).** What reaches full at lamp-max is the **beam (full
   opacity)** and the **topic miniature's illumination** — **not** any background brighten. The coupling:
   the **topic miniature reaches full illumination (full warmth + brightness, cool tint gone) alongside
   the beam reaching full opacity — i.e. at lamp-max** — it does not finish warming before the lamp
   reaches max, and it does not begin to illuminate before the beam begins to fade in. (Testable: sample
   miniature brightness/tint, beam opacity, and lamp brightness over the timeline; miniature-final and
   beam-full must not precede lamp-max; sample the `.about-theater-field` background tone over the whole
   timeline and confirm it does **not** change — see AC4b.)

4b. **The background theater field does not animate — the page is a continuous field at every frame.**
    The intro (and any toggle) animates **only three things: the projector** (lamp flicker + warm-up +
    red→green status light), **the beam** (opacity fade-in), **and the page/miniature** (dim-cool →
    illuminate). The **background theater field (`.about-theater-field`) does NOT change** — no
    whole-field dim, no whole-field brighten, no surface ramp — and is at its final committed tone from
    the first painted frame through every frame of the intro and toggle. The only "illumination" change
    over background area is the **beam fading in over it** (step 3): the beam layer covers part of the
    field and brightens that covered region as its opacity ramps, but the underlying field tone is
    unchanged. There must be **no surface/room-dim overlay, and in particular no overlay scoped to the
    `.about-stage` box** — the field must read as **one continuous tone across the whole page at every
    frame**, never revealing the stage's rectangular outline (the deployed flaw this fixes). The
    miniature's own dim-cool→illuminate (AC4) stays **confined to the miniature element** and must not
    bleed into or dim the surrounding field. (Testable: sample the `.about-theater-field` background tone
    at the first frame, mid-intro, and settled — it is constant; there is no full-field opacity/brightness
    keyframe and no `.about-stage`-scoped dimming layer whose edge could appear; a screenshot at any
    mid-intro frame shows no rectangular stage outline against the surrounding field.)

5. **The plus reveal is the article gaining the layer — fade only, no motion.** The plus step animates
   the **＋plus layer appearing on an already-present article ground** — the article-ground elements
   (title, body lines, section heads) are present from the start (AC1) and are **not** what reveals;
   only the plus cards + clips reveal in. The reveal is an **opacity fade only** — the plus elements
   occupy their **final position and size throughout** and **do not scale, slide, translate, or
   otherwise move** in. (Testable: the article-ground nodes exist and are visible at animation start; the
   plus-layer nodes transition from opacity 0 → 1 during the plus step while their transform/box stays at
   the final value — no transform/position keyframes on the plus subtree.)

5b. **The beam reveal is a fade only — no grow, no position/scale change.** The beam reveals by
    **opacity (fade) into its committed final geometry** — the three cones are at their **final
    size/position from the first frame they animate**, ramping opacity 0 → full as the lamp warms. There
    is **no `scaleX` grow, no extend-along-the-throw, no translate/scale** of the beam. (Testable: over
    the beam phase the beam's opacity rises while its transform/geometry stays fixed at the final value —
    no scale/translate keyframes on the beam.)

**Reduced motion (parity)**

6. **`prefers-reduced-motion: reduce` ⇒ no auto-intro on load; toggle snaps.** Under
   `prefers-reduced-motion: reduce`, the page renders the **settled-on static state on first paint**
   with **no auto-intro**: no red→green flip, no flicker, no dim/cool start, no beam fade-in, no
   topic-warm ramp, no delayed/animated ＋plus reveal. (The background field has no animation in either
   motion mode — AC4b — so there is nothing to suppress there.) The lamp is at full brightness
   (status light green), the beams present at full opacity, the topic miniature fully lit, the ＋plus
   layer fully visible, the background field at its final committed tone — all immediately, identical to
   AC2's settled-on state.
   There is **no flashing** and **no content that appears late** on load. The **power toggle still works**
   (it is user-initiated, so reduced-motion does not suppress it — AC13/AC14), but it **snaps**
   instantly between the OFF state (AC1) and the settled-on state (AC2) with **no warm-up animation** (no
   flicker, no ramps, no fades — an immediate state swap). (Testable: Playwright with
   `reducedMotion: "reduce"` — the first painted scene equals the settled-on scene and no animation runs
   on load; activating the toggle swaps to the OFF state and back with no intermediate animated frames.)
   UX finalizes the exact reduced-motion toggle treatment (e.g. an instant cross-state swap).

**Accessibility (the intro is decorative-only)**

7. **All content present and reachable throughout — never gated by the intro.** During the intro and
   after it settles, in **both** motion modes: the "How it works" heading and steps and the scene's
   visually-hidden description are present in the DOM and exposed in the accessibility tree, and the
   **miniature title input** (the one real control) is present, in the tab order, focusable, editable,
   and able to navigate on Enter. The intro must **not** hide, disable, `display:none`, `aria-hidden`,
   or otherwise remove any of this content while animating, and must **not** delay its availability. The
   title input's **value is the dynamic picked title (AC16–AC18)** rather than a hard-coded string, but
   the control's presence, name, focusability, editability, and Enter-navigation are **unchanged**.
   (Testable: RTL renders the page and finds the heading text, the step list, and the named title input
   immediately, regardless of the simulated motion preference; Playwright can focus and submit the title
   input during/right after load.)

8. **The intro does not move or steal focus, and does not block input.** Loading `/about` does **not**
   programmatically move focus into the scene; the page's initial focus behavior is unchanged from
   today. A keyboard user can Tab to the title input and a pointer user can click it **during** the
   intro, and typing + Enter works immediately (no animation-gated input lock). (Testable: assert
   `document.activeElement` is not forced into the scene on load; drive the input during the intro.)

9. **No new color-only signal; decorative graphics stay decorative — except the projector control.**
   The animated beams, bloom, the lit/dim miniature, and the revealing plus cards/clips remain
   **decorative** (`aria-hidden` as today). The **status light's RED/GREEN is decorative and is not the
   sole carrier of any information a user must perceive** — the projector's on/off state is conveyed to
   assistive tech by the control's **state-reflecting accessible name** (AC13), not by the light's color
   alone. The animation adds no information a user must perceive as motion. The one intentional
   exception to "decorative graphics stay `aria-hidden`" is the **projector power control wrapper**,
   which is now a labeled, focusable control (AC13) — its inner decorative SVG stays `aria-hidden`, but
   the control itself is exposed in the accessibility tree with a name and a pressed/state value. The
   thesis remains available as the scene's visually-hidden text alternative and the "How it works" copy,
   unchanged. (Testable: the decorative SVG/graphic nodes keep `aria-hidden`; the projector control is
   the only newly-exposed node and carries a name reflecting on/off; the sr-only scene description and
   the card copy are unchanged.)

**Non-regression / additive**

10. **Auto-plays once on load; non-destructive; only the toggle replays.** The intro **auto-plays once
    per page load** and then stops; it does **not** loop, does **not** restart on scroll or hover, and
    leaves **no** residual animation running after it settles. The **only** way to replay it is the
    user-initiated power toggle (OFF then ON — AC13/AC14); an automatic re-trigger never happens. After
    each settle (on-load settle, or a toggle-ON settle), re-reading the DOM shows the static settled-on
    state with no lingering animation classes/inline styles that change the rendered look (AC2), and a
    settled-OFF state holds steady (no animation running) until the next toggle. (Testable: after the
    settle window no element is mid-animation; the scene is static; no replay fires without a toggle
    activation.)

11. **Screenshot baseline equals the settled-on state, deterministically — with a pinned title.** The
    committed UI screenshot baseline for the About surface is regenerated and captures the **settled-on
    final state** (not a mid-intro frame and not the OFF state). The capture is deterministic in **two**
    respects: (i) it must not race the intro or land mid-toggle (achieved via reduced-motion capture
    and/or a "settled-on" readiness signal); and (ii) **because the miniature title is now dynamic
    (AC16), the capture must pin the title to a fixed, deterministic value** — e.g. force the fallback
    `"Acer palmatum"`, or stub/seed the recently-curated read to a fixed title — so the About baseline
    does **not churn** as real curations change. With the title pinned, the About baseline shot is
    **unchanged from / equivalent to** today's committed About shot (which shows `"Acer palmatum"`).
    (Testable: the regenerated `docs/design/ui-screenshots` About PNGs match the prior committed About
    PNGs within normal tolerance; the catalog scene waits for a settled-on signal **and** renders a
    deterministic, pinned title; re-running the capture without a real-data change reproduces the same
    PNGs. Flagged for UX/Dev/QA: the catalog About scene must pin the title — see the deterministic-capture
    note.)

**Responsive (the intro works coherently at every supported width)**

12. **Responsive choreography — defined per width tier (the poster tiers of `178c148`).** The intro
    plays coherently at all three of the current poster layouts. The projector + its status light +
    beams are **only present `≥ lg`** in the current `Centerpiece.tsx`; below `lg` the miniature shows
    **alone** on the field (no projector, no status light, no beams). Therefore the **status-light
    RED → GREEN step (AC3 step 0) and the click/keyboard power toggle (AC13–AC15) apply only `≥ lg`** —
    where the projector control exists — while the **topic-illuminate (AC3 step 4) and ＋plus fade
    (AC3 step 5) still play `< lg`** on the standalone miniature. The tiers:
    - **`≥ xl` — the full POSTER:** the "How it works" card is **overlaid upper-left** (real-font, z
      above the beam), the projector sits **lower-left below the card**, a long **diagonal beam throws
      up-right** to the **dropped Topic-page miniature on the upper-right** (its bottom aligned with the
      projector's lower edge). The **full choreography** runs — red→green → flicker → warm-up dim→bright →
      the diagonal beam fades in to its geometry → the dropped miniature warms to full illumination →
      ＋plus fades in. (The background field does not brighten — AC4b — so there is no surface step.) The
      projector is the interactive power control. The card is **not** part of the choreography (AC6/AC7);
      it is present and lit from first paint.
    - **`lg`–`xl` — STACKED (card FIRST, the full poster scene below it):** the same projector + status
      light + beam + miniature scene runs the **full choreography** and the projector is the interactive
      control; only the page layout differs (the card is stacked above the scene rather than overlaid).
    - **`< lg` — STACKED, miniature ALONE (no projector / no status light / no beams):** the red→green
      step, the lamp flicker/warm-up, and the beam fade have no on-screen elements to play, and **there
      is no power toggle** (no projector control present). The reduced intro is **the topic miniature
      warming from dim/cool to full illumination (AC3 step 4) + the ＋plus layer fading in on the
      already-present article ground (AC3 step 5)**. These still play, coherently, with the same
      start/end-state guarantees (AC1, AC2) for the elements that are present (the miniature starts
      dim+cool with no plus, ends fully-lit with the plus revealed). The miniature still ends
      pixel-equivalent to today's `< lg` static miniature (soft drop shadow, no halo).
    - In **all** tiers, the page body **never scrolls horizontally** because of the intro or a toggle (no
      element is transformed/translated outside its clipped stage box — the `.about-stage` clips its
      inner frame; the reveals are opacity/brightness/tint only), and the settled-on state at every
      width equals the static poster's look at that width (AC2).
    (Testable: Playwright at mobile 390 / tablet 834 / desktop 1280 — assert the appropriate intro runs
    for the tier, the toggle is present and operable only `≥ lg`, no horizontal scroll appears at any
    frame, and the settled-on state matches the baseline at each width.)

**Click-to-toggle power (the new interactive control — applies `≥ lg`, where the projector exists)**

13. **The projector is a keyboard-operable, accessibly-labeled power control.** Where present (`≥ lg`),
    the projector is a **real control** — a focusable, keyboard-operable element (e.g. a `<button>`),
    **not** a click handler on a decorative `aria-hidden` SVG. It is reachable in the tab order, has a
    **visible focus indicator** (focus-visible), is activatable by **pointer click and keyboard
    (Enter/Space)**, and exposes a **state-reflecting accessible name** — its name (and/or pressed
    state) communicates whether the projector is **on or off** (e.g. an accessible name that reads as
    "turn projector off" when on / "turn projector on" when off, or an equivalent pressed-state
    semantic). Its inner decorative graphics stay `aria-hidden`. (Testable: RTL/axe finds a single
    named, focusable control for the projector; it has a non-empty accessible name reflecting state and
    is operable by keyboard; the SVG children remain `aria-hidden`; the focus ring is visible on
    `:focus-visible`.)

14. **Activating the control toggles power OFF then ON.** Activating the control (click or Enter/Space)
    when the projector is **ON** powers it **OFF** — the scene returns to the **initial pre-illumination
    OFF state** (AC1): lamp off, **beam gone** (opacity 0), topic miniature back to **dim + cool**,
    ＋plus layer **gone**, and the **status light back to RED** — while the **background field stays at
    its final tone** (it does not dim; AC4b). Activating it again when **OFF** powers it **ON** and
    **replays the full power-on sequence** (red→green → flicker → warm-up → beam fade-in → topic
    illuminate → plus fade-in — AC3; the background field does not change), settling into the settled-on
    state (AC2). The control's accessible name/state updates to match (AC13). Under motion
    enabled the OFF→ON replays the animation; under reduced motion both directions **snap** (AC6).
    (Testable: from the settled-on state, activate → assert the scene matches the OFF state (AC1) incl.
    red light, beam hidden, dim-cool topic, no plus; activate again → assert the on-sequence runs (motion
    on) or snaps (reduced) and settles to AC2; repeatable.)

15. **The toggle does not steal focus on load and does not disturb the on-load intro.** The presence of
    the control does **not** move or steal focus on load — the page's initial focus behavior is
    unchanged (AC8), the control is not auto-focused, and the **on-load auto-intro is unaffected** by the
    control existing (it still auto-plays once on load per AC10; the toggle is an *additional*
    user-initiated replay path, not a precondition for the on-load play). Activating the control is the
    user's deliberate action; nothing toggles power without user activation. (Testable: on load
    `document.activeElement` is not the projector control and is not forced into the scene; the on-load
    intro runs exactly as AC3 describes without any toggle interaction; the control changes state only on
    explicit activation.)

**Dynamic miniature article title (sourced from "recently curated")**

16. **The miniature title is picked from recently-curated articles, with `"Acer palmatum"` as the
    fallback, and is re-picked on every power-on.** `/about` reads the recently-curated topics via the
    existing `listCuratedTopicsAction()` seam and derives an **eligible title pool**: the recent-curation
    `title`s **that fit the miniature's single title line** — a title that would not fit on one line is
    **excluded** from the pool (it is **never truncated, wrapped, or shrunk** to fit; the fit test is a
    filter, not a transform). On **each power-on** — the **on-load auto-play** and **every toggle-ON**
    (AC10/AC14, `≥ lg` for the toggle; on-load applies at every tier) — the miniature title is **(re)set
    to one title chosen from the eligible pool**. The chosen title is the value the **editable title
    input** (`MiniatureTitleInput`) **starts at** for that power-on. If the eligible pool is **empty** (no
    recent curation fits, or the list is empty/unavailable), the title is the **fallback** `"Acer
    palmatum"` (today's `DEFAULT_TITLE`). Because the pick happens per power-on, a user toggling OFF then
    ON **may see the title change** between power-ons (re-picking the same title is acceptable — AC17). No
    article-side curation, schema, or policy is read or written — only the existing recently-curated list.
    (Testable: with a stubbed/seeded recently-curated list containing a mix of short and over-long titles,
    the miniature title at a power-on is one of the **fitting** titles and never an over-long one and never
    a truncated/ellipsized string; with an empty/unavailable list the title is exactly `"Acer palmatum"`;
    toggling OFF→ON re-runs the pick. The eligible pool is derived from `listCuratedTopicsAction()` and the
    over-long titles are absent from it.)

17. **The title is readable in every state; on a restarted power-on it flickers old→new with the lamp.**
    The miniature title is a **real, readable article title in all states** — dim/off and lit alike — and
    is **never hidden behind a placeholder/skeleton bar** while the projector is off or warming. On a
    **restarted** power-on (a toggle-ON that re-picks a title *different* from the one previously shown —
    i.e. after the user toggled OFF then ON), the title **text transitions from the OLD title to the NEW
    title during the lamp's flicker phase (AC3 step 1)**, synchronized with the lamp strikes, as if the
    projector is re-focusing on a different article. On the **first / on-load auto-play** (there is no
    prior title) there is **no** old→new flicker — the chosen title simply shows (readable from the first
    painted frame, per AC1, which shows the bare article ground including its title). If a power-on
    happens to **re-pick the same title**, there is **no visible title change** (acceptable). Under
    `prefers-reduced-motion: reduce` there is **no title flicker** — a re-picked toggle-ON simply shows
    the new (re)picked title with the rest of the scene snapping per AC6. (Testable: the title element
    holds a non-empty, non-placeholder string at the OFF state and at first paint; with a forced re-pick
    to a different title, the title text changes old→new during the flicker window under motion-enabled,
    and changes with no flicker/transition under reduced motion; with no prior title (first load) the
    title shows with no old→new transition.)

18. **The title remains the editable, Enter-to-navigate control — only its seed becomes dynamic.** The
    miniature title stays the **one real control** of the scene: the **named, keyboard-operable
    `MiniatureTitleInput`** (AC7/AC8 unchanged) — present in the tab order, focusable, editable, and
    navigating to the corresponding topic on **Enter** (via `topicHref`). The only change is that its
    **starting value for a power-on is the picked title (AC16)** rather than the hard-coded `"Acer
    palmatum"`. A user may still **edit** the field and press Enter to navigate to *their* title; the pick
    sets the **initial** value only and does **not** lock, disable, or overwrite the field after the user
    types, and does **not** auto-navigate. (Testable: the input is the same named control as today,
    editable and Enter-navigating; its initial value equals the picked title for the current power-on; a
    re-pick on a *later* power-on reseeds the value, but user-typed edits within a power-on are not
    clobbered by the animation.)

---

## Open product decisions (resolved here; assumptions for UX/Dev to refine)

These are Product calls made to keep the build unblocked. UX owns the motion design (easing, exact
phase timing/overlap, the flicker rhythm); Dev owns the mechanism. The starred ones are worth an owner
glance but should **not** block.

- **Replay policy — DECISION (revised): auto-play once per page load *and* a manual power toggle.** The
  intro auto-plays once on each load of `/about` (no loop, no scroll/hover replay), as before. The
  **owner's added behavior** is a user-initiated **power toggle on the projector** (`≥ lg`): clicking/
  activating it powers the projector OFF (back to the initial dark state) and ON again replays the
  power-on sequence. The toggle is the **only** replay path — AC10/AC13/AC14.
- ★ **Client-side navigation back to `/about` — DECISION: auto-play on each *load* of the route, including
  a client-side (App Router) navigation that mounts the centerpiece.** Rationale: the intro is the page's
  "warm-up," and a soft-nav to `/about` is, to the visitor, arriving at the page — replaying it is
  coherent and matches "on page load." It must remain one-shot per arrival (not loop). If the owner
  prefers "first visit per session only," that is a one-line gate UX/Dev can add later; **not** blocking.
  (A full reload always auto-plays.)
- **Performance posture — DECISION: CSS / Web-Animations only, GPU-friendly, appearance-only.** Animate
  **opacity, brightness/filter, and color-tint** (the beam and plus fades; the lamp and the miniature
  brightness-and-warmth ramps; the status-light color) — and **no position/scale animation of the beam,
  plus, or any element** (this iteration removed the beam grow and the plus scale/slide on purpose), and
  **no animation of the background field** (this iteration removed the whole-field surface dim/brighten
  on purpose — AC4b).
  **No** animation of layout properties, no per-frame JS layout reads, no long main-thread tasks. The
  intro must not introduce jank or **cumulative layout shift** (it animates appearance, not box flow —
  elements occupy their final layout boxes throughout, so nothing reflows). This matches the existing
  About/topic motion in `globals.css` (gated `@media (prefers-reduced-motion: no-preference)` keyframes).
- **Total duration — TARGET RANGE for UX to finalize: ~1.6–2.6s** end-to-end (the red→green flip + the
  flicker are the first few hundred ms; the warm-up/beam-fade/topic-warm/plus-fade/brighten fill the
  rest). This is a **range**, not a contract — long enough to read as a deliberate "warm-up," short
  enough not to make the visitor wait to interact (and interaction is never gated regardless —
  AC7/AC8). The same total applies to the toggle-ON replay. UX sets the precise timing and easing; this
  spec does **not** over-specify easing curves.
- **Flicker character — note for UX:** "a few quick, uneven flashes" (the owner's words) — irregular,
  not a smooth pulse, evoking a real projector striking, beginning *after* the status light goes green.
  Exact count/rhythm is UX's. Keep it brief so a reduced-motion user loses nothing meaningful (they get
  the settled-on state instantly on load, and a snap on toggle — AC6).
- **Status-light color — note for UX/Curation-of-look:** RED (off) → GREEN (on) is the owner's chosen
  power-indicator convention; the committed static poster already uses green for "on." The color is
  decorative (AC9) — assistive tech gets the state from the control's accessible name (AC13), not the
  color alone.
- **Title fit-threshold — DECISION (recommendation; non-blocking): a character-count cap tuned to the
  miniature title width, for the prototype.** AC16 requires excluding titles that don't fit the
  miniature's single title line. Two approaches: **(a) a character-count cap** (a fixed max length, tuned
  once to the miniature's title width + font, applied server-side when deriving the pool) — simple,
  deterministic, no client measurement, and works for the server-derived pool; or **(b) a measured fit**
  (the client measures rendered text width against the line box and excludes overflowing titles) — exact
  but requires client-side measurement and a layout pass, and is harder to do server-side where the pool
  is derived. **Recommendation: ship (a) — a character-count cap** for this prototype iteration: it keeps
  the pool derivation server-side (where `/about` reads `listCuratedTopicsAction()`), is deterministic
  and CLS-free, and the title line's width is fixed by the poster. UX should set the **exact cap value**
  tuned to the miniature's title line (font, weight, available width) so a title at the cap renders on one
  line without wrapping/overflow at every tier where the miniature shows; if a single safe cap proves too
  coarse across tiers, fall back to (b) for the affected tier. Either way the rule is a **filter** — a
  title over the threshold is **excluded, never truncated** (AC16). The fallback `"Acer palmatum"` (15
  chars) must itself be within the cap.

---

## Success metric

Analytics is deferred (no instrumentation ships here), so success is **observable conditions** the
owner / QA / UX confirm:

- **Primary (qualitative, confirmable now):** the projector→page→＋plus thesis **reads as motion** — a
  first-time viewer watching the page load sees, in order, the projector power on (red→green, lamp
  strike), the beam appear and the Wikipedia page brighten under it, and the ＋plus layer appear *on* the
  article, and comes away understanding that wiki+ **adds a curated video layer on top of a Wikipedia
  article**. The motion reinforces (does not contradict or obscure) the static composition. Confirmed by
  UX evaluation against the motion design spec and an informal owner read.
- **The beam fade reads as natural (the iteration's intent).** The revised beam (fade-in into final
  geometry, no grow/jitter) reads as a calm "light arriving" rather than the prior unnatural
  grow-along-throw. Confirmed by owner read against the deployed before-state.
- **The background field is one continuous tone — the stage-outline artifact is gone (this iteration's
  fix).** Because the whole-field surface dim/brighten and the `.about-stage`-scoped dim overlay are
  removed (AC4b), the deployed flaw — the stage's rectangular outline becoming visible against the rest
  of the page in the dark start state — no longer appears at any frame of the intro or a toggle. The
  page reads as one continuous field while only the projector, beam, and page/miniature animate.
  Confirmed by owner read against the deployed before-state and by a mid-intro screenshot showing no
  stage outline.
- **The interactive toggle works and is discoverable enough.** A pointer or keyboard user can power the
  projector off and on and watch the sequence replay; the control is operable and labeled (AC13–AC15).
  Confirmed by UX evaluation + an informal owner read.
- **Zero layout shift / no jank.** The intro animates appearance only; there is **no cumulative layout
  shift** and no visible main-thread stutter on a normal laptop/phone. (Confirmable now via devtools /
  Playwright; the deferred metric to instrument later is CLS = 0 on `/about` and no long tasks during
  the intro window.)
- **Reduced-motion parity.** Under `prefers-reduced-motion: reduce`, the page is **identical** to
  today's static About page on first paint — no auto-intro, no flashing, no late content, full a11y; the
  power toggle still works but snaps with no animation. (AC6.)
- **Static-look fidelity.** The settled-on state is pixel-equivalent to today's committed static About
  look at every supported width (AC2, AC11) — the animation is provably additive.

---

## Assumptions / follow-ups

- This is the long-deferred follow-up named in `docs/specs/about-page.md` (in-scope item 10 +
  the "animated centerpiece" out-of-scope note) and the centerpiece handoff's "Interactions &
  behavior." It is built on top of the **current** (post-redesign) About implementation
  (`178c148`: one full-page warm-dark theater field, `host="flat"`, the card + projector + beam +
  dropped miniature composed as a single poster within that field; transparent stage), **not** the
  older contained-panel composition described in `docs/design/about-page.md`. UX should write the motion
  spec against the current components (`Centerpiece.tsx` / `Projector.tsx` / `Beams.tsx` /
  `TopicMiniature.tsx`), whose ＋plus subtree is already separated for exactly this reveal, and against
  the poster tiers in AC12.
- **No new tokens/schema/data/auth/Server-Action.** The animation + power toggle are a pure client-side
  animation + a local client-state power toggle over existing markup and existing `@theme` tokens
  (`--color-theater-*`, the lamp/bloom/beam warms, the indigo hardbox tokens). A **dim/cool tint** for the
  topic-off state and a **red** status-light color may need a color value if one isn't already present —
  that is a small cosmetic token, not data/schema; UX/Dev decide whether an existing token covers it.
  Confirm no data/schema/auth/Server-Action is introduced.
- **Architecture note — `/about` now reads the recently-curated data (AC16–AC18).** To source the dynamic
  miniature title, `/about` (today a static server component) **reads the existing
  `listCuratedTopicsAction()`** (`lib/server/actions.ts` → `Promise<TopicWithStats[]>` per
  `lib/data/types.ts`; the same DataStore-seam read the homepage `app/page.tsx` uses via `TopicCard` —
  recency-ordered `updated_at desc`, filtered to `videos ≥ 1`), derives the **eligible-title pool**
  (filtered by the fit-the-title-line test), and passes **the pool + the fallback** (`"Acer palmatum"`) to
  the client miniature. This is a **reuse of an existing read** — **no schema change, no new Server
  Action, no new policy**. It does shift `/about` from **static-prerender to a dynamic/ISR read** (it now
  depends on live data). That is **acceptable for the prototype** — the production ISR/Redis read path is
  deferred per `docs/ARCHITECTURE.md` (Prototype phase). Dev confirms the read mode (dynamic vs. ISR with
  a short revalidate) is fine for the prototype and that an empty/failed read falls back cleanly to
  `"Acer palmatum"` (AC16) — `/about` must still render if the read returns nothing or errors.
- **Resolved decisions baked into this iteration (owner intent recorded):**
  - **Auto-play on load remains** — first load (and the existing replay model) still auto-plays the
    on-sequence (red→green→warm-up). The toggle is an *added* manual OFF/ON replay path, not a
    replacement for the on-load play (AC10/AC15).
  - **OFF state == the initial pre-illumination state** (AC1): dark lens + RED light + dim-cool topic +
    no beam + no ＋plus — with the **background field at its final tone (it never dims; AC4b)**.
    **Settled-ON == today's committed lit poster** (green light, lit) — so AC2 still holds and the static
    poster already shows the green light.
  - **The whole-field surface dim/brighten is removed (owner directive).** The intro animates **only**
    the projector, the beam, and the page/miniature; the **background theater field is static and
    continuous** at its final tone (AC4b). This fixes the deployed flaw where the `.about-stage`-scoped
    dim overlay exposed the stage's rectangular outline against the rest of the page in the dark start
    state. The page/miniature dim-cool→illuminate (AC4) stays, confined to the miniature element.
  - **The projector becomes a real interactive control** — keyboard-operable + accessibly-labeled with a
    state-reflecting name + focus-visible (NOT a click handler on an aria-hidden SVG). This is an
    accessibility requirement (AC13); UX designs the control treatment, the spec requires it exists.
  - **Reduced motion** — no auto-intro on load (lit settled poster on first paint, as today); the toggle
    still works (user-initiated) but **snaps** with no warm-up (AC6); and a re-picked toggle-ON shows the
    new title with **no** old→new flicker (AC17).
  - **The miniature title is dynamic, sourced from "recently curated"** (AC16–AC18): the pool is the
    recent-curation titles that **fit** the title line; `"Acer palmatum"` is the **fallback**; the title is
    **re-picked on each power-on** (auto-play + toggle-ON) and may change between power-ons; it is
    **readable in every state**; on a **restarted** power-on it **flickers old→new with the lamp**; it
    remains the **editable, Enter-to-navigate input**, only its seed becomes dynamic. `/about` reads the
    existing `listCuratedTopicsAction()` server-side (architecture note) — a read of existing data, no
    schema/policy change. The screenshot baseline pins the title deterministically (AC11).
- ★ **Replay-on-soft-nav** policy (above) — owner may prefer first-visit-only; non-blocking.
- The motion design (easing, exact phase timing/overlap, flicker rhythm, the beam-fade / topic-warm /
  plus-fade treatments, total duration within the ~1.6–2.6s range, the control's visual + reduced-motion
  snap treatment, the control's label wording) is **UX's contract**, refined in the design spec; this
  spec fixes order + bookend states + the interaction model + the a11y/reduced-motion/non-regression
  guarantees only.

### Assumptions the owner may want to reconsider (flagged, non-blocking)

- ★ **The `< lg` tier has NO power toggle and NO red→green step** — because the projector + status light
  are simply absent below `lg` in today's poster (only the standalone miniature shows). So a phone/narrow
  visitor gets the topic-warm + plus-fade auto-intro but **cannot** interactively power-toggle, and never
  sees the red→green or the lamp/beam at all. If the owner wants the *interactive* projector to be a
  first-class part of the mobile experience, that's a **bigger change** (it would mean introducing the
  projector + beam into the `< lg` composition, i.e. restyling the responsive poster — explicitly
  out-of-scope here). Recommend keeping `< lg` as-is for this iteration and revisiting the mobile
  composition separately if the toggle proves valuable.
- ★ **The toggle's discoverability** — making the projector clickable adds an interaction with **no
  always-visible affordance** (it looks like the same projector graphic). Reduced-motion users especially
  get no on-load motion hinting it's interactive. UX should decide whether any subtle affordance
  (cursor/hover/focus-visible-only, or a tiny label) is warranted, or whether discoverability is
  acceptably "easter-egg" for a decorative front-door moment. Flagged for the owner because it trades off
  against "the projector graphic must still read as the committed static poster at rest" (AC2).
- ★ **A motion-enabled visitor who toggles OFF then navigates away** leaves no persistent state (local
  client state only) — every fresh load auto-plays ON again. That matches "auto-play on load remains."
  Calling it out in case the owner expected a remembered off-preference (we are **not** persisting one).

---

## Hand-off

- **UX (next):** update the motion / choreography design spec for the warm-up at
  `docs/design/about-projector-warmup.md` (or extend `docs/design/about-page.md` with a motion
  section) for this iteration — the exact phase boundaries/overlaps and easing for the steps including
  the new **status-light RED → GREEN first step**, the flicker rhythm, the dim→bright ramp values for
  the **lamp** (the background field does **not** ramp — it is static and continuous; AC4b), the **beam
  fade-in** treatment (opacity into final geometry, **no** grow), the
  **topic miniature's dim-cool → fully-lit** treatment (the cool/fluorescent tint and how it warms to
  the committed lit look, reaching full at lamp-max alongside the beam), the **＋plus fade-in** treatment
  (opacity only, **no** scale/slide), the total duration within the ~1.6–2.6s range, the reduced-form
  choreography `< lg` (topic-warm + plus-fade), the `prefers-reduced-motion: reduce` end-state, and —
  new this iteration — the **projector power-control treatment**: the control's visual + focus-visible
  state, its accessible-name wording for on/off, the OFF (dark) rest appearance, and the reduced-motion
  **snap** toggle treatment (AC6/AC13–AC15). **New this iteration — the dynamic miniature title
  (AC16–AC18):** design the **title old→new flicker on a restarted power-on** — how the title text
  transitions old→new **synchronized with the lamp flicker** (AC3 step 1 / AC17), and confirm there is
  **no** such flicker on the first/auto-play and **none** under reduced motion; confirm the title is
  **readable in every state** (dim/off + lit) and is **never** a placeholder/skeleton bar; and set the
  **title fit-threshold** — the exact character-count cap (recommended) tuned to the miniature's title
  line so a fitting title never wraps/overflows at any tier (see the fit-threshold decision). **New this
  iteration — the background field is static and continuous (AC4b):** the motion spec must animate **only**
  the projector, the beam, and the page/miniature — **drop any whole-field surface dim/brighten and any
  `.about-stage`-scoped dim overlay** (which exposed the stage outline in the deployed version). The
  miniature's dim-cool→illuminate stays but must be confined to the miniature element, not bleed into the
  field. Work against the current components named above; the settled-on static state is the fixed
  endpoint. Confirm: no settled-on static-look change, no background-field animation, no focus move on
  load, content never gated (AC2, AC4b, AC6–AC10, AC15).
- **Development (after UX):** implement the intro as CSS/Web-Animations gated behind
  `@media (prefers-reduced-motion: no-preference)` (mirroring the existing About/topic motion in
  `globals.css`), animating **opacity / brightness / color-tint only — no position/scale** on the beam,
  plus, or any element, over the existing markup — the lamp (the white "+" aperture + bloom in
  `Projector.tsx`), the **status light** (RED↔GREEN, in `Projector.tsx`), the three beam cones (fade-in,
  `Beams.tsx`), the separable ＋plus subtree (fade-in, `TopicMiniature.tsx`), and the topic miniature's
  dim-cool→lit appearance (confined to the miniature element). **Do NOT animate the background theater
  field (`.about-theater-field`) — it is static and continuous at its final tone (AC4b); remove any
  whole-field surface dim/brighten and, critically, any dim overlay scoped to the `.about-stage` box
  (which revealed the stage's rectangular outline in the deployed version). The only illumination over
  background area is the beam fading in over it.** Keep the article-ground present from the start; reveal
  only the plus layer (fade). Implement the **projector as a real keyboard-operable, accessibly-labeled power
  control** (a `<button>` wrapper with a state-reflecting accessible name + focus-visible — **not** a
  click handler on the decorative `aria-hidden` SVG; the SVG stays decorative) that toggles OFF↔ON and
  replays the on-sequence (snap under reduced motion). No focus move on load, no input gating, no layout
  shift. **New this iteration — the dynamic title (AC16–AC18):** make `/about` **read
  `listCuratedTopicsAction()` server-side** (the architecture note), derive the **eligible-title pool**
  (apply the fit-threshold cap UX sets — exclude over-long titles, never truncate), and pass **the pool +
  the fallback `"Acer palmatum"`** to the client miniature; the client **(re)picks** a title on each
  power-on (auto-play + toggle-ON), **seeds** the existing `MiniatureTitleInput` with it (still editable,
  still Enter-navigates via `topicHref` — AC18), keeps the title **readable in every state** (no
  placeholder bar — AC17), and **flickers the title old→new during the lamp flicker on a restarted
  power-on only** (no flicker on first/auto-play; none under reduced motion). Ensure `/about` **falls back
  cleanly** to `"Acer palmatum"` on an empty/failed read, and confirm the render-mode change
  (static→dynamic/ISR) is fine for the prototype. Ensure the screenshot-baseline capture settles
  deterministically to the settled-on state **and pins the title to a fixed value** (AC11) and refresh
  the About baseline. Hand to QA & Review for verification against AC1–AC18, then UX evaluates the built
  motion + control + dynamic title against the design spec.
