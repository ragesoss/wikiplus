# Design — Article-embedded video rendering

**Slug:** `article-video` · **Spec:** `docs/specs/article-video.md` · **Lane:** Standard.

Governing principle: **the article column is a faithful Wikipedia article.** A video is just another
Commons media figure — it renders with the *same* figure chrome as an image, using Wikipedia's own
native `<video>` player. No Indigo Press bleed, no bespoke player, no gold. (Contrast the plus-side
curated clips, which use the oEmbed facade; that treatment is deliberately **not** used here.)

## Personas & stories served

- **The reader** (lands on a Topic page to learn). *"As a reader, when Wikipedia shows a video in the
  article, I want to see and play that same video in place, so the article column feels like the real
  article and I don't hit a blank gap."*
- **The bandwidth-conscious / metered reader.** *"As a reader on mobile data, I don't want a video to
  download until I choose to watch it."* → satisfied by `preload="none"` (poster-only at rest).

## Layout & component

Parsoid wraps an article video in the identical `<figure typeof="mw:File/Thumb">` it uses for images
(a `<span>` wraps the `<video>`, a `<figcaption>` follows). It therefore inherits the existing
`figure.wikifig` treatment with **no new component**:

- Right-floated figure, `width: 300px`, `max-width: 42%`, thin `--article-rule` border + box
  background + 4px padding, caption below in muted small text — exactly as image figures.
- The `<video>` fills the figure: `width: 100%; height: auto; display: block` (mirrors
  `figure.wikifig img`). Its intrinsic aspect ratio (from the poster / first source) drives height, so
  there is no fixed-height letterbox and no overflow. The inline `<span>` Parsoid wraps the video in is
  set to `display: block` so it doesn't shrink-wrap the player.

## States

| State | What the reader sees | Notes |
|---|---|---|
| **At rest (default)** | The **poster image** fills the figure, with the browser's native play affordance and controls. **Zero video bytes loaded** (`preload="none"`). | This is the click-to-load facade, native. Only the poster JPG (from `//upload.wikimedia.org/…/…jpg`, https-upgraded) is fetched. |
| **Playing** | Reader activates native play → browser loads the first codec it supports from the `<source>` list → inline playback with native controls (play/pause, scrub, volume, fullscreen). | Multiple transcodes preserved (Theora/ogv, VP9/webm, MJPEG) so every modern browser has a playable source; VP9/webm is the universal fallback. |
| **Unsupported / load error** | Native browser media-error indicator inside the figure. | Faithful to native; multi-source markup makes this rare. Not a custom error card. |
| **No JavaScript** | Fully functional — native `<video controls>` needs no app JS (unlike the plus facade). | |
| **Caption** | `<figcaption>` renders below the player (e.g. "Der Alpabzug", "Video summary of polio (Script)"), including any wikilink in the caption. | Unchanged figure-caption styling. |

## Responsive behavior

Web-first, responsive. The video figure uses the **same** responsive rules as image figures — it
floats right at `max-width: 42%` of the article column and its width tracks the column, so it scales
down cleanly on tablet and mobile with the article text wrapping alongside, and never causes a
horizontal scroll. (Whatever mobile article-render rules already govern image figures govern video
identically — one code path, faithful.)

## Accessibility (baseline, not a pass)

- **Keyboard + AT:** native `<video controls>` is keyboard-operable and exposes labeled controls to
  screen readers by the platform — no custom controls to make accessible.
- **Captions:** the subtitles `<track>` is preserved so captions are available where the browser
  loads them (cross-origin VTT loading is a logged follow-up, not required for "working").
- **Poster + caption** give a non-playing description of the media; the caption is real text.
- **No color-only signal, no motion autoplay:** nothing autoplays; the reader initiates all motion.
- **AA contrast** is a native-control concern owned by the browser; our chrome (border, caption)
  reuses the article palette already meeting AA.

## Build notes for Development

- Permit `<video>/<audio>/<source>/<track>` + inert control/presentational attrs
  (`poster`, `controls`, `preload`, `type`, `kind`, `srclang`, `label`) through the sanitizer;
  keep width/height, class, id, src already allowed. **No** `on*`, **no** `autoplay`.
- https-upgrade protocol-relative `poster` and `<source src>` in the same post-sanitize pass that
  already upgrades image `src`.
- Add the `.wiki-body figure.wikifig video` (and the `> span { display:block }`) CSS beside the
  existing `figure.wikifig img` rule.

## Out of scope (design)

Custom player chrome, a poster-overlay play button, autoplay/hover-preview, and cross-origin caption
loading. The design intent is *native and faithful*, so the absence of bespoke chrome is correct.
