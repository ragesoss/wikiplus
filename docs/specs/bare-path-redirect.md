# Spec: Bare-path fallback — redirect `/<Title>` to `/topic/<Title>/`

**Issue:** [#13](https://github.com/ragesoss/wikiplus/issues/13) · **Type:** build (routing — client-side fallback redirect) · **Status:** spec
**Owner:** Product · **Feeds:** UX (flow note), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#11](https://github.com/ragesoss/wikiplus/issues/11) (`titleToSlug` encoding seam — shipped) · **Relates to:** [#12](https://github.com/ragesoss/wikiplus/issues/12) (navbar search), [#1](https://github.com/ragesoss/wikiplus/issues/1) (title routing)

---

## Problem & user value

A visitor who types, pastes, or follows a link to a **bare title path** — e.g. `/San_Francisco` — hits
a dead end today. GitHub Pages serves `404.html` (a copy of the `/topic/` SPA shell, via
`cp out/topic/index.html out/404.html` in `deploy.yml`) for any unmatched path, the shell boots
`TopicView`, but `titleFromPathname` only matches `/topic/<Title>` — so a bare `/<Title>` resolves to
`routeTitle = null`, no `?qid=` is present, and `TopicView` falls straight to `resolveError`. The user
sees a not-found state for a path that obviously *means* a Wikipedia article.

The canonical Topic URL is and stays `/topic/<Title>/`, paralleling Wikipedia's `/wiki/<Title>` (owner
directive; `docs/ARCHITECTURE.md`, "Internal-link resolution"). The `/topic/` prefix is **deliberately
kept** so the namespace has room for future non-article views — the way `/wiki/` on Wikipedia coexists
with `/wiki/Special:…`, `Help:…`, etc. But a **bare title is the most common shorthand** a reader
reaches for ("just put the topic after the slash"), and it is the most natural thing to type or paste.
Wikipedia itself honors this affordance: a bare `en.wikipedia.org/San_Francisco` is not the canonical
URL, yet it resolves rather than 404ing.

**User value:**
- **Shorthand + shareable URLs.** `wikiplus/<Title>` is shorter and more memorable than
  `wikiplus/topic/<Title>/`; it is the form a person guesses or dictates.
- **A not-found becomes a useful landing.** A path that today dead-ends instead lands on the matching
  Topic page (article + curated clips) — the product's whole point — instead of an error.
- **Parity with Wikipedia's prefix model, with room to grow.** We get the bare-title affordance *and*
  keep `/topic/` canonical so future `/<section>` views (e.g. a directory, an about page, a creator
  profile) are not foreclosed.

---

## The reserved-prefix allowlist decision — *the central decision of this spec*

The bare-path rule is "any unmatched single-segment path is a Topic title." That rule is only safe if
it can **never hijack a real or future route.** This section is the **source of truth Development
implements against**; the allowlist is the contract, not the redirect mechanism.

### The rule (normative)

On boot of the SPA shell (the `404.html`/not-found path), apply the redirect **iff all** of the
following hold for `location.pathname` (after stripping `basePath` and a single trailing slash):

1. The path is a **single non-empty segment** — exactly `/<segment>` with no further `/`. A
   multi-segment path (`/foo/bar`) is **never** treated as a bare title (see Scope → "Multi-segment").
2. The segment is **not reserved** (the allowlist below).
3. The path is **not already under `/topic`** (loop guard — a `/topic/...` path is the canonical route
   and is handled by the existing catch-all, never by this rule).

If all three hold, redirect to `topicHref(slugToTitle(segment))` — i.e. `/topic/<segment>/` with the
segment re-encoded through #11's `titleToSlug` so `/Multi Word` and `/Multi_Word` both land on
`/topic/Multi_Word/`. If **any** fail, the path is **not** a bare title: fall through to the existing
behavior (canonical routes render; a genuinely unmatched path degrades to a graceful not-found).

### What is RESERVED (never treated as a bare title)

