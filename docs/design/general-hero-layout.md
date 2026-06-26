# Design spec: Lower-chrome General band + full-bleed hero

- **Status:** Design contract for build-loop (UX). Written **before** Dev. Owner-reviewed through an
  iterated interactive mockup (the three subjective forks — direction, gold marker, chrome level —
  were each confirmed with the owner before this spec was committed).
- **Owner:** UX / Design
- **Slug:** `general-hero-layout`
- **Supersedes** the hero-block presentation in `docs/design/hero-video.md` §2 (the prominence
  *mechanism* — `topic.heroClipId`, eligibility, the mark/unmark control, logged-out parity — is
  unchanged; only the *visual form* of the hero block and the General-band header change here).
- **Inputs read:** `components/topic/GeneralStrip.tsx`, `components/topic/VideoThumb.tsx`,
  `components/topic/UpvoteControl.tsx`, `components/topic/Chips.tsx`, `app/topic/TopicView.tsx`
  (the band placement + hero host wiring), `docs/TOPIC_PAGE_DESIGN.md` (the General-strip + hero
  anatomy), `docs/VISUAL_IDENTITY.md` (Indigo Press; gold is now an allowed functional accent with
  the AA "never by color alone" rule).

## 1. Problem / intent

The General band reads as too much chrome around a small video: a `＋ General` heading + count pill,
then a shared zine card whose 14px white padding + the video's own border nest several frames between
the indigo band and the picture. A reader — especially a logged-out, video-hungry one — should meet
the **video first**. This pass makes the picture the dominant element and treats the curation info as
its own card docked to the video, not a label beside it on a shared card.

## 2. The changes (element by element)

### 2.1 General-band header — removed in curated states
Drop the visible **`＋ General` heading** and the **`N video` count pill** in the mixed and
fully-curated states (the count already lives in the ＋plus overview card; the label adds no signal).
Keep an **`sr-only` `<h2>`** ("General videos") so assistive-tech heading navigation and the region's
accessible name survive — the region keeps its `aria-label`. The **empty state is unchanged**:
`＋ Suggested videos` + the `UNCURATED` pill + the "— auto-found candidates, not yet vetted" subtitle
stay (that text is the once-per-context unvetted signal, required, not chrome).

### 2.2 The hero block — full-bleed video + docked curation card
When a hero is set, the hero renders at the front of the band as **two parts, not one shared card**:

- **The video bleeds.** A uniform **16:9** thumbnail fills the left column with **no white margin or
  card padding around it** — flush to the band's content-box **left edge** and (when the hero is the
  band's first/last element) its **top/bottom** edges. The video carries **no inner border**; the
  indigo band's border frames it. The thumbnail is the click-to-play facade (unchanged behavior).
  Uniform 16:9 (object-cover) for any orientation keeps the docked-card layout stable (a 9:16 clip is
  cropped to the frame, the same uniform-landscape rule the strip tiles use).
- **The curation card is its own card, docked to the video's side.** On `≥ sm` it sits to the
  **right** of the video — a white (`surface-raised`) zine card (2px `hardbox` border + offset
  shadow), **vertically centered**, floating on the indigo, **not overlapping** the video. On narrow
  it drops **below** the video as a card attached at a 2px top seam (full width, flush to the band's
  left/right, no offset shadow). It holds: the **title** (`text-base`/`lg`), the **gold ★ hero
  marker** in its **upper-right** (a flex header row with the title, so it never overlaps the wrapping
  title), `creator · platform`, the **chips + upvote row** (§2.3), the **Curator note** panel, the
  **`context by`** link, and the signed-in curator controls (Edit/Delete, ReviewRow, Unmark-hero) at
  the card's foot.

The **bleed extent** is the band's **content box** (`max-w-[1200px]`) — the video runs to that edge,
not the page's `px-5` text gutter and not the raw screen edge; the card keeps the `px-5` gutter on its
outer side so it aligns with page content. Negative margins on the hero `<article>` (`-mx-5`, and
`-mt-4`/`-mb-4` when it is the first/last band element) achieve the bleed without disturbing the other
band states' padding.

### 2.3 Upvote — a tag inline with the chips
On the hero **and** every curated General **peer tile**, the upvote moves **into the chips row**,
rendered as a **tag with the same height as the Stance/Accuracy chips** (same 2px border, padding,
10px bold uppercase). It is an **outline** pill (white `surface-raised` fill, ink text, the ▲/△ glyph
in `violet`) so it reads as an *action* beside the *filled* signal chips. All upvote semantics are
unchanged: signed-in → an interactive `aria-pressed` toggle with the ▲ filled / △ outline **shape**
difference + the "· Voted" word (never color alone); logged-out → a **non-interactive figure** (a
`<span>`, no button affordance) that still sits inline at chip height; a 0 count renders nothing.

### 2.4 The gold ★ marker
The hero marker is a small **gold `#E5AB28` ★** in the curation card's upper-right. Its meaning is
carried by the **star shape + the hero region's accessible label** ("Hero video: <caption>") — gold
reinforces, never alone (the AA rule; gold is now an allowed functional accent per VISUAL_IDENTITY
§7.3). No "HERO" word. The video thumbnail carries **no** star (the marker lives on the card).

