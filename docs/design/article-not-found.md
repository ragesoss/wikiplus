# Design spec — "No Wikipedia article by that title" (issue #19)

Buildable design contract for the **article-not-found** state: when a Topic URL carries a
well-formed but **nonexistent** Wikipedia title (e.g. `/topic/Asdfqwer`), the reader gets an
honest, distinct "there's no Wikipedia article by that title" page — **not** the transient
"Couldn't load the article · Try again" card, which implies a network blip and invites a
pointless retry.

This spec is the input to Development. It does not change schema, auth, or any Server Action,
and adds **no new data fetching** — the missing-page signal already exists in the resolve path
(`resolvePage` returns all-null / `titleToQid` returns `null` for a missing or red article;
`lib/wiki/article.ts`).

---

## 1. Personas & user stories

- **Reader (lands on a Topic URL).** Follows a mistyped, stale, or fabricated link — a typo
  (`/topic/Photosynthsis`), a red-link title, an old URL whose article was deleted/renamed.
  - *As a reader who hit a dead Topic URL, I want to be told plainly that no Wikipedia article
    has that title — so I don't think the site is broken and sit there re-clicking "Try again."*
  - *As a reader, I want an obvious way to search for the topic I actually meant — so a typo
    costs me one correction, not a dead end.*
- **Curator (followed a link to curate).** *As a curator, I want a dead title to send me back to
  search rather than imply a transient error, so I can find the right article and start curating
  there.*

### The distinction this spec turns on

| | **Article not found** (this spec) | **Transient article error** (existing) |
|---|---|---|
| Cause | Title definitively does not exist on Wikipedia | Network down / 5xx / fetch threw |
| Signal | `resolvePage` → all-null (no `pageid`, `missing` set) | `fetchFullArticle` rejected after the page **did** resolve |
| Is retrying useful? | **No** — the title will never resolve | **Yes** — the next fetch may succeed |
| Is there a `qid` / curation to show? | **No** — page never resolved, no rail | **Yes** — the plus rail stays useful |
| Surface | **Full-page** state (no split-pane) | **In-pane** card in the article column; rail intact |
| Component | `ArticleNotFound` (new) | `ArticleError` (unchanged) |

These are **separate outcomes** and must never collapse into one another. The existing
`ArticleError` card (`components/topic/ArticleBody.tsx`) stays exactly as is for the transient case.

---

## 2. Where it renders (which state owns it)

The not-found case is detected in the **resolve** step in `app/topic/TopicView.tsx`, not the
article-fetch step. Today that step sets a single boolean `resolveError`, and the render conflates
two unrelated things in one bare line:

```
if (resolveError || (!resolved && !routeTitle && !qidParam)) → "Topic not found."
```

Split the resolve outcome into **two distinct cases** so copy and actions can differ:

- **`missing`** — a well-formed title (or `?qid=`) that Wikipedia / Wikidata could not resolve to
  a real page. This is the #19 case: `routeTitle` present **and** `resolvePage` returned no
  `canonicalTitle`, no `qid`, **and** there is no seeded store topic (the existing `if
  (!canonicalTitle && !page.qid && !known)` branch); or a `?qid=` that resolved to no title.
  → render **`ArticleNotFound`** with `kind="missing"` and the attempted title.
- **`no-identifier`** — neither a path title nor a `?qid=` at all (a malformed `/topic/` URL with
  nothing to resolve). There is no title to echo or to "open on Wikipedia."
  → render **`ArticleNotFound`** with `kind="no-identifier"`.

