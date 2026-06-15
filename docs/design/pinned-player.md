# Design spec — Persistent pinned player (candidate preview)

**Issue:** [#10](https://github.com/ragesoss/wikiplus/issues/10) · **Role:** UX / Design ·
**Status:** design spec (written *before* Dev) · **Builds from:** `docs/specs/pinned-player.md`
(AC1–AC13, Decisions 1–4) · **Feeds:** Development (build), QA & Review + UX (evaluation)
**Scope:** Candidates only (Decision 4). Curated clips keep `PlayerModal` this run.

This is the buildable contract for the **PinnedPlayer** — a non-modal, persistent, single-instance,
YouTube-candidate-only player that docks in a fixed standard position so a reader can preview a
suggested clip *inside wiki+*, keep scrolling and reading, and click another candidate to swap what
plays — then promote or dismiss without ever leaving for YouTube. The canonical design decision is
also recorded in `docs/TOPIC_PAGE_DESIGN.md` ("The pinned candidate player").

> **What this is NOT.** Not a redesign of curated playback (the modal stays), not bigger thumbnails,
> not a strip/rail re-layout, not PiP / queue / "play next." It only changes *where a YouTube
> candidate's play click leads* and adds one new persistent surface.

---

## 1. Personas served

- **Priya — the deciding reader (primary).** Anonymous, no login, landed on an empty / uncurated
  Topic page (e.g. via a wikilink). She sees auto-suggested YouTube candidates and wants to judge
  *which are worth promoting* without losing her reading place or being pulled into YouTube's feed.
  She is the persona the success metric (in-app preview rate) is about.
- **Cory — the keyboard / AT reader.** Navigates by keyboard and/or a screen reader. Must be able to
  preview a candidate, find and operate the player, dismiss it, and keep triaging — none of which
  may hijack his focus or trap him.
- **Mona — the curator-in-the-making.** Once a preview convinces her, she reaches for **Promote**
  (or **Not relevant**) on that same candidate. Those controls must stay fully operable *while the
  player is open* — the player must never sit on top of them.

## 2. User stories (feed Product's AC; map below)

- **S1.** *As Priya, I want to click a suggested video and watch it right here, so I can judge it
  against the article without leaving wiki+.* → AC1
- **S2.** *As Priya, I want the player to stay put as I scroll the article, so I can compare the clip
  to the text while it keeps playing.* → AC2
- **S3.** *As Mona, I want to Promote or dismiss a candidate while its video is still playing, so the
  player never blocks my decision.* → AC3
- **S4.** *As Priya, I want clicking a second suggestion to replace the one playing (one player, not a
  pile of tabs), so I can rip through several quickly.* → AC4, AC5
- **S5.** *As Priya, I want a clear way to close the player and stop the video, so it's gone when I'm
  done.* → AC6
- **S6.** *As Priya, I never want a click to drop me on a black/broken player.* → AC7
- **S7.** *As Priya, I want non-YouTube suggestions to keep opening where they live (a new tab), so
  behavior is predictable.* → AC8
- **S8.** *As Cory, I want the player announced and named, never to have my focus yanked into or
  trapped by it, and to dismiss it from the keyboard with a visible focus ring.* → AC9, AC10, AC11
- **S9.** *As Cory (reduced-motion), I don't want the player to slide/animate at me.* → AC12
- **S10.** *As any reader, I want the player chrome legible (AA) and never to rely on color alone.* → AC13

---

## 3. Information architecture & where it lives

The PinnedPlayer is a **new Topic-page-level surface**, a sibling of the existing modals at the end
of `TopicView`'s render (alongside `{player && <PlayerModal …>}`). It is *not* inside the rail, the
General strip, a section, or the article column — it floats in a fixed layer above page content,
**below** the app modals' z-index (a modal, when one opens, covers it; see §8 z-index).

It is driven by the same single piece of `TopicView` state that today opens the modal — widened to
carry a candidate's playable fields. One state value = at most one player (AC4, single instance).

The candidate play path is wired by **supplying `onPlay` to the YouTube candidate's `VideoThumb`**
on the candidate surfaces (`GeneralStrip` empty branch; `CandidateBits` → `CandidateCard`). The
existing `VideoThumb.activate()` split is unchanged: YouTube + `onPlay` → opens the pinned player;
everything else → `window.open(watchUrl)` (AC8). Wiring is "give the candidate path an `onPlay`."

---

## 4. Coexistence with the blocking `PlayerModal` (Decision 4)

**Two play surfaces this run, by product decision:**

| | Curated clip | YouTube candidate |
|---|---|---|
| Surface | `PlayerModal` (blocking, focus-trapped) — **unchanged** | **PinnedPlayer** (non-modal, persistent) — **new** |
| Opened from | `ClipCard` / curated strip `onPlay` | candidate `VideoThumb` `onPlay` (this run) |

Do **not** redesign curated playback. If — and only if — pointing the curated `onPlay` at the new
PinnedPlayer is trivial with **no regression** to curated playback and no extra design work, Dev may
unify; otherwise leave the modal. **Either way, this inconsistency (curated = modal, candidate =
pinned) is a logged follow-up**, not a defect — the open Product question in `docs/specs/pinned-player.md`
("should the pinned player eventually replace the modal everywhere?"). QA/UX should report which path
shipped. The two surfaces can be open at once *only* transiently (curated modal over the pinned
player); that is acceptable and the modal's focus trap correctly governs while it is up.

---

## 5. Anatomy of the PinnedPlayer

A single dock containing, top to bottom:

1. **A title bar** (the dock chrome): a left **"＋plus" eyebrow + caption** (the metadata, §7) and a
   right **Dismiss** control (§6). Solid `ink` (`#2C2C2C`) bar so white text/glyph clears AA.
2. **The video frame**: the YouTube `<iframe>` (autoplay), or the **no-embed message** (§9, state F),
   on a black backing. Aspect handled per orientation (§6 sizing).

Visual language = Indigo Press hardbox: **2px `ink` border**, a **solid offset shadow**
(`6px 6px 0 #2C2C2C` desktop), white/ink chrome, **no gold**. The dock reads as a deliberate plus-side
object, distinct from both the article and the dashed candidate cards. The frame interior is black
(matching `PlayerModal`).

---

## 6. Position, size, responsive behavior

The candidate set carries **both 16:9 (landscape)** and **9:16 (vertical Shorts)** clips
(`orientation`), so the dock sizes the *frame* by orientation while keeping the *dock's* outer
footprint within the caps below. This mirrors how `PlayerModal` already branches on orientation.

### 6.1 Desktop / wide (`lg` ≥ 1024px) — fixed bottom-**left** corner

- **Position:** `position: fixed`, anchored to the **bottom-left** corner — `bottom: 1rem;
  left: 1rem`. Bottom-left, **not** bottom-right, is deliberate: the sticky **plus rail** (the
  360px right column) and every candidate's **Promote / Not relevant** buttons live on the **right**.
  Docking left keeps the player clear of those controls so they stay visible and clickable while it
  plays (AC3) — no overlap, no layout shift, no safe-area hack needed. The article column is the
  left ~1fr; the dock overlaps the article's lower-left, which is acceptable (the reader is watching,
  not reading that exact corner) and never covers plus controls.
