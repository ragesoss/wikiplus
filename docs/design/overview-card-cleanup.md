# Design spec: Overview-card cleanup for marked-complete topics

- **Status:** Design contract for build-loop (UX). Written **before** Dev, approved on a rendered
  mockup by the owner.
- **Owner:** UX / Design
- **Revises:** `docs/design/topic-complete.md` (issue #159). That doc placed the "marked complete"
  **status indicator + both opt-in paths** and the **per-viewer override** inside the wiki+ Overview
  panel (`Infobox`, its §2/§3/§4). This spec moves the reader-facing completion signal **out of the
  Overview card** and into the video strip, and simplifies the card. Where the two disagree, this doc
  governs the Overview card, the strip toggle, and the TOC; the rest of topic-complete.md (the data
  model, the role-gated Server Actions, the suppression derivation, the session-local override
  mechanics) stands unchanged.
- **Inputs read:** `docs/design/topic-complete.md`; `docs/TOPIC_PAGE_DESIGN.md` (the wiki+ panel, the
  General strip, the TOC dual counts, the logged-out reader model #71); `docs/VISUAL_IDENTITY.md`
  (Indigo Press palette, the universal `SiteHeader` projector header is the brand wordmark's home, AA,
  text-labeled-never-color); `components/topic/Infobox.tsx`, `GeneralStrip.tsx`, `Toc.tsx`,
  `app/topic/TopicView.tsx`.

---

## 1. Problem & intent

On a topic a curator marked **complete**, the Overview card (`Infobox`) does five jobs at once: a
brand wordmark header, a "Marked complete" notice with two buttons, a counts grid, a Browse/Jump
scroll button, and the curator's mark/reopen control. It reads busy, and the completion messaging +
suggestion-reveal sit on the plus side's orientation card rather than near the videos they govern.

This change makes the Overview card a **quiet stats card** and relocates the reader-facing completion
signal + the "show suggestions" reveal to **the video strip**, where a learner who wants more would
look. Driven entirely by the owner's direction; faithful to the established Indigo Press system (no
new identity).

## 2. Personas / stories served (carried from topic-complete.md §1)

- **The reader of a complete topic** wants a calm, near-plain article — the busy card worked against
  that. → the trimmed card + the unobtrusive in-strip signal.
- **The self-directed learner who still wants more (any viewer, incl. logged-out)** wants a one-click,
  account-free, in-session way to turn suggestions back on. → the **trailing toggle** in the strip.
- **The curator who is done (signed-in)** keeps the mark/reopen control. → the card foot, unchanged.

The flag still never re-words a clip's trust signals, never touches article faithfulness, and uses
**no gold** as a signal (VI).

---

## 3. The Overview card (`Infobox`) — the trimmed card

### 3.1 Header → a thin indigo cap, no text
Replace the `＋plus / on this topic` wordmark header block with a **thin solid `brand` cap** (a short
`bg-brand` strip, ~10px, with the `border-b-2 border-hardbox` seam, clipped by the card's
`overflow-hidden`). It is **decorative** (`aria-hidden`) — it identifies the card as a plus-side
element by color and the hardbox language; the brand **wordmark's home is the universal projector
header** (VI §10.1), so repeating "＋plus on this topic" on the card is redundant chrome.

### 3.2 Remove the "Marked complete" status block
Delete the entire status-indicator block from the card body (the calm notice + the "Show suggestions
anyway" override + the "＋ Add a video" button). The completion signal + reveal move to the strip
(§4); the curator's Reopen control stays at the card foot (§3.5). This removes the **only** place a
**logged-out** viewer ever saw an "Add a video" affordance — satisfying "Add a video must not appear
for a logged-out user." (The strip's `＋ Add video` is already signed-in-gated.)

### 3.3 Remove the Browse/Jump button
Delete the primary "Jump to videos ↓" / "Browse suggested videos ↓" action in **every** state. The
strip sits directly below the lead; a scroll-to-videos button earns its space less than the quiet it
costs.

### 3.4 What the card keeps
- **Counts / volume block** — unchanged across the derived states (the 3-up Videos/Creators/Curators
  grid; the empty dashed "{N} uncurated videos" volume; the mixed "{V} curated · {M} suggested" line).
  Still omitted on a **complete + zero-curated-video** topic (no honest numeral — topic-complete §6.2).
- **Curator mark/reopen control** at the foot — signed-in only, the `Mark topic complete` ⇄ `Reopen
  to suggestions` toggle + its helper line, unchanged (topic-complete §2).
- **The §6.5 store-error floor** — unchanged.

### 3.5 The empty-card guard (complete + zero curated video)
With the counts omitted (zero-video) and the status block gone, a **logged-out** viewer's card body
would be empty — just the cap. The card must **not render** when its body would be empty: render the
card only when it has body content — a store-error line, **or** a counts block (`!completeZeroVideo`),
**or** the signed-in curator foot control. So at complete + zero-video: a **signed-in curator** sees
the cap + `Reopen to suggestions`; a **logged-out reader** sees no card (a near-plain article + the
minimal strip band of §4.3 + the TOC).

---

## 4. The relocated "show suggestions" toggle — a trailing item in the strip

> **Superseded (placement only):** the toggle now lives in the **plus rail**, not the General strip —
> see [`complete-toggle-rail.md`](complete-toggle-rail.md). The form, microcopy, gate
> (`complete && hasUnderlyingSuggestions`), and override mechanics in this section are unchanged; only
> the surface it renders on moved. Retained as the record of the strip-placement build.

### 4.1 Placement (the decision)
The toggle is the **last item in the General strip's horizontal scroll row** — to the **right** of the
curated tiles, the same slot the "See N more" control occupies. It **stretches to the row height and
adds no vertical space** to the band. On a video-rich strip the reader reaches it by scrolling to the
end of the videos — a deliberate, reader-first quiet (the toggle is for the learner who actively wants
more, not a nudge). It is **not** a footer below the tiles and **not** in the rail.

### 4.2 Form + microcopy
A compact **white card** (white fill so its small text clears AA on the indigo `#676EB4` band), in the
hardbox language: `border-2 border-hardbox` + a `border-l-4 border-l-brand` rule + the
`2px 2px 0 hardbox-offset` shadow, ~`w-48`, a centered column. Contents:

- **Eyebrow:** `✓ Marked complete` (the `✓` is `aria-hidden`; the word carries the meaning).
- **Body line (verbatim):** *"A curator marked this complete, so suggestions are hidden."* — the
  honest framing (a curator's judgment, the mechanical effect stated plainly). Stays the **same** in
  both override states (the topic is still complete; only the button reflects the viewer's reveal).
- **Toggle button** (a plain `<button type="button">`, never `role="switch"`):

  | Override state | Visible label | `aria-label` |
  |---|---|---|
  | off (default — suppressed) | `Show suggestions anyway` | `Show suggestions for this topic in this session` |
  | on (overridden — shown) | `Hide suggestions again` | `Hide suggestions again — return to the complete view` |

  Off = **brand-fill** (`bg-brand text-white`, the live reveal path). On = quieter **raised/white**
  (`bg-surface-raised text-ink-plus`). `min-h-[44px]`.

### 4.3 When the toggle renders + the minimal band
- **Show the toggle iff `complete && hasUnderlyingSuggestions`** — i.e. the topic is marked complete
  AND has ≥1 underlying suggestion to reveal (computed as if the flag were off — `liveCandidates`).
  When a complete topic genuinely has **no** suggestion to reveal, the toggle is **omitted** (it never
  promises a reveal it can't deliver — topic-complete §4.4). This holds whether or not there are
  curated videos.
- **Complete + has curated videos:** the toggle is appended after the curated tiles (and, when
  overridden, after the revealed suggestion group + "See N more" — it stays the row's trailing item).
- **Complete + zero curated videos (the minimal band):** the band is **not** omitted (as it is today)
  when there are underlying suggestions — instead it renders a **minimal face**: the scroll row holds
  just the one toggle card. The band's omission now applies only when there is **truly nothing** —
  complete, no curated, no shown suggestions, not loading, **and** no underlying suggestions.
- **Not complete:** the toggle never renders; the strip is byte-for-byte unchanged (the established
  read-path guarantee).

### 4.4 Behavior
Activating the toggle flips the existing session-local, per-topic, client-only override (unchanged
mechanics — topic-complete §4): the page re-derives in place (no reload), suggestions reappear/return
across every surface, and the button's label/treatment flips. Focus stays on the button (same node).
The signed-in curator's `＋ Add video` (strip "Find more" cluster) and the rest of the strip are
unchanged.

---

## 5. The TOC — drop the "no video" badge

A section row in `Toc` with **zero** curated and **zero** suggested videos currently shows a muted
`no video` text badge. **Remove it:** such a row shows only its title, no trailing element. The TOC's
job is article navigation with optional video counts; a per-section "no video" label is noise that the
owner has judged unnecessary. The dual count badges (solid `{c}` curated, dashed `~{s}` suggested) are
unchanged where a row has them; the ＋General band row is unchanged.

---

## 6. States, responsive, accessibility

### 6.1 State matrix (the surfaces this change touches)

| State | Overview card | Strip toggle |
|---|---|---|
| Not complete (any derived state) | cap + counts (+ curator foot if signed-in). No Jump. | absent |
| Complete, default, **mixed/empty** (≥1 underlying suggestion) | cap + counts¹ (+ Reopen if signed-in) | present (`Show suggestions anyway`), trailing |
| Complete, default, **fully-curated** (0 underlying suggestions) | cap + counts (+ Reopen if signed-in) | absent (nothing to reveal) |
| Complete, **overridden** | cap + counts¹ (+ Reopen if signed-in) | present (`Hide suggestions again`), trailing after the revealed suggestions |
| Complete + **zero curated video**, signed-in | cap + Reopen (no counts) | minimal band: the lone toggle² |
| Complete + **zero curated video**, logged-out | **no card** (empty body) | minimal band: the lone toggle² |
| Store-read error | the §6.5 honest line | absent (band shows its own honest line) |

¹ counts reflect the suppressed suggestion count (mixed two-count line / dashed volume drop via the
existing zero-suggestion paths — topic-complete §5). ² iff there are underlying suggestions; else the
band is omitted and the article reads near-plain.

### 6.2 Responsive
The toggle inherits the strip's horizontal scroll at every width — it is a row item, so it never adds
a separate breakpoint. The trimmed card inherits the panel's responsive behavior (sticky rail ≥ lg,
stacked below the lead < lg). `min-h-[44px]` on the toggle and the curator control keeps the touch
floor.

### 6.3 Accessibility (AA baseline)
- The toggle is a native `<button>` in the scroll row's tab order; Enter/Space activate; the global
  `:focus-visible` ring applies; focus stays put on flip. State is carried by the **word** (label +
  the `✓ Marked complete` eyebrow), never color/glyph alone. The brand-fill `text-white` on `#676EB4`
  is the known-good control pairing the band's `＋ Add video` already ships; the eyebrow/body ink on
  the white card is AA.
- The thin cap is `aria-hidden` (decorative). Removing the card when empty removes an empty landmark
  rather than presenting a blank card. Removing the "no video" badge removes a per-row label but the
  count badges (with their `sr-only` words) are unchanged where present.
- **No gold** encodes any state. No new motion (instant in-place re-render — the skin-toggle posture).

---

## 7. What Development builds

1. **`Infobox.tsx`:** thin `aria-hidden` `bg-brand` cap in place of the wordmark header; **remove** the
   status-indicator block and the Browse/Jump action; **remove** the now-unused props (`onBrowse`,
   `hasUnderlyingSuggestions`, `overridden`, `onToggleOverride`, `onAdd`); add the empty-card guard
   (§3.5 — return null when the body would be empty). Keep counts + curator foot + error floor.
2. **`GeneralStrip.tsx`:** new props `complete`, `overridden`, `onToggleOverride`,
   `hasUnderlyingSuggestions`; render the trailing toggle `<li>` (§4.2) when
   `complete && hasUnderlyingSuggestions`; include that in the scroll-row render gate so the minimal
   band shows the lone toggle (§4.3). Non-complete render is unchanged.
3. **`TopicView.tsx`:** stop passing the removed Infobox props; pass the four new strip props; change
   the band-omission condition so the band is kept when there are underlying suggestions to offer the
   toggle (§4.3); drop `browseVideos` if it becomes unused.
4. **`Toc.tsx`:** remove the `no video` else-branch badge (§5); update the comments to state current
   behavior (directive, not history).
5. **Docs:** update `docs/TOPIC_PAGE_DESIGN.md` where it describes the Overview card's header / the
   marked-complete indicator placement / the TOC "no video" badge, to match this spec.
6. **Screenshots:** refresh the affected scenes (complete-topic Overview card + strip; the minimal
   zero-video band; the TOC). Add a scene for the strip's trailing toggle if the catalog lacks one.

## 8. Acceptance criteria (Phase-4 testable)

1. **AC1** — The Overview card header renders as a thin indigo bar with **no text**; the strings
   "＋plus" / "on this topic" do not appear in the card.
2. **AC2** — The Overview card never renders the "Marked complete" notice block, the "Show suggestions
   anyway" button, or an "Add a video" button (in any viewer state).
3. **AC3** — The Overview card never renders a "Jump to videos" / "Browse suggested videos" button
   (in any state).
4. **AC4** — A **logged-out** viewer sees **no** "Add a video" affordance anywhere on the page on a
   complete topic; a **signed-in** viewer still sees `＋ Add video` in the strip "Find more" cluster.
5. **AC5** — On a complete topic with curated videos **and** underlying suggestions, the strip renders
   a trailing toggle card (`Show suggestions anyway`) as the **last** item of the scroll row; it adds
   no element below the row.
6. **AC6** — Activating the toggle reveals the suggestion presentation in place (no reload) and flips
   the label to `Hide suggestions again`; activating again restores suppression. (Session-local,
   per-topic — unchanged from topic-complete §4.)
7. **AC7** — On a complete topic with **no** underlying suggestion (fully-curated), the toggle is
   **not** rendered.
8. **AC8** — On a complete topic with **zero curated videos** and ≥1 underlying suggestion, the band
   renders a minimal face containing the lone toggle card; a signed-in curator's Overview card shows
   the cap + `Reopen to suggestions`; a logged-out reader's Overview card does **not** render.
9. **AC9** — On a topic that is **not** complete, the Overview card (counts + signed-in mark control)
   and the General strip render unchanged (no toggle card; no behavioral change).
10. **AC10** — A TOC section row with zero curated and zero suggested videos shows **only its title**
    (no "no video" badge); count badges are unchanged where a row has them.
11. **AC11** — Accessibility: the toggle is keyboard-operable with a visible focus ring, its state is
    text-labeled (never color alone), and AA contrast holds on the rendered surfaces; no gold signal.
