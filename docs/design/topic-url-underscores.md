# Design spec: Topic URLs use underscores for spaces (mirror Wikipedia)

**Issue:** [#11](https://github.com/ragesoss/wikiplus/issues/11) · **Type:** build (URL-encoding correctness fix)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/topic-url-underscores.md`
**Feeds:** Development (build) · **Evaluated by:** UX (built-UI pass) + QA & Review (correctness)

---

## Framing — proportionate scope

This is a **URL-encoding correctness fix**, not a new screen, component, or flow. There is
**no new visual UI**: no new states, no new microcopy, no layout or responsive change. The only
thing a user perceives is the *string in the address bar* and the *destination of a wikilink*.
This spec writes the small-but-real user-facing contract for that change and confirms it against
the committed design system. It deliberately invents nothing the feature does not introduce.

The user-visible surface maps to three Product acceptance criteria: **AC2** (address bar reads
underscores, not `%20`), **AC8** (wikilinks land on the underscore URL), and **AC9** (legacy
`%20` URLs still resolve). The rest of the Product ACs (AC1, AC3–AC7, AC10–AC12) are
encoding/round-trip correctness that QA verifies in code; they have no separate user-facing
surface beyond what AC2/AC8/AC9 already cover.

---

## Personas & stories served

Two existing personas, no new ones:

- **The reader who shares / reads / pastes a Topic URL.** They expect a wiki+ Topic URL to look
  and behave like a Wikipedia URL — because Topic pages are explicitly modeled on
  `/wiki/<Title>` (`docs/TOPIC_PAGE_DESIGN.md`, "two worlds"; `docs/ARCHITECTURE.md`,
  internal-link resolution).
  - *As a reader, when I land on a multi-word Topic, I want the address bar to read*
    `/topic/San_Francisco/` *like Wikipedia does — not* `/topic/San%20Francisco/` *— so the URL is*
    *legible, recognizable as "the same article as on Wikipedia," and clean to read aloud or paste*
    *into a chat.* (AC2)
  - *As a reader, when someone sends me a* `/topic/San_Francisco/` *link (or I paste one), I want it*
    *to open the right Topic.* (AC9 — and forward-canonical AC2/AC8)

- **The reader who clicks a wikilink inside a rendered article.** wiki+ rewrites article
  wikilinks to internal Topic routes (`docs/TOPIC_PAGE_DESIGN.md`, implementation note;
  `lib/wiki/article.ts` `rewriteLinks`).
  - *As a reader, when I click a wikilink to a multi-word article, I want to land on*
    `/topic/Two_Words/` *— a clean, Wikipedia-shaped URL — while the link still reads as the*
    *human "Two Words" to my eyes and to a screen reader.* (AC8)

These stories feed Product's acceptance criteria; they are not duplicated as criteria here.

---

## User-visible surface (the contract)

What actually changes for a user — and nothing else does:

| # | What the user sees / does | Tied to |
|---|---|---|
| a | **Address bar reads underscores.** Navigating to a multi-word Topic (via in-app `<Link>` / `router`) the URL bar shows `/topic/San_Francisco/`. No `%20` for the space. Single-word titles (`/topic/Photosynthesis/`) are unchanged. | AC2 |
| b | **Wikilinks point to the underscore URL.** A hovered wikilink to a multi-word article shows `…/topic/Two_Words/` in the browser's status/preview, and clicking navigates there. The **visible link text stays the human-readable title** ("Two Words"). | AC8 |
| c | **Shared / pasted underscore URLs resolve.** A hard load of `/topic/San_Francisco/` opens the correct Topic — same article + curated plus rail as in-app navigation. | (AC4, surfaced via b/c) |
| d | **Legacy `%20` URLs still resolve.** A hard load of an older `/topic/San%20Francisco/` link opens the same Topic; it is a working entry point, just not the form the app emits going forward. | AC9 |

Underscores appear **only in the URL string**. They never appear in the article title heading,
in visible wikilink text, in the plus-rail, or in any other on-page text — those continue to read
the space-form title ("San Francisco").

---

## States

Enumerated for completeness; the change touches the URL string in two of them and adds no new state.

1. **Normal in-app navigation (`<Link>` / `router.push`/`replace`).** The href is built from
   `topicHref(title)`; the address bar now reads the underscore form. No visual change beyond the
   URL string. (AC2)
2. **Hard load / refresh / pasted underscore URL.** The path is parsed by `titleFromPathname`,
   which yields the space-form title; the existing loading → ready flow runs exactly as today.
   Same loading skeleton, same populated layout. (AC4)
3. **Legacy `%20` URL (back-compat).** Parsed to the same space-form title; resolves identically to
   the underscore form. No distinct UI — the user cannot tell which form they entered with once the
   page is loaded. (AC9)
4. **Title that does not resolve (error / not-found).** **Unchanged by this work.** A title that
   cannot be resolved still shows the **existing** resolve-error UI — the current "Topic not found.
   [Back home]" message (`app/topic/TopicView.tsx`, the `resolveError` branch) — *not* a new error
   state. The encoding change must not introduce a new error surface, alter that copy, or change
   when it triggers. Likewise the **article-fetch error** (`ArticleError` with the Wikipedia
   fall-through link) is untouched.

**No loading / empty / skeleton UI changes.** The loading skeleton, the empty-Topic identity
header, and the populated two-column layout are all exactly as in `docs/TOPIC_PAGE_DESIGN.md`.

---

## Accessibility

The committed accessibility baseline (AA contrast, visible focus, keyboard support, text-labeled
signals) is **unaffected and must not regress**. The specific a11y points for a URL change:

- **Link text and accessible name stay the human space-form title.** A rewritten wikilink's
  visible text and its `data-topic-title` attribute carry the clean **space-form** title
  (`lib/wiki/article.ts` already sets `data-topic-title` to the decoded title). A screen reader
  must announce the link as **"San Francisco," not "San_Francisco" / "San underscore Francisco."**
  Underscores live in the `href` only. The same holds for any `aria-label` / accessible name on a
  Topic link.
- **No underscores in visible text.** Underscores must not leak into the article title heading,
  section headings, wikilink text, the plus-rail, breadcrumbs, or any visible string. (Microcopy
  section confirms there is no such string.)
- **No contrast / focus / keyboard change.** Links keep their existing focus ring and keyboard
  activation; nothing about this change alters color, contrast, focus order, or tab behavior. The
  `data-topic-title` click interceptor (client-side routing) continues to work for
  keyboard-activated links, not just mouse clicks — keyboard parity must not regress.

There is no color-only signal involved in this change.

---

## Microcopy

**None new.** This change introduces no user-facing string. The contract is specifically that
**no visible string ever shows an underscore-for-space** — the underscore exists only in the URL
path segment, which is not product copy. Existing copy (title, attribution "From Wikipedia ·
CC BY-SA 4.0," the "Topic not found." / "Back home" error, the `ArticleError` text) is unchanged.

---

## Responsive

**No layout or responsive impact.** The change is confined to a URL string and a wikilink
destination; it touches no element box, breakpoint, column, or sticky behavior. The web-first,
responsive two-column → stacked behavior of the Topic page (`docs/TOPIC_PAGE_DESIGN.md`) is
untouched at every breakpoint.

---

## Hand-off to Development

Build per the Product spec `docs/specs/topic-url-underscores.md` (AC1–AC12). The UX contract this
spec adds on top of that:

- The **visible link text and `data-topic-title` must remain the space-form title** — underscores
  belong to the `href` only (a11y requirement, ties to AC8).
- **Do not add any new state, error UI, microcopy, or layout.** The not-found / resolve-error and
  article-fetch-error surfaces stay exactly as they are today.
- No visible string anywhere may show an underscore-for-space.

## Evaluation (UX built-UI pass, after Development)

Judge against this spec + the stories. Confirm:

1. Address bar reads `/topic/San_Francisco/` (no `%20`) after in-app navigation to a multi-word
   Topic (AC2); single-word URLs unchanged.
2. A wikilink to a multi-word article navigates to the underscore URL; its **visible text and
   screen-reader announcement stay the space-form title** (AC8 + a11y).
3. A pasted underscore URL and a legacy `%20` URL both load the correct Topic with no new or
   altered UI (AC4 / AC9).
4. The not-found and article-error states are visually and behaviorally identical to before.
5. No underscore-for-space appears in any visible on-page text; focus/keyboard/contrast unchanged.

A pass returns to Operations via the loop; any design defect routes back to **Development**.
