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

**Provisioned host (issue A.2 / #42 — the prototype is live):** a single **Linode Nanode
1GB** (planned Ubuntu 24.04; **shipped Debian 13 / trixie** — see `docs/ops/vps-setup.md`),
serving **`wikiplus.wikiedu.org`**. The deploy files live in
[`deploy/`](../deploy/) (`docker-compose.yml`, `Caddyfile`) and on the box at `/opt/wikiplus`;
the box-setup runbook is `docs/ops/vps-setup.md`. Stack on the box is **`app` + `caddy` +
`postgres`** (the shared data store, issue #45 / #35 B) plus a one-shot **`migrate`** service that
applies Drizzle migrations + the seed on deploy; **Redis is still deferred** to the production
read-path. Postgres is internal-only (named `pgdata` volume, password via a Docker secret), the app's
`DATABASE_URL` reaches it on the compose network, and migrations apply automatically on `up -d` (no
manual SSH). See *Persistence* above + `docs/ops/vps-setup.md`. **Caddy** terminates TLS directly via Let's Encrypt (automatic HTTPS)
and reverse-proxies the apex → `app:3000`; **Cloudflare edge cache is deferred** to the
production-MVP — at prototype scale a single box renders per-request fine. (Caveat baked into
the Caddyfile: `wikiplus.wikiedu.org` is in the `wikiedu.org` zone, which may sit behind
Cloudflare — if the DNS record is proxied, Caddy's HTTP-01 challenge needs Cloudflare SSL mode
"Full", or a DNS-01 challenge; verify before bring-up.)

**Pipeline — CI builds, the box only runs.** A push to `main` (or `workflow_dispatch`) runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml): job 1 builds the Next.js
**standalone** Docker image ([`Dockerfile`](../Dockerfile), `output: 'standalone'`) on a
GitHub-hosted runner and pushes it to **GHCR** (`ghcr.io/ragesoss/wikiplus`, tagged `:latest`
+ `:<sha>`), passing the YouTube key as a `--build-arg`; job 2 SSHes to the box and runs
`docker compose pull && docker compose up -d`. **The 1GB box never builds Next.js** (it would
OOM) — it only pulls + runs. This is the deploy leg of the cloud, mobile-drivable
prompt → staging loop, re-enabled here after #37 paused it.

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

> **Implemented in issue #45** (`lib/db/schema.ts`, migration `drizzle/0000_*`): `topic`, `clip`,
> `contributor`, `account`, `dismissed_candidate` — see *Persistence — Drizzle/Postgres behind a
> server data-access boundary* above for the exact landed shape. Two deliberate deltas from the
> forward-looking model below, scoped to B: **`topic` has no `article_index`** (the server never
> fetches Wikipedia in B — that cache belongs to the deferred production read-path), and the **`clip`
> fields are the app's current `Clip` type** (`lib/data/types.ts`) — `embed_meta`/`timestamp_seconds`
> are not yet carried, and `section_anchor` is stored as the `section_slug` + `section_label` pair.
> The `account` table is Auth.js-adapter-shaped; **as of issue C it is populated by real
> Wikimedia logins** (find-or-create on `(provider, provider_account_id)`), and writes attribute
> to the real signed-in contributor. The stub `@prototype` contributor remains only for clips
> curated before C (no retro-rewrite — D6). See *Authentication & identity*.

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
  - `upvotes` — **as of issue #55 / D4 a FROZEN seed baseline, NOT a mutable counter.** The
    displayed count is **derived** = `(clip.upvotes ?? 0) + COUNT(distinct clip_vote rows)`; a real
    vote is a `clip_vote` row, never a write to this column (so the count can't drift). See
    **clip_vote** below + *Prototype phase* → D4.
  - `vetted` (boolean, `NOT NULL DEFAULT true`) — **the review-hold flag, AS-BUILT as of issue #58
    / D5b** (migration `drizzle/0006_useful_the_phantom.sql`). `vetted = true` ≙ **published / live
    / fully curated** (carries the site's full vouch); `vetted = false` ≙ **held / "in review · not
    yet vouched"** — a real curated clip (note + chips + curator intact) whose vouch a reviewer has
    not yet confirmed (Curation Standard §7.1 / Decision C8 — the THIRD clip-state, distinct from a
    fully-curated clip and from a §6 candidate). **New adds publish by default** (`true` — Decision
    D1-2 preserved; the hold is an available action, never auto-on) and **all existing/seeded clips
    backfilled to `true`** when the column landed (the `NOT NULL DEFAULT true` default), so no live
    clip went dark. This is the **clip** review-state — distinct from the `Candidate.vetted: false`
    discriminant in `lib/data/types.ts` (an auto-suggested non-clip), never conflated with it. The
    held-state **rides the clip read** (`listClips` → the client `Clip.held` flag) so every viewer
    sees the same marking with **no per-user work** on the cached read path (D5b Decision 4). Set by
    the two role-gated Server Actions (`holdClipAction` / `reviewClipAction` — see *Boundary
    surface*); see *Prototype phase* → **D5b**.
  - `removed_at`, `removed_by`, `removed_reason` (all nullable) — **the soft-removal tombstone,
    AS-BUILT as of issue #59 / D5c** (migration `drizzle/0007_regular_scorpion.sql`). The §7
    moderation enforcement: a **moderator** removing an **abusive** clip (Curation Standard §7.2 /
    Decision C9). `removed_at` (timestamptz) is the **single removed/live discriminant** — `NULL` ≙
    live, non-null ≙ removed (the removal timestamp); `removed_by` (integer → `contributor.id`, `ON
    DELETE SET NULL` so the audit trail outlives the moderator's account) is the removing moderator;
    `removed_reason` (text) is the **optional, audit-only** reason (the C9 §7-category enum and/or a
    free-text note, composed into one string — `lib/curation/removal-reason.ts`). **All three default
    `NULL`; no backfill marks any clip removed**, so every existing/seeded clip landed **live**
    (`removed_at IS NULL`) when the columns landed — no live clip went dark (AC6). Removal is a
    **SOFT tombstone, NOT a hard delete** — the row **persists** as the §7 audit trail (a privileged
    act on another person's work must be auditable + attributable) and the **clip read excludes
    `removed_at IS NULL`** (`listClips` + `listClipsByContributor` gain the predicate), so a removed
    clip simply **stops showing** with **no per-user work** on the cached read path (AC7) — there is
    **no reader-facing removed marker**. **Distinct from `vetted`** (an INDEPENDENT column): a *held*
    clip (`vetted = false`, `removed_at IS NULL`) **still lists** (shown-but-marked "in review"); a
    *removed* clip (`removed_at` set) is **excluded** regardless of its `vetted` value — the two never
    collide (AC5). **Distinct from D2's owner hard-delete** (`deleteClipAction` — the row is GONE;
    here the row persists). Set by the moderator-only `removeClipAction` (see *Boundary surface*).
    **Restore is DEFERRED but TRIVIAL** given the tombstone (clear `removed_at`/`removed_by`); D5c
    builds removal only. See *Prototype phase* → **D5c**.
  - `curator_id` → contributor (who promoted/added it)
  - `note_license`, `note_license_agreed_at` (both nullable) — the **per-submit CC BY-SA
    note-license agreement** captured at publish (issue #52 / D1, Curation Standard §5.3 /
    Decision D1-1). `note_license` is a **version string** (`CC-BY-SA-4.0`), not a boolean, so a
    future license bump is expressible; `note_license_agreed_at` is the server-stamped agreement
    timestamp. Together with `curator_id` they bind *"this note, by this contributor, under this
    license version, at this time."* Stamped **by the auth-gated Server Action** when the client
    signals consent (never trusted off the wire); **null** on seed/stub clips and any non-agreed
    path, so a D1-published clip is distinguishable from a pre-D1 one. See *Prototype phase* below.
  - `created_at`, `updated_at`
- **contributor** (the wiki+ curator — distinct from the external **creator** referenced above)
  - `id` (internal PK), `handle` (display only — **non-unique**), `display_name`, `avatar_url`,
    `created_at`
  - `is_moderator` (boolean, `NOT NULL DEFAULT false`) — **the minimal binary moderator/reviewer
    role, AS-BUILT as of issue #58 / D5b** (migration `drizzle/0006_useful_the_phantom.sql`; the
    shared prerequisite **D5c** reuses). `true` ⇒ this contributor is a moderator/reviewer (may
    **approve** a held clip and **hold** any clip — Curation Standard §7.1). `DEFAULT false` so
    every existing/new contributor is a non-moderator until granted — the safe default; the feature
    ships **green with no moderator existing** (the role-gate simply rejects everyone until one is
    granted). **How a moderator is granted — OUT-OF-BAND, no in-app admin UI** (two ways, either
    suffices; the server-side resolver `lib/auth/moderators.ts` OR-combines them):
    - **(a) the DB flag** — an owner/ops sets the column directly on the box, e.g.
      `psql … -c "UPDATE contributor SET is_moderator = true WHERE handle = 'Username';"`; or
    - **(b) the `WIKIPLUS_MODERATORS` env allowlist** — a comma-separated list of Wikimedia
      usernames; a contributor whose handle appears in it (case-insensitively) is a moderator
      (cleaner for staging — set the env + redeploy; self-heals if the DB column was never set).

    **Granting a LIVE moderator is a separate owner/ops action** — a runbook step, not part of the
    D5b build's deploy. The role-gate's **authority is always server-side** (the action re-resolves
    the role from the DB column / allowlist), and a JWT `isModerator` session claim (resolved the
    same way at login — *Authentication & identity*) is the **affordance layer only**, never the
    security control. See *Prototype phase* → **D5b**.
  - identity comes from OAuth — the durable trust anchor is the linked **account** row's
    `(provider, provider_account_id)`, **not** the mutable/reusable `handle`; see
    **Authentication & identity** below
- **account** (an OAuth identity linked to a contributor; one contributor may link several)
  - `id`, `contributor_id` → contributor
  - `provider` (`wikimedia` | `google`), `provider_account_id` (the provider's stable subject id)
  - cached profile bits from the provider (name, email if granted, avatar)
  - `unique(provider, provider_account_id)`
- **dismissed_candidate** (suppress a ruled-out suggestion so it doesn't resurface)
  - `id`, `topic_id` → topic, `provider`, `provider_video_id`, `contributor_id` → contributor,
    `created_at`
  - `unique(topic_id, provider, provider_video_id)`
- **clip_vote** (one contributor's upvote on one clip — issue #55 / D4; migration `drizzle/0004_*`)
  - `id`, `clip_id` → clip (`onDelete: cascade`), `contributor_id` → contributor (`onDelete:
    cascade`), `created_at`
  - **`unique(clip_id, contributor_id)`** — the **one-per-user enforcement is this DB constraint**,
    not app logic: a duplicate insert collides (the toggle inserts with `onConflictDoNothing`, so a
    racing double-insert lands voted, never doubled). The displayed count is **derived** = the
    frozen `clip.upvotes` seed baseline **+** `COUNT(clip_vote rows)`, so it can never drift from the
    set of distinct real voters; `clip.upvotes` is never mutated by a vote. A viewer's "have I
    voted?" state comes **only** from `clip_vote` (never the seed). See *Prototype phase* → D4.
- **write_event** (the per-identity write rate-limit ledger — issue #57 / D5a; migration
  `drizzle/0005_broken_barracuda.sql`)
  - `id`, `contributor_id` → contributor (`onDelete: cascade`), `kind` (`add` | `upsert` | `upvote`
    | `dismiss` | `edit` | `delete`), `created_at`
  - **`index(contributor_id, created_at)`** — supports the hot window check
    `COUNT(... WHERE contributor_id = ? AND created_at > now() - W)`. One row per **successful**
    counted gated write; the per-identity cap (default **N=60 / W=60s**, env-overridable) is enforced
    in `lib/server/actions.ts` AFTER the auth gate, BEFORE the write (over cap → `RateLimitedError`,
    writes nothing). **One shared per-identity budget** across all kinds (`kind` carried so a future
    per-action split needs no migration). **Postgres-backed, NOT Redis** (Redis stays reserved for
    the deferred read-path ISR cacheHandler). Append-mostly + self-bounding for the window
    (`created_at > now() - W` ignores aged rows); a periodic prune is an Ops follow-up, not required
    for correctness. See *Open questions* → Abuse/spam + *Prototype phase* → **D5a**.

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

*Prototype decision (#12, navbar topic search — `components/search/TopicSearch.tsx` +
`lib/wiki/suggest.ts`):* typeahead suggestions come from Wikipedia's REST title-completion
endpoint **`/w/rest.php/v1/search/title?q=&limit=`** (namespace 0, articles) — Wikipedia's own
as-you-type engine, which returns ranked title completions plus an optional short description the
UI may show. It is fetched **client-side, key-free, anonymous CORS GET** with the same descriptive
`Api-User-Agent` as `lib/wiki/article.ts` — **no server, no secret, no quota** (unlike the YouTube
key). The `opensearch` action endpoint is an equivalent proven fallback (same shape); the REST
endpoint was chosen for better completions + descriptions. Etiquette is binding: the input is
**debounced (~200 ms)**, the prior in-flight request is **aborted** on query change, and the fetch
**degrades silently to `[]`** on any error/timeout/abort (never an error UI). Selecting a suggestion
or submitting raw text is a **pure navigation** — `router.push(topicHref(<raw title>))` (reusing the
#11 `titleToSlug` encoding) — with **no write, no `/contribute` coupling, and no QID in the URL**;
`TopicView` resolves title→QID under the hood and renders the topic in whichever of its three
states applies — **empty / mixed / fully-curated** (issue #60 coexistence; see
`docs/TOPIC_PAGE_DESIGN.md` §"Three states") — via the create-on-demand behavior that already
existed for typed/pasted `/topic/<Title>/` URLs. One
reusable component is placed on both the home header (always-visible full-width) and the Topic
header (inline compact on the Wiki side ≥ md; a labeled magnifier icon-disclosure < md, so the
tight two-world header is not crowded). Accessibility follows the WAI-ARIA APG **editable combobox +
listbox** pattern (`aria-activedescendant`); the no-results hint is a non-`option` row so it never
blocks submit.

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
paths to curate. As of issue #60, curated clips and unvetted candidates **coexist** on a partly-
curated topic (the three states empty / mixed / fully-curated) — this is a **pure presentation
derivation in `TopicView` (`hasCurated` + `hasSuggestions`), not a storage change**: candidates
remain computed/cached and never stored as rows, and the no-churn invariant is a stable
sort/filter over the already-derived `liveCandidates` (no pipeline re-run on curation). (Product
behavior in [`TOPIC_PAGE_DESIGN.md`](TOPIC_PAGE_DESIGN.md) §"Three states".)

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
  resolve it via **oEmbed** and start a curation for a clip auto-suggestion missed. **As-built
  (issue #64 / D-add-link):** a recognized **YouTube** link resolves real `title`/`author_name`/
  `author_url`/`thumbnail_url` via a **Server Action** (`lib/embed/oembed.ts` `resolveOEmbedAction`,
  the CORS decision below); **TikTok/Instagram/other** land on an honest, clearly-labeled
  **unresolved placeholder** (no fabricated creator, no fake link — CURATION §5.5/C10) rather than
  resolving this loop. See *Prototype phase* → **D-add-link**.
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
decision: in the prototype it's a **browser key restricted by HTTP referrer** to the live origin
`https://wikiplus.wikiedu.org/*` (the allowlist had to be updated from the old `ragesoss.github.io`
Pages origin at the host cutover — see *Prototype phase* and the ⚠️ in `docs/ops/vps-setup.md`). Because a client key is inlined into the static bundle and publicly readable, the
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

**As of issue C (#?) this is LIVE — as built:**

- **Auth.js v5** (`next-auth@5.0.0-beta.31`, App-Router-native: one config exports
  `handlers`/`auth`/`signIn`/`signOut`). Wikimedia is the **built-in `@auth/core` provider**
  (`next-auth/providers/wikimedia`) — authorize/token/userinfo at `meta.wikimedia.org`,
  **default identify-only scope** (stable `sub` + `username`; no edit/act-on-behalf grant —
  Decision D5). The catch-all route handler lives at `app/api/auth/[...nextauth]/route.ts`;
  the default callback is **`/api/auth/callback/wikimedia`** (the URL Ops registers at
  meta.wikimedia.org). The config (`lib/auth/config.ts`) sets `trustHost: true` (behind
  Caddy/Cloudflare) and a descriptive Wikimedia **`User-Agent`** via Auth.js's `customFetch`
  on the identity-endpoint calls (Wikimedia etiquette).
- **Sessions: stateless JWT** (`session.strategy = "jwt"`, **no database adapter, no
  server-side session store, no Redis**). An ordinary read resolves the header from the signed
  JWT cookie with **no per-read DB hit** (read-path-efficiency principle preserved). The
  **only** DB write a login makes is the find-or-create identity mapping, run once in the `jwt`
  callback on sign-in; the resolved `contributorId` + Wikimedia `username` are stashed on the
  token and surfaced via the `session` callback. **As of issue #58 / D5b** the `jwt` callback also
  resolves an **`isModerator`** claim server-side on the sign-in pass (the DB `is_moderator` column
  OR the `WIKIPLUS_MODERATORS` allowlist — `lib/auth/moderators.ts`) and stashes it on the token, so
  ordinary reads stay JWT-only (no per-read role query). That claim drives only the **off-read-path
  reviewer affordances** (which clips show Hold/Approve); the **write boundary re-resolves the role
  server-side**, so the claim never authorizes a write — it is the affordance layer, not the gate.
- **Reading is anonymous; contributing requires login.** The three persisted write Server
  Actions — `addClipAction`, `upsertTopicAction`, `recordDismissalAction` — are **auth-gated at
  the boundary** (`lib/auth/require-session.ts` `requireContributor()` throws `AuthRequiredError`
  when there is no session; the gate is in the Server Action, not only a hidden button —
  Decision D1). A gated write attributes to the **real signed-in contributor** (`clip.curatorId`
  + `clip.curatedBy` = the Wikimedia username; dismissal `contributorId`). `updateClip`/
  `deleteClip` stay **off** the boundary (that's issue D).
- **Identity model:** the trust anchor is the **account identity** `(provider,
  provider_account_id=<stable Wikimedia subject id>)` — **never** the mutable, reusable Wikimedia
  username/handle. Each successful Wikimedia login find-or-creates entirely on that anchor
  (`lib/auth/contributor.ts`): a never-seen subject gets a **fresh** `contributor` + linked
  `account`; a repeat login by the same subject resolves to the **same** rows (matched on the
  `account_provider_identity` unique) — no duplicates — and refreshes the contributor's `handle`
  to the current Wikimedia username (a rename is reflected in place). The contributor `handle` is
  a **non-unique display column**: two **distinct** subjects that present the same username string
  get **distinct** contributors and never co-mingle, and a known subject who renames into a handle
  already held by another contributor resolves normally (no UNIQUE violation inside the JWT
  callback). The `(provider, provider_account_id)` shape means **Google (and account
  linking/merge) later is additive** — Decision D2. Schema delta for C: the #45
  `account`/`contributor` columns already carried everything the JWT-session find-or-create needs
  (`name`/`email`/`avatarUrl` on `account`; `handle`/`displayName`/`avatarUrl` on `contributor`);
  the C fix round additively **dropped the `contributor.handle` UNIQUE constraint** (migration
  `drizzle/0001_loose_blockbuster.sql`) so the handle is purely display — the only C migration,
  applied cleanly on top of #45 with the `@prototype` stub preserved (AC9).
- **The `@prototype` stub is superseded for new writes.** The seeded stub contributor stays as
  attribution for clips curated **before** C (no retro-rewrite — Decision D6); only new writes
  attribute to the real signed-in contributor. The stub has **no browsable public profile** (issue
  #54 / D3, Decision 4): `/contributor/@prototype` resolves to not-found, and a `@prototype` clip's
  curator attribution is the non-linked `seed clip · no curator` label.
- **Public identity is browsable; non-public identity is never exposed (issue #54 / D3).** A
  contributor has a **public profile at `/contributor/<username>`** exposing **only** the Wikimedia
  username (`contributor.handle`) + the **granted avatar** — **never `email`** or any non-public
  `account` field. The two profile reads (`getContributorByUsername` / `listClipsByContributor`) are
  **anonymous** (no auth gate, like the topic reads) and run **only** on the profile route, so they
  add **no per-user work to the cached topic read path**. The privacy boundary is the public-safe
  projection (`rowToPublicContributor`) — `account.email` is never selected on this path. The
  **non-unique `contributor.handle`** is resolved to a **single** identity deterministically (lowest
  `contributor.id` — Decision 1). **"My curations"** is the **owner-view** of that same public route
  (no separate private surface — Decision 2). See *Prototype phase* for the as-built detail.
- **Secrets:** the Wikimedia consumer key/secret live in env under the owner-confirmed names
  **`wikimedia_oauth_client_key`** / **`wikimedia_oauth_client_secret`** (read explicitly as the
  provider's `clientId`/`clientSecret`); Auth.js's session-signing **`AUTH_SECRET`** is also a
  server secret. All three live in environment/Docker secrets, **never** in the repo and
  **never** in the client bundle (AC12; verified absent from `.next/static`). `.dockerignore`
  excludes `.env` so the CI image build never bakes them; they arrive at runtime on the box.

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
  on official embeds rather than redistributing. **Creator credit on oEmbed-resolved clips**
  (add-by-link, issue #64): the minimum is real `author_name` + a working link to `author_url`
  (handle derived per the candidate pipeline, or omitted; never a placeholder masquerading as a real
  creator) — see `docs/CURATION_STANDARD.md` §5.5 / Decision C10.

## Open questions (to resolve before/while building)

- Exact ISR revalidation triggers and stale-after windows for `article_index` and candidate sets.
- How much of the page to server-render for **SEO** beyond title/lead/clips (the body is
  client-rendered).
- **DOMPurify allowlist** + which Wikipedia HTML to keep vs. strip (infoboxes, tables, math, navboxes).
  *Prototype decision (Topic Page v1, `lib/wiki/article.ts`):* the client fetches **`/api/rest_v1/page/html/{title}`** (Parsoid HTML, CORS-enabled), sanitizes with an **explicit DOMPurify allowlist** (prose, headings h1–h6, lists, links, `figure`/`figcaption`/`img`, basic tables; scripts/styles/iframes/forms dropped), then **strips editor chrome** post-parse (`.mw-editsection`, references/reflist, navboxes, `table.infobox`/`sidebar`, hatnotes). Tables are allowed through sanitize but **hidden in CSS** this round (`.wiki-body table { display:none }`) — full table/infobox/math rendering is deferred. Sections are derived by walking the flattened Parsoid `<section>` stream: lead = everything before the first `h2`; each `h2`/`h3`/`h4` opens a section with a **stable kebab slug** (`slugify`, deduped), used for `#sec-<slug>`/`#h-<slug>` anchors, the TOC, and clip→section matching. Navigational sections (References/See also/External links/Further reading/etc.) are dropped.
  *Article-fidelity decision (#24–#27, `lib/wiki/article.ts` + `app/globals.css`) — the v1 deferral is now **FLIPPED**.* The four deferred categories (citations & references, tables & the Wikipedia infobox, math, the navigational tail & hatnotes) are **restored**, verified against the live Parsoid markup of the seeded science topics (`Photosynthesis`, `Cellular_respiration`) plus an infobox/math reference (`Lion`, `Pythagorean_theorem`). Concretely:
  - **Allowlist widened (safely):** the v1 TAG set is unchanged (`sup`/`span`/`table…`/`img` already pass); **`<math>`, `<svg>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, `<link>`, `<script>` stay DROPPED** (the math MathML/SVG payloads, embeds, and CSS-injection surfaces — so the XSS guarantee holds). The only **new ATTRs** are inert render/a11y/anchor-routing ones: `aria-hidden`, `role`, `aria-label`, `aria-labelledby`, `data-mw-group`, `data-mw-footnote-number`. **`style` is still NOT allowed** (inline-style injection stays blocked). The sanitizer therefore still strips `<script>`, inline event-handler attrs, and `javascript:`/`vbscript:`/`data:text/html` URIs (asserted by `test/article.test.ts` + `test/article-fidelity.test.ts`, X4).
  - **Kept strip list (precise — `stripChrome`):** `.mw-editsection`, `.navbox` (live markup = `div.navbox`), `.metadata` (e.g. `div.side-box.metadata`), `.mbox-text`, `.ambox`, `table.sidebar`, `table.vertical-navbox`, `.thumbcaption .magnify`, `style`, `link`. **Removed from the strip list** (now RESTORED): `table.infobox`, `sup.reference`/`.reference`, `.mw-references-wrap`/`.reflist`, `.hatnote`.
  - **Sections:** `DROP_SECTIONS` is now **empty** — References, Notes, See also, Further reading, External links come through the same section walk as ordinary `ArticleSectionBody` entries (slug + heading + TOC row + `.sec` wrapper + scroll-sync). A footnote-style "Notes" block is a `note`-group reference list and stays its own section (its backlinks ARE its citation system, D7) — no duplication.
  - **Citations:** `prepCitations` normalizes the marker↔reference `./Title#cite_*` anchors to pure in-page `#cite_*` hashes (so `rewriteLinks` exempts them and they round-trip), tags markers/back-refs for the React layer; the `components/topic/CitationLayer.tsx` non-modal **Radix Popover** (`@radix-ui/react-popover`, added this round) shows the citation text on marker activation without touching scroll-sync.
  - **Math render mechanism (C4 DECISION):** render Parsoid's **visible SVG fallback `<img>`** (`mwe-math-fallback-image-{inline,display}`), **not** MathML and **not** KaTeX. The `<math>` MathML payload is an XSS surface this sanitizer deliberately strips; the SVG image is what Wikipedia shows, scales crisply, and carries the TeX as `alt`. `cleanMath` drops the now-empty hidden MathML a11y span and **un-hides the image** (removes `aria-hidden`) so its `alt` is screen-reader-announced (C3/§5.3) — the equation is non-visually perceivable without re-allowing `<math>`/`<svg>`.
- **Internal-link resolution** edge cases: red links, disambiguation pages, non-article namespaces.
  *Prototype decision (Topic Page v1; owner directive — canonical title URLs):* article-namespace
  wikilinks are rewritten to the **canonical title route `/topic/<Title>/`** (encoded title, trailing
  slash to match `trailingSlash: true`, basePath-prefixed for the raw `<a href>` so a hard navigation
  resolves under the Pages subpath). The decoded title is also stashed in **`data-topic-title`** so a
  delegated click handler in `TopicView` routes ordinary left-clicks through the Next client router
  (no full reload); modified clicks fall through to the href. On arrival the title is resolved via
  **`resolvePage`** (the seeded store first, else the Wikipedia action API) to its **canonical title +
  plain-text display title + QID** in one call; the **QID is never shown in the address bar**, and the
  **title route canonicalizes BOTH the URL and the heading** (follows redirects/aliases; heading uses
  the plain-text `displaytitle`) — see *Routing — canonical title-based Topic URLs, rendered on demand
  by the Node server* (issue #23). The typed title is **not** preserved on the title route: a messy/alias arrival snaps to
  the canonical `/topic/<Canonical_Title>/`. **Red links** (`.new`/`.mw-redlink`) and **namespaced links**
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
  *Contributor profile route (#54 / D3):* the public profile lives at **`/contributor/<username>`**
  (`app/contributor/[username]/page.tsx`, `dynamicParams = true` — on-demand, no caching), keyed on
  the Wikimedia username and **slug-encoded with the SAME `titleToSlug`/`slugToTitle` seam** (a
  username with a space round-trips as `_`, like a title). `contributorHref(username)` in
  `lib/wiki/topicRoute.ts` builds it; `ProfileView` parses the username back via `slugToTitle`. It
  exposes only public identity (never email) and is browsable anonymously — see *Authentication &
  identity* + *Prototype phase*.
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
  Decision C5). **Capture landed in issue #52 / D1:** the in-product Promote/Add flows require the
  agreement and persist it as `clip.note_license` (`CC-BY-SA-4.0`) + `clip.note_license_agreed_at`,
  stamped server-side by `addClipAction` (see *Data model* → `clip` and *Prototype phase*).
- ~~Abuse/spam handling for open contribution.~~ **Policy resolved** (Curation Standard §7):
  login-gated contribution, defined removable content, honest flagging allowed, per-identity
  rate limits + the `clip.vetted` review hold. **Per-identity write rate-limiting is now ENFORCED
  (issue #57 / D5a)** — and the **backing is Postgres, NOT Redis**: a small **`write_event`** ledger
  table (migration `drizzle/0005_broken_barracuda.sql`) backs a per-`contributor.id` window check
  wired into every counted gated write in `lib/server/actions.ts` (`addClipAction`,
  `upsertTopicAction`, `toggleUpvoteAction`, `recordDismissalAction`, `updateClipAction`,
  `deleteClipAction`). After the auth gate and before any persisting write, the action throws
  `RateLimitedError` (a distinct `name` + the stable `RATE_LIMITED` `code`, client-detected by
  `isRateLimited` beside `isAuthRequired`) if the identity is over its cap, writing nothing.
  **Default cap N=60 writes / W=60s** (env-overridable: `WRITE_RATE_LIMIT_MAX`,
  `WRITE_RATE_LIMIT_WINDOW_SECONDS`; no runtime admin UI), drawn from **one shared per-identity
  budget** (the ledger carries `kind` so a future per-action split needs no migration). **Reads are
  never limited and write no ledger row.** *Why Postgres, not the §7-anticipated Redis:* ARCHITECTURE
  reserves the deferred read-path Redis for the ISR `cacheHandler` + cached candidate sets (not yet
  introduced); D5a must not stand up a Redis service ahead of that need — a `COUNT(... WHERE
  contributor_id = ? AND created_at > now() - W)` over the indexed slice is trivially cheap at
  prototype scale, and the ledger doubles as the §7 audit trail. See *Prototype phase* → **D5a**. The
  **`clip.vetted` review hold + the minimal moderator/reviewer role model is now BUILT (issue #58 /
  D5b)** — additive migration `drizzle/0006_useful_the_phantom.sql` adds `clip.vetted` (boolean, the
  held/published review-state, all existing clips backfilled published) + `contributor.is_moderator`
  (the binary role, granted out-of-band: the DB flag or the `WIKIPLUS_MODERATORS` allowlist — no
  admin UI). Two role-gated Server Actions (`holdClipAction` = moderator-OR-own-curator;
  `reviewClipAction` / approve = moderator-only, no self-approve) slot into the gate→limit→role→write
  order; a held clip renders the calm "in review · not yet vouched" marking, distinct from a curated
  clip and a §6 candidate. **Moderator removal is now BUILT (issue #59 / D5c)** — additive migration
  `drizzle/0007_regular_scorpion.sql` adds the `clip.removed_at`/`removed_by`/`removed_reason`
  **soft-removal tombstone** (all nullable, all-live backfill — no clip went dark). A third role-gated
  Server Action **`removeClipAction`** (reusing the SAME D5b `isModeratorContributor` resolver, but
  **moderator-only — NO own-curator arm**) slots into the same gate→limit→role→write order and
  appends a `remove` `write_event` kind; it **soft-removes** any clip (sets the tombstone, the row
  persists as the §7 audit trail, the read excludes `removed_at IS NULL`), **distinct from** D2's
  owner-gated **hard** delete and from the D5b hold (an independent `removed_at` column — a held clip
  still lists, a removed clip does not). It **never** classifies by `accuracy_flag` (a human moderator
  judges abuse — Curation §7.2 / "removal is for abuse, not disagreement"); the optional reason is the
  C9 §7-category set + free-text, **audit-only, never reader-facing** (no reader-facing removed
  marker). **Restore is deferred but trivial** given the tombstone (clear `removed_at`/`removed_by`);
  D5c builds removal only (no restore UI, no appeals workflow, no moderation dashboard, no admin-grant
  UI). **This closes the §7 enforcement layer (D5a rate-limit + D5b hold + D5c removal) and Milestone
  D.** *Anti-gaming beyond a single-identity cap* (sockpuppets, vote-fraud) stays **post-MVP**.

## Persistence — Drizzle/Postgres behind a server data-access boundary (issue #45 / #35 B)

As of **issue #45** the deployed app's `DataStore` is **Postgres via Drizzle ORM**, reached through
a **server data-access boundary** — replacing the per-browser `localStorage` store for the deployed
app. The seeded topics and every curated clip and candidate dismissal now live in **one shared
database** on the VPS, so everyone on `wikiplus.wikiedu.org` reads and writes the **same data**
(shared, multi-user, durable across devices/sessions/deploys). This lands the **mechanical** half of
the Functional-prototype milestone (everything that worked on localStorage now works on shared
Postgres) and is the foundation **C** (Wikimedia OAuth) and **D** (the curation-action product layer)
build on additively.

- **Boundary mechanism: Server Actions (not route handlers).** Server Actions are already enabled
  (#37), are the idiomatic App-Router client→server call, and let the client import the boundary as
  plain typed async functions — so the call-site rewire from `await store.*` is near drop-in (parity).
  The boundary (`lib/server/actions.ts`, `"use server"`) is a thin set of **mechanical wrappers** over
  the store — **no product logic** (auth-gating / the CC-BY-SA agreement are issue D).
- **Boundary surface is narrower than the store (security, fix round).** The boundary deliberately
  does **not** expose every store method. Until ownership existed, the destructive `updateClip` /
  `deleteClip` were **off** the boundary (an anonymous export would let any visitor edit/delete any
  clip). **As of issue #53 / D2 they are surfaced — but as AUTH-GATED, OWNER-ONLY Server Actions**
  (`updateClipAction` / `deleteClipAction`), **not** the anonymous edit/delete-any the fix round
  guarded against. The gate is **server-side and id-based** (Decision 6): each action runs
  `requireContributor()` **first**, then loads the target clip's `curatorId` and **rejects unless it
  equals the session contributor id** — never by username, never trusting a client flag. A
  non-owner / anonymous / legacy-`@prototype`-clip call writes nothing and is rejected
  (`test/clip-edit-delete.test.ts` is the load-bearing security suite). The update is restricted to
  the **editable set** (Decision 2 — `contextNote`, `stance` (+ preserved modifier), `accuracyFlag`
  (+ preserved modifier), `general`/`sectionSlug`/`sectionLabel`); a forged patch carrying any other
  field (`curatorId`/`curatedBy`/`createdAt`/video/creator/`upvotes`/`topicQid`/`noteLicense*`) is
  dropped at the boundary (`pickEditable`). Delete is a **hard** `db.delete(clip)` (Decision 4 — no
  soft-delete/undo; the captured note-license agreement goes with the row; dismissals are keyed
  independently and are unaffected). The §5.3 **edit re-affirmation** (Decision 3, AC9/AC10) is
  decided server-side: the action recomputes materiality from the **stored** note vs. the patch via
  a shared normalization helper (`lib/curation/note-text.ts` — trim + collapse internal whitespace)
  and re-stamps `note_license` = `CC-BY-SA-4.0` + a fresh `note_license_agreed_at` only when the
  normalized note text changed **and** the client signalled consent; a chip/section-only or
  whitespace-only edit leaves both untouched. The **client affordance** (which clips show
  Edit/Delete) uses **Decision 6 mechanism (a)**: `rowToClip` now surfaces `curatorId` **read-only**
  on the client `Clip`, compared to `session.user.contributorId` in the already-authenticated client
  session (no read-path cost) — a convenience layer that mirrors, but never replaces, the server
  gate (legacy `@prototype` clips carry no `curatorId` → no affordance to anyone, AC8). **The three
  pre-D2 write actions (`addClip`/`upsertTopic`/`recordDismissal`) have been AUTH-GATED since issue
  C** — `requireContributor()` runs at the top of each and rejects an unauthenticated call before any
  DB write (the B-era "unauthenticated boundary" is closed; see *Authentication & identity*). A
  **minimal input stopgap**
  sits on the write actions (after the gate)
  (`addClip`, `upsertTopic`) ahead of D's full validation: a free-text **length cap**
  (`context_note` / `caption` / `title`) and a **closed-set guard** on the curation enums
  (`stance` / `accuracy_flag` / `platform`), rejecting out-of-vocabulary values before any DB call.
  This is a cheap defense, not D's validation/auth layer.
- **The store.** `DrizzleDataStore` (`lib/db/drizzle-store.ts`) implements the **full** `DataStore`
  interface server-side. `lib/data/index.ts` remains the **single seam / swap point**: it wires the
  client to the boundary (DB ops → Server Actions) and keeps the **one client-side method**,
  `suggestCandidates`, running the live YouTube pipeline in the browser.
- **Connection.** `lib/db/client.ts` imports **`server-only`** (so the pg driver + `DATABASE_URL`
  can never enter the client bundle) and opens the **postgres.js** connection **lazily at first
  query — never at build/import time**. `next build` therefore needs **no** `DATABASE_URL` and the CI
  image build never connects to a DB.
- **The read / write / client-Wikipedia flow (the central invariant is unchanged — the server never
  calls Wikipedia, AC8):**
  - **Reads (server-DB):** `listTopics`, `getTopic`, `getTopicByTitle`, `listClips`, the persisted
    `dismissedKeys` — Server Actions → `DrizzleDataStore` → Postgres.
  - **Writes (server-DB):** `upsertTopic`, `addClip`, `recordDismissal` — same path, **auth-gated as
    of issue C** (rejected when anonymous; attributed to the real signed-in contributor). **As of
    issue #53 / D2 `updateClip` / `deleteClip` are also boundary actions** (`updateClipAction` /
    `deleteClipAction`) — **auth-gated + owner-only**, the gate `clip.curatorId === session
    contributor id` (id-based, server-side); delete is hard; see *Boundary surface* above. **As of
    issue #57 / D5a every counted gated write also passes a per-identity rate-limit check** (gate →
    `checkWriteRateLimit` → write → `recordWriteEvent`; over cap → `RateLimitedError`, writes nothing
    — see *Open questions* → Abuse/spam + *Prototype phase* → D5a). **As of issue #58 / D5b two
    role-gated review-hold writes** (`holdClipAction` = moderator-OR-own-curator; `reviewClipAction` /
    approve = moderator-only) slot into the same gate→limit→**role**→write order, the role resolved
    server-side (`lib/auth/moderators.ts`); they set `clip.vetted` (held/published) and append `hold`
    / `review` `write_event` kinds. **As of issue #59 / D5c a third role-gated write** —
    **`removeClipAction`** — slots into the same gate→limit→**role**→write order, reusing the SAME
    server-side `isModeratorContributor` resolver, but **MODERATOR-ONLY with NO own-curator arm** (the
    key contrast with `holdClipAction`): removal of *anyone's* clip is the privileged reach, and a
    non-moderator (including the clip's own curator) is rejected at the action on the role. It is a
    **SOFT removal** — sets the `removed_at`/`removed_by`/optional-`removed_reason` tombstone (the row
    persists; the read excludes `removed_at IS NULL`) and appends a `remove` `write_event` kind —
    **distinct from D2's owner-gated `deleteClipAction` HARD delete** and from D5b's hold/approve (an
    independent `removed_at` column). It **never** gates on or reads `accuracy_flag` (a human moderator
    judges abuse — Curation §7.2). Migrations through `drizzle/0007_regular_scorpion.sql` (the
    `clip.removed_at`/`removed_by`/`removed_reason` soft-removal tombstone columns).
  - **Client (Wikipedia/YouTube), unchanged:** title→QID resolution, the article-body fetch, the TOC,
    and the **live YouTube candidate search** all stay **client-side**. `suggestCandidates` runs the
    pure pipeline in the browser; the (now shared) dismissed-video keys it needs for dedup are fetched
    via the boundary first and passed in. `listCandidates` is `[]` server-side (candidates are
    computed + cached, never DB rows — see *Candidate suggestion*); the seeded mock candidate set the
    prototype carried in localStorage is retired.
- **Schema (`lib/db/schema.ts`) + migrations (`drizzle/`, generated by `drizzle-kit`).** Tables:
  `topic` (`wikidata_qid` unique, `title`/`lang`/`description`, timestamps — **no `article_index`**,
  which belongs to the deferred production read-path), `clip` (**every** field on the app's `Clip`
  type), `contributor` (`handle` is a **non-unique** display column — the C fix round dropped its
  UNIQUE constraint, migration `0001_loose_blockbuster.sql`, so identity anchors on the `account`
  row, not the handle), `account` (**Auth.js-adapter-shaped** — `unique(provider, provider_account_id)`,
  FK to contributor — **issue C adopted it with only that one additive constraint drop**, AC9: the existing
  columns already carried the JWT find-or-create's needs),
  `dismissed_candidate` (`unique(topic_id, provider, provider_video_id)` — the sticky-dismissal
  identity; shared so a candidate dismissed by anyone stays dismissed for everyone), and
  `clip_vote` (**issue #55 / D4**, migration `0004_perpetual_fat_cobra.sql` — `unique(clip_id,
  contributor_id)` is the one-per-user upvote invariant, FKs to `clip`/`contributor` both
  `onDelete: cascade`; a clean **additive** migration — no drop/rename/backfill of `clip.upvotes`,
  which is kept as the frozen seed baseline). **`write_event`** (**issue #57 / D5a**, migration
  `0005_broken_barracuda.sql` — the per-identity rate-limit ledger). **As of issue #58 / D5b**
  (migration `0006_useful_the_phantom.sql`) two **additive columns** land — `clip.vetted` (boolean
  `NOT NULL DEFAULT true`, the review-hold state, existing rows backfilled published) and
  `contributor.is_moderator` (boolean `NOT NULL DEFAULT false`, the binary reviewer role) — a clean
  additive, non-destructive change (no drop, no type change, no data loss).
- **Migration + seed run on DEPLOY, never at build or per-request.** A compose **`migrate` one-shot**
  (same app image, `command: node dist/migrate.cjs`) applies pending Drizzle migrations then runs the
  idempotent seed (`lib/db/seed.ts`, ported from the prototype seed) against Postgres **before** the
  app server starts (`app depends_on migrate: service_completed_successfully`). So a push to `main`
  that changes the schema lands a migrated + seeded DB with no manual SSH. The migrate entrypoint is
  bundled (`scripts/build-migrate.mjs` → `dist/migrate.cjs`) so the tiny standalone runtime image runs
  it with plain `node` (no tsx / drizzle-kit / full `node_modules`).
- **Interim attribution (stub contributor) — superseded by C.** B introduced no sign-in: every write
  was attributed to a single seeded **`@prototype`** contributor. **Issue C swapped this for real
  per-user identity** — new writes attribute to the signed-in Wikimedia contributor; the stub stays
  only for clips curated before C (no retro-rewrite — D6). See *Authentication & identity*.
- **Async-write UX (new in B — localStorage was synchronous and never failed).** The two relocated
  reader/curate writes get deliberate pending/failure UX (design `docs/design/persistence-postgres.md`):
  the **contribute add is awaited** (pending/disabled button, fields preserved on failure, honest
  error + retry, no false success); the **sticky dismissal is optimistic with rollback** (hide
  instantly, persist in the background, re-show the card + a polite notice on failure). Read failures
  degrade to an honest line (home: "Couldn't load topics", topic rail: "Couldn't load curated
  videos"), never an infinite spinner. The cosmetic "synced" label stays a static string (no realtime).
- **Tests.** `DrizzleDataStore` + the seed are tested against **pglite** (in-memory Postgres, WASM) so
  the contract runs in CI with **no live DB / no network** (`test/drizzle-store.test.ts`,
  `test/helpers/pglite-db.ts`). The view/integration tests mock the `@/lib/data` seam to a
  localStorage-backed double (`test/helpers/data-mock.ts`) — the component state machine is what they
  exercise; the data backend is incidental.
- **Still deferred:** ISR + the Redis shared `cacheHandler`, the production read-path caching,
  `article_index`, moving Wikipedia/QID/YouTube server-side, Cloudflare edge cache, Redis in compose,
  and real sign-in (**C**) + the curation-action product layer (**D**).

## Prototype phase (current — Node SSR server; shared Postgres data layer as of #45)

The prototype began as a **client-side SPA** with `localStorage` standing in for the production
database (single-user, per-browser). **As of issue #45 the data layer is shared Postgres via Drizzle**
(see *Persistence* above) — the deployed app is **multi-user and durable**. It does **not** yet exercise
the production read-path (ISR/Redis) or real auth (Wikimedia OAuth is **C**).

As of **issue #37** the prototype runs as a **Next.js App Router Node SSR server** — `next build`
produces a **server build** (`.next/`, no `out/`) and `next start` serves it, rendering Topic titles
**on demand** (including never-seeded ones). This replaced the earlier `output: 'export'` static
export. The switch is the gate the rest of the Functional-prototype milestone sits behind: a running
Node server is what makes **Server Actions** (enabled here as a capability; see *Server Actions*
below), real auth (Auth.js), and a real DB (Drizzle) buildable. **It is verified locally and
deliberately not auto-deployed** — the GitHub Pages auto-deploy is paused (see *Deploy* below) until
a host is provisioned (issue A.2).

- **Run / build / test:**
  - `yarn dev` — local dev server.
  - `yarn build` — produces the **server build** in `.next/` (no static `out/` export).
  - `yarn start` — serves the built server (`next start`); pair with `yarn build` first.
  - `yarn typecheck` / `yarn test` (Vitest) / `yarn test:e2e` (Playwright against `next build` +
    `next start`; see *Testing*).
  - `basePath` is **env-driven** (`NEXT_PUBLIC_BASE_PATH`, empty for the root-served local server; a
    future subpath host can set it). `next.config.mjs` documents which export-only concessions were
    kept vs. dropped at the SSR switch: `output:'export'` **dropped**; `assetPrefix` **dropped** (the
    server prefixes `_next/` assets from `basePath` itself); `images.unoptimized` **kept** (no
    `next/image` in use; harmless no-op); `trailingSlash:true` **kept** (the canonical `/topic/<Title>/`
    URL — now enforced by the server's redirect rather than by a built `<route>/index.html`);
    `outputFileTracingRoot` **kept**.
- **Deploy:** **LIVE (issue A.2 / #42).** A push to `main` auto-deploys the Node SSR server to a
  **Linode Nanode 1GB (Debian 13 / trixie as shipped)** at **`wikiplus.wikiedu.org`** via Docker Compose (`app` +
  `caddy`; Postgres/Redis still deferred to issue B, Cloudflare edge cache to the production-MVP).
  `.github/workflows/deploy.yml` (re-enabled `push: [main]` + `workflow_dispatch`) builds the
  **standalone** image in CI, pushes it to **GHCR** (`ghcr.io/ragesoss/wikiplus`), then SSHes to the box
  to `docker compose pull && docker compose up -d` — **the box never builds Next.js** (would OOM). The
  old GitHub Pages static-export workflow is fully replaced. See **Deployment** above + the `deploy/`
  files + the box-setup runbook (`docs/ops/vps-setup.md`). The cloud, mobile-drivable prompt→staging loop
  resumes here against the Node server.
- **YouTube key:** `NEXT_PUBLIC_YOUTUBE_API_KEY` in `.env` (gitignored) for local dev. A `NEXT_PUBLIC_`
  var is read at **build time** and inlined into the **client** bundle (search runs client-side this
  round), so it is **visible in the shipped bundle by design** — the HTTP-referrer restriction and a
  quota cap are the guard, not secrecy. Unset in local/CI builds → the live search **no-ops** (falls
  back to the seeded/empty candidate set), unchanged by the SSR switch. (The now-paused `deploy.yml`
  read it from a GitHub Actions secret; when search moves **server-side** in the production read-path it
  becomes a server secret, not a client-inlined var.)
- **Data:** all access goes through the `DataStore` interface (`lib/data/store.ts`). **As of #45 the
  deployed app uses `DrizzleDataStore` (shared Postgres) reached via Server Actions** — see
  *Persistence — Drizzle/Postgres behind a server data-access boundary* above. `lib/data/index.ts` is
  the single seam/swap point. `LocalStorageDataStore` is kept as a reference impl + test double, no
  longer wired for the deployed app.
- **Wikipedia:** article fetch + DOMPurify sanitize run client-side (as in production); Wikidata
  resolves QID→title. For **playback** oEmbed is still avoided — we store `platform`+`videoId` and
  build the click-to-load facade ourselves. **For add-by-link *metadata* (issue #64 / D-add-link),**
  a YouTube oEmbed lookup now runs **server-side** (`resolveOEmbedAction`) to populate the real
  title/creator/thumbnail — metadata only, still embed-never-host (see *D-add-link* below).
- **Auth:** **LIVE as of issue C** — real **Wikimedia OAuth 2.0 via Auth.js v5** (JWT sessions,
  no session store). Reading stays anonymous; the three persisted write actions
  (`addClipAction`/`upsertTopicAction`/`recordDismissalAction`) are **auth-gated at the Server
  Actions boundary** and attribute to the real signed-in contributor. The interim `@prototype`
  stub is **superseded for new writes** (kept only for pre-C clips — D6). See *Authentication &
  identity* above for the as-built. (Was: "stubbed — reading is anonymous; real Wikimedia OAuth
  arrives with the server.") **Ops bring-up needs:** `AUTH_SECRET` (new server secret), the
  existing `wikimedia_oauth_client_key`/`_secret` as Docker secrets on the box, and the prod
  callback `https://wikiplus.wikiedu.org/api/auth/callback/wikimedia` registered at
  meta.wikimedia.org.
- **In-product Promote / Add-by-link now persist (issue #52 / D1).** The two Topic-page curation
  modals (`components/topic/CurateModal.tsx`, `AddModal.tsx`) — previously `// mock submit` — now
  write through the **auth-gated Server Actions boundary**: `CurateModal` → `addClipAction`;
  `AddModal` → (`upsertTopicAction` if the topic is not yet in the store →) `addClipAction`. The
  host (`app/topic/TopicView.tsx`) owns the write + the in-memory clip-state update (the new clip
  renders with no reload, flipping empty→curated when first) + dropping the promoted candidate from
  the live suggestion set (deduped by `platform:videoId`) + the expired-session gate (reusing C's
  `isAuthRequired` → `showExpiredGate` pattern). The **CC BY-SA note-license agreement** (Curation
  Standard §5.3 / Decision D1-1) is a **required** publish precondition (the unchecked-on-open
  checkbox in `CurateFields` gates publish) and is **captured** on the clip row at write time:
  `clip.note_license` (`CC-BY-SA-4.0`, a version string) + `clip.note_license_agreed_at`
  (server-stamped timestamp). The client sends only a **consent boolean**; `addClipAction` stamps
  the license + timestamp and **strips any `note_license*` smuggled on the input** (attribution +
  license are the boundary's call, never the client's — same posture as `curated_by`). The canonical
  license version + the two verbatim agreement strings live in `lib/curation/note-license.ts`.
  Immediate publish, no `vetted` review hold (Decision D1-2; D5 owns the hold). Migration
  `drizzle/0002_*` adds the two nullable columns to the C schema.
- **Owner-only edit / delete of your own clips (issue #53 / D2).** `updateClipAction` /
  `deleteClipAction` are now on the **auth-gated Server Actions boundary** — **owner-only**, the
  gate `clip.curatorId === session contributor id` (id-based, server-side; `requireContributor()`
  then the ownership check; a non-owner/anonymous/legacy-`@prototype` call writes nothing). Edit is
  restricted to the **editable set** (note + stance/accuracy (+ preserved modifiers) + section;
  Decision 2) — a forged out-of-set patch is dropped (`pickEditable`); delete is a **hard**
  `db.delete` (Decision 4). A **material note-text change** (normalized via
  `lib/curation/note-text.ts`) re-stamps `note_license`/`note_license_agreed_at` server-side (§5.3 /
  Decision 3); a chip/section-only or whitespace-only edit does not. The Topic page shows the
  owner-only **Edit/Delete** affordances on the curated `ClipCard` (an Edit modal cloned from
  `CurateModal` with the conditional re-agreement; a Cancel-default Delete confirm dialog) and
  re-renders **in place** / removes-and-refocuses with no reload. Affordance ownership uses
  **Decision 6 (a)** — `curatorId` surfaced read-only on the client `Clip` (`rowToClip`), compared
  to `session.user.contributorId` (no read-path cost; mirrors but never replaces the server gate).
  **No migration** (the columns + store methods already existed). Moderator removal of *anyone's*
  clip is **D5**.
- **Public contributor profiles + "context by &lt;curator&gt;" attribution (issue #54 / D3).** A new
  **public profile route `/contributor/<username>`** (`app/contributor/[username]/page.tsx` +
  `app/contributor/ProfileView.tsx`, paralleling the title-based Topic catch-all and Wikipedia's
  `Special:Contributions/<user>`) lists a contributor's curated clips with topic context. It
  exposes **only public identity** — the Wikimedia **username** (`contributor.handle`) + the
  **granted avatar** — and **NEVER `email`** or any non-public `account` field (the privacy
  boundary is the **public-safe projection** `rowToPublicContributor` in `lib/db/mappers.ts`, which
  selects only `contributor` columns; `account.email` is never joined or read on this path —
  `PublicContributor` carries `{id, username, avatarUrl}` only). Reading any profile is
  **anonymous** (no session). **"My curations" is the owner-view of that same route** (Decision 2):
  a signed-in viewer reaches their own `/contributor/<own-username>` via the header account menu
  ("My curations", above "Sign out"), and when the viewer **is** the owner the page reframes to "My
  curations" + surfaces the owner Edit/Delete affordances — **no** separate private route or
  private data. Two new **read** methods on the seam (`lib/data/store.ts` → read-only Server Actions
  `getContributorByUsernameAction` / `listClipsByContributorAction`, **no `requireContributor`
  gate** — public like `listClips`, over `DrizzleDataStore`): **`getContributorByUsername`** resolves
  a username to the public-safe projection, returning **null** for unknown; **`listClipsByContributor`**
  returns exactly that contributor's clips joined to their parent topic (title + QID for the "On
  &lt;Topic&gt;" link), newest-first. Because `contributor.handle` is **non-unique**, the lookup
  resolves deterministically to a **single** identity by the **lowest/earliest `contributor.id`**
  for that handle (Decision 1), so `/contributor/<username>` always maps to one profile. The seeded
  **`@prototype` stub resolves to null** (not-found / non-profile state — Decision 4): it is not a
  real person to profile. The public **"context by &lt;username&gt;"** attribution (a shared
  `ContextByLink` element, strings in `lib/curation/curator-attribution.ts`) links **IN** to
  `/contributor/<username>` on the curated `ClipCard` footer + the curated `GeneralStrip` tile —
  **distinct** from the §5.2 creator credit, which links **OUT** to the platform (direction is the
  editorial tell, CURATION §5.4); a `@prototype`/no-curator clip shows the **non-linked**
  `seed clip · no curator` label. The D2 owner Edit/Delete affordance now also reaches **General-band
  clips** (the `GeneralStrip` tile, closing the D2 gap) and the profile clip list, reusing D2's
  `EditModal`/`DeleteConfirmDialog` + `ownsClip()` over the **unchanged** server-side ownership gate.
  **No per-user work is added to the cached topic read path** (Decision 5): the attribution is static
  markup from `clip.curatedBy` (already on every clip), the owner-affordance is the
  already-authenticated client-session compare, and the profile reads run **only** on the profile
  route. The profile route is a **plain dynamic read page** — no ISR/Redis caching (deferred). An
  **optional additive index** migration (`drizzle/0003_*`) adds non-unique btree indexes on
  `clip.curator_id`, `clip.topic_id`, and `contributor.handle` (insurance for the new by-contributor
  + handle queries at scale; non-destructive, no data migration).
- **Upvotes as a persisted, one-per-user, toggleable signal (issue #55 / D4).** The reader's "I'm
  glad I watched this" signal is now real: the static `▲ {clip.upvotes}` becomes an interactive,
  identity-tied **toggle**. A new **`clip_vote`** table (one row per `(clip, contributor)`,
  `unique(clip_id, contributor_id)`, FKs to `clip`/`contributor` both `onDelete: cascade`) carries
  the votes; the **one-per-user cap is the DB unique constraint, not app logic** (a duplicate insert
  collides). The **displayed count is DERIVED** — `(clip.upvotes ?? 0) + COUNT(clip_vote rows)` — so
  it can never drift from the set of distinct real voters; the legacy **`clip.upvotes` is a FROZEN
  seed baseline**, never written by a vote (a seeded demo clip keeps its number and real votes layer
  on top; a seeded clip can't drop below its baseline — that's correct, the seed is demo decoration).
  A viewer's **"have I voted?"** state comes **only** from `clip_vote`, never the seed. One
  **auth-gated Server Action `toggleUpvoteAction(clipId)`**: `requireContributor()` **FIRST** (an
  anonymous/expired call writes nothing — the gate is server-side, the C/D1 posture), then
  insert-if-absent (`onConflictDoNothing` so a race lands voted) / delete-if-present, returning the
  new `{ voted, count }`. **Self-vote is allowed** (no `curatorId === voter` special case — Decision
  3; the abuse posture is D5). The Topic page uses **optimistic-with-rollback** (`runUpvote`, cloned
  from `runDismiss`): the count moves ±1 and the voted-state flips instantly, reconciled to the
  server's authoritative return; on error it rolls back — an expired session (`isAuthRequired`) →
  the D1 expired-session gate, else a polite `role="status"` notice. Logged-out activation routes to
  C's gate (a new **`upvote` entry** in `AUTH_COPY.gates`) with **no** optimistic vote (the count
  stays visible — reading is anonymous). The voted/not-voted state is **never color-alone**:
  `aria-pressed` + a visible "Voted" word + a filled-vs-outline glyph (CURATION §4). **Read-path
  discipline (the key constraint):** the **count is public** and rides the topic read (`listClips`
  derives it — same for every viewer); the **per-viewer voted-state is OFF the cached read path** —
  a viewer-scoped **`votedClipIds(clipIds)`** seam read (auth-gated `votedClipIdsAction`) resolved in
  the **already-authenticated client session** (hydrate-on-mount in `TopicView`, scoped to the
  visible clips), exactly as D2/D3's `ownsClip()` is computed client-side. An **anonymous topic load
  does ZERO voted-state work**; `listClips` issues **no** per-user vote query. A clean **additive**
  migration (`drizzle/0004_perpetual_fat_cobra.sql`) adds the table — no drop/rename/backfill of
  `clip.upvotes`. **No** downvotes/ranking/rate-limits (D5); **no** ISR/Redis (still deferred — but
  D4 plants no per-user state where the future cache will live).
- **Per-identity write rate-limit enforcement (issue #57 / D5a).** The §7 posture
  ("per-identity write limits to blunt spam floods; contribution is gated, reading is anonymous") is
  now ENFORCED. A signed-in identity may make at most **N=60 writes per W=60s** (default;
  env-overridable via `WRITE_RATE_LIMIT_MAX` / `WRITE_RATE_LIMIT_WINDOW_SECONDS`, **no** runtime admin
  UI) across the counted gated writes, keyed by **`contributor.id`** (Decision 4 — not global, not
  per-IP; the gate runs first so the limiter only ever sees an authenticated identity). The limited
  set is **every gated write** (Decision 2): `addClipAction` + its prerequisite `upsertTopicAction`,
  `toggleUpvoteAction`, `recordDismissalAction`, and the owner `updateClipAction` /
  `deleteClipAction` — all drawing from **one shared per-identity budget**. **Backing: Postgres — a
  small `write_event` ledger** (Decision 1), **NOT Redis**: ARCHITECTURE reserves the deferred
  read-path Redis for the ISR `cacheHandler` + cached candidate sets (not yet introduced), and D5a
  must not stand up a Redis service ahead of that need; a `COUNT(... WHERE contributor_id = ? AND
  created_at > now() - W)` over the indexed `(contributor_id, created_at)` slice is trivially cheap +
  correct at prototype scale, and the ledger doubles as the §7 audit trail. The **order is
  gate→limit→write** (`lib/auth/rate-limit.ts`): `requireContributor()` FIRST, then
  `checkWriteRateLimit` (a **pure read** — over the cap throws **`RateLimitedError`** with NO side
  effect, so the rejected write writes nothing — AC2), then validation + the write, then
  `recordWriteEvent` appends ONE ledger row AFTER the write lands (counting only **successful**
  writes — a validation failure consumes no budget). `RateLimitedError` mirrors `AuthRequiredError`
  (distinct `name` + stable **`RATE_LIMITED`** `code`, surviving Next.js prod message redaction); the
  client-safe **`isRateLimited`** detector sits beside `isAuthRequired` in `lib/auth/auth-error.ts`.
  Each gated-write call-site (`runUpvote`, `runDismiss`, the modal submit, edit/delete in `TopicView`
  + `ProfileView`) widens its catch to **three mutually-exclusive arms**: `isAuthRequired →`
  expired-session gate; `isRateLimited →` a **calm, non-red `role="status"`** "too fast" notice (the
  new verbatim `AUTH_COPY.rateLimit.notice`, distinct from the gates + the generic red errors);
  `else →` the generic error. The optimistic-write **rollback** (D4/#45) is unchanged. **Reads are
  never limited and write no ledger row** (AC6); a normal-speed human never trips it (AC1). The
  ledger carries **`kind`** so a future per-action budget split needs **no** schema change; a periodic
  prune of aged rows is an **Ops follow-up**, not required for correctness. A clean **additive**
  migration (`drizzle/0005_broken_barracuda.sql`) adds the table — no drop/rename/backfill. **Not** in
  D5a: the `vetted` review hold + role model (**D5b**, now built — below), moderator removal
  (**D5c**), and sockpuppet/vote-fraud heuristics (post-MVP). **No** ISR/Redis (still deferred).
- **The `vetted` review-hold + the minimal moderator/reviewer role model (issue #58 / D5b).** The §7
  review-hold posture ("a light `vetted` hold is **available** to queue a freshly added clip for
  review before it shows as fully curated") + §6's not-vouched-for language are now ENFORCED as a
  **third clip-state** (Curation Standard §7.1 / Decision C8). **Additive migration**
  (`drizzle/0006_useful_the_phantom.sql`) — **no** new infra, **no** new secret, **no** Redis: it
  adds `clip.vetted` (boolean `NOT NULL DEFAULT true` — `false` ≙ held / in review, `true` ≙
  published; **new adds publish by default**, D1-2 preserved; **all existing/seeded clips backfilled
  to published** so no live clip went dark) and `contributor.is_moderator` (boolean `NOT NULL DEFAULT
  false` — the binary role). The held-state is a property of the **clip**, so it **rides the clip
  read** (`listClips` → the client `Clip.held` flag, derived in `rowToClip`); the cached read path
  does **no** per-user work to render the held marking (Decision 4). Two **role-gated Server Actions**
  in `lib/server/actions.ts`, both in the established **gate→limit→role→write** order
  (`requireContributor()` FIRST → the D5a rate-limit → the **server-side** role/ownership check →
  write; the role check rejects + writes nothing otherwise — the load-bearing security behavior):
  - **`holdClipAction`** (publish → held, `vetted=false`): allowed for **a moderator (any clip)** OR
    **the clip's own curator (own clip only)** — Decision 3.
  - **`reviewClipAction`** / approve (held → published, `vetted=true`): **moderator-only** — a curator
    may **not** self-approve, not even their own held clip (the vouch is confirmed by someone other
    than its author — §7.1).

    The role is resolved **server-side** (`lib/auth/moderators.ts` — the DB `is_moderator` column OR
    the `WIKIPLUS_MODERATORS` env allowlist), **never** a client flag; a matching JWT `isModerator`
    session claim (resolved the same way at login) drives only the off-read-path reviewer affordances
    (the D2/D4 owner-affordance pattern). The held clip renders a calm, text-labeled **"In review ·
    not yet vouched"** marking (the verbatim §7.1 strings) on the `ClipCard` (solid ink left-rule,
    above the chips) and the `GeneralStrip` tile (a white-fill pill for AA on the indigo band),
    **keeping** its note/chips/curator — distinct from a fully-curated clip and from a §6 candidate.
    The two new `write_event` `kind`s (`hold` / `review`) need **no** ledger schema change. **How a
    moderator is granted** is OUT-OF-BAND (no admin UI — see *Data model* → `contributor`); **granting
    a live moderator is a separate owner/ops runbook step**, and the feature ships **green without
    one** (the gate rejects everyone until granted; the workflow is proven in CI with a stubbed
    moderator). **Not** in D5b: moderator *removal* of abusive clips (**D5c** — reuses this role
    model), an admin UI to grant roles, appeals, auto-hold heuristics. **No** ISR/Redis (still
    deferred).
- **Moderator removal of abusive clips — the soft-removal tombstone (issue #59 / D5c).** The §7
  "removable content" rule + §7.1's removal-vs-hold distinction are now ENFORCED as a **moderator-only
  soft removal** (Curation Standard §7.2 / Decision C9) — the **final Milestone D run**, closing the §7
  enforcement layer (D5a rate-limit + D5b hold + D5c removal). **Additive migration**
  (`drizzle/0007_regular_scorpion.sql`) — **no** new infra, **no** new secret, **no** Redis: it adds
  `clip.removed_at` (timestamptz nullable — the single removed/live discriminant, `NULL` ≙ live),
  `clip.removed_by` (integer → `contributor.id`, `ON DELETE SET NULL`), and `clip.removed_reason` (text
  nullable). **All default `NULL`; no backfill marks any clip removed**, so every existing/seeded clip
  landed **live** (`removed_at IS NULL`) — **no live clip went dark** (AC6). Removal is a **SOFT
  tombstone, NOT a hard delete** (Decision 1): the row **persists** with who/when/optional-why as the
  §7 audit trail (a privileged act on another person's work must be auditable + attributable), and the
  clip **stops showing** because the **clip read excludes `removed_at IS NULL`** — `listClips` AND
  `listClipsByContributor` gained the predicate, so the removed-state rides the read as an
  **exclusion** (a property of the clip, the same for every viewer) with **no per-user work** on the
  cached read path (AC7). There is **no reader-facing removed marker** (the deliberate contrast with
  the D5b *shown-but-marked* held state — a removed clip is simply filtered out). One **role-gated
  Server Action** `removeClipAction` in the established **gate→limit→role→write** order
  (`requireContributor()` FIRST → the D5a rate-limit → the **server-side** role check → the
  soft-remove; appends a `remove` `write_event` kind, no ledger schema change). The role check is
  **MODERATOR-ONLY** — it reuses the SAME D5b resolver (`isModeratorContributor` — the DB
  `is_moderator` column OR the `WIKIPLUS_MODERATORS` allowlist, server-side, never a client flag) but
  has **NO own-curator OR-arm** (the key contrast with `holdClipAction`): removal of *anyone's* clip is
  the privileged reach, and a non-moderator — **including the clip's own curator acting as a
  non-moderator** — is rejected **at the action on the role** and the clip stays (AC2; an anonymous
  caller is rejected by the gate FIRST — AC3; these are the load-bearing security tests, not a hidden
  button). It **never** gates on or reads `accuracy_flag` — a human moderator judges abuse; an honest
  `opinion`/`mixed`/`inaccurate` clip with a fair note is legitimately curatable, NOT removable
  ("removal is for abuse, not disagreement" — §7.2 / Decision 2). The optional **`removed_reason`** is
  the C9 §7-category set + optional free-text (centralized in `lib/curation/removal-reason.ts`),
  **both optional** (a removal needs no reason — the reason NEVER gates removal), **audit-only, NEVER
  reader-facing**. **Distinct from D2's owner-gated `deleteClipAction` HARD delete** (the row is GONE
  there; here it persists — AC4) and from the D5b hold (an INDEPENDENT `removed_at` column: a held clip
  `vetted=false`,`removed_at IS NULL` still lists; a removed clip is excluded regardless of `vetted` —
  AC5). The client reflects a removal by **filtering the clip out of the in-memory `clips` set** (no
  reload; counts drop; the last clip flips curated→empty), through the `RemoveConfirmDialog` (parallel
  to D2's `DeleteConfirmDialog` — Cancel-default, the soft/reversible copy, the optional reason, the
  three-arm catch); focus moves to `focusBandHeading()` (the removed-node anchor, like D2 Delete). The
  moderator-only **Remove (moderator)** affordance joins the D5b `ReviewRow` (last, after
  Hold/Approve, restrained `accred`) on the rail card + the General tile, computed from the
  off-read-path `isModerator` claim (NO own-curator arm — the convenience layer; the server gate is
  the security control). **Restore is DEFERRED but TRIVIAL** given the soft tombstone (a near-mirror
  action: clear `removed_at`/`removed_by`) — D5c builds removal only. **Not** in D5c: a restore /
  un-remove UI, an appeals workflow, a moderation dashboard / removal-log UI, auto-classification of
  abuse, an admin-grant UI, hard-deleting others' clips. **No** ISR/Redis (still deferred). **Closing
  D5c closes Milestone D.**
- **Real video-metadata resolution on add-by-link (issue #64 / D-add-link).** The add-by-link flow
  no longer labels a pasted clip with placeholder mock metadata ("Pasted clip (mock preview)" /
  `creator.handle: "pasted"` / "Pasted {platform} clip"). A recognized **YouTube** link now resolves
  **real** `title`→`caption`, `author_name`→`creator.name`, `author_url`→`creator.url`, a derived
  `creator.handle` (the SAME derivation as the candidate pipeline — `lib/candidates/youtube.ts:111`,
  `@`+name lowercased/spaces-removed; name-only when none derives — CURATION §5.5/C10), and
  `thumbnail_url`→`thumbnailUrl` (a referenced URL, never hosted — embed-never-host preserved). The
  preview updates **before** submit; the corrected modal shows "Resolved via oEmbed" **only** on a
  real resolve (the prior mock claimed it over mock text). **CORS decision (landed):** the oEmbed
  fetch runs in a **Server Action** (`lib/embed/oembed.ts` `resolveOEmbedAction`), **not** a client
  fetch — `https://www.youtube.com/oembed` sends no `Access-Control-Allow-Origin`, so a browser fetch
  would CORS-fail and push every add into the failure state; the server action sidesteps CORS and is
  the natural home for the descriptive **`User-Agent`** (etiquette/AC8 — browsers forbid setting it).
  It is **stateless**: **no schema change, no new secret** (YouTube oEmbed needs no key — independent
  of the YouTube *Data API* search key), **no read-path cache** (`cache: "no-store"`), and it is
  **not** auth-gated/rate-limited (a read-only metadata lookup; the *write* is still gated at
  `addClipAction`). **D-TikTok decision (landed): the placeholder arm.** Only YouTube resolves this
  loop; a recognized **TikTok / Instagram / other** link returns `{ ok: false, reason: "unsupported" }`
  (no fetch) and lands on an **honest unresolved placeholder** — "Unresolved {Platform} clip" caption,
  a NON-linked "Creator not resolved" credit (no fabricated name, no fake/dead `creator.url`, no
  `"pasted"` handle, no false "resolved via oEmbed" — C10), plus an MVP-limitation line — consistent
  with TikTok being already partial (auto-suggestion deferred). A YouTube **fetch failure** shows a
  labeled, non-red "Couldn't fetch video details" state with **Try again / Add anyway / Cancel** (Add
  anyway → the same honest placeholder), so the flow is never a dead end. The card's creator credit
  (`ClipCard`) now **degrades to a non-linked span when `creator.url` is absent** (the read-path
  realization of C10 — never a dead/empty outbound link). The persisted `Clip`/`ClipMediaSource` shape
  is unchanged (AC10); the only changes are the **values** in `caption`/`creator`/`thumbnailUrl` and
  the modal **states**. The pre-persistence parse validation (unrecognized link → the existing red
  "Unrecognized link" error, never reaches persistence) is unchanged.
- **Server Actions (enabled #37; now the data-access boundary — issue #45).** The Node SSR runtime
  supports Server Actions; as of #45 they are the **data-access boundary** for shared Postgres
  (`lib/server/actions.ts`, `"use server"` — see *Persistence* above). The throwaway #37 smoke artifact
  (`lib/server/smoke-action.ts` + `components/dev/SmokeActionProbe.tsx`) was its placeholder; it has
  been **removed** now that the real boundary has landed (its own comments said to delete it when a
  real action arrives). The server **still never** talks to Wikipedia — title→QID, the article body,
  the TOC, and the YouTube candidate search all stay client-side, exactly as before (AC8).
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

- **Routing — canonical title-based Topic URLs, rendered on demand by the Node server (Topic Page v1;
  SSR switch issue #37).** The user-facing Topic URL is **title-based** (`/topic/<Title>`, paralleling
  `/wiki/<Title>`); the QID is the internal key, resolved under the hood and never shown (owner
  directive; AC5/AC23). The route is an **optional catch-all** `app/topic/[[...slug]]/page.tsx`:
  `generateStaticParams` still pre-renders the **seeded titles** (`Photosynthesis`,
  `Cellular_respiration`, `Cat`) plus the bare `/topic` shell (`slug: []`) that serves the `?qid=`
  back-compat entry — so the warm paths render without an on-demand pass. **As of #37,
  `dynamicParams = true`:** any title NOT in `generateStaticParams` is **rendered on demand by the
  running server**, not 404'd. This **removed the static-export workarounds**: the old
  `dynamicParams = false` constraint, and the **`404.html`-is-`not-found.tsx` SPA-shell trick** (under
  `output:'export'`, GitHub Pages served `404.html` for unseeded titles and `not-found.tsx` was emitted
  as that file and re-rendered `TopicView` from `location.pathname`). With a server, the catch-all owns
  **every** `/topic/...` path, so `not-found.tsx` no longer doubles as the topic-deep-link shell — its
  job shrinks to the #13 bare-path boot (below). The server **never** talks to Wikipedia: an on-demand
  render emits the same neutral loading shell, and `TopicView` resolves the title client-side
  (`titleFromPathname` → `resolvePage` → article fetch) exactly as before. In-app navigation uses the
  Next client router (`<Link>` + a delegated wikilink click handler), so it never triggers a full
  reload. Helpers live in `lib/wiki/topicRoute.ts` (`topicHref`, `titleFromPathname`, `titleToSlug`,
  `currentTopicSlug`). `trailingSlash:true` is kept, so the server **308-redirects** a slashless
  `/topic/<Title>` to the canonical `/topic/<Title>/`.
  - **Title-route arrival CANONICALIZES both the URL and the heading (issue #23 — supersedes the
    earlier "no redirect… title preserved" note).** On arrival at a typed/pasted `/topic/<typed>/`,
    `TopicView` resolves the title via **`resolvePage` (`lib/wiki/article.ts`)** — a SINGLE action-API
    request `action=query&prop=info|pageprops&inprop=displaytitle&ppprop=wikibase_item&redirects=1&
    titles=…` that returns `pages[].title` (**canonical** title — no longer discarded),
    `pages[].displaytitle` (**rendered** title), and the QID, with **no extra round-trip** vs. the prior
    QID-only call (`titleToQid` is now a thin wrapper over `resolvePage`). `redirects=1` **follows
    Wikipedia redirects / aliases** (`jfk` → `John F. Kennedy`). The canonical/display values then
    **split**: the **canonical title** keys the URL/slug, the store lookup, the QID lookup, the article
    fetch, and the **"From Wikipedia"** attribution link / `ArticleError` URL; the **plain-text
    `displaytitle`** (HTML stripped — rich-formatted headings are deferred) drives **only** the human
    heading (the masthead `<h1>` + the compact `TopicHeader` echo), so the URL and heading legitimately
    differ for author-stylized titles (canonical `Bell_hooks` ⇄ heading `bell hooks`). When the slug a
    reader arrived on (`currentTopicSlug(pathname)`) differs from `titleToSlug(canonicalTitle)`,
    `TopicView` **`router.replace`s** (never `push`, so **Back** doesn't bounce through the typo) to the
    canonical `/topic/<Canonical_Title>/` (underscore form, trailing slash + basePath via `topicHref`);
    an already-canonical arrival fires **zero** replaces (no loop, no history churn). An **unresolved**
    title (no canonical title / no QID, and no seeded-store hit) is **not** canonicalized — no replace to
    an empty/partial slug — and reaches the existing not-found / resolve-error path (issue #19). The
    **live canonical title wins over a differing seeded-store title** (keeps URL + store key + heading
    consistent); the store is only the fallback when the API resolves nothing. The legacy `?qid=` entry
    is unchanged (resolves QID→title, `router.replace`s to the title URL).

- **Routing — bare-path fallback redirect (`/<Title>` → `/topic/<Title>/`, issue #13).** A **bare
  single-segment path** (e.g. `/San_Francisco`) is the natural shorthand a reader types/pastes; it is
  redirected to the canonical `/topic/<Title>/` rather than dead-ending. The rule lives in
  **`app/not-found.tsx`** (the not-found boot, reached for any path the server can't match to a route —
  chiefly a bare single segment; under SSR it is server-rendered per request, **not** the old
  `404.html` file): on mount it computes a redirect target from `location.{pathname,search,hash}` and,
  if non-null, `router.replace`s to it while rendering a **neutral Topic loading state**
  (`ArticleSkeleton`) plus a
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
  - **Under SSR (#37) the bare-path boot is server-rendered per request.** The server returns a **404
    *status*** for the unmatched bare path (correct HTTP semantics), but its **body is the neutral
    loading shell** (`not-found.tsx`'s `redirecting === null` server branch → `ArticleSkeleton` +
    "Loading topic…"), never a "Topic not found." flash; the client then runs the `router.replace` hop.
    This is the faithful SSR analog of the old `404.html` behavior. The bare-path redirect stays
    **client-side this round** (a server-side HTTP redirect for it is deferred to the production
    read-path). Note `trailingSlash:true` makes the server first 308 a slashless `/San_Francisco` to
    `/San_Francisco/`; the browser preserves query + hash across that hop, and the client reads them
    from `window.location`, so they reach `/topic/<Title>/`.

**Path to production:** `output:'export'` is **already dropped** (#37 — the prototype is a Node SSR
server), and the host + auto-deploy are **already provisioned** (A.2 / #42 — Linode VPS + Compose +
Caddy at `wikiplus.wikiedu.org`, CI→GHCR→SSH on push to `main`; see *Deployment*). The Drizzle
`DataStore` + Server Actions + shared Postgres are **done** (issue #45 / #35 B — see *Persistence*
above). Remaining steps: wire Auth.js / Wikimedia OAuth (C), build the curation-action product layer
(D), and add the production read-path (ISR + the Redis `cacheHandler`, server-side candidate search,
the deferred Redis compose service + Cloudflare edge cache, `article_index`, and a real server-side
bare-path HTTP redirect). The components, data model, design system, article pipeline, and the
title-based URL scheme carry forward unchanged.

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
  **`DrizzleDataStore` + the DB seed are tested against [pglite](https://pglite.dev) (in-memory
  Postgres compiled to WASM)** — `test/drizzle-store.test.ts` via `test/helpers/pglite-db.ts` applies
  the **committed Drizzle migrations** to a fresh in-memory DB and runs the full `DataStore` contract
  (incl. shared dismissals + multi-user sharing) with **no external DB and no network** (issue #45,
  AC16). The view/integration tests mock the `@/lib/data` seam to a localStorage-backed double
  (`test/helpers/data-mock.ts`), since the production seam routes through Server Actions → Postgres.
- **End-to-end — Playwright (`e2e/`).** `yarn test:e2e` builds the **Node server** (`next build`) and
  serves it with `next start` (issue #37 replaced the old `serve -s out` static-export serving), then
  drives the core loop (find topic → read → watch & weigh → contribute) in a real browser. Unseeded
  `/topic/<Title>/` deep links are rendered on demand by the running server (no `404.html` trick). The
  Wikipedia/Wikidata calls are **intercepted with fixtures** (`page.route`) so the run is
  deterministic and offline; the plus side renders from the seeded localStorage `DataStore`.
  Requires `npx playwright install chromium` (a one-time browser download — not possible in a
  no-egress sandbox, so e2e runs in CI / local).

Test deps are devDependencies; `@testing-library/dom` is pinned explicitly (a peer of
`@testing-library/react`). Author-run `yarn build` is **not** review — a `qa-reviewer` subagent owns
the pass/fail-per-AC verification and the security review (CLAUDE.md).
