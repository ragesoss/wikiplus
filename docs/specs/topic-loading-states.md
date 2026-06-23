# Spec — Topic page loading states (issue #146)

- **Role:** Product · **Status:** spec for build · **Issue:** [#146](https://github.com/ragesoss/wikiplus/issues/146) (`type: bug`, severity low)
- **Feeds:** UX (loading/empty/error flow + the projector loading treatment) → Development → QA & Review + UX evaluation
- **Reads:** `docs/VISION.md`, `docs/ARCHITECTURE.md` (Prototype phase), `docs/TOPIC_PAGE_DESIGN.md`
  (§"Three states", §"Two infoboxes"), `docs/VISUAL_IDENTITY.md` §2 (the projector metaphor)

## Problem

The Topic page is janky on load and shows **misleading "empty" copy while content is still
loading**. The owner's report: a screenshot where the Wikipedia article content failed to load
altogether, yet the page was stuck showing a "no suggestions" message — which is nonsensical if the
article never loaded. The owner asks for "a general overhaul of the loading states, ideally built
around the projector concept (but not slowing down the settled render for anyone on a fast enough
connection)."

### Root cause (investigated; not re-derived here)

`TopicView` (`app/topic/TopicView.tsx`), rendered under a trivial Suspense fallback in
`app/topic/[[...slug]]/page.tsx`, runs **three independent async flows with no coordination**:

- `fetchState` (`"loading" | "ready" | "error"`) — the Wikipedia article (`lib/wiki/article.ts`),
  rendered via `ArticleSkeleton` / `ArticleLeadBlock` / `ArticleError` in `components/topic/ArticleBody.tsx`.
- `storeReady` (boolean) — gates the wiki+ panel, General band, TOC, and the plus rail. It flips to
  `true` **even on a store error** (so the rail shows an honest line, not a permanent skeleton).
- `candidatesLoading` (boolean) — the live candidate (suggestion) search.

The "no suggestions" line (`TopicView.tsx` ~line 1962) renders whenever
`!hasCurated && !candidatesLoading && no section candidates && no general candidates`. That
condition is **blind to `fetchState`**: it does not require the candidate search to have *started*
in a coordinated way with the rest of the page, and it never consults whether the article loaded or
errored. So:

- During **load** (a), before the candidate search has resolved both pools, the empty copy can flash.
- During an **article error** (c), the reader sees the `ArticleError` card **and** a "no suggestions"
  empty message at once — a still-loading/failed topic is visually indistinguishable from a true
  empty topic.

## Goal

Coordinate the three flows so the page presents **one honest, projector-styled loading experience**,
and so empty-state copy appears **only** when the relevant data has genuinely settled — never during
load, never as a side effect of an article error. Keep the settled render instant for fast
connections.

## Three conditions that must be visually distinct

These collapse into one today. They are genuinely different and must each read as themselves:

- **(a) Loading** — data for a region is still pending. The reader should see the **projector
  loading treatment** for that region, never empty/error copy.
- **(b) Loaded-and-genuinely-empty** — a real topic that has settled with **zero curated clips and
  zero remaining suggestions**. This is the legitimate empty/bootstrap state
  (`docs/TOPIC_PAGE_DESIGN.md` §"Three states" → *empty*; reference mockup
  `mockups/inline-indigo-empty-v3-declutter.html`). Its honest "none yet / weigh-in" copy belongs
  **here only**.
- **(c) Load failed / errored** — the article fetch failed (`fetchState === "error"`), or the
  plus-side store read failed (`storeError`). The reader sees the relevant **error treatment**
  (`ArticleError` for the article; the wiki+ panel's "couldn't load stats" floor for the store), and
  must **not** also see "no suggestions"/"no videos curated yet" empty copy.

The misleading-empty bug is showing **(b)'s copy during (a) or (c)**. The fix is to gate (b)'s copy
on settlement and on the absence of the relevant error.

## Scope

The **Topic page** loading, empty, and error UX, across its two regions:

1. **Article column** — `loading` / `ready` / `error` (Wikipedia fetch).
2. **Plus side** — the wiki+ panel, TOC, General band, and rail: the store read (`storeReady` /
   `storeError`) and the candidate search (`candidatesLoading`) and their settled empty/populated states.

Coordination is a **presentation/state-derivation change in `TopicView` + the components it renders**
and the loading treatment's visual design — not a data-model or read-path change.

### Out of scope

- The **production read-path** (ISR/Redis shared cache, the Cloudflare edge cache) — deferred per
  `ARCHITECTURE.md` (Prototype phase). This spec is about the **client-side** loading/empty/error UX
  over the data the client already fetches; it does not introduce or depend on server caching.
- **Changing what counts as "curated"**, the candidate pipeline, the three-state derivation
  (empty/mixed/fully-curated), or any chip/stance/accuracy semantics (Curation/Editorial owns those).
- The **home page** and any non-Topic surface. (If the projector loading treatment is built as a
  reusable piece, reuse elsewhere is a later decision, not this issue.)
- The full **`HeaderProjector` wordmark** redesign — this spec consumes the projector *identity* as
  the loading metaphor; it does not change the header mark (`VISUAL_IDENTITY.md` is unchanged).
- Adding a **retry/backoff** mechanism beyond what exists (the article's "Try again" already exists);
  loading-state honesty is the goal, not new fetch logic.

## Acceptance criteria

Each is verifiable by a test (unit/integration over `TopicView`'s derived state) or by a screenshot
in the baseline gallery (`docs/design/ui-screenshots/`, scene catalog `e2e/screenshots/catalog.ts`).

1. **No empty copy before the relevant data settles.** The "no suggestions"/"no videos curated yet"
   empty-state copy (and the empty wiki+ panel volume block) does **not** render while the data it
   describes is still pending. Specifically, the suggestion empty line renders only when the candidate
   search has **settled** (not `candidatesLoading`) **and** the store has settled (`storeReady`) **and**
   both candidate pools are genuinely zero. *(Test: with `candidatesLoading === true` or
   `storeReady === false`, the "no suggestions" copy is absent; screenshot: a loading Topic shows the
   projector loading treatment, not empty copy.)*

2. **An article error never surfaces as empty-suggestions copy.** When `fetchState === "error"`, the
   page shows the article error treatment (`ArticleError`) and **does not** render any
   "no suggestions"/"empty topic" copy as a *consequence of the article failing*. The plus side
   reflects its **own** state independently: if the plus store/candidates genuinely settled empty, the
   legitimate (b) empty copy may show **on the plus side**, but it is never presented as the page's
   verdict on a topic whose article failed to load — and the article-error region itself carries no
   suggestion copy. *(Test: `fetchState === "error"` + non-settled/erroring plus state ⇒ no
   "no suggestions" line; screenshot: the reported failure case shows the article error card without a
   contradictory empty message.)*

3. **The three conditions are visually distinct.** A screenshot exists for each of: (a) a Topic still
   loading (projector loading treatment in both regions), (b) a settled genuinely-empty Topic
   (legitimate empty/bootstrap copy per `mockups/inline-indigo-empty-v3-declutter.html`), and (c) an
   article-load-failure Topic (article error card; no contradictory empty copy). The three are
   distinguishable from one another. *(Verify: three catalog scenes, captured in the gallery.)*

4. **Loading is built around the projector concept.** The loading treatment for the Topic page uses
   the **projector / beam identity** (`VISUAL_IDENTITY.md` §2 — the brand's light/projection
   metaphor), not a generic spinner. The exact visual is **UX's to design**; this criterion requires
   that the chosen loading affordance reads as part of the projector/Indigo Press identity (e.g. a
   beam/illumination motif) rather than an off-the-shelf spinner. *(Verify: UX evaluation against the
   design spec; screenshot of the loading scene shows the projector-derived treatment.)*

5. **Fast connections feel instant — no artificial delay.** The settled render is **not** slowed for
   anyone. No minimum-display timer, no forced delay, no "show the loader for at least N ms" is
   introduced. A skeleton/loading treatment appears **only if** the relevant data is actually still
   pending at render time; when data resolves quickly (e.g. a warm/fast load), the reader sees the
   settled content with no loading flash gating it. *(Test: when a region's data is already resolved on
   first render, no loading treatment for that region mounts; code review confirms no artificial-delay
   timer was added.)*

6. **Loading is announced to assistive tech.** Each loading region exposes a busy/announced state:
   `aria-busy="true"` on the loading container and a polite live announcement (`role="status"` /
   `aria-live="polite"`) so a screen-reader user is told content is loading and told when it has
   loaded — without the announcement firing as a contradictory "no suggestions" message during load.
   *(Test: the loading containers carry `aria-busy` + an `sr-only` status; the existing
   `ArticleSkeleton`'s `role="status"` pattern is preserved/extended to the plus-side loading.)*

7. **No color-only signals; AA contrast.** No loading, empty, or error state distinguishes itself by
   **color alone** — each carries text and/or shape (the projector treatment is decorative and never
   the sole carrier of "loading"; the announced status text in AC6 carries the meaning). All text in
   the loading/empty/error treatments meets **WCAG AA** contrast on its background (including small
   body text on the indigo `#676EB4` band — small note/empty text stays on the white-panel treatment,
   never bare on the band, per `TOPIC_PAGE_DESIGN.md`). *(Verify: contrast check on the new/changed
   text; UX evaluation.)*

8. **The settled states are unchanged.** Once data has settled, the **empty / mixed / fully-curated**
   renders (`docs/TOPIC_PAGE_DESIGN.md` §"Three states"), the curated/suggested coexistence ordering,
   the no-churn stability contract, and all existing copy are **unchanged** by this work. This issue
   changes only the *loading* and *error-vs-empty disambiguation* behavior, not the settled product.
   *(Test: existing `TopicView` / three-state tests still pass; screenshots of the settled empty,
   mixed, and fully-curated scenes are unchanged.)*

9. **The plus side stays useful when the article errors (preserved).** When the article fails, the
   plus rail/panel still render their own (settled) content per the existing "the curated videos are
   still here on the right" behavior — the article error does not blank the plus side. *(Test:
   `fetchState === "error"` with curated clips present ⇒ the rail still lists those clips.)*

## Success / quality measure

A reader who arrives at a Topic page **never sees copy that contradicts the page's actual state**:
no "no suggestions" while the page is still loading, and no "empty topic" verdict when the article
simply failed to load. Loading reads as the wiki+ projector identity, and a fast connection sees the
settled page with no loading flash. Concretely, the issue is resolved when the reported failure case
(article failed, "no suggestions" shown) can no longer be reproduced, and the three conditions
(loading / genuinely-empty / errored) are each represented by a distinct, honest screenshot in the
baseline gallery.

## Hand-off

- **UX:** design the **projector-based loading treatment** for the Topic page's two regions (article
  column + plus side), and the flow that keeps loading (a), genuine-empty (b), and error (c) visually
  distinct — building from `VISUAL_IDENTITY.md` §2, the three-state model
  (`TOPIC_PAGE_DESIGN.md` §"Three states"), and `mockups/inline-indigo-empty-v3-declutter.html` for
  (b). Specify the announced/`aria-busy` model (AC6) and the AA/no-color-only details (AC7). Honor
  AC5 — the treatment must not impose any minimum display time.
- **Development:** coordinate the three async flows in `TopicView` so empty/error copy is gated on
  settlement and on the relevant error (AC1, AC2), render the UX loading treatment, and **add no
  artificial delay** (AC5). Add the three loading/empty/error scenes to `e2e/screenshots/catalog.ts`
  and refresh the gallery in the same PR.
- **QA & Review:** verify AC1–AC9 (the misleading-empty case is gone; the three conditions are
  distinct; no artificial delay was introduced; a11y + AA hold), with fresh, non-author eyes.