- **Dock width cap:** `min(380px, calc(100vw - 2rem))`. Frame within:
  - **16:9:** frame is the full dock width → ~`380 × 214`.
  - **9:16 vertical:** frame is **height-capped** at `min(60vh, 460px)` and the dock narrows to that
    frame's width (≈ `260px` wide at 460 tall) so a Short doesn't tower full-height. Center the frame.
- The title bar sits above the frame inside the same bordered dock.

### 6.2 Mobile / narrow (< `lg`, the vertical-first default) — bottom sheet bar

The app is vertical-first and collapses to a single column on narrow screens; a corner card would
crowd the content. Instead the player is a **full-width docked bar pinned to the bottom edge**:

- **Position:** `position: fixed; left: 0; right: 0; bottom: 0`. Full viewport width, flush to the
  bottom — a "now playing" bar/sheet. Respect the device safe area: pad the bottom with
  `env(safe-area-inset-bottom)` so the dismiss control isn't under the home indicator.
- **Frame size:**
  - **16:9:** full-width frame, `aspect-video` (≈ `100vw × 56vw`).
  - **9:16 vertical:** **height-capped** at `min(55vh, 420px)`, frame centered within the full-width
    bar (letterboxed left/right on black) so a Short never eats the whole screen and the page above
    stays visible and scrollable.
