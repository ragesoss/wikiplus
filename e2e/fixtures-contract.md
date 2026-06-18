# e2e fixture contract (issue #47)

The Playwright suite runs against the **real Node SSR server** (`yarn build && yarn start`, per
`playwright.config.ts`) — not a mocked app. The sandbox has **no network egress**, so every external
HTTP call the app makes is intercepted with `page.route(...).fulfill(...)` and answered with a
deterministic, *complete* shape. "Complete" means: the fields the app actually reads, in the shape it
reads them — not just enough bytes to pass by accident. A stub that under-feeds a correct read path
sends the Topic page to its resolve-error / empty state and reds the whole core loop.

The shared builders live in **`e2e/fixtures.ts`** (`stubCommon`, `actionApiBody`, `wikidataBody`,
`youtubeBody`, `RESP_YT_ITEMS`). The sign-in helper is **`e2e/auth.ts`**; the ephemeral seeded DB is
**`e2e/db-server.ts`** (booted in `e2e/global-setup.ts`). **Keep this doc and `fixtures.ts` in
lock-step** — a new spec should be able to write conformant stubs from this doc alone.

---

## Environment the webServer needs (set in `playwright.config.ts` → `webServer.env`)

As of issue #45 the data layer is **shared Postgres reached through Server Actions**, and as of issue
C contribution is **auth-gated**. The real server build therefore needs:

| Var | Why | How it's supplied |
| --- | --- | --- |
| `DATABASE_URL` | `store.*` Server Actions read/write Postgres. Without it every store call rejects and the Topic page never resolves. | `e2e/global-setup.ts` boots an **ephemeral, seeded** Postgres (system `initdb`/`pg_ctl`), applies `yarn db:migrate` (the deploy path), and points the webServer at it. Seed = the three demo topics + the curated Photosynthesis clips (`lib/db/seed.ts`). |
| `AUTH_SECRET` | Auth.js v5 errors `MissingSecret` at startup without it; it also signs the JWT the sign-in helper mints. | Fixed throwaway secret, shared via `E2E_AUTH_SECRET` in `e2e/db-server.ts`. |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | Build-time **inlined**; when set, the candidate source's `isEnabled()` is true so the live suggestion path runs (then the search call is stubbed). When unset, suggestions are always empty and the empty-state tests can't see candidates. | Non-empty placeholder; the real `googleapis.com/youtube/v3/search` call is intercepted. |

---

## Routes & required response shapes

### 1. `www.wikidata.org/w/api.php` — QID → enwiki title
Consumed by `qidToTitle` (`lib/wiki/article.ts`) on the `?qid=` route. Reads
`entities[QID].sitelinks.enwiki.title`.

```jsonc
{ "entities": { "Q11982": { "sitelinks": { "enwiki": { "title": "Photosynthesis" } } } } }
```
Builder: `wikidataBody({ Q11982: "Photosynthesis" })`.

### 2. `en.wikipedia.org/w/api.php` — title → canonical title + pageid + displaytitle + QID
Consumed by `resolvePage` (`lib/wiki/article.ts`) on the `/topic/<Title>/` route. **`resolvePage`
treats a page with no `pageid` (or a `missing` flag) as UNRESOLVED** and returns all-null — which
sends the route to its not-found / resolve-error state. So a stub returning only
`pageprops.wikibase_item` (the old shape) breaks every unseeded title.

Required per page (`query.pages["1"]`): **`pageid`** (presence marks it as existing) and **`title`**
(canonical, keys URL/slug/store/fetch). Read when present: **`displaytitle`** (rendered heading,
defaults to `title`) and **`pageprops.wikibase_item`** (the under-the-hood store key).

```jsonc
{ "query": { "pages": { "1": {
  "pageid": 1, "ns": 0,
  "title": "Photosynthesis", "displaytitle": "Photosynthesis",
  "pageprops": { "wikibase_item": "Q11982" }
} } } }
```
Builder: `actionApiBody({ title: "Photosynthesis", qid: "Q11982" })` (optional `displaytitle`).

