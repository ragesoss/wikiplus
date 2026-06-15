# wiki+ — Architecture

This document records the architectural decisions and the reasoning behind them. The
guiding constraints: **wide adoption, efficient use of modest server resources, rapid
vibe-coded iteration, and operation by AI agents.**

## Guiding principle: the read path is the scale lever

wiki+ is a wiki-shaped workload — topic pages are read **far** more than they are written.
The dominant scalability lever is therefore **not** the choice of language or framework; it
is **how cheaply we can serve reads.** Wikipedia itself serves the overwhelming majority of
its traffic from cache on comparatively modest origin infrastructure.

So the architecture treats a Topic page as a **cacheable, near-static shell** by default, and
reserves dynamic server compute for the things that genuinely need it: writes (promote / add /
dismiss), authentication, and clip pagination.

Concretely:

- The Topic **shell** — topic title + lead, the curated clips, and the (cached) candidate
  suggestions — is rendered with **Next.js static generation + ISR** (on-demand revalidation):
  generated once, served from cache to everyone, regenerated only when its data changes (a new
  curation) or its cached inputs go stale.
- The **full Wikipedia article body is fetched and rendered client-side** (see *Article
  rendering*), so the heavy article HTML never touches our origin — it comes from Wikipedia's
  own CDN, and our cached pages stay small.
- Interactivity (scroll-sync, curate modals, promote/dismiss) lives in **client components**;
  writes go through **Server Actions / route handlers** (auth-gated); "load more" clip
  pagination is a small API route.
- **Cloudflare (free tier) sits in front of the VPS** for edge caching of the shell, TLS, and
  DDoS protection. Most read requests are answered at the edge and never reach the origin.

## Stack

