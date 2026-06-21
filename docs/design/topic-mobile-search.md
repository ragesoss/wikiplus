# Design spec: the expanded mobile-search state on the Topic header (collapse-the-neighbours fix)

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written
**before** implementation) · **Phase:** prototype · **Branch:** `topic-mobile-search-fix`
**Fixes:** the broken *expanded* `topic-disclosure` search state on the narrow (`< md`) Topic header.
**Builds on:** [`docs/design/shared-header.md`](shared-header.md) (the universal header geometry §3,
every-state matrix §5, a11y §7) and [`docs/design/navbar-topic-search.md`](navbar-topic-search.md)
(`TopicSearch` states S0–S8, the APG combobox model, verbatim microcopy).
**Inherits, does not re-specify:** the `TopicSearch` keyboard/listbox model, the `AuthControl` skins,
the `HeaderProjector` tier/squeeze mechanics — this spec composes those existing parts; it adds no
new component, no new variant, no new copy.
**Components in scope:** `components/header/SiteHeader.tsx` (`TopicSiteHeader` chrome row — hosts the
chrome-row "+" `GlyphTile` home link while expanded), `components/search/TopicSearch.tsx`
(`topic-disclosure` variant), `components/wordmark/HeaderProjector.tsx` (suppressed while expanded) +
the existing `GlyphTile` mark it reuses, `components/auth/HeaderAuth.tsx` +
`components/auth/AuthControl.tsx` (`topic-compact` skin).
**Hands off to:** Development (build) → QA & Review verifies the AC + UX evaluates the built header.

> **What this spec is.** The buildable contract for ONE narrow-header state — the search disclosure
> while it is **expanded** below `md` (768px). The collapsed magnifier state is correct and unchanged;
> the `≥ md` inline field is unchanged. The fix is a small, legible extension of the existing
> `TopicSiteHeader` chrome composition: while the field is open on a narrow header, both of the
> field's neighbours collapse to glyphs so the field gets room and overlaps neither.

---

## 0. Summary of the load-bearing decisions (read this first)

The calls Dev builds to. Each is justified in the section cited.

| Decision | Call | Where |
|---|---|---|
| **When the collapse applies** | A single derived condition `narrowSearchExpanded` = (`< md`) **AND** (the `topic-disclosure` field is expanded). Drives BOTH neighbour collapses. The collapsed magnifier state is untouched; `≥ md` is untouched. | §3.1 |
| **Wordmark while expanded** | Show the existing **`GlyphTile` "+"** tile (the same indigo "+" mark the `< 380px` squeeze renders), hosted as a **chrome-row flex child in the MIDDLE** (between the search field and the login) for the whole duration the field is open; the **projector-layer wordmark — lockup, beam, AND glyph — is suppressed** while expanded so it never sits behind the open field. Reuses the existing mark (no fork), stays the `<a href="/">` "wiki+" home link. | §3.2 |
| **Login while expanded** | Force the **icon-only "W"** form of the `topic-compact` login: hide the visible "Log in" / username text, keep the `WikiGlyph` "W" (logged-out) or the avatar initial (logged-in) + `▾`. Accessible name stays the full phrase. | §3.3 |
| **Row order** | Fixed left→right: **search field (LEFT) · wordmark "+" glyph (MIDDLE) · login "W" (RIGHT)** — the same order as the collapsed header (magnifier → wordmark → login). The field is the **leftmost** element, anchored at the chrome row's left edge, and flexes rightward toward the glyph. No overlap from ~320px up to `< 768px`. | §3.4 |
| **The close affordance** | Keep the existing ✕ button, restyled to a proper **44×44** target, placed at the **right end of the field** (still inside the search slot, to the **left of** the "+" glyph). | §3.5 |
| **Transition** | Field width grows / glyphs settle in **~150ms `ease-out`**, gated behind `prefers-reduced-motion: no-preference` (reduced motion = end-states, no tween). Focus management is the existing #12 behaviour, preserved. | §5 |

---

## 1. Persona & story served + the problem

### 1.1 The persona

**Rosa — the reader on a Topic page (phone).** (Primary reader persona, `shared-header.md` §1.1.)
She lands on a Topic page on a 390px phone and wants to jump to a different topic. She taps the
magnifier, the field opens, she types. **Cory — the curator** (`shared-header.md` §1.2) is the same
phone, signed in or trying to sign in; his login must stay reachable. **Pat** (§1.3) needs the
wordmark to remain a working home link at every width.

### 1.2 The user stories

- **R-search.** *As a reader on a phone, when I open the header search I want a field I can actually
  read and type into — not a field that runs under the "Log in" button or sits on top of the lit
  wordmark.* → §3 (the collapse) / AC1, AC2, AC4.
- **C-login.** *As a curator on a phone, even while the search is open I want my login/account control
  to stay present and operable — collapsed to its glyph is fine, gone is not.* → §3.3 / AC5, AC6, AC9.
- **P-home.** *As anyone, the wordmark must stay a real "wiki+" home link even when it has shrunk to
  the "+" tile.* → §3.2 / AC8.
- **R-recover.** *As a reader, closing the search must take me straight back to the clean collapsed
  header with the magnifier — and put my focus back where I started.* → §3.5 / §5.2 / AC10.

### 1.3 The problem (the broken state, reproduced)

