# wiki+ — Architecture

This document records the architectural decisions and the reasoning behind them — the source of
truth for stack & data model. The guiding constraints: **wide adoption, efficient use of modest
server resources, rapid vibe-coded iteration, and operation by AI agents.**

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

**Provisioned host:** a single **Linode Nanode 1GB** (Debian 13 / trixie — see
`docs/ops/vps-setup.md`), serving **`wikiplus.wikiedu.org`**. The deploy files live in
[`deploy/`](../deploy/) (`docker-compose.yml`, `Caddyfile`) and on the box at `/opt/wikiplus`;
the box-setup runbook is `docs/ops/vps-setup.md`. Stack on the box is **`app` + `caddy` +
`postgres`** (the shared data store) plus a one-shot **`migrate`** service that applies Drizzle
migrations + the seed on deploy; **Redis is deferred** to the production read-path. Postgres is
internal-only (named `pgdata` volume, password via a Docker secret), the app's `DATABASE_URL`
reaches it on the compose network, and migrations apply automatically on `up -d` (no manual SSH).
**Caddy** terminates TLS via Let's Encrypt and reverse-proxies the apex → `app:3000`; **Cloudflare
edge cache is deferred** to the production-MVP — at prototype scale a single box renders per-request
fine. (Caveat baked into the Caddyfile: `wikiplus.wikiedu.org` is in the `wikiedu.org` zone, which
may sit behind Cloudflare — if the DNS record is proxied, Caddy's HTTP-01 challenge needs Cloudflare
SSL mode "Full", or a DNS-01 challenge; verify before bring-up.)

**Pipeline — CI builds, the box only runs.** A push to `main` (or `workflow_dispatch`) runs
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml): job 1 builds the Next.js
**standalone** Docker image ([`Dockerfile`](../Dockerfile), `output: 'standalone'`) on a
GitHub-hosted runner and pushes it to **GHCR** (`ghcr.io/ragesoss/wikiplus`, tagged `:latest`
+ `:<sha>`), passing the YouTube key as a `--build-arg`; job 2 SSHes to the box and runs
`docker compose pull && docker compose up -d`. **The 1GB box never builds Next.js** (it would
OOM) — it only pulls + runs. This is the deploy leg of the cloud, mobile-drivable
prompt → staging loop.

**PR gate — catch `.dockerignore` breaks before merge.** A separate
[`.github/workflows/pr-ci.yml`](../.github/workflows/pr-ci.yml) job runs on `pull_request`
(targeting `main`) and builds the Dockerfile **`build` stage** (`yarn build` + `yarn
build:migrate`) against the **same trimmed context** (`Dockerfile` + `.dockerignore`) the
deploy uses — `target: build`, `push: false`, no GHCR, no deploy secrets. It exists because
the host QA gate (`yarn build`/`tsc`) typechecks the **full** working tree and never respects
`.dockerignore`, so a file the trimmed context drops (anything under `e2e/` or `scripts/dev/`,
or a root file importing from them) can pass on the host yet break `next build` inside the
image. Building the real `build` stage with the actual `Dockerfile` + `.dockerignore` can never
drift from what the deploy does. It reuses the deploy build's GitHub Actions layer cache
(`cache-from: type=gha`), so a normal PR runs in roughly the deploy build's time (~1–2 min).
Recommended as a required status check on `main` (a repo branch-protection setting).

### Self-hosted Next.js gotcha to design around (decide now, not later)

Next.js ISR's default cache is **per-instance, on local disk**. The moment more than one app
container runs (or one is replaced during a deploy), instances hold divergent caches and serve
stale/inconsistent pages, and on-demand revalidation only invalidates the instance that received
the request.

**Decision:** wire a **Redis-backed shared ISR cache handler** from day one (Next.js supports a
custom `cacheHandler`). With a shared cache, horizontal scaling and zero-downtime deploys just work
and revalidation is global. Building this in at the start costs little; retrofitting it under load
is painful.

## Data model (initial)

Keyed on stable identifiers, normalized, minimal. Implemented in `lib/db/schema.ts` (Drizzle
migrations in `drizzle/`); see *Persistence — Drizzle/Postgres behind a server data-access boundary*
below for the as-built shape. Two deliberate deltas from the forward-looking model below: **`topic`
has no `article_index`** (the server never fetches Wikipedia — that cache belongs to the deferred
production read-path), and the **`clip` fields are the app's current `Clip` type**
(`lib/data/types.ts`) — `embed_meta`/`timestamp_seconds` are not carried, and `section_anchor` is
stored as the `section_slug` + `section_label` pair. The `account` table is Auth.js-adapter-shaped,
populated by real Wikimedia logins (find-or-create on `(provider, provider_account_id)`); writes
attribute to the real signed-in contributor. The stub `@prototype` contributor attributes only clips
curated before sign-in existed. See *Authentication & identity*.

