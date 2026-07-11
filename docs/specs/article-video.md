# Spec — Article-embedded video rendering

**Feature slug:** `article-video` · **Lane:** Standard · **Owner intent:** "Existing videos in
Wikipedia articles aren't rendering — get them working" (e.g. *Engelberg*, *Polio*).

## Problem

A Wikipedia article can embed a freely-licensed video hosted on Wikimedia Commons. MediaWiki's
TimedMediaHandler renders these as a native HTML `<video>` element (a poster image + multiple
transcoded `<source>` children, optionally a subtitles `<track>`), wrapped in the same `<figure>`
Parsoid uses for images. On the wiki+ Topic page these figures render **empty**: the article
sanitizer's DOMPurify allowlist permits only `<img>` among media, so `<video>`/`<source>`/`<track>`
are stripped, leaving a caption with no player. Readers of *Engelberg*, *Polio*, and any other
article with a video see a blank gap where Wikipedia shows a video.

## User value

A reader on a Topic page sees the **same** encyclopedic video Wikipedia shows, in place, faithful to
the article — reinforcing wiki+'s promise that the article column is the real Wikipedia article.

## Scope

Restore rendering of article-embedded Commons video using Wikipedia's **native** markup:

- Permit `<video>`, `<audio>`, `<source>`, `<track>` and their inert presentational/control
  attributes through the sanitizer, **without** widening the XSS surface (no event handlers, no
  autoplay, URL attributes still URI-validated).
- Keep the video's `preload="none"` so **no video bytes load until the reader presses play** — the
  poster image is the only network cost at rest. This is the click-to-load facade, native.
- Preserve **all** `<source>` children so the browser picks a codec it can play (Commons ships
  Theora/ogv + VP9/webm + MJPEG transcodes).
- https-upgrade protocol-relative `//upload.wikimedia.org` URLs on `poster` and `<source src>`.
- Style the video inside `.wiki-body` figures like an article image (fits the column, height auto,
  responsive), with its native controls.

## Acceptance criteria (testable)

1. **Video survives sanitize.** Given Parsoid HTML containing a TimedMediaHandler `<figure>` with a
   `<video>` + `<source>` children, the sanitized output contains a `<video>` element with its
   `<source>` children (not an empty figure). (Covers *Engelberg*/*Polio* markup.)
2. **No autoload.** The rendered `<video>` retains `preload="none"` and `controls`; the `poster`
   attribute is preserved so the poster image shows before play.
3. **Codec choice preserved.** Every `<source>` from the source markup survives with its `src` and
   `type` intact.
4. **No mixed content.** Protocol-relative `//upload.wikimedia.org` values on `poster` and
   `<source src>` are rewritten to `https://…`.
5. **No new XSS surface (X4 holds).**
   a. An `on*` event-handler attribute on `<video>`/`<source>`/`<track>` (e.g. `onerror`,
      `onloadstart`) is stripped.
   b. `autoplay` is not present on the rendered element even if the input markup carried it.
   c. A `javascript:` (or other non-allowlisted-scheme) `src` on `<source>`/`<track>` is dropped.
   d. All pre-existing sanitizer security tests still pass (iframe/object/embed/form, svg/math,
      `<style>`, inline `style`, the inert data-URI `<img>` case).
6. **Faithful layout.** The `<video>` is styled within `.wiki-body`/`figure.wikifig` to fit the
   article column width (max-width 100%, height auto, block), so it does not overflow on mobile,
   tablet, or desktop, and sits above its `<figcaption>` like an image figure.

## Out of scope

- Any custom player chrome / the "plus"-side oEmbed facade styling (owner chose native faithful).
- The `<audio>` case has no repro article in this task but is permitted for free by the same
  allowlist change (a namespace player element); no bespoke audio styling is required.
- Subtitles: preserving the `<track>` element is in scope (criterion 5c covers its `src` safety);
  making cross-origin VTT captions actually load (a `crossorigin` handshake with Commons) is a
  **nice-to-have**, logged as a follow-up, not required for "working."
- Server-side/ISR caching of article HTML (deferred read-path — unchanged here).

## Success metric

The seeded/repro Topic articles that embed a video (*Engelberg*, *Polio*) show a playable poster +
video in the article column on the live site, across mobile/tablet/desktop, with no mixed-content or
console-blocked media, and the sanitizer security suite stays green.
