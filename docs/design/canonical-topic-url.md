# Design spec: Canonicalize the Topic URL + heading to Wikipedia's canonical form

**Issue:** [#23](https://github.com/ragesoss/wikiplus/issues/23) · **Type:** build (routing / title-resolution — no new screen)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/canonical-topic-url.md`
**Feeds:** Development (build) · **Evaluated by:** UX (built-UI pass) + QA & Review (correctness)
**Precedent:** [#11](https://github.com/ragesoss/wikiplus/issues/11) `docs/design/topic-url-underscores.md` and [#13](https://github.com/ragesoss/wikiplus/issues/13) `docs/design/bare-path-redirect.md` (proportionate, no-new-UI routing changes). **Coordinate with:** [#19](https://github.com/ragesoss/wikiplus/issues/19) (not-found for nonexistent titles).

---

## Framing — proportionate scope

This is a **behavioral / routing change with no new screen, component, state, layout, or flow.**
The Topic-page design (`docs/TOPIC_PAGE_DESIGN.md`, reference mockups `mockups/inline-indigo-sync.html`
curated / `inline-indigo-empty-v2.html` empty) is **not redesigned**. The change is confined to two
already-existing user-visible surfaces and one transition:

1. **The address bar** — snaps from the typed/pasted form to Wikipedia's canonical form
   (`/topic/calvin_cycle/` → `/topic/Calvin_cycle/`; `/topic/jfk/` → `/topic/John_F._Kennedy/`).
2. **The article heading** — the `<h1>` (`ArticleLeadBlock`, `components/topic/ArticleBody.tsx`
   line 27) and the compact header echo (`TopicHeader articleTitle=…`, `TopicView.tsx` line 526)
   show Wikipedia's **rendered display title** (e.g. "bell hooks", lowercase) instead of the URL's
   mechanical capitalization.
3. **The arrival transition** — the snap from the typed URL/heading to the canonical pair must be
   a smooth settle into the existing loading→populated flow, never a jarring swap, flicker, or
   layout shift.

This spec invents nothing the feature does not introduce. It writes the buildable contract for how
the snap should *feel*, confirms the states the change routes into are the right destinations, and
pins the accessibility handling for a client-side URL replace + heading change. Every Product AC
(AC1–AC9) is correctness QA verifies in code; this spec covers the user-facing surface of AC1–AC7
and confirms the "View on Wikipedia" attribution stays correct (scope item 2).

---

## Personas & stories served

Three readings of two existing personas — no new personas.

- **The reader who types or pastes a sloppy URL.** They guess `wikiplus…/topic/calvin_cycle/`, or
  paste a link with a literal space, or remember the lowercase form — the same way
  `en.wikipedia.org/wiki/calvin_cycle` resolves even though it is not the canonical URL.
  - *As a reader who types or pastes a messy Topic URL, I want the address bar to snap to the same
    clean, capitalized, underscore URL Wikipedia would land me on — so the link I end up holding is
    canonical and recognizably "the same article as on Wikipedia."* (AC1, AC2)
  - *As a reader who types a common alias (`jfk`), I want to land on the real topic
    (`John F. Kennedy`) instead of a dead end — "it knew what I meant."* (AC3)

- **The curator who shares a Topic link.** They copy the URL out of the address bar to paste into a
  chat, a class, or a doc.
  - *As a curator, when I copy a wiki+ Topic URL to share, I want it to already be the canonical,
    stable form — not the typo or alias I happened to arrive through — so the link I send is clean
    and durable, and Back doesn't bounce whoever I sent it to through my typo.* (AC2, AC7)

- **The reader who recognizes the article.** They are reading the Topic page and comparing it to
  what they know of the article on Wikipedia.
  - *As a reader, I want the heading to read exactly as the article reads on Wikipedia ("bell
    hooks", lowercase — the author's stylization), not the URL's mechanical "Bell hooks" — so the
    Wiki side of the page is faithful to the encyclopedia it presents.* (AC4)

These stories feed Product's acceptance criteria; they are not duplicated as criteria here.

---

## The title-route arrival flow

A typed/pasted `/topic/<typed>/` enters through the SPA shell. `TopicView` reads the title from the
path (`titleFromPathname`), resolves it (now also fetching the canonical title + display title),
`router.replace`s the URL to the canonical form when it differs, fetches the article, and renders.
The resolution effect lives at `TopicView.tsx` lines 89–123; the heading is `ArticleLeadBlock`
`title=…` (the surface that must switch to the **display** title).

### The required visible sequence (a real, resolvable topic)

1. **Land directly in the existing Topic loading state.** First meaningful paint is the **existing
   loading UI** — `ArticleSkeleton` on the left, the page chrome resolving as on any cold load of
   `/topic/<Title>/` (`TopicView.tsx` line 534). The reader must **never** see the "Topic not
   found." resolve-error copy first (this is the #19 boundary — see *States*).
2. **The heading is the display title from the first time it paints — it does not swap.** The
   masthead `<h1>` and the compact header echo render only once the article fetch is `ready` (they
   are inside the `fetchState === "ready"` branch and the `ArticleLeadBlock`), at which point the
   **display title** is known. There is **no intermediate paint of the typed/canonical title that
   then swaps to the display title.** The reader sees the loading skeleton, then the display-title
   heading — one transition, no jarring text swap, no layout shift. (See *States → loading* for the
   ordering rule Dev must hold.)
3. **The URL settles to the canonical form.** During or before that first meaningful paint, the
   address bar reads the canonical `/topic/<Canonical_Title>/` (the `router.replace` hop; underscore
   form per #11, trailing slash + basePath via `topicHref`/`titleToSlug`). One replace, never a
   push, so **Back** returns to the prior page, not the typed/typo URL.
4. **Resolve + load completes normally.** Skeleton → populated Topic page, identical to a direct
   load of the canonical URL. From the moment the skeleton appears, the experience is
   indistinguishable from having typed the canonical URL.

Net felt experience: **one continuous load that ends on the canonical Topic page with the
Wikipedia-faithful heading.** No flash of typed-then-canonical heading, no flicker of error copy,
no perceptible bounce.

### AC1–AC4 walk-throughs (concrete)

> "Ends at" = the final URL after resolution + `router.replace` settle. Canonical title =
> `pages[].title`; display title = plain-text `pages[].displaytitle`. Live fetch is mocked in tests.

| Input typed/pasted | Resolves to (canonical · display) | Address bar ends at | Heading reads | `router.replace`? |
|---|---|---|---|---|
| **AC1** `/topic/calvin_cycle/` | `Calvin cycle` · `Calvin cycle` | `/topic/Calvin_cycle/` | **Calvin cycle** | Yes (slug differs) |
| **AC2** `/topic/Calvin cycle/` (literal space) | `Calvin cycle` · `Calvin cycle` | `/topic/Calvin_cycle/` (same destination as AC1) | **Calvin cycle** | Yes (slug differs) |
| **AC3** `/topic/jfk/` (alias) | `John F. Kennedy` · `John F. Kennedy` | `/topic/John_F._Kennedy/` | **John F. Kennedy** (the *target's* heading, not "jfk") | Yes (slug differs) |
| **AC4** `/topic/bell_hooks/` | `Bell hooks` · `bell hooks` | `/topic/Bell_hooks/` (capital **B**) | **bell hooks** (lowercase) | Yes (slug differs) |
| **AC5** `/topic/Calvin_cycle/` (already canonical) | `Calvin cycle` · `Calvin cycle` | `/topic/Calvin_cycle/` (unchanged) | **Calvin cycle** | **No** (slug matches) |

The **bell hooks split (AC4) is the visible tell of the whole feature**: the address bar shows the
canonical capitalized URL (`/topic/Bell_hooks/`) while the heading shows the lowercase rendered
display title ("bell hooks"). The canonical title keys the URL, the store, the QID, the article
fetch, and the "From Wikipedia" link; the display title drives **only** the heading. UX evaluation
explicitly checks that these two legitimately differ and that neither one leaks into the other's
surface.

---

## States

Enumerated for completeness. **No new state, error, empty, or loading UI is introduced.** Every
outcome routes into a state that already exists in `app/topic/TopicView.tsx`.

### Loading (during resolution)

The reader sees the **existing `ArticleSkeleton`** on the article side (`TopicView.tsx` line 534)
and the normal page chrome resolving, exactly as on any cold load — no change. **Two ordering rules
Dev must hold so the snap is smooth:**

- **No premature heading paint, no heading swap.** The `<h1>` / compact-header heading must not
  render with the typed (or canonical) title first and then swap to the display title once it
  resolves. Because the heading lives inside the `fetchState === "ready"` / `ArticleLeadBlock`
  branch and the display title arrives with that resolution, the natural ordering already avoids a
  swap — but Dev must ensure the heading is **first painted as the display title**, never an
  interim title that visibly changes. A heading that flips from "Bell hooks" to "bell hooks" in
  front of the reader is a defect this spec forbids.
- **No layout shift on the snap.** The display title occupies the same `<h1 class="wiki-title">`
  slot, same type ramp, same `border-b` rule — switching the *source* of the heading string changes
  no box, padding, or font. The transition is loading-skeleton → populated heading, a single settle,
  with no reflow caused by the canonicalization itself.

### Populated / resolved (canonical URL + display-title heading)

Identical to a direct load of the canonical URL:
- **Address bar:** `/topic/<Canonical_Title>/` (underscore, trailing slash, basePath — `topicHref`).
- **Heading (`<h1>` + compact header echo):** the plain-text **display title**.
- **"From Wikipedia" attribution link** and the **Wikidata QID** line: keyed on the **canonical**
  title/QID (unchanged behavior — see *Microcopy*).
- Plus rail, TOC, General strip, chips: all unchanged; they key off the canonical title/QID exactly
  as today.

### Error / unresolved (defers to #19 — must NOT flash a canonicalized-but-empty state)

A title Wikipedia cannot resolve (resolution returns no canonical title / no QID) routes into the
**existing** resolve-error state — the "Topic not found. **Back home**" copy (`TopicView.tsx` lines
509–518; "Back home" is an `/` link styled `text-action underline`). This spec **reuses it
unchanged** — no new copy, no "this title didn't canonicalize" variant.

**The hard requirement (AC6, the one interaction risk with #19):** an unresolved title must
**never** be canonicalized. Specifically:
- **No `router.replace` to an empty or partial slug** — never a hop to `/topic//` or `/topic/<empty>/`.
- **No flash of a canonicalized-but-empty Topic shell.** The reader must not see the URL snap and a
  partially-rendered/empty Topic page before the not-found state appears. Control must reach the
  existing not-found / resolve-error path *instead of* canonicalizing — the URL stays as typed (or
  is left to #19's handling), and the not-found copy is what renders.
- **No infinite spinner.** The unresolved case terminates in the resolve-error state, never hangs in
  the loading skeleton. (This is the existing resolver's behavior; the canonicalization must not
  break it.)

This spec must not regress, widen, or pre-empt #19. It only guarantees an unresolved title is left
alone and reaches the existing not-found path.

### Already-canonical (no visible change, no flicker)

When the current slug already equals `titleToSlug(canonicalTitle)` (e.g. `/topic/Calvin_cycle/`,
`/topic/Photosynthesis/`): **no `router.replace` fires** (AC5). The reader perceives a normal cold
load — loading skeleton → populated page — with **no URL flicker, no redundant history entry, and no
heading swap.** The address bar never changes because it was already correct. This is the common
case for in-app navigation (`<Link>`/`router.push` already emit canonical hrefs) and for any
already-clean shared link; it must be visually indistinguishable from today.

### State summary

| # | Arrival | Behavior | Destination |
|---|---|---|---|
| a | **Messy but resolvable** (`calvin_cycle`, literal space, `jfk`, `bell_hooks`) | Resolve → `router.replace` to canonical (slug differs) → load | Existing loading → populated page; canonical URL + display-title heading. (AC1–AC4) |
| b | **Already canonical** (`/topic/Calvin_cycle/`) | Resolve → slug matches → **no replace** | Existing loading → populated page; URL unchanged, no flicker, no history churn. (AC5) |
| c | **Unresolvable** (no canonical title / no QID) | **No canonicalization**, no replace to empty slug | Existing "Topic not found. Back home" resolve-error (#19's territory), unchanged. (AC6) |
| d | **`?qid=` back-compat entry** | Already canonicalizes (resolves QID→title, replaces to title URL) | Unchanged from today — out of scope; only kept working through any refactored seam. |

---

## Microcopy

- **The heading is Wikipedia's plain-text `displaytitle`.** It reads exactly as the article reads on
  Wikipedia — including the lowercase "bell hooks" case. Any HTML markup in `displaytitle` (italics,
  subscripts) is **stripped to plain text** this round (out of scope per the Product spec); the
  heading is a plain string, no rich formatting.
- **The "From Wikipedia" attribution link is unchanged** — same text ("From **Wikipedia** · CC BY-SA
  4.0 · Wikidata Q…", `ArticleLeadBlock`, `ArticleBody.tsx` lines 36–47), same `target="_blank"
  rel="noopener"` behavior — and **still targets the canonical article** (`article.url`, built from
  the **canonical** title, not the display title). The link must keep pointing at the same Wikipedia
  article the page presents (scope item 2). The `ArticleError` fall-through Wikipedia URL
  (`TopicView.tsx` line 537) must likewise be built from the **canonical** title, never the display
  title — so a failed-fetch "open on Wikipedia" link is correct.
- **No new user-facing string is introduced.** The only conditional string is the a11y-only polite
  announcement below, and only if the existing loading flow doesn't already cover the hop.
- **No underscore ever appears in any visible string** (carried from #11): the canonical underscore
  form lives only in the URL path; the heading, the compact header echo, the attribution, and the
  TOC all read the human form (display title for the heading, space-form title elsewhere).

---

## Responsive

**No layout or responsive impact.** The change is confined to a URL string, the *source* of the
heading string, and one `router.replace`; it touches no element box, breakpoint, column, sticky
behavior, or the web-first two-column → stacked layout (`docs/TOPIC_PAGE_DESIGN.md`). The display
title occupies the same `<h1 class="wiki-title">` slot and the same compact-header `truncate`
span (`TopicHeader`, hidden < md) at every breakpoint. A longer display title that differs from the
URL form (e.g. a multi-word alias target) flows through the **existing** truncation/wrap behavior of
those slots — no new responsive handling is needed. Untouched at every breakpoint.

---

## Accessibility

The committed AA baseline (AA contrast, visible focus, keyboard support, text-labeled signals — never
color alone) is **unaffected and must not regress**. This change adds **no color-coded signal, no new
contrast surface, and no new focus ring** — the Indigo Press palette (brand `#676EB4`, sprout
`#2A8270`, action `#1F6F95`, ink `#2C2C2C`; gold `#E5AB28` unused) is not touched, and no signal in
this change is conveyed by color alone (the URL snap and heading are plain text). The specific points
for a client-side URL-replace + heading change:

- **Announce the canonicalizing hop; don't leave silence.** A client-side `router.replace` changes
  the route **without a full page load**, so the browser does **not** do its native "new page" focus
  reset or title announcement (the same condition #13's bare-path redirect handles). For a
  *canonicalizing* arrival (slug differs), a non-visual user must learn the topic is loading — not be
  stranded while the URL changes and content loads silently. **The destination is the existing Topic
  loading flow; confirm in implementation that it announces for this entry path.**
  - **Caveat for Dev (verified against current code, same as #13):** the only polite live region in
    `TopicView.tsx` (lines 593–595) is **gated to `mode === "empty"`** and carries *candidate-search*
    status only — it does **not** announce the title-resolve / article-load hop for a curated topic.
    So as written it does not cover the common case.
  - **If — and only if — the loading flow does not already announce, add one polite, screen-reader-only
    live region** (`role="status"` / `aria-live="polite"`, text only, no visual chrome) at the
    resolution boundary with exactly: **"Loading topic…"**. This is honest (says "loading," not
    "found"), is not contradicted by a later not-found, and reuses the #13 wording so the two routing
    changes announce identically. Do **not** announce the not-found copy before the load resolves; do
    **not** add a chatty "Redirecting you to the canonical URL…" string. **For the already-canonical
    case (no replace), no announcement beyond the normal load is needed** — it is an ordinary cold
    load and must not gain extra chatter.
- **The heading change needs no separate announcement and no focus move.** The display title is the
  initial (and only) text the `<h1>` ever paints (per *States → loading*), so there is no
  swap-in-place for assistive tech to re-announce. The `<h1>` is announced as part of the normal
  page load. **No focus management is needed specifically for the heading**: the heading is content,
  not an interactive target, and it does not appear, disappear, or change while focus rests on it.
- **Focus is not stranded on the replace.** After the `router.replace`, keyboard focus must not be
  lost to `document.body` in a way that drops the user out of the document or strands them on a
  now-removed node. Focus should rest somewhere sensible in the loading/loaded Topic page (the page's
  normal initial focus is acceptable — this matches #13's handling). **No focus trap.** Keyboard users
  must be able to Tab into the page; on the unresolved end state (c) the "Back home" link must be
  keyboard-reachable with the project's visible focus ring.
- **No signal by color alone.** Nothing in this change communicates state via color — the canonical
  URL and the display-title heading are both plain text; there is no chip, badge, or color cue to
  duplicate with a label.

---

## Hand-off to Development

Build per the Product spec `docs/specs/canonical-topic-url.md` (AC1–AC9 — resolve canonical/display/QID
in one call, split the overloaded `topicTitle`, `router.replace`-when-slug-differs, follow
redirects/aliases, plain-text display title as the heading, doc update, tests). The **UX contract**
this spec adds on top of that:

1. **The heading is the plain-text display title; the URL/attribution stay canonical.** Switch the
   `<h1>` (`ArticleLeadBlock title=…`, `ArticleBody.tsx` line 27) **and** the compact header echo
   (`TopicHeader articleTitle=…`, `TopicView.tsx` line 526) to the **display** title. Keep the "From
   Wikipedia" link (`ArticleLeadBlock url=…`) and the `ArticleError` Wikipedia URL (`TopicView.tsx`
   line 537) keyed on the **canonical** title. This is the split of the overloaded `topicTitle`
   (TopicView.tsx line 220) into a canonical value (URL/store/QID/article/"From Wikipedia") and a
   display value (heading only).
2. **No heading swap, no layout shift.** The heading must be first painted as the display title —
   never an interim typed/canonical title that visibly flips. Same `<h1>` slot, type ramp, and rule;
   the canonicalization causes no reflow.
3. **One smooth hop, `router.replace`, only when the slug differs.** Canonicalizing arrivals fire
   exactly one `router.replace` (never `push`) built via `topicHref`/`titleToSlug` (trailing slash +
   basePath); already-canonical arrivals fire **zero**. Back never bounces through the typed form.
4. **Unresolved title must NOT flash a canonicalized-but-empty state (AC6, the #19 boundary).** Never
   `router.replace` to an empty/partial slug, never paint a snapped-URL empty Topic shell; route into
   the existing "Topic not found. Back home" state instead. No infinite spinner.
5. **Route into existing states only — add no new error/empty/loading UI, no new visible microcopy,
   no layout or responsive change, no new color/contrast surface.**
6. **A11y: announce the canonicalizing hop, don't strand focus.** If the existing loading flow does
   not already announce the resolve/load for the curated case (per the caveat — it does not as
   written), add a single polite, screen-reader-only **"Loading topic…"** live region at the
   resolution boundary (reusing #13's wording). No announcement is added for the already-canonical
   case. Keep focus inside the document; no trap; no focus move for the heading change.

## Evaluation (UX built-UI pass, after Development)

Judge the running UI against this spec + the stories. Confirm:

1. **AC1** `/topic/calvin_cycle/` settles at `/topic/Calvin_cycle/` with the heading "Calvin cycle".
2. **AC2** `/topic/Calvin cycle/` (literal space) settles at the same `/topic/Calvin_cycle/`, heading
   "Calvin cycle".
3. **AC3** `/topic/jfk/` settles at `/topic/John_F._Kennedy/` with the **target's** heading (not
   "jfk").
4. **AC4 (the visible tell)** `/topic/bell_hooks/` settles at `/topic/Bell_hooks/` (capital B) while
   the heading reads **"bell hooks"** (lowercase) — canonical URL and display heading legitimately
   differ; neither leaks into the other's surface.
5. **Already-canonical (AC5)** an already-canonical URL shows **no URL flicker, no redundant history
   entry, no heading swap** — indistinguishable from today's cold load.
6. **No heading swap / no layout shift** on any canonicalizing arrival — the heading paints as the
   display title once, with no flip from canonical→display and no reflow.
7. **Unresolved (AC6)** an unresolvable title reaches the **existing** "Topic not found. Back home"
   state — **no URL snap to an empty/partial slug, no flash of a canonicalized-but-empty Topic shell,
   no spinner that never resolves.**
8. **"From Wikipedia"** still opens the **canonical** Wikipedia article (and the failed-fetch fallback
   link does too); attribution text and behavior unchanged.
9. **Back (AC7)** after a canonicalizing arrival returns to the prior page, not the typed/typo URL.
10. **A11y** the canonicalizing hop is announced to a screen reader (or the added "Loading topic…"
    polite live region fires; the already-canonical case adds no chatter); keyboard focus is not
    stranded; no underscore in any visible string; no color/contrast/focus regression.

A pass returns to Operations via the loop; any design defect routes back to **Development**.
