# Design Spec: Instagram Reels support

- **Status:** v1, committed (Phase 2 / UX, build-loop run "add Instagram Reels support"). Written
  **before** implementation — the contract Development builds against.
- **Lane:** Standard (UI + logic; no schema, auth, secret, or policy change).
- **Inputs:** owner prompt ("please add instagram reels support to wikiplus"), `docs/VISION.md`
  (short vertical clips — TikTok / **Instagram Reels** / YouTube Shorts — are the primary focus),
  `docs/ARCHITECTURE.md` (embed-never-host, click-to-load facade, Instagram oEmbed needs a Meta app
  token), `docs/CURATION_STANDARD.md` §5.5 / **C10** (unresolved credit reads as unresolved),
  `docs/design/add-link-metadata.md` (the add-by-link A→G state machine this extends).

## 0. Acceptance criteria (the Phase-4 basis)

- **AC1 — every Reel share form parses.** `parseVideoUrl` recognizes Instagram links on
  `instagram.com`, `www.instagram.com`, and `m.instagram.com` in the forms
  `/reel/<code>`, `/reels/<code>`, `/p/<code>`, `/tv/<code>`, and the username-prefixed
  `/<user>/reel/<code>` / `/<user>/p/<code>`, with or without a trailing slash or share query
  (`?igsh=…`, `?utm_source=…`). Result: `platform: "instagram"`, `videoId: <code>`.
- **AC2 — a canonical embed + watch URL.** The embed URL is Instagram's official embed page,
  `https://www.instagram.com/reel/<code>/embed/` for reel/reels forms and
  `https://www.instagram.com/p/<code>/embed/` for p/tv forms. The parse also yields a canonical,
  tracking-free watch URL (`https://www.instagram.com/reel/<code>/` or `/p/<code>/`) that the add
  flow stores as `watchUrl` instead of the pasted link.
- **AC3 — shortcode is validated.** Only `[A-Za-z0-9_-]+` shortcodes are accepted; anything else
  (encoded characters, an empty code, a profile URL, `/explore/`, `/stories/`) is unrecognized
  (state F), so no untrusted characters are interpolated into an iframe `src`.
- **AC4 — Reels play in wiki+.** A curated Instagram clip's thumbnail opens the in-app player
  (desktop PlayerModal / mobile MobilePlayerDock / profile player) with the Instagram embed iframe,
  exactly as a YouTube clip does — no new tab. The thumbnail's accessible name reads
  `Play: <caption>` and the "opens ↗" tag is not shown. A clip with no `embedUrl`, and every
  TikTok/other clip, keeps the current link-out behavior.
- **AC5 — the Add modal advertises Reels.** The link label reads "Paste a YouTube, TikTok, or
  Instagram Reels link"; the placeholder shows an Instagram example; the unrecognized-link alert
  reads "Unrecognized link — paste a YouTube, TikTok, or Instagram Reels URL."
- **AC6 — honest unresolved credit (C10 unchanged).** An Instagram link still goes straight to the
  unresolved placeholder (state G) with no network fetch; the stored clip has the "Unresolved
  Instagram clip" caption, the non-linked "Creator not resolved" credit, no handle, orientation
  `vertical`, and the canonical `watchUrl` + embed URL. The state-G limitation line names the reason
  plainly: "Instagram doesn't share video details with wiki+ yet — you can still add and curate this
  Reel, and it plays from Instagram."

## 1. Personas & stories

- **Mei — curator.** Finds a great explainer Reel on her phone, taps Share → Copy link, and pastes
  `https://www.instagram.com/reel/C9xYz…/?igsh=…`. Today a `/reels/` link is rejected as
  unrecognized and the modal tells her only YouTube/TikTok work. She needs the link accepted, a clear
  statement of what wiki+ can and can't fetch, and a clip that plays for readers.
- **Devi — reader.** Taps a Reel on a Topic page and watches it right beside the article, the same
  way YouTube clips play — without being bounced to Instagram in a new tab and losing her place.

## 2. Flows & states

The add-by-link state machine (A entry → F unrecognized / G unsupported placeholder) is unchanged;
Instagram continues to take the G arm. Only copy and the parse change.

| State | Instagram behavior |
|---|---|
| A entry | Label + placeholder name Instagram Reels (AC5). |
| F unrecognized | Profile/explore/story/malformed Instagram links land here with the updated alert copy. |
| G placeholder | Dashed "Not resolved" preview, "Unresolved Instagram clip", "Creator not resolved"; the limitation line from AC6. Focus moves to the Context-note field (unchanged). |
| Curated card | Instagram pill (existing `#A1306B`, white text ≥ AA), gradient thumbnail (no token-free thumbnail exists), play affordance, **no** "opens ↗" tag. |
| Playing | Desktop: PlayerModal with a 9:16 frame capped at 60vh (existing vertical frame). Mobile: MobilePlayerDock vertical frame. The Instagram embed page renders its own header/footer chrome and "View on Instagram" link — that is the platform's credit + link-out, kept intact. |
| Error | If Instagram refuses the embed (deleted/private Reel) the iframe shows Instagram's own unavailable notice; the card's outbound watch link and the Instagram pill remain. No wiki+ error state is added. |

Loading: the iframe loads only on click (click-to-load facade — nothing from Instagram loads on page
render).

## 3. Microcopy

- Link label: **Paste a YouTube, TikTok, or Instagram Reels link**
- Placeholder: `https://youtu.be/… or https://www.instagram.com/reel/…`
- Unrecognized: **Unrecognized link — paste a YouTube, TikTok, or Instagram Reels URL.**
- State-G limitation (Instagram): **Instagram doesn't share video details with wiki+ yet — you can
  still add and curate this Reel, and it plays from Instagram.** Other unsupported platforms keep
  the generic "We don't fetch {Platform} video details yet" line.

## 4. Responsive & accessibility

- No layout changes; vertical frames use the established 9:16 caps (card `max-h-72`, modal 60vh,
  dock vertical frame).
- Thumbnail button keeps a text accessible name (`Play: …`) and visible focus; platform named in
  words on the pill (never color alone).
- The iframe carries `title={caption}` (existing).

## 5. Out of scope / follow-ups (Product)

- **Resolved Instagram metadata** (title/creator/thumbnail) needs a Meta app + oEmbed Read access
  token (owner action + app review) — deferred.
- **URL-derived creator handle** for `/<user>/reel/<code>` links would be a new attribution rule
  (CURATION §5.5) — deferred; the credit stays "Creator not resolved".
- **"Search Instagram" find-more button** — Instagram search is login-walled on the web; deferred.
- **In-app playback for TikTok** — same mechanism would apply; not part of this change.