- The title bar (caption + dismiss) sits at the **top edge of the bar**, so dismiss is reachable
  without overlapping the video and is above the safe area.
- **Does not obscure Promote / Not relevant (AC3):** when the bar is open it reserves space at the
  bottom of the scroll region. Add bottom padding to the page's scroll container equal to the bar's
  height **only while the player is open** (a spacer/`padding-bottom`), so the last candidate's
  Promote/Not-relevant row can always be scrolled clear of the bar. This is the one intentional
  layout shift and it is *additive at the page bottom only* (it never moves content the reader is
  looking at). On desktop no spacer is needed (the dock is in the empty lower-left).

### 6.3 Both breakpoints

- The dock/bar **survives scroll** because it is `fixed` (AC2); scrolling never re-mounts it and the
  iframe is not recreated (playback continues). Swapping (§ state E) changes `src` in place, not the
  element.
- Pointer events pass through *around* the dock (it occupies only its own box); the rest of the page —
  article, rail, candidate controls — stays fully interactive (AC3). The dock is **not** a full-screen
  overlay and has **no backdrop**.

---

## 7. Metadata shown alongside (minimal; reuse existing patterns)

Keep it to what credits the creator and identifies the clip — mirror the strip/card footer, not the
full candidate card (no match reason, no Promote/Dismiss inside the dock; those stay on the card):

- **Caption** — one line, `line-clamp-1`, bold. (`clip.caption`.)
- **Creator credit (CC BY-SA)** — `handle · platformLabel` on a second line, muted. This is the
  attribution the architecture requires on every clip surface; it reuses the exact pattern already in
  `GeneralStrip`/`CandidateCard` footers (`{creator.handle} · {platformLabel}`).
- The iframe's `title` attribute = the caption (accessible name for the embed), exactly as
  `PlayerModal` does today (`title={clip.caption}`).

No avatar, no follower count, no link-out inside the dock (the card already links the creator). Keep
the chrome small so the video dominates.

---

## 8. Accessibility model (AC9–AC13) — the non-modal contract

This is the heart of the spec: a **non-modal** persistent region that behaves nothing like the
focus-trapping `ModalShell`.

- **AC9 — Labeled, non-modal region.** The dock's root is a **`<section>` (or `<aside>`)** with
  `aria-label="Video preview"` (a labeled, discoverable landmark). It is **not** `role="dialog"`,
  carries **no** `aria-modal`, and uses **no** focus trap and **no** backdrop — the opposite of
  `ModalShell`. (Do **not** route it through `ModalShell`.) A screen reader can locate "Video preview"
  among the page's landmarks and knows what it is. AC3's still-interactive page corroborates non-modality.
- **AC10 — Does not steal focus on open.** Opening the player from a candidate's play button does
  **not** move focus. Concretely: the dock mounts with **no autofocus**, runs **no** `.focus()` on
  open, and is appended at the end of the DOM so it does not displace the reader's place. After the
  click, `document.activeElement` remains the candidate's `VideoThumb` button (or wherever the reader
  was). Contrast with `ModalShell`, which focuses the first focusable on mount — the PinnedPlayer must
  *not* do that.
