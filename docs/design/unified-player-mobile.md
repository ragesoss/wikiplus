# Design spec — Unified mobile video player

**Issue:** [#120](https://github.com/ragesoss/wikiplus/issues/120) · **Role:** UX / Design ·
**Status:** design spec (written *before* Dev) · **Builds from:** issue #120 "✅ Scope locked
(owner discussion, 2026-06-21)" (Decisions 1–4 + non-negotiables) · **Feeds:** Development (build),
QA & Review + UX (evaluation).
**Strongest prior art:** `docs/design/pinned-player.md` (the existing non-modal candidate dock — §8
non-modal a11y contract carried through here). **Companion identity:** `docs/VISUAL_IDENTITY.md`
(Indigo Press), `docs/CURATION_STANDARD.md` §5.2/§5.4 (creator credit + "context by").

This is the buildable contract for **`MobilePlayerDock`** — **one** non-modal, movable, viewport-fit
player used on **mobile** (`< lg`) for **any** video, curated or candidate. It generalizes the
candidate `PinnedPlayer` into a single component whose supplemental info and action buttons
parameterize by `(kind: curated | candidate) × (signedIn: true | false)`. Everything else — frame,
credit, Close, the park toggle, the maximize-on-rotate behavior, the non-modal contract — is shared
and identical for every clip.

> **What this is NOT.** Not a desktop change (desktop curated stays the blocking `PlayerModal`;
> desktop candidate stays the bottom-left dock — see §4). Not a change to the embed facade
> (`lib/embed/facade.ts` is untouched). Not a change to the curation-block *content* (chips / note /
> "context by" strings ride along unchanged from `PlayerModal`). Not drag-to-move (§7). Not the
> native Fullscreen API (§6). Not PiP / play-next / autoplay-on-scroll.

---

## 1. Personas served

Reused from `docs/design/pinned-player.md` §1 (the personas are the same readers; the surface is now
unified and mobile-first):

- **Priya — the deciding reader (primary).** On a phone, anonymous, landed on a Topic page via a
  wikilink. She taps a video — curated *or* suggested — and wants to watch it **against the article
  on the small screen**: compare the clip to the text, in whichever way she's holding the phone,
  without being kicked into a desktop-style modal that swallows the screen or into YouTube's feed.
- **Cory — the keyboard / AT reader (on mobile + external keyboard, or a screen reader).** Must
  open the player, reach Close and the park toggle, operate them, and keep reading — none of which
  may steal or trap his focus. Signals must be in words, not color or position.
- **Mona — the curator-in-the-making.** Once a clip convinces her she reaches for the action that
  fits the clip: on a **candidate**, the per-card Promote / Not relevant (signed in) or the in-dock
  **Curate this video** (logged out); on a **curated** clip, the join nudge (logged out) or nothing
  (signed in). Those controls must stay operable while the dock plays — the dock must never sit on
  top of them, and on mobile that means it parks out of the way and the page reflows around it.

## 2. User stories (feed Product's AC; mapped in §13)

- **S1.** *As Priya on a phone, I want to tap any video — curated or suggested — and watch it right
  here, in a frame that fits my screen, so I can judge it against the article without a modal
  swallowing the page or a trip to YouTube.* → AC-fit, AC-unify
- **S2.** *As Priya, I want the player to stay put while I scroll and read, and to let me move it to
  the top or bottom so it never covers the part of the article (or the controls) I'm looking at.* →
  AC-keepreading, AC-toggle
- **S3.** *As Priya, when I turn my phone landscape, I want a horizontal clip to fill the screen and
  a vertical clip to use the full height upright — the biggest sensible frame for how I'm holding
  it — and to get back to reading by turning it back or tapping out.* → AC-rotate
- **S4.** *As Priya watching a suggestion, I want a second tap on another suggestion to swap what's
  playing in the same dock (one player, not a pile), so I can rip through several.* → AC-swap
- **S5.** *As Priya, I want a clear, always-reachable way to close the player and stop the video.* →
  AC-fit, AC-close
- **S6.** *As Priya watching a curated clip, I want the creator credited and a one-tap way to read
  the full context note without the note crowding the article off the screen.* → AC-curation
- **S7.** *As Priya logged out, after I've watched I want the right invitation in the right place —
  "Curate this video" on a suggestion, a softer join nudge on a curated clip — and never to be
  nagged when I'm signed in.* → AC-cta
- **S8.** *As Cory, I want the dock announced and named, never to have my focus yanked into or
  trapped by it, to operate Close and the move toggle from the keyboard with a visible ring, and to
  land somewhere sensible when I close it.* → AC-a11y
- **S9.** *As Cory (reduced motion), I don't want the dock to slide or the maximize to animate at
  me.* → AC-a11y
- **S10.** *As any reader, I want the chrome legible (AA) and every signal carried by a word, never
  by color or position alone.* → AC-a11y

---

## 3. Information architecture & where it lives

`MobilePlayerDock` is a **Topic-page-level surface**, a sibling of the existing players at the end of
`TopicView`'s render (alongside `{player && <PlayerModal …>}` and `{pinned && <PinnedPlayer …>}`). It
floats in a `position: fixed` layer above page content, **below** the app modals' z-index (a modal,
when one opens, covers it — see §9 z-index). It is **not** inside the rail, the General strip, a
section, or the article column.

**One dock at a time, one iframe at a time.** Curated and candidate playback on mobile both route
into this single surface, so they share the single-instance guarantee: opening a second video
(curated or candidate) **swaps in place**; there is never a curated dock *and* a candidate dock open
at once on mobile. This is the unification's payoff — the reader never sees two playback surfaces
fighting on a small screen.