- **topic**
  - `id` (internal PK)
  - `wikidata_qid` (unique) — **canonical identifier**, stable across renames/languages
  - `title`, `lang` — display attributes for the primary article
  - `article_index` — cached **lightweight** article data the server needs: the lead (for the
    shell + SEO) and the section list/headings (for matching candidates and the TOC). The full
    article HTML is **not** stored — it's fetched client-side (see *Article rendering*).
  - `closed_to_suggestions` (boolean, `NOT NULL DEFAULT false`) — an explicit, **curator-set**
    "marked complete" flag. When `true`, the Topic page suppresses all auto-suggestion chrome **by
    default** for every viewer and renders only curated content — a curator's "I've finished this
    topic" judgment. **Distinct from the derived `fully-curated` state** (see *Candidate suggestion &
    the empty state* and `TOPIC_PAGE_DESIGN.md` §"Three states"): that state is computed in `TopicView`
    from the counts and never stored, holds only at ≥1 curated clip + 0 remaining suggestions, and
    changes as the candidate pool changes; this flag is stored, holds even when suggestions exist, and
    is allowed at zero curated videos. Set/cleared by **any signed-in curator** via a role-gated Server
    Action (no moderation lock, no ownership restriction; a logged-out reader cannot set it). No
    `marked_by`/`marked_at` audit columns — a plain boolean.
  - `hero_clip_id` (nullable FK → `clip.id`, `ON DELETE SET NULL`) — the topic's **hero**: one
    prominent "must-watch" clip rendered larger, first, at the front of the General strip (issue
    #158). A **topic-level reference**, chosen over a clip-level `hero` boolean **because the
    at-most-one-per-topic invariant is then STRUCTURAL** — a single column holds one value, so two
    heroes are unrepresentable, and setting a new hero is one atomic `UPDATE topic SET hero_clip_id =
    …` that replaces the prior (no clear-then-set transaction, no partial unique index, no race
    window). `ON DELETE SET NULL` clears it automatically when the hero clip is deleted (owner
    hard-delete) — no dangling hero. **Eligibility — curated + GENERAL only:** a candidate is
    structurally ineligible (not a `clip` row, so the FK cannot reference it), and a section-anchored
    clip is rejected server-side (`DrizzleDataStore.setTopicHero` checks the target exists, belongs to
    the topic, is `general`, and is live); a section-anchored hero is an explicit future evolution.
    The hero **rides the topic read** (`heroClipId` on the loaded `Topic`), so the strip marks the
    hero by comparing each general clip's id to it — prominence is identical for every viewer and the
    cached read path does **no per-user work** (logged-out parity by construction). Set/cleared by
    **any signed-in curator** via the curator-gated `setTopicHeroAction` (the gate→limit→write
    contract; `write_event` kind `hero`) — no moderation lock, no ownership restriction, no audit
    columns. Prominence is **placement only**: the hero keeps every standard trust signal.
  - `created_at`, `updated_at`
- **clip** (a curated, contextualized social video)
  - `id`
  - `topic_id` → topic
  - `video_url`, `provider` (tiktok/instagram/youtube/vimeo/…), `provider_video_id`
  - `orientation` (`vertical` | `horizontal`) — drives the embed aspect ratio (9:16 vs 16:9);
    **auto-derived, never hand-set** (see *Orientation derivation* under *Embed, never host video*)
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
  - `upvotes` — **a FROZEN seed baseline, NOT a mutable counter.** The displayed count is **derived**
    = `(clip.upvotes ?? 0) + COUNT(distinct clip_vote rows)`; a real vote is a `clip_vote` row, never
    a write to this column (so the count can't drift). See **clip_vote** below.
  - `vetted` (boolean, `NOT NULL DEFAULT true`) — **the review-hold flag.** `vetted = true` ≙
    **published / live / fully curated** (carries the site's full vouch); `vetted = false` ≙ **held /
    "in review · not yet vouched"** — a real curated clip (note + chips + curator intact) whose vouch
    a reviewer has not yet confirmed (Curation Standard §7.1 — the THIRD clip-state, distinct from a
    fully-curated clip and from a §6 candidate). **New adds publish by default** (`true`; the hold is
    an available action, never auto-on). This is the **clip** review-state — distinct from the
    `Candidate.vetted: false` discriminant in `lib/data/types.ts` (an auto-suggested non-clip), never
    conflated with it. The held-state **rides the clip read** (`listClips` → the client `Clip.held`
    flag) so every viewer sees the same marking with **no per-user work** on the cached read path. Set
    by the two role-gated Server Actions (`holdClipAction` / `reviewClipAction` — see *Boundary
    surface*).
  - `removed_at`, `removed_by`, `removed_reason` (all nullable) — **the soft-removal tombstone** for
    §7 moderation: a **moderator** removing an **abusive** clip (Curation Standard §7.2). `removed_at`
    (timestamptz) is the **single removed/live discriminant** — `NULL` ≙ live, non-null ≙ removed (the
    removal timestamp); `removed_by` (integer → `contributor.id`, `ON DELETE SET NULL` so the audit
    trail outlives the moderator's account) is the removing moderator; `removed_reason` (text) is the
    **optional, audit-only** reason (the §7-category enum and/or a free-text note, composed into one
    string — `lib/curation/removal-reason.ts`). Removal is a **SOFT tombstone, NOT a hard delete** —
    the row **persists** as the §7 audit trail (a privileged act on another person's work must be
    auditable + attributable) and the **clip read excludes `removed_at IS NULL`** (`listClips` +
    `listClipsByContributor` carry the predicate), so a removed clip simply **stops showing** with **no
    per-user work** on the cached read path — there is **no reader-facing removed marker**. **Distinct
    from `vetted`** (an INDEPENDENT column): a *held* clip (`vetted = false`, `removed_at IS NULL`)
    **still lists** (shown-but-marked "in review"); a *removed* clip (`removed_at` set) is **excluded**
    regardless of its `vetted` value — the two never collide. **Distinct from the owner hard-delete**
    (`deleteClipAction` — the row is GONE; here the row persists). Set by the moderator-only
    `removeClipAction` (see *Boundary surface*). **Restore is deferred but trivial** given the
    tombstone (clear `removed_at`/`removed_by`).
  - `curator_id` → contributor (who promoted/added it)
  - `note_license`, `note_license_agreed_at` (both nullable) — the **per-submit CC BY-SA
    note-license agreement** captured at publish (Curation Standard §5.3). `note_license` is a
    **version string** (`CC-BY-SA-4.0`), not a boolean, so a future license bump is expressible;
    `note_license_agreed_at` is the server-stamped agreement timestamp. Together with `curator_id`
    they bind *"this note, by this contributor, under this license version, at this time."* Stamped
    **by the auth-gated Server Action** when the client signals consent (never trusted off the wire);
    **null** on seed/stub clips and any non-agreed path.
  - `created_at`, `updated_at`
- **contributor** (the wiki+ curator — distinct from the external **creator** referenced above)
  - `id` (internal PK), `handle` (display only — **non-unique**), `display_name`, `avatar_url`,
    `created_at`
  - `is_moderator` (boolean, `NOT NULL DEFAULT false`) — **the minimal binary moderator/reviewer
    role.** `true` ⇒ this contributor may **approve** a held clip, **hold** any clip, and **remove**
    an abusive clip (Curation Standard §7). `DEFAULT false` so every contributor is a non-moderator
    until granted — the safe default; the role-gate rejects everyone until one is granted. **How a
    moderator is granted — OUT-OF-BAND, no in-app admin UI** (two ways, either suffices; the
    server-side resolver `lib/auth/moderators.ts` OR-combines them):
    - **(a) the DB flag** — an owner/ops sets the column directly on the box, e.g.
      `psql … -c "UPDATE contributor SET is_moderator = true WHERE handle = 'Username';"`; or
    - **(b) the `WIKIPLUS_MODERATORS` env allowlist** — a comma-separated list of Wikimedia
      usernames; a contributor whose handle appears in it (case-insensitively) is a moderator
      (cleaner for staging — set the env + redeploy; self-heals if the DB column was never set).

    The role-gate's **authority is always server-side** (the action re-resolves the role from the DB
    column / allowlist); a JWT `isModerator` session claim (resolved the same way at login —
    *Authentication & identity*) is the **affordance layer only**, never the security control.
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
- **clip_vote** (one contributor's upvote on one clip)
  - `id`, `clip_id` → clip (`onDelete: cascade`), `contributor_id` → contributor (`onDelete:
    cascade`), `created_at`
  - **`unique(clip_id, contributor_id)`** — the **one-per-user enforcement is this DB constraint**,
    not app logic: a duplicate insert collides (the toggle inserts with `onConflictDoNothing`, so a
    racing double-insert lands voted, never doubled). The displayed count is **derived** = the
    frozen `clip.upvotes` seed baseline **+** `COUNT(clip_vote rows)`, so it can never drift from the
    set of distinct real voters; `clip.upvotes` is never mutated by a vote. A viewer's "have I
    voted?" state comes **only** from `clip_vote` (never the seed).
- **write_event** (the per-identity write rate-limit ledger)
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
    for correctness. See *Open questions* → Abuse/spam.

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

### Mobile rendering — one fetch, reproduce mobile behaviors (not the mobile-html endpoint)

On a phone the article column reads like **mobile Wikipedia** — collapsible sections, comfortable
type scale and touch targets, wide tables/infoboxes that fit a narrow column. We achieve this by
keeping the **single `page/html` (desktop Parsoid) fetch and sanitize/rewrite pipeline above** and
**reproducing the mobile behaviors ourselves** in responsive CSS/JS, branched purely by **viewport**
(a CSS media query + a small client toggle) — not by fetching Wikipedia's `page/mobile-html` (Page
Content Service) endpoint and not by server User-Agent detection.

- **No second HTML source.** `page/mobile-html` is a *different DOM contract* (PCS-specific
  `pcs-ref-*` citations, `pcs-edit-section-*` chrome, `pcs-collapse-table` / `pcs-widen-image-ancestor`
  classes) that would require a second, parallel sanitize/strip/citation/section-walk path to
  maintain alongside the desktop one. The fidelity work (tables, citations, math) is all tuned
  against desktop Parsoid output; a second source doubles that surface.
- **The collapse behavior isn't free from the endpoint anyway.** PCS ships its collapsible-section
  and lazy-image behavior as a bundled **`<script>` runtime plus inline `style="display:none"` and
  toggled classes** — exactly the things the **DOMPurify allowlist deliberately strips** (no
  `<script>`, no `<style>`, no `style=`; the X4 invariant). So even via `mobile-html` the sanitized
  DOM would arrive with every section statically expanded and no script — we would still implement
  the collapse ourselves. Fetching the heavier endpoint buys a new DOM to maintain without
  delivering the behavior.
- **Section anchors stay stable by construction.** The kebab section slugs are derived from heading
  **`textContent`**, which is byte-identical between the two endpoints — so keeping the desktop fetch
  preserves the section-anchoring contract (TOC, scroll-sync, clip→section matching) unchanged; no
  re-derivation or slug mapping is needed.
- **No ISR cache-splitting.** Because the article is fetched and transformed **client-side** and the
  same HTML serves every device, there is no device-class cache key, no UA sniffing, and no need to
  render both variants server-side. The mobile experience is a presentational branch in the browser
  over one cached shell.
- **Sanitization unchanged (X4).** This approach introduces **no new HTML source and no allowlist
  change** — `style`/`<style>`/`<script>`/`<iframe>`/`<math>`/`<svg>` stay disallowed, the
  `colspan`/`rowspan`/`scope` + image `width`/`height` inert-attribute hook is untouched, and the
  existing `test/article*.test.ts` invariants hold.
- **Shared styling surface.** The mobile behaviors are scoped to the article column's existing
  `.wiki-body` / `.sec` styling surface in `app/globals.css`. The dark-Wikipedia **skin system**
  layers over this same surface; the two are built against one shared article-column structure (skin
  = color/theme tokens; mobile = layout/disclosure) so they compose rather than collide.

## Skin system (theming as an isolated, cache-agnostic layer)

A **skin** is a self-contained presentation layer (design contract
`docs/design/skin-system-zine-dark.md`). The default skin is the light **Indigo Press** zine; a
second skin, **zine-dark**, is the proof that a skin is well isolated. The load-bearing property is
the isolation: **adding or changing a skin touches only the skin-definition layer — never a
component's logic.**

**What a skin owns (the only things it may change):** the role color tokens in `app/globals.css`'s
`@theme` block (`--color-surface*`, `--color-ink-plus*`, `--color-hardbox` / `--color-hardbox-offset`,
the `--color-accent-*` roles, `--color-focus-ring`); the colors *inside* the fixed hardbox treatment
classes (`.plus-card`, `.hardbox-*`, `.candcard`, `.candsethead`, `.candthumb`, `.input`/`.field`),
which read those tokens; the faithful Wikipedia **article palette** (`--ink-article` + the
`--article-*` group, governed independently of the plus palette so the article side stays faithful on
either skin); and the **header treatment** (which wordmark tier shows + the band/seam colors). A skin
is defined as the default `@theme` token values plus a scoped `[data-skin="<skin>"]` override block.

**What a skin never touches:** geometry/dimensions, layout/structure/DOM order, copy/microcopy/labels,
behavior (scroll-linked transitions, disclosures, animation timing, reduced-motion + forced-colors
gating), and the chip accuracy/stance→color *semantics* (Curation/Editorial owns those — a skin may
shift a chip fill for AA on a dark band but never the mapping or the always-present text label). The
`/about` projector-theater centerpiece is **fixed art, not chrome**, and is exempt — only its
surrounding page chrome/header follows the skin.

**The seam.** The only switch is the `data-skin` attribute on `<html>` (`app/layout.tsx`); absent or
`"zine"` = the light default. The two ink roles are split into `--ink-plus*` (plus chrome +
structural hardbox ink) and `--ink-article` (faithful Wikipedia body ink) so a dark skin can flip one
without wrecking the other.

**Read-path decision (skins are cache-agnostic).** Skins are a **pure CSS / `data-skin`-attribute**
concern, so the SSR'd HTML shell stays **skin-agnostic**: the same cached page serves every skin. The
`data-skin` attribute is therefore **not** baked into the server-rendered markup from a per-request
cookie (that would fragment the cache by skin, multiplying every cached entry). Instead a tiny
**pre-paint inline script** in the `<head>` (`app/layout.tsx`'s `SKIN_BOOTSTRAP`) sets `data-skin`
entirely in the browser, before first paint, so there is no flash and the cached shell is identical
across skins. Consequence: the (future) ISR/Redis read path needs **no skin variance** — no skin cache
key, no per-skin revalidation — exactly like the device-class branch above (one cached shell, a
presentational branch in the browser).

**Selection mechanism.** The skin is driven from the UI by an in-app **skin toggle**
(`components/chrome/FooterSkinToggle.tsx`), a binary `light ↔ zine-dark` control in **`SiteFooter`**
(alongside the "About your data" link), reachable on both auth states without requiring an account. It
is a quiet text+icon button (not a bordered chip), using `text-link` color and the site focus ring to
match the footer's affordance language. The Topic page carries no footer and therefore no toggle;
readers on Topic rely on the preference persisted from any other page. One action, one resolved-skin
state, shared via `lib/skin/client.ts`'s `useSkin`. On activation it flips `data-skin` on `<html>`
**in place** (no reload, no remount) and writes the `wikiplus-skin` cookie — the whole-page re-skin
through the existing `[data-skin]` CSS cascade. (An operator-level build default still exists:
`WIKIPLUS_SKIN` seeds the bootstrap when there is no cookie.)

**Persistence model + the cache-agnostic guarantee.** The **`wikiplus-skin` cookie is the single
client source of truth** the pre-paint bootstrap reads — it works logged-out and is what makes first
paint correct with no flash. It is first-party, non-`HttpOnly` (the bootstrap reads it), `SameSite=Lax`,
`Path=/`, ≈1-year `Max-Age` (and `Secure` on HTTPS); it carries no PII and is **never read server-side**
to render — so it is **not** a cache key and the edge must not strip it or vary on it. For **logged-in**
users the preference is *additionally* persisted on the contributor row (`contributor.skin_preference`,
nullable: `'zine'` / `'zine-dark'` / `null` = none) as a **durable cross-device backstop**, and
**mirrored into the cookie at login** (DB→cookie): the Auth.js `jwt` callback reads `skin_preference`
in the same sign-in pass that does the find-or-create write and stamps it on the JWT; a thin client
step (`components/header/SkinSync.tsx`) reads it off the session and sets the cookie + flips `data-skin`
on a freshly-established session whose cookie does not already carry it. The DB therefore **never enters
the read/render path** — ordinary reads stay JWT-only (no per-read DB hit), the SSR shell is
byte-identical across skin cookies, and no skin cache key / `Vary` / per-skin ISR variant is introduced.
On a logged-in toggle the control writes the cookie + flips live **first** and persists to the DB
**fire-and-forget** (a low-frequency presentational write, gated by `requireContributor`, not
rate-limited) — the visual switch never waits on the write.

**Cookie ↔ DB tie-break.** The cookie is authoritative for *rendering*. At login the DB **seeds** the
cookie (DB→cookie), once per established session, so a fresh device picks up the user's stored skin. A
subsequent same-device toggle updates **both** (cookie immediately + DB), and the login mirror does not
re-run for that session — so the **latest explicit user action wins** and the two converge with no
server-side per-read reconciliation.

**OS default (`prefers-color-scheme`).** With **no** stored preference (no `wikiplus-skin` cookie and,
for a logged-in user, a `null` DB value), the default **honors the OS dark preference**: the bootstrap
resolves `window.matchMedia('(prefers-color-scheme: dark)')` → render zine-dark, otherwise the light
zine. The full resolution order in the bootstrap is **explicit cookie → (logged-in: the mirrored DB
value, already in the cookie) → OS `prefers-color-scheme` → light**. An explicit choice (a `'zine'` or
`'zine-dark'` cookie) always **overrides** the OS signal, so an OS-dark reader who picks light is not
trapped. This resolution happens **only** in the browser pre-paint script — **never** in server markup
— so the cache-agnostic guarantee holds (the server cannot and must not know the client's color scheme
for rendering).

## Topic discovery & search

Topics are created on demand, so users need to *reach* uncurated ones. A search box resolves a
query to a Wikipedia article (MediaWiki `opensearch`/search API) → wiki+ topic (title→QID,
created on visit); internal wikilinks (above) are the other main path. This is what makes the
empty state matter — most arrivals land on an uncurated topic and are invited to curate it.

**Navbar topic search** (`components/search/TopicSearch.tsx` + `lib/wiki/suggest.ts`): typeahead
suggestions come from Wikipedia's REST title-completion endpoint
**`/w/rest.php/v1/search/title?q=&limit=`** (namespace 0, articles), which returns ranked title
completions plus an optional short description the UI may show. It is fetched **client-side, key-free,
anonymous CORS GET** with the same descriptive `Api-User-Agent` as `lib/wiki/article.ts` — **no
server, no secret, no quota** (unlike the YouTube key). The `opensearch` action endpoint is an
equivalent fallback (same shape). Etiquette is binding: the input is **debounced (~200 ms)**, the
prior in-flight request is **aborted** on query change, and the fetch **degrades silently to `[]`** on
any error/timeout/abort (never an error UI). Selecting a suggestion or submitting raw text is a **pure
navigation** — `router.push(topicHref(<raw title>))` (reusing the `titleToSlug` encoding) — with **no
write, no `/contribute` coupling, and no QID in the URL**; `TopicView` resolves title→QID under the
hood and renders the topic in whichever of its three states applies — **empty / mixed /
fully-curated** (see `docs/TOPIC_PAGE_DESIGN.md` §"Three states") — via the create-on-demand behavior.
One reusable component is placed on both the home header (always-visible full-width) and the Topic
header (inline compact on the Wiki side ≥ md; a labeled magnifier icon-disclosure < md, so the tight
two-world header is not crowded). Accessibility follows the WAI-ARIA APG **editable combobox +
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

**Orientation derivation.** A clip's `orientation` is **auto-derived from the platform signal, never
hand-set and with no manual override** — the curator never picks an aspect ratio. Both producers of
an orientation apply one rule:

- **Dimension signal present** — when a source carries the clip's frame dimensions, the aspect
  decides: **`height > width ⇒ vertical`, else horizontal**. This is platform-agnostic. The
  add-by-link resolved arm reads the oEmbed player `width`/`height` (so a resolved TikTok's portrait
  dims ⇒ vertical, a landscape YouTube video ⇒ horizontal, a Short ⇒ vertical); the candidate
  pipeline reads the search-result thumbnail aspect.
- **No dimension signal** — fall back to a **per-platform default**: `tiktok`/`instagram` ⇒
  **vertical** (vertical-first feeds); `youtube`/`other` ⇒ **horizontal** (default landscape,
  vertical only on a positive signal). This covers the add-by-link placeholder arm (resolution
  failed or the platform is unsupported, so no dims exist) and any resolve whose provider omits the
  player dims.

The default map and the resolved-arm derivation are shared so there is one source of truth.

## Candidate suggestion & the empty state

Every topic begins with zero curations. To stay useful and seed the curation flywheel, the empty
state bootstraps the plus side with **auto-suggested, unvetted candidates** (`vetted: false`) plus
paths to curate. Curated clips and unvetted candidates **coexist** on a partly-curated topic (the
three states empty / mixed / fully-curated) — a **pure presentation derivation in `TopicView`
(`hasCurated` + `hasSuggestions`), not a storage change**: candidates remain computed/cached and never
stored as rows, and the no-churn invariant is a stable sort/filter over the already-derived
`liveCandidates` (no pipeline re-run on curation). (Product behavior in
[`TOPIC_PAGE_DESIGN.md`](TOPIC_PAGE_DESIGN.md) §"Three states".)

A curator can additionally **mark a topic complete** (`topic.closed_to_suggestions`) to suppress the
suggestion layer **by default for every viewer**, independent of the derived state. The suppression is
the **same pure-presentation posture**: `TopicView` derives a single boolean `suppressSuggestions =
topic.closedToSuggestions && !viewerOverride` and, when true, feeds the suggestion-bearing children an
**empty** candidate set — so every suggestion-chrome surface (General + rail candidate tiles, the
"Suggested · uncurated" divider/header, "See N more", dashed TOC counts, the wiki+ panel suggestion
volume) collapses via the **existing zero-suggestion code paths**, with no parallel "suppressed"
branch. The **candidate pipeline and `liveCandidates` are unchanged** (the true remaining count is
still computed — for the "is there anything to reveal" gate and an override flip); suppression touches
only the *presentation*, never storage (no `dismissed_candidate` writes). The per-viewer **override**
("show suggestions anyway") is session-local + client-only (a `sessionStorage` key per topic QID, read
after mount), so it never varies the cached read-path HTML and never persists to the DB — the same
read-path posture as the skin toggle. (Product behavior + the complete + zero-video minimal render in
[`TOPIC_PAGE_DESIGN.md`](TOPIC_PAGE_DESIGN.md) §"Three states".)

- **Auto-suggestion is multi-platform by design; YouTube-only in the MVP.** Build the candidate
  pipeline **platform-agnostic** (a pluggable source interface) so additional platforms slot in.
  At launch, seed the General bar from the **YouTube Data API search** for the topic; for inline
  section candidates, match candidate metadata (title/description/tags) against article section
  titles/keywords and surface the best available match per section (the best still-unused candidate,
  so a section whose top pick is claimed by an earlier section falls through to its runner-up; one
  home per video).
- **TikTok auto-suggestion is deferred — pragmatic, not a design boundary.** There is no easy
  official TikTok search API today, so we don't auto-pull TikTok *yet*; the pipeline and frontend
  already accommodate TikTok candidates, and the source is enabled when a practical search path
  exists. In the interim, the UI offers a **"Search TikTok"** action that deep-links to TikTok
  (web/app) for a manual search; good finds come in via add-by-link. Other source buttons can
  follow the same launch-and-add pattern.
- **Add by link (logged-in).** A logged-in user pastes a **YouTube or TikTok share link**; we
  resolve real `title`/`author_name`/`author_url`/`thumbnail_url` via a **Server Action**
  (`lib/embed/oembed.ts` `resolveOEmbedAction` — server-side because the oEmbed endpoints send no
  CORS header), with an honest, clearly-labeled **unresolved placeholder** fallback when a fetch
  fails (no fabricated creator, no fake link — CURATION §5.5). **Instagram/other** land on that
  placeholder directly (no token-free oEmbed for our use). See *Prototype phase* → **add-by-link**.
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

**Video → article suggestion is the INVERSE of this pipeline — reuse, don't reinvent (committed
direction; implementation deferred).** A future video-centric on-ramp (a curator pastes a high-quality
video and wiki+ suggests which Wikipedia article(s) it belongs to — designed in
[`docs/design/landing-page-v2-video-entry.md`](design/landing-page-v2-video-entry.md)) is the **inverse
direction** of the candidate pipeline above: given a topic's title + section keywords we rank *videos*;
the v2 matcher, given **one video's metadata** (title/description/tags), ranks candidate **Wikipedia
articles**. The *scoring substrate is the same* — only the direction flips (the video is the query,
articles are the results). v2 **reuses `lib/candidates/`** rather than introducing a parallel matcher —
specifically (a) the **`tokenize()`** helper as-is (direction-agnostic, stopword list already tuned for
video text); (b) the **distinct-keyword overlap scoring + deterministic tie-break** heuristic in
`matching.ts`, *generalized* to "score a query token-set against a candidate token-set"; (c) the
**`matchReason` copy discipline** (name a keyword, never assert quality) with new article-side strings;
and (d) the **pluggable-source shape** (`CandidateSource`/`RawCandidate` in `types.ts`) mirrored as a
new `ArticleCandidateSource` plus the pipeline's **cache-with-TTL / no-key / silent-degrade posture**.
*Not* reused: the YouTube source (`youtube.ts`) and the section-placement logic (`placeCandidates()`),
both specific to the topic→candidate direction. **Implementation is deferred;** only the architecture
direction + the reuse boundary are committed here (see the v2 design spec §5 for the full REUSE/NEW
table).

**YouTube Data API key.** Search uses a **public-data API key** — not OAuth and not a service account
(the YouTube Data API doesn't support service-account auth; OAuth is only for a *user's* private data,
which we never touch). The key is **API-restricted to YouTube Data API v3**. *Where it lives* is the real
decision: in the prototype it's a **browser key restricted by HTTP referrer** to the live origin
`https://wikiplus.wikiedu.org/*`. Because a client key is inlined into the static bundle and publicly
readable, the **referrer restriction plus a quota cap are the protection, not secrecy**. The production
read-path should move search **server-side** (key held as a server secret; the expensive quota shared +
cached) — see *Open questions*. Embedding needs no key — that's oEmbed/the facade.

## Authentication & identity

Login and user identity rely entirely on **OAuth — no passwords**.

- **MVP: Wikipedia / Wikimedia account only** — via Wikimedia's OAuth 2.0 (the
  `mediawiki.org` OAuth extension). The user authorizes at `en.wikipedia.org` — a consent
  screen Wikipedia editors recognize — while the consumer itself is registered at
  `meta.wikimedia.org` (where `Special:OAuthConsumerRegistration` lives). On-brand for a
  Wikipedia-adjacent product and ties curators to the wider Wikimedia community.
- **Planned next: Google** (standard OpenID Connect), and potentially other providers.

We implement this with **Auth.js (NextAuth)**, with Wikimedia configured as a **custom
OAuth/OIDC provider**; Google is a built-in provider we can switch on later with little work.
Auth.js's first-class multi-provider OAuth support means launching single-provider costs us nothing
later.

**As built:**

- **Auth.js v5** (`next-auth@5.0.0-beta.31`, App-Router-native: one config exports
  `handlers`/`auth`/`signIn`/`signOut`). Wikimedia is the **built-in `@auth/core` provider**
  (`next-auth/providers/wikimedia`) with its three endpoints **overridden** so
  authorize/token/userinfo run at `en.wikipedia.org` — a consent screen Wikipedia editors
  recognize. CentralAuth/SUL recognizes the same centrally-registered consumer on every
  Wikimedia wiki, so the global `sub` identity is the same across wikis (no re-registration).
  The provider keeps the **default identify-only scope** (stable `sub` + `username`; no
  edit/act-on-behalf grant). The catch-all route handler lives at
  `app/api/auth/[...nextauth]/route.ts`; the default callback is
  **`/api/auth/callback/wikimedia`** — the URL Ops registers with the consumer at
  meta.wikimedia.org (consumer registration stays at meta; only the user-facing authorize host
  moves to en.wikipedia.org). The config (`lib/auth/config.ts`) sets `trustHost: true` (behind
  Caddy/Cloudflare) and a descriptive Wikimedia **`User-Agent`** via Auth.js's `customFetch`
  on the identity-endpoint calls (Wikimedia etiquette).
- **Sessions: stateless JWT** (`session.strategy = "jwt"`, **no database adapter, no
  server-side session store, no Redis**). An ordinary read resolves the header from the signed
  JWT cookie with **no per-read DB hit** (read-path-efficiency principle preserved). The
  **only** DB write a login makes is the find-or-create identity mapping, run once in the `jwt`
  callback on sign-in; the resolved `contributorId` + Wikimedia `username` are stashed on the
  token and surfaced via the `session` callback. The `jwt` callback also resolves an **`isModerator`**
  claim server-side on the sign-in pass (the DB `is_moderator` column OR the `WIKIPLUS_MODERATORS`
  allowlist — `lib/auth/moderators.ts`) and stashes it on the token, so ordinary reads stay JWT-only
  (no per-read role query). That claim drives only the **off-read-path reviewer affordances** (which
  clips show Hold/Approve); the **write boundary re-resolves the role server-side**, so the claim
  never authorizes a write — it is the affordance layer, not the gate.
- **Reading is anonymous; contributing requires login.** The three persisted write Server
  Actions — `addClipAction`, `upsertTopicAction`, `recordDismissalAction` — are **auth-gated at
  the boundary** (`lib/auth/require-session.ts` `requireContributor()` throws `AuthRequiredError`
  when there is no session; the gate is in the Server Action, not only a hidden button). A gated
  write attributes to the **real signed-in contributor** (`clip.curatorId` + `clip.curatedBy` = the
  Wikimedia username; dismissal `contributorId`).
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
  linking/merge) later is additive.**
- **The `@prototype` stub attributes only pre-auth clips.** The seeded stub contributor is the
  attribution for clips curated **before sign-in existed**; new writes attribute to the real
  signed-in contributor. The stub has **no browsable public profile**:
  `/contributor/@prototype` resolves to not-found, and a `@prototype` clip's curator attribution is
  the non-linked `seed clip · no curator` label.
- **Public identity is browsable; non-public identity is never exposed.** A contributor has a
  **public profile at `/contributor/<username>`** exposing **only** the Wikimedia username
  (`contributor.handle`) + the **granted avatar** — **never `email`** or any non-public `account`
  field. The two profile reads (`getContributorByUsername` / `listClipsByContributor`) are
  **anonymous** (no auth gate, like the topic reads) and run **only** on the profile route, so they
  add **no per-user work to the cached topic read path**. The privacy boundary is the public-safe
  projection (`rowToPublicContributor`) — `account.email` is never selected on this path. The
  **non-unique `contributor.handle`** is resolved to a **single** identity deterministically (lowest
  `contributor.id`). **"My curations"** is the **owner-view** of that same public route (no separate
  private surface). See *Prototype phase* for the as-built detail.
- **Secrets:** the Wikimedia consumer key/secret live in env under the owner-confirmed names
  **`wikimedia_oauth_client_key`** / **`wikimedia_oauth_client_secret`** (read explicitly as the
  provider's `clientId`/`clientSecret`); Auth.js's session-signing **`AUTH_SECRET`** is also a
  server secret. All three live in environment/Docker secrets, **never** in the repo and
  **never** in the client bundle. `.dockerignore` excludes `.env` so the CI image build never bakes
  them; they arrive at runtime on the box.

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
  (add-by-link): the minimum is real `author_name` + a working link to `author_url` (handle derived
  per the candidate pipeline, or omitted; never a placeholder masquerading as a real creator) — see
  `docs/CURATION_STANDARD.md` §5.5.

### Privacy / data notice — canonical wording + placements

The public-link prototype surfaces a **lightweight, honest data notice** (NOT a legal privacy
policy / ToS / DSAR tooling — that is a later production-MVP deliverable; `/privacy` is intentionally
left free for it). It is **descriptive**: it changes nothing about what is stored or the auth model
(see *Authentication & identity* for the as-built data model) — it makes the as-built behavior
legible. Specs: `docs/specs/privacy-notice.md` + `docs/design/privacy-notice.md` (the microcopy
contract). This section is the durable record of the canonical wording + where it lives.

- **Canonical surface (the source of truth): a static route at `/about/data`** — title "About your
  data" (`app/about/data/page.tsx`). It is **server-rendered, content-only** (no `store`, no session,
  no fetch) so it has **no loading / empty / error states and always renders** (a data notice that
  could fail to load would undermine the trust it exists to build). It is **anonymous-reachable**
  (no auth gate, like topic/profile reads), so the gate's link to it is readable **before** sign-in.
  Single centered `max-w-[640px]` reading column; one `<h1>` + three sequential `<h2>`s; AA contrast,
  focus-visible links, text-labeled (never color, never gold).
- **Three links into that one surface** (so the wording can't drift):
  1. **`SiteFooter`** (`components/chrome/SiteFooter.tsx`) — the **primary persistent,
     signed-out-reachable** home for the link, a `<footer>` (contentinfo) landmark in normal flow on
     **home** (`app/page.tsx`), **contribute** (`app/contribute/page.tsx`), and the **contributor
     profile** (`app/contributor/ProfileView.tsx`). One required link: "About your data" → `/about/data`.
  2. **The account menu** — one `DropdownMenu.Item` "About your data" → `/about/data` in
     `AuthControl`'s `SignedIn` dropdown (ordered: My curations → About your data → divider → Sign
     out). Signed-in-only; it is the **supplement** that reaches the notice from the **Topic page**
     (whose full-bleed split-header carries no footer — a deliberate, recorded omission, covered by
     this menu item + the on-Topic Wikipedia attribution below).
  3. **The sign-in gate disclosure** — `AUTH_COPY.dataNotice` (`lib/auth/microcopy.ts`) rendered
     **once** by `LoginPromptPanel` / `LoginPromptDialog` (below the gate's own `{body}`, above the
     error slot), so it appears on **every** gate (contribute / curate / add / dismiss / upvote) by
     construction, with a `<Link>` to `/about/data` for the fuller read.
- **Canonical wording (verbatim):**
  - **Gate disclosure** (`AUTH_COPY.dataNotice`): lead **"What contributing stores:"**; body
    **"Logging in links your Wikimedia account so your curation is credited to you, and sets a
    session cookie that keeps you signed in. Your username and your curations are public; your email
    is never shown. Reading needs no login and stores no identity."**; link label **"About your
    data"**.
  - **`/about/data` page**: H1 "About your data"; an intro framing it as a prototype, **not** a legal
    policy, with no export/deletion requests; H2 "Reading is anonymous"; H2 "What logging in and
    contributing stores" (three plain-language bullets — **a link to your Wikimedia account** /
    **a session cookie** / **your curation contributions** — the moderator flag, votes, dismissals,
    and write-event ledger folded into "the curation actions you take… and any reviewer role you may
    be granted", no table names); H2 "What's public, and what's never shown" (email is **never
    displayed anywhere on wiki+**); a closing line deferring upstream-account questions to Wikimedia's
    own policy; a "← Back to wiki+" link to `/`. The full verbatim text lives in
    `app/about/data/page.tsx` and `docs/design/privacy-notice.md` §4.2.