- **AC11 — Keyboard-operable dismiss, visible focus, sensible return.** The Dismiss control is a real
  `<button>`, in the normal tab order, reachable by Tab and operable by Enter/Space. It shows the
  project's standard visible focus ring (`:focus-visible { outline: 3px solid var(--color-brand);
  outline-offset: 2px }` — already global). On dismiss, **focus is not dropped to `<body>`**: if focus
  was inside the dock (i.e., the user tabbed to and activated Dismiss), move it to a sensible anchor —
  reuse the existing "send focus to the General band heading" pattern already used by `dismiss()` in
  `TopicView` (set `tabindex=-1` on `#general-band h2`, focus it). If focus was *not* inside the dock
  (e.g., dismissed via a different path), leave focus where it is. Never trap Tab inside the dock — Tab
  continues into and out of it like any other region.
- **AC12 — Respects reduced-motion.** Any dock-in motion (a slide/fade-up as it appears) is **gated by
  the existing `prefersReduced` signal** that `TopicView` already reads and threads down (e.g. to
  `GeneralStrip`). When reduced motion is requested, the dock appears with **no transition** (it is
  simply present). Implement as a motion-gated class (`prefersReduced ? "" : " <motion-class>"`),
  matching the skeleton-shimmer precedent in `GeneralStrip`, and/or wrap the transition in
  `@media (prefers-reduced-motion: no-preference)`. Default (no preference): a short, subtle
  appear (≤200ms ease-out, opacity + small translate); this is non-essential and fully suppressed
  under reduce.
- **AC13 — AA contrast, never color-alone.** Chrome uses Indigo Press tokens with verified AA:
  - Title bar: **white text on `ink #2C2C2C`** (≈ 15:1 — passes AAA, well clear of AA).
  - Dismiss control: white "✕" glyph **plus the text label "Close"** (not the glyph alone) on the ink
    bar; the control is never signaled by color alone — it always carries the word. On hover it may
    underline / lighten, but the affordance is the label, not a color change.
  - No-embed message: white text on black (state F) — high contrast.
  - Border: 2px `ink` against the page background (`#F7F7F7`) and against black — both clear AA for a
    non-text UI boundary (and the boundary is reinforced by the offset shadow, not color alone).
  - The dock relies on **shape + label + border**, never hue, to be perceivable. (Precedent for the
    contrast discipline: `lib/curation/labels.ts` chip-contrast test.)

**z-index.** The dock sits above page content but **below** the app's modals (`ModalShell` is
`z-50`). Use e.g. `z-40` for the dock so that if a curated `PlayerModal`, `CurateModal`, or `AddModal`
opens, it correctly covers the dock and its focus trap governs. The dock never covers a modal.

---

## 9. Every state (with microcopy)

Microcopy is fixed here; Dev should ship these strings verbatim. All labels are sentence/word case to
match existing controls.

### State A — Idle / no player
- **Trigger:** initial load; nothing activated; or after dismiss.
- **Render:** the dock is **not in the DOM** (player state is `null`). No iframe exists on page render
  (preserves the embed-never-host lifecycle — nothing loads until an explicit play click).

### State B — Loading (iframe mounting)
- **Trigger:** a YouTube candidate with `embedUrl` was just activated; the dock mounts and the iframe
  begins loading.
- **Render:** dock present with title bar (caption + Close); frame area is **black** while the YouTube
  iframe loads its own UI. We do **not** add a custom spinner over the iframe (the embed shows its own
  load state, as `PlayerModal` relies on today) — but the title bar caption is shown immediately so the
  reader knows what is loading. No skeleton needed; this state is momentary and visually identical to
  Playing minus the started video.

### State C — Playing
- **Trigger:** iframe loaded; video autoplays (autoplay set because the user explicitly clicked, per
  the existing facade).
- **Render:** dock with title bar + the live iframe at the orientation-correct size (§6). Page stays
  fully interactive around it (AC3). Persists across scroll (AC2).
- **iframe attributes** (reuse `PlayerModal` verbatim): `src = embedUrl + (… "&"/"?" …) + "autoplay=1"`,
  `title = caption`, `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope;
  picture-in-picture"`, `allowFullScreen`, `className="h-full w-full"`.

