# Spec: Resolve Instagram clip details (creator, caption, thumbnail)

- **Status:** v1 (Phase 1 / Product, build-loop run "improve Instagram rendering").
- **Lane:** Heavy — adds a new creator-credit source (CURATION §5.5), a new server route, and a
  deploy-time data backfill. No schema change.
- **Owner report:** an Instagram Reel curated on *Viral video* shows as "Unresolved Instagram clip"
  over a gradient until play is clicked.

## Problem

Instagram's oEmbed needs a Meta app token, so every Instagram add lands on the honest-but-empty
placeholder: no caption, "Creator not resolved", no thumbnail. The clip plays fine, but on the Topic
page it looks broken and gives readers nothing to decide whether to play it.

## Findings (verified live with the wiki+ User-Agent)

1. Instagram's **public embed page** — `https://www.instagram.com/{p|reel}/<code>/embed/captioned/`,
   the page Instagram publishes for third-party embedding — returns, token-free, the creator
   **username** (`span.UsernameText`), the **caption** (`div.Caption`), and the **thumbnail**
   (`img.EmbeddedMediaImage`). A deleted/private post returns a page marked `EmbedBroken`.
2. Instagram's thumbnail URLs are **signed and expire** (~5 days, the `oe=` param). They must not be
   persisted.
3. The stable `…/media/?size=l` redirect ends on an image served with
   `Cross-Origin-Resource-Policy: same-origin`, which the browser blocks on wikiplus.video. The
   embed-page image is served `cross-origin` and loads.

## Scope

- **Resolve on add.** `resolveOEmbedAction("instagram", url)` fetches the embed page server-side
  (descriptive UA, bounded timeout, no cache) and maps username → creator, caption → caption, a
  wiki+ thumbnail redirect → `thumbnailUrl`. Instagram joins the B→{C|D} flow YouTube/TikTok use.
- **Thumbnail redirect.** `GET /api/thumb/instagram/<code>` looks up the current thumbnail from
  the embed page and **302-redirects** the browser to Instagram's CDN (a reference, never hosted),
  cached so a thumbnail costs at most one embed-page fetch per shortcode per window.
- **Existing clips.** Every Instagram clip gets the redirect thumbnail at read time, and a
  deploy-time, idempotent backfill upgrades stored placeholder clips ("Unresolved Instagram clip" +
  "Creator not resolved") to their resolved details.

## Acceptance criteria

- **AC1 — resolve.** For a live Instagram link, `resolveOEmbedAction` returns `ok: true` with
  `authorName` = the username, `authorUrl` = `https://www.instagram.com/<username>/`, `title` = the
  caption text (entity-decoded, tags/links flattened to text, whitespace collapsed, a trailing
  hashtag run removed, capped at 300 chars), and `thumbnailUrl` = `/api/thumb/instagram/<code>`.
- **AC2 — honest failure.** An `EmbedBroken` page, non-2xx, timeout, network error, or a page with
  no valid username returns `{ ok: false, reason: "failed" }` (state D — Try again / Add anyway),
  never a fabricated credit. A post with a username but an empty caption resolves with the caption
  "Instagram post by @<username>" (see CURATION §5.5 Instagram rule).
- **AC3 — credit.** A resolved Instagram clip stores `creator.name` = username, `creator.handle` =
  `@username`, `creator.url` = the profile URL; the add modal shows the resolved preview (state C).
  The eyebrow reads "Resolved via Instagram" for Instagram (the "oEmbed" wording is reserved for
  oEmbed providers).
- **AC4 — thumbnail route.** `/api/thumb/instagram/<code>` validates the shortcode
  (`[A-Za-z0-9_-]{1,64}`, else 404), fetches only `https://www.instagram.com/p/<code>/embed/`, and
  302s only to an `https:` URL on `*.cdninstagram.com` or `*.fbcdn.net` (else 404 — no open
  redirect). Success carries `Cache-Control: public, max-age=21600`; failure a short-lived 404.
- **AC5 — thumbnails everywhere.** `parseVideoUrl` yields the redirect `thumbnailUrl` for every
  Instagram link; the server re-derives it on write; `rowToClip` supplies it for an Instagram clip
  stored without one. A failing thumbnail falls back to the gradient (existing `onError`).
- **AC6 — backfill.** The migrate one-shot upgrades each stored Instagram placeholder clip (exact
  placeholder caption + creator name) whose post resolves, updating only caption, creator
  name/handle/url, and thumbnail. It is idempotent, never throws (a failure logs and leaves the row),
  and never blocks the deploy (bounded per-fetch timeout, at most 50 rows per run).
- **AC7 — nothing loads Instagram on render beyond the thumbnail.** The iframe still loads only on
  click; the thumbnail `<img>` stays `loading="lazy"`.

## Out of scope

- The Meta-token oEmbed integration; a curator "re-fetch details" button; Instagram display names
  (the embed page carries only the username); orientation detection (Instagram defaults vertical).

## Success metric

Every live Instagram clip on a Topic page shows a thumbnail, a real caption, and a linked creator
credit.

## Product follow-ups / assumptions

- **Assumption:** upgrading a curator's "Add anyway" placeholder to real resolved details is
  strictly better for the curator and reader; the curator's context note, stance, and accuracy
  flag are untouched.
- **Follow-up:** the embed page is an unversioned HTML surface — if Instagram changes its markup,
  resolution fails honestly to state D; monitor and revisit the Meta-token path.