**Routing (mobile only — this PR).** The decision of *which* surface a play click opens is made by
viewport, kept as a routing concern so the later desktop flip (the fast-follow that absorbs #70) is a
routing change, not a redesign:

- **Curated clip, mobile (`< lg`):** opens `MobilePlayerDock` with `kind="curated"` (instead of the
  blocking `PlayerModal`).
- **Curated clip, desktop (`≥ lg`):** unchanged — the blocking `PlayerModal`.
- **YouTube candidate w/ `embedUrl`, mobile:** opens `MobilePlayerDock` with `kind="candidate"`
  (instead of today's mobile `PinnedPlayer` bottom bar — `PinnedPlayer` is the desktop dock).
- **YouTube candidate w/ `embedUrl`, desktop:** unchanged — the bottom-left `PinnedPlayer` dock.
- **YouTube candidate w/o `embedUrl`, or any non-YouTube candidate, any viewport:** unchanged —
  `window.open(watchUrl)` via `VideoThumb.activate()` (no dock; see §8 state "no-embed").

> **Assumption A1 (record for Dev/Product).** The viewport split is read at **play time** (e.g. a
> `matchMedia("(min-width: 1024px)")` check, or an `isMobile` signal threaded from `TopicView`), not
> baked into SSR — playback is a client interaction. If the viewport crosses the `lg` boundary
> **while a dock is open** (a desktop window resized narrow, or a tablet rotated across 1024px), the
> open player **stays in whatever surface it opened in** for that session (no live re-host mid-play —
> re-hosting would tear down the iframe and stop playback). Only the *next* play click re-evaluates.
> This is the simplest correct behavior and matches how readers actually use a phone (orientation
> changes, not breakpoint crossings). Dev: if a cleaner re-host is trivial, fine, but it must never
> stop playback. QA: only the `< lg` mobile widths (360–430, plus 390/834 catalog widths) are
> in-scope for this PR.

The play wiring is unchanged in shape: `VideoThumb.activate()` keeps its `platform === "youtube" &&
onPlay → onPlay()` else `window.open(watchUrl)` split. `TopicView` supplies the `onPlay` handlers;
this PR points the **mobile branch** of both the curated and candidate `onPlay` at the new dock state
(§12).

---

## 4. Coexistence with the desktop players (Decision 2)

| | Curated clip | YouTube candidate (w/ embedUrl) |
|---|---|---|
| **Mobile `< lg`** (this PR) | **`MobilePlayerDock` `kind="curated"`** — NEW | **`MobilePlayerDock` `kind="candidate"`** — NEW |
| **Desktop `≥ lg`** (untouched) | `PlayerModal` (blocking, focus-trapped) | `PinnedPlayer` (bottom-left dock) |

Do **not** redesign the desktop surfaces this PR. The mobile dock is the only new surface. The
recorded follow-up "unify desktop onto the same component + absorb #70" is **out of scope here** and
will be its own issue; build `MobilePlayerDock` so that flip is a routing change (it already accepts
`kind` + `signedIn` and renders the full curation block, so the desktop curated case needs only
desktop sizing branches added later — §6.5).

`MobilePlayerDock` is **not** routed through `ModalShell` (the non-modal contract, §9). The transient
two-surfaces case from `pinned-player.md` §4 (a modal opening over a dock) cannot occur on mobile
this PR, because mobile curated playback no longer uses a modal — the only modals a mobile reader
opens over the dock are `CurateModal` / `AddModal` (reached from a CTA), and those correctly cover
the dock via z-index (§9) and govern with their own focus trap while up.

---

## 5. Anatomy — the unified component, parameterized

A single non-modal `<section aria-label="Video player">` (a labeled landmark; see §9 AC-a11y for the
exact accessible name and why it is not a dialog). It is a full-width bar pinned to the **top or
bottom edge** of the viewport (which edge = the park toggle's state, §7). Top to bottom, the dock
renders these regions; the **shared** regions are identical for every clip, and the **parameterized**
regions differ only by `kind` and `signedIn`:

```
┌──────────────────────────────────────────────────────────┐  ← dock root: <section aria-label="Video player">
│ TITLE BAR (shared)                                         │     ink #2C2C2C, white text/glyphs (AA)
│   ＋plus eyebrow                                           │
│   caption (line-clamp-1, bold)                  [⤓ Move]   │   ← park toggle (shared, §7)
│   creator credit  handle · platformLabel        [✕ Close]  │   ← Close (shared) + CC BY-SA credit (shared)
├──────────────────────────────────────────────────────────┤
│ SUPPLEMENTAL ROW (parameterized — §5.2)                    │     curated: collapsed curation block (chips +
│   curated → chips + "Context ▸" expander                   │       "Context ▸"); candidate → match reason;
│   candidate → match reason (one line)                      │       logged-out adds the matching CTA below it
│   (logged-out) → CTA: "✦ Curate this video" / join nudge   │
├──────────────────────────────────────────────────────────┤
│ VIDEO FRAME (shared)                                       │     black backing; iframe (autoplay) or, for a
│   <iframe …> at the orientation-correct size (§6)          │       curated clip with no embedUrl, the
│                                                            │       "can't be embedded" message (§8)
└──────────────────────────────────────────────────────────┘
```

**Reading / DOM order is fixed: title bar → supplemental row → frame.** Putting the metadata and the
action *above* the frame (not overlaid on the video) means the CTA and the curation affordance never
cover the picture, and the credit + Close are reachable without fighting the video — and it keeps the
tab order natural (Close/Move first, then the CTA, then nothing focusable in the frame except the
embed itself).

### 5.1 Shared regions (identical for every clip)

1. **Title bar** (ink `#2C2C2C` bar, white text — ≈15:1, clears AAA): the **`＋plus` eyebrow**, the
   **caption** (`line-clamp-1`, bold), and the **creator credit** `handle · platformLabel` (muted
   white, `truncate`). On the right, stacked or inline as space allows: the **park toggle** (§7) and
   the **Close** control. Both are real `<button>`s in normal tab order (§9).
   - **CC BY-SA creator credit is in the shared title bar and therefore present in EVERY state,
     including the collapsed curated state and both maximized states** (§6). This satisfies the
     non-negotiable that creator attribution rides every clip surface (CURATION §5.2). The credit
     uses the `handle · platformLabel` pattern verbatim from the existing dock; it does **not** need
     the avatar or the link-out (those live on the originating card / the curated curation block).
2. **Park toggle** — labeled button, "Move to top" / "Move to bottom" (§7). Shared.
3. **Close** — `✕ Close` (glyph **and** word), `aria-label="Close video player"`. Shared. Tearing it
   down removes the dock + iframe (§8 state "dismissed").
4. **Video frame** — black backing; the iframe (`title = caption`, `allowFullScreen`, the facade's
   `allow` list verbatim), sized by orientation (§6). The iframe `src`/attrs are reused **verbatim**
   from `PlayerModal` / `PinnedPlayer` — `embedUrl + autoplay=1`. The facade is unchanged.

Visual language = Indigo Press hardbox: **2px `ink` border**, white-on-ink chrome, **no gold**, the
frame interior black (matching both existing players). On mobile the dock is full-width and flush to
its edge, so the offset shadow is omitted (it would clip at the viewport edge); the 2px ink border +
the safe-area inset carry the boundary.

### 5.2 Parameterized region — the supplemental row

This is the only region that differs. It sits between the title bar and the frame.

| | **Candidate** (`kind="candidate"`) | **Curated** (`kind="curated"`) |
|---|---|---|
| **Supplemental content** | **Match reason**, one line (`line-clamp-2`), muted white on the ink bar. (`candidate.matchReason`.) | **Collapsed curation block**: stance + accuracy **chips** + a **"Context ▸" expander** button. Expanded (§5.3): the full note + "context by". |
| **Signed-in action** | none in the dock — Promote / Not relevant stay on the candidate card (`pinned-player.md` §7). | none in the dock — the curated clip's manage rows stay on the rail card. |
| **Logged-out action** | **"✦ Curate this video"** — solid `brand` fill, white bold, 2px ink border, 44px min target. Routes the playing candidate into the curate flow via the `curate` login gate. | **"Log in to curate videos for this topic"** — softer join nudge: white fill, 2px ink border, bold ink text, 44px min target. Routes through the same `curate` login gate. |

Both CTAs are real, tabbable `<button>`s in the non-modal section; **present but never autofocused**
(§9). The word carries the meaning (never color-alone). No gold on either. These reuse the exact
treatments and routing the two existing players already ship (`PinnedPlayer` §6 / `PlayerModal` #71
§7), lifted into the one component.

> **Decision (tension 1 — curation-block compaction). Resolved: chips-always-visible + a
> "Context ▸" tap-to-expand; the full note is one tap away and never crowds the article.** The
> rationale + exact collapsed/expanded layouts are §5.3. The CC BY-SA **creator credit is in the
> shared title bar**, so it is visible **in the collapsed state** as required — the curation block's
> *own* credit/avatar (the `PlayerCreatorCredit` from `PlayerModal`) is **not** duplicated into the
> dock; the title-bar credit is the canonical mobile credit, keeping the dock compact.

### 5.3 Curated curation block — collapsed vs. expanded (tension 1, in full)

The full `PlayerModal` curation block (creator credit → held marking → chips → full note → "context
by" → logged-out join nudge) is too tall for a movable dock that must leave the article readable. So
on mobile the dock shows a **compact** form by default and expands the heavy text on demand:

**Collapsed (default).** In the supplemental row, below the title bar:
- The **held marking** *if and only if* `clip.held` — a one-line "In review · not yet vouched"
  pill (the existing `HeldMarking`, compacted to a single inline line on the ink bar). It is a
  property of the clip, shown for every viewer; it must not be hidden by collapse (it is a trust
  signal, not detail). It sits **above** the chips.
- The **stance + accuracy chips** (`StanceChip` + `AccuracyChip`, verbatim — their own dark fills
  carry AA on the ink bar). Always visible collapsed.
- A **"Context ▸" expander** — a real `<button>`, `aria-expanded={false}`, controlling the note
  panel by `aria-controls`. Label `Context` + a `▸` glyph that rotates to `▾` when open (shape +
  label, never color-alone). The word "Context" is the affordance.

The credit (title bar) + chips + held marking are the trust signals a reader needs to *weigh* the
clip at a glance; the full prose note is the thing that's one tap away.

**Expanded.** Activating "Context ▸" reveals, in place (pushing the frame down, not overlaying it):
- The **full context note** (the `PlayerModal` "Curator note" block verbatim: the `Curator note`
  eyebrow + the untruncated `clip.contextNote`), on a **light surface** (white card, 2px ink border,
  `text-ink2`) so the prose reads in the Indigo-Press light register — never white-on-black body
  text. (This is the one light surface inside the otherwise-ink dock; it visually matches the
  modal's curation block.)
- The **"context by `<curator>`"** attribution (`ContextByLink`, `surface="light"`), the closing
  element — the CURATION §5.4 "context by" attribution, which must remain present (it is present in
  the expanded state; the collapsed state still carries the *creator* credit in the title bar, so no
  attribution rule is violated when collapsed — the creator credit is the CC BY-SA attribution; the
  "context by" is the curator attribution and is one tap away).
- The note panel is **omitted defensively when the note is empty** (the existing empty-note guard) —
  then the expander does not render at all (nothing to expand to); chips + held still show.

**How expansion coexists with "keep reading" (the heart of tension 1).** The dock has a **height
budget** so that even expanded it cannot eat the screen:
- The dock's **chrome + supplemental row + frame together are capped** at the dock's `max-height`
  (§6 sizing). When expanded, the **note panel itself scrolls inside the supplemental row** (an
  `overflow-y: auto` region with a sensible `max-height`, e.g. `min(40vh, …)`), rather than growing
  the dock past its cap. The **frame stays its orientation size**; the **note is what scrolls**. So
  even a long note never pushes Close/Move/credit off-screen and never grows the dock to cover the
  article.
- Expanding does **not** collapse the article or stop playback — the video keeps playing in the
  frame above (top-parked) or below (bottom-parked) the expanded note.
- Re-activating "Context ▾" collapses it back; focus stays on the expander button. The expander
  state is **per-open** (a fresh dock opens collapsed); a swap (§8) resets to collapsed.

> **Assumption A2 (record).** Candidates have only a one-line match reason, so the candidate
> supplemental row is **never** expandable — the "Context ▸" affordance is curated-only. This matches
> CURATION §6 (a candidate has no note/chips). No expander renders for `kind="candidate"`.

---

## 6. Sizing, viewport-fit, and maximize-on-rotate (Decisions 3; tension 2)

The dock is **full-width** and pinned to one edge (top or bottom, §7). It sizes the **frame** by
orientation while keeping the **whole dock** within the viewport in every case. Two layout modes:
**docked** (the default — leaves the article visible/scrollable) and **maximized** (rotate-to-fill,
§6.3/§6.4). The maximize layer *is the same dock* growing to fill the viewport — not a separate
element (§6.6).

### 6.1 The named widths and the fit guarantee (tension 2)

In-scope widths: **360, 390, 414, 430** px (the common phone range; 390 + 834 are the catalog's
mobile/tablet capture widths). The **fit guarantee**: at every one of these widths, in **both**
orientations, for **both** 16:9 and 9:16 clips, the dock **never overflows the viewport** and
Close + Move are always reachable. The sizing math below makes that a property of the layout, not a
hope.

Let `VH` = the visual-viewport height, `VW` = width, and reserve the **safe-area insets**
(`env(safe-area-inset-top/bottom/left/right)`) so chrome never hides under a notch / home indicator.

### 6.2 Docked mode (portrait, the default reading posture)

The dock is a column: **title bar + supplemental row** (the "chrome", height `C`) above (bottom-park)
or below (top-park) the **frame** (height `F`). The whole dock height `C + F` must leave the article
visible, so the **dock is capped** and the frame is sized within that cap:

- **Chrome `C`** is content-height (≈ 2–3 lines + chips/CTA), typically ~96–150px; it is never
  capped away — Close/Move live here and must always show. The note panel, when expanded, scrolls
  inside `C` (§5.3) so `C`'s contribution to the dock height stays bounded.
- **Frame `F`:**
  - **16:9 (horizontal):** `F = VW × 9/16` (full-width `aspect-video`). At 360–430px that's
    ~203–242px — comfortably leaving the article visible above/below.
  - **9:16 (vertical):** **height-capped** so a Short can't tower: `F = min(55vh, 420px)`, the frame
    `aspect-ratio: 9/16`, **centered** (`mx-auto`) and **letterboxed** on black within the
    full-width bar. At a 720px-tall phone, `55vh ≈ 396px` → frame width ≈ 223px, centered.
- **Total dock cap:** the dock's `max-height` = `min(VH − safe-insets, C + F)`. Because `F` for a
  vertical is already capped at `55vh` and `F` for a horizontal is `~0.56·VW` (well under `VH`), and
  `C` is bounded (the note scrolls), `C + F` is always `< VH − insets` at every named width — so the
  dock fits with the article still showing. If a pathologically short viewport ever made `C + F`
  exceed the cap, the **dock body scrolls internally** (the chrome stays pinned, the frame +
  expanded note are the scroll region) so **Close + Move are never pushed off** — the same
  scroll-not-clip discipline `PlayerModal` already uses (`max-h-[90vh] overflow-y-auto`).

### 6.3 Maximized — landscape, horizontal (16:9) clip → fill width

On `orientationchange` to **landscape**, a **16:9** clip **maximizes**: the dock grows to fill the
viewport, the frame becomes the full landscape rectangle (`aspect-video` at `VW × VH`, effectively
the whole screen minus safe insets), and the chrome **condenses to a minimal overlay bar** so the
video is the screen:
- The frame fills `100vw × 100vh` (minus safe insets), `object-fit` letterbox if the aspect doesn't
  match exactly.
- The chrome collapses to a **single thin top bar** with just **Close** (and the credit as a small
  caption) — the park toggle is **hidden in maximized mode** (parking is meaningless when the player
  *is* the screen; §7.4). The supplemental row (chips/CTA/note) is **hidden** in maximized mode (the
  reader is watching, not reading) — it returns when the dock un-maximizes.
- The Close control stays reachable (top-right, respecting `safe-area-inset-top/right`).

### 6.4 Maximized — landscape OR portrait, vertical (9:16) clip → fill height upright

A **vertical (9:16)** clip uses the **full portrait height upright** when maximized — it does **not**
rotate with the device. The trigger is the same `orientationchange`/landscape signal, but the result
honors the clip's native shape:
- The frame fills the **full available height** (`100vh` minus insets), `aspect-ratio: 9/16`,
  centered, letterboxed left/right on black. This is the biggest sensible upright frame for a Short.
- Same condensed chrome as §6.3 (thin Close bar; supplemental row + park toggle hidden).
- A vertical clip held in **portrait** is already at `min(55vh,420px)` docked; the reader can also
  reach this full-height maximized view (see §6.5 trigger) — turning the phone is not the only path
  for a Short, since a Short's "biggest frame" is portrait-tall regardless of device orientation.

### 6.5 What triggers maximize, and how the reader gets out

- **Enter maximize:** the primary trigger is **`orientationchange` to landscape** (Decision 3 — "turn
  the phone and the clip maximizes"). Implemented by listening to the visual-viewport / a
  `matchMedia("(orientation: landscape)")` change *while a dock is open*, and toggling the dock's
  `maximized` layout state. **Additionally**, the dock SHOULD offer an explicit **"Maximize" /
  "Exit" toggle button** in the chrome (a `⤢ Maximize` / `⤢ Exit` labeled button) so the behavior is
  reachable **without** a rotation gesture — essential for AT users, for anyone with rotation lock
  on, and for a vertical Short whose best frame is portrait-tall (it has no landscape trigger). The
  word "Maximize"/"Exit" carries the meaning; never color-alone.
- **Exit maximize:** rotating **back to portrait** un-maximizes (returns to docked mode); **or** the
  explicit "⤢ Exit" button; **or** **Close** (✕) which tears the whole dock down. Esc is **not**
  bound (this is non-modal — Esc belongs to dialogs; binding it would imply modality). After exiting
  maximize, focus returns to the control the reader used (the "Exit" button if they pressed it; §9).
- **Why CSS maximize, not the native Fullscreen API (record in TOPIC_PAGE_DESIGN per Decision 3).**
  We embed third-party iframes (`youtube-nocookie`, etc.) and control only the *container*, not the
  inner `<video>`. (1) **iPhone Safari** has **no** Fullscreen API for an arbitrary element/iframe —
  `requestFullscreen()` simply isn't there for our container, so a native path can't work on the
  device most readers use. (2) Programmatic native fullscreen requires a **user gesture**; an
  `orientationchange` event is **not** a qualifying gesture, so even Android Chrome would *reject*
  `iframe.requestFullscreen()` fired from a rotate handler. Therefore "rotate maximizes the clip" is
  implemented as **our own container filling the viewport via CSS** — fully controlled, identical
  cross-platform, and testable in Playwright. The embed's **own** native-fullscreen button is left
  intact (`allowFullScreen` stays) for any reader who taps it inside the iframe — that path uses the
  platform's own player chrome and is the platform's responsibility, not ours.

### 6.6 How the maximize layer relates to the dock and the page

- The **maximized view is the same `<section>`** — the same DOM node, the same iframe (so playback is
  **never** interrupted by maximize/exit; no remount, no reload). Only its layout class flips
  (`fixed inset-0` filling the viewport vs. the edge-pinned docked bar). Keeping it the same element
  is what makes rotate→maximize→rotate-back seamless and keeps the embed-by-reference lifecycle
  intact.
- **Docked mode does not block the page** (no backdrop, occupies only its bar — §9). **Maximized mode
  visually fills the viewport** (it's `inset-0`), so the article is covered *while maximized* — that
  is the intent ("the clip is the screen"). It still carries **no focus trap and no `aria-modal`**
  (§9) — it is a maximized non-modal region, exited by rotation / the Exit button / Close, not a
  dialog. The page underneath is inert only visually, never by a focus trap.
- **Page reflow (the "keep reading" guarantee).** While the dock is open in **docked** mode, the page
  reserves space at the **parked edge** so the article never hides permanently behind the bar:
  - **Bottom-parked:** add `padding-bottom` to the page scroll container equal to the docked bar's
    height (+ `safe-area-inset-bottom`) so the last section / the candidate's Promote-Dismiss row can
    always be scrolled clear of the bar (the existing mobile `PinnedPlayer` spacer pattern,
    `pinned-player.md` §6.2).
  - **Top-parked:** add `padding-top` equivalently (so the top of the article isn't permanently
    hidden under the bar). This is the symmetric new case the toggle introduces.
  - The spacer is the **one intentional, additive layout shift**, only while the dock is open and
    only at the parked edge; it is removed on dismiss (§8 state "dismissed") so the page reflows to
    full height. **Maximized mode needs no spacer** (it covers everything by design and restores on
    exit).

---

## 7. The park toggle (Decision 4 — labeled button, not drag)

The reader moves the dock between the **top** and **bottom** edges with a **labeled toggle button**,
never drag (drag fights touch scroll and is hard for AT — Decision 4).

- **Control:** a real `<button>` in the title bar, left of (or stacked with) Close.
- **Label + state (ship verbatim):**
  - When the dock is at the **bottom** (default): button reads **"Move to top"**, `aria-label="Move
    player to top of screen"`. A `⤒` glyph **plus** the word (shape + label, never glyph/color
    alone).
  - When at the **top**: button reads **"Move to bottom"**, `aria-label="Move player to bottom of
    screen"`, `⤓` glyph + word.
  - The label always names the **destination** (where it will go), the standard toggle convention.
- **Default edge:** **bottom** (matches the existing mobile `PinnedPlayer` "now playing" bar and
  keeps the dock clear of the header on open).
- **Interaction:** activating it moves the dock to the other edge; the page spacer moves with it (§6.6
  reflow — bottom-pad ⇄ top-pad). Motion (the dock sliding to the other edge) is **gated by
  `prefersReduced`** (§9): with reduced motion it simply appears at the new edge with no transition.
- **Focus on toggle:** focus **stays on the toggle button** after it moves (the button's label flips
  to the new destination; the reader can toggle back immediately). The dock does not steal focus or
  move it elsewhere on a park (§9).
- **Toggle vs. scroll:** because it's a discrete button tap (not a drag), it never competes with the
  article scroll gesture — the explicit reason Decision 4 chose a toggle.
- **Hidden in maximized mode** (§6.3/§6.4): parking is meaningless when the dock fills the screen, so
  the toggle is not rendered while maximized; it returns on exit.

---

## 8. Every state (with microcopy — ship verbatim)

Microcopy is fixed here. Labels are sentence/word case to match existing controls. The state machine
is the `pinned-player.md` machine generalized to both kinds + the new park/maximize axes.

### State: idle / no player
- **Trigger:** initial load; nothing activated; or after dismiss.
- **Render:** the dock is **not in the DOM** (dock state is `null`). No iframe exists on page render
  (preserves embed-never-host — nothing loads until an explicit play click).

### State: loading (iframe mounting)
- **Trigger:** a clip (curated or candidate) with `embedUrl` was activated on mobile; the dock mounts
  and the iframe begins loading.
- **Render:** dock present, docked at the default (bottom) edge, with the title bar (caption + credit
  + Move + Close) and the supplemental row shown immediately; the frame area is **black** while the
  embed loads its own UI. No custom spinner (the embed shows its own load state, as both existing
  players rely on). Momentary; visually identical to playing minus the started video.

### State: playing (docked)
- **Trigger:** iframe loaded; the video autoplays (the user explicitly clicked).
- **Render:** dock with title bar + supplemental row + the live iframe at the orientation-correct
  docked size (§6.2). Page stays interactive and scrollable around it (no backdrop); persists across
  scroll (`position: fixed`). The park toggle and (curated) "Context ▸" are operable.
- **iframe attributes** (reuse verbatim): `src = embedUrl + (?|& )autoplay=1`, `title = caption`,
  `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`,
  `allowFullScreen`, `className="h-full w-full"`.

### State: swap (candidate A → candidate B)
- **Trigger:** a candidate is playing and the reader taps a *different* candidate.
- **Render:** the **same** dock stays mounted; its payload (`embedUrl`/`caption`/`credit`/
  `orientation`/`matchReason`) **changes in place** (autoplay). No second dock, no teardown/remount.
  If B's orientation differs, the frame resizes per §6 within the same dock. The curated "Context"
  expander (if the dock were curated) resets to collapsed on any swap. *No play-next automation —
  swap only on explicit tap.*
- **Curated ⇄ candidate swap:** if a reader taps a *curated* clip while a *candidate* plays (or vice
  versa), the same single dock re-renders with the new `kind` (supplemental row swaps from match
  reason to the curation block, or back) — still one dock, one iframe, swapped in place. This is the
  unification's clean consequence (one surface for both kinds).

### State: collapsed curation (curated only — default)
- **Trigger:** a curated clip with a note is playing; the reader has not expanded the note.
- **Render:** title bar (credit visible) + chips (+ held marking if held) + "Context ▸"; the frame.
  Compact; the article stays readable around the docked bar. (§5.3 collapsed.)

### State: expanded curation (curated only)
- **Trigger:** the reader taps "Context ▸".
- **Render:** the full note panel (light surface) + "context by" appear in place, scrolling inside a
  bounded region (§5.3); the frame keeps its size; playback continues; the dock does not exceed its
  cap. "Context ▾" collapses it back. Microcopy: expander label `Context`; note eyebrow `Curator
  note` (verbatim from `PlayerModal`); attribution via `ContextByLink` (`@prototype` → "seed clip ·
  no curator", verbatim).

### State: maximized — landscape, horizontal clip
- **Trigger:** `orientationchange` to landscape with a 16:9 clip open, **or** "⤢ Maximize".
- **Render:** the dock fills the viewport, the 16:9 frame fills width, the chrome condenses to a thin
  Close bar (credit caption); supplemental row + park toggle hidden (§6.3). Same iframe, no remount.

### State: maximized — vertical clip (full height upright)
- **Trigger:** `orientationchange` to landscape with a 9:16 clip open, **or** "⤢ Maximize" on a
  vertical clip in any orientation.
- **Render:** the 9:16 frame fills the full height upright, centered/letterboxed; condensed chrome
  (§6.4). Same iframe, no remount.

### State: no-embed (curated clip without `embedUrl`)
- **Trigger:** a **curated** clip whose `embedUrl` is absent is activated on mobile.
- **Render:** the dock opens with the frame showing the **"This clip can't be embedded."** message
  (white text on black — verbatim from `PlayerModal`), **and the curation block still renders** (the
  reader can still read the credit, chips, and note — that's the value even when the video can't
  play). This mirrors `PlayerModal`'s existing behavior for an unembeddable curated clip; the curated
  player has always shown the curation block even when the frame can't play. **No `src`-less iframe is
  rendered** (the message replaces the iframe). Close/Move reachable as normal.
- **Why curated differs from candidate here:** a curated clip carries a human-written note worth
  reading even if the embed fails, so the dock is worth opening; a candidate carries only a match
  reason, so (next state) it falls back to a new tab.

### State: no-embed (YouTube candidate without `embedUrl`) / non-YouTube candidate
- **Trigger:** a YouTube candidate with **no** `embedUrl`, or any non-YouTube candidate, is
  activated.
- **Render:** **no dock.** Falls back to `window.open(watchUrl, "_blank", "noopener")` — the exact
  `VideoThumb.activate()` behavior today (`pinned-player.md` §9 state F/G). The thumb keeps its
  existing **"opens ↗"** corner tag. No new string. No `src`-less iframe. This is unchanged on mobile
  and desktop alike.

### State: dismissed
- **Trigger:** the reader activates Close (touch or keyboard).
- **Render:** the dock **and its iframe are removed from the DOM** (state → `null`); playback stops;
  no hidden iframe keeps running. The page spacer (top or bottom, whichever edge it was parked at) is
  removed so the page reflows to full height. Focus handled per §9.

> **State table for QA:**
>
> | State | Dock in DOM? | iframe? | Layout | `window.open`? |
> |---|---|---|---|---|
> | idle | no | no | — | — |
> | loading | yes | yes (loading) | docked | no |
> | playing (docked) | yes | yes | docked, parked edge | no |
> | swap | yes (same one) | yes (`src` changed) | docked | no |
> | collapsed curation (curated) | yes | yes | docked | no |
> | expanded curation (curated) | yes | yes | docked (note scrolls) | no |
> | maximized — horizontal | yes (same one) | yes (same one) | `inset-0` fill width | no |
> | maximized — vertical | yes (same one) | yes (same one) | `inset-0` fill height | no |
> | no-embed (curated) | yes | **no** (message) | docked | no |
> | no-embed (YT candidate) / non-YT | **no** | **no** | — | **yes** (watchUrl) |
> | dismissed | no | no | — | — |

---

## 9. Non-modal accessibility contract (carried from `pinned-player.md` §8)

This is the heart of the spec: a **non-modal**, movable region that behaves nothing like the
focus-trapping `ModalShell`. It generalizes `pinned-player.md` §8 to both kinds and the new
park/maximize controls. (Reference contrast tokens: `--color-brand #676EB4`, `--color-ink #2C2C2C`,
the global `:focus-visible { outline: 3px solid var(--color-brand); outline-offset: 2px }`.)

- **Labeled, non-modal region.** The dock root is a **`<section aria-label="Video player">`** (a
  labeled landmark). It is **not** `role="dialog"`, carries **no** `aria-modal`, uses **no** focus
  trap, **no** backdrop, and is **not** routed through `ModalShell` — even in maximized mode (which is
  a layout, not a modality, §6.6).
  - *Accessible-name note for Dev/QA:* the candidate-only `PinnedPlayer` today uses `aria-label="Video
    preview"`; the unified dock plays curated clips too, so its name is **"Video player"** (matching
    the curated player's intent). The screenshot/e2e helpers that key on `aria-label="Video preview"`
    must be updated to the new mobile dock's name (§11). The desktop `PinnedPlayer` keeps "Video
    preview" (it's untouched this PR).
- **Does not steal focus on open.** Opening the dock from a play button does **not** move focus: the
  dock mounts with **no autofocus**, runs **no** `.focus()` on open, and is appended at the end of the
  DOM. After the tap, `document.activeElement` remains the originating `VideoThumb` / `ClipCard` play
  button (or wherever the reader was). (Contrast with `ModalShell`, which focuses the first focusable
  on mount — the dock must **not**.)
- **Keyboard-operable controls, visible focus, sensible return.** Close, the park toggle, the
  Maximize/Exit toggle, the "Context" expander, and the logged-out CTA are all real `<button>`s in
  the normal tab order, reachable by Tab, operable by Enter/Space, each showing the global
  `:focus-visible` ring. **Tab is never trapped** — it flows into and out of the dock like any region.
  - **Close return:** if focus was inside the dock when Close fired (the user tabbed to Close), move
    focus to the **General band heading** (the existing `focusBandHeading()` anchor: set
    `tabindex=-1` on `#general-band h2`, focus it) rather than dropping to `<body>`. If Close was hit
    by touch (focus not in the dock), leave focus where it is. (Reuses the `dismissPinned()` pattern
    in `TopicView` exactly.)
  - **Park toggle return:** focus **stays on the toggle** (§7) — the dock moved, not the focus.
  - **Maximize/Exit return:** on Exit, focus stays on the Exit→Maximize button (now relabeled). On
    a rotate-driven exit (no button pressed), leave focus where it was.
  - **Context expander return:** focus stays on the expander; `aria-expanded` flips true/false and
    `aria-controls` points at the note panel.
- **Respects reduced motion.** Any dock-in appearance, the park slide, and any maximize transition are
  **gated by the existing `prefersReduced` signal** `TopicView` already reads and threads down. Under
  reduced motion the dock simply appears / moves / maximizes with **no transition** (end-state
  applied instantly). Implement as the motion-gated class precedent (`prefersReduced ? "" : "
  pinned-dock-in"` and the `@media (prefers-reduced-motion: reduce)` no-op block already in
  `globals.css`). Default (no preference): the existing ≤200ms ease-out dock-in; the maximize fill is
  a short ease (≤200ms) likewise suppressed under reduce.
- **AA contrast, never color/position-alone.** Indigo Press tokens with verified AA:
  - Title bar: **white on `ink #2C2C2C`** (≈15:1).
  - Close: white `✕` glyph **plus the word "Close"** — the word is the affordance, never the glyph or
    a color change alone.
  - Park toggle: glyph **plus** the words "Move to top"/"Move to bottom" — the word is the affordance.
  - Maximize/Exit: glyph **plus** the word "Maximize"/"Exit".
  - "Context ▸": the word "Context" + a rotating caret (shape), never color alone; `aria-expanded`
    carries the state to AT.
  - Chips: their own AA-safe dark fills (`StanceChip`/`AccuracyChip`), each with its `sr-only` word.
  - Logged-out CTAs: the **word** ("Curate this video" / "Log in to curate videos for this topic")
    carries the meaning; white-on-`brand` at bold clears AA, the 2px ink border carries the boundary
    on the ink bar; the join nudge is ink-on-white (≈15:1). No gold.
  - The note panel (expanded): `text-ink2` on white (the light register), clears AA.
  - Border: 2px `ink` against the page background and against black — both clear the non-text AA
    boundary bar.
- **z-index.** Docked + maximized both sit at **`z-40`** (above page content, **below** the app
  modals at `z-50` / `ModalShell`). So if a `CurateModal` / `AddModal` opens from a CTA, it correctly
  covers the dock and its focus trap governs while up. The dock never covers a modal.
- **`orientationchange` listener hygiene.** The rotate→maximize listener is added **only while a dock
  is open** and removed on dismiss (no global listener firing when nothing is playing). It is a
  passive layout-state toggle — it never calls `requestFullscreen` (Decision 3, §6.5).

---

## 10. Microcopy summary (ship verbatim)

| Element | String |
|---|---|
| Region accessible name (mobile dock) | `Video player` |
| Close control label | `✕ Close` (glyph **and** word) |
| Close `aria-label` | `Close video player` |
| Park toggle (at bottom) label | `⤒ Move to top` · `aria-label` `Move player to top of screen` |
| Park toggle (at top) label | `⤓ Move to bottom` · `aria-label` `Move player to bottom of screen` |
| Maximize toggle (docked) | `⤢ Maximize` · `aria-label` `Maximize video to fill the screen` |
| Maximize toggle (maximized) | `⤢ Exit` · `aria-label` `Exit full-screen video` |
| Curated note expander (collapsed) | `Context ▸` · `aria-expanded="false"` |
| Curated note expander (expanded) | `Context ▾` · `aria-expanded="true"` |
| Curated note eyebrow (expanded) | `Curator note` (verbatim from `PlayerModal`) |
| "context by" attribution | `ContextByLink` (`@prototype` → `seed clip · no curator`) |
| Candidate supplemental line | the candidate's `matchReason` |
| Logged-out CTA — candidate | `✦ Curate this video` (`aria-label` `Curate this video — log in to write a context note and vouch for it`) |
| Logged-out CTA — curated | `Log in to curate videos for this topic` |
| Held marking (curated, when held) | `In review · not yet vouched` (the existing `HeldMarking` text) |
| Caption line | the clip's `caption` (`line-clamp-1`) |
| Creator credit | `{creator.handle} · {platformLabel}` |
| No-embed (curated) frame message | `This clip can't be embedded.` (verbatim from `PlayerModal`) |
| No-embed (YT candidate) / non-YT | *(none — falls back to new tab; thumb keeps "opens ↗")* |

---

## 11. Screenshot-catalog work (per CLAUDE.md "UI screenshot gallery")

The catalog (`e2e/screenshots/catalog.ts`) is the single source of truth; Dev adds `Scene`s so the
new mobile states are captured + indexed automatically, then runs the refresh (`scripts/dev/shots.sh
--scene … --commit ui` for these, or `--all --commit ui` since the shared player surface changes).
Add these **mobile** scenes (all `viewports: ["mobile"]`, both auth states unless noted), and update
the helpers (the existing `openPinnedPlayer` keys on `aria-label="Video preview"`; the new mobile dock
is `aria-label="Video player"` — add a `SEL_MOBILE_DOCK = 'section[aria-label="Video player"]'` and a
`openMobileDock` helper):

- **`mobile-player-curated`** — curated clip, docked, **collapsed** curation (chips + "Context ▸").
  (Logged-out + signed-in: logged-out adds the join nudge.)
- **`mobile-player-curated-expanded`** — same, **expanded** note (full note + "context by", scrolling
  region). Logged-out arm shows the join nudge after the note.
- **`mobile-player-candidate`** — candidate, docked, match reason; logged-out arm shows "✦ Curate this
  video", signed-in arm metadata-only.
- **`mobile-player-vertical`** — a 9:16 clip docked (height-capped, letterboxed) to evidence the
  vertical fit at 390px.
- **`mobile-player-top-parked`** — the dock parked at the **top** edge (the toggle's other state) with
  the article visible below.
- **`mobile-player-maximized-horizontal`** — a 16:9 clip maximized filling width (capture in a
  landscape viewport, e.g. add a one-off `{ width: 740, height: 390 }` framing or a landscape mobile
  viewport in the scene's `prepare`).
- **`mobile-player-maximized-vertical`** — a 9:16 clip maximized filling height upright.
- **`mobile-player-noembed-curated`** — a curated clip with no `embedUrl`: the "can't be embedded"
  message **plus** the curation block.

Refresh the committed baseline gallery (`docs/design/ui-screenshots/`) in the same PR so it tracks
the change (the curated-mobile and candidate-mobile player surfaces both change). Attach a focused
subset to the PR with `--scene … --pr <N>`.

> **Note for Dev/QA on captures.** The embed stub (`stubEmbeds`) renders a solid dark panel, so the
> frame shows as a panel, not a blocked iframe — fine for these shots. The maximized landscape shots
> need a landscape rendering window; if the catalog's mobile viewport (390×850) can't be rotated per
> scene, add a dedicated landscape framing rect or a `prepare` that sets the viewport — record which
> in the scene `note`.

---

## 12. Component breakdown & TopicView wiring (orientation only — Dev owns implementation; DO NOT treat as code)

- **New:** `components/topic/MobilePlayerDock.tsx` — a non-modal `<section aria-label="Video
  player">`, fixed, full-width, edge-pinned; renders the shared title bar (caption + credit + park
  toggle + maximize toggle + Close), the parameterized supplemental row (candidate match reason / the
  curated collapsed-expandable curation block, with the logged-out CTA per `kind`), and the frame
  (iframe attrs reused verbatim, or the curated "can't be embedded" message). Props ≈ `{ kind:
  "curated" | "candidate", clip: <the playable + supplemental fields>, signedIn, prefersReduced,
  onClose, onCurate?, onJoin? }`. Internal state it owns: `edge: "top" | "bottom"` (park),
  `maximized: boolean`, `expanded: boolean` (curated note). **Does not** use `ModalShell`. Mounts on
  play / unmounts on dismiss (iframe created on play, torn down on close). It SHOULD be built so a
  later desktop-sizing branch (`lg:` classes) is additive (the fast-follow) — don't add desktop
  branches now, but don't hard-code mobile-only assumptions that block them.
  - *Reuse, don't fork:* the curated curation block (chips / note / "context by" / held / join nudge)
    is the same content `PlayerModal` renders — Dev should lift/share that markup (e.g. a shared
    `CurationBlock` the modal and the dock both render) rather than re-type it, so the curated note
    stays a single source of truth. The candidate match-reason + "Curate this video" CTA are what
    `PinnedPlayer` already renders.
- **`TopicView.tsx` wiring (record for Dev — what this implies):**
  - A **mobile signal** at play time (A1): `const isMobile = !matchMedia("(min-width:1024px)").matches`
    (or an existing breakpoint hook). The curated `onPlay` (`setPlayer`) and candidate `playCandidate`
    each branch: mobile → set a new **`mobileDock`** state (carrying `kind` + the playable +
    supplemental fields + the originating candidate when `kind="candidate"`, so the logged-out CTA can
    re-run `promote`); desktop → the existing `setPlayer` (`PlayerModal`) / `setPinned` +
    `setPinnedCandidate` (`PinnedPlayer`) paths, unchanged.
  - One new state value (`mobileDock: … | null`) drives the single mobile dock (single instance). A
    curated→candidate or candidate→curated mobile swap re-sets this one value (one dock, swap in
    place).
  - Render `<MobilePlayerDock …>` at the end of the render tree alongside the existing players, gated
    on the `mobileDock` state. Pass `prefersReduced.current` (reduced motion), `signedIn` (already
    derived at `TopicView.tsx`: `const signedIn = typeof myContributorId === "number"`), `onClose`
    (drops `mobileDock`, runs `focusBandHeading()` like `dismissPinned`), and the logged-out
    `onCurate` (candidate → `() => promote(candidate)`) / `onJoin` (curated → the `curate`-gate join
    nudge, as `PlayerModal` binds today).
  - The **page spacer**: generalize the existing mobile `pinned` bottom-spacer (`{pinned && …}`) to
    the `mobileDock`-open case, and make it **edge-aware** (bottom-pad when parked bottom, top-pad
    when parked top) — the dock reports its edge up, or `TopicView` mirrors the edge state. Removed on
    dismiss.
  - The candidate play path still only opens a dock when `embedUrl` is present (else the
    `VideoThumb.activate()` new-tab fall-through handles it). The **curated** play path opens the dock
    even without `embedUrl` (it shows the "can't be embedded" message + the note — §8).
- **No** server / oEmbed / facade / data-model change. `Clip` and `Candidate` already carry every
  field the dock needs (both extend `VideoBase` with `orientation`/`embedUrl`/`caption`/`creator`/
  `platformLabel`; `Clip` adds the curation fields; `Candidate` adds `matchReason`). The facade is
  untouched.

---

## 13. Acceptance-criteria → design map (against the issue's "Done when")

| "Done when" criterion (issue #120) | Satisfied by |
|---|---|
| Opening a curated clip on a phone **never overflows the viewport** in either orientation at 360–430px, for 16:9 **and** 9:16, close/controls always reachable | §6.1 fit guarantee + §6.2 sizing math (dock capped, frame capped, internal scroll fallback); §5 Close/Move always in the pinned chrome |
| **Rotating to landscape** maximizes a horizontal clip; a **vertical** clip uses full portrait height upright; per-platform behavior matches the recorded decision, degrades gracefully | §6.3 (16:9 fill width) + §6.4 (9:16 fill height upright) + §6.5 (CSS maximize, why not native Fullscreen API, per-platform reasoning) + the explicit Maximize/Exit toggle for no-gesture/AT |
| When not fullscreen, the clip plays in a **container the reader can move to top or bottom**, article remains scrollable/readable | §7 park toggle (labeled, keyboard, not drag) + §6.6 page reflow (edge-aware spacer) + §9 non-modal/no-backdrop |
| Accessibility: non-fullscreen player doesn't trap or steal focus, keyboard-operable + labeled, AA, signals text-labeled (never color-alone) | §9 in full (no trap/steal, real buttons, focus return, AA tokens, word-carried signals) |
| Both curated **and** candidate clips use this player on mobile (the unification) | §3 routing + §4 coexistence + §5.2 parameterization + §8 curated⇄candidate swap |
| Logged-out CTA per kind; signed-in adds none | §5.2 table + §10 microcopy (candidate "Curate this video" / curated join nudge; signed-in: none) |
| CC BY-SA creator credit present on every clip surface (existing rule honored) | §5.1 (credit in the shared title bar → present in collapsed, expanded, and both maximized states) |
| Design-doc decision recorded; screenshot baseline refreshed | §6.5 (the per-platform fullscreen reasoning Dev reflects into `TOPIC_PAGE_DESIGN.md` when code lands) + §11 (catalog scenes + gallery refresh) |
| Desktop untouched this PR; later flip is a routing change | §3 routing + §4 + §12 (component built `kind`/`signedIn`-parameterized; desktop sizing additive) |

---

## 14. Assumptions recorded (for Product / Dev)

- **A1 — viewport read at play time; no live re-host mid-play.** The mobile-vs-desktop surface is
  chosen when the play click fires; an open dock stays in its surface across a breakpoint crossing
  (re-hosting would stop playback). Only the next play re-evaluates. (§3.)
- **A2 — the "Context" expander is curated-only.** Candidates have a one-line match reason, nothing
  to expand to (CURATION §6). (§5.3.)
- **A3 — Maximize is reachable without a rotation gesture.** Decision 3 names rotation as the
  trigger; this spec **adds** an explicit "⤢ Maximize"/"Exit" toggle so AT users, rotation-locked
  users, and vertical Shorts (no landscape trigger) can reach + leave the maximized view. If Product
  wants rotation-only, flag it — but a rotation-only maximize is unreachable by keyboard and fails the
  a11y criterion, so the explicit toggle is the recommended default. (§6.5.)
- **A4 — accessible name changes to "Video player" for the mobile dock.** The unified dock plays
  curated clips, so "Video preview" (the candidate-only name) is no longer apt; the e2e/catalog
  helpers keyed on the old name must update (the desktop `PinnedPlayer` keeps "Video preview"). (§9,
  §11.)
- **A5 — maximized is a non-modal layout, not a dialog.** Maximized fills the viewport visually but
  carries no focus trap / no `aria-modal` and is exited by rotation / Exit / Close, not Esc. If QA
  expects Esc-to-exit, that's a deliberate non-decision (Esc implies modality). (§6.6, §9.)

---

## 15. Hand-off

- **To Development:** build `MobilePlayerDock` per §5–§12; route **mobile** curated + candidate play
  into it (desktop unchanged, §3/§4); ship the §10 microcopy verbatim and the §8 state behaviors
  (esp. the curated no-embed-shows-note branch, the candidate new-tab fall-through, swap-in-place,
  and the CSS maximize — never native Fullscreen, §6.5); reuse the curated curation block as a shared
  source of truth with `PlayerModal`; reuse `prefersReduced`, `signedIn`, `focusBandHeading`; add the
  §11 catalog scenes + refresh the gallery; introduce no server/oEmbed/facade/data-model change. When
  the code lands, reflect the shipped design + the per-platform fullscreen reasoning (§6.5) into
  `docs/TOPIC_PAGE_DESIGN.md` (this spec does not edit that timeless doc).
- **To QA & Review + UX evaluation:** verify against the §8 state table and the §13 map; confirm the
  fit guarantee at 360/390/414/430 in both orientations for 16:9 + 9:16 (no overflow, Close + Move
  reachable); confirm CSS maximize fills correctly per orientation/clip without calling
  `requestFullscreen`; confirm the non-modal contract (§9 — no trap, no focus steal on open, keyboard
  Close/Move/Maximize/Context, focus return, AA, word-carried signals); confirm desktop is unchanged
  (curated = `PlayerModal`, candidate = bottom-left `PinnedPlayer`); confirm the CC BY-SA credit
  shows in the collapsed curated state and both maximized states.