- **Wikimedia email-scope note (the §4.2 hedge):** the Wikimedia provider uses the **default
  identify-only scope** (no scope override — `lib/auth/config.ts`); the `jwt` callback stores
  `account.email` only **if** the provider returns one (`p.email ?? null`). The page wording hedges
  ("…your name, email, and avatar **if you've made them available**") so it stays accurate whether or
  not an email is actually granted; the **public** promise that email is *never shown* is independent
  and holds regardless. (If the default scope is later confirmed to never return an email, the email
  hedge in the §4.2 stored-data bullet can be tightened.)

### Attribution facts

- **Wikipedia article CC BY-SA 4.0 attribution.** `components/topic/ArticleBody.tsx`
  (`ArticleLeadBlock`) renders **"From [Wikipedia](source) · CC BY-SA 4.0 · Wikidata Q…"** linked to
  the source article on every Topic view masthead (CURATION §5.1).
- **Context-note CC BY-SA 4.0 license — captured at submit.** `lib/curation/note-license.ts` defines
  `NOTE_LICENSE = "CC-BY-SA-4.0"`, the verbatim license statement, and the agreement label (CURATION
  §5.3); the curate/add flow shows them and persists `note_license` / `note_license_agreed_at` at the
  auth-gated Server Actions boundary (the boundary stamps the license + timestamp and strips any
  client-smuggled `note_license*`).