| Reserved | Why |
| --- | --- |
| `/` (empty segment / the home path) | Home (`app/page.tsx`). |
| `/topic` and `/topic/...` | The canonical Topic namespace. Already routed; the loop guard. |
| `/contribute` | Existing route (`app/contribute/page.tsx`). |
| `/_next/...` | Next.js framework + chunk assets. |
| Any segment containing a **`.`** (a file extension) | Static assets: `/.nojekyll`, `favicon.ico`, `*.js`, `*.css`, `*.png`, `*.txt`, `/404.html`, etc. A real article title can contain a dot, but a single bare path segment with a dot is overwhelmingly an asset request; treating it as reserved is the safe default (a dotted title is still reachable via its canonical `/topic/<Title>/`). Record as an assumption. |
| Reserved namespace forms (any segment containing a `:`) | `Special:…`, `Help:…`, `File:…`, `Category:…` and the like are **not** wiki+ Topic pages (the article-link rewrite already routes `:`-bearing links to Wikipedia, not `/topic/`). A bare `/Help:Contents` must not become `/topic/Help:Contents/`. |

The list is expressed as a **reserved-prefix / predicate allowlist**, not an enumerated list of every
asset — `_next`, `.`-extension, and `:`-namespace are predicates so the rule is robust to assets and
routes we have not named.

### Rule for adding future `/<section>` views — *future-proofing*

This is the policy that keeps the rule safe as the app grows:

> **Every new top-level route added under `app/<section>/` MUST be added to the reserved allowlist in
> the same change.** A new top-level section (e.g. `app/about/`, `app/directory/`, `app/creators/`) is
> by definition a reserved prefix, not a bare title. The allowlist lives in **one place** (a single
> exported constant/predicate Development chooses the home for — e.g. alongside the redirect helper in
> `lib/wiki/topicRoute.ts` or a small `lib/routing/reserved.ts`) so the contract is a single source of
> truth, and adding a route is a one-line edit there. Development should make the failure mode loud:
> the allowlist is colocated with a comment pointing back to this spec, and the AC test (AC8) asserts
> every current top-level route is reserved, so a future route added without updating the allowlist is
> caught by a failing test rather than by a hijacked URL in production.

The default for an unmatched bare segment is **"it's a Topic title"** — that is the feature. The
allowlist is the finite, maintained set of exceptions. New sections join the exceptions; everything
else is a title.

---

## Scope

A **client-side** redirect (static export = no server, no middleware, no runtime redirects — the
redirect *must* run in the browser; `docs/ARCHITECTURE.md`, "Prototype phase → routing"):

