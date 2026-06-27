# Design spec: General strip — card tiles + full-bleed scroll

- **Status:** Design contract for build-loop (UX). Written **before** Dev. Owner-reviewed through an
  iterated interactive mockup (two rounds) on the Dendrobium kingianum strip — wider tiles, bordered
  note, corner curator badge, real Curate/Not-relevant styling, full-bleed scroll — all confirmed.
- **Owner:** UX / Design · **Slug:** `general-strip-fullbleed`
- **Focus topic:** `Dendrobium kingianum` (1 curated general clip + several suggestions — a mixed strip;
  the section-anchored curated clips live in the rail, not the strip).
- **Inputs read:** `components/topic/GeneralStrip.tsx`, `VideoThumb.tsx`, `ContextByLink.tsx`,
  `Chips.tsx`, `CandidateBits.tsx`, `app/globals.css` (`.candcard`/`.candthumb`, tokens),
  `components/auth/AuthControl.tsx` (the collapsed-username initial style the curator badge echoes),
  `docs/TOPIC_PAGE_DESIGN.md`. Builds on `general-hero-layout.md` (the hero's video+card pattern,
  applied here per-tile and compacted).

## 1. Problem / intent
The General strip reads noisy and cramped: small thumbnails, curation info stacked as several text
rows on the indigo band, and the row confined to the centered content column. Make the **videos
bigger and the strip calmer**, and let it use the **full width** of the (already edge-to-edge) band.

## 2. The tile — one compact white card (curated and suggested)
Every strip tile becomes a single **white (`surface-raised`) zine card** (2px `hardbox` border +
offset shadow), echoing the hero's video-then-card pattern per tile:

- **Bigger thumbnail, bled to the card top.** A uniform **3:2** frame (taller than today's 16:9), the
  card's full width, **no own border except a 2px bottom seam** (the card frames its sides/top; the
  seam separates it from the info). `object-cover`; the click-to-play facade + platform tag are
  unchanged. Uniform 3:2 for every tile keeps the row even (and crops a vertical clip less than 16:9 did).
- **Wider tiles** — ~`w-72` (288px) — so the picture leads; tiles stack with a **tight** gap.
- **Compact info below** (padded), top-to-bottom:
  - **Caption** (bold ink, 2-line clamp).
  - **`@creator · platform`** (muted, one line).
  - **Stance + accuracy chips + the upvote tag** — one inline row (unchanged chips/upvote).
  - **Curator note — the plus-rail's quote treatment** (a left indigo bar `border-l-4 border-brand`
    over a tinted `surface-2` fill + the "Curator note" eyebrow), so the General strip and the plus
    rail read consistently in their basic styling. 2-line clamp; the curator credit is the corner
    badge (§2.1).
  - The standard owner Edit/Delete, ReviewRow, and "★ Make hero" controls follow (unchanged, still
    gated), below the note.

### 2.1 Curator credit → a corner initial-badge (not a row)
The "context by <curator>" row is replaced by a small **initial badge** in the **note's lower-right
corner, overlapping the border** — the header's collapsed-username style (a ~26px circle, 2px
`hardbox` border, `brand→violet` gradient, white bold initial). **Hover or focus reveals the full
name** in a small pill, and the badge **links to the curator's profile** (same target as
`ContextByLink`). Accessible name = the full "context by <username>" (so AT gets it without hover). A
stub/`@prototype` curator shows **no badge** (no dead link). This makes the credit less prominent and
frees a whole row.

### 2.2 Suggested (uncurated) tile
Same white-card shape with the **dashed/desaturated unvetted treatment** (`.candcard` dashed border +
`.candthumb` hatch + desaturated thumbnail). It carries only: bigger thumbnail → caption → `@creator ·
platform` → (signed-in) **Curate / Not relevant** in their **real styling** (✦ Curate = brand fill;
✕ Not relevant = white outline). No curator note/badge (uncurated). The once-per-context unvetted
signal stays in the "Suggested · uncurated" divider (kept).

## 3. The scroll — full-bleed, content-aligned start, scrollbar flush at the bottom
- **Use the full band width.** The horizontal scroller is **not** confined to the centered content
  column — it spans the full band (viewport) width, so scrolling fills the entire width with videos.
- **Initial position aligns with the Wikipedia content.** The first item starts at the **content
  column's left edge**: the scroller's `padding-left` = `max(1.25rem, calc((100% - 1200px)/2 +
  1.25rem))`, where `100%` is the band's content width (use `100%`, **not** `100vw`, so a vertical
  page scrollbar doesn't shift the alignment). Scrolling pushes the tiles left into the full width;
  the right side bleeds to the band edge (small trailing gutter).