- **Context-note license on public display — at submit only.** Where a context note is **publicly
  displayed**, the prototype carries the §5.4 **attribution** ("context by &lt;curator&gt;" via
  `components/topic/ContextByLink.tsx`), **not** a §5.3 **license** marker. The CC BY-SA 4.0 license
  is captured and persisted **at submit** but is **not surfaced as a per-note license indication on
  the public clip/note display**. A display-side per-note license marker is a separate, later design
  task if wanted.

## Open questions (to resolve before/while building)

- Exact ISR revalidation triggers and stale-after windows for `article_index` and candidate sets.
- How much of the page to server-render for **SEO** beyond title/lead/clips (the body is
  client-rendered).
- **DOMPurify allowlist** + which Wikipedia HTML to keep vs. strip (infoboxes, tables, math, navboxes).
  *Article pipeline (`lib/wiki/article.ts` + `app/globals.css`):* the client fetches
  **`/api/rest_v1/page/html/{title}`** (Parsoid HTML, CORS-enabled) and sanitizes with an **explicit
  DOMPurify allowlist**. Sections are derived by walking the flattened Parsoid `<section>` stream: lead
  = everything before the first `h2`; each `h2`/`h3`/`h4` opens a section with a **stable kebab slug**
  (`slugify`, deduped), used for `#sec-<slug>`/`#h-<slug>` anchors, the TOC, and clip→section matching.
  The article renders at full fidelity: citations & references, tables & the Wikipedia infobox, math,
  and the navigational tail & hatnotes all show. Concretely:
  - **Allowlist:** `sup`/`span`/`table…`/`img` pass; **`<math>`, `<svg>`, `<iframe>`, `<object>`,
    `<embed>`, `<form>`, `<style>`, `<link>`, `<script>` are DROPPED** (the math MathML/SVG payloads,
    embeds, and CSS-injection surfaces — so the XSS guarantee holds). The only inert ATTRs added are
    render/a11y/anchor-routing ones: `aria-hidden`, `role`, `aria-label`, `aria-labelledby`,
    `data-mw-group`, `data-mw-footnote-number`. The `style` attribute **stays out of the DOMPurify
    allowlist**; a tightly-bounded, layout-only subset of inline `style` is recovered around the
    DOMPurify pass via an inert carrier (see "Layout-only inline-`style` subset" below). The sanitizer
    strips `<script>`, inline event-handler attrs, and `javascript:`/`vbscript:`/`data:text/html` URIs
    (asserted by `test/article.test.ts` + `test/article-fidelity.test.ts`, the X4 invariant).
  - **Strip list (precise — `stripChrome`):** `.mw-editsection`, `.taxobox-edit-taxonomy` (the taxobox
    "Edit this classification" pencil — editor chrome with no function in wiki+, same family as
    `.mw-editsection`; removing it leaves the "Scientific classification" banner heading intact and
    never touches the taxobox lead image, so that image's `alt` is preserved), `.navbox` (live markup =
    `div.navbox`), `.metadata` (e.g. `div.side-box.metadata`), `.mbox-text`, `.ambox`, `table.sidebar`,
    `table.vertical-navbox`, `.thumbcaption .magnify`, `style`, `link`. The infobox, references
    (`sup.reference`/`.reference`, `.mw-references-wrap`/`.reflist`), and hatnotes are **kept**.
  - **Sections:** `DROP_SECTIONS` is **empty** — References, Notes, See also, Further reading,
    External links come through the same section walk as ordinary `ArticleSectionBody` entries (slug +
    heading + TOC row + `.sec` wrapper + scroll-sync). A footnote-style "Notes" block is a `note`-group
    reference list and stays its own section (its backlinks ARE its citation system) — no duplication.
  - **Citations:** `prepCitations` normalizes the marker↔reference `./Title#cite_*` anchors to pure
    in-page `#cite_*` hashes (so `rewriteLinks` exempts them and they round-trip), tags markers/back-refs
    for the React layer; the `components/topic/CitationLayer.tsx` non-modal **Radix Popover**
    (`@radix-ui/react-popover`) shows the citation text on marker activation without touching scroll-sync.
  - **Math render mechanism:** render Parsoid's **visible SVG fallback `<img>`**
    (`mwe-math-fallback-image-{inline,display}`), **not** MathML and **not** KaTeX. The `<math>` MathML
    payload is an XSS surface this sanitizer deliberately strips; the SVG image is what Wikipedia shows,
    scales crisply, and carries the TeX as `alt`. `cleanMath` drops the now-empty hidden MathML a11y span
    and **un-hides the image** (removes `aria-hidden`) so its `alt` is screen-reader-announced (§5.3) —
    the equation is non-visually perceivable without re-allowing `<math>`/`<svg>`.
  - **TemplateStyles reuse mechanism (sanitized + selector-scoped under `.wiki-body`):** the page's own
    in-body `<style>`/TemplateStyles blocks supply the article column's layout — cladograms
    (`table.clade`), multi-image montages (`.tmulti`, `Template:Multiple image`), hlists, and the long
    tail of exotic TemplateStyles tables — with **no per-template CSS authored by wiki+.** The CSS text
    of those blocks is read in `fetchFullArticle` (from a throwaway parse of the raw Parsoid HTML before
    the DOMPurify pass; the `<style>` *elements* are still removed from the rendered DOM, as
    `style`/`<style>`/`<link>` stay out of the DOMPurify allowlist and `stripChrome`), run through a
    CSS-AST sanitizer (`lib/wiki/cssScope.ts` — `css-tree`: `parse` → `walk` → `generate`, imported from
    the lexer-free `css-tree/parser`·`/generator`·`/walker` subpaths and lazy-loaded so the ~0.8 MB
    `mdn-data` lexer table never enters the bundle), and applied as **one** scoped stylesheet per article
    via a `<style>` element's `textContent` (`components/topic/ArticleStyles.tsx`) mounted inside the
    article subtree. The sanitizer enforces the X4 anti-XSS guarantee for the CSS-block boundary:
    **(scope)** every selector is prefixed with a `.wiki-body ` descendant combinator — across comma
    lists and inside `@media`/`@supports`/`:is()`/`:where()`/`:has()`/`:not()`/CSS-nesting (each
    pseudo-class argument is itself a scoped selector list) — so a bare `body`/`:root`/`html`/`*` or a
    crafted breakout selector is confined to descendants of the article column and cannot match wiki+
    chrome (the ＋plus rail, the projector header, the TOC, the General strip, the player modal);
    `@keyframes` keyframe selectors and a relative selector inside `:has(> …)` are left unprefixed (a
    prefix there is invalid), and stay confined by the outer selector's prefix. **(strip)**
    `@import`/`@namespace`/`@charset`/`@font-face`/`@page`/`@document`/`@apply` at-rules are dropped (no
    remote-CSS/font fetch); declarations are dropped when the property is `behavior`/`-moz-binding`/`binding`,
    when `position` is `fixed`/`absolute`/`sticky` (no off-column overlay; `relative`/`static` are kept,
    e.g. clade `td.clade-bar`), or when the comment-stripped, whitespace-collapsed value contains a
    `url(`/`image-set(`/`expression(`/`-moz-element(` function token (no network exfiltration; the textual
    scan catches comment/whitespace-obfuscated tokens like `u/**/rl(` that an AST `Url`-node check misses).
    **(application)** the scoped CSS is applied **only** via `textContent`, never
    `dangerouslySetInnerHTML` — so a `</style>`-injection fragment that survives tolerant CSS parsing is
    inert text, never markup. This loads **no remote CSS** and re-permits **no** page-body tag, inline
    `style`, or DOMPurify hook: the HTML sanitizer's allowlist, custom `ALLOWED_URI_REGEXP`, and the
    inert-attr `uponSanitizeAttribute` hook (removed in `finally`) are unchanged, and the shared DOMPurify
    singleton gains no new state. Because clade/`.tmulti`/table layout is selectors plus
    border/grid/flex/align declarations (carrying no `url()`/off-flow `position`), faithful structure
    renders from the reused rules; thin wiki+ overrides in `app/globals.css` add the contained
    keyboard-scroll region for trees and wide tables (`.wiki-clade`/`.wiki-tablewrap`) and for `.tmulti`
    montages, the faithful-grey/no-Indigo frame, the `Scroll table →` overflow hint, and the fallback
    grey-border/grey-header grid for an unstyled data table.
  - **Layout-only inline-`style` subset (allowlist + reused value sanitizer):** Wikipedia ships
    per-element layout/color that no stylesheet carries — montage tiling
    (`.tmulti`/`.multiimageinner`/`.tsingle` widths + the per-image crop `height`/`overflow`), per-cell
    table `background-color`, and the taxobox taxon-band color (`{{Taxobox colour}}`) — as **inline
    `style`**. A tightly-bounded, layout-only subset of inline `style` is recovered while the
    inline-`style` XSS surface stays closed. The boundary is a **property allowlist** — `width`,
    `max-width`, `height`, `overflow`, `background-color`, `color`, `text-align`, `vertical-align`,
    `border`/`border-*` — combined with the **same css-tree value sanitizer the `<style>`-block path
    uses**, factored into a shared `lib/wiki/cssDeclSafety.ts` (`valueIsDeclarationSafe`) that both
    `scopeArticleCss` (block path) and `sanitizeInlineStyle` (`lib/wiki/inlineStyle.ts`, inline path)
    call — one audited copy of the X4 value logic: escape-decode every property name + value, drop any
    declaration whose value carries a `url(`/`image-set(`/`-webkit-image-set(`/`expression(`/`-moz-element(`/`behavior`
    token, via a textual comment-stripped scan and a token-level decoded scan (fail-closed on an
    un-tokenizable value). `position` is **never** allowlisted inline (any value, including
    `relative`/`static`) — stricter than the block path — so no inline-styled element can leave normal
    flow to overlay wiki+ chrome. Because DOMPurify 3.x strips the `style` attribute before any
    `uponSanitizeAttribute`/`uponSanitizeElement` hook can observe it, the subset is recovered around the
    DOMPurify pass: a **pre-sanitize encode pass** (on the throwaway raw-HTML parse that also reads the
    `<style>` blocks) first removes any source-supplied `data-wikiplus-style` carrier (carrier-hijack
    defense — the carrier must only ever hold our sanitized output), then runs each element's raw
    `getAttribute("style")` bytes through `sanitizeInlineStyle` and re-emits only the surviving
    allowlisted subset onto an inert `data-wikiplus-style` attribute (the original `style` is dropped);
    DOMPurify keeps that inert `data-*` (with `style` still out of `ALLOWED_ATTR`); a **post-sanitize
    decode pass** renames `data-wikiplus-style` back to `style` on the clean DOM, ordered before the
    layout-consuming passes (`prepClades`/`wrapTables`). The faithful **montage image's scaled display
    size** rides on the `<img>`'s inert `width`/`height` **presentational attributes**, re-permitted by
    the same inert-attr `uponSanitizeAttribute` hook that keeps `colspan`/`rowspan`/`scope` (gated on
    `tagName === "IMG"`, removed in `finally`) — DOMPurify otherwise URI-validates those numeric values
    away under the custom `ALLOWED_URI_REGEXP`. The HTML/attribute boundary, the custom
    `ALLOWED_URI_REGEXP`, and the hook's `finally` removal are otherwise unchanged, and the shared
    DOMPurify singleton gains no persistent state. Recovered colors are the faithful Wikipedia values,
    **AA-darkened to pass** where a recovered `background-color`+text pair would fail contrast in the
    article column: the decode pass keeps the recovered background hue and adjusts the text `color` to
    clear 4.5:1 (never color alone — the cell's text/position/weight and the band's centered/bold/hairline
    carry the signal in greyscale); no Indigo Press color enters the article column. `position`-dependent
    graphics stay out: the geologic `#Timeline-row` timebar is removed by `stripChrome`, and pushpin
    locator-map overlays remain an accepted limit (they need `position:absolute`).
  - **Infobox + taxobox internal layout (structure-keyed CSS, `app/globals.css`):** this is a **thin
    wiki+ override**, NOT part of the TemplateStyles reuse path — because the modern infobox layout
    (`infobox-above`/`infobox-label`/`infobox-header`/`infobox-image`) and the taxobox
    banner/key-value/box-frame treatment live in MediaWiki's own **site CSS** (Codex/`infobox` core),
    which wiki+ never fetches, not in the page-embedded `<style>`/TemplateStyles blocks the reuse path
    reads (those carry only skin/dark-mode overrides for `.infobox.biota`). Faithful layout is reached
    off the Parsoid classes + element structure that survive sanitize: the **modern infobox**
    (`vcard`/settlement/biography) keys off semantic `infobox-*` classes; the **taxobox**
    (`table.infobox.biota`) off classless raw `<th colspan="2">` banner rows + plain `<td>` data cells.
    The **shared banner** (centered, bold, hairline below) targets the taxobox title/section rows via
    `table.infobox th[colspan]` **and** the modern `.infobox-above`/`.infobox-header`; key/value rows are
    left-aligned via `.infobox-label`/`.infobox-data`/`.infobox-full-data` and the taxobox `tr.taxonrow
    td` / bare-`<td>` ladder; the taxobox floats slimmer (`width:22em`/`max 320px`) than the 320px modern
    box; the box keeps the faithful grey frame (`1px solid var(--color-wikirule)` on `#f8f9fa`), never the
    wiki+ panel's indigo hardbox. **Taxon-band color** is recovered from the layout-only inline-`style`
    subset above (`{{Taxobox colour}}` ships it as inline `background-color`): the sanitized inline color
    on the banner `<th>` overrides the structure-keyed grey `#eaecf0` default by inline specificity
    (AA-darkened where a recovered pair would fail), with grey `#eaecf0` as the fallback when an article
    ships no recoverable band color. The band's structural signal (centered/bold/hairline banners, the
    rank ladder) carries it in greyscale regardless — never color alone.
