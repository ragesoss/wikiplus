# Design spec: Navbar topic search — type a title, open its Topic page

**Issue:** [#12](https://github.com/ragesoss/wikiplus/issues/12) · **Type:** build (discovery — client-side search input)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/navbar-topic-search.md` (4 Decisions + 13 ACs)
**Feeds:** Development (build) · **Evaluated by:** UX (built-UI pass) + QA & Review (correctness + a11y)
**Inputs read:** Product spec (above) · `docs/TOPIC_PAGE_DESIGN.md` §5.1 (two-world header, tight Wiki side) · `docs/design/topic-page-v1.md` §5.1/§11/§12 · `mockups/` · the two host surfaces `app/page.tsx` + `components/topic/TopicHeader.tsx` · `lib/wiki/topicRoute.ts` (the `topicHref` seam) · `app/globals.css` (Indigo Press tokens, focus ring, `.input`/`.field`)

---

## Framing — one component, two hosts, zero new infra

This is the product's **front door**. Today every surface dead-ends for an arbitrary topic
(home lists three seeded cards; the Topic header has no search; `/contribute` wants a raw QID).
The design is deliberately small because the routing is already shipped: the component is **a
labeled input + an inline suggestion list that navigates to `topicHref(title)`** (Decision 3).
It writes nothing, opens no `/contribute`, introduces no server, secret, or new error screen.

I design **one reusable component, `TopicSearch`**, placed on both hosts (Decision 1). Its visual
chrome adapts per host (full-width on the home header; tight and Wiki-side on the Topic header),
but the **markup, roles, keyboard model, and behavior are identical** — the cheapest thing to test
once, and the thing QA drives from each surface for AC4.

**The single most important behavioral guarantee:** a non-empty submit **always** navigates to a
Topic page; suggestions are an enhancement, never a gate. The Topic page (already shipped) owns the
"does this article exist" answer. The search never strands the user.

---

## Personas & user stories served

Two existing personas (from `docs/design/topic-page-v1.md` and the bare-path spec), no new ones.

### Persona A — **The reader arriving by name** ("I just want to get to a topic")
Lands on home, or is already reading a Topic page, and wants *a specific topic by its name* —
the way every wiki behaves. Doesn't know or care about QIDs. May type fast, may misspell, may
be on a phone, may use a screen reader or keyboard only.

- *As a reader on the home page, I want to type a topic name and go straight to its Topic page,
  so the seeded cards are examples rather than the only door.* **(AC1, AC4)**
- *As a reader who is unsure of the exact title, I want suggestions to appear as I type so I can
  pick the right article without typing it all or guessing capitalization.* **(AC2)**
- *As a reader reading one topic, I want to jump to another topic without going back home, so
  exploring related subjects is one move.* **(AC4 — topic-header host)**
- *As a reader who typed a name with a space (`San Francisco`), I want to land on the right page
  with a clean URL, not a broken or `%20`-mangled one.* **(AC3)**
- *As a keyboard-only reader, I want to Tab to the search, type, arrow through suggestions, and
  Enter to go — with a focus indicator I can always see — never needing a mouse.* **(AC11)**
- *As a screen-reader reader, I want the field announced as a search, and to hear suggestions
  appear and which one is active as I arrow, so the dropdown isn't invisible to me.* **(AC13)**
- *As a low-vision reader, I want the input text, placeholder, label, and suggestions to be
  legible (real contrast), not pale-grey-on-white.* **(AC12)**

### Persona B — **The reader reaching for the long tail** ("the article that isn't a card")
Wants a topic that is **not** seeded and **not** yet curated — the whole point of "topics are
created on demand." Today they can only reach it by guessing a URL or knowing the QID.

- *As a reader, I want to type any Wikipedia article name and land on its Topic page — even one
  no one has curated — so wiki+ feels like "all of Wikipedia, plus," not three demos.* **(AC5)**
- *As a reader whose query has a typo or obscure phrasing (no suggestions), I want to still be
  able to press Enter and go, with a calm hint rather than a dead stop.* **(AC7)**
- *As a reader who fat-fingers an empty Enter, I want nothing jarring to happen — focus stays put,
  no blank page.* **(AC8)**

> These stories feed Product's acceptance criteria (already written in the spec) — they are not
> re-stated as criteria here. The AC→design map at the end closes the loop.

---

## The flows

### Flow 1 — Type → suggestions → select → land on Topic page (the happy path)
1. Reader focuses the search input (Tab, or click/tap).
2. Reader types. After a **debounce** (≈200 ms idle), the component fetches Wikipedia typeahead
   suggestions (Decision 2; namespace 0; `Api-User-Agent`); the prior in-flight request is aborted.
3. Suggestions render as a listbox under the input (≤ 7 rows; upstream order, no re-ranking).
4. Reader arrows down to a row (or hovers) — that row becomes the **active option** (`aria-
   activedescendant`, visible highlight). Enter (or click/tap) **selects** it.
5. Component calls `router.push(topicHref(<that suggestion's exact title>))` → `/topic/<Title>/`.
6. The Topic page loads (existing loading → curated/empty flow). Done.

### Flow 2 — Type → submit raw text (create-on-demand; suggestions optional)
1. Reader types a title and presses **Enter while no suggestion is active** (or activates the
   search button) — having never opened or selected a suggestion (works even if suggestions are
   slow, empty, or the fetch failed).
2. Component **trims** the value; if non-empty, calls `router.push(topicHref(<typed text verbatim>))`.
3. If the title is seeded → curated Topic page. If not → the **existing empty / zero-curation
   state** for that title (article + unvetted candidates + curation entry points). The topic
   "comes into existence" on first curation — no write happens here. **No QID in the URL.**

### Flow 3 — No-results path (non-blocking, still submittable)
1. Typeahead returns **zero** matches for the current query (typo / obscure / or the fetch failed
   and degraded silently).
2. The dropdown shows a **single non-interactive hint row** (not a selectable option) with the
   microcopy in §"Microcopy". It does **not** block submit.
3. Enter / search action still navigates to `topicHref(<typed text>)` (Flow 2 behavior). The
   landing Topic page handles a genuinely non-existent article via its existing loading→resolve
   path — **this feature adds no error surface.**

### Flow 4 — Empty / whitespace submit (graceful no-op)
1. Reader presses Enter (or the search action) with an empty or whitespace-only value.
2. Component trims → empty → **does nothing**: no navigation (no `/topic//`, no `/topic/%20/`),
   no toast, no error. **Focus stays in the input.**

---

## Component anatomy

```
TopicSearch (role=search landmark via the wrapping <form role="search"> + <label>)
├─ <label for="topic-search"> … (visible on home; sr-only on tight topic header)
├─ <input id="topic-search" role="combobox"        ← the searchbox/combobox
│        aria-expanded aria-controls=listbox-id
│        aria-activedescendant=opt-id|"" aria-autocomplete="list" />
├─ submit affordance (magnifier button, type="submit", accessible name "Search")
└─ <ul role="listbox" id="topic-search-listbox" aria-label="Article suggestions">   (when open)
   ├─ <li role="option" id="opt-0" aria-selected> Cat </li>
   ├─ <li role="option" id="opt-1"> Catalonia </li>
   └─ … OR a single non-option hint row (no-results, §Microcopy)
```

The listbox renders **only when open** (input focused, value non-empty, and there is something to
show — suggestions or the no-results hint). It is positioned directly under the input, full input
width, `z-50` (above the `z-40` sticky header). No portal needed at prototype scale.

---

## Every state (the buildable contract)

| # | State | Trigger | Visual | Listbox | Microcopy |
|---|---|---|---|---|---|
| **S0** | **Idle (empty)** | not focused / empty value | Input at rest, placeholder shown, magnifier icon | closed | placeholder (below) |
| **S1** | **Focused empty** | focus, value empty | Input shows **brand focus ring**; placeholder visible | closed (nothing to show) | placeholder |
| **S2** | **Typing / loading** | value non-empty, request in flight (post-debounce) | Input has value + focus ring; a small **busy affordance** (a 3-dot/spinner glyph, `aria-hidden`, *decorative*) at the input's trailing edge — never an error | open **iff** prior results still showing; otherwise closed until first results land | `aria-live` polite: silent during the in-flight gap (avoid chatter); announce on resolve (S3/S4) |
| **S3** | **Populated suggestions** | request resolved, ≥1 match | Listbox open, ≤7 rows; each row = article title (ink), optional short description (ink2) if the REST endpoint returns one | open, `role=listbox` w/ `role=option` rows | live: "N suggestions" (polite) |
| **S4** | **No results (non-blocking)** | request resolved, 0 matches **OR** fetch failed/timed out (silent degrade) | Listbox open with **one non-interactive hint row** (muted ink2, italic-or-plain, **not** a `role=option`, not arrow-focusable) | open, hint row only | hint copy (below); live: "No matching articles. Press Enter to open <typed text>." |
| **S5** | **Suggest error / silent degrade** | fetch rejects/aborts/timeouts | **Identical to S4** — there is **no error UI**. The component degrades to the submit-the-typed-title path. (Decision 2/4 etiquette.) | open, S4 hint row | same as S4 — no error string, ever |
| **S6** | **After select** | Enter/click on an active option | Listbox closes; input value set to the chosen title; component navigates | closed | live: (route change carries it; no extra announce needed) |
| **S7** | **After submit (raw)** | Enter/search action, non-empty trimmed | Listbox closes; component navigates to typed title | closed | none |
| **S8** | **No-op (empty submit)** | Enter/search action, empty/whitespace | **No change** — focus remains in input, listbox stays closed | closed | none (no toast) |

**Loading is never an error.** S2's busy glyph is decorative and `aria-hidden`; a failed suggestion
fetch routes to S4/S5 (a calm hint), **never** a red/error treatment. This is the binding etiquette
from Decision 2 ("never show an error UI for a failed suggestion fetch").

### Microcopy (exact strings — Dev: use verbatim)

- **Placeholder** (in the input): `Search any Wikipedia topic…`
- **Visible label** (home header): `Find a topic`
- **`aria-label` / sr-only label** (topic header, where the visible label is omitted to save
  space): `Search Wikipedia topics`
- **Submit button accessible name** (icon-only magnifier): `Search`
- **No-results hint row** (S4/S5, where `{q}` is the trimmed typed text):
  `No matching articles — press Enter to open “{q}”`
- **Polite live-region announcements** (sr-only, not visible):
  - on N≥1 results: `{N} suggestions available`
  - on 0 results / degrade: `No matching articles. Press Enter to open “{q}”.`
  - *Do not* announce during the in-flight gap (avoid chatter); *do not* ever announce an error.
- **Empty-submit:** **no copy at all** — a silent no-op is the correct, least-jarring response.

> Hint copy mirrors the Decision 4 example and is **non-blocking** — it tells the reader the Enter
> key still works. The quote marks make the typed text legible as "the thing you'll open."

---

## Placement & responsive behavior — both hosts

### Host 1 — Home header (`app/page.tsx`) — **the must-ship floor**

Today the home header is a thin `flex justify-between` row: `wiki+` wordmark (left) / `Contribute`
link (right). The search is the **primary entry** and the most acute gap, so it gets a **prominent,
always-visible** treatment — no collapsing.

- **Desktop / tablet (≥ sm):** a **second row directly under the wordmark row**, full container
  width (`max-w-5xl`, matching the page). Layout: a **visible `<label>` "Find a topic"** (small,
  ink2) above (or visually-hidden beside) a full-width input with a trailing magnifier submit
  button. The input is generously sized (`h-11`, `text-base`) — this is the hero affordance, so
  the seeded cards below read as *examples*. Suggestion listbox drops below it, container-width-
  capped (`max-w` matching the input).
- **Small screens (< sm):** unchanged structure — the search row is **full width** and stacks
  naturally above the heading and cards. Input remains `h-11`/`text-base` (comfortable tap target,
  ≥ 44px). Label may collapse to placeholder-only + `aria-label` if vertical space is tight, but
  the input itself never collapses or hides on home. **Home search never degrades to an icon.**
- **Must-ship floor (Product priority):** AC1–AC3, AC7–AC13 must pass on this host. If anything is
  cut, the home input is the last thing standing.

### Host 2 — Topic header (`components/topic/TopicHeader.tsx`) — **strongly preferred, degradable**

This is the **tight two-world header** (§5.1): 64px sticky, white, 2px ink bottom border, inner
grid `[1fr_360px]`. The **Wiki half must not be crowded** and the faithful-Wikipedia article column
must not be visually intruded upon. The ＋plus block already fills the right `360px` cell (and is
`hidden < lg`). So the search lives on the **Wiki (left) side**, designed to stay quiet.

The Wiki half today holds: serif **"Wiki"** wordmark + sublabel (left) and the article title (right,
`hidden < md`). The search must coexist without making the header feel like a toolbar.

- **Desktop (≥ lg):** an **inline compact search** sits in the Wiki half, **between** the "Wiki"
  wordmark/sublabel and the right-aligned article title. It is **`h-9`, `max-w-[280px]`**, single
  line, magnifier-leading, placeholder `Search any Wikipedia topic…`, **sr-only label**
  (`Search Wikipedia topics`) so no visible label text competes with the wordmark. The article
  title may truncate (`truncate`, `min-w-0`) to yield room — the search is the higher-value control
  here. The serif Wikipedia type system is **not** used for the search chrome; the search is plus-
  side UI (Open Sans), but kept visually quiet (no hardbox shadow — a plain 2px-ink-bordered field)
  so it doesn't read as a ＋plus zine block intruding on the Wiki column.
- **Tablet (`md`–`lg`):** the ＋plus block is hidden (`< lg`), freeing the row. Keep the inline
  compact search; the article title shows from `md` and truncates as needed. If the wordmark +
  search + title cannot all fit at the low end of this range, **drop the article title first**
  (it's the lowest-value element and already `hidden < md`), then the sublabel — **never** the
  search.
- **Small screens (< md): the degradable surface (Decision 1 fallback).** The header is height-
  constrained and the article title is already hidden. Ship a **labeled disclosure**: a magnifier
  **icon button** in the Wiki half (accessible name `Search topics`, `aria-expanded`) that, when
  activated, **expands the full search inline** — either pushing the header to a second row on the
  Wiki side, or replacing the wordmark row with the input + a close (`✕`, accessible name
  `Close search`) until dismissed. The expanded input is the **same `TopicSearch`** (same roles,
  same listbox, same keyboard model); only its trigger differs. On expand, **move focus into the
  input**; on close (Esc or ✕), **return focus to the trigger button**.
  - This icon-expand form is exactly the "graceful degrade" Decision 1 sanctions. **AC4 is verified
    against this shipped form** at `< md` — QA finds the labeled trigger (`getByRole("button",
    { name: /search/i })`), expands it, and AC1–AC3 pass through the revealed input.
  - **Do not** collapse to icon on the home header — only the topic header degrades; home is the floor.

> **Why the Wiki side, not the ＋plus cell?** The ＋plus `360px` cell already carries the brand
> hardbox identity block (and, in the empty state, the signed-in chip). Adding a search there would
> overload it and push it `hidden < lg` (the cell's existing behavior), losing search exactly where
> it's most useful on narrow screens. The Wiki side is present at every breakpoint, which is where a
> navigation control belongs.

### Shared responsive rules (both hosts)
- Input min tap target **≥ 44×44px** effective (`h-11` home / `h-9` topic with adequate padding;
  the topic icon-trigger button is ≥ 44px on touch).
- Listbox max-height caps at ~`60vh` with internal scroll if the (≤7) rows ever overflow a very
  short viewport; rows never clip the sticky header's bottom border.
- The sticky topic header is `z-40`; the open listbox is `z-50` so it overlays the article, never
  is overlapped by it.

---

## Accessible pattern (AC11–AC13) — the exact contract for QA

**Pattern chosen: editable combobox controlling a listbox popup, `aria-activedescendant` model**
(WAI-ARIA APG "combobox with list autocomplete"). This is the correct pattern for "type to filter,
arrow to a suggestion, Enter to choose" and gives screen readers the active-option announcement
AC13 requires. The simpler "labeled disclosure" is used **only** as the topic-header `< md` trigger
wrapper around this same combobox — the combobox itself is always the APG combobox.

### Roles & accessible names (so QA can `getByRole`)
- **Wrapper:** `<form role="search">` — establishes the search landmark.
- **Input:** `role="combobox"` (an `<input type="search">` is acceptable as the host element; the
  combobox role is applied to it). It is queryable as **`getByRole("combobox", { name })`**; the
  `<input type="search">` host also satisfies **`getByRole("searchbox")`** per the spec's AC11
  phrasing (`searchbox|combobox`). Accessible name comes from the visible `<label for>` (home) or
  `aria-label="Search Wikipedia topics"` (topic header).
  - `aria-autocomplete="list"`, `aria-expanded={open}`, `aria-controls="topic-search-listbox"`,
    `aria-activedescendant={activeOptionId || undefined}`.
- **Submit button:** `<button type="submit">` with accessible name **`Search`** (icon-only →
  `aria-label="Search"` or sr-only text). Queryable as `getByRole("button", { name: "Search" })`.
- **Listbox:** `<ul role="listbox" id="topic-search-listbox" aria-label="Article suggestions">`.
- **Options:** `<li role="option" id="opt-{i}">`, the active one carries `aria-selected="true"`.
  The **no-results hint row is NOT a `role="option"`** — it is a non-interactive `<li>` (or a
  `role="presentation"` note) so arrow keys skip it and a screen reader doesn't offer it as a choice.
- **Topic-header `< md` trigger:** `<button aria-expanded aria-controls="topic-search-listbox-or-
  region" aria-label="Search topics">`; on collapse the close control is `aria-label="Close search"`.
- **Live region:** a visually-hidden `<div role="status" aria-live="polite">` carries the result-
  count / no-results announcements (§Microcopy). One region, polite, text-only.

### Focus order
Tab order on the home header: `wiki+` wordmark → **search input** → **Search button** → `Contribute`
link → (page). On the topic header (≥ md): `wiki+`/Wiki wordmark area → **search input** → **Search
button** → (article). At `< md` the disclosure trigger sits in that same position; expanding moves
focus into the input. **The listbox options are NOT in the Tab sequence** — they are reached only
via Arrow keys while focus stays in the input (the `aria-activedescendant` model). This is
deliberate and APG-correct: Tab past the field goes to the next control, not into the options.

### Keyboard interactions (binding)
| Key | When | Behavior |
|---|---|---|
| **Tab** | input focused | move to the Search button / next control; **close the listbox** (do not select) |
| **↓ / ↑** | input focused, listbox open | move active option down/up; set `aria-activedescendant`; wrap or stop at ends (stop at ends preferred — no wrap); scroll the active row into view |
| **↓** | input focused, listbox **closed** but results exist | re-open the listbox, activate first option |
| **Enter** | an option is active | **select** it → navigate to that title (Flow 1); prevent form submit-of-raw-text |
| **Enter** | no option active, value non-empty | **submit raw typed text** → navigate (Flow 2); if value empty/whitespace → **no-op** (Flow 4) |
| **Escape** | listbox open | **close the listbox**, keep the typed value and focus in the input |
| **Escape** | listbox closed (topic-header expanded form) | collapse the disclosure, **return focus to the trigger** |
| **Home / End** | optional enhancement | jump active option to first/last (not required for AC) |

Mouse/touch: hover sets the active option (visual only is fine, but mirror it to
`aria-activedescendant` for consistency); click/tap selects (Flow 1). Click outside / blur closes
the listbox (Flow-preserving — does not navigate).

### Visible focus — not color alone (AC11, AC12)
- **Input focus ring:** reuse the committed global pattern — **`outline: 3px solid var(--color-
  brand) (#676EB4); outline-offset: 2px`** (already defined for `.input`/`.field` and `:focus-
  visible` in `globals.css`). A 3px outline + 2px offset is a **shape/size change**, perceivable
  without color (it is not *only* a hue shift) — satisfies "not color alone." The ring sits on the
  white field (contrast 4.70:1, above the 3:1 non-text-component floor — see §Tokens).
- **Active suggestion row (AC13 visible counterpart):** the active option is indicated by **(a) a
  background tint `#EEF0FB` (indigo-5), (b) a 3px solid brand left-bar, AND (c) `font-weight:600`
  on the title** — three signals, not color alone. Option text stays ink (`#2C2C2C`) on the tint
  (12.3:1). The brand left-bar is the non-color shape cue; the weight change is the second.
- **Submit button focus:** same `:focus-visible` 3px brand ring.
- The whole flow (focus input → type → arrow → select → submit) is operable **by keyboard alone**
  with a visible indicator at every step — AC11's literal requirement.

---

## Indigo Press tokens & WCAG AA (AC12)

All values are the committed tokens in `app/globals.css`. Gold `#E5AB28` is **not used**. Every
text pair below is **AA-normal (≥ 4.5:1)**; the focus ring (a non-text UI component) clears the
**3:1** UI-component floor. Ratios computed against the stated background.

| Element | Token (hex) | Background | Ratio | AA |
|---|---|---|---|---|
| **Input text** (typed value) | `ink #2C2C2C` | white `#FFFFFF` | **13.97** | PASS (normal) |
| **Placeholder** (`Search any Wikipedia topic…`) | `muted #717171` | white | **4.88** | PASS (normal) — *not* a pale `#9aa` grey |
| **Visible label** (`Find a topic`, home) | `ink2 #595959` | white | **7.00** | PASS (normal) |
| **Suggestion title text** | `ink #2C2C2C` | white (rest) / `#EEF0FB` (active) | **13.97 / 12.30** | PASS (normal) |
| **Suggestion description** (if shown, REST endpoint) | `ink2 #595959` | white | **7.00** | PASS (normal) |
| **No-results hint row** | `ink2 #595959` | white | **7.00** | PASS (normal) — readable, not faint |
| **Magnifier / submit icon (if it bears the only label visually)** | `action #1F6F95` | white | **5.58** | PASS (normal) — but it always also has an accessible name |
| **Field border** | `ink #2C2C2C` 2px | white | 13.97 | PASS (UI) |
| **Focus ring** | `brand #676EB4` 3px, offset 2px | white field | **4.70** | PASS (UI ≥3:1; the offset keeps the ring on white, not on the ink border) |
| **Active-row left bar** | `brand #676EB4` 3px | white/`#EEF0FB` | 4.70 / ~4.4 | PASS (UI ≥3:1) |
| **(Topic-header expanded ✕ / icon controls)** | `ink #2C2C2C` | white | 13.97 | PASS |

Notes for QA's contrast check (precedent: the chip-contrast approach in `lib/curation/labels.ts`):
- `muted #717171` is the **floor placeholder color** — it sits exactly at 4.88:1, comfortably AA.
  Do **not** lighten it. (A common a11y bug is a ~40%-grey placeholder that fails.)
- The brand focus ring's `outline-offset: 2px` is load-bearing for contrast: it keeps the ring
  separated from the 2px ink border by white space, so the governing comparison is brand-vs-white
  (4.70:1), not brand-vs-ink (2.97:1).
- Color is **never the sole carrier** of state: focus = ring (shape), active option = bar + weight
  + tint (three cues), no-results = explicit text. AC12's "not color alone" is met structurally.

---

## AC1–AC13 → design-coverage map

| AC | What the spec requires | Where this design covers it |
|---|---|---|
| **AC1** Submit a title opens its Topic page | Flow 2 + S7: Enter (no active option), trim → `router.push(topicHref(typed))`. Keyboard table row "Enter / no option active". |
| **AC2** Selecting a suggestion opens that title | Flow 1 + S3 + S6: Arrow to option, Enter/click selects → `topicHref(suggestion title)`. Keyboard table "Enter / option active". |
| **AC3** Space-containing title routes via #11 encoding | Component passes the **raw title** to `topicHref`; encoding is `titleToSlug`'s job (space→`_`). Spec mandates "verbatim title to `topicHref`", never hand-encode. Flow 2 / Component anatomy. |
| **AC4** Works on the agreed surface(s) | §Placement: home header (always-visible) **and** topic header (inline ≥ md; labeled icon-disclosure < md). Same `TopicSearch` component; AC1–AC3 drivable from each host. Degraded form named for QA. |
| **AC5** Unseeded title still opens a working Topic page, no QID in URL | Flow 2 step 3: navigates to `/topic/<Title>/`; the **existing** empty/curated flow renders; component writes nothing and never injects a QID (URL is title-only by `topicHref` contract). |
| **AC6** No `/contribute`, no write on navigation | Framing + Flows: the only action on select/submit is `router.push(topicHref(...))`. Spec forbids `store.upsertTopic`/`addClip`/opening `/contribute`. Design introduces no write path or `/contribute` link. |
| **AC7** No-results hint, still submittable | S4 + Flow 3 + Microcopy: non-interactive hint row `No matching articles — press Enter to open “{q}”`; Enter still navigates (Flow 2). Hint is **not** a `role=option` (doesn't block). |
| **AC8** Empty/whitespace submit is a no-op | S8 + Flow 4: trim → empty → no navigation, focus stays in input, no toast. Keyboard table "Enter / value empty". |
| **AC9** Suggestions are an enhancement, not a gate | Flow 2 + S2/S5: submit works before suggestions resolve, with no suggestions, or after a failed fetch. Listbox options are **not** in the Tab path; Enter-without-active-option always submits raw. |
| **AC10** Debounce + abort + silent degrade | S2/S5 + Flows: ≈200 ms debounce before fetch; abort prior in-flight on query change; error/timeout → S4/S5 (no error UI). Etiquette stated as binding (Decision 2). |
| **AC11** Labeled + keyboard-operable + visible focus | §Accessible pattern: `<label for>`/`aria-label`; full Tab→Arrow→Enter→Escape model; `getByRole("searchbox"\|"combobox", { name })`; brand 3px focus ring (shape, not color-alone) on input and each active row. |
| **AC12** AA contrast + not color-alone | §Tokens (all text ≥ 4.5:1; ring ≥ 3:1 UI) + §Visible focus: focus = ring shape; active option = bar + weight + tint; no-results = text. Indigo Press tokens, gold unused. |
| **AC13** Suggestion list has correct semantics | §Accessible pattern: `role="listbox"` + `role="option"` rows + `aria-activedescendant` updated on Arrow; `aria-expanded` on the combobox; polite live region announces count / active. QA asserts roles + `aria-activedescendant` on arrow nav. |

---

## What is out of scope (mirroring the spec — do not build)

No `/search?q=` results page; no result-detail view; no own ranking/scoring (display upstream
order as-is); no non-Wikipedia search (clips/creators/candidates); no full-text/body search; no
`/contribute` QID coupling; no auth/persistence/history/recent/popular; no multilingual/cross-wiki.
Wikipedia **article titles only**, English Wikipedia.

---

## Hand-off to Development

Build **one reusable client component `TopicSearch`** per this spec + the Product spec
(`docs/specs/navbar-topic-search.md`, Decisions 1–4, AC1–AC13). Concretely:

1. **Behavior.** Debounced (≈200 ms) client fetch of Wikipedia typeahead suggestions (Decision 2:
   REST `search/title` preferred, `opensearch` fallback; namespace 0; reuse the `Api-User-Agent`
   pattern from `lib/wiki/article.ts`), abort-on-change, **silent degrade to S4/S5 on error** (no
   error UI ever). On select/submit, `router.push(topicHref(<title>))` (reuse
   `lib/wiki/topicRoute.ts` — pass the **raw title**, never hand-encode; AC3). Empty/whitespace
   submit = no-op (AC8). **No write, no `/contribute`, no QID in URL** (AC5/AC6).
2. **States.** Implement S0–S8 exactly, with the verbatim microcopy in §Microcopy. Loading is
   decorative + `aria-hidden`; never a red/error state.
3. **Accessible pattern.** APG editable-combobox + listbox with `aria-activedescendant`; roles,
   names, focus order, and the keyboard table are binding (AC11/AC13). Reuse the global brand 3px /
   2px-offset `:focus-visible` ring (AC12 "not color alone"). One polite `role="status"` live region.
4. **Placement.** Home header (`app/page.tsx`): always-visible full-width second row (the floor —
   AC1–AC3, AC7–AC13 must pass here). Topic header (`components/topic/TopicHeader.tsx`): inline
   compact field on the **Wiki side** ≥ md; labeled magnifier **icon-disclosure** < md (the
   sanctioned Decision-1 degrade — AC4 verified against the shipped form). Keep the ＋plus cell and
   the faithful-Wikipedia column un-crowded; the search is quiet plus-side UI (Open Sans, plain
   2px-ink field, no hardbox shadow), not a zine block.
5. **Tokens.** Use the committed `globals.css` Indigo Press tokens listed in §Tokens; gold unused.
   Placeholder is `muted #717171` (do not lighten). Reuse `.input`/`.field` styling where it fits.
6. **Tests** (Decision: Wikipedia calls mocked, no network in CI): Vitest/RTL component tests for
   AC1–AC3, AC5–AC13 driven from **both** hosts, plus a Playwright e2e for AC1/AC2/AC5. Query the
   control **by role/name** (AC11) and drive selection via keyboard (AC13 `aria-activedescendant`).

## Evaluation (UX built-UI pass, after Development)

Judge the running UI against this spec + the stories. Confirm:

1. **Both hosts.** Home shows an always-visible labeled search; the topic header carries it on the
   Wiki side (inline ≥ md, labeled icon-expand < md) without crowding the article column or the
   ＋plus block. (AC4, §Placement)
2. **The flows feel right.** Type → suggestions appear (debounced, no per-keystroke flicker) →
   Arrow highlights with a visible bar+weight cue → Enter lands on the Topic page. Raw Enter (no
   suggestion) lands too. (Flows 1–2, AC1/AC2/AC9)
3. **No-results / empty are calm.** Zero results shows the non-blocking hint and Enter still goes;
   empty Enter does nothing and keeps focus; a forced fetch failure shows the **same calm hint, no
   error UI**. (S4/S5/S8, AC7/AC8/AC10)
4. **A11y in practice.** Keyboard-only completes the whole flow with an always-visible focus ring;
   a screen reader announces the field as search, the result count, and the active option;
   `< md` icon-expand moves focus in and returns it on close. (AC11/AC13)
5. **Contrast & not-color-alone.** Placeholder, label, input, suggestion, and hint text meet AA on
   the shipped tokens; focus and active-option states read without relying on hue. (AC12, §Tokens)

A pass returns to the loop; any design defect routes back to **Development**.
