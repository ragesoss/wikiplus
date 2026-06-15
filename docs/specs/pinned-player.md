# Spec: Persistent pinned player — preview candidate videos in-app without leaving wiki+

**Issue:** [#10](https://github.com/ragesoss/wikiplus/issues/10) · **Type:** build (read-side — in-app candidate preview) · **Status:** spec
**Owner:** Product · **Feeds:** UX (flow + design spec, `docs/TOPIC_PAGE_DESIGN.md` update), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#3](https://github.com/ragesoss/wikiplus/issues/3)/[#6](https://github.com/ragesoss/wikiplus/issues/6) (live YouTube candidate auto-suggestion — shipped), the Topic Page v1 player (`components/topic/PlayerModal.tsx`, `VideoThumb.tsx`) · **Relates to:** `docs/TOPIC_PAGE_DESIGN.md` (General strip, empty/zero-curation state), `docs/ARCHITECTURE.md` ("Embed, never host video")

---

## Problem / gap

The empty / zero-curation state already surfaces **auto-suggested YouTube candidates** (the General-strip
tiles and per-section `CandidateCard`s). A reader is meant to **judge a candidate's relevance** and then
promote or dismiss it. But the only way to actually *watch* one today is to leave wiki+:

- **Candidates open a new tab.** Curated clips render `VideoThumb` **with** an `onPlay` handler
  (`onPlay={() => onPlay(clip)}` → `setPlayer`), so a curated YouTube clip plays in-app. **Candidate**
  surfaces render `VideoThumb … candidate` **without** `onPlay` (see `GeneralStrip` empty branch and
  `CandidateBits`/`CandidateCard`). With `onPlay` undefined, `VideoThumb.activate()` falls through to
  `window.open(video.watchUrl, "_blank", "noopener")` — **even for YouTube candidates**. So evaluating a
  suggestion kicks the reader out to YouTube, where the whole point (compare against the article, then
  promote/dismiss here) is lost and the recommendation feed pulls them away.
- **The existing player is blocking.** `PlayerModal` renders inside `ModalShell` — a focus-trapping,
  page-blocking overlay. Even if candidates were wired into it, it would *prevent* the behavior this
  feature needs: keep reading / keep scrolling while a clip plays, and **click a different candidate to
  swap what's playing** so a reader can rapidly triage several suggestions. A modal forces close-then-reopen
  for every candidate.

The result: the candidate-evaluation loop — the engine of the curation flywheel — is broken at the
"watch & weigh" step (VISION step 3). A reader can't cheaply preview suggestions where the article and the
promote/dismiss controls are.

## User value

**Who:** a reader (anonymous, no login) on a Topic page with auto-suggested candidates — typically an
**empty / uncurated** topic — deciding which suggestions are worth promoting.

**Value:** they can **click play and watch the candidate inside wiki+** in a player that **docks in a
fixed standard position, keeps playing as they scroll, and lets them keep interacting with the page** —
including clicking another candidate to **replace** what's playing. They can preview several candidates
back-to-back against the article and then **promote or dismiss** each, never leaving for YouTube and
never losing their place. For the product, this restores the "watch & weigh → contribute" loop in-app,
which is what feeds curation.

---

## What the prototype already gives us (grounding)

This is deliberately a small, focused build — the embed plumbing already exists; the gap is the *player
shape* and *wiring candidates to it*.

- **The embed-never-host facade exists.** `PlayerModal` already builds the autoplay embed src
  (`embedUrl + "autoplay=1"`), creates the `<iframe>` **only when a clip is activated** (the component
  mounts on play), and **tears it down on close** (the component unmounts). Nothing loads on initial page
  render; autoplay is set because the user explicitly clicked. The new pinned player must preserve this
  exact lifecycle — iframe created on play, destroyed on dismiss.
- **The `onPlay` seam exists.** `VideoThumb` already routes **YouTube** to `onPlay()` and **everything
  else** to `window.open(watchUrl)`. Candidates simply aren't passed an `onPlay`. Wiring them is "give the
  candidate surfaces an `onPlay` that opens the pinned player."
- **The data is there.** `Candidate extends VideoBase`, so a candidate already carries `platform`,
  `embedUrl?`, `watchUrl`, `orientation`, `caption`, and `creator` — the same fields the player and thumb
  consume for a `Clip`. No data-model change is needed.
- **Player state lives in `TopicView`.** Today: `const [player, setPlayer] = useState<Clip | null>(null)`
  and `{player && <PlayerModal clip={player} onClose={() => setPlayer(null)} />}`. The candidate surfaces
  receive `onPlay`/`onPromote`/`onDismiss` callbacks from `TopicView` already (`GeneralStrip`,
  `CandidateCard`) — this feature adds a play callback to the candidate path. (`setPlayer` is typed `Clip`;
  Dev will widen the player state to accept the candidate's playable fields — see Development hand-off.)
- **Reduced-motion is already detected.** `TopicView` reads `prefers-reduced-motion` into
  `prefersReduced.current` and threads it down (e.g. into `GeneralStrip`); the player can reuse the same
  signal.

---

## Scope

1. **A persistent, non-blocking pinned player** rendered at the Topic-page level: **fixed position**,
   **survives scroll**, **does not block** page interaction (no focus trap; the reader can scroll, click,
   promote/dismiss, and open another candidate while it plays), **single instance** (one concurrent video).
2. **Wire the candidate surfaces** — the General-strip candidate tiles (`GeneralStrip` empty branch) and
   the section `CandidateCard`s — so clicking a **YouTube** candidate's play affordance opens it in the
   pinned player **instead of** `window.open`.
3. **Swap behavior:** clicking a different candidate while a video is playing **replaces the currently
   playing video in the same player** (changes the iframe `src`), rather than opening a second player or a
   new tab.
4. **Dismiss affordance:** the player has a clear, labeled control to close it, and **dismissing tears down
   the iframe** (the embed is removed from the DOM; playback stops).
5. **Graceful degradation:** a candidate with **no embeddable URL** does not produce a broken/empty player
   (Decision 3); **non-YouTube** candidates keep their current new-tab behavior (Decision 1).
6. **Accessibility model for a non-modal persistent player** (Decision 2): labeled region, keyboard
   reachable, must **not** steal focus on open, dismissible by keyboard, respects reduced-motion, AA contrast.
7. **The UX placement/size/responsive decision recorded in `docs/TOPIC_PAGE_DESIGN.md`** — desktop standard
   position vs. mobile bottom-bar treatment (the app is vertical-first), the dismiss affordance, and what
   metadata shows alongside (caption / creator) — authored by UX as a design-spec update before Dev builds.

Out-of-scope items below are excluded **by product decision**, not omission.

## Out of scope (explicit)

- **TikTok / Instagram in-app embeds.** Non-YouTube candidates **keep their current new-tab behavior**
  (`window.open(watchUrl)`); the pinned player is **YouTube-only** this run (Decision 1). This matches
  ARCHITECTURE's note that TikTok embeds are unreliable and YouTube uses the click-to-load facade.
- **Migrating curated clips off the blocking `PlayerModal`.** Curated clips keep the existing modal
  **unless** unifying the two is trivial (Decision 4). If they are not unified, the resulting
  inconsistency (curated = modal, candidate = pinned player) is recorded as a **follow-up**, not fixed here.
- **Bigger thumbnails / strip-and-rail redesign.** The candidate tiles, cards, and rail layout are
  unchanged; this feature only changes *where the click leads*.
- **Any server-side embed / oEmbed work.** No origin route, no oEmbed call, no API key. The prototype
  stores `platform` + `embedUrl` and builds the facade client-side, exactly as `PlayerModal` does today.
- **Picture-in-picture, multi-window, playlist/queue, or "play next candidate" automation.** One concurrent
  video, swapped on explicit click. No autoplay of a *next* candidate.
- **Persisting player state across navigation / reload.** The player is ephemeral session UI; closing it or
  leaving the topic ends playback. No `DataStore` write.
- **Analytics instrumentation.** The success metric is *defined* below; no tracking is built (Analytics is
  deferred — VISION/CLAUDE.md).

---

## Product decisions — the contract for UX and Development

UX owns the *look, placement, and responsive flow*; these fix the *behavior*.

### Decision 1 — YouTube-only in the pinned player; non-YouTube keeps new-tab

Only **YouTube** candidates (the auto-suggested ones, the sole live source today) play in the pinned
player. For any non-YouTube candidate the current behavior is unchanged: `VideoThumb` opens the watch URL
in a new tab and continues to show its "opens ↗" affordance. This is the same YouTube/non-YouTube split
`VideoThumb.activate()` already encodes — we are only supplying `onPlay` for the YouTube path.

### Decision 2 — Non-modal, focus-respecting persistent player (the a11y contract)

The pinned player is a **labeled, non-modal region** (the issue's "accessibility model for a non-modal
persistent player"). Required outcomes (the *markup pattern* is UX's to specify):

- It is an accessible, **labeled** region/landmark (a screen reader can find it and knows what it is).
- Opening the player **does not move/steal focus** away from where the reader was acting (so triaging
  several candidates by keyboard isn't disrupted) — contrast with the modal, which traps focus.
- The player's controls (at minimum **dismiss**) are **keyboard reachable and operable**, with a visible
  focus indicator.
- It **does not trap focus** and does not block the rest of the page from keyboard/mouse interaction.
- It respects **`prefers-reduced-motion`** (no non-essential motion/animated dock-in when reduced motion
  is requested — reuse the existing `prefersReduced` signal).
- All player chrome (controls, labels, metadata) meets **WCAG AA** contrast and never signals by color alone.

### Decision 3 — Graceful degradation for a candidate with no embeddable URL

A YouTube candidate with **no `embedUrl`** must **not** open a broken/empty player. Product-acceptable
outcomes (UX picks one): (a) the play affordance falls back to opening `watchUrl` in a new tab (same as
non-YouTube), **or** (b) the pinned player opens and shows the existing "This clip can't be embedded."
message (as `PlayerModal` already does for a missing src) rather than a blank black frame. Either way: **no
empty iframe, no broken player, no console-error crash.** The reader is never shown a dead player.

### Decision 4 — Curated clips: unify only if trivial; otherwise note the inconsistency

The owner's call is **"Candidates only."** Curated clips keep playing in the existing blocking
`PlayerModal`. If — and only if — pointing the curated `onPlay` path at the new pinned player is **trivial**
(no behavior regression to the curated experience, no extra design work), Dev *may* unify them. If it is
not trivial, **do not** force it: leave curated clips on the modal and record the curated-vs-candidate
inconsistency as the open follow-up below (this is the recorded open Product question). This decision must
not expand scope.

---

## Acceptance criteria

Each item is independently verifiable by an automated test (Vitest/RTL component test or Playwright e2e)
**or** a concrete manual check. The Wikipedia/Wikidata calls and the candidate set are **mocked/seeded** in
tests (no network in CI — the established pattern in `docs/ARCHITECTURE.md` "Testing"). "Candidate" = an
auto-suggested, unvetted `Candidate` (empty-state) tile/card. "Play affordance" = the `VideoThumb` button
on a candidate. The seeded fixtures must include at least one **YouTube candidate with an `embedUrl`**, one
**YouTube candidate with no `embedUrl`**, and one **non-YouTube candidate**.

**In-app playback (the core gap)**

1. **Clicking a YouTube candidate plays in-app — no new tab.** Activating the play affordance on a YouTube
   candidate (with `embedUrl`) opens the pinned player rendering an `<iframe>` whose `src` is that
   candidate's `embedUrl` (with autoplay), and **does not call `window.open`**. *Verify:* component/e2e
   test spies on `window.open` (asserts not called) and asserts an iframe with the expected `src` is in the
   document.

2. **The player is fixed-position and survives scroll.** Once playing, the player is rendered at a
   **fixed** standard position (not in normal document flow), and scrolling the page does **not** remove or
   detach it — it stays in place and the iframe is not re-created (playback continues). *Verify:* component
   test asserts the container uses fixed positioning and remains mounted after a simulated scroll; e2e
   scrolls and asserts the same iframe element persists.

3. **The page stays interactive while the player is open (non-blocking).** With the player open, the reader
   can still scroll, activate the article/rail, and operate the candidate **Promote** / **Not relevant**
   controls — the player does **not** block pointer or keyboard interaction with the rest of the page and
   does **not** trap focus. *Verify:* component test asserts a candidate's Promote/Dismiss handler still
   fires while the player is open and that focus is not trapped inside the player.

4. **Single instance / one concurrent video.** At most **one** pinned player and **one** playing iframe
   exist at a time, regardless of how many candidates have been clicked. *Verify:* after clicking two
   different candidates in sequence, the document contains exactly one player container and exactly one
   video iframe.

5. **Clicking a different candidate swaps the iframe `src`.** With candidate A playing, activating
   candidate B replaces the playing video **in the same player** — the iframe `src` becomes B's `embedUrl`
   (with autoplay) — rather than opening a second player or a new tab. *Verify:* component/e2e test asserts
   the single iframe's `src` changes from A's to B's `embedUrl` and `window.open` is not called.

6. **Dismiss tears down the iframe.** The player exposes a clear, labeled dismiss control; activating it
   **removes the player and its iframe from the DOM** (playback stops; no hidden iframe keeps running).
   *Verify:* after dismiss, the test asserts no video iframe and no player container remain in the document.

**Graceful degradation / platform split**

7. **A candidate with no embeddable URL degrades gracefully.** Activating a **YouTube** candidate that has
   **no `embedUrl`** does **not** produce a broken/empty player: per Decision 3 it either opens `watchUrl`
   in a new tab **or** shows the "can't be embedded" message — and in **no** case renders an empty/`src`-less
   video iframe or throws. *Verify:* component test asserts that no iframe without a valid `src` is rendered
   and no error is thrown; whichever Decision-3 branch UX/Dev choose is asserted explicitly.

8. **Non-YouTube candidates keep new-tab behavior.** Activating a **TikTok/Instagram/other** candidate calls
   `window.open(watchUrl, "_blank", …)` and does **not** open the pinned player. *Verify:* component test
   spies on `window.open` (asserts called with the watch URL) and asserts no player iframe appears.

**Accessibility (baseline, per CLAUDE.md "Accessibility is baseline"; Decision 2)**

9. **Labeled, non-modal region.** The pinned player is exposed as an accessibly **labeled** region/landmark
   (discoverable and named to assistive tech) and is **not** marked as a modal dialog / does not apply a
   focus trap. *Verify:* RTL test queries the player by accessible role/name and asserts it is not a
   focus-trapping modal (e.g. no `aria-modal="true"` trap; AC3's interactivity check corroborates).

10. **Does not steal focus on open.** Opening the player from a candidate's play button leaves keyboard
    focus where the reader was (it does **not** auto-move focus into the player). *Verify:* component test
    triggers play and asserts `document.activeElement` is not inside the player container.

11. **Keyboard-operable dismiss.** The dismiss control is reachable and operable by keyboard alone (Tab to
    it, Enter/Space to activate), with a visible focus indicator, and dismissing returns/leaves focus
    sensibly (does not drop focus to `<body>` without reason). *Verify:* RTL test reaches and activates
    dismiss via keyboard; manual pass confirms focus visibility.

12. **Respects reduced-motion.** With `prefers-reduced-motion: reduce`, the player introduces no
    non-essential motion (no animated slide/dock-in). *Verify:* component test with the reduced-motion
    media query mocked asserts the motion-gated class/behavior is off (the project's existing
    `prefersReduced` pattern is the precedent).

13. **AA contrast, not color-alone.** The player chrome (dismiss control, any caption/creator metadata,
    borders) meets **WCAG AA** contrast against its background, consistent with the Indigo Press tokens, and
    no state is signaled by color alone. *Verify:* UX design-eval against the design spec + a contrast check
    on the shipped tokens (the `lib/curation/labels.ts` chip-contrast test is the precedent).

> **Note on AC9–AC13:** the *exact* markup (which landmark/role, the dock animation, the dismiss glyph,
> what metadata shows) is **UX's design decision**, recorded in `docs/TOPIC_PAGE_DESIGN.md`. These criteria
> fix the *outcome* (in-app, non-blocking, single-instance, swappable, dismissible-tears-down, labeled,
> focus-respecting, reduced-motion, AA), not the specific implementation. QA verifies the outcome against
> whatever pattern UX ships.

---

## Success metric

**Primary:** **In-app candidate-preview rate** — once light analytics exist (deferred, see below), the
share of candidate-video previews that happen **inside wiki+** (pinned player opened) rather than as a
new-tab departure. Target: candidate previews shift from "almost all leave for YouTube" (today's
new-tab-only behavior) to **predominantly in-app**. The signal that the feature worked is that readers can
and do evaluate candidates without leaving.

**Secondary:** **Preview → decision rate** — the share of in-app candidate previews followed (in the same
session) by a **promote or dismiss** on a candidate. The feature's purpose is to make "watch & weigh →
contribute" cheap; the right downstream signal is that previewing leads to a curation decision, not just a
view. (A healthy pattern is several candidates previewed-then-triaged in one sitting, which the swap
behavior — AC5 — is designed to enable.)

**Qualitative, available now:** in the prototype (no analytics), the metric is proven by the **acceptance
tests** that a candidate plays in-app (AC1), survives scroll (AC2), swaps on a second click (AC5), and that
Promote/Dismiss remain operable while it plays (AC3) — i.e. the *capability* the metric measures is
demonstrably present before traffic exists.

> **Analytics is deferred** (CLAUDE.md / VISION non-goals: "Analytics-as-role" comes at launch). This spec
> *defines* the metric so the instrumentation hook is unambiguous when analytics lands; no tracking is
> built in this issue. The buildable contract is the AC set above.

---

## Assumptions / open questions for follow-up

- **"Candidates only" scope (owner's call, recorded).** This run wires **only candidates** into the pinned
  player. Curated clips keep the blocking `PlayerModal` unless unification is trivial (Decision 4). Holding
  this line is deliberate, not an oversight.
- **OPEN (for Product) — should the pinned player eventually *replace* the blocking modal everywhere?**
  If unification is **not** done trivially this run, curated clips (modal) and candidates (pinned player)
  will use **two different play UIs** — an inconsistency. The product question is whether curated clips
  should adopt the same persistent-pinned model for consistency (and whether a reader benefits from the
  same "keep reading while it plays / swap clips" behavior on curated clips). **Likely a follow-up issue**;
  not decided here. Whether Dev unifies trivially or not, the decision/inconsistency should be reported.
- **OPEN (for UX) — exact standard position + mobile treatment.** Desktop corner vs. mobile bottom-bar
  (vertical-first), player size at each breakpoint, the dismiss affordance, and which metadata
  (caption/creator) shows alongside. To be specified in the `docs/TOPIC_PAGE_DESIGN.md` update before Dev
  builds. (Note the player must coexist with the existing sticky plus rail and the scroll-sync without
  obscuring the Promote/Dismiss controls — AC3.)
- **Assumption — one concurrent player (one video at a time).** Carried from the issue. No queue, no PiP,
  no multi-window.
- **Assumption — vertical (9:16) candidates exist.** YouTube Shorts candidates are flagged
  `orientation: "vertical"` (the auto-suggest pipeline sets this). The pinned player must render both 9:16
  and 16:9 acceptably at its standard size — UX's sizing call covers both, as `PlayerModal` already does.

---

## Hand-off

- **UX (next):** owns the *flow and design spec*, recorded as an update to `docs/TOPIC_PAGE_DESIGN.md`:
  the pinned player's **standard position + size + responsive behavior** (desktop corner vs. mobile
  bottom-bar, vertical-first), how it coexists with / relates to the blocking `PlayerModal`, the **dismiss
  affordance**, what **metadata** shows alongside (caption / creator), and the **accessible non-modal
  pattern** satisfying AC9–AC13 (labeled region, no focus-steal/trap, keyboard dismiss, reduced-motion, AA
  on Indigo Press tokens). It must not obscure the Promote/Dismiss controls while open. Inputs: this spec +
  `docs/TOPIC_PAGE_DESIGN.md` (General strip, empty state) + `mockups/inline-indigo-empty-v2.html`.
- **Development (after UX):** build a **persistent, non-blocking pinned player** at the Topic level (fixed
  position, single instance, iframe created on play / torn down on dismiss, swap-on-new-click), reusing the
  existing embed-facade lifecycle from `PlayerModal` (autoplay src construction; mount-on-play /
  unmount-on-close). **Wire the candidate surfaces** — pass an `onPlay` for YouTube candidates through
  `GeneralStrip` (empty branch) and `CandidateBits`/`CandidateCard` to `VideoThumb`, replacing the new-tab
  fall-through for YouTube candidates only. Widen the `TopicView` player state (today
  `useState<Clip | null>`) to accept a candidate's playable fields (`embedUrl`, `caption`, `orientation`)
  — a `Candidate` already extends `VideoBase`, so no data-model change is needed. Handle the no-`embedUrl`
  path per Decision 3; keep non-YouTube on `window.open` (Decision 1). **Reuse** the existing
  `prefersReduced` signal in `TopicView`. Introduce **no** server infra, oEmbed call, secret, or write path.
  If unifying curated clips onto the pinned player is trivial, do so (Decision 4); otherwise leave the modal
  and report the inconsistency. Add Vitest component tests + a Playwright e2e covering the ACs (candidate set
  seeded; Wikipedia calls intercepted).
- **QA & Review (after Dev):** verify each AC (especially AC1 no-new-tab, AC4 single-instance, AC5 swap,
  AC6 teardown, AC7 graceful no-embed, AC8 non-YouTube new-tab), confirm the player is **non-modal and does
  not steal/trap focus** (AC3/AC9/AC10), and run the accessibility + security review (the only embedded
  content is a YouTube iframe via the existing facade — confirm no new secret, no server route, and that the
  iframe is created on explicit play and removed on dismiss). Report whether curated clips were unified or
  the inconsistency remains (the open follow-up).