On the Topic header below `md` (768px), the search is an icon-disclosure: a magnifier in the
upper-left chrome slot. Tapping it expands an inline field (`w-full max-w-[280px]`) plus a ✕, **in
place inside the left slot of the chrome row**, while the two neighbours keep their full-width forms.
Two collisions result:

1. **vs. the login button.** The expanded field wants up to 280px, but the auth control is
   right-anchored (`ml-auto`) in the SAME flex row and at `< md` shows the full `topic-compact`
   "Log in" label (logged-out) or "avatar + username" (logged-in). On a 390px viewport there isn't
   room, so the field runs under the login control.
2. **vs. the wordmark.** The lit projector beam keeps rendering behind the field, because the
   existing squeeze-to-glyph only triggers below `SQUEEZE_BREAKPOINT` (380px). Between 380 and 767px
   the gold beam cone shows through under the open field.

The committed broken baseline is `docs/design/ui-screenshots/topic-search-mobile-logged-out.png`
(390px): the field overlapping "Log in", the gold beam visible beneath it.

**The chosen direction (owner-decided; this spec designs WITHIN it, does not relitigate it):** when
the disclosure is expanded on a narrow header, collapse BOTH neighbours to glyphs so the field gets
room, keeping all three controls present and in a fixed order.

---

## 2. Where this lives — the existing chrome composition

