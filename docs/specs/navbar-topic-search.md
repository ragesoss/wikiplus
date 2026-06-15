# Spec: Navbar topic search — type a title, open its Topic page

**Issue:** [#12](https://github.com/ragesoss/wikiplus/issues/12) · **Type:** build (discovery — client-side search input) · **Status:** spec
**Owner:** Product · **Feeds:** UX (flow + design spec), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#11](https://github.com/ragesoss/wikiplus/issues/11) (`titleToSlug`/`topicHref` encoding seam — shipped), [#1](https://github.com/ragesoss/wikiplus/issues/1)/[#13](https://github.com/ragesoss/wikiplus/issues/13) (title-based routing + bare-path fallback — shipped) · **Relates to:** the empty-state curation flow (`docs/TOPIC_PAGE_DESIGN.md`)

---

## Problem

Today there is **no way to reach a topic by name.** The three surfaces a user can land on each
dead-end for arbitrary topics:

- **Home (`app/page.tsx`)** lists only the *seeded* topics (Photosynthesis, Cellular respiration,
  Cat). There is no input — if the topic you want isn't one of the three cards, the home page
  cannot get you there.
- **Topic header (`components/topic/TopicHeader.tsx`)** has no search — once you're on a Topic page,
  the only way onward is an article wikilink.
- **`/contribute`** asks for a raw **Wikidata QID** (e.g. `Q146`) — a power-user identifier nobody
  types from memory. It is a contribution form, not a way to *navigate*.

So the only realistic path to an uncurated topic is: know its QID, or guess the URL. That directly
undercuts the product's premise — **"topics are created on demand"** (VISION) only matters if a
reader can *reach* an uncurated topic, and ARCHITECTURE's "Topic discovery & search" section names
exactly this: *"Topics are created on demand, so users need to reach uncurated ones. A search box
resolves a query to a Wikipedia article … This is what makes the empty state matter."* The empty
state and the candidate-suggestion pipeline already exist; the front door to them does not.

## User value

A reader can **type a topic or article name and go straight to its Topic page** — existing or
created-on-demand — the way they'd expect any wiki to behave. This is the single highest-leverage
discovery affordance: it turns wiki+ from "three demo cards" into "any Wikipedia article, plus."
For the reader it lowers the "how do I get to a topic" barrier to zero; for the product it feeds the
curation flywheel by routing arrivals onto empty topics that invite curation.

---

## What the prototype already gives us for free (grounding)

This spec is deliberately small because the routing work it depends on is **already shipped.** The
build is essentially *an input that calls `topicHref(title)`.* Specifically:

- **Routing.** `topicHref(title)` (`lib/wiki/topicRoute.ts`) already produces the canonical
  `/topic/<Title>/` URL. Navigating there renders `TopicView`, which resolves **title→QID under the
  hood** (`titleToQid`, `lib/wiki/article.ts`) and shows the curated **or** empty state — for **any**
  title, seeded or not (the `not-found.tsx` SPA-shell path, #13). So **"create on demand" requires
  no new code**: it is what already happens when you land on an unseeded `/topic/<Title>/`.
- **Encoding.** `titleToSlug`/`slugToTitle` (#11) are the single source of truth for title↔URL; this
  feature reuses them via `topicHref`, encoding nothing itself.
- **Suggestions data.** Wikipedia's **typeahead (prefix-completion) search** is CORS-enabled for
  anonymous GETs and **needs no API key** — the same client-side, key-free fetch pattern already used
  in `lib/wiki/article.ts` (`titleToQid`, `fetchFullArticle`). No server, no secret, no quota. (See
  Decision 2 for the recommended endpoint.)

The consequence — recorded as **Decision 3** below — is that the navbar search does **not** route
through `/contribute` to reach a topic. The issue's "reuse the `/contribute` creation path" line
predates the title-routing work (#1/#11/#13); reaching a topic is now a pure `topicHref` navigation,
and that is the correct, simpler contract.

---

## Scope

1. **An accessible search input on the agreed surface(s)** (see Decision 1) — labeled, keyboard-
   operable, AA-contrast — that lets a user type a Wikipedia topic/article name.
2. **Title suggestions while typing**, sourced from Wikipedia's typeahead search (Decision 2),
   shown as a selectable list under the input. Suggestions are an enhancement, not a requirement to
   submit (see AC9).
3. **Navigate to the Topic page on select-or-submit** via `topicHref(title)` (Decision 3) — using
   the Next client router so it's an in-app navigation, not a full reload.
4. **Defined behavior for the unknown / no-results / empty path** (Decision 4) — the user is never
   stranded; a typed title still navigates, and an empty/whitespace submit is a graceful no-op.

Out-of-scope items below are excluded **by product decision**, not omission.

## Out of scope (explicit)

- **A full search-results page.** No `/search?q=` route, no results listing, no result-detail view.
  Search is an input + an inline suggestion dropdown that navigates straight to a Topic page.
- **Ranking / relevance scoring of our own.** We display the upstream suggestion order as-is. We do
  not re-rank, score, or blend sources.
- **Non-Wikipedia search.** No searching wiki+ clips, creators, curators, candidates, or any
  non-Wikipedia corpus. The input resolves Wikipedia **article titles** only.
- **Full-text / article-body search.** Title (prefix) suggestions only — not searching within
  article prose.
- **The `/contribute` QID flow.** Untouched by this feature (Decision 3); reaching a topic no longer
  needs it.
- **Auth, persistence, history, recent/popular searches, autocomplete personalization.** Search is
  anonymous and stateless (consistent with the anonymous read path). No server infra is introduced.
- **Multilingual / cross-wiki search.** English Wikipedia only, matching the rest of the prototype.
- **Mobile single-column layout polish of the header** beyond the input being usable and accessible
  on small screens (full responsive header treatment is UX's call, not a blocking criterion here).

---

## Product decisions — resolving the four open questions

These are the **contract** for UX and Development. UX owns the *look and the flow*; these fix the
*behavior and surface*.

### Decision 1 — Surface: a shared search component, placed in the **home header first**, then the **global navbar (topic header)**

**Decision:** Build **one reusable search component** and place it on **both** the home header
(`app/page.tsx`) and the Topic header (`components/topic/TopicHeader.tsx`). It is the same component
in both places — not two implementations.

Rationale:
- The **home page is the primary entry** and today has no input at all — that is the most acute gap,
  so it is the must-ship surface. With search present, the seeded cards become *examples*, not the
  only door.
- The **topic header** is the natural "search again / jump to another topic" affordance once you're
  reading — reaching a related topic shouldn't require going back home. ARCHITECTURE names internal
  wikilinks and the search box as the two main paths to topics; both should be reachable from a
  Topic page.
- A **single shared component** keeps behavior identical and is the cheapest thing to test once.

**Constraint for UX (from the issue / design doc):** the two-world Topic header is *tight on the
Wiki side*; the search must not crowd or visually intrude on the faithful-Wikipedia article column.
Placement, collapsing, and responsive behavior in the Topic header are **UX's to design** — this
spec only requires that the component is present and accessible there. If UX finds the Topic header
genuinely cannot host it accessibly at some breakpoint, the home-header placement is the
**must-have**; the topic-header placement is **strongly preferred but may degrade gracefully** (e.g.
an icon that expands) — UX decides, and AC4 is then verified on whatever form UX ships.

> **Product priority if scope must be cut:** home-header search is the floor (AC1–AC3, AC9–AC11 must
> pass there). Topic-header search (AC4) is the next increment.

### Decision 2 — What it searches: **Wikipedia's typeahead (prefix-completion) search, client-side, no key**

**Decision:** Suggestions come from **Wikipedia's typeahead search** — the prefix/title-completion
search that powers the search box on Wikipedia itself — fetched **client-side**, **namespace 0
(articles) only**, with the descriptive `Api-User-Agent` already used in `lib/wiki/article.ts`.
Display the returned titles in upstream order (no re-ranking, per Out-of-scope).

**Recommended endpoint (owner-confirmed):** the **REST title-completion / "search/title" endpoint**
(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=<q>&limit=…`) — Wikipedia's own typeahead
search, which returns ranked title completions (plus thumbnails/descriptions the UI may use). It is
purpose-built for as-you-type suggestion and is the same engine the Wikipedia search box uses.

**Proven fallback:** the **action `opensearch` endpoint**
(`https://en.wikipedia.org/w/api.php?action=opensearch&search=<q>&limit=…&namespace=0&format=json&origin=*`)
— also typeahead/prefix completion, returns plain article titles, and is the exact CORS-enabled,
key-free shape already used in `lib/wiki/article.ts`. Either satisfies the requirement; Dev/UX pick
whichever gives the better completions and CORS behavior in practice.

Rationale: Wikipedia's typeahead search is good and is the natural fit (owner directive). Both
options are **CORS-enabled, key-free, return clean article titles** ready to hand to `topicHref`,
and match the existing client-fetch pattern — **no new infra, no secret, no quota** (unlike the
YouTube key). The *product* requirement is fixed: **"Wikipedia article-title typeahead suggestions,
client-side, no API key, namespace 0."** The exact endpoint between the two above is a Dev/UX
finalization, not a product constraint.

Etiquette (required): debounce input before firing requests, abort the in-flight request when the
query changes, and degrade silently on error/timeout to the **submit-the-typed-title** path
(Decision 4) — never show an error UI for a failed suggestion fetch.

### Decision 3 — Create-on-demand: **navigate to `topicHref(title)`; do not route through `/contribute`**

**Decision:** On **select** (choosing a suggestion) or **submit** (Enter / the search action on the
raw typed text), navigate via the **Next client router** to **`topicHref(<title>)`** — the canonical
`/topic/<Title>/` URL. That is the entire create-on-demand behavior:

- If a wiki+ topic already exists for that title, the Topic page shows its curated clips.
- If it does **not**, the user lands on the **empty / zero-curation state** for that title (article +
  unvetted candidate suggestions + curation entry points) — the topic "comes into existence" the
  first time someone curates, exactly per VISION. `TopicView` resolves title→QID under the hood;
  the QID never appears in the URL.

Title used for the URL:
- **Select a suggestion** → use that suggestion's exact title (it is a real article title).
- **Submit raw typed text** → use the typed string verbatim as the title; `topicHref` encodes it via
  `titleToSlug`. (Title↔QID resolution and any redirect normalization happen downstream in
  `TopicView`/`titleToQid`, as they already do for typed/pasted URLs — not this feature's job.)

The search does **not** call `store.upsertTopic`, does **not** open `/contribute`, and writes
nothing. It is a pure navigation. (`/contribute` remains the *clip-adding* flow, reachable as it is
today; it is out of scope here.)

### Decision 4 — Unknown / no-results / empty path

**Decision:**
- **No suggestions returned** (typo, obscure phrasing, or the suggest fetch failed): the dropdown
  shows a brief, non-blocking empty hint (e.g. "No matching articles — press Enter to open
  '<typed text>'"), and **submitting still navigates** to `topicHref(<typed text>)`. The user is
  never blocked by the absence of a suggestion. The landing Topic page then handles a genuinely
  non-existent article through its **existing** loading→resolve path (`TopicView` already renders a
  graceful state when `titleToQid`/article fetch finds nothing — this feature does not add a new
  error surface; it relies on the one that exists).
- **Empty or whitespace-only submit:** a **graceful no-op** — no navigation, focus stays in the
  input (no error toast, no blank `/topic//`).
- **Suggest API error/timeout:** silent degrade to the submit-the-typed-title path (Decision 2
  etiquette) — no error UI.

This keeps the contract simple: **a non-empty submit always resolves to a Topic page; the Topic page
owns the "does this article exist" answer**, reusing behavior already shipped.

---

## Acceptance criteria

Each item is independently verifiable by an automated test (Vitest/RTL component test or Playwright
e2e) **or** a concrete manual check. The Wikipedia typeahead-search and `titleToQid` calls are
**mocked** in unit/e2e tests (no network in CI — the established pattern in `docs/ARCHITECTURE.md`
"Testing").
"Submit" = pressing Enter in the input or activating the search action; "select" = choosing a
suggestion from the dropdown.

**Core navigation**

1. **Submit a title opens its Topic page.** Typing a Wikipedia article title (e.g. `Photosynthesis`)
   in the search input and submitting navigates the app to `topicHref("Photosynthesis")`
   (`/topic/Photosynthesis/`). *Verify:* component/e2e test asserts the router navigates to that
   exact path.
2. **Selecting a suggestion opens that title's Topic page.** With suggestions present (mocked
   typeahead search returning e.g. `["Cat", "Catalonia"]`), selecting "Catalonia" navigates to
   `topicHref("Catalonia")`. *Verify:* component/e2e test.
3. **A space-containing title routes correctly via the #11 encoding.** Submitting `San Francisco`
   navigates to `/topic/San_Francisco/` (space → underscore, via `topicHref`/`titleToSlug`), not
   `%20`. *Verify:* unit/component test on the navigation target.
4. **Search works on the agreed surface(s).** The search component is present and operable on the
   **home header** (`app/page.tsx`) and on the **Topic header** (`TopicHeader.tsx`) in whatever
   responsive form UX ships (Decision 1). *Verify:* component test renders each host and finds the
   labeled search control; AC1–AC3 pass when driven from each surface. (If UX degrades the topic-
   header form per Decision 1's fallback, AC4 is checked against that shipped form.)

**Create-on-demand / unknown path**

5. **Create-on-demand: an unseeded title still opens a working Topic page.** Submitting a title that
   is **not** one of the seeded topics navigates to its `/topic/<Title>/` and the page renders the
   topic shell (loading → empty/curated state), **not** a hard error or a blank page, and **no QID
   appears in the URL**. *Verify:* e2e with `titleToQid`/article fetch mocked for a non-seeded title;
   assert URL has no `qid=` and the empty-state UI (or loading→empty) renders.
6. **No `/contribute` and no write on navigation.** Using search to reach a topic does **not** open
   `/contribute` and does **not** create a topic record (no `store.upsertTopic`/`addClip` call).
   *Verify:* component test spies on `store` and asserts no write; e2e asserts the URL is
   `/topic/<Title>/`, never `/contribute`.
7. **No-results hint, still submittable.** When the typeahead search returns no results for the query,
   the dropdown shows a non-blocking "no matches" hint **and** submitting still navigates to
   `topicHref(<typed text>)`. *Verify:* component test with mocked empty suggestions asserts both the
   hint text and the navigation on submit.
8. **Empty/whitespace submit is a no-op.** Submitting with an empty or whitespace-only input does
   **not** navigate (no `/topic//`, no `/topic/%20/`) and leaves focus in the input. *Verify:*
   component test asserts no navigation occurred.

**Suggestions behavior**

9. **Suggestions are an enhancement, not a gate.** A user can submit the typed text and navigate
   **without** ever opening or selecting from the dropdown (works even if the suggest fetch is slow
   or failed). *Verify:* component test submits before/without suggestions resolving and asserts
   navigation to the typed title.
10. **Suggest etiquette: debounce + abort + silent degrade.** Rapid typing does not fire one request
    per keystroke (requests are debounced), an obsolete in-flight request is aborted when the query
    changes, and a suggest fetch error shows **no** error UI (it degrades to the submit path).
    *Verify:* unit/component test with a mocked fetch asserting (a) fewer fetches than keystrokes
    over a burst, (b) abort on query change, (c) no error element rendered on a rejected fetch.

**Accessibility (baseline, per CLAUDE.md "Accessibility is baseline")**

11. **Labeled and keyboard-operable.** The input has an associated, programmatic label (visible label
    or `aria-label`); the whole flow — focus the input, type, navigate the suggestion list, select,
    submit — is operable by keyboard alone (Tab to reach it, Arrow keys + Enter through suggestions,
    Enter to submit), with a visible focus indicator on the input and on each focused suggestion.
    *Verify:* RTL test queries the control **by accessible role/name** (`getByRole("searchbox"|
    "combobox", { name })`) and drives selection via keyboard; manual keyboard pass confirms focus
    visibility.
12. **AA contrast + not color-alone.** The input text, placeholder, label, and suggestion text meet
    **WCAG AA** contrast against their backgrounds; the focus indicator is perceivable without relying
    on color alone (e.g. a visible ring/outline), consistent with the Indigo Press tokens. *Verify:*
    UX design-eval against the design spec + a contrast check on the shipped tokens (the project's
    chip-contrast test approach in `lib/curation/labels.ts` is the precedent).
13. **Suggestion list has correct semantics.** If a suggestion dropdown is shown, it is exposed with
    appropriate combobox/listbox semantics (or an equivalently accessible disclosure pattern UX
    specifies) so a screen reader announces the options and the active one. *Verify:* RTL test asserts
    the listbox/option roles (or UX's specified equivalent) and `aria-activedescendant`/selection
    state on arrow navigation.

> **Note on AC11–AC13:** the *exact* ARIA pattern (combobox+listbox vs. a simpler disclosure) is
> **UX's design decision**; these criteria fix the *outcome* (labeled, keyboard-operable, AA,
> screen-reader-announced), not the specific markup. QA verifies the outcome against whatever pattern
> UX's design spec defines.

---

## Success metric

**Primary:** **Search → topic-page reach rate.** Once light analytics exist (deferred — see below),
the share of search submissions that result in a Topic page load. Target: a non-trivial fraction of
sessions use search to reach a topic that is **not** one of the seeded cards — i.e. search
demonstrably opens the long tail of Wikipedia, which is the feature's whole point. A healthy signal
is **reaching topics beyond the seeded set**, distinguishing this from "clicked a seed card."

**Secondary (qualitative, available now):** in the prototype (no analytics), the metric is verified
by the **acceptance test that a non-seeded title reaches a working Topic page** (AC5) — i.e. the
*capability* is proven even before traffic exists.

**Why this metric:** the feature's job is to remove the "I can't get to my topic" wall. The right
measure of success is *people getting to topics they couldn't reach before*, not raw search volume.

> **Analytics is deferred** (CLAUDE.md / VISION non-goals: "Analytics-as-role" comes at launch). This
> spec *defines* the metric so the instrumentation hook is unambiguous when analytics lands; no
> tracking is built in this issue. The buildable contract here is the AC set above.

---

## Hand-off

- **UX (next):** owns the *flow and design spec* for the shared search component — placement and
  responsive behavior in the home header and the (tight) two-world Topic header; the suggestion
  dropdown's visual + interaction design; the exact accessible pattern satisfying AC11–AC13; the
  empty/no-results hint copy and treatment; and Indigo-Press tokens meeting AA (AC12). Inputs: this
  spec + `docs/TOPIC_PAGE_DESIGN.md` (header, §5.1) + `mockups/`.
- **Development (after UX):** build **one reusable client search component** that (1) fetches
  typeahead-search suggestions client-side with debounce/abort/silent-degrade (Decision 2), (2) navigates
  via the Next client router to `topicHref(title)` on select/submit (Decision 3), (3) handles the
  empty/no-results/whitespace paths (Decision 4), and (4) is placed on the home + topic headers
  (Decision 1). **Reuse** `lib/wiki/topicRoute.ts` (`topicHref`) and the `Api-User-Agent`/fetch
  pattern in `lib/wiki/article.ts`; introduce **no** server infra, secret, or write path. Add Vitest
  component tests + a Playwright e2e covering the ACs (Wikipedia calls mocked/intercepted).
- **QA & Review (after Dev):** verify each AC, confirm no write/no `/contribute` coupling (AC6), and
  run the accessibility + security review (the only network egress is a key-free, CORS GET to
  Wikipedia — confirm no secret introduced and the `Api-User-Agent` etiquette is present).