| Concern        | Choice                                  | Why |
|----------------|-----------------------------------------|-----|
| Framework      | **Next.js 15 (App Router), React 19, TypeScript** | Smoothest vibe-coding loop, first-class static/ISR for the read path; **Server Actions** for the write flows. (Node 24 LTS locally.) |
| Database       | **Postgres**                            | Proven, scales with read replicas, strong relational fit for Topic/Clip. |
| ORM            | **Drizzle ORM**                         | Lightweight, low-overhead, explicit SQL-shaped API — efficient and easy for agents to reason about (vs. heavier Prisma). |
| Styling/UI     | **Tailwind CSS** (bespoke "Indigo Press" components) | Hand-built to the committed design; optional **headless primitives** (e.g. Radix) for dialogs/menus — not shadcn's styling, so we keep the brand identity. |
| Article render | **Client-side** (MediaWiki REST HTML + **DOMPurify**) | Fetch + sanitize + link-rewrite the article in the browser; keeps heavy HTML off our origin (Wikipedia's CDN serves it). See *Article rendering*. |
| Cache / shared state | **Redis**                         | Shared ISR cache handler (multi-instance), rate-limiting, and cached candidate-suggestion sets. Included from day one. |
| Auth           | **Auth.js (NextAuth)** — OAuth only      | MVP: **Wikimedia** sign-in only (custom OAuth2 provider). Google (built-in provider) planned next. No passwords to store or secure. |
| Reverse proxy  | **Caddy** (origin) + **Cloudflare** (edge) | Caddy gives automatic TLS and simple config at the origin; Cloudflare does edge caching. |
| Packaging      | **Docker Compose**                      | Dev/prod parity, single-command bring-up: app + Postgres + Redis + Caddy. |

## Deployment

Self-hosted on a **single VPS** to start, fully containerized via Docker Compose
(`app`, `postgres`, `redis`, `caddy`). This is the most resource-efficient option per
dollar at steady load and keeps full control. Cloudflare in front means one modest box can
serve a lot of cached read traffic.

Scaling out later is intentionally a **config change, not a rewrite** — see the ISR cache
note below.

### Self-hosted Next.js gotcha to design around (decide now, not later)

Next.js ISR's default cache is **per-instance, on local disk**. The moment you run more
than one app container (or replace one during a deploy), instances hold divergent caches
and serve stale/inconsistent pages, and on-demand revalidation only invalidates the
instance that received the request.

**Decision:** wire a **Redis-backed shared ISR cache handler** from day one (Next.js
supports a custom `cacheHandler`). With a shared cache, horizontal scaling and zero-downtime
deploys "just work," and revalidation is global. Building this in at the start costs little;
retrofitting it under load is painful.

## Data model (initial)

Keyed on stable identifiers, normalized, minimal.

- **topic**
  - `id` (internal PK)
  - `wikidata_qid` (unique) — **canonical identifier**, stable across renames/languages
  - `title`, `lang` — display attributes for the primary article
  - `article_index` — cached **lightweight** article data the server needs: the lead (for the
    shell + SEO) and the section list/headings (for matching candidates and the TOC). The full
    article HTML is **not** stored — it's fetched client-side (see *Article rendering*).
  - `created_at`, `updated_at`
- **clip** (a curated, contextualized social video)
  - `id`
  - `topic_id` → topic
  - `video_url`, `provider` (tiktok/instagram/youtube/vimeo/…), `provider_video_id`
  - `orientation` (`vertical` | `horizontal`) — drives the embed aspect ratio (9:16 vs 16:9)
  - `embed_meta` — cached oEmbed result (title, thumbnail, author, duration, embed HTML/params)
  - **creator fields** — `creator_handle`, `creator_name`, `creator_platform`, `creator_url`,
    `creator_followers` (cached at curation time; the personality behind the clip)
  - `context_note` — the curator's contextualization (required; **the core value**) —
    separates the creator's opinion/perspective from the factual content
  - `stance` — enum: `explainer` | `opinion` | `myth_busting` | `personal_experiment` | `mixed`
  - `accuracy_flag` — short label (e.g. "accurate", "minor slip", "opinion", "anecdotal") +
    optional longer note; how well the clip matches the source material
  - `timestamp_seconds` (nullable) — where the relevant part starts
  - `section_anchor` (nullable) — which article section it relates to (`general` = whole-topic).
    Stored as a heading **slug + heading text** so it can be re-resolved when the article
    changes; an orphaned anchor falls back to `general` (see *Article rendering*).
  - `upvotes` (cached count)
  - `vetted` (boolean) — light moderation flag. A `clip` row exists only once a human has acted
    (promote or add-by-link), so clips are curated by construction; auto-suggested candidates
    are **not** clip rows (see *Candidate suggestion*). `vetted` remains so we can hold a freshly
    added clip for review if needed.
  - `curator_id` → contributor (who promoted/added it)
  - `created_at`, `updated_at`
- **contributor** (the wiki+ curator — distinct from the external **creator** referenced above)
  - `id` (internal PK), `display_name`, `avatar_url`, `created_at`
  - identity comes from OAuth — see **Authentication & identity** below
- **account** (an OAuth identity linked to a contributor; one contributor may link several)
  - `id`, `contributor_id` → contributor
  - `provider` (`wikimedia` | `google`), `provider_account_id` (the provider's stable subject id)
  - cached profile bits from the provider (name, email if granted, avatar)
  - `unique(provider, provider_account_id)`
- **dismissed_candidate** (suppress a ruled-out suggestion so it doesn't resurface)
  - `id`, `topic_id` → topic, `provider`, `provider_video_id`, `contributor_id` → contributor,
    `created_at`
  - `unique(topic_id, provider, provider_video_id)`

> Auto-suggested **candidates are not stored as rows** — they're computed and cached per topic
> (see *Candidate suggestion*). Only a **promote** (→ `clip`) or **dismiss** (→
> `dismissed_candidate`) writes to the DB, so storage stays proportional to real curation.

> Creators are external people we reference and credit, stored inline on the clip for the MVP.
> If creator-level views (a creator's body of curated clips, follower trends) become a feature,
> promote them to their own `creator` table keyed by platform + handle.

**Why QID as the canonical key:** Wikipedia article titles change and differ per language;
Wikidata QIDs are stable, language-independent anchors. Keying Topics on QID makes future
multilingual support and article-rename resilience essentially free.

## Wikipedia integration

- **Identity:** resolve article title ↔ **Wikidata QID** (Wikidata API) at topic creation; QID
  is the canonical topic key.
- **Server-side, lightweight only:** the origin fetches and caches just what it needs in
  `topic.article_index` — the **lead** (cached shell + SEO) and the **section list / headings**
  (for matching candidates to sections and rendering the TOC). It does **not** fetch or store the
  full article HTML.
- **Refresh lazily:** rebuild `article_index` on revalidation / when stale; we only ever touch
  topics someone visited or curated — never a full mirror.
- **Etiquette:** descriptive **User-Agent / Api-User-Agent** identifying wiki+ and a contact,
  respect rate limits and `maxlag`, back off on errors — for both server and client requests.

## Article rendering (client-side)

The full article body is fetched and rendered **in the browser**, not on our origin:

- **Fetch:** the client requests rendered article HTML from the **MediaWiki REST API**
  (`/api/rest_v1/page/html/{title}`), which is **CORS-enabled** for anonymous GETs — so a direct
  cross-origin fetch is practical. (If an endpoint ever lacks CORS, proxy via a thin origin route.)
- **Sanitize:** run the HTML through **DOMPurify** before inserting it — never inject raw
  third-party HTML. Strip editor chrome (edit-section links, reference backrefs, unwanted navboxes).
- **Rewrite links to internal wiki+ topics:** article wikilinks (`/wiki/X`) are rewritten to the
  **canonical title-based Topic route `/topic/<Title>`** (paralleling Wikipedia's `/wiki/<Title>`;
  owner directive — see *Internal-link resolution* below), so navigation stays in wiki+ and every
  article becomes a portal into the topic graph (topics created on demand on visit). The **QID is
  resolved under the hood** on arrival (title→QID) and never appears in the address bar. Red links /
  non-article namespaces fall back to Wikipedia or are de-linked.
- **Why client-side:** keeps heavy article HTML off our origin (Wikipedia's CDN serves it), so
  cached pages stay small and the read path stays cheap.
- **SEO tradeoff (to handle):** the client-rendered body isn't in our initial HTML — acceptable,
  since the body is Wikipedia's text (we don't want to compete for it). We **server-render our
  unique surface** (topic title, lead, curated clips + context notes) into the cached shell for
  indexing. Revisit if discovery needs more.
- **Section anchoring:** the client maps each clip's `section_anchor` onto the live article's
  headings (slug + text), surviving edits, with a `general` fallback for orphans.

## Topic discovery & search

Topics are created on demand, so users need to *reach* uncurated ones. A search box resolves a
query to a Wikipedia article (MediaWiki `opensearch`/search API) → wiki+ topic (title→QID,
created on visit); internal wikilinks (above) are the other main path. This is what makes the
empty state matter — most arrivals land on an uncurated topic and are invited to curate it.

## Video handling — embed, never host

We **never store or stream video.** For each clip we resolve the URL via **oEmbed** (or the
provider's documented embed parameters), cache the returned metadata (`embed_meta`), and
render the provider's embed. We store only the reference plus metadata.

This is the single largest infrastructure cost we avoid — no storage, no egress bandwidth,
no transcoding — and it keeps the origin's job to "serve small cached HTML pages."

**Vertical-first, multi-platform.** The focus is short vertical clips, so embeds must render
cleanly at **9:16** as well as the traditional 16:9 (we store `orientation` to lay them out
correctly). Provider notes that affect integration:

- **YouTube** (incl. Shorts) and **Vimeo** — simple, token-free oEmbed; Shorts are ordinary
  YouTube videos shown in a vertical frame.
- **TikTok** — has a public oEmbed endpoint (returns a blockquote + script embed); usable
  without an app token, but the embed pulls TikTok's script at render time.
- **Instagram Reels** — oEmbed requires a **Facebook/Instagram app access token**, which is a
  real integration dependency to plan for (and a reason to cache `embed_meta` aggressively).

Because some embeds inject third-party scripts, render them lazily / behind a click-to-load
facade where possible — this protects the read path's speed and the page's privacy posture.

## Candidate suggestion & the empty state

Every topic begins with zero curations. To stay useful and seed the curation flywheel, the empty
state bootstraps the plus side with **auto-suggested, unvetted candidates** (`vetted: false`) plus
paths to curate. (Product behavior in [`TOPIC_PAGE_DESIGN.md`](TOPIC_PAGE_DESIGN.md).)

- **Auto-suggestion is multi-platform by design; YouTube-only in the MVP.** Build the candidate
  pipeline **platform-agnostic** (a pluggable source interface) so additional platforms slot in.
  At launch, seed the General bar from the **YouTube Data API search** for the topic; for inline
  section candidates, match candidate metadata (title/description/tags) against article section
  titles/keywords and surface the best single match per section.
- **TikTok auto-suggestion is deferred — pragmatic, not a design boundary.** There is no easy
  official TikTok search API today, so we don't auto-pull TikTok *yet*; the pipeline and frontend
  already accommodate TikTok candidates, and the source is enabled when a practical search path
  exists. In the interim, the UI offers a **"Search TikTok"** action that deep-links to TikTok
  (web/app) for a manual search; good finds come in via add-by-link. Other source buttons can
  follow the same launch-and-add pattern.
- **Add by link (logged-in).** A logged-in user pastes a **YouTube or TikTok share link**; we
  resolve it via **oEmbed** and start a curation for a clip auto-suggestion missed.
- **Promote / rule out.** A candidate becomes a curated clip when a curator writes its
  `context_note` and sets `stance` / `accuracy_flag` (flipping `vetted` to true); "not relevant"
  dismisses it. Browsing candidates is anonymous; **promoting or adding requires login**.

**Storage — cache, persist on action.** Candidates are **computed and cached per topic** (the
YouTube search + section matching, carrying `suggestion_source` + `match_reason`); they are
**not** written as `clip` rows. A `clip` row is created only when a user **promotes** a candidate
(→ a curated clip) or **adds** one by link; **dismissing** writes a `dismissed_candidate` row so
it doesn't resurface. This keeps the DB proportional to real curation, not to every browsed topic.
The **YouTube Data API search quota is expensive**, so cache candidate sets with a TTL and refresh
lazily (alongside `article_index`) — Redis is a natural home for these cached sets.

**YouTube Data API key.** Search uses a **public-data API key** — not OAuth and not a service account
(the YouTube Data API doesn't support service-account auth; OAuth is only for a *user's* private data,
which we never touch). The key is **API-restricted to YouTube Data API v3**. *Where it lives* is the real
decision: in the prototype it's a **browser key restricted by HTTP referrer** to `https://ragesoss.github.io/*`
(see *Prototype phase*). Because a client key is inlined into the static bundle and publicly readable, the
**referrer restriction plus a quota cap are the protection, not secrecy**. The production read-path should
move search **server-side** (key held as a server secret; the expensive quota shared + cached) — see
*Open questions*. Embedding needs no key — that's oEmbed/the facade.

## Authentication & identity

Login and user identity rely entirely on **OAuth — no passwords**.

- **MVP: Wikipedia / Wikimedia account only** — via Wikimedia's OAuth 2.0 (the
  `mediawiki.org` OAuth extension, authorized at `meta.wikimedia.org`). On-brand for a
  Wikipedia-adjacent product and ties curators to the wider Wikimedia community.
- **Planned next: Google** (standard OpenID Connect), and potentially other providers.

We implement this with **Auth.js (NextAuth)**, with Wikimedia configured as a **custom
OAuth/OIDC provider**; Google is a built-in provider we can switch on later with little work.
This resolves the earlier "Auth.js vs Lucia" question — Auth.js wins on first-class
multi-provider OAuth support, so launching single-provider costs us nothing later.

Design points:

- **Reading is anonymous; contributing requires login.** This keeps the cached read path
  free of any per-user/auth work — auth only matters on writes and the contributor's own views.
- **Identity model:** each successful OAuth login maps to an **`account`** row
  (`provider` + `provider_account_id`) belonging to a **`contributor`**. The MVP has a single
  provider, so each contributor has exactly one account — but the **`account`** table exists
  from the start so that adding Google (and **account linking/merge**) later is additive, not
  a rewrite of the core identity.
- **Sessions:** prefer **stateless JWT session cookies** so ordinary requests need no session
  lookup (consistent with the read-path-efficiency principle); use the Redis/Drizzle adapter
  for the account records and any server-side session needs.
- **Secrets:** the Wikimedia consumer key/secret (and later Google's client ID/secret) live in
  environment/secret config (Docker secrets), never in the repo.

## Licensing & attribution (must be handled, not an afterthought)

- **Wikipedia text is CC BY-SA 4.0.** Any Wikipedia content we display, quote, or excerpt
  requires **attribution** (credit + link back to the article and its history/license) and
  carries **share-alike** obligations on derivative text. The Topic page UX must include
  clear attribution and a link to the source article and license.
- **Wikimedia Commons images are individually licensed** (various CC licenses, often requiring
  attribution). When we display a Commons image we must show its **credit + license** and link to
  its file page — the article's text license does not cover its images.
- **wiki+'s own context notes:** decide and state the license under which contributor-written
  context notes are released (a permissive or share-alike CC license is the natural fit and
  keeps us compatible with the surrounding Wikipedia content). Capture contributor agreement
  to that license at submission time.
- **Embedded video** remains under its original platform/creator terms; we link out and rely
  on official embeds rather than redistributing.

## Open questions (to resolve before/while building)

- Exact ISR revalidation triggers and stale-after windows for `article_index` and candidate sets.
- How much of the page to server-render for **SEO** beyond title/lead/clips (the body is
  client-rendered).
- **DOMPurify allowlist** + which Wikipedia HTML to keep vs. strip (infoboxes, tables, math, navboxes).
  *Prototype decision (Topic Page v1, `lib/wiki/article.ts`):* the client fetches **`/api/rest_v1/page/html/{title}`** (Parsoid HTML, CORS-enabled), sanitizes with an **explicit DOMPurify allowlist** (prose, headings h1–h6, lists, links, `figure`/`figcaption`/`img`, basic tables; scripts/styles/iframes/forms dropped), then **strips editor chrome** post-parse (`.mw-editsection`, references/reflist, navboxes, `table.infobox`/`sidebar`, hatnotes). Tables are allowed through sanitize but **hidden in CSS** this round (`.wiki-body table { display:none }`) — full table/infobox/math rendering is deferred. Sections are derived by walking the flattened Parsoid `<section>` stream: lead = everything before the first `h2`; each `h2`/`h3`/`h4` opens a section with a **stable kebab slug** (`slugify`, deduped), used for `#sec-<slug>`/`#h-<slug>` anchors, the TOC, and clip→section matching. Navigational sections (References/See also/External links/Further reading/etc.) are dropped.
- **Internal-link resolution** edge cases: red links, disambiguation pages, non-article namespaces.
  *Prototype decision (Topic Page v1; owner directive — canonical title URLs):* article-namespace
  wikilinks are rewritten to the **canonical title route `/topic/<Title>/`** (encoded title, trailing
  slash to match `trailingSlash: true`, basePath-prefixed for the raw `<a href>` so a hard navigation
  resolves under the Pages subpath). The decoded title is also stashed in **`data-topic-title`** so a
  delegated click handler in `TopicView` routes ordinary left-clicks through the Next client router
  (no full reload); modified clicks fall through to the href. On arrival the **QID is resolved under
  the hood** (`titleToQid` via the Wikipedia `pageprops`/`wikibase_item` API, or the seeded store) and
  is **never shown in the address bar**. **Red links** (`.new`/`.mw-redlink`) and **namespaced links**
  (`File:`/`Help:`/`Category:` — any href with a `:`) keep an **absolute Wikipedia URL** opening in a
  new tab (`rel=noopener`); in-page anchors (cite/note refs) are **de-linked** to plain text. No
  wikilink ever produces a broken `/topic/` route. The legacy `/topic?qid=Q…` URL still works as a
  back-compat entry but is **canonicalized away**: `TopicView` resolves QID→title and `router.replace`s
  to the title URL.
  *Title ⇄ URL-slug encoding (#11, the canonical title-encoding seam):* the title path segment
  mirrors Wikipedia's `/wiki/<Title>`, where **a space renders as `_`** — `San Francisco` →
  `/topic/San_Francisco/`, not `%20`. Two helpers in `lib/wiki/topicRoute.ts` are the **single source
  of truth**: `titleToSlug(title)` = `encodeURIComponent(title).replace(/%20/g, "_")` (encode first so
  reserved chars `&`,`?`,`#`,`/`,`+` stay percent-encoded and an underscore is never double-encoded),
  and `slugToTitle(slug)` = `slug.replace(/_/g, " ")` then `decodeURIComponent` (so both `_` and a
  legacy `%20` decode to a space). `topicHref` builds via `titleToSlug`; `titleFromPathname` parses via
  `slugToTitle` and returns the clean **space-form** title that keys the store/QID lookup;
  `staticTopicParams()` (`lib/data/seed.ts`) emits slugs via the **same** `titleToSlug`, so a seeded
  topic's pre-built static path and its runtime href are byte-for-byte identical. The wikilink rewrite
  (`rewriteLinks`) decodes Wikipedia's underscore hrefs via `slugToTitle` so **`data-topic-title`
  carries the space-form title** (screen-reader announces "San Francisco", not "San_Francisco").
  Only space↔underscore is special-cased; underscore and space are interchangeable in titles
  (Wikipedia parity — an accepted collision, not a defect). Issues #12 (navbar search) and #13
  (bare-path redirect) reuse these helpers.
- What scopes/claims we request from Wikimedia (e.g. username, edit count — also a moderation signal).
- YouTube search credentials: keep the **referrer-restricted client key** (prototype) or move search
  behind a **server proxy** in the production read-path — so the key isn't browser-exposed and the
  expensive search quota can be shared, secured, and cached server-side.

### Resolved by the Curation Standard (`docs/CURATION_STANDARD.md`)

- ~~Whether `stance`/`accuracy_flag` are free-form or a fixed controlled vocabulary.~~
  **Resolved:** both are **fixed controlled enums** (Curation Standard §2/§3, Decision C2),
  with an optional free-form **`*_modifier`** display field (≤24 chars, never filtered, C6).
  Stance: `explainer | short | demonstration | classroom | opinion | myth_busting |
  personal_experiment`. Accuracy: `accurate | accurate_with_caveat | primary_source | opinion
  | mixed | misleading | inaccurate`. The provisional `primary-source` value splits into the
  `demonstration` stance + `primary_source` accuracy (C4); `lib/data/types.ts` to be updated.
- ~~The license chosen for wiki+ context notes.~~ **Resolved:** **CC BY-SA 4.0** (same as the
  article text), with contributor agreement captured at submit time (Curation Standard §5.3,
  Decision C5).
- ~~Abuse/spam handling for open contribution.~~ **Policy resolved** (Curation Standard §7):
  login-gated contribution, defined removable content, honest flagging allowed, per-identity
  Redis rate limits + the `clip.vetted` review hold. *Enforcement* (rate-limit + moderation
  tooling) remains Operations'/Development's to build with auth/persistence.

## Prototype phase (current — client-side, GitHub Pages)

Before provisioning a server, wiki+ is built as a **client-side SPA** shipped to **GitHub
Pages**, with `localStorage` standing in for the production database. This exercises the read +
curate UX and the data model (and doubles as a public demo) without infra. It does **not** yet
exercise the production read-path (ISR/Redis/Server Actions) and is **single-user** (per-browser).

- **Build:** Next.js static export (`output: 'export'`); `basePath` set to `/<repo>` by the Pages
  workflow. Deployed by `.github/workflows/deploy.yml` on push to `main` — the cloud,
  mobile-drivable prompt→staging loop, no server to operate.
- **YouTube key:** `NEXT_PUBLIC_YOUTUBE_API_KEY` in `.env` (gitignored) for local dev; the Pages build
  reads it from a **GitHub Actions secret** wired into `deploy.yml`'s build step. A `NEXT_PUBLIC_` var is
  baked into the static export at build time, so (a) without that wiring the deployed site has no key, and
  (b) the key is **visible in the shipped bundle by design** — the HTTP-referrer restriction (`ragesoss.github.io/*`)
  and a quota cap are the guard, not secrecy.
- **Data:** all access goes through the `DataStore` interface (`lib/data/store.ts`); the prototype
  uses `LocalStorageDataStore`. The swap point is the single line in `lib/data/index.ts`.
- **Wikipedia:** article fetch + DOMPurify sanitize run client-side (as in production); Wikidata
  resolves QID→title. oEmbed is avoided — we store `platform`+`videoId` and build the click-to-load
  facade ourselves.
- **Auth:** stubbed (reading is anonymous); real Wikimedia OAuth arrives with the server.
- **Vocabularies:** `stance`/`accuracy_flag` in `lib/data/types.ts` are now the **closed CURATION
  enums** (`docs/CURATION_STANDARD.md` §2/§3, Decisions C2/C4) — no longer provisional. Chip text is
  derived from a single **enum→label/fill map** in `lib/curation/labels.ts` (§4); optional display-only
  `*Modifier` fields render as "Label · modifier" (C6). The AA-safe chip fills are pinned there:
  stance = deep-violet `#5248AF`, accuracy = teal-dk `#1F6757` / action `#1F6F95` / red `#B0353B`
  (design spec §9.3).
- **Topic Page v1 data model** (`lib/data/types.ts`, described in `lib/data/store.ts`): the `Clip`
  type carries the card's display fields — `platformLabel`, `orientation`, `watchUrl`/`embedUrl`,
  `thumbnailUrl`+`thumbGrad`, `creator{name,handle,platform,url,avatarGrad,followerCount?}`,
  `general`/`sectionSlug`+`sectionLabel`, `upvotes?`, `curatedBy?`. A separate **`Candidate`** type
  (unvetted empty-state suggestion) shares the media/creator fields, adds `vetted:false` + `source`
  + `matchReason`, and **omits** stance/accuracy/contextNote (CURATION §6). The `DataStore` seam gains
  **`listCandidates(topicQid)`**; topic-level counts (videos/creators/curators) are **derived** from
  the clip set (`deriveStats`), never stored.
- **Live candidate auto-suggestion (now built — `lib/candidates/`).** The candidate **source** behind
  the seam is now a **live, cached YouTube Data API search**, not only seeded mock data. A pluggable
  source registry (`lib/candidates/index.ts`, YouTube the only registered source — TikTok/Vimeo slot in
  additively) feeds a deterministic pipeline (`pipeline.ts`): one `search.list` call per topic →
  case-insensitive keyword-overlap **section matching** (`matching.ts`, best single match per section,
  non-topic-generic threshold, fixed tie-break order) → **placement** (one home per video, section beats
  General, General capped at 5) → dedup against curated clips + sticky dismissals + within-set. The seam
  gains **`suggestCandidates({topicQid, topicTitle, sections, curatedVideoKeys})`** (returns the computed
  set, or **`null`** when no source is enabled — the no-key no-op). The key is read **only** from
  `process.env.NEXT_PUBLIC_YOUTUBE_API_KEY`; with it unset (every local/CI build) `isEnabled()` is false,
  no call is made, nothing is cached, and the seam falls back to `listCandidates` (seeded/empty) — and any
  source-side quota/network error is swallowed to `[]` (degrade to seeded/empty, never a thrown error or
  error UI). The computed set is cached per QID in `localStorage` (`wikiplus.candidates.<QID>`,
  `{fetchedAt, candidates}`, 24h TTL, lazy refresh — the same shape as the eventual Redis cached set);
  dismissals persist to `wikiplus.dismissed_candidates` keyed `(topicQid, platform, videoId)` (mirrors the
  `dismissed_candidate` table). Orientation defaults to horizontal, vertical only on a positive Shorts
  signal (Decision 4). Production moves the search **server-side** (key → server secret, set → Redis) — a
  source/store swap behind the same seam, not a redesign.

- **Routing — canonical title-based Topic URLs under static export (Topic Page v1).** The
  user-facing Topic URL is **title-based** (`/topic/<Title>`, paralleling `/wiki/<Title>`); the QID
  is the internal key, resolved under the hood and never shown (owner directive; AC5/AC23). The route
  is an **optional catch-all** `app/topic/[[...slug]]/page.tsx`: `generateStaticParams` pre-renders the
  **seeded titles** (`Photosynthesis`, `Cellular_respiration`, `Cat`) plus the bare `/topic` shell
  (`slug: []`) that serves the `?qid=` back-compat entry. `dynamicParams = false` — arbitrary titles
  are **not** generated, so under `output: 'export'` GitHub Pages serves **`404.html`** for them.
  As of issue #13, **`404.html` is `app/not-found.tsx`** (the export emits it as the default
  `404.html`) — `deploy.yml` **no longer** copies `out/topic/index.html` over it. `not-found.tsx` is a
  **superset** of the old Topic-shell-as-404: for an unmatched `/topic/<Title>/` (or any non-redirect
  path) it renders `TopicView`, which reads the title from `location.pathname` (`titleFromPathname`) and
  renders — no redirect, **no QID in the URL**, title preserved (the same behavior as before; `next dev`
  renders the same component for unmatched paths, giving static-export ⇄ local-dev parity). Because the
  export uses an absolute basePath `assetPrefix`, that shell boots from any path. In-app navigation uses
  the Next client router (`<Link>` + a delegated wikilink click handler), so it never triggers a full
  reload. Helpers live in `lib/wiki/topicRoute.ts` (`topicHref`, `titleFromPathname`).

- **Routing — bare-path fallback redirect (`/<Title>` → `/topic/<Title>/`, issue #13).** A **bare
  single-segment path** (e.g. `/San_Francisco`) is the natural shorthand a reader types/pastes; it is
  redirected to the canonical `/topic/<Title>/` rather than dead-ending. The rule lives in
  **`app/not-found.tsx`** (the SPA-shell/not-found boot, covering both `404.html` on Pages and `next
  dev`): on mount it computes a redirect target from `location.{pathname,search,hash}` and, if non-null,
  `router.replace`s to it while rendering a **neutral Topic loading state** (`ArticleSkeleton`) plus a
  polite `role="status"` "Loading topic…" announcement — so a real topic lands directly in *loading*,
  never the "Topic not found." flash, and a screen reader hears the hop (`router.replace` skips the
  native page-change announcement, and `TopicView`'s existing live region is `mode === "empty"`-gated).
  The **reserved-prefix allowlist** — the single source of truth — lives in
  **`lib/routing/reserved.ts`** (`barePathRedirectTarget`, `bareTitleSegment`, `isReservedSegment`,
  `RESERVED_SEGMENTS`), with a comment pointing back to `docs/specs/bare-path-redirect.md`. Redirect
  **iff** the path is a single non-empty segment, not reserved, and not under `/topic`; reserved =
  `/` (home), the enumerated top-level routes (`topic`, `contribute`, `_next`), any segment with a `.`
  (asset) or a `:` (namespace). The segment is normalized through #11's `slugToTitle` → `titleToSlug`
  (so `/Multi Word` and `/Multi_Word` both → `/topic/Multi_Word/`); query + hash are preserved. The
  loop guard is structural: the destination is under the reserved `/topic` prefix, so the rule is a
  no-op on it. **Future-proofing policy:** every new top-level `app/<section>/` route MUST be added to
  `RESERVED_SEGMENTS` in the same change — enforced by an AC8 unit test that asserts each current
  top-level route is reserved.

  *Production* drops `output: 'export'` and restores per-title path-based pages with ISR + the Redis
  `cacheHandler` (no 404.html trick needed once a server renders unknown titles on demand; the bare-path
  case becomes a real server-side HTTP redirect at that point).

**Path to production:** add the Drizzle `DataStore` + Server Actions, restore path-based Topic pages
with ISR + the Redis `cacheHandler`, and turn off `output: 'export'`. The components, data model,
design system, article pipeline, and the title-based URL scheme carry forward.

## Testing

Two layers, both run with `yarn` (matches the committed lockfile/CI):

- **Unit + component — Vitest + React Testing Library (jsdom).** `yarn test` runs `vitest run`
  over `test/**/*.test.{ts,tsx}` (config: `vitest.config.ts`, setup: `test/setup.ts`). This is the
  primary QA layer: pure-logic units (the DOMPurify sanitize + wikilink rewrite in
  `lib/wiki/article.ts`, the `lib/embed/facade.ts` URL parser, the `lib/curation/labels.ts`
  enum→label/fill maps incl. a programmatic **WCAG-AA chip-contrast check**, `deriveStats` and the
  `DataStore`), the components, and a `TopicView` integration test driving the curated/empty/
  loading/error state machine. **The live MediaWiki + Wikidata fetch is mocked** (cloud/CI sandboxes
  have no network egress and the article fetch is client-side anyway). `yarn test:watch` for dev.
- **End-to-end — Playwright (`e2e/`).** `yarn test:e2e` builds the static export and serves `out/`,
  then drives the core loop (find topic → read → watch & weigh → contribute) in a real browser. The
  Wikipedia/Wikidata calls are **intercepted with fixtures** (`page.route`) so the run is
  deterministic and offline; the plus side renders from the seeded localStorage `DataStore`.
  Requires `npx playwright install chromium` (a one-time browser download — not possible in a
  no-egress sandbox, so e2e runs in CI / local).

Test deps are devDependencies; `@testing-library/dom` is pinned explicitly (a peer of
`@testing-library/react`). Author-run `yarn build` is **not** review — a `qa-reviewer` subagent owns
the pass/fail-per-AC verification and the security review (CLAUDE.md).
