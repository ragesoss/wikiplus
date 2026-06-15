# Spec: Topic URLs use underscores for spaces (mirror Wikipedia)

**Issue:** [#11](https://github.com/ragesoss/wikiplus/issues/11) · **Type:** build (URL-encoding correctness fix) · **Status:** spec
**Owner:** Product · **Feeds:** UX (flow note), Development (build) · **Verified by:** QA & Review + UX

---

## Problem & user value

A Topic URL for a multi-word title currently reads `/topic/San%20Francisco` instead of
`/topic/San_Francisco`. wiki+ Topic pages are explicitly modeled on Wikipedia's `/wiki/<Title>`
scheme (the canonical title route — `docs/ARCHITECTURE.md`, "Internal-link resolution"), and
Wikipedia renders spaces as underscores. The `%20` form breaks the parallel and produces URLs that
are less legible, less obviously "the same article as on Wikipedia", and uglier to read aloud or
paste into a chat.

There is also a concrete internal-consistency bug today, not just an aesthetic one:

- `topicHref()` (`lib/wiki/topicRoute.ts`) builds `/topic/${encodeURIComponent(title)}/`, so a
  space becomes `%20`. This is the href used for in-app `<Link>`/`router` navigation **and** for the
  raw `<a href>` injected into sanitized article HTML by the wikilink rewrite (`lib/wiki/article.ts`).
- The static export, however, pre-builds slugs with `replace(/ /g, "_")` (`lib/data/seed.ts`,
  `staticTopicParams()`), so the committed HTML file for the seeded "Cellular respiration" topic
  lives at `/topic/Cellular_respiration/`.
- So the **pre-built static path and the runtime href disagree** for any multi-word seeded title: a
  hard navigation / refresh to the runtime `%20` href does not match the underscore path that was
  actually emitted, and the address bar shows `%20`.

**User value:** Topic URLs that match Wikipedia's convention — recognizable, legible, shareable, and
self-consistent between the pre-built static paths and the runtime hrefs the app generates.

This is the encoding foundation that issues #12 (navbar search) and #13 (bare-path redirect) build on
— both will reuse the same space↔underscore helper — so it lands first.

---

## Scope

A single, bidirectional space↔underscore special-case in the canonical title-route encoding, plus
making the seed's static slugs go through (or agree with) the same convention:

1. **Build href (space → underscore).** `topicHref(title)` maps spaces in the title to `_` when
   constructing `/topic/<Title>/`, instead of letting `encodeURIComponent` turn them into `%20`.
   All other characters keep their normal URL-safe encoding (see reserved-char criteria below). This
   covers both call sites — Next `<Link>`/`router` navigation and the raw `<a href>` injected into
   article HTML by the wikilink rewrite.
2. **Parse path (underscore → space).** `titleFromPathname(pathname)` maps `_` back to a space when
   decoding the captured title segment, so the returned title is the clean space-form title that the
   store lookup (`getTopicByTitle`) and the Wikipedia resolution (`titleToQid`) expect. The
   percent-decode of genuinely reserved characters is preserved.
3. **Seed static slugs.** `staticTopicParams()` (`lib/data/seed.ts`) produces slugs by the **same**
   convention as `topicHref`, so the pre-built static path for a seeded title and the runtime href
   for that same title are byte-for-byte identical.

The encoding is **bidirectional and round-trippable**: `parse(build(title)) === title` for any title,
and `build(parse(path)) === path` for any path the app itself produces.

This spec sets *what* the encoding must do and the testable conditions. It does **not** dictate the
implementation (e.g. whether to add a shared helper, the exact regex order) — that's Development's call,
subject only to the acceptance criteria.

---

## Acceptance criteria

> Each item is objectively checkable by an automated test or a stated manual step. "Build" = the
> href produced by `topicHref(title)`; "parse" = the title returned by `titleFromPathname(path)`.

1. **Multi-word title → underscore href.** `topicHref("San Francisco")` returns a path whose title
   segment is `San_Francisco` (i.e. `/topic/San_Francisco/`), containing no `%20` and no literal
   space. The same holds for the `{ withBase: true }` variant (basePath-prefixed), e.g.
   `<base>/topic/San_Francisco/`.

2. **Address bar shows underscores, not `%20`.** Navigating in-app to a multi-word Topic (via a
   `<Link>`/`router.push`/`router.replace` built from `topicHref`) results in an address bar that
   reads `/topic/San_Francisco/` — verified manually by clicking through to a multi-word topic and
   reading the URL bar; no `%20` appears for the space.

3. **Underscore URL round-trips to the correct space-title.** `titleFromPathname("/topic/San_Francisco/")`
   returns exactly `"San Francisco"` (single spaces, no underscores), and feeding that title back into
   `topicHref` reproduces `/topic/San_Francisco/`. Programmatically: for a set of representative titles
   `parse(build(title)) === title`.

4. **Underscore URL resolves the right topic on hard load.** Loading `/topic/Cellular_respiration/`
   directly (refresh / paste-in, exercising the parse path) resolves to the same topic — same QID and
   same article — as in-app navigation to that topic does. The title passed to the store lookup
   (`getTopicByTitle`) and to `titleToQid` is the space-form `"Cellular respiration"`, not the
   underscore form. (Manual: refresh on a multi-word seeded topic and confirm the article + curated
   clips load, not an error state.)

5. **Static slug and runtime href agree.** For every seeded multi-word title (e.g. "Cellular
   respiration"), the slug emitted by `staticTopicParams()` and the title segment produced by
   `topicHref(title)` are identical. Programmatically: for each `SEEDED_TITLES` entry,
   `"/topic/" + staticTopicParams-slug + "/" === topicHref(title)` (modulo basePath). No seeded title
   produces a static path the runtime would never navigate to.

6. **Reserved URL characters stay percent-encoded.** For a title containing genuinely reserved
   characters — covering at least `&`, `?`, `#`, `/`, and `+` — `topicHref` percent-encodes those
   characters (e.g. `&`→`%26`, `?`→`%3F`, `#`→`%23`, `/`→`%2F`, `+`→`%2B`), so the title segment is a
   valid, unambiguous single path segment. Only space↔underscore is special-cased; nothing else
   changes from today's `encodeURIComponent` behavior. Concretely:
   - `topicHref("AT&T")` percent-encodes the `&` (no raw `&`, which would read as a query separator).
   - `topicHref("C++")` percent-encodes each `+` (a literal `+` in a path is ambiguous with a space
     in some decoders).
   - A title with a literal `/` produces `%2F` in the title segment, not a path break.
   - `parse(build(title)) === title` round-trips for each of these reserved-char titles.

7. **Underscores are not over-escaped.** A title that legitimately renders as an underscore in the
   URL is not double-encoded: the href title segment for `"San Francisco"` is the literal
   `San_Francisco`, never `San%5FFrancisco` or `San_Francisco` with a stray escape. (Edge note: a
   title that *contains a literal underscore character* and a title that *contains a space* both map to
   `_` in the URL and therefore both parse back to a space; this collision is acceptable and matches
   Wikipedia, where underscore and space are interchangeable in titles. Record as an assumption, not a
   defect.)

8. **Wikilinks land on the underscore URL.** A rewritten article wikilink to a multi-word article
   (the `<a href>` produced by `rewriteLinks` in `lib/wiki/article.ts`, which uses
   `topicHref(title, { withBase: true })`) has an `href` whose title segment uses underscores, and its
   `data-topic-title` attribute carries the clean space-form title. (Manual: in a rendered article,
   a link to a two-word article navigates to `/topic/Two_Words/`.)

9. **Back-compat: existing `%20` URLs still resolve.** A hard load of a legacy `/topic/San%20Francisco/`
   URL still resolves to the same topic as `/topic/San_Francisco/` — because `titleFromPathname`
   percent-decodes the `%20` to a space, which is the same space-form title the underscore path
   produces. Programmatically: `titleFromPathname("/topic/San%20Francisco/") === titleFromPathname("/topic/San_Francisco/") === "San Francisco"`. (The app emits underscore URLs going forward; the `%20`
   form remains a working entry point, not a canonical output.)

10. **Single-word titles are unaffected.** `topicHref("Photosynthesis")` returns
    `/topic/Photosynthesis/` and `titleFromPathname` round-trips it unchanged — no regression for the
    common single-word case.

11. **Non-topic and `?qid=` paths still return null.** `titleFromPathname` continues to return `null`
    for non-topic paths and for the bare `/topic` (`?qid=`) entry, exactly as today — the encoding
    change does not widen what counts as a title path.

12. **Tests cover the round-trip.** The change ships with automated tests asserting at least: the
    multi-word round-trip (AC3), static/runtime agreement (AC5), reserved-char encoding + round-trip
    (AC6), the `%20` back-compat equivalence (AC9), and the single-word no-regression (AC10).

---

## Out of scope

- **The broader title-routing build (#1).** This spec touches only the space↔underscore encoding and
  the seed slugs; it does not redesign title routing, resolution, or the catch-all route.
- **Changing the canonical `/topic/` scheme.** `/topic/<Title>/` with `trailingSlash: true` and the
  QID-under-the-hood model stay exactly as in `docs/ARCHITECTURE.md`. This is an encoding fix within
  that scheme, not a scheme change.
- **Navbar search (#12) and bare-path redirect (#13).** Those are separate issues that will *consume*
  the encoding helper this work lands; they are not built here.
- **Wikipedia's first-letter capitalization normalization.** Wikipedia treats the first letter of an
  article title as case-insensitive (`/wiki/photosynthesis` → `Photosynthesis`). wiki+ does not
  normalize first-letter case here; `/topic/photosynthesis` is treated as a distinct title string from
  `/topic/Photosynthesis`. This is a possible future refinement (see Open questions) and is
  **explicitly out of scope** for this issue.
- **Underscore-vs-space title collision handling beyond Wikipedia parity.** We mirror Wikipedia's
  behavior (underscore and space interchangeable); we do not add disambiguation for the rare title
  containing a literal underscore (AC7 records this).

---

## Success metric

The fix is successful when, for Topic URLs the app produces or shows:

- **Zero `%20`-for-space Topic URLs** are produced by `topicHref` or shown in the address bar for
  in-app navigation to multi-word topics (measured: no `%20` in the title segment of any
  `topicHref`-built URL in the AC test matrix; manual spot-check of the address bar shows underscores).
- **100% static/runtime path agreement** — every seeded multi-word title's pre-built static path
  equals its runtime href (AC5 holds for all `SEEDED_TITLES`).
- **No round-trip or reserved-char regressions** — all AC round-trip assertions (AC3, AC6, AC9, AC10)
  pass, i.e. every URL the app emits decodes back to the title it was built from.

(Analytics is deferred; these are verification-time conditions QA & Review checks, not runtime
telemetry.)

---

## Open questions / assumptions

- **Assumption — underscore/space interchangeability (AC7).** A title containing a literal underscore
  and a title containing a space both serialize to `_` in the URL and both parse back to a space. This
  matches Wikipedia (where underscore and space are the same in titles) and is treated as correct, not
  a collision to resolve. If a future title legitimately needs a distinct literal underscore, revisit.
- **Assumption — only space↔underscore is special-cased.** Every other character keeps standard
  `encodeURIComponent`/`decodeURIComponent` behavior. Reserved characters (`&`, `?`, `#`, `/`, `+`, …)
  remain percent-encoded so the title is always a single, unambiguous path segment.
- **Assumption — `%20` is a back-compat input, not a canonical output (AC9).** The app emits underscore
  URLs; `%20` URLs continue to resolve because the parse path decodes `%20` to a space. We do not add a
  redirect from `%20` to underscore here (the canonicalization redirect is #13's territory).
- **Open (Product) — first-letter capitalization normalization.** Should `/topic/san_francisco` resolve
  to the same topic as `/topic/San_Francisco` (Wikipedia's first-letter case-insensitivity)? Probably
  yes eventually, but it is a distinct behavior (title normalization, not URL encoding) and is out of
  scope here. Flagged for a future issue.

---

## Hand-off

- **UX:** No new screens. One flow note: confirm the expected address-bar reading
  (`/topic/San_Francisco/`) for multi-word topics, and that wikilinks visibly land on the underscore
  URL — this is the user-visible surface to evaluate (AC2, AC8).
- **Development:** Implement the bidirectional space↔underscore encoding in `topicHref` /
  `titleFromPathname` (`lib/wiki/topicRoute.ts`) and align `staticTopicParams()` (`lib/data/seed.ts`)
  to the same convention; add the round-trip + reserved-char + static/runtime-agreement tests (AC12).
  Keep `encodeURIComponent`/`decodeURIComponent` for everything except the space↔underscore special
  case. Ensure the parsed (space-form) title is what flows to `getTopicByTitle` and `titleToQid` in
  `app/topic/TopicView.tsx`.