1. **The bare-segment → `/topic/<segment>/` redirect.** On the SPA-shell / not-found boot, if
   `location.pathname` passes the allowlist rule above, `router.replace(topicHref(slugToTitle(segment)))`.
   Decoding through `slugToTitle` then re-encoding through `titleToSlug` (inside `topicHref`)
   normalizes the segment to the canonical encoding (#11) — so a pasted `/Multi_Word` and a typed
   `/Multi Word` both arrive at `/topic/Multi_Word/`.
2. **The reserved-prefix allowlist** (the section above), in one place, future-proof for `/<section>`.
3. **Query string + hash preservation.** A bare path may carry a `?…` and/or `#…` (e.g. a deep link to
   a section anchor). The redirect preserves them onto the `/topic/<Title>/` URL so the destination can
   honor them (e.g. `#sec-…` article anchors).
4. **Loop-guarding.** The redirect target is under `/topic/`, which is reserved, so the rule cannot
   re-fire on the destination. The rule must also be a no-op for paths it doesn't own, so it never
   competes with the existing `/topic` catch-all or the `?qid=` canonicalization in `TopicView`.
5. **Local-dev ⇄ Pages parity.** The redirect must fire in **both** the GitHub Pages static export
   (where the entry point is `404.html` = the copied SPA shell) **and** local `next dev` (where an
   unmatched path renders Next's not-found). The likely shape (Development's call) is an
   `app/not-found.tsx` that runs the same client redirect, so the one code path covers both — but the
   spec requires only the *behavior parity*, not the file.
6. **Graceful not-found preserved.** A path the rule does **not** redirect (reserved, multi-segment, or
   a bare title that turns out not to be a real topic) must end in a graceful not-found state — never an
   infinite spinner and never a redirect loop.

This spec sets *what* must happen and the testable conditions; it does **not** dictate the
implementation (the file that hosts the redirect, the exact predicate code, `replace` vs `push` beyond
the recommendation in Open questions) — that's Development's call, subject to the acceptance criteria.

### Multi-segment / deep paths (defined behavior)

Only a **single bare segment** is treated as a title. A multi-segment path that is **not** under a
reserved prefix — e.g. `/foo/bar` — is **not** redirected (it is not a wiki+ Topic, and guessing which
segment is the "title" is ambiguous and would mask real broken links). It falls through to the graceful
not-found. (`/topic/<Title>/` is two segments but is the canonical route, served by the existing
catch-all — not by this rule.) This keeps the rule narrow and predictable: bare title = exactly one
unreserved segment.

---

## Acceptance criteria

> Each item is objectively checkable by an automated test (the allowlist predicate + redirect-target
> computation are pure functions Development can unit-test) or by a stated manual step on the deployed
> Pages build / local `next dev`. "Bare path" = a single-segment path not under `/topic`.

1. **Bare title redirects and renders (hard load).** Hard-navigating (cold load / refresh / paste-in)
   to `/San_Francisco` results in the address bar reading `/topic/San_Francisco/` and the **San
   Francisco Topic page rendering** (article + curated/candidate clips, or the empty-state for an
   unseeded-but-valid topic) — not an error state and not an infinite spinner. (Manual on Pages, since
   the path exercises the `404.html` fallback.)

2. **Reserved paths are NOT redirected — home, contribute, topic, framework, assets.** None of the
   following is rewritten to a `/topic/...` URL, and each behaves exactly as today:
   - `/` renders the home page.
   - `/contribute` renders the contribute page.
   - `/topic/Cellular_respiration/` renders the topic directly (no extra redirect hop).
   - `/topic` (the bare shell / `?qid=` entry) behaves as today.
   - `/_next/static/...` and any asset request (a segment containing `.` — `/favicon.ico`,
     `/.nojekyll`, `/404.html`) is served/handled as an asset, never redirected to `/topic/`.
   - A `:`-namespace bare path (`/Help:Contents`, `/Special:Random`) is **not** rewritten to
     `/topic/Help:Contents/`; it degrades to graceful not-found.
   Programmatic form: the allowlist predicate returns "reserved" (no redirect) for each of these paths,
   and "bare title" only for genuine single unreserved segments.

3. **Query string + hash preserved through the redirect.** Redirecting `/San_Francisco?foo=bar#sec-history`
   produces `/topic/San_Francisco/?foo=bar#sec-history` (query and hash carried onto the destination,
   in that order). A bare path with only a hash (`/San_Francisco#sec-history`) preserves the hash; with
   only a query, preserves the query.

4. **No redirect loop.** The redirect fires **at most once** per navigation: the destination is under
   the reserved `/topic` prefix, so the rule does not re-fire on it. Loading `/San_Francisco` results in
   exactly one history-replacing hop to `/topic/San_Francisco/` and then a stable rendered page — no
   oscillation, no growing history, no repeated network/render churn. (Verifiable: the destination path
   is reserved by the predicate, so `shouldRedirect(target) === false`.)

5. **A bare path that isn't a real topic ends in a graceful not-found (no loop, no infinite spinner).**
   A bare `/Qwxzy_Not_A_Real_Article` redirects once to `/topic/Qwxzy_Not_A_Real_Article/`; the Topic
   page then resolves the title, finds no Wikipedia article (QID resolution fails), and shows the
   **graceful not-found / resolve-error state** that `TopicView` already renders — a finite, readable
   end state, not a spinner that never resolves and not a redirect loop. (The redirect's job is to route
   the path to the Topic resolver; the Topic resolver owns the not-found UX, unchanged by this spec.)

6. **Redirect uses #11's encoding (space ⇄ underscore).** Both `/Multi Word` (typed, with a literal
   space) and `/Multi_Word` (pasted, with an underscore) redirect to **`/topic/Multi_Word/`** — the
   segment is normalized through `slugToTitle` → `titleToSlug` (#11's seam), not reinvented. The
   resolved title fed to the Topic page is the clean space-form `"Multi Word"`. A reserved-character
   title in the bare segment round-trips through the same encoding (no double-encoding, no path break).

7. **Multi-segment / deep paths defined.** `/foo/bar` (multi-segment, no reserved prefix) is **not**
   redirected — it falls through to the graceful not-found. Only a single unreserved segment is treated
   as a title. `/topic/<Title>/` (two segments, reserved prefix) is served by the existing catch-all,
   not by this rule (no double redirect).

8. **Allowlist covers every current top-level route, future-proof predicate.** An automated test
   asserts that each currently shipped top-level route (`/`, `/contribute`, `/topic`) and each predicate
   class (`/_next/…`, a `.`-extension segment, a `:`-namespace segment) is classified **reserved** by
   the allowlist, and that a representative plain bare segment (`/San_Francisco`) is classified **bare
   title**. The allowlist lives in a single place with a comment pointing to this spec, so adding a
   future `/<section>` route is a one-line edit. (Enforces the future-proofing policy: a new top-level
   route added without updating the allowlist is caught by this test.)

9. **Static-export ⇄ local-dev parity.** The redirect behavior in AC1–AC7 is **equivalent** on the
   GitHub Pages static export (entry via `404.html` = the copied SPA shell) and in local `next dev`
   (entry via Next's not-found). The same bare path lands on the same `/topic/<Title>/` destination in
   both. (Manual: verify `/San_Francisco` on the deployed Pages URL and on `localhost` dev.)

10. **No regression to existing routing.** In-app `<Link>` navigation, the wikilink delegated click
    handler, the `?qid=` → title canonicalization, and direct hard loads of seeded `/topic/<Title>/`
    pages all continue to work unchanged — the bare-path rule only acts on paths that would otherwise be
    a not-found, and is a no-op on every already-handled route.

11. **Tests ship with the change.** The change ships with automated tests covering at least: the
    allowlist predicate (AC2/AC8 — reserved vs bare title for each class), the redirect-target
    computation including #11 encoding (AC6), query/hash preservation (AC3), the multi-segment no-op
    (AC7), and the loop-guard (AC4 — `shouldRedirect(target) === false`).

---

## Out of scope

- **Dropping the `/topic/` prefix.** `/topic/<Title>/` stays the canonical Topic URL; this spec adds a
  fallback *to* it, it does not replace it. (Owner directive; `docs/ARCHITECTURE.md`.)
- **Server-side / middleware redirects.** The prototype is a static export with no server; the redirect
  is client-side by necessity. (The production read-path will render unknown titles server-side and can
  do a real HTTP redirect then — out of scope here.)
- **The navbar search (#12).** A separate entry path to Topic pages; not built here, though it shares
  the #11 encoding seam.
- **The #11 space↔underscore encoding itself.** Already shipped; this spec **reuses** `titleToSlug` /
  `slugToTitle` / `topicHref`, it does not re-implement them.
- **First-letter capitalization normalization.** `/san_francisco` vs `/San_Francisco` — Wikipedia's
  first-letter case-insensitivity is a distinct title-normalization behavior, explicitly out of scope
  (carried over from #11's Open questions). The bare-path rule redirects whatever case it receives; the
  Topic resolver's title handling is unchanged.
- **Canonicalizing `/topic/San%20Francisco/` → underscore form.** Legacy `%20` URLs already resolve via
  #11's parse path; adding a URL-canonicalization redirect for them is not part of this issue.

---

## Success metric

The change is successful when:

- **A bare single-segment title URL resolves to its Topic page rather than a dead 404.** A hard load of
  `/San_Francisco` lands on `/topic/San_Francisco/` and renders the Topic page (AC1) — the previously
  dead bare-title path is now a useful landing.
- **Zero reserved routes hijacked.** No path in the reserved allowlist (`/`, `/contribute`, `/topic…`,
  `/_next/…`, `.`-extension assets, `:`-namespace) is ever rewritten to `/topic/…` (AC2/AC8) — the rule
  adds reach without taking any existing route hostage.
- **Zero redirect loops and zero infinite spinners** for any path the rule touches, including bare paths
  that turn out not to be real topics (AC4/AC5).

(Analytics is deferred; these are verification-time conditions QA & Review checks, not runtime
telemetry. If/when traffic exists, a natural runtime metric is "bare-title entries that resolved to a
Topic page vs. ended in not-found.")

---

## Open questions / assumptions

- **Open (Product → confirmed here) — the future `/<section>` allowlist policy.** Confirmed: the
  default for an unmatched bare segment is "Topic title"; every new top-level route is added to the
  single-source allowlist in the same change, enforced by AC8's test. Revisit only if we ever want a
  bare segment to mean something other than a title (no such case planned).
- **Recommendation — `replace`, not `push`.** The redirect should use `router.replace` (no extra
  history entry), so the user's Back button returns to wherever they came from, not to the transient
  bare URL that immediately redirected. (Mirrors the existing `?qid=` canonicalization, which already
  uses `router.replace` in `TopicView`.) Recorded as the recommended default; Development confirms.
- **Assumption — a `.`-bearing bare segment is an asset, not a title.** A real article title *can*
  contain a dot (e.g. "R.E.M."), but a single bare path segment with a dot is overwhelmingly an asset
  request (`/favicon.ico`, `/404.html`). We treat dotted bare segments as reserved (no redirect); such
  a title remains reachable via its canonical `/topic/<Title>/` and via in-app navigation. If this
  proves too aggressive, narrow the predicate to a known extension allowlist in a follow-up.
- **Assumption — `:`-namespace bare segments are not Topics.** Consistent with the article-link rewrite,
  which routes `:`-bearing links to Wikipedia, not to `/topic/`. A bare `/Help:Contents` is not a wiki+
  Topic; it degrades to not-found rather than redirecting.
- **Assumption — single-segment only.** Treating only one unreserved segment as a title (AC7) is a
  deliberate narrowing to avoid masking genuinely broken multi-segment links and to keep the rule
  unambiguous. If a future need arises for multi-segment titles, revisit.

---

## Hand-off

- **UX:** No new screens. One flow note to evaluate: the **transition a user experiences** when hitting
  a bare URL — does it feel like "it just worked" (a single `replace` hop landing on the Topic page,
  AC1) rather than a visible bounce or flicker? And confirm the **graceful not-found** for a bare
  non-topic (AC5) reads as a dead-end-handled-well, not an error. The user-visible surface is the
  redirect smoothness + the not-found copy, both already-built states this spec routes into.
- **Development:** Implement the **allowlist predicate** (single source of truth, colocated with a
  pointer to this spec — `lib/wiki/topicRoute.ts` or a small `lib/routing/reserved.ts`, your call) and
  the **client redirect** that fires on the SPA-shell / not-found boot in **both** static export
  (`404.html`) and local dev (likely a shared `app/not-found.tsx` running the same redirect). Reuse
  #11's `slugToTitle` / `titleToSlug` / `topicHref`; do not reinvent the encoding. Use `router.replace`
  (Open questions). Preserve query + hash (AC3). Guarantee the loop guard via the reserved `/topic`
  prefix (AC4). Add the unit tests in AC11. Record the routing decision in `docs/ARCHITECTURE.md`
  ("Prototype phase → routing"): the bare-path → `/topic/` rule and the reserved-prefix allowlist
  (issue #13 deliverable).