### 3. `en.wikipedia.org/api/rest_v1/page/html/<Title>` — Parsoid article HTML
Consumed by `fetchFullArticle` (`lib/wiki/article.ts`). Returns **`text/html`** — the Parsoid section
stream the app sanitizes (DOMPurify), link-rewrites, and walks into lead + sections. This stub is
**spec-specific** (each spec ships its own fixture HTML for what it asserts), so `stubCommon` does NOT
register it — the caller adds its own `page.route("**/api/rest_v1/page/html/**", …)`. Marker shapes the
app reads: `<section data-mw-section-id>`, `h2/h3/h4` headings, `sup.mw-ref`/`.mw-cite-backlink`
citations, `table.infobox` / `table.wikitable`, `img.mwe-math-fallback-image-*`, `.hatnote`.

### 4. `en.wikipedia.org/w/rest.php/v1/search/title` — typeahead completions
Consumed by `fetchTopicSuggestions` (`lib/wiki/suggest.ts`). Reads `pages[].title` and optional
`pages[].description`. Used only by the navbar-search spec (`topic-search.spec.ts`), which keeps its
own query-filtered stub.

```jsonc
{ "pages": [ { "title": "Catalonia", "description": "autonomous community in Spain" } ] }
```

### 5. `www.googleapis.com/youtube/v3/search` — candidate videos
Consumed by `youtubeSource.search` (`lib/candidates/youtube.ts`) once the key is set (see env above).
Reads `items[].id.videoId` and `items[].snippet.{title,description,channelTitle,channelId,thumbnails}`.
The pipeline (`lib/candidates/`) then dedups, section-matches, and caps the **General** band at 5.

```jsonc
{ "items": [ { "id": { "kind": "youtube#video", "videoId": "resp001" },
  "snippet": { "title": "How cells make energy", "description": "",
    "channelTitle": "Science Sketch", "channelId": "UC_resp001",
    "thumbnails": { "high": { "url": "https://i.ytimg.com/vi/resp001/hqdefault.jpg", "width": 480, "height": 360 } } } } ] }
```
Builder: `youtubeBody([...])`. `RESP_YT_ITEMS` is a fixed 5-item set whose captions share no section
keyword → all 5 land in the General band → exactly "5 auto-suggestions" (backs the count assertions).

---

## Signed-in tests (issue C gate)

The contribute entry points (**Add / Curate / Dismiss**) are auth-gated: a logged-out click opens the
`LoginPromptDialog`, not the real modal / a real dismiss. Tests that assert the **real** Add modal,
Curate modal, or dismiss-decrement call `signIn(page, baseURL)` (from `e2e/auth.ts`) **before**
`page.goto`. `signIn` mints the exact Auth.js v5 JWT session cookie the server trusts (via the app's
own `@auth/core/jwt.encode`, salted by the cookie name, signed with `AUTH_SECRET`) for the e2e
contributor row seeded in `db-server.ts`. This is a test **precondition** — it exercises no OAuth flow.
The dismiss test uses an **unseeded** topic so `recordDismissal` no-ops against the shared DB (the
count still decrements via the in-session optimistic hide) — no cross-test contamination under
`fullyParallel`.

## Robust assertions against the article body

The article HTML is injected via `dangerouslySetInnerHTML` and React **re-renders** it shortly after
first paint (scroll-sync state, table-overflow flag, candidate load). A one-shot
`locator.evaluate(el => getComputedStyle(el)…)` / `boundingBox()` can read a **detached** old node and
report empty/null. Prefer **re-resolving** assertions: `toHaveCSS`, `toHaveAttribute`, or `expect.poll`
that reads the box/handle fresh each attempt. The scroll-sync `.sec.active` highlight is rAF-debounced
and needs **real wheel events** (scroll the heading into view, then `page.mouse.wheel` in a small loop)
— a single synthetic `scrollIntoViewIfNeeded` jump won't trip it.