- **Internal-link resolution** edge cases: red links, disambiguation pages, non-article namespaces.
  *Canonical title URLs (owner directive):* article-namespace wikilinks are rewritten to the
  **canonical title route `/topic/<Title>/`** (encoded title, trailing slash to match
  `trailingSlash: true`, basePath-prefixed for the raw `<a href>` so a hard navigation resolves under
  any configured subpath). The decoded title is also stashed in **`data-topic-title`** so a delegated
  click handler in `TopicView` routes ordinary left-clicks through the Next client router (no full
  reload); modified clicks fall through to the href. On arrival the title is resolved via **`resolvePage`**
  (the seeded store first, else the Wikipedia action API) to its **canonical title + plain-text display
  title + QID** in one call; the **QID is never shown in the address bar**, and the **title route
  canonicalizes BOTH the URL and the heading** (follows redirects/aliases; heading uses the plain-text
  `displaytitle`) — see *Routing — canonical title-based Topic URLs*. The typed title is **not**
  preserved on the title route: a messy/alias arrival snaps to the canonical `/topic/<Canonical_Title>/`.
  **Red links** (`.new`/`.mw-redlink`) and **namespaced links** (`File:`/`Help:`/`Category:` — any href
  with a `:`) keep an **absolute Wikipedia URL** opening in a new tab (`rel=noopener`); in-page anchors
  (cite/note refs) are **de-linked** to plain text. No wikilink ever produces a broken `/topic/` route.
  The legacy `/topic?qid=Q…` URL works as a back-compat entry but is **canonicalized away**: `TopicView`
  resolves QID→title and `router.replace`s to the title URL.
  *Title ⇄ URL-slug encoding (the canonical title-encoding seam):* the title path segment mirrors
  Wikipedia's `/wiki/<Title>`, where **a space renders as `_`** — `San Francisco` →
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
  (Wikipedia parity — an accepted collision, not a defect). The navbar search and bare-path redirect
  reuse these helpers.
  *Contributor profile route:* the public profile lives at **`/contributor/<username>`**
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

- **`stance`/`accuracy_flag` are fixed controlled enums** (Curation Standard §2/§3), with an optional
  free-form **`*_modifier`** display field (≤24 chars, never filtered). Stance: `explainer | short |
  demonstration | classroom | opinion | myth_busting | personal_experiment`. Accuracy: `accurate |
  accurate_with_caveat | primary_source | opinion | mixed | misleading | inaccurate`.
- **wiki+ context notes are licensed CC BY-SA 4.0** (same as the article text), with contributor
  agreement captured at submit time (Curation Standard §5.3): the in-product Promote/Add flows require
  the agreement and persist it as `clip.note_license` (`CC-BY-SA-4.0`) + `clip.note_license_agreed_at`,
  stamped server-side by `addClipAction` (see *Data model* → `clip`).