### State D — (covered by C; single instance) 
- There is never more than one dock or one iframe (AC4). A second activation does not stack — see E.

### State E — Swap (A → B candidate)
- **Trigger:** a video is playing and the reader activates a *different* YouTube candidate.
- **Render:** the **same** dock stays mounted; its `src` (and caption/credit/orientation) **change in
  place** to candidate B's (with autoplay). No second dock, no new tab, no teardown/re-mount of the
  dock element (AC5). If B's orientation differs from A's, the frame resizes per §6 within the same
  dock. (Implementation note for Dev: keep the dock element stable across swaps — change the playable
  payload in state, keyed so React updates `src` rather than remounting, or set the iframe `src`
  directly — either way the dock container is not torn down.)
- *No "play next" automation* — swap is only on explicit click.

### State F — No-embed graceful path (AC7) — **CHOSEN BRANCH: new-tab fallback**
- **Trigger:** a **YouTube** candidate with **no `embedUrl`** is activated.
- **Decision (UX picks Decision-3 option a):** the play affordance **falls back to opening `watchUrl`
  in a new tab** — it does **not** open the pinned player at all. **No dock, no empty iframe, no
  message surface.**
- **Why this branch over (b) the inline "can't be embedded" message:** A YouTube candidate with no
  embed URL is, for the reader, the same situation as a non-YouTube candidate — there is nothing we
  can play in-app, so the honest, consistent behavior is the *exact same* graceful exit we already use
  for TikTok/Instagram (`window.open(watchUrl)`), which `VideoThumb.activate()` does today. Opening an
  empty dock just to display "can't be embedded" would (1) introduce a dead-end surface the reader
  must then dismiss, (2) make the player's presence/absence ambiguous (is something playing?), and
  (3) duplicate the modal's degraded message in a *non-modal* context where it reads as an error
  rather than an action. The new-tab fallback keeps the player's contract clean: **the dock only ever
  exists when a real video is playing.** Net rule: *no embeddable URL → new tab, same as non-YouTube.*
- **Microcopy / affordance:** because this candidate now behaves exactly like a link-out, its
  `VideoThumb` should show the existing **"opens ↗"** corner tag (the thumb already shows this for any
  non-`isYouTube` thumb; a YouTube thumb *without* a thumbnail/embed naturally falls into that path).
  No new string.