The Topic header chrome row (`SiteHeader.tsx` → `TopicSiteHeader`) is, today, a single flex row
pinned to the top `SLIM_BAR_HEIGHT` (56px) of the band, **persistent across the scroll transition**
(#96 — the expanded search lives in this same 56px row at every scroll progress `p`):

```
header-chrome  ·  pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[1200px] items-center gap-3 px-5  ·  height 56
  ├─ [search slot]   pointer-events-auto flex min-w-0 shrink items-center      ← TopicSearch (disclosure < md)
  ├─ [title cue]     hidden …md:inline (slim state only; never visible < md)    ← not in play here
  └─ [auth slot]     pointer-events-auto ml-auto flex shrink-0 items-center     ← HeaderAuth → AuthControl(topic-compact)
```

The **wordmark is NOT in this row** — it is the `HeaderProjector` layer *behind* the chrome
(`z-0`, `pointer-events-none`), positioned by the live apex. So the row already owns search + auth as
their own boxes; the fix coordinates three things that today act independently:

1. the chrome row's `gap`/`flex` so the open field (leftmost) can flex rightward into freed space;
2. the `HeaderProjector` layer (suppressed while expanded — no lockup, no beam, no projector-layer
   glyph behind the field) **plus** the same `GlyphTile` "+" mark rendered as a **chrome-row flex
   child in the middle**, between the field and the auth slot;
3. the `AuthControl topic-compact` skin (so the login collapses to its glyph, right-anchored).

All three already have the pieces needed — the `GlyphTile` mark, the compact skin, the disclosure
expand/collapse + focus return. This spec is the **coordination contract** between them, driven by
one shared "the narrow search is open" signal.

---

## 3. The design contract

### 3.1 The trigger condition — exactly when each collapse applies

Define one boolean the header computes and shares:

> **`narrowSearchExpanded`** = the viewport is **`< md` (< 768px)** **AND** the `topic-disclosure`
> `TopicSearch` is currently **expanded** (its field is open).

- It is **false** in the collapsed magnifier state (the magnifier-only state is unchanged — AC3).
- It is **false** at **`≥ md`** at all times (the inline compact field is unchanged — AC11). The
  `topic-inline` field never expands/collapses; this signal cannot fire there.
- It drives **both** neighbour collapses (§3.2, §3.3) and the row layout (§3.4) together, so the two
  glyphs and the field appear/disappear as one coordinated change, never out of step.

**Mechanism note (no fork, no new component — Dev's wiring latitude).** `TopicSearch` owns the
`expanded` state internally today. The header needs to know it. The sanctioned options, in order of
preference:

- **(a, preferred)** Lift the open/closed signal to the header: have the `topic-disclosure`
  `TopicSearch` report its expanded state up (an `onExpandedChange` callback the header already
  passes alongside `prefill`), and the header sets `narrowSearchExpanded` from that **AND** a
  `< md` media-query check (the same `MD_BREAKPOINT = 768` pattern `HeaderAuth` already uses). The
  header then (i) passes a `suppressWordmark` (or equivalent) prop to its `HeaderProjector` so the
  projector layer renders nothing while expanded, (ii) renders the existing `GlyphTile` "+" home
  link as a chrome-row flex child between the search slot and the auth slot, and (iii) passes a
  `forceIconOnly` (or equivalent) prop to its `AuthControl`/`HeaderAuth`. This keeps the composition
  logic in the header, which already coordinates these slots.
- **(b)** A CSS-only coordination if Dev can express "narrow + open" as a class on the chrome row
  (e.g. the disclosure sets a `data-search-expanded` attribute on a header ancestor at `< md`), with
  the projector-suppression, the chrome-row glyph, and the auth-icon states gated by that attribute +
  a `max-width: 767px` media query. Acceptable if it produces the identical end-states; the
  React-prop path (a) is cleaner given the glyph/skin choices live in component logic, not pure CSS.

Either way the **end-states in §3.2–§3.5 are the contract**; the plumbing is Dev's call.

**Interaction with the existing 380px `SQUEEZE_BREAKPOINT`.** The projector wordmark already
collapses to the glyph below 380px *regardless* of search state (the DEFECT-A squeeze,
`HeaderProjector.tsx`). That projector-layer squeeze is unchanged for the collapsed search state.
While `narrowSearchExpanded` is true, the **whole projector layer is suppressed** (no lockup, no
beam, no projector-layer glyph) and the same `GlyphTile` "+" mark is instead hosted in the chrome
row's middle (§3.2, §3.4). So at every narrow width, opening the field hides the projector wordmark
and shows the chrome-row "+" between field and login; closing it restores the normal `p`-driven
projector wordmark (full lockup/beam ≥ 380px, the projector squeeze glyph < 380px).

**Interaction with the #96 scroll-collapse (Tier-A → slim beam).** The expanded search lives in the
persistent 56px chrome row, which is present at every scroll progress `p`. Suppressing the projector
wordmark while expanded is **orthogonal to `p`**: `p` continues to drive the band height, but the
lit-lockup+beam layers simply do not render for the open duration, so the beam-fade tween has nothing
to fade — there is no double-render and no fighting between the two mechanisms. The chrome-row "+"
glyph lives in the 56px chrome row (`flex items-center`), so it is correctly vertically centred in
both the tall Tier-A band and the slim 56px bar without any `p`-dependent positioning. On close, the
normal `p`-driven projector lockup/beam returns at whatever scroll position the reader is at (full
beam if at top, faded if scrolled).

### 3.2 Wordmark behaviour while expanded → the "+" glyph, hosted in the chrome-row middle

While `narrowSearchExpanded` is true the wordmark shrinks to the **`GlyphTile` "+"** mark (the indigo
"+" zine tile, 28×28, 2px ink border, drawn white "+") — the SAME mark the `< 380px` projector squeeze
renders — but it is **hosted in the chrome row's MIDDLE**, between the search field (its left) and the
login (its right). **Do not build a new glyph** (AC1 / VISUAL_IDENTITY §10.1 no-fork): reuse the
existing `GlyphTile` component.

- **The projector layer is suppressed.** While the field is open the `HeaderProjector` renders
  **nothing** — no lit lockup, no beam, no cool flare, and no projector-layer squeeze glyph. This is
  what guarantees no gold beam and no stray mark sits *behind* the open field (problem #2 fixed).
- **The "+" mark is a chrome-row flex child in the middle.** The header renders the `GlyphTile` "+"
  inside a home-link anchor (`<a href="/" aria-label="wiki+">`) as a `shrink-0` flex child placed
  **after the search slot and before the auth slot** in the 56px chrome row. It is vertically centred
  by the row's `flex items-center` (no `p`-dependent positioning needed). The field (leftmost) flexes
  rightward up to this glyph; the login is to the glyph's right — see §3.4.
- It **is the home link** — `<a href="/" aria-label="wiki+">` (AC8), the same accessible
  "wiki+" → `/` link as the full lockup; only the host node and the visual shrink.
- **Node-identity note (focus).** In the collapsed state the "wiki+" home link is the projector-layer
  node; in the expanded state it is this chrome-row anchor. The home-link *node changes* across the
  open/close swap. This is acceptable: focus is never *on* the wordmark at the moment of the swap
  (open is triggered from the magnifier and lands in the field; close is triggered from the ✕ or
  Escape and returns to the magnifier trigger — §5.2), so no focused element is destroyed by the swap.
  The accessible name ("wiki+") and the target (`/`) are identical in both nodes, so the home link is
  continuously present and keyboard-reachable in each state. Dev should confirm no transient
  double-rendering of two "wiki+" links during the cross-fade (only one is in the DOM per state).
- On close, the projector wordmark returns to its normal `p`-driven lit lockup / beam (or the flat
  slim lockup if scrolled, or the projector squeeze glyph < 380px), with the standard beam transition;
  the chrome-row "+" home link is removed in the same frame.

> **Why the glyph in the middle, not a shrunk lockup or a moved field.** The owner's instruction is
> that the order must not change from the collapsed header: search, then wordmark, then login. The
> full lockup ("Wiki" + the "+plus" block) is ~150px+ wide with a full-bleed beam — there is no room
> for it beside an open field and the login on a 360px row. The `GlyphTile` "+" is the sanctioned
> minimal mark for exactly this "no room" case, so reusing it keeps the identity intact (still the
> indigo "+" tile, still the "wiki+" home link) while freeing the row. Hosting it as a chrome-row
> child (rather than leaving it in the projector layer at `leftInset`) is what lets it sit *between*
> the field and the login — the projector layer can only anchor the mark at the left, which would put
> the wordmark before the search and violate the required order.

### 3.3 Login behaviour while expanded → icon-only "W" / avatar

While `narrowSearchExpanded` is true, the single `AuthControl` (already `topic-compact` at `< md`)
renders **icon-only**:

- **Logged-out:** the existing login button with the **`WikiGlyph` "W"** visible, the visible word
  **"Log in" hidden**. The button keeps `min-h-[44px]` and must be at least **44×44** (a square
  touch target — see §3.4). Background/skin unchanged (`bg-brand text-white` on the cool field).
- **Logged-in:** the existing `SignedIn` compact control with the **avatar initial (28px circle)** +
  **`▾`** visible, the **username text hidden** for the open duration. The avatar + `▾` already form a
  ≥44px-high trigger; ensure the hit area is ≥44×44.
- **Loading:** the existing neutral pulse chip (unchanged; it already occupies the right slot at a
  fixed small size).

**The accessible name never degrades (AC6).** The login button keeps `aria-label="Log in with
Wikipedia"` even when only the "W" is visible — this is *already* how `topic-compact` works
(`aria-label={compact ? "Log in with Wikipedia" : undefined}`), and the icon-only state must preserve
it. The account trigger keeps `aria-label="Account: {username}"`. The hidden text is a *visual*
economy only; the meaning is always in the accessible tree (never icon-alone meaning loss).

**Mechanism.** `AuthControl topic-compact` already hides the username at `< sm` (`hidden sm:inline`)
and already carries the full `aria-label`. The new state extends that hiding:

- For **logged-out**, hide the visible "Log in" word while `narrowSearchExpanded` (e.g. wrap the word
  in a span that is hidden when the icon-only flag is set), keeping the `WikiGlyph` and the
  `aria-label`. This is a CSS/visibility swap — SSR/hydration markup is identical (same pattern as the
  existing responsive-label swap), so no flash.
- For **logged-in**, hide the username unconditionally while `narrowSearchExpanded` (it is already
  hidden `< sm`; this extends the hide up to `< md` for the open duration), keeping the avatar + `▾`
  + the `aria-label`.

The **Radix menu still opens** from the avatar trigger while collapsed to the icon — its items ("My
curations", "About your data", "Sign out") are unaffected; only the trigger's visible width shrinks.

### 3.4 Layout of the expanded row — provably no overlap

The boxes, left→right, in the 56px chrome row (`flex items-center`):

```
┌─ header-chrome (px-5 inset, 56px tall) ───────────────────────────────────────────────┐
│  ┌────────────── search field (flex-1) ──────────────┐ ┌─[✕]─┐  ┌──[+]──┐  ┌──[W]──┐   │
│  │ Search any Wikipedia topic…            [🔍]        │ │ 44  │  │ glyph │  │ login │   │
│  └─────────────────────────────────────────────────────┘ └─────┘  └───────┘  └───────┘   │
│  ← the open disclosure (field + submit + close) flexes →   wordmark   auth (icon)       │
│    field anchored at left edge                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
   left                                                                            right
```

**Order MUST remain: search field (LEFT) → wordmark "+" glyph (MIDDLE) → login "W" (RIGHT)** — the
same left→right order as the collapsed header (magnifier → wordmark → login). The reader's
left-to-right reading is `[Search…  🔍] [✕]  [+]  [W]`. The search field is the **leftmost** element,
anchored at the chrome row's left edge (the `px-5` inset, where the collapsed magnifier sits today);
the `GlyphTile` "+" home link is a chrome-row flex child in the middle; the login is right-anchored.

The contract, expressed as constraints Dev satisfies with the existing tokens:

1. **The search field is the LEFTMOST element, anchored at the chrome row's left edge.** The open
   disclosure container is the **first flex child** of the chrome row, starting at the `px-5` (20px)
   left inset — exactly where the collapsed magnifier sits today. Because nothing sits to the field's
   left anymore, the field's old `pl-[72px]` glyph-clearance is **removed** (it cleared a wordmark
   glyph that no longer sits to the field's left): the placeholder/typed text starts at the normal
   `pl-3` inside the field box. The field then flexes **rightward** toward the wordmark "+" glyph.

2. **The wordmark "+" glyph sits in the MIDDLE as a `shrink-0` chrome-row child**, after the field and
   before the login. It is the `GlyphTile` "+" home link (§3.2), a fixed ~28px graphic in a ≥44px tap
   box (constraint 3). The projector-layer wordmark is suppressed (§3.2), so this is the only "+" on
   screen — no mark behind the field.

3. **Minimum touch targets (44px).** The close ✕, the wordmark glyph link, and the login glyph button
   are each **≥ 44×44** hit targets (the glyph tile is a 28px graphic in a ≥44px tap box; the ✕ is
   restyled to 44×44 per §3.5; the login keeps `min-h-[44px]` and is made ≥44px wide). The field
   input keeps `h-9` visually but its tap target (the search-field box) spans the field height; the
   chrome row is 56px so there is vertical room.

4. **The field flexes to fill the freed space.** The expanded disclosure container is
   `flex min-w-0 items-center`; the `field` form's `max-w-[280px]` clamp is **removed** for the
   `topic-disclosure` expanded state (it was the cause of the field wanting a fixed 280px that ran
   under "Log in"). Instead the field is `flex-1 min-w-0` so it grows to exactly the space between the
   chrome's left edge and the wordmark "+" glyph, minus the ✕ and the gaps. On a 320px viewport this
   yields a field of roughly: `320 − 20 (px-5 left) − 44 (close ✕) − 8 (gap) − 44 (glyph box) − 12
   (gap-3) − 44 (login W) − 20 (px-5 right)` ≈ **128px** of field box; subtracting the field's own
   `pl-3`/`pr` insets and the inline 🔍 submit (~28px), the **typeable region is ≈ 128px** — wider
   than the prior layout because the field reclaims the ~72px that was the glyph-clearance inset
   (roughly +~70px of usable text width vs. the prior layout, which left only ~56–60px typeable at
   320px). On 390px the field box is ≈ 198px (typeable ≈ 168px); on 600px ≈ 408px; on 767px it is the
   full remaining width. Narrow but genuinely usable at 320px, and crucially **not overlapping**
   anything.

5. **Gaps.** The chrome row's existing `gap-3` (12px) separates the search slot from the wordmark
   glyph and the wordmark glyph from the auth slot. Inside the open disclosure, a small gap
   (`gap-1`–`gap-2`, 4–8px) separates the field from the ✕.

6. **No overlap, fixed order, ~320px → < 768px (AC2).** With the field as `flex-1 min-w-0` (it
   *shrinks* to fit rather than demanding a fixed width) and the wordmark glyph + the login as
   fixed-width `shrink-0` boxes in that left→right order, the flex row is mathematically incapable of
   overflow: the field absorbs all the slack and never pushes the glyph or login apart or under each
   other. Concretely `field.left ≤ glyph.left`, `field.right ≤ glyph.left`, and `glyph.right ≤
   login.left` at every width. This is the structural guarantee that replaces the broken
   fixed-`280px`-in-`ml-auto`-row layout.

### 3.5 The close affordance

Keep the existing ✕ button (it already exists, has `aria-label="Close search"`, and calls
`collapse()` which restores focus to the trigger). Restyle for the target size and placement:

- **Placement:** the **right end of the open field**, still **inside the search slot** — it is the
  last child of the disclosure container, so it sits to the field's right and **to the left of the
  wordmark "+" glyph** (the field+✕ disclosure is the leftmost flex child; then `gap-3`; then the
  wordmark glyph; then `gap-3`; then the auth slot). It dismisses back to the collapsed magnifier.
- **Size:** **44×44** (today it is `h-9 w-9` = 36×36, below the 44px target). Make it
  `flex h-11 w-11 shrink-0 items-center justify-center` (44×44) — matching the magnifier trigger's
  `h-11 w-11`.
- **Glyph + colour:** keep the `✕` (decorative, `aria-hidden`), `text-ink`, with a visible
  focus-visible ring (see §6). The accessible name stays **"Close search"** (verbatim, §4).
- **Behaviour (unchanged, preserve):** clicking it (or Escape while the listbox is closed) collapses
  the disclosure and returns focus to the magnifier trigger (the existing `collapse()` +
  `requestAnimationFrame(() => triggerRef.current?.focus())`).

---

## 4. Microcopy (verbatim — reuse, introduce nothing new)

All strings are inherited from `TopicSearch` (#12) and `AuthControl` (issue C). **No new copy.**

| Element | Accessible name / visible text | Source (verbatim constant) |
|---|---|---|
| **Search disclosure trigger** (collapsed magnifier) | accessible name **"Search topics"** | `DISCLOSURE_OPEN_NAME` |
| **Search disclosure close** (✕, expanded) | accessible name **"Close search"** | `DISCLOSURE_CLOSE_NAME` |
| **Search field** | programmatic name **"Search Wikipedia topics"** (`aria-label`; no visible label) | `LABEL_SR` |
| **Search submit** (🔍 inside the field) | **"Search"** | `SUBMIT_NAME` |
| **Search placeholder** | **"Search any Wikipedia topic…"** | `PLACEHOLDER` |
| **No-results hint** (in the listbox) | **`No matching articles — press Enter to open “{q}”`** | `noMatchHint(q)` |
| **Login (icon-only, logged-out)** | visible **"Log in" hidden**, only the "W"; accessible name stays **"Log in with Wikipedia"** | `AuthControl` compact `aria-label` |
| **Account (icon-only, logged-in)** | visible username hidden, only avatar + ▾; trigger accessible name stays **"Account: {username}"** | `AuthControl` `SignedIn` |
| **Wordmark "+" glyph (link)** | accessible name **"wiki+"** | `HeaderProjector` `accessibleName` default |

---

## 5. Transition + focus

### 5.1 Transition (respect `prefers-reduced-motion`)

The visible change on open is: the magnifier disappears, the field grows rightward from the left edge,
the projector wordmark (lockup/beam) gives way to the chrome-row "+" glyph in the middle, the login
swaps full-label → "W". To read as a deliberate reveal (not a pop):

- The **search field width** animates from collapsed (44px magnifier box) at the left edge, growing
  **rightward** toward its flexed width over **~150ms `ease-out`** (inside the project's 150–200ms
  window). The chrome-row "+" glyph and the login icon may **fade/cross-fade** (`opacity`, ~150ms) in
  as the projector wordmark and the full login label give way, so the change reads as one coordinated
  settle rather than three independent jumps.
- **Gate behind `@media (prefers-reduced-motion: no-preference)`** — the project's existing pattern.
  With **reduced motion**, apply the **end-states with no tween**: the field is at its flexed width
  immediately, the "+" glyph and the "W" appear at once, no width/opacity animation. The functional
  result (the field is usable, focus moves in) is identical; only the animation is suppressed.
- The wordmark's normal `p`-driven beam transition (#96) is untouched; while the field is open the
  projector layer is simply not rendered (the chrome-row "+" glyph is), so there is no competing
  animation.

### 5.2 Focus management (preserve the existing #12 behaviour — do not regress)

- **On open** (magnifier tapped / `#19` prefill auto-open): focus moves into the field
  (`inputRef.current?.focus()` via the existing `expand()` + the `expanded` effect). **Unchanged.**
- **On close** (✕ / Escape with the listbox closed): the disclosure collapses and focus returns to
  the magnifier **trigger** (`collapse()` → `requestAnimationFrame(() => triggerRef.current?.focus())`).
  **Unchanged.** Because closing also flips `narrowSearchExpanded` to false, the wordmark and login
  restore their full forms in the same frame — the reader lands back on the clean collapsed header
  with focus on the magnifier.
- The wordmark glyph link and the login control stay **keyboard-reachable in the expanded state**.
  Because the field is now the leftmost element, the expanded **Tab order follows the DOM left→right**:
  **search field → submit (🔍) → close (✕) → wordmark "+" glyph link → login control**. (DOM source
  order matches this visual order, so no `tabindex` reordering is needed.)
- **Node identity across the swap (§3.2).** The login/auth control is the same DOM node collapsed and
  expanded (only its visual form changes). The **"wiki+" home link is a *different* node** in the two
  states — projector-layer when collapsed, chrome-row child when expanded. This does not lose focus:
  at the instant of open, focus is in the field (not on the wordmark); at the instant of close, focus
  returns to the magnifier trigger (not the wordmark). So no focused node is destroyed by the swap,
  and a "wiki+" home link with the same name/target is continuously present in each state.

---

## 6. Accessibility

AA, focus, keyboard, text-labeled signals — re-asserted for this state.

- **No icon-alone meaning loss (AC6).** Every control that collapses to an icon keeps its full
  accessible name: login "W" → `aria-label="Log in with Wikipedia"`; account avatar → `aria-label="Account: {username}"`;
  wordmark glyph → `aria-label="wiki+"`; close ✕ → `aria-label="Close search"`; magnifier → `aria-label="Search topics"`.
  The `WikiGlyph`, the `GlyphTile` "+", the avatar initial, and the ✕ are all `aria-hidden` decorative
  marks; the name is on the control.
- **Colour is never the only signal.** The login is identified by its accessible name + the "W" glyph
  shape, not colour. Gold (the beam) is decorative and, crucially, is **not even rendered** in this
  state — it carries no meaning here. The Indigo Press palette stands: brand `#676EB4` (the "+" tile,
  the login fill), ink `#2C2C2C` (borders, the ✕); gold remains accent-only and unused as a signal.
- **Touch targets ≥ 44×44** for the magnifier, the ✕ (newly 44×44 per §3.5), the login button, the
  account trigger, and the wordmark glyph link.
- **Visible focus** on every control: the field's `.search-field:has(input:focus-visible)` brand
  outline (inherited), and a visible `focus-visible` ring on the ✕, the wordmark glyph link, and the
  login control. All must be visible against the cool `#fafbfe`/`--header-field` band.
- **Contrast (AA).** "+" glyph: white "+" on indigo `#676EB4` is the existing large-glyph pairing
  (decorative; the link's accessible text is the name). Login "W"/text: the issue-C verified
  `bg-brand` + white pairing. The ✕ `text-ink #2C2C2C` on `#fafbfe` ≈ 15:1.
- **Listbox anchoring (the suggestions popup).** The listbox is
  `absolute left-0 right-0 top-full` *within the field's `relative` wrapper*, so it anchors to the
  **field's own (now narrower) box** and follows the field's flexed width automatically — it is not
  anchored to the old 280px. Confirm it does not overflow the viewport right edge at 320px (it is
  `left-0 right-0` of the field, which is inset from the row edges, so it stays on-screen) and that it
  sits **above** the band (`z-50`, already set) so the curated content below is covered, not bleeding
  through.
- **Reduced motion** is honoured (§5.1).
- **Keyboard model unchanged** — the #12 combobox keyboard table (↓/↑ to move active option, Enter to
  select/submit, Escape to close listbox then collapse, Tab to move on) is inherited verbatim.

---

## 7. Responsive behaviour

| Range | Search | Wordmark | Login | Notes |
|---|---|---|---|---|
| **`≥ md` (≥ 768px)** | `topic-inline` compact field, **always inline, never a disclosure** | full lit lockup / beam (`p`-driven) | full `home` skin ("Log in with Wikipedia" / username) | **UNCHANGED by this work** (AC11). `narrowSearchExpanded` is structurally false here. |
| **`< md`, search collapsed** | magnifier icon (`h-11 w-11`) | full lit lockup / beam **OR** glyph below 380px (existing squeeze) | `topic-compact` ("Log in" + W / avatar + name) | **UNCHANGED** (AC3). The collapsed state is the FINE state. |
| **`< md`, search EXPANDED** | the field (**leftmost**, anchored at the left edge), `flex-1 min-w-0`, no `max-w-[280px]`, no `pl-[72px]`, + 44×44 ✕ at its right end | **"+" glyph in the MIDDLE** (chrome-row child between field and login) — projector layer suppressed (no lockup, no beam) | **icon-only** ("W" / avatar + ▾), right-anchored | **THE FIX.** Order: field · "+" · login. §3. |

- **Web-first, responsive.** Verified visually across ~320, 360, 390, 414, 600, 767px (all the open
  state) and a 768px+ check that the inline field is unchanged.
- **`≥ md` is explicitly out of scope and must not change** (AC11): the inline compact field, the full
  lit lockup, and the full login label all render exactly as today. The collapse machinery is gated to
  `< md` AND expanded.

---

## 8. What Development should build (hand-off summary)

1. **One shared signal `narrowSearchExpanded`** (§3.1): `< md` AND the `topic-disclosure` field is
   open. Wire it (preferred: the disclosure reports its expanded state up; the header combines it
   with a `MD_BREAKPOINT` media check and passes `suppressWordmark`/`forceIconOnly` down). No new
   component, no new variant, no fork.
2. **Wordmark → "+" glyph in the chrome-row middle while expanded** (§3.2): suppress the
   `HeaderProjector` layer entirely (no lockup, no beam, no projector-layer glyph) while expanded, and
   render the existing `GlyphTile` "+" mark inside a `<a href="/" aria-label="wiki+">` home link as a
   `shrink-0` chrome-row flex child placed **between the search slot and the auth slot**. Reuse the
   existing `GlyphTile` mark — no fork. Restores the projector wordmark on close. The home-link node
   differs between collapsed (projector layer) and expanded (chrome row); that is fine for focus
   (§3.2 / §5.2 node-identity note).
3. **Login → icon-only while expanded** (§3.3): in `AuthControl topic-compact`, hide the visible "Log
   in" word (logged-out) / username (logged-in) while the flag is set, keep the `WikiGlyph`/avatar +
   `▾` and the full `aria-label`. CSS/visibility swap (no hydration flash). Stays right-anchored.
4. **Row layout** (§3.4): in `TopicSearch` `topic-disclosure` expanded, make the field the **leftmost**
   element anchored at the chrome's left edge — drop the field's `max-w-[280px]` clamp AND its
   `pl-[72px]` glyph-clearance (no glyph sits to its left anymore), make the disclosure container
   `flex min-w-0` and the field `flex-1 min-w-0` so it flexes **rightward** toward the middle "+"
   glyph; the login is right-anchored. Structural no-overlap guarantee (the field shrinks; the glyph
   and login are `shrink-0`, in the order field · "+" · login).
5. **Close ✕ → 44×44** (§3.5), right end of the field, keep "Close search" + the focus-return
   behaviour.
6. **Transition** (§5.1): ~150ms `ease-out` field-grow + glyph/icon cross-fade, gated behind
   `prefers-reduced-motion: no-preference`; reduced motion = end-states.
7. **Focus** (§5.2): preserve the existing expand-into-field / collapse-to-trigger behaviour exactly.
8. **A11y** (§6): all collapsed-to-icon controls keep full accessible names; ≥44px targets; visible
   focus; AA; listbox anchors to the narrower field.
9. **Do not touch** `≥ md` (AC11), the collapsed magnifier state (AC3), the `≥ lg` seam-on-divider,
   the #96 scroll transition, or the article body.
10. **Screenshots:** refresh the `topic-search` scene (and add open-state coverage if useful) per the
    committed baseline gallery workflow; the broken baseline
    `docs/design/ui-screenshots/topic-search-mobile-logged-out.png` must be replaced by the fixed
    layout, and a **logged-in** open-state shot should be added (the catalog `topic-search` scene is
    currently `auth: ["out"]` only — extend it to `["out","in"]` so the icon-only avatar state is
    captured).

---

## 9. Acceptance criteria (testable — one test per criterion)

Concrete enough for QA to write a test per criterion. "Expanded" = the `topic-disclosure` field is
open; "narrow" = a `< md` viewport (390px is the catalog mobile width; also check 320px and 360px).

- **AC1.** *No fork.* The fix reuses the existing `GlyphTile` "+" mark, the existing
  `AuthControl topic-compact` skin, and the existing `TopicSearch topic-disclosure` disclosure — no
  new header component, no new `HeaderProjector`/`AuthControl`/`TopicSearch` variant, no new wordmark
  mark. (Assert: the "+" rendered while expanded is the same `GlyphTile` component the `< 380px`
  projector squeeze uses — same indigo "+" tile — and the home link's `href="/"` + accessible name
  "wiki+" match the projector wordmark's.)
- **AC2.** *No overlap, fixed order, ~320–767px.* At 320px, 360px, 390px, and 600px with the search
  expanded, the search field (incl. the ✕), the wordmark "+" glyph, and the login control have
  **non-overlapping bounding boxes**, laid out left→right in the order **field+close (LEFT) · wordmark
  "+" glyph (MIDDLE) · login (RIGHT)**. (Assert via `getBoundingClientRect`: `field.left ≤ glyph.left`,
  `field.right ≤ glyph.left`, and `glyph.right ≤ login.left`; none overlaps. Also assert the field's
  left edge is at the chrome's left inset, i.e. it is the leftmost interactive box.)
- **AC3.** *Collapsed state unchanged.* At `< md` with the search **collapsed**, only the magnifier
  shows in the search slot; the wordmark and login render their normal (non-forced) forms for the
  width (full lockup/beam ≥ 380px; full `topic-compact` label/username). The collapsed-state markup is
  byte-for-byte what it is today.
- **AC4.** *No projector wordmark / beam while expanded.* At 390px (and at 320–767px) with the search
  **expanded**, the **projector layer renders nothing** behind the chrome — no lit lockup, no gold
  beam cone, and no projector-layer glyph — and the only "+" on screen is the chrome-row middle glyph.
  (Assert: no `[data-projector-beam]` / `.projector-beamfade` and no `[data-projector-squeeze]`
  element is rendered while expanded; exactly one `GlyphTile` "+" home link is present, in the chrome
  row between the field and the login.)
- **AC5.** *Login present + icon-only, logged-out.* At `< md` expanded, **logged-out**: the login
  button is present and operable, shows the **"W" glyph**, and its visible "Log in" text is hidden.
- **AC6.** *Accessible name preserved (both states).* The login button's accessible name is **"Log in
  with Wikipedia"** in BOTH the text form (collapsed) and the icon-only form (expanded). (Assert
  `getByRole("button", { name: "Log in with Wikipedia" })` resolves in both states.)
- **AC7.** *Account icon-only, logged-in.* At `< md` expanded, **logged-in**: the account control
  shows the **avatar initial + ▾** with the username text hidden; its accessible name stays
  **"Account: {username}"**; the Radix menu still opens with "My curations" / "About your data" /
  "Sign out".
- **AC8.** *Wordmark stays a home link.* While expanded the chrome-row middle "+" glyph is an `<a>` to
  `/` with accessible name **"wiki+"**, keyboard-focusable and Enter-activatable.
- **AC9.** *Field leftmost, usable, flexes — not fixed 280px, no `pl-[72px]`.* While expanded the
  field is the **leftmost** interactive box, anchored at the chrome's left inset, with **no
  `max-w-[280px]` clamp** and **no `pl-[72px]` glyph-clearance** (text starts at `pl-3`). Its rendered
  width grows with the viewport (wider at 600px than at 360px, ≈ +~70px more typeable than the prior
  clearance-inset layout at 320px) and it never crosses into the wordmark glyph. (Assert: the field's
  `max-width` is not 280px; the input's left padding is not 72px; `field.left` is at the chrome's left
  inset; and `field.right ≤ glyph.left` at every tested width.)
- **AC10.** *Close restores the clean header + focus.* Activating the ✕ (or Escape with the listbox
  closed) collapses the disclosure back to the magnifier, restores the wordmark to its full
  lockup/beam (or flat slim lockup if scrolled) and the login to its full label, and moves focus to
  the magnifier **trigger**.
- **AC11.** *`≥ md` unchanged.* At ≥ 768px the header search renders the **inline compact field**
  (not a disclosure); the wordmark renders its full lit lockup/beam; the login renders the full **"Log
  in with Wikipedia"** label / username — all exactly as before this change. (Assert no disclosure
  trigger exists ≥ md, and the inline field + full login render.)
- **AC12.** *Listbox anchors to the narrower field.* With the field expanded and a query typed, the
  suggestions listbox is positioned flush to the field's (now narrower) left/right edges (not a stale
  280px), stays within the viewport at 320px, and renders above the page content (`z-50`).
- **AC13.** *Prefill auto-open (#19) works in the fixed layout.* The article-not-found prefill that
  auto-opens the disclosure (`prefill` nonce) lands in the expanded state with the same no-overlap
  layout (AC2) and focus in the field.
- **AC14.** *44px targets.* The magnifier trigger, the ✕ close, the login control, the account
  trigger, and the wordmark glyph link each present a **≥ 44×44** hit target in the expanded state.
- **AC15.** *Reduced motion.* With `prefers-reduced-motion: reduce`, opening/closing the search
  applies the end-states with **no width/opacity tween**; the field is immediately usable and focus
  moves in.

---

## 10. Open questions flagged for Dev

- **DQ-1 — RESOLVED by the corrected layout (§3.2 / §3.4).** The earlier tightness — a field that had
  to clear a 64–92px wordmark-glyph inset on its left at 320px — no longer exists: the field is now the
  **leftmost** element anchored at the chrome's left edge, the projector-layer glyph is suppressed, and
  the "+" glyph lives in the chrome-row middle (a `shrink-0` box the field flexes *up to*, never
  *under*). The field reclaims the ~72px of former glyph-clearance, so the `pl-[72px]` is dropped and
  the typeable region at 320px is materially wider (≈ +~70px). No glyph-vs-field-left-edge crowding
  remains to resolve. (The only remaining narrowness is the intrinsic 320px budget, handled by the
  `flex-1 min-w-0` shrink in §3.4 constraint 4 — structurally cannot overflow.)
- **DQ-2 — signal plumbing (§3.1).** React-prop lift (preferred) vs. a CSS `data-` attribute. Either
  is acceptable if the §3.2–§3.5 end-states match; pick whichever is cleaner given the glyph/skin
  choices live in component logic.
- **DQ-3 — catalog `topic-search` scene auth arm.** The scene is `auth: ["out"]` today; extend to
  `["out","in"]` so the icon-only **avatar** expanded state (AC7) is captured in the gallery. Confirm
  the `revealMobileSearch` prepare step still resolves (it clicks "Search topics" then waits for
  "Close search" — both names are unchanged).