- **Abuse/spam handling** (Curation Standard §7): login-gated contribution, defined removable content,
  honest flagging allowed, per-identity rate limits + the `clip.vetted` review hold. The §7
  enforcement layer is built (rate-limit + hold + removal):
  - **Per-identity write rate-limiting**, backed by Postgres (NOT Redis): a small **`write_event`**
    ledger table backs a per-`contributor.id` window check wired into every counted gated write in
    `lib/server/actions.ts` (`addClipAction`, `upsertTopicAction`, `toggleUpvoteAction`,
    `recordDismissalAction`, `updateClipAction`, `deleteClipAction`). After the auth gate and before any
    persisting write, the action throws `RateLimitedError` (a distinct `name` + the stable
    `RATE_LIMITED` `code`, client-detected by `isRateLimited` beside `isAuthRequired`) if the identity
    is over its cap, writing nothing. **Default cap N=60 writes / W=60s** (env-overridable:
    `WRITE_RATE_LIMIT_MAX`, `WRITE_RATE_LIMIT_WINDOW_SECONDS`; no runtime admin UI), drawn from **one
    shared per-identity budget** (the ledger carries `kind` so a future per-action split needs no
    migration). **Reads are never limited and write no ledger row.** Postgres rather than the
    §7-anticipated Redis because Redis stays reserved for the deferred read-path ISR `cacheHandler` +
    cached candidate sets; a `COUNT(... WHERE contributor_id = ? AND created_at > now() - W)` over the
    indexed slice is trivially cheap at prototype scale, and the ledger doubles as the §7 audit trail.
  - **The `clip.vetted` review hold + the minimal moderator/reviewer role model** — `clip.vetted`
    (boolean, held/published review-state) + `contributor.is_moderator` (the binary role, granted
    out-of-band: the DB flag or the `WIKIPLUS_MODERATORS` allowlist — no admin UI). Two role-gated
    Server Actions (`holdClipAction` = moderator-OR-own-curator; `reviewClipAction` / approve =
    moderator-only, no self-approve) slot into the gate→limit→role→write order; a held clip renders the
    calm "in review · not yet vouched" marking, distinct from a curated clip and a §6 candidate.
  - **Moderator removal** — the `clip.removed_at`/`removed_by`/`removed_reason` **soft-removal
    tombstone** (all nullable). A third role-gated Server Action **`removeClipAction`** (reusing the
    SAME `isModeratorContributor` resolver, but **moderator-only — NO own-curator arm**) slots into the
    same gate→limit→role→write order and appends a `remove` `write_event` kind; it **soft-removes** any
    clip (sets the tombstone, the row persists as the §7 audit trail, the read excludes `removed_at IS
    NULL`), **distinct from** the owner-gated **hard** delete and from the hold (an independent
    `removed_at` column — a held clip still lists, a removed clip does not). It **never** classifies by
    `accuracy_flag` (a human moderator judges abuse — Curation §7.2 / "removal is for abuse, not
    disagreement"); the optional reason is the §7-category set + free-text, **audit-only, never
    reader-facing**. **Restore is deferred but trivial** given the tombstone (clear
    `removed_at`/`removed_by`); no restore UI, no appeals workflow, no moderation dashboard, no
    admin-grant UI.

  *Anti-gaming beyond a single-identity cap* (sockpuppets, vote-fraud) stays **post-MVP**.

## Persistence — Drizzle/Postgres behind a server data-access boundary

The deployed app's `DataStore` is **Postgres via Drizzle ORM**, reached through a **server data-access
boundary**. The seeded topics and every curated clip and candidate dismissal live in **one shared
database** on the VPS, so everyone on `wikiplus.wikiedu.org` reads and writes the **same data**
(shared, multi-user, durable across devices/sessions/deploys).

- **Boundary mechanism: Server Actions (not route handlers).** Server Actions are the idiomatic
  App-Router client→server call and let the client import the boundary as plain typed async functions.
  The boundary (`lib/server/actions.ts`, `"use server"`) wraps the store; auth-gating, rate-limiting,
  and the CC-BY-SA agreement live here too (see below).
- **Boundary surface is narrower than the store (security).** The boundary deliberately does **not**
  expose every store method as an anonymous export (that would let any visitor edit/delete any clip).
  The destructive `updateClip` / `deleteClip` are surfaced **only** as AUTH-GATED, OWNER-ONLY Server
  Actions (`updateClipAction` / `deleteClipAction`). The gate is **server-side and id-based**: each
  action runs `requireContributor()` **first**, then loads the target clip's `curatorId` and **rejects
  unless it equals the session contributor id** — never by username, never trusting a client flag. A
  non-owner / anonymous / legacy-`@prototype`-clip call writes nothing and is rejected
  (`test/clip-edit-delete.test.ts` is the load-bearing security suite). The update is restricted to
  the **editable set** (`contextNote`, `stance` (+ preserved modifier), `accuracyFlag` (+ preserved
  modifier), `general`/`sectionSlug`/`sectionLabel`); a forged patch carrying any other field
  (`curatorId`/`curatedBy`/`createdAt`/video/creator/`upvotes`/`topicQid`/`noteLicense*`) is dropped
  at the boundary (`pickEditable`). Delete is a **hard** `db.delete(clip)` (no soft-delete/undo; the
  captured note-license agreement goes with the row; dismissals are keyed independently and are
  unaffected). The §5.3 **edit re-affirmation** is decided server-side: the action recomputes
  materiality from the **stored** note vs. the patch via a shared normalization helper
  (`lib/curation/note-text.ts` — trim + collapse internal whitespace) and re-stamps `note_license` =
  `CC-BY-SA-4.0` + a fresh `note_license_agreed_at` only when the normalized note text changed **and**
  the client signalled consent; a chip/section-only or whitespace-only edit leaves both untouched. The
  **client affordance** (which clips show Edit/Delete): `rowToClip` surfaces `curatorId` **read-only**
  on the client `Clip`, compared to `session.user.contributorId` in the already-authenticated client
  session (no read-path cost) — a convenience layer that mirrors, but never replaces, the server gate
  (legacy `@prototype` clips carry no `curatorId` → no affordance to anyone). The three write actions
  (`addClip`/`upsertTopic`/`recordDismissal`) are **auth-gated** — `requireContributor()` runs at the
  top of each and rejects an unauthenticated call before any DB write (see *Authentication &
  identity*). A **minimal input stopgap** sits on the write actions (after the gate) — a free-text
  **length cap** (`context_note` / `caption` / `title`) and a **closed-set guard** on the curation
  enums (`stance` / `accuracy_flag` / `platform`), rejecting out-of-vocabulary values before any DB
  call.
- **The store.** `DrizzleDataStore` (`lib/db/drizzle-store.ts`) implements the **full** `DataStore`
  interface server-side. `lib/data/index.ts` remains the **single seam / swap point**: it wires the
  client to the boundary (DB ops → Server Actions) and keeps the **one client-side method**,
  `suggestCandidates`, running the live YouTube pipeline in the browser.
- **Connection.** `lib/db/client.ts` imports **`server-only`** (so the pg driver + `DATABASE_URL`
  can never enter the client bundle) and opens the **postgres.js** connection **lazily at first
  query — never at build/import time**. `next build` therefore needs **no** `DATABASE_URL` and the CI
  image build never connects to a DB.
- **The read / write / client-Wikipedia flow (the central invariant — the server never calls
  Wikipedia):**
  - **Reads (server-DB):** `listTopics`, `listCuratedTopics`, `getTopic`, `getTopicByTitle`,
    `listClips`, `listClipsByContributor`, `listRecentCurations`, the persisted `dismissedKeys` —
    Server Actions → `DrizzleDataStore` → Postgres.
  - **Recently-curated read.** The homepage "Recently curated" grid reads **`listCuratedTopics()`** —
    a method DISTINCT from `listTopics()` (which stays the unfiltered, no-stats `Topic[]` other callers
    depend on). It returns `TopicWithStats[]` (topic + `{ videos, creators, curators }`) via **ONE
    grouped aggregate** over `clip` INNER-joined to `topic` (`GROUP BY topic`, `ORDER BY updated_at
    desc, title`) — never N per-topic reads. The **INNER join + the join predicate are the filter and
    the parity rule at once:**
    - **Filter (§4.1):** a topic with no matching clip contributes no rows and never appears — i.e.
      the section shows only topics with **`videos ≥ 1`** (a zero-curation topic isn't "recently
      curated"). Free from the same aggregate; no second query.
    - **Count parity (critical):** the join matches **exactly the set `listClips` returns** —
      **non-removed clips** (`removed_at IS NULL`) which **INCLUDE held clips** (`vetted = false`
      still counts) — and the three counts mirror `deriveStats` term-for-term: `videos` =
      `count(clip)`, `creators` = `countDistinct(creator_handle)`, `curators` =
      `countDistinct(curated_by)`. So a card's counts equal what the Topic overview shows for the
      same topic. `deriveStats` is reused unchanged; the SQL only mirrors its semantics. The
      reference `LocalStorageDataStore` derives the same shape over its in-memory clip set (test +
      reference parity).
    - **Second consumer — the `/about` dynamic miniature title.** `/about` (the orientation poster)
      also reads `listCuratedTopics()` **server-side** to source the centerpiece miniature's article
      title: it derives an eligible POOL (the curated titles whose length fits the miniature's single
      title line — a ≤20-char cap, `TITLE_FIT_CAP`; an over-long title is excluded, never truncated)
      and passes the pool + the fallback `"Acer palmatum"` to the client `<Centerpiece>`, which
      (re)picks one per power-on. This makes `/about` a **dynamic read** (`ƒ` in the build output) —
      acceptable for the prototype (the production ISR/Redis read path is deferred). An empty / failed
      read falls back cleanly to `"Acer palmatum"`, so `/about` always renders. **Deterministic-capture
      pin:** the screenshot harness appends `?capture=poster`, under which `/about` forces the pool
      empty so the miniature shows the fallback — pinning the About baseline to the committed poster
      (no churn as the seeded curations change) without any test-only branch in the client component.
  - **Recent-curations read — `/recent`.** The cross-topic feed at `/recent` reads
    **`listRecentCurations({ cursor?, limit })`** — the global, cursor-paginated analog of
    `listClipsByContributor`: every curated clip across **all** topics, joined to its parent topic
    for the title + QID (the existing `ContributorClip` shape — **no data-model change**), **newest
    first**. Anonymous like the other reads (the feed is browsable logged-out). Two contracts:
    - **Recency key + stable keyset cursor.** Ordered by `created_at desc, id desc` — the
      authoritative persisted creation/curation timestamp (the same field `listClips` /
      `listClipsByContributor` order by; **`Clip.curatedAt` is a decorative relative label, never the
      orderable field**). The page is a **stable `(createdAt, id)` keyset cursor, never an offset** —
      an offset drifts as new curations arrive at the head between page loads (dupes/gaps), whereas a
      keyset pins the boundary to a concrete `(createdAt, id)` so paging back through history has no
      dupes and no gaps. The cursor is an **opaque** base64url `{ t, i }` (`lib/data/recent-cursor.ts`);
      the client only round-trips it. A **forged/stale cursor degrades safely, never throws**: the
      decode value-validates `t` (a non-date nulls the whole cursor → a plain head read) and `i` (a
      non-integer *number* nulls it), and the keyset additionally drops the id-tiebreak branch when
      `i` is not integer-coercible — so a hostile value never reaches the bound query param as an
      Invalid Date or a `Number→NaN`. `nextCursor === null` ⇒ exhausted (the end-of-feed marker). The
      read fetches `limit + 1` to learn "is there more?" without a second COUNT. `RECENT_PAGE_DEFAULT
      = 12`. **No schema/migration:** `clip.created_at` (and the serial `clip.id` tiebreaker) already
      exist — the feed is a new query over existing columns.
    - **Visibility — vouched only.** Only **public, vouched** clips appear: the same `removed_at IS
      NULL` predicate every read uses, **plus held clips excluded** (`vetted = true`). Unlike the
      topic page (which shows a held clip *marked* because the curator/moderator is in context), the
      cross-topic feed is the site's public "best recent curations" shopfront, so a not-yet-vouched
      (held) clip does not surface there. The reference `LocalStorageDataStore` derives the same
      newest-first, held/removed-excluded, keyset-paged shape over its in-memory clip set (parity).
    - **Count parity (§6.2).** Each feed clip carries the **same PUBLIC derived upvote count the
      topic page shows** — the frozen seed baseline (`clip.upvotes`) **plus** `COUNT(distinct
      clip_vote)` — via the SAME `voteCountsForClips` helper `listClips` uses, so a feed item never
      undercounts a clip that accrued real votes. This is the **public total only**; the per-viewer
      "have I voted" state is deliberately **not** computed on this read (it stays off the read path —
      the feed shows social proof, never the interactive toggle).
  - **`/recent` is a dynamic (uncached) render — explicitly NOT on the (future) static/ISR shell.** A
    global chronological list changes on **every** curation, so it does not fit the cacheable
    per-topic ISR shell (whose cache key is a topic, revalidated on that topic's writes). The route
    sets **`export const dynamic = "force-dynamic"`** so it is never statically cached — every request
    renders fresh and a new curation appears at the head immediately (freshness-on-every-curation).
    This is consistent with the prototype today (per-request Node SSR; the production ISR/Redis read
    path is not built yet). **Future scaling (deferred):** a short-TTL cache or a dedicated cursor API
    for the feed — consistent with *read path is the scale lever* — but no speculative caching infra is
    built now. **Entry point:** the home page's "Recently curated" section carries a **"See all recent
    curations →"** link to `/recent` (the section shows recently-curated *topics*; the feed shows
    recently-curated *clips* — complementary).
  - **Writes (server-DB):** `upsertTopic`, `addClip`, `recordDismissal` — **auth-gated** (rejected
    when anonymous; attributed to the real signed-in contributor). `updateClip` / `deleteClip` are also
    boundary actions (`updateClipAction` / `deleteClipAction`) — **auth-gated + owner-only**, the gate
    `clip.curatorId === session contributor id` (id-based, server-side); delete is hard; see *Boundary
    surface* above. Every counted gated write also passes a per-identity rate-limit check (gate →
    `checkWriteRateLimit` → write → `recordWriteEvent`; over cap → `RateLimitedError`, writes nothing —
    see *Open questions* → Abuse/spam). Two role-gated review-hold writes (`holdClipAction` =
    moderator-OR-own-curator; `reviewClipAction` / approve = moderator-only) and the moderator-only
    `removeClipAction` slot into the same gate→limit→**role**→write order, the role resolved
    server-side (`lib/auth/moderators.ts`). They set `clip.vetted` (held/published) / the
    `removed_at`/`removed_by`/`removed_reason` soft-removal tombstone and append `hold`/`review`/`remove`
    `write_event` kinds. See *Open questions* → Abuse/spam for the full removal/hold semantics.
  - **Client (Wikipedia/YouTube):** title→QID resolution, the article-body fetch, the TOC, and the
    **live YouTube candidate search** all stay **client-side**. `suggestCandidates` runs the pure
    pipeline in the browser; the shared dismissed-video keys it needs for dedup are fetched via the
    boundary first and passed in. `listCandidates` is `[]` server-side (candidates are computed +
    cached, never DB rows — see *Candidate suggestion*).
- **Schema (`lib/db/schema.ts`) + migrations (`drizzle/`, generated by `drizzle-kit`).** Tables:
  `topic` (`wikidata_qid` unique, `title`/`lang`/`description`, `closed_to_suggestions`, the
  `hero_clip_id` nullable FK → `clip` (the at-most-one hero, `ON DELETE SET NULL`), timestamps —
  **no `article_index`**,
  which belongs to the deferred production read-path), `clip` (**every** field on the app's `Clip`
  type, plus `vetted` boolean `NOT NULL DEFAULT true` = the review-hold state, and the
  `removed_at`/`removed_by`/`removed_reason` soft-removal tombstone), `contributor` (`handle` is a
  **non-unique** display column so identity anchors on the `account` row, not the handle; plus
  `is_moderator` boolean `NOT NULL DEFAULT false` = the binary reviewer role), `account`
  (**Auth.js-adapter-shaped** — `unique(provider, provider_account_id)`, FK to contributor),
  `dismissed_candidate` (`unique(topic_id, provider, provider_video_id)` — the sticky-dismissal
  identity; shared so a candidate dismissed by anyone stays dismissed for everyone), `clip_vote`
  (`unique(clip_id, contributor_id)` = the one-per-user upvote invariant, FKs to `clip`/`contributor`
  both `onDelete: cascade`; `clip.upvotes` is kept as the frozen seed baseline), and **`write_event`**
  (the per-identity rate-limit ledger).
- **Migration runs on DEPLOY, never at build or per-request.** A compose **`migrate` one-shot**
  (same app image, `command: node dist/migrate.cjs`) applies pending Drizzle migrations **before** the
  app server starts (`app depends_on migrate: service_completed_successfully`). So a push to `main`
  that changes the schema lands a migrated DB with no manual SSH. The migrate entrypoint is bundled
  (`scripts/build-migrate.mjs` → `dist/migrate.cjs`) so the tiny standalone runtime image runs it with
  plain `node` (no tsx / drizzle-kit / full `node_modules`).
- **Production seed policy — the demo seed is a TEST/LOCAL-DEV FIXTURE, gated OFF in production.** The
  seed (`lib/db/seed.ts` `seedDatabase` — the three demo topics + the curated Photosynthesis demo clips +
  the `@prototype` stub) is **environment-agnostic** and runs **directly** in tests + local dev so the
  contract is exercised in CI with no setup. In **production** it does **not** run: a reader should see only
  genuine, human-vouched curation, so an uncurated topic reads honestly as "not yet curated" rather than
  padded with fabricated demo clips attributed to a non-person stub. The deploy entrypoint
  (`scripts/migrate.ts`) gates the seed behind the **`SEED_DEMO_CONTENT`** env flag:
  - **Default ON.** The flag is read at the entrypoint (`seedDemoContentEnabled()`), **not** inside
    `seedDatabase` (which stays unchanged so the test/local-dev fixture path needs no flag). Seeding runs
    **unless** `SEED_DEMO_CONTENT` is the literal `"false"` or `"0"` (trimmed, case-insensitive); unset /
    empty / any other value seeds. So local dev and tests (flag unset) seed as before.
  - **OFF in production only.** The compose `migrate` service sets `SEED_DEMO_CONTENT: "false"`
    (`deploy/docker-compose.yml`) — the prod-scoped place; the `app` service and local/test runs are
    unaffected. When the flag is off, migrations still apply, the entrypoint logs that the seed was
    skipped, and the run exits 0 (a skipped seed is a clean success).
- **Removing the existing production demo rows — one-time, owner/ops-run `scripts/purge-demo-content.ts`.**
  Gating the seed off stops *re-seeding* but does not delete demo rows a prior deploy already inserted, so
  a **standalone, idempotent** purge removes them once. It is an explicit, auditable, human-initiated step —
  deliberately **not** folded into the deploy path (a destructive `DELETE` on every deploy is a sharp edge
  against the production curation tables, which now hold real hand-built curations). It (a) deletes the
  seeded Photosynthesis demo clips, scoped to the Photosynthesis topic **and** matched on the seeded set's
  stable identity (the seed `watchUrl`s from `lib/data/seed.ts`, derived at runtime), so a non-seeded (real)
  clip on the topic survives; (b) removes the `@prototype` stub contributor **only when it has no remaining
  clips** (orphan-only); (c) is **idempotent** (a second run is a safe no-op); and (d) leaves the three
  seeded topic rows intact. The owner/ops runs it **once** against the live prod DB, with `tsx` (not the
  deploy bundle):

  ```sh
  DATABASE_URL="postgres://USER:PASS@HOST:5432/wikiplus" yarn tsx scripts/purge-demo-content.ts
  ```

  Sequence: deploy the gate first (so re-seeding stops), then run the purge once, then confirm the
  Photosynthesis topic shows zero clips and the `@prototype` contributor is gone.
- **Async-write UX.** The reader/curate writes get deliberate pending/failure UX (design
  `docs/design/persistence-postgres.md`): the **contribute add is awaited** (pending/disabled button,
  fields preserved on failure, honest error + retry, no false success); the **sticky dismissal is
  optimistic with rollback** (hide instantly, persist in the background, re-show the card + a polite
  notice on failure). Read failures degrade to an honest line (home: "Couldn't load topics", topic
  rail: "Couldn't load curated videos"), never an infinite spinner. The cosmetic "synced" label is a
  static string (no realtime).
- **Tests.** `DrizzleDataStore` + the seed are tested against **pglite** (in-memory Postgres, WASM) so
  the contract runs in CI with **no live DB / no network** (`test/drizzle-store.test.ts`,
  `test/helpers/pglite-db.ts`). The view/integration tests mock the `@/lib/data` seam to a
  localStorage-backed double (`test/helpers/data-mock.ts`) — the component state machine is what they
  exercise; the data backend is incidental.
- **E2E (Playwright) backing.** `yarn test:e2e` runs against the **real** Node SSR server
  (`yarn build && yarn start`), so — unlike the view tests — its store Server Actions hit a real
  Postgres and its contribute actions hit the real auth gate. `globalSetup` (`e2e/global-setup.ts` →
  `e2e/db-server.ts`) boots an **ephemeral, seeded Postgres** (system `initdb`/`pg_ctl`, the same
  `yarn db:migrate` deploy path) and `playwright.config.ts`'s `webServer.env` supplies `DATABASE_URL`,
  a throwaway `AUTH_SECRET`, and a placeholder `NEXT_PUBLIC_YOUTUBE_API_KEY` (build-inlined so the
  candidate source is enabled; the search call is then stubbed). All external HTTP (Wikidata, the
  action API, REST article HTML, `search/title`, YouTube `search.list`) is intercepted in-spec with
  complete shapes — **the contract is documented in `e2e/fixtures-contract.md`** (the durable artifact;
  builders in `e2e/fixtures.ts`). The action-API stub MUST return `pageid` + `title` (not just
  `pageprops.wikibase_item`), or `resolvePage` treats the page as unresolved. Contribute tests sign in
  by minting the exact Auth.js JWT cookie via the app's own `@auth/core/jwt.encode` (`e2e/auth.ts`) —
  a test precondition, not OAuth coverage.
- **Still deferred:** ISR + the Redis shared `cacheHandler`, the production read-path caching,
  `article_index`, moving Wikipedia/QID/YouTube server-side, Cloudflare edge cache, and Redis in
  compose.

## Prototype phase (current — Node SSR server; shared Postgres data layer)

The prototype runs as a **Next.js App Router Node SSR server** backed by **shared Postgres via
Drizzle** (see *Persistence* above) — the deployed app is **multi-user and durable**. `next build`
produces a **server build** (`.next/`, no `out/`) and `next start` serves it, rendering Topic titles
**on demand** (including never-seeded ones). It does **not** yet exercise the production read-path
(ISR/Redis). A running Node server is what makes Server Actions, real auth (Auth.js), and a real DB
(Drizzle) work.

- **Run / build / test:**
  - `yarn dev` — local dev server.
  - `yarn build` — produces the **server build** in `.next/` (no static `out/` export).
  - `yarn start` — serves the built server (`next start`); pair with `yarn build` first.
  - `yarn typecheck` / `yarn test` (Vitest) / `yarn test:e2e` (Playwright against `next build` +
    `next start`; see *Testing*).
  - `basePath` is **env-driven** (`NEXT_PUBLIC_BASE_PATH`, empty for the root-served local server; a
    subpath host can set it). `next.config.mjs`: `output:'export'` is not set; `assetPrefix` is not set
    (the server prefixes `_next/` assets from `basePath` itself); `images.unoptimized` kept (no
    `next/image` in use; harmless no-op); `trailingSlash:true` kept (the canonical `/topic/<Title>/` URL
    enforced by the server's redirect); `outputFileTracingRoot` kept.
- **Deploy:** **LIVE.** A push to `main` auto-deploys the Node SSR server to a **Linode Nanode 1GB
  (Debian 13 / trixie)** at **`wikiplus.wikiedu.org`** via Docker Compose (`app` + `caddy` + `postgres`
  + `migrate`; Redis deferred, Cloudflare edge cache deferred to the production-MVP).
  `.github/workflows/deploy.yml` builds the **standalone** image in CI, pushes it to **GHCR**
  (`ghcr.io/ragesoss/wikiplus`), then SSHes to the box to `docker compose pull && docker compose up -d`
  — **the box never builds Next.js** (would OOM). See **Deployment** above + the `deploy/` files + the
  box-setup runbook (`docs/ops/vps-setup.md`).
- **YouTube key:** `NEXT_PUBLIC_YOUTUBE_API_KEY` in `.env` (gitignored) for local dev. A `NEXT_PUBLIC_`
  var is read at **build time** and inlined into the **client** bundle (search runs client-side), so it
  is **visible in the shipped bundle by design** — the HTTP-referrer restriction and a quota cap are
  the guard, not secrecy. Unset in local/CI builds → the live search **no-ops** (falls back to the
  seeded/empty candidate set). (The `deploy.yml` build reads it from a GitHub Actions secret; when
  search moves **server-side** in the production read-path it becomes a server secret, not a
  client-inlined var.)
- **Data:** all access goes through the `DataStore` interface (`lib/data/store.ts`); the deployed app
  uses `DrizzleDataStore` (shared Postgres) reached via Server Actions — see *Persistence —
  Drizzle/Postgres behind a server data-access boundary* above. `lib/data/index.ts` is the single
  seam/swap point. `LocalStorageDataStore` is a reference impl + test double, not wired for the deployed
  app.
- **Wikipedia:** article fetch + DOMPurify sanitize run client-side; Wikidata resolves QID→title. For
  **playback** oEmbed is avoided — we store `platform`+`videoId` and build the click-to-load facade
  ourselves. **For add-by-link *metadata*,** a YouTube/TikTok oEmbed lookup runs **server-side**
  (`resolveOEmbedAction`) to populate the real title/creator/thumbnail — metadata only, still
  embed-never-host (see *add-by-link* below).
- **Auth:** **LIVE** — real **Wikimedia OAuth 2.0 via Auth.js v5** (JWT sessions, no session store).
  Reading stays anonymous; the three persisted write actions
  (`addClipAction`/`upsertTopicAction`/`recordDismissalAction`) are **auth-gated at the Server Actions
  boundary** and attribute to the real signed-in contributor. The `@prototype` stub attributes only
  clips curated before sign-in existed. See *Authentication & identity* above. **Ops bring-up needs:**
  `AUTH_SECRET` (server secret), the `wikimedia_oauth_client_key`/`_secret` as Docker secrets on the
  box, and the prod callback `https://wikiplus.wikiedu.org/api/auth/callback/wikimedia` registered at
  meta.wikimedia.org.
- **In-product Promote / Add-by-link curation.** The two Topic-page curation modals
  (`components/topic/CurateModal.tsx`, `AddModal.tsx`) write through the **auth-gated Server Actions
  boundary**: `CurateModal` → `addClipAction`; `AddModal` → (`upsertTopicAction` if the topic is not
  yet in the store →) `addClipAction`. The host (`app/topic/TopicView.tsx`) owns the write + the
  in-memory clip-state update (the new clip renders with no reload, flipping empty→curated when first)
  + dropping the promoted candidate from the live suggestion set (deduped by `platform:videoId`) + the
  expired-session gate (`isAuthRequired` → `showExpiredGate`). The **CC BY-SA note-license agreement**
  (Curation Standard §5.3) is a **required** publish precondition (the unchecked-on-open checkbox in
  `CurateFields` gates publish) and is captured on the clip row: the client sends only a **consent
  boolean**; `addClipAction` stamps `note_license` + `note_license_agreed_at` and **strips any
  `note_license*` smuggled on the input** (attribution + license are the boundary's call, never the
  client's — same posture as `curated_by`). The canonical license version + the two verbatim agreement
  strings live in `lib/curation/note-license.ts`. New adds publish immediately (no `vetted` hold).
- **Owner-only edit / delete of your own clips.** `updateClipAction` / `deleteClipAction` are
  **auth-gated + owner-only** (the gate `clip.curatorId === session contributor id`, id-based,
  server-side — see *Boundary surface*). The Topic page shows the owner-only **Edit/Delete**
  affordances on the curated `ClipCard` and the `GeneralStrip` tile (an Edit modal cloned from
  `CurateModal` with the conditional §5.3 re-agreement; a Cancel-default Delete confirm dialog) and
  re-renders **in place** / removes-and-refocuses with no reload. Affordance ownership: `curatorId`
  surfaced read-only on the client `Clip` (`rowToClip`), compared to `session.user.contributorId` (no
  read-path cost; mirrors but never replaces the server gate).
- **Public contributor profiles + "context by &lt;curator&gt;" attribution.** A **public profile
  route `/contributor/<username>`** (`app/contributor/[username]/page.tsx` +
  `app/contributor/ProfileView.tsx`, paralleling Wikipedia's `Special:Contributions/<user>`) lists a
  contributor's curated clips with topic context. It exposes **only public identity** — the Wikimedia
  **username** (`contributor.handle`) + the **granted avatar** — and **NEVER `email`** or any
  non-public `account` field (the privacy boundary is the **public-safe projection**
  `rowToPublicContributor` in `lib/db/mappers.ts`, which selects only `contributor` columns;
  `PublicContributor` carries `{id, username, avatarUrl}` only). Reading any profile is **anonymous**.
  **"My curations" is the owner-view of that same route**: a signed-in viewer reaches their own
  `/contributor/<own-username>` via the header account menu, and when the viewer **is** the owner the
  page reframes to "My curations" + surfaces the owner Edit/Delete affordances — **no** separate
  private route or data. Two **read** methods on the seam (read-only Server Actions
  `getContributorByUsernameAction` / `listClipsByContributorAction`, **no `requireContributor`
  gate** — public like `listClips`): **`getContributorByUsername`** resolves a username to the
  public-safe projection (null for unknown); **`listClipsByContributor`** returns that contributor's
  clips joined to their parent topic (title + QID for the "On &lt;Topic&gt;" link), newest-first.
  Because `contributor.handle` is **non-unique**, the lookup resolves deterministically to a **single**
  identity by the **lowest `contributor.id`** for that handle. The seeded **`@prototype` stub resolves
  to null** (not a real person to profile). The public **"context by &lt;username&gt;"** attribution
  (a shared `ContextByLink` element, strings in `lib/curation/curator-attribution.ts`) links **IN** to
  `/contributor/<username>` on the curated `ClipCard` footer + `GeneralStrip` tile — **distinct** from
  the §5.2 creator credit, which links **OUT** to the platform (direction is the editorial tell,
  CURATION §5.4); a `@prototype`/no-curator clip shows the **non-linked** `seed clip · no curator`
  label. **No per-user work is added to the cached topic read path:** the attribution is static markup
  from `clip.curatedBy`, the owner-affordance is the already-authenticated client-session compare, and
  the profile reads run **only** on the profile route (a plain dynamic read page — no ISR/Redis, which
  is deferred).
- **Upvotes — a persisted, one-per-user, toggleable signal.** The reader's "I'm glad I watched this"
  signal is an interactive, identity-tied **toggle** backed by `clip_vote` (see *Data model*). One
  **auth-gated Server Action `toggleUpvoteAction(clipId)`**: `requireContributor()` first (anonymous /
  expired writes nothing), then insert-if-absent (`onConflictDoNothing` so a race lands voted) /
  delete-if-present, returning the new `{ voted, count }`. **Self-vote is allowed.** The Topic page
  uses **optimistic-with-rollback** (`runUpvote`): the count moves ±1 and the voted-state flips
  instantly, reconciled to the server's authoritative return; on error it rolls back — an expired
  session → the expired-session gate, else a polite `role="status"` notice. Logged-out activation
  routes to the gate (an `upvote` entry in `AUTH_COPY.gates`) with **no** optimistic vote (the count
  stays visible — reading is anonymous). The voted/not-voted state is **never color-alone**:
  `aria-pressed` + a visible "Voted" word + a filled-vs-outline glyph (CURATION §4). **Read-path
  discipline:** the **count is public** and rides the topic read (`listClips` derives it — same for
  every viewer); the **per-viewer voted-state is OFF the cached read path** — a viewer-scoped
  **`votedClipIds(clipIds)`** seam read (auth-gated `votedClipIdsAction`) resolved in the
  already-authenticated client session (hydrate-on-mount in `TopicView`, scoped to the visible clips),
  exactly as `ownsClip()` is computed client-side. An anonymous topic load does ZERO voted-state work;
  `listClips` issues **no** per-user vote query.
- **Per-identity write rate-limit enforcement.** A signed-in identity may make at most **N=60 writes
  per W=60s** (default; env-overridable via `WRITE_RATE_LIMIT_MAX` / `WRITE_RATE_LIMIT_WINDOW_SECONDS`),
  keyed by **`contributor.id`** across the counted gated writes, drawing from **one shared per-identity
  budget**. The **order is gate→limit→write** (`lib/auth/rate-limit.ts`): `requireContributor()` first,
  then `checkWriteRateLimit` (a pure read — over the cap throws **`RateLimitedError`** with no side
  effect, so the rejected write writes nothing), then validation + the write, then `recordWriteEvent`
  appends ONE ledger row AFTER the write lands (counting only **successful** writes). `RateLimitedError`
  mirrors `AuthRequiredError` (distinct `name` + stable `RATE_LIMITED` `code`, surviving Next.js prod
  message redaction); the client-safe **`isRateLimited`** detector sits beside `isAuthRequired` in
  `lib/auth/auth-error.ts`. Each gated-write call-site (`runUpvote`, `runDismiss`, the modal submit,
  edit/delete in `TopicView` + `ProfileView`) widens its catch to **three mutually-exclusive arms**:
  `isAuthRequired →` expired-session gate; `isRateLimited →` a **calm, non-red `role="status"`** "too
  fast" notice (`AUTH_COPY.rateLimit.notice`); `else →` the generic error. Reads are never limited and
  write no ledger row; a normal-speed human never trips it. Backing is Postgres (the `write_event`
  ledger) — see *Open questions* → Abuse/spam.
- **The `vetted` review-hold + the minimal moderator/reviewer role model.** A held clip is a **third
  clip-state** (Curation Standard §7.1): `clip.vetted = false` ≙ held / in review, `true` ≙ published
  (new adds publish by default — see *Data model*). The held-state **rides the clip read** (`listClips`
  → the client `Clip.held` flag, derived in `rowToClip`); the cached read path does **no** per-user
  work to render the held marking. Two **role-gated Server Actions** in `lib/server/actions.ts`, both
  in the **gate→limit→role→write** order (the role/ownership check rejects + writes nothing otherwise —
  the load-bearing security behavior):
  - **`holdClipAction`** (publish → held, `vetted=false`): allowed for **a moderator (any clip)** OR
    **the clip's own curator (own clip only)**.
  - **`reviewClipAction`** / approve (held → published, `vetted=true`): **moderator-only** — a curator
    may **not** self-approve, not even their own held clip (the vouch is confirmed by someone other
    than its author — §7.1).

    The role is resolved **server-side** (`lib/auth/moderators.ts` — the DB `is_moderator` column OR
    the `WIKIPLUS_MODERATORS` env allowlist), **never** a client flag; a matching JWT `isModerator`
    session claim drives only the off-read-path reviewer affordances. The held clip renders a calm,
    text-labeled **"In review · not yet vouched"** marking (the verbatim §7.1 strings) on the
    `ClipCard` (solid ink left-rule, above the chips) and the `GeneralStrip` tile (a white-fill pill
    for AA on the indigo band), **keeping** its note/chips/curator — distinct from a fully-curated clip
    and from a §6 candidate. The two `write_event` `kind`s (`hold` / `review`) need no ledger schema
    change. Granting a moderator is OUT-OF-BAND (see *Data model* → `contributor`); the gate rejects
    everyone until one is granted.
- **Moderator removal of abusive clips — the soft-removal tombstone.** A **moderator-only soft
  removal** (Curation Standard §7.2) over the `clip.removed_at`/`removed_by`/`removed_reason` tombstone
  (see *Data model*): the row **persists** as the §7 audit trail and the **clip read excludes
  `removed_at IS NULL`** (`listClips` AND `listClipsByContributor`), so the removed-state rides the
  read as an **exclusion** with no per-user work — there is **no reader-facing removed marker**. One
  **role-gated Server Action** `removeClipAction` in the **gate→limit→role→write** order, appending a
  `remove` `write_event` kind. The role check is **MODERATOR-ONLY** — it reuses the SAME
  `isModeratorContributor` resolver but has **NO own-curator OR-arm** (the key contrast with
  `holdClipAction`): removal of *anyone's* clip is the privileged reach, and a non-moderator —
  **including the clip's own curator** — is rejected at the action on the role and the clip stays (an
  anonymous caller is rejected by the gate first; these are the load-bearing security tests, not a
  hidden button). It **never** gates on or reads `accuracy_flag` — a human moderator judges abuse; an
  honest `opinion`/`mixed`/`inaccurate` clip with a fair note is legitimately curatable, NOT removable
  ("removal is for abuse, not disagreement" — §7.2). The optional **`removed_reason`** is the
  §7-category set + optional free-text (`lib/curation/removal-reason.ts`), **both optional** (a removal
  needs no reason), **audit-only, NEVER reader-facing**. **Distinct from the owner-gated
  `deleteClipAction` HARD delete** (the row is GONE there; here it persists) and from the hold (an
  INDEPENDENT `removed_at` column: a held clip `vetted=false`,`removed_at IS NULL` still lists; a
  removed clip is excluded regardless of `vetted`). The client reflects a removal by **filtering the
  clip out of the in-memory `clips` set** (no reload; counts drop; the last clip flips curated→empty),
  through the `RemoveConfirmDialog` (Cancel-default, the optional reason, the three-arm catch); focus
  moves to `focusBandHeading()`. The moderator-only **Remove (moderator)** affordance joins the
  `ReviewRow` (last, after Hold/Approve) on the rail card + the General tile, computed from the
  off-read-path `isModerator` claim (the convenience layer; the server gate is the security control).
  **Restore is deferred but trivial** given the soft tombstone (clear `removed_at`/`removed_by`); no
  restore UI, no appeals, no moderation dashboard, no admin-grant UI.
- **Real video-metadata resolution on add-by-link.** The add-by-link flow labels a
  pasted clip with **real** resolved metadata, never placeholder mock strings. A recognized
  **YouTube or TikTok** link resolves `title`→`caption`, `author_name`→`creator.name`,
  `author_url`→`creator.url`, a `creator.handle`, and `thumbnail_url`→`thumbnailUrl` (a referenced
  URL, never hosted — embed-never-host preserved). **Handle precedence (D1):** the canonical
  `@handle` carried in the share URL when present (TikTok URLs embed it —
  `tiktok.com/@junglygarden/video/…`; captured onto `ParsedVideo.creatorHandle`, an in-memory parse
  field), else the author-name derivation (the SAME as the candidate pipeline —
  `lib/candidates/youtube.ts`, `@`+name lowercased/spaces-removed; YouTube uses this floor since its
  watch URLs carry no clean handle), else name-only — never `"pasted"` (CURATION §5.5). The preview
  updates **before** submit; the modal shows "Resolved via oEmbed" **only** on a real resolve. The
  oEmbed fetch runs in a **Server Action** (`lib/embed/oembed.ts` `resolveOEmbedAction`), **not** a
  client fetch — neither `https://www.youtube.com/oembed` nor `https://www.tiktok.com/oembed` sends
  `Access-Control-Allow-Origin`, so a browser fetch would CORS-fail and push every add into the failure
  state; the server action sidesteps CORS and is the natural home for the descriptive **`User-Agent`**
  (etiquette — browsers forbid setting it). It is **stateless**: no schema change, no new secret (both
  oEmbed endpoints are token-free — independent of the YouTube *Data API* search key), no read-path
  cache (`cache: "no-store"`), a bounded request timeout (`AbortSignal.timeout`, ~5s — a hang is a
  failure, not a stuck modal), and it is **not** auth-gated/rate-limited (a read-only metadata lookup;
  the *write* is gated at `addClipAction`). The **resolve floor** is a non-empty `title` AND
  `author_name`; `author_url` and `thumbnail_url` are optional and degrade gracefully (a missing link →
  a non-linked credit, a missing thumb → the gradient fallback — both still a successful resolve). A
  **fetch failure** (non-200 / network error / malformed JSON / floor-miss / timeout) returns
  `{ ok: false, reason: "failed" }` and shows a labeled, non-red "Couldn't fetch video details" state
  with **Try again / Add anyway / Cancel** (Add anyway → an honest unresolved placeholder:
  "Unresolved {Platform} clip" caption, a NON-linked "Creator not resolved" credit — no fabricated
  name, no fake/dead `creator.url`, no `"pasted"` handle, no false "resolved via oEmbed" — CURATION
  §5.5), so the flow is never a dead end. **Instagram / other** recognized links return
  `{ ok: false, reason: "unsupported" }` (no fetch — no token-free oEmbed for our use) and land on
  that honest placeholder directly, plus an MVP-limitation line. The card's creator credit
  (`ClipCard`) **degrades to a non-linked span when `creator.url` is absent** (never a dead/empty
  outbound link). The persisted `Clip`/`ClipMediaSource` shape carries the resolved
  `caption`/`creator`/`thumbnailUrl` values. The pre-persistence parse validation (unrecognized link →
  the red "Unrecognized link" error) never reaches persistence.
- **Server Actions** are the **data-access boundary** for shared Postgres (`lib/server/actions.ts`,
  `"use server"` — see *Persistence* above). The server **never** talks to Wikipedia — title→QID, the
  article body, the TOC, and the YouTube candidate search all stay client-side.
- **Vocabularies:** `stance`/`accuracy_flag` in `lib/data/types.ts` are the **closed CURATION enums**
  (`docs/CURATION_STANDARD.md` §2/§3). Chip text is derived from a single **enum→label/fill map** in
  `lib/curation/labels.ts` (§4); optional display-only `*Modifier` fields render as "Label · modifier".
  The AA-safe chip fills are pinned there: stance = deep-violet `#5248AF`, accuracy = teal-dk `#1F6757`
  / action `#1F6F95` / red `#B0353B` (design spec §9.3).
- **Topic Page data model** (`lib/data/types.ts`, described in `lib/data/store.ts`): the `Clip`
  type carries the card's display fields — `platformLabel`, `orientation`, `watchUrl`/`embedUrl`,
  `thumbnailUrl`+`thumbGrad`, `creator{name,handle,platform,url,avatarGrad,followerCount?}`,
  `general`/`sectionSlug`+`sectionLabel`, `upvotes?`, `curatedBy?`. A separate **`Candidate`** type
  (unvetted empty-state suggestion) shares the media/creator fields, adds `vetted:false` + `source`
  + `matchReason`, and **omits** stance/accuracy/contextNote (CURATION §6). The `DataStore` seam gains
  **`listCandidates(topicQid)`**; topic-level counts (videos/creators/curators) are **derived** from
  the clip set (`deriveStats`), never stored.
- **Live candidate auto-suggestion (`lib/candidates/`).** The candidate **source** behind the seam is
  a **live, cached YouTube Data API search**. A pluggable source registry (`lib/candidates/index.ts`,
  YouTube the only registered source — TikTok/Vimeo slot in additively) feeds a deterministic pipeline
  (`pipeline.ts`): one `search.list` call per topic → case-insensitive keyword-overlap **section
  matching** (`matching.ts`, best available match per section, non-topic-generic threshold, fixed
  tie-break order) → **placement** (one home per video, section beats General, General capped at 5) →
  dedup against curated clips + sticky dismissals + within-set. The seam method is
  **`suggestCandidates({topicQid, topicTitle, sections, curatedVideoKeys})`** (returns the computed set,
  or **`null`** when no source is enabled — the no-key no-op). The key is read **only** from
  `process.env.NEXT_PUBLIC_YOUTUBE_API_KEY`; with it unset (every local/CI build) `isEnabled()` is
  false, no call is made, nothing is cached, and the seam falls back to `listCandidates` (seeded/empty)
  — and any source-side quota/network error is swallowed to `[]` (degrade to seeded/empty, never a
  thrown error or error UI). The computed set is cached per QID in `localStorage`
  (`wikiplus.candidates.<QID>`, `{fetchedAt, candidates}`, 24h TTL, lazy refresh — the same shape as the
  eventual Redis cached set); dismissals persist to `wikiplus.dismissed_candidates` keyed `(topicQid,
  platform, videoId)` (mirrors the `dismissed_candidate` table). Orientation defaults to horizontal,
  vertical only on a positive Shorts signal. Production moves the search **server-side** (key → server
  secret, set → Redis) — a source/store swap behind the same seam, not a redesign.

- **Routing — canonical title-based Topic URLs, rendered on demand by the Node server.** The
  user-facing Topic URL is **title-based** (`/topic/<Title>`, paralleling `/wiki/<Title>`); the QID is
  the internal key, resolved under the hood and never shown (owner directive). The route is an
  **optional catch-all** `app/topic/[[...slug]]/page.tsx`: `generateStaticParams` pre-renders the
  **seeded titles** (`Photosynthesis`, `Cellular_respiration`, `Cat`) plus the bare `/topic` shell
  (`slug: []`) that serves the `?qid=` back-compat entry — so the warm paths render without an on-demand
  pass. `dynamicParams = true`: any title NOT in `generateStaticParams` is **rendered on demand by the
  running server**, not 404'd. The catch-all owns **every** `/topic/...` path; `not-found.tsx` handles
  the bare-path boot (below). The server **never** talks to Wikipedia: an on-demand render emits a
  neutral loading shell, and `TopicView` resolves the title client-side (`titleFromPathname` →
  `resolvePage` → article fetch). In-app navigation uses the Next client router (`<Link>` + a delegated
  wikilink click handler), so it never triggers a full reload. Helpers live in `lib/wiki/topicRoute.ts`
  (`topicHref`, `titleFromPathname`, `titleToSlug`, `currentTopicSlug`). `trailingSlash:true`, so the
  server **308-redirects** a slashless `/topic/<Title>` to the canonical `/topic/<Title>/`.
  - **Title-route arrival CANONICALIZES both the URL and the heading.** On arrival at a typed/pasted
    `/topic/<typed>/`,
    `TopicView` resolves the title via **`resolvePage` (`lib/wiki/article.ts`)** — a SINGLE action-API
    request `action=query&prop=info|pageprops&inprop=displaytitle&ppprop=wikibase_item&redirects=1&
    titles=…` that returns `pages[].title` (**canonical** title), `pages[].displaytitle` (**rendered**
    title), and the QID in one round-trip (`titleToQid` is a thin wrapper over `resolvePage`).
    `redirects=1` **follows Wikipedia redirects / aliases** (`jfk` → `John F. Kennedy`). The
    canonical/display values then **split**: the **canonical title** keys the URL/slug, the store
    lookup, the QID lookup, the article fetch, and the **"From Wikipedia"** attribution link /
    `ArticleError` URL; the **plain-text `displaytitle`** (HTML stripped — rich-formatted headings are
    deferred) drives **only** the human heading (the masthead `<h1>` + the compact `TopicHeader` echo),
    so the URL and heading legitimately differ for author-stylized titles (canonical `Bell_hooks` ⇄
    heading `bell hooks`). When the slug a reader arrived on (`currentTopicSlug(pathname)`) differs from
    `titleToSlug(canonicalTitle)`, `TopicView` **`router.replace`s** (never `push`, so **Back** doesn't
    bounce through the typo) to the canonical `/topic/<Canonical_Title>/` (underscore form, trailing
    slash + basePath via `topicHref`); an already-canonical arrival fires **zero** replaces (no loop, no
    history churn). An **unresolved** title (no canonical title / no QID, and no seeded-store hit) is
    **not** canonicalized — no replace to an empty/partial slug — and reaches the not-found /
    resolve-error path. The **live canonical title wins over a differing seeded-store title** (keeps URL
    + store key + heading consistent); the store is only the fallback when the API resolves nothing. The
    legacy `?qid=` entry resolves QID→title, then `router.replace`s to the title URL.

- **Routing — bare-path fallback redirect (`/<Title>` → `/topic/<Title>/`).** A **bare single-segment
  path** (e.g. `/San_Francisco`) is the natural shorthand a reader types/pastes; it is redirected to the
  canonical `/topic/<Title>/` rather than dead-ending. The rule lives in **`app/not-found.tsx`** (the
  not-found boot, reached for any path the server can't match to a route — chiefly a bare single
  segment; server-rendered per request): on mount it computes a redirect target from
  `location.{pathname,search,hash}` and, if non-null, `router.replace`s to it while rendering a
  **neutral Topic loading state** (`ArticleSkeleton`) plus a polite `role="status"` "Loading topic…"
  announcement — so a real topic lands directly in *loading*, never the "Topic not found." flash, and a
  screen reader hears the hop (`router.replace` skips the native page-change announcement, and
  `TopicView`'s live region is `mode === "empty"`-gated). The **reserved-prefix allowlist** — the single
  source of truth — lives in **`lib/routing/reserved.ts`** (`barePathRedirectTarget`, `bareTitleSegment`,
  `isReservedSegment`, `RESERVED_SEGMENTS`), with a comment pointing back to
  `docs/specs/bare-path-redirect.md`. Redirect **iff** the path is a single non-empty segment, not
  reserved, and not under `/topic`; reserved = `/` (home), the enumerated top-level routes (`topic`,
  `contribute`, `_next`), any segment with a `.` (asset) or a `:` (namespace). The segment is normalized
  through `slugToTitle` → `titleToSlug` (so `/Multi Word` and `/Multi_Word` both → `/topic/Multi_Word/`);
  query + hash are preserved. The
  loop guard is structural: the destination is under the reserved `/topic` prefix, so the rule is a
  no-op on it. **Future-proofing policy:** every new top-level `app/<section>/` route MUST be added to
  `RESERVED_SEGMENTS` in the same change — enforced by a unit test that asserts each current top-level
  route is reserved.
  - **The bare-path boot is server-rendered per request.** The server returns a **404 *status*** for
    the unmatched bare path (correct HTTP semantics), but its **body is the neutral loading shell**
    (`not-found.tsx`'s `redirecting === null` server branch → `ArticleSkeleton` + "Loading topic…"),
    never a "Topic not found." flash; the client then runs the `router.replace` hop. The bare-path
    redirect is **client-side** (a server-side HTTP redirect for it is deferred to the production
    read-path). `trailingSlash:true` makes the server first 308 a slashless `/San_Francisco` to
    `/San_Francisco/`; the browser preserves query + hash across that hop, and the client reads them
    from `window.location`, so they reach `/topic/<Title>/`.

**Path to production:** the prototype is a Node SSR server, and the host + auto-deploy are provisioned
(Linode VPS + Compose + Caddy at `wikiplus.wikiedu.org`, CI→GHCR→SSH on push to `main`; see
*Deployment*). The Drizzle `DataStore` + Server Actions + shared Postgres, Wikimedia OAuth, and the
curation-action product layer are done. Remaining: the production read-path (ISR + the Redis
`cacheHandler`, server-side candidate search, the deferred Redis compose service + Cloudflare edge
cache, `article_index`, and a server-side bare-path HTTP redirect). The components, data model, design
system, article pipeline, and the title-based URL scheme carry forward unchanged.

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
  (incl. shared dismissals + multi-user sharing) with **no external DB and no network**. The
  view/integration tests mock the `@/lib/data` seam to a localStorage-backed double
  (`test/helpers/data-mock.ts`), since the production seam routes through Server Actions → Postgres.
- **End-to-end — Playwright (`e2e/`).** `yarn test:e2e` builds the **Node server** (`next build`) and
  serves it with `next start`, then drives the core loop (find topic → read → watch & weigh →
  contribute) in a real browser. Unseeded `/topic/<Title>/` deep links are rendered on demand by the
  running server. The Wikipedia/Wikidata calls are **intercepted with fixtures** (`page.route`) so the
  run is deterministic and offline. Requires `npx playwright install chromium` (a one-time browser
  download — not possible in a no-egress sandbox, so e2e runs in CI / local).

Test deps are devDependencies; `@testing-library/dom` is pinned explicitly (a peer of
`@testing-library/react`). Author-run `yarn build` is **not** review — a `qa-reviewer` subagent owns
the pass/fail-per-AC verification and the security review (CLAUDE.md).
