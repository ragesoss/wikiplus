# Spec: Canonicalize the Topic URL + displayed title to Wikipedia's canonical form

**Issue:** [#23](https://github.com/ragesoss/wikiplus/issues/23) · **Type:** build (routing / title-resolution) · **Status:** spec
**Owner:** Product · **Feeds:** UX (flow note), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#11](https://github.com/ragesoss/wikiplus/issues/11) (`titleToSlug`/`slugToTitle` encoding seam — shipped), [#13](https://github.com/ragesoss/wikiplus/issues/13)/[#20](https://github.com/ragesoss/wikiplus/issues/20) (bare-path redirect — shipped) · **Coordinate with:** [#19](https://github.com/ragesoss/wikiplus/issues/19) (not-found for nonexistent titles)

---

## Problem

When a reader lands on a hand-typed or pasted Topic URL, the title route leaves the **typed form
in both the address bar and the heading**. Wikipedia, by contrast, snaps to the article's canonical
form: `/wiki/calvin_cycle` → `/wiki/Calvin_cycle`, and an alias like `/wiki/JFK` resolves to
`/wiki/John_F._Kennedy`. wiki+ Topic URLs are explicitly modeled on Wikipedia's `/wiki/<Title>`
scheme (`docs/ARCHITECTURE.md`, *Internal-link resolution*), but the title route does not perform
that canonicalization:

- **The address bar keeps the typed form.** `/topic/calvin_cycle/` stays `calvin_cycle`;
  `/topic/Calvin cycle/` (with a literal space) stays as typed; the alias `/topic/jfk/` stays
  `jfk` instead of resolving to `/topic/John_F._Kennedy/`. The route resolves the QID under the
  hood and renders the right article, but the URL a reader copies or shares is the messy typed one.
- **The heading echoes the URL title, not Wikipedia's rendered display title.** Wikipedia's
  *rendered display title* is not always the canonical URL title: the article whose canonical URL
  title is **`Bell hooks`** (capital B — MediaWiki capitalizes the first letter of every title)
  renders its heading as **"bell hooks"** (lowercase, the author's stylization). Today wiki+ shows
  the URL/typed form as the heading in every case, so it cannot reproduce that distinction.

The current code already requests `redirects=1` in `titleToQid` (`lib/wiki/article.ts`), so redirect
resolution is partly in place under the hood — but it **discards `pages[].title`** (the canonical
title) and never requests `displaytitle`, so neither the address bar nor the heading is corrected.
`docs/ARCHITECTURE.md` (*Routing — canonical title-based Topic URLs under static export*) currently
documents the title route as "no redirect… **title preserved**." This build **revises** that
decision and must update the doc.

## User value

- **Canonical, shareable, Wikipedia-faithful URLs.** A reader who types or pastes a sloppy form
  ends up on — and can copy — the same clean, capitalized, underscore URL Wikipedia would land
  them on (`/topic/Calvin_cycle/`), so a wiki+ link is recognizably "the same article as on
  Wikipedia" and is stable to share.
- **Aliases just work.** Typing a common alias (`/topic/jfk/`) lands on the real topic
  (`/topic/John_F._Kennedy/`) instead of a string Wikipedia would have redirected — fewer
  dead-ends, more "it knew what I meant."
- **A heading faithful to Wikipedia.** The heading reads exactly as the article reads on Wikipedia
  ("bell hooks", lowercase), not the URL's mechanical capitalization — reinforcing the
  Wiki-side fidelity the Topic page is built on, without compromising the canonical URL.

---

## Scope

A focused change to the **title-route arrival path** in the client-side static SPA — title
resolution, a canonical/display split, the heading fix, and a URL `router.replace`. No server
infrastructure.

### In scope

1. **Resolve canonical title + display title + QID in one call.** Extend the existing `titleToQid`
   action-API request (`lib/wiki/article.ts`) to also request `prop=info|pageprops&
   inprop=displaytitle` and to **stop discarding `pages[].title`**. The single confirmed request —
   `action=query&prop=info|pageprops&inprop=displaytitle&ppprop=wikibase_item&redirects=1&titles=…`
   — returns `pages[].title` (canonical), `pages[].displaytitle` (rendered), and the QID with **no
   extra network round-trip** vs. today. Development decides the seam (e.g. a `resolvePage()`
   returning `{ canonicalTitle, displayTitle, qid }`); this spec does not dictate the signature.
2. **Split canonical vs. display.** The **canonical `title`** keys the URL/slug, the store lookup,
   the QID lookup, the article fetch, and the **"View on Wikipedia"** link. The **`displayTitle`**
   is used **only** for the human-facing heading. `fetchFullArticle()` should stop returning the
   raw input title verbatim. (The `topicTitle` value in `app/topic/TopicView.tsx`, currently
   overloaded as both the heading **and** the basis for the "View on Wikipedia" URL, must split into
   a canonical value and a display value.)
3. **Canonicalize the address bar.** In `TopicView`'s **title-route branch**, after resolution,
   `router.replace` to `/topic/<Canonical_Title>/` **when** the current slug differs from
   `titleToSlug(canonicalTitle)` — adding no new history entry. Skip the replace when they already
   match (no loop, no history churn). Must hold under the GitHub Pages static export (basePath +
   `trailingSlash: true`), reusing #11's `topicHref`/`titleToSlug`.
4. **Follow Wikipedia redirects / aliases** (owner decision, 2026-06-14): `redirects=1` resolution
   means `jfk` → `John F. Kennedy`; the canonical title that comes back is what the URL and store
   key use.
5. **Plain-text `displaytitle` as the heading** — covers the bell hooks lowercasing.
6. **`docs/ARCHITECTURE.md` update** + tests (below).

### Out of scope

- **HTML-formatted display titles** — italic species/work titles, subscript/superscript formulae,
  any markup in `displaytitle`. Render `displaytitle` as **plain text** for now (strip any markup);
  rich-formatted headings are a later edge. *(Owner: OK to defer.)*
- **The `?qid=` branch.** It already canonicalizes (resolves QID→title and `router.replace`s to the
  title URL); touch it only if the resolution seam is refactored, and then only to keep it working.
- **The bare-path redirect** (`app/not-found.tsx` / `lib/routing/reserved.ts`). It already hops
  `/<Title>` → `/topic/<Title>/`; casing/alias normalization is fixed **transitively** by this
  build once it lands on the title route. **No new logic there.**
- **The not-found UX for nonexistent titles** (#19). An unresolvable title must reach the existing
  not-found path, **not** be canonicalized. This spec must not regress or pre-empt #19; it only
  guarantees an unresolved title is left alone (AC6).
- **Wikilink rewriting** (#11/#22), **disambiguation pages**, and **production / server-side
  redirects** (the production read-path turns this into a real server-side HTTP redirect; the
  prototype does it client-side).
- **First-letter case-insensitivity as a general rule.** Following redirects/aliases via the API
  fixes the cases that resolve through Wikipedia; this spec does not add a separate client-side
  first-letter normalizer beyond what the API returns.

---

## Acceptance criteria

> Each item is objectively checkable by an automated test or a stated manual step. "Canonical
> title" = `pages[].title`; "display title" = the plain-text `pages[].displaytitle`; "ends at" =
> the final URL after the title-route resolution + `router.replace` settle. The live MediaWiki /
> Wikidata fetch is mocked in tests (`docs/ARCHITECTURE.md` → *Testing*), so the resolved
> canonical/display/QID values are fixtures.

1. **Case normalization.** Arriving at `/topic/calvin_cycle/` ends at the canonical URL
   `/topic/Calvin_cycle/`, and the heading reads **"Calvin cycle"**.
2. **Literal space → underscore form.** Arriving at `/topic/Calvin cycle/` (a literal space in the
   typed path) ends at the underscore canonical form `/topic/Calvin_cycle/` (the same destination
   as AC1), heading "Calvin cycle".
3. **Redirect / alias following.** Arriving at `/topic/jfk/` ends at `/topic/John_F._Kennedy/`
   (the canonical title returned by `redirects=1` resolution) with the **target article's
   heading** (the display title for John F. Kennedy), not "jfk".
4. **The bell hooks split.** Arriving at `/topic/bell_hooks/` ends at the canonical URL
   **`/topic/Bell_hooks/`** (capital **B**), while the rendered **heading reads "bell hooks"**
   (lowercase) — the canonical title keys the URL and the display title drives the heading, and the
   two legitimately differ.
5. **Already-canonical = no redundant replace.** Arriving at a URL whose slug **already equals**
   `titleToSlug(canonicalTitle)` (e.g. `/topic/Calvin_cycle/`, `/topic/Photosynthesis/`) triggers
   **no** `router.replace` — no redirect loop and no extra browser-history entry. (Testable: assert
   the router-replace spy is **not** called when the resolved canonical slug matches the current
   slug; called exactly once when it differs.)
6. **Unresolved title is not canonicalized.** A title Wikipedia cannot resolve (resolution returns
   no canonical title / no QID) is **not** canonicalized: no `router.replace` to an empty or
   partial slug, and control reaches the existing not-found / resolve-error path (#19's territory).
   (Testable: with a fixture that resolves to "no page", assert no `router.replace` fires and the
   not-found/error state is reached — never a replace to `/topic//` or an empty slug.)
7. **`router.replace`, not `push`; holds under static export.** The canonicalization uses
   `router.replace` (so **Back** does not bounce the reader through the typed/typo URL), **not**
   `router.push`. The replaced URL is built via #11's `topicHref`/`titleToSlug`, so it carries the
   **trailing slash** (`trailingSlash: true`) and the basePath as required, and resolves correctly
   under the GitHub Pages static export. (Testable: assert the replace target string matches
   `topicHref(canonicalTitle)`; manual: on Pages, type `/topic/calvin_cycle/`, confirm the bar
   snaps to `/topic/Calvin_cycle/` and Back returns to the prior page, not the typo.)
8. **`docs/ARCHITECTURE.md` updated.** The *Routing — canonical title-based Topic URLs under static
   export* section is revised to state that **title-route arrival canonicalizes both the URL and
   the heading** (follows redirects/aliases; heading uses the plain-text `displaytitle`),
   **superseding** the current "no redirect… title preserved" note. The *Internal-link resolution*
   open-question note is left consistent with this (no contradictory "title preserved" claim
   remains for the title route).
9. **Green build + checks.** `yarn build`, `yarn typecheck`, and `yarn test` all pass. The change
   ships with automated tests covering at minimum: case normalization (AC1), literal-space →
   underscore (AC2), redirect/alias following (AC3), the bell hooks canonical/display split (AC4),
   already-canonical = no redundant replace (AC5), and unresolved = no canonicalization (AC6).

---

## Success metric

This is a verification-time correctness change (Analytics is deferred — these are conditions QA &
Review checks, not runtime telemetry). It is successful when:

- **Every messy title-route arrival in the AC matrix ends at its canonical URL** — case-variant,
  literal-space, and alias inputs (AC1–AC3) all settle on the canonical `/topic/<Canonical_Title>/`
  form, and the bell hooks split (AC4) shows the canonical URL with the lowercase display heading.
- **No redirect loops or history churn** — an already-canonical arrival fires zero `router.replace`
  (AC5), and every canonicalizing arrival fires exactly one (`replace`, never `push`), so **Back**
  never bounces through the typed form (AC7).
- **No regression of the not-found path** — an unresolvable title reaches #19's not-found/error
  path untouched (AC6); this build adds canonicalization without widening or pre-empting not-found.
- **Doc parity** — `docs/ARCHITECTURE.md` no longer claims the title route preserves the typed
  title; it documents the canonicalize-URL-and-heading behavior (AC8).

---

## Open questions / assumptions

- **Assumption — live canonical title wins over a differing seeded `store` title.** When the
  seeded store's title for a topic differs from the live canonical title the API returns, the
  **live canonical title wins** (keeps store key + URL + heading mutually consistent). Flag to
  Product if a seeded title should instead win (would need a stated reason; not expected for the
  seeded science topics).
- **Assumption — no new network round-trip.** The canonical/display/QID resolution reuses the
  single existing action-API request (confirmed this session): adding `prop=info|pageprops&
  inprop=displaytitle` to the call already made for the QID, not a second call.
- **Watch — ordering vs. #19.** An unresolved page must reach the not-found path and **never** a
  `router.replace` to an empty slug (AC6). This is the one interaction risk with #19; keep them
  consistent.
- **Deferred — HTML display titles.** `displaytitle` markup (italics, subscripts) is stripped to
  plain text this round; rich-formatted headings are a later edge (out of scope above).

---

## Hand-off

- **UX:** No new screens. One flow note to evaluate: the **title-route arrival flow** — confirm the
  address bar snaps to the canonical form for the AC1–AC4 inputs, that the heading shows the display
  title (the "bell hooks" lowercase case is the visible tell), and that **Back** after a
  canonicalizing arrival returns to the prior page rather than the typed URL (AC7). The
  user-visible surfaces are the address bar and the heading; the "View on Wikipedia" link must still
  point at the canonical article (AC2/scope item 2).
- **Development:** Extend the resolution call in `lib/wiki/article.ts` (add `prop=info|pageprops&
  inprop=displaytitle`, stop discarding `pages[].title`) behind a seam returning canonical title +
  display title + QID; split the overloaded `topicTitle` in `app/topic/TopicView.tsx` into canonical
  (URL/store/QID/article/"View on Wikipedia") vs. display (heading); add the title-route
  `router.replace`-when-slug-differs canonicalization (reuse `topicHref`/`titleToSlug` from
  `lib/wiki/topicRoute.ts`, `replace` not `push`); strip `displaytitle` markup to plain text; update
  `docs/ARCHITECTURE.md` (AC8); add the AC1–AC6 tests. Do **not** touch the `?qid=` branch (except to
  keep it working through a refactored seam), the bare-path redirect, or the #19 not-found UX.