## 3. States (every state must hold)

| State | Header | Hero block | Scroll row |
|---|---|---|---|
| No hero, logged-out/in | sr-only h2 | absent | all general clips as tiles (upvote inline in chips) |
| Hero set, logged-out | sr-only h2, **no find-more** | full-bleed video + docked card, **no controls**, ★ upper-right | peers (minus hero), if any |
| Hero set, signed-in | sr-only h2, find-more toolbar above | block + Edit/Delete + ReviewRow + **Unmark hero** at card foot | peers, each with "★ Make hero" |
| Hero held | — | card shows the **HeldPill** (top of card) | — |
| Hero is the only general clip | — | block alone, **bleeds top + bottom** of the band | empty |
| Empty (0 curated) | `＋ Suggested videos` + UNCURATED + subtitle (**unchanged**) | absent | suggestion tiles |
| Mark/unmark in flight | — | optimistic flip + busy word on the activated control | — |

## 4. Responsive
- **`≥ sm`:** video left (~60% basis), curation card docked right, vertically centered, floating on
  indigo, not overlapping.
- **`< sm`:** video full-width on top (bleeds to band top/left/right), curation card attached directly
  below at a 2px seam, full width. The chips + upvote row wraps.

## 5. Accessibility
- **Region + heading:** the band keeps its `aria-label`; an `sr-only` `<h2>` preserves heading
  navigation though the visible label is gone. The hero region keeps `aria-label="Hero video:
  <caption>"` so AT announces the lead — prominence is never size/color alone.
- **Gold ★:** shape + the region label carry it; gold is reinforcement (AA "never by color alone").
- **Upvote tag:** the interactive (signed-in) tag stays a real `<button>` with `aria-pressed`, the
  ▲/△ **shape** difference, the "· Voted" **word**, the site focus ring, and a tap target at the
  chip-height visual; the logged-out figure is a non-interactive `<span>` (never announced as a
  control). Chips keep their text labels + AA-safe fills.
- **Contrast:** all curation-card text sits on white `surface-raised` (clears AA over the indigo
  band) — the reason the card is white; the bled video has no text on it but the play facade + tag
  keep their existing treatment.
- **Reduced motion:** no new motion; the optional curated fade stays reduced-motion-gated.

## 6. Acceptance criteria (Phase-4 checks)
1. In a curated state, the visible `＋ General` heading and `N video` count pill are **absent**; an
   `sr-only` h2 is present; the empty state's heading + UNCURATED pill + subtitle are **unchanged**.
2. With a hero set, the video renders as a uniform 16:9 frame with **no card padding/border around its
   top/left/bottom** (bleeds to the band content box); the curation card is a **separate** white
   bordered card docked to the video (right on `≥ sm`, below on `< sm`) and **does not overlap** the
   video.
3. The gold ★ marker is in the curation card's **upper-right** and does not overlap the title at any
   width; the video thumbnail has **no** star.
4. On the hero and every curated peer tile, the upvote renders **inline in the chips row** at chip
   height as an outline tag; signed-in → interactive `aria-pressed` toggle (▲/△ + "Voted"),
   logged-out → non-interactive figure, 0 → nothing.
5. All hero trust signals remain present and functional: chips, Curator note, `context by`, upvote,
   HeldPill (when held), owner Edit/Delete, ReviewRow, and the Mark/Unmark-hero control (signed-in).
6. Logged-out parity: a hero renders with prominence and **no curator controls**; an anonymous read
   adds no per-user work. Keyboard + focus reach the play facade and controls; AA holds.
7. `yarn typecheck`, `yarn test`, `yarn build` pass; the General-strip screenshot baseline is
   refreshed.

## 7. Scope / out of scope
- **In:** the General band header, the hero block, and the curated **General** tiles' upvote.
- **Out (this pass):** the **rail `ClipCard`** upvote (it shares the control, but the owner's ask was
  the General strip/hero; moving the rail upvote inline is a logged follow-up for consistency). The
  hero prominence mechanism, eligibility, permissions, and host optimistic-rollback wiring are
  unchanged. No schema/auth/policy change.

## 8. Build notes (for Dev)
- `VideoThumb`: add a **`hero`** variant → `aspect-video w-full`, **no** `border-2` (the band/card
  frame it).
- `UpvoteControl`: add `appearance?: "inline" | "tag"` (default `inline`, unchanged for the rail). The
  `tag` form is the chip-height outline pill above; keep both signed-in and logged-out branches.
- `GeneralStrip`: remove the visible curated heading + count (keep sr-only h2); render the hero as the
  full-bleed `<article>` (negative-margin bleed, docked card, ★ via a title/▢ flex header row); move
  the peer-tile upvote into the chips row (`items-center`).
- Gold token: use the brand gold `#E5AB28` for the ★ (add a `--color-gold` theme token if it makes the
  fill cleaner; otherwise an inline fill is acceptable for the single marker).
- Refresh `docs/TOPIC_PAGE_DESIGN.md` (the General-band header + hero anatomy) to describe the new
  calmer form as a timeless directive, and the General-strip screenshot baseline.
