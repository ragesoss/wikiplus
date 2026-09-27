# Design Spec: Resolve Instagram clip details

- **Status:** v1, committed (Phase 2 / UX, build-loop run "improve Instagram rendering"). Written
  **before** implementation — the contract Development builds against.
- **Inputs:** `docs/specs/instagram-resolve.md` (AC1–AC7), `docs/CURATION_STANDARD.md` §5.5
  (Instagram rule), `docs/design/add-link-metadata.md` (the add-by-link A→G state machine),
  `docs/design/instagram-reels.md` (in-app Reel playback).
- **Surfaces changed:** the Add modal (Instagram now takes B→{C|D}); every clip thumbnail surface
  (rail card, General strip/hero, mobile dock, Recent feed, profile) gains a real Instagram thumbnail
  through `thumbnailUrl` — no component layout changes.

## 1. Stories

- **Mei — curator.** Pastes a Reel link and sees the real caption, `@creator`, and thumbnail before
  she writes her note — the same confidence she gets with YouTube and TikTok.
- **Devi — reader.** Scans a Topic page and sees what the Reel is and who made it before deciding to
  play it; the card no longer looks like a broken placeholder.

## 2. Add-modal flow (Instagram)

| State | Behavior |
|---|---|
| A entry | Unchanged (label/placeholder already name Instagram Reels). |
| B resolving | Same spinner + "Fetching video details…" as YouTube/TikTok. |
| C resolved | Resolved preview: thumbnail (the redirect URL; gradient on `onError`), `INSTAGRAM` pill, eyebrow **"Resolved via Instagram"**, caption (2-line clamp), credit `tailbitpets` / `@tailbitpets · Instagram` linking to the profile in a new tab. |
| D failed | Existing "Couldn't fetch video details" state with Try again / Add anyway / Cancel — for a private/deleted post, a markup change, or a timeout. |
| E Add anyway | Existing honest placeholder (Unresolved Instagram clip / Creator not resolved), now **with** the redirect thumbnail when available. |
| G unsupported | No longer reached by Instagram (remains for `other`). |

## 3. Card rendering

- Caption: the post caption (flattened text, trailing hashtags dropped, ≤300 chars); existing clamp
  rules apply per surface.
- Credit: name = username, `@username · Instagram`, linked to the profile (existing ClipCard credit).
- Thumbnail: `object-cover` in the existing 9:16 / 3:2 / 16:9 frames with the indigo duotone
  overlay; the `INSTAGRAM` pill and play affordance unchanged. Failure (private post, Instagram
  down) → the existing gradient; no error state is added.

## 4. States

- **Loading:** the thumbnail `<img>` is `loading="lazy"`; before it loads the frame shows the
  gradient behind it (existing).
- **Empty caption:** "Instagram post by @username".
- **Error:** thumbnail 404 → gradient; resolve failure → state D.

## 5. Accessibility

- Thumbnail stays decorative (`alt=""`); the button's accessible name is `Play: <caption>`.
- The resolved announcement (`role="status"`) reads "Video details resolved: <caption> by <username>."
- The eyebrow is text, not color; pill named in words; AA contrast unchanged (existing tokens).

## 6. Responsive

No layout changes; the existing per-variant frames and caps govern every width.