- **Scrollbar at the very bottom of the band, no indigo beneath it.** The scroller is the band's last
  element with **no bottom padding**; its horizontal scrollbar sits flush against the band's bottom
  border (no indigo strip below it). Style the scrollbar on-brand (white thumb + 2px border, band track).
- The header (the `sr-only` "General videos" h2, or the empty-state visible heading) stays in the
  centered container; the **hero block** (when a hero is set) is unchanged above the scroller. The
  find-more controls (signed-in) lead the scroller; the "Suggested · uncurated" divider stays.

## 4. States
- **Logged-out:** video cards only; first card at the content edge; scrollbar flush at the bottom.
- **Signed-in:** find-more controls lead the row; suggestions gain Curate / Not relevant.
- **Empty / mixed / fully-curated / loading / zero-results:** unchanged in logic; the scroll row (when
  it renders) is the full-bleed scroller. Empty-state heading + UNCURATED + subtitle unchanged.
- **Hero set:** the hero block renders above (unchanged); peers + suggestions fill the full-bleed row.

## 5. Accessibility
- The curator badge is a real link with `aria-label` = the full "context by <username>" (meaning never
  by initial/hover alone); keyboard-focusable; the name reveals on focus as well as hover.
- All tile text sits on the white card (AA over the indigo band — the reason every tile is now a card).
- Chips/upvote/Curate/Not-relevant keep their existing labels, AA fills, focus rings, and ≥44px targets.
- The scroller is keyboard-scrollable; the divider's "Suggested · uncurated" word is retained for AT.
- No new motion; the optional curated fade stays reduced-motion-gated.

## 6. Acceptance criteria (Phase-4)
1. Every curated peer tile and every suggestion tile renders as a single white card: a 3:2 thumbnail
   bled to the card top (bottom seam only) + compact info below; tiles are ~288px wide.
2. The curated note is bordered; the curator credit is a corner initial-badge overlapping the note's
   lower-right border, linking to the profile, with the full name on hover/focus and an `aria-label`
   carrying "context by <username>"; the "context by" row is gone; a stub curator shows no badge.
3. Suggestion tiles keep the dashed/desaturated unvetted treatment and (signed-in) Curate / Not
   relevant in their real styling; the "Suggested · uncurated" divider remains.
4. The scroll row spans the full band width; the first item starts at the content column's left edge
   (via the `100%` calc, scrollbar-safe); scrolling fills the full width; the horizontal scrollbar is
   flush at the band's bottom with no indigo beneath it.
5. All other band states (empty/mixed/fully-curated/loading/zero, hero present) still render correctly;
   the hero block + the find-more lead + the divider are intact.
6. `yarn typecheck` + `yarn test` + `yarn build` pass; the General-strip screenshot baseline is refreshed.

## 7. Scope / out of scope
- **In:** the General-strip peer + candidate tiles, the curator badge, and the scroll behavior.
- **Out:** the hero block (unchanged), the rail `ClipCard` (separate surface; the rail upvote move is
  the already-filed #174), any data/schema/policy change. Note bg = `surface-2`, badge = bottom-right,
  no note eyebrow — the owner's confirmation defaults; trivially tunable.

## 8. Build notes (for Dev)
- `app/globals.css`: a `.general-scroller` class — full-width flex scroller, `padding-left:
  max(1.25rem, calc((100% - 1200px)/2 + 1.25rem))`, small right padding, **no** bottom padding,
  `overflow-x:auto`, and `::-webkit-scrollbar` styling (white thumb + 2px border, band track).
- `VideoThumb.tsx`: a `stripcard` variant → `aspect-[3/2] w-full` with **only** a 2px bottom border
  (the card supplies the rest). Reuse the candidate desaturate/hatch.
- New `components/topic/CuratorBadge.tsx`: the initial badge (real curator → link + hover/focus name;
  stub → null). Reuse `curator-attribution` helpers + `contributorHref`.
- `GeneralStrip.tsx`: move the scroll `<ul>` OUT of the centered `max-w` container to a full-width
  child using `.general-scroller`; keep the header/hero centered; rebuild the peer + candidate tiles
  as white cards per §2/§2.2; band has no bottom padding when the scroller renders (scrollbar flush).
- Refresh `docs/TOPIC_PAGE_DESIGN.md` (the General-strip anatomy + scroll behavior) as a timeless
  directive, and the General-strip screenshot baseline.