- **Implementation seam:** in the candidate `onPlay` handler (or `VideoThumb`'s YouTube branch), only
  open the pinned player when `embedUrl` is present; if a YouTube candidate has no `embedUrl`, fall
  through to `window.open(watchUrl, "_blank", "noopener")`. Result: **no `src`-less iframe is ever
  rendered, nothing throws** (satisfies AC7's assertion). QA asserts: window.open called with the
  watch URL; no player iframe appears.

### State G — Non-YouTube candidate (AC8)
- **Trigger:** a TikTok / Instagram / other candidate is activated.
- **Render:** unchanged — `window.open(watchUrl, "_blank", "noopener")`; no dock. The thumb keeps its
  "opens ↗" tag. (We supply `onPlay` only on the YouTube path; the split already lives in
  `VideoThumb.activate()`.)

### State H — Dismissed (AC6)
- **Trigger:** the reader activates the Close control (mouse or keyboard).
- **Render:** the dock **and its iframe are removed from the DOM** (player state → `null`); playback
  stops; no hidden iframe keeps running. Focus handled per AC11 (§8). On mobile, the bottom spacer
  (§6.2) is removed so the page reflows back to full height.

> **State table for QA:**
>
> | State | Dock in DOM? | iframe? | `window.open`? |
> |---|---|---|---|
> | A Idle | no | no | — |
> | B Loading | yes | yes (loading) | no |
> | C Playing | yes | yes | no |
> | E Swap | yes (same one) | yes (`src` changed) | no |
> | F No-embed (YT, no embedUrl) | **no** | **no** | **yes** (watchUrl) |
> | G Non-YouTube | no | no | yes (watchUrl) |
> | H Dismissed | no | no | — |

---

## 10. Microcopy summary (ship verbatim)

| Element | String |
|---|---|
| Region accessible name | `Video preview` |
| Dismiss control label | `✕ Close` (glyph **and** word; word is the affordance, AC13) |
| Dismiss control `aria-label` | `Close video preview` |
| iframe `title` | the candidate's `caption` |
| Caption line | the candidate's `caption` (`line-clamp-1`) |
| Creator credit | `{creator.handle} · {platformLabel}` |
| No-embed path | *(none — falls back to new tab; thumb shows existing "opens ↗")* |

---

## 11. Component breakdown for Dev (orientation only — Dev owns implementation)

- **New:** `components/topic/PinnedPlayer.tsx` — a non-modal `<section aria-label="Video preview">`,
  fixed-positioned, responsive per §6, rendering the title bar (caption + credit + Close) and the
  iframe (reusing `PlayerModal`'s src/attrs). Props ≈ `{ clip: PlayerClip & { caption; creator?:
  {handle; platformLabel} }, onClose, prefersReduced }`. **Does not** use `ModalShell`. Mounts on
  play / unmounts on dismiss (lifecycle = iframe created on play, torn down on close).
- **`TopicView.tsx`:** widen the player state from `Clip | null` to accept the candidate's playable
  fields (`embedUrl`, `caption`, `orientation`, and `creator.handle`/`platformLabel` for the credit) —
  `Candidate extends VideoBase`, so no data-model change. Render `<PinnedPlayer …>` for the candidate
  path (the curated `PlayerModal` stays as-is unless trivially unified, §4). Pass the existing
  `prefersReduced.current` down (AC12).
- **Candidate surfaces:** pass `onPlay` to the YouTube candidate's `VideoThumb` in the `GeneralStrip`
  empty branch and in `CandidateBits`/`CandidateCard`, opening the pinned player **only when
  `embedUrl` is present** (else the existing new-tab fall-through handles it, state F/G).

## 12. Acceptance-criteria → design map

| AC | Satisfied by |
|---|---|
| AC1 in-app, no new tab | §3 wiring + §9 C; YouTube+embedUrl → dock, not `window.open` |
| AC2 fixed, survives scroll | §6.3; `position: fixed`, no re-mount |
| AC3 page stays interactive | §6.1/§6.2 (dock clears plus rail & Promote/Dismiss), §8 non-modal, no backdrop |
| AC4 single instance | §3 single state value; §9 D/E one dock, one iframe |
| AC5 swap src | §9 E swap-in-place |
| AC6 dismiss tears down | §6/§9 H + §6.1 Close control |
| AC7 no-embed graceful | §9 F — **new-tab fallback**, no `src`-less iframe |
| AC8 non-YouTube new tab | §9 G; `VideoThumb.activate()` split unchanged |
| AC9 labeled non-modal | §8 — `<section aria-label="Video preview">`, no dialog/aria-modal/trap |
| AC10 no focus steal | §8 — no autofocus/`.focus()` on open |
| AC11 keyboard dismiss | §8 — real `<button>`, tab order, global focus ring, sensible focus return |
| AC12 reduced-motion | §8 — motion gated by `prefersReduced` |
| AC13 AA, not color-alone | §8 §10 — white-on-ink, "✕ Close" word + glyph, border+shadow |

---

## 13. Hand-off

- **To Development:** build `PinnedPlayer` per §5–§11; wire YouTube candidates' `onPlay` (open dock
  only when `embedUrl` present); keep curated on `PlayerModal` unless trivially unified (report which);
  reuse `prefersReduced`; introduce no server/oEmbed/secret. Ship the §10 microcopy verbatim and the
  state behaviors in §9 (esp. the chosen no-embed new-tab branch, state F).
- **To QA & Review + UX evaluation:** verify against the §9 state table and §12 map; confirm the dock
  clears the plus rail / Promote-Dismiss controls at both breakpoints (AC3) and the no-embed path opens
  a tab with no `src`-less iframe (AC7).
