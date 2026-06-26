# Design spec: the "show suggestions anyway" toggle lives in the plus rail

**Status:** current placement contract for the marked-complete per-viewer reveal. Supersedes the
*placement* decisions in `topic-complete.md` §4.1 (the ＋plus status indicator) and
`overview-card-cleanup.md` §4 (the General strip's trailing scroll-row item). The override's
**mechanics** — session-local, per-topic, client-only; the label/aria copy; the honest framing — are
unchanged from those specs; only **where the toggle renders** changes.

## 1. Problem / value

A topic a curator has marked **complete** (closed to suggestions) suppresses the suggestion layer for
every viewer; any viewer can opt back in for their own session with the **"show suggestions anyway"**
reveal. That reveal had ridden the **General strip** as the trailing item of its horizontal scroll
row. The strip is the topic's video showcase — a per-viewer, complete-state control sitting *among the
videos* competes with the content for attention and entangles the toggle with the strip's tile/scroll
layout. The plus **rail** — the right-hand column of section-anchored video cards, below the strip — is
the natural home: it is where the suggestion cards themselves live, so the control that reveals them
belongs at the head of that set, not inside the showcase band.

**Value:** the strip stays a clean video showcase; the reveal sits with the suggestion content it
governs; the toggle is decoupled from the strip's layout (so the strip can evolve independently).

## 2. The decision — placement

The toggle is a **card in the plus rail** (`<aside>` of curated/suggested video cards, below the
General strip — the same column as `ClipCard` / `CandidateCard` / `CandidateSetHeader`):

- **After the last curated (section-anchored) video card**, when the rail has ≥1 curated card — i.e.
  immediately after the `ClipCard` group and **before** the `CandidateSetHeader` + suggestion cards.
  When the viewer overrides and suggestions reveal, the toggle therefore sits as the divider between
  the curated cards above and the revealed suggestion set below.
- **At the top of the rail**, when the rail has **zero** curated cards (every curated clip is a General
  overview that lives in the strip, or the topic has no curated videos at all). "After the last
  curated card" and "top of the rail" are the **same DOM position** — directly after the curated-card
  group — so one placement satisfies both: it is naturally the rail's first item when there are no
  curated cards.

It is **not** in the General strip and **not** in the ＋plus Overview card.

## 3. Form + microcopy (unchanged copy, rail-card styling)

A full-width **rail card** in the hardbox language, matching the rail's other cards (light page
surface, not the indigo band): `border-2 border-hardbox bg-surface-raised` + a `border-l-4
border-l-brand` accent rule + the `2px 2px 0 hardbox-offset` offset shadow. A vertical column:

