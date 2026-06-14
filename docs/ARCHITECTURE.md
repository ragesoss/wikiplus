# wiki+ — Architecture

This document records the architectural decisions and the reasoning behind them. The
guiding constraints: **wide adoption, efficient use of modest server resources, rapid
vibe-coded iteration, and operation by AI agents.**

## Guiding principle: the read path is the scale lever

wiki+ is a wiki-shaped workload — topic pages are read **far** more than they are written.
The dominant scalability lever is therefore **not** the choice of language or framework; it
is **how cheaply we can serve reads.** Wikipedia itself serves the overwhelming majority of
its traffic from cache on comparatively modest origin infrastructure.

So the architecture treats a Topic page as **cacheable, near-static HTML** by default, and
reserves dynamic server compute for the things that genuinely need it: writes (new/edited
clips), authentication, and any personalization.

Concretely:

- Topic pages are rendered with **Next.js static generation + ISR (Incremental Static
  Regeneration) using on-demand revalidation**. A page is generated once, served from cache
  to everyone, and regenerated only when its underlying data changes (a new annotation) or
  its cached Wikipedia content goes stale.
- **Cloudflare (free tier) sits in front of the VPS**, providing edge caching of those
  pages, TLS termination, and DDoS protection. Most read requests should be answered at the
  edge and never reach the origin.

## Stack

| Concern        | Choice                                  | Why |
|----------------|-----------------------------------------|-----|
| Framework      | **Next.js (App Router), TypeScript**    | Smoothest vibe-coding loop, huge ecosystem, first-class static/ISR for the read path. |
| Database       | **Postgres**                            | Proven, scales with read replicas, strong relational fit for Topic/Clip. |
| ORM            | **Drizzle ORM**                         | Lightweight, low-overhead, explicit SQL-shaped API — efficient and easy for agents to reason about (vs. heavier Prisma). |
| Styling/UI     | **Tailwind CSS + shadcn/ui**            | Fast, consistent components without a heavy design system. |
| Cache / shared state | **Redis**                         | Backs the shared ISR cache handler and future rate-limiting/session needs. |
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
  - `wikipedia_cache` — cached lead/section structure + fetch metadata (see below)
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
  - `section_anchor` (nullable) — which article section it relates to
  - `upvotes` (cached count)
  - `vetted` (boolean) — `true` for human-curated clips. **Auto-suggested candidates are
    `vetted: false`** and carry `suggestion_source` + `match_reason` *instead of* a
    `context_note` / `stance` / `accuracy_flag`, until a curator **promotes** them (see
    *Candidate suggestion & the empty state*).
  - `curator_id` → contributor (null for un-promoted candidates)
  - `created_at`, `updated_at`
- **contributor** (the wiki+ curator — distinct from the external **creator** referenced above)
  - `id` (internal PK), `display_name`, `avatar_url`, `created_at`
  - identity comes from OAuth — see **Authentication & identity** below
- **account** (an OAuth identity linked to a contributor; one contributor may link several)
  - `id`, `contributor_id` → contributor
  - `provider` (`wikimedia` | `google`), `provider_account_id` (the provider's stable subject id)
  - cached profile bits from the provider (name, email if granted, avatar)
  - `unique(provider, provider_account_id)`

> Creators are external people we reference and credit, stored inline on the clip for the MVP.
> If creator-level views (a creator's body of curated clips, follower trends) become a feature,
> promote them to their own `creator` table keyed by platform + handle.

**Why QID as the canonical key:** Wikipedia article titles change and differ per language;
Wikidata QIDs are stable, language-independent anchors. Keying Topics on QID makes future
multilingual support and article-rename resilience essentially free.

## Wikipedia integration

- **Content fetch:** retrieve article lead/sections via the **MediaWiki REST API**
  (`/page/...`) and/or the **Action API**, and resolve/confirm the **Wikidata QID** via the
  Wikidata API. Resolve titles ↔ QIDs at curation time.
- **Caching & refresh:** store fetched content in `topic.wikipedia_cache` and refresh
  **lazily** (on revalidation / when stale), not eagerly. We never need a full mirror — only
  the topics that have been curated.
- **Etiquette:** send a descriptive **User-Agent** identifying wiki+ and a contact, respect
  rate limits and `maxlag`, and back off on errors. This keeps us good citizens of the
  Wikimedia APIs and avoids being throttled.

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

Implementation notes: the **YouTube Data API search quota is expensive** — cache candidate result
sets per topic and refresh lazily (like the Wikipedia content cache). Persist candidates with
`suggestion_source` and `match_reason`, and remember dismissed candidates so they don't resurface.

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
- **wiki+'s own context notes:** decide and state the license under which contributor-written
  context notes are released (a permissive or share-alike CC license is the natural fit and
  keeps us compatible with the surrounding Wikipedia content). Capture contributor agreement
  to that license at submission time.
- **Embedded video** remains under its original platform/creator terms; we link out and rely
  on official embeds rather than redistributing.

## Open questions (to resolve before/while building)

- Exact ISR revalidation triggers and stale-after windows for Wikipedia content.
- What scopes/claims we request from Wikimedia (e.g. username, edit count).
- Abuse/spam handling for open contribution (rate limits via Redis, basic moderation).
- The license chosen for wiki+ context notes.
- Whether `stance`/`accuracy_flag` are free-form or a fixed controlled vocabulary (affects
  filtering, consistency, and any future AI-assisted drafting).