Recommended shape (Dev's call on the exact mechanism): replace the `resolveError: boolean` with a
small discriminated state, e.g. `resolveOutcome: null | "missing" | "no-identifier"`, set where
`setResolveError(true)` is called today (the two `missing` sites get `"missing"`; the final
fallthrough `if (alive) setResolveError(true)` and the `(!resolved && !routeTitle && !qidParam)`
guard get `"no-identifier"`). Both render the same component, differing only by `kind`.

**This is a full-page state, not an in-pane card.** Because the page never resolved a `qid`, there
is no topic, no clips, no candidates, no rail — nothing curated to keep "still useful on the right"
(the rationale that justifies `ArticleError`'s in-pane treatment does **not** apply here). So
`ArticleNotFound` returns early, **before** the split-pane shell — the same position the current
`resolveError` branch returns from.

**Header:** render the shared `SiteHeader` with `host="topic"` above the not-found content so the
upper-left **topic search** (`TopicHeaderSearch`) is present — the primary recovery path is a
search, and the header search is the canonical one. Pass `articleTitle={undefined}` (there is no
resolved display title) so the slim-state title cue stays empty. Today the `resolveError` branch
returns *without* a header; adding it is part of this change (the reader needs the search box).

---

## 3. Component: `ArticleNotFound`

New presentational component, `components/topic/ArticleNotFound.tsx` (sibling of `ArticleBody.tsx`).
Pure/stateless — props in, no data fetching, no store reads.

```ts
type ArticleNotFoundKind = "missing" | "no-identifier";

interface ArticleNotFoundProps {
  kind: ArticleNotFoundKind;
  /** The title the reader attempted — the path title (space-form). Present for "missing"
   *  arrivals via /topic/<Title>; omit for "no-identifier" and for ?qid= arrivals with no title. */
  attemptedTitle?: string;
  /** Push the attempted title into the site topic-search and focus it (see §7). */
  onSearch: (prefill: string) => void;
}
```

### 3.1 Layout

A single centered **Indigo Press editorial card** on the page's neutral background — the empty/
error family already in the system: white panel, **2px ink (`#2C2C2C`) border**, solid offset
drop-shadow (`shadow-[4px_4px_0_#2C2C2C]`), generous padding. Centered in a constrained column
(`max-w-[34rem]`, `mx-auto`, vertical padding `py-16 sm:py-24`, page inset `px-5`). This is the
plus identity (it is wiki+'s own message, not Wikipedia content), so it uses the brand fonts
(Source Sans Pro heading / Open Sans body) and indigo accents — **not** the Wikipedia serif look.

Top-to-bottom inside the card:

1. **A small kicker line** — muted label, e.g. `Topic not found` in `text-ink2`, `text-xs`,
   `font-bold`, `uppercase tracking-wide`. (Text-labeled; not a colored icon.)
2. **Headline** (`<h1>`) — see §4 copy.
3. **Body paragraph** — see §4 copy; echoes the attempted title for `missing`.
4. **Action row** — buttons/links per §5, wrap on narrow widths.

No illustration / no emoji (CLAUDE.md: no emoji). The signal is carried by **words**, never color
or an icon alone.

### 3.2 Visual tokens (reuse, don't invent)

- Card: the existing `plus-card` treatment (2px ink border + offset shadow) or its tokens directly.
- **Primary action** button: `border-2 border-ink bg-action text-white` with the hover offset
  shadow (`hover:shadow-[2px_2px_0_#2C2C2C]`) — **action blue `#1F6F95`** (this is a navigational
  action, the same role the action color plays elsewhere). White-on-`#1F6F95` is AA.
- **Secondary actions**: `border-2 border-ink bg-white text-ink` (the same secondary treatment
  `ArticleError`'s "Open on Wikipedia" uses).
- **No gold.** Gold stays the wordmark-only accent; it is never a signal here.
- All focusable controls carry the project's standard visible focus ring (do not remove outlines).

---

## 4. Microcopy (exact wording)

### `kind="missing"` (the #19 case)

- **Kicker:** `Topic not found`
- **Headline:** `There's no Wikipedia article by that title`
- **Body (title known):**
  `We looked for “{attemptedTitle}” on Wikipedia and didn't find an article with that title. It may be misspelled, or the page may not exist yet.`
  - `{attemptedTitle}` is the space-form attempted title, in curly typographic quotes, **not**
    styled as a link (it resolves to nothing).
- **Body (title unknown — e.g. an unresolvable `?qid=`):**
  `We couldn't find a Wikipedia article for this topic. It may not exist, or the link may be out of date.`

### `kind="no-identifier"`

- **Kicker:** `Topic not found`
- **Headline:** `That's not a topic we can open`
- **Body:**
  `This link doesn't point to a Wikipedia article. Search for a topic to get started.`

### Honesty bar

The copy must **not** say "Couldn't load," "reach Wikipedia," "just now," or offer "Try again" —
all of which frame a permanent absence as a transient failure. The whole point of #19 is to stop
implying a network problem. (Contrast: `ArticleError`'s copy — "We couldn't reach Wikipedia just
now… Try again" — is correct *there* and must stay.)

---

## 5. Actions

Order left-to-right (primary first); they wrap to stacked on narrow widths (§6).

### `kind="missing"` with a known `attemptedTitle`

1. **`Search Wikipedia`** *(primary, action blue).* Pushes the attempted title into the site
   topic-search prefilled and focused (see §7) — the cheapest fix for the overwhelmingly common
   cause (a typo). Behaves as a real button (`type="button"`), keyboard-activ:able.
2. **`Open search on Wikipedia ↗`** *(secondary, new tab).* `href` =
   `https://en.wikipedia.org/w/index.php?search={encodeURIComponent(attemptedTitle)}`,
   `target="_blank" rel="noopener"`. The trailing `↗` marks "opens externally" with a glyph
   *and* the word "Wikipedia" — never color alone. (Note: this is Wikipedia's **search**, not
   `/wiki/<Title>` — linking to the nonexistent article would just land on Wikipedia's own red
   "page does not exist" screen, which is no better than where the reader is.)
3. **`Back home`** *(secondary).* `<Link href="/">` to the landing page.

### `kind="missing"` without a title, or `kind="no-identifier"`

There is no title to search or to open on Wikipedia, so:

1. **`Search topics`** *(primary, action blue).* Calls `onSearch("")` — opens/focuses the site
   topic-search empty (no prefill), so the reader can type. (On `< md` where the header search is a
   disclosure, `onSearch` opens the disclosure; see §7.)
2. **`Back home`** *(secondary).* `<Link href="/">`.

---

## 6. Responsive behavior

This is a **single-column, full-page** state at every breakpoint — it predates the split-pane, so
there is no desktop-split vs. mobile-stack distinction to honor here (the split-pane shell is never
mounted in this state).

- **`≥ sm`:** card centered, `max-w-[34rem]`, action row in a single horizontal line
  (`flex flex-wrap gap-3`).
- **`< sm`:** card full available width inside the `px-5` page inset; action buttons wrap and may
  stack full-width — each button keeps a comfortable tap target (`py-2`+; min 44px height).
- The header above is the standard `host="topic"` `SiteHeader`, which already provides its own
  inline (`≥ md`) vs. disclosure (`< md`) search treatment — `ArticleNotFound` does not duplicate
  that; it only drives focus into whichever the header is showing (§7).

---

## 7. The "search" action — exact behavior

The primary recovery is **the site's own topic search** — keep the reader in-app, prefilled with
what they typed, so correcting a typo is one keystroke-light step. We do **not** bounce them to
Wikipedia's search for the primary path (that leaves wiki+), and we don't navigate to a guessed
slug (the title doesn't resolve — AC6 of the resolve path forbids canonicalizing a missing title).

**Mechanism (`onSearch(prefill)`):** the `TopicHeaderSearch` in the header already renders the
reusable `TopicSearch` (combobox; on submit it does `router.push(topicHref(<typed title>))`). The
not-found page's primary button focuses that search and seeds it with `prefill`:

- **`≥ md` (inline search visible):** focus the header search input and set its value to `prefill`,
  positioning the caret at the end so the reader can edit a typo immediately. The reader then edits
  and submits through the existing `TopicSearch` flow — **no new navigation logic** in
  `ArticleNotFound`.
- **`< md` (disclosure search):** open the search disclosure (the same control the header's
  `Search topics` toggle opens), then focus + seed it as above.

**Implementation note for Dev (mechanism is yours to choose, behavior is the contract):** the
cleanest seam is to let `TopicSearch` accept an external "prefill + focus" signal (e.g. a small
imperative handle or a shared prefill state lifted to where both `SiteHeader` and `ArticleNotFound`
can reach it), since `ArticleNotFound` and the header search are siblings under `TopicView`. If
wiring a cross-component focus/prefill proves heavy for this issue, an acceptable **fallback** that
still satisfies the user story is: the primary button is a `<Link>` that navigates home (`/`) with
the search prefilled there (the home header search), e.g. `/?q={attemptedTitle}` consumed by the
home `TopicSearch`. Either is acceptable; **what's not acceptable** is a primary action that does
nothing useful, navigates to a guessed/dead slug, or re-attempts the same dead title. Confirm the
chosen mechanism with UX at evaluation.

> Open question for Product/Dev: if the home `?q=` prefill seam doesn't exist yet, the in-header
> focus+seed path is preferred over adding a new home-search query param. Flag at build time.

---

## 8. Accessibility

- **Heading structure.** The card's headline is the page's single `<h1>` (this state replaces the
  whole Topic page; there is no competing article `<h1>`). The kicker is **not** a heading — it's a
  styled `<p>`/`<span>` label, so it doesn't create a phantom heading level.
- **Announce the state.** Wrap the card (or its text block) in a container that is discoverable to
  AT on arrival. Because this renders on navigation (the page *is* this state, not a state change
  injected into a live page), a correct `<h1>` is the primary signal; **do not** use
  `role="alert"` (it is not an error/transient condition and should not interrupt). A polite
  `role="status"` on a visually-hidden line (`There's no Wikipedia article by that title.`) is
  optional belt-and-suspenders. (Contrast `ArticleError`, which *is* `role="alert"` — appropriate
  for a transient failure injected into an otherwise-live page.)
- **Focus management.** On render, move focus to the `<h1>` (`tabIndex={-1}`) so a keyboard / SR
  user lands on the explanation, not at `<body>` top — mirroring the project's existing
  "move focus sensibly" pattern (`focusBandHeading`). Do not trap focus (this is not a dialog).
- **Keyboard.** Every action is a native `<button type="button">` or `<a>`/`<Link>` — reachable in
  DOM order (primary first), Enter/Space activate, visible focus ring on each. The primary search
  button, when activated, sends focus into the search input (§7) so the keyboard path flows
  search → type → submit without a dead focus.
- **Color independence.** Every signal is text: the kicker word `Topic not found`, the headline,
  the external `↗` glyph paired with the word "Wikipedia." No state is conveyed by color alone.
- **Contrast.** Headline/body `ink #2C2C2C` on white = AA+. Action-blue button text is white on
  `#1F6F95` (AA). Muted kicker uses `ink2` (`#54595D`/`#595959`) on white — confirm `text-xs`
  bold clears AA (it does at these tokens); if a lighter mute is used, bump weight/size.

---

## 9. States summary (for the build + the QA/UX evaluation)

| State | Trigger | Surface | Copy headline | Primary action | a11y role |
|---|---|---|---|---|---|
| **not-found (missing, title known)** | `resolvePage` all-null, title in path, no seeded topic | full page, `ArticleNotFound kind="missing"` | "There's no Wikipedia article by that title" | Search Wikipedia (prefilled) | `<h1>` + focus; no alert |
| **not-found (missing, no title)** | unresolvable `?qid=` | full page, `kind="missing"`, no `attemptedTitle` | same headline; generic body | Search topics (empty) | same |
| **not-found (no identifier)** | no path title and no `?qid=` | full page, `kind="no-identifier"` | "That's not a topic we can open" | Search topics (empty) | same |
| **transient error** (unchanged) | `fetchFullArticle` rejects after the page resolved | in-pane `ArticleError` card; rail intact | "Couldn't load the article" | Try again | `role="alert"` |
| loading (unchanged) | resolve/fetch in flight | `ArticleSkeleton` | — | — | `aria-busy`/status |
| ready (unchanged) | article fetched | split-pane | article title | — | — |

The build is correct only if a nonexistent title (`/topic/Asdfqwer`) reaches the **not-found**
row and a genuine network failure on a *real* article still reaches the **transient error** row —
the two paths verified as **separate outcomes** (issue #19's test requirement; QA owns the tests,
this table is the oracle).

---

## 10. Out of scope / hand-offs

- The detection mechanism already exists (`resolvePage`/`titleToQid` → null) — **no new fetch**,
  no schema/auth/Server-Action change (per issue constraints).
- The context-note / stance / accuracy vocabulary is untouched (no curation surfaces here).
- Tests for the two separate outcomes → **QA & Review** (this spec's §9 table is the expected-
  behavior oracle).
- The `?q=` home-search-prefill seam, if chosen as the §7 fallback, is a small Dev decision; flag
  to Product only if it implies a new public URL contract.