- **Eyebrow:** `✓ Marked complete` — the `✓` is `aria-hidden`; the **word** carries the meaning.
- **Body line (verbatim):** *"A curator marked this complete, so suggestions are hidden."* — the honest
  framing (a curator's judgment + the mechanical effect, plainly). **Same in both override states** (the
  topic is still complete; only the button reflects the viewer's reveal).
- **Toggle button** — a plain `<button type="button">`, **never** `role="switch"`/`aria-pressed` (the
  label states the action), `min-h-[44px]`, full card width:

  | Override state | Visible label | `aria-label` |
  |---|---|---|
  | off (default — suppressed) | `Show suggestions anyway` | `Show suggestions for this topic in this session` |
  | on (overridden — shown) | `Hide suggestions again` | `Hide suggestions again — return to the complete view` |

  Off = **brand-fill** (`bg-brand text-white` — the live reveal path, the one click the spec wants
  discoverable). On = quieter **raised/white** (`bg-surface-raised text-ink-plus`).

## 4. When the toggle renders

- **Render iff `closedToSuggestions && hasUnderlyingSuggestions`** — the topic is marked complete AND
  has ≥1 underlying suggestion to reveal (`liveCandidates.length > 0`, computed as if the flag were
  off). When a complete topic genuinely has **no** suggestion to reveal, the toggle is **omitted**
  everywhere (it never promises a reveal it can't deliver — `topic-complete.md` §4.4). This holds
  whether or not there are curated videos.
- **Not complete:** the toggle never renders; the rail (and the whole page) is byte-for-byte its
  not-complete self (the established read-path guarantee).

## 5. The General strip after the move (what leaves)

- The strip **no longer renders** the completion toggle, its "Marked complete" card, or the
  **minimal-band** face that existed only to host the lone toggle at zero curated videos.
- On a complete topic with **zero General-overview curated videos and suppressed suggestions, the
  General band is omitted** (it has nothing to show) rather than rendered as a near-empty shell — the
  reveal now has its home in the rail. The band still renders normally whenever it has General curated
  videos (or a candidate fetch is in flight).
- The strip's `suppressed` behavior is **unchanged**: on a complete topic the curator find-more cluster
  (Search-platform links + ＋ Add video) stays hidden — a finished topic offers no "add more".

## 6. Behavior (unchanged mechanics — `topic-complete.md` §4.2)

Activating the toggle flips the existing **session-local, per-topic, client-only** override
(`sessionStorage`, QID-keyed — never a DB write, never read-path HTML variance). The page **re-derives
in place** (no reload, no remount): with the override on, every suppressed surface (General band
candidate tiles, the rail `CandidateSetHeader` + candidate cards, the "Suggested · uncurated" divider,
the dashed TOC counts) reappears exactly as if the flag were off; off again restores suppression.
**Focus stays on the button** (the same node). It works **logged-out** (client-only, no auth). The
signed-in curator's mark/reopen control (the ＋plus Overview card foot) and the rest of the rail are
unchanged.

## 7. States + accessibility

| State | Rail render |
|---|---|
| complete, ≥1 underlying suggestion, ≥1 curated rail card, **override off** | curated `ClipCard`s → **toggle card ("Show suggestions anyway")**; suggestion set suppressed |
| same, **override on** | curated `ClipCard`s → **toggle card ("Hide suggestions again")** → `CandidateSetHeader` → candidate cards |
| complete, ≥1 underlying suggestion, **zero curated rail cards**, override off | **toggle card** is the rail's first/only item |
| complete, **zero** underlying suggestions | **no toggle** (rail is its fully-curated / empty self) |
| not complete | **no toggle** (rail unchanged) |

**Accessibility (AA baseline):** native keyboard-operable `<button>` (Enter/Space), the project
`:focus-visible` ring; the brand-fill button is white-on-`#676EB4` (≥4.5:1, AA for the bold label) and
the raised/white state is ink-on-white; **no gold** carries the toggle state (the word + button
treatment do); the eyebrow `✓` is `aria-hidden`. The card adds no heading (it is a control, not a
section); it does not register as a scroll-sync rail item (no `sectionSlug`), so article⇄rail sync
ignores it.

## 8. Acceptance criteria (testable)

- **AC1** — On a marked-complete topic with ≥1 underlying suggestion, the reveal toggle renders in the
  **plus rail**, and **not** in the General strip and **not** in the ＋plus Overview card.
- **AC2** — With ≥1 curated rail (section-anchored) card present, the toggle renders **after the last
  curated `ClipCard`**; with zero curated rail cards, it renders at the **top of the rail** (same DOM
  position).
- **AC3** — The card shows the `✓ Marked complete` eyebrow (✓ `aria-hidden`) + the verbatim body line,
  identical in both override states.
- **AC4** — Label + `aria-label` flip per the §3 table across the override state.
- **AC5** — Activating it flips the session-local, per-topic, client-only override: no DB write, no
  reload; suppressed suggestion surfaces reappear/return in place; reversible; focus stays on the
  button; works logged-out.
- **AC6** — The General strip renders **no** completion toggle/minimal-band; a complete topic with zero
  General curated videos + suppressed suggestions **omits** the band; the strip's `suppressed`
  find-more hiding is unchanged.
- **AC7** — A complete topic with **zero** underlying suggestions shows the toggle **nowhere**.
- **AC8** — A **not-complete** topic renders no toggle anywhere (read-path parity).
- **AC9** — a11y: native `<button type="button">` (no `role=switch`/`aria-pressed`), keyboard-operable,
  AA contrast, no gold encoding the state.
