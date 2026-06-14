# Spec: Topic Page v1 — the curated "Indigo Press" Topic page

- **Status:** Draft for build-loop (Phase 1 / Product)
- **Owner:** Product
- **Inputs:** `docs/VISION.md`, `docs/TOPIC_PAGE_DESIGN.md` (primary), `docs/ARCHITECTURE.md`
  (Prototype-phase section), reference mockups `mockups/inline-indigo-sync.html` (curated) and
  `mockups/inline-indigo-empty-v2.html` (empty). Built the wiki+ way: client-side Next.js 15
  static-export SPA over the `lib/data/` DataStore seam, deployed to GitHub Pages.
- **Hand-off:** UX (flows + buildable design spec for these stories), then Development.

---

## Problem & user value

A wiki+ Topic page is the product's core surface — the place a reader meets a Wikipedia article
*and* the curated short-form video that contextualizes it. Today the app ships only a thin,
generic two-pane stub (`app/topic/TopicView.tsx` + `components/ClipCard.tsx`): it renders the
Wikipedia **summary** (lead only — no sections, no TOC), lists clips in a plain card, and has none
of the committed "two worlds" design, the General strip, the synced rail, or the empty-state
candidate language. It does not yet deliver the experience `docs/TOPIC_PAGE_DESIGN.md` commits to.

**User value (per VISION's "what good looks like"):** a reader who lands on a Topic page should
read the real encyclopedia article undisturbed, and — alongside it — find a small set of curated
clips, each with a human context note that tells them *what's fact vs. the creator's opinion* and
*how reliable it is*, anchored to the section it speaks to. On an uncurated topic, the page should
still be useful: it shows clearly-unvetted auto-suggested candidates and obvious paths to curate,
so the page seeds its own flywheel rather than dead-ending.

This v1 rebuilds the Topic page as the committed Indigo Press design, replacing the stub.

---

## Scope — the coherent core (this round)

This round builds the **read-and-weigh core** of the Topic page in both its **curated** and
**empty** states, as a faithful (not pixel-perfect) implementation of the committed design. It
replaces `app/topic/TopicView.tsx` and `components/ClipCard.tsx` with Indigo Press components.

In scope:

1. **Two-world layout & identity.** The committed two-column shell (article ~1fr, plus rail
   ~360px) with the split "Wiki / ＋plus" wordmark, sticky header, the masthead (article lead +
   ＋plus infobox + TOC), and the Indigo Press treatment on the plus side (light editorial cards,
   2px ink borders, solid offset shadows, indigo color-blocks, brand fonts). The Wiki side keeps a
   faithful Wikipedia look (serif headings/title, hairline rules, blue wikilinks, right-floated
   captioned figures). Indigo Press palette only; gold deliberately unused.

2. **Full article render with sections (client-side).** Fetch the article from the MediaWiki REST
   API client-side, sanitize with DOMPurify, and render the **lead plus the section structure**
   (headings + body), not just the summary. Section headings get stable slugs used for anchoring
   and the TOC. Wikilinks are rewritten to internal `/topic/…` routes (Wikipedia/non-article
   fallback for red/namespaced links). CC BY-SA attribution + Wikidata QID shown on the article.

3. **Table of Contents with per-entry video counts.** A TOC in the masthead (and the condensed
   mini-TOC in the rail) listing a "＋ General" entry first, then each article section, each with a
   badge for how many videos are anchored there. Sections with zero videos still appear as normal
   TOC entries.

4. **General strip (the one crossover).** A full-width band immediately after the lead presenting
   whole-topic ("general") clips as a thumbnail-forward, horizontally-scrollable search-style row.

5. **Section-anchored curated clips in the plus rail.** Each non-general clip rendered as an
   Indigo Press card in the sticky rail: thumbnail (click-to-load facade), creator identity
   (avatar/name/handle/platform), a **stance chip** and an **accuracy chip** (text-labeled, never
   color alone, color-coded per the design's fact-vs-opinion vocabulary), the **curator context
   note**, and the section link. Correct aspect ratio by `orientation` (9:16 vertical / 16:9).

6. **Scroll-synchronized reading.** Scrolling the article advances the rail to the active section's
   card and highlights the pairing (section marker + active card + current TOC entry); scrolling
   the rail scrolls the article to that anchor; TOC/section clicks jump both. Section-level
   granularity (per the mockup). Respect `prefers-reduced-motion`.

7. **Empty / zero-curation state.** When a topic has no curated clips, render the empty-state
   design from `inline-indigo-empty-v2.html`: the infobox shows "0 videos curated" with a
   "Be the first to curate" CTA; the General band becomes "Suggested videos · uncurated"; candidates
   are unmistakably distinct from curated clips (dashed borders, no solid offset shadow,
   desaturated/hatched thumbnail, outline "SUGGESTED" badge, an **auto-suggest reason** in place of
   a context note, no stance/accuracy chips); inline single candidates appear under matching
   sections; TOC badges show suggestion counts in dashed/outline style. The manual-source actions
   render: **Search TikTok** and **Search YouTube** deep-link out in a new tab; **Add video** and
   the per-candidate **Promote** / **Not relevant** entry points are **present** (gated — see
   Out-of-scope). "Not relevant" dismisses a candidate from the current view.

8. **Video playback facade.** Click-to-load: YouTube opens an embedded player (lazy iframe facade,
   no autoload before click); TikTok/other open the watch URL in a new tab (embed-never-host).

9. **DataStore-backed.** All topic/clip reads go through `lib/data/` (localStorage today). The
   `Clip`/`Topic` types in `lib/data/types.ts` are extended with the fields the design needs
   (see Assumptions A5) so the curated and empty states render from store data + a seed. The swap
   point in `lib/data/index.ts` is preserved.

10. **Responsive single-column fallback.** On narrow screens the two-pane layout collapses to a
    single column that remains readable and operable (sync may relax); AA accessibility baseline
    throughout (focus states, keyboard operability of TOC/cards/modals/buttons, text-labeled
    signals).

---

## Out of scope / Next round

Deferred deliberately. Each is a follow-up the orchestrator should carry into the next round.

- **Live YouTube auto-suggestion pipeline.** This round renders the empty-state candidate **UI**
  from seeded/mock candidate data. Wiring real YouTube Data API search (quota, caching, section
  keyword-matching, `NEXT_PUBLIC_YOUTUBE_API_KEY` no-op-when-unset path) is next round. *(If Dev
  finds the no-op-safe search path cheap to include behind the unset-key guard, it MAY, but it is
  not required for this round's acceptance.)*
- **TikTok auto-suggestion** (no practical search API — design already accommodates; manual
  "Search TikTok" launch is the interim path and IS in scope).
- **Write/curation persistence + auth.** Promote / Add-video / dismiss are **UI entry points** this
  round. Real persistence of a promotion into a curated clip, and login-gating
  (anonymous-can-browse / login-to-contribute), arrive with Auth.js + the server read-path. For
  this round, "Add video" and "Promote" open their modals (mock submit, per the reference mockup);
  "Not relevant" dismisses from the current view only (no persisted `dismissed_candidate`).
- **Curation/Editorial vocabularies.** `stance`/`accuracy_flag` remain the **provisional**
  placeholders in `lib/data/types.ts`; the controlled vocabulary is Curation/Editorial's to set.
- **Phrase/span-level anchoring** (section-level only this round).
- **"See all" / browse-all clips flow** and pagination beyond what one topic shows.
- **Instagram/Vimeo** embed specifics, real oEmbed metadata resolution, follower-count freshness.
- **SEO server-render of the unique surface**, ISR/Redis/Server Actions — the production read-path.
- **Topic search / discovery box** and on-demand topic creation UX beyond what already exists
  (visiting `/topic?qid=…` resolving QID→title is the existing path and is retained).

---

## Acceptance criteria

Each item is independently verifiable and maps 1:1 to a QA test. "The page" = the Topic page at
`/topic?qid=<QID>` (or the route Dev uses for the static export) for a seeded topic. "Curated
state" = a topic with ≥1 curated clip in the store; "empty state" = a topic with zero curated clips.

1. **AC1 — Two-column layout & split wordmark.** On a wide viewport, the Topic page renders a
   two-column layout (article column on the left, a plus rail of roughly fixed ~360px on the
   right) with a sticky header whose wordmark is split so "Wiki" labels the article column and
   "＋plus" labels the plus column.

2. **AC2 — Faithful Wikipedia article side.** The article column renders the real Wikipedia
   article with a serif title and serif section headings with hairline rules, sans-serif body,
   blue wikilinks, and right-floated captioned figures — and is never interrupted by a video card
   in the curated state (the General strip is the only crossover).

3. **AC3 — Full sections, not just the lead.** The article renders the lead **and** at least the
   article's top-level section headings with their body text (more than the one-paragraph summary
   the stub showed), each heading carrying a stable slug/id usable as a scroll anchor.

4. **AC4 — CC BY-SA attribution + QID.** The article column displays attribution to Wikipedia
   ("From Wikipedia") with the CC BY-SA license and a link to the source article, and shows the
   topic's Wikidata QID.

5. **AC5 — Internal wikilink rewriting.** Wikilinks inside the rendered article body point to
   internal wiki+ topic routes (`/topic/…`), not out to `en.wikipedia.org`, for ordinary
   article-namespace links; non-article/red links fall back gracefully (Wikipedia link or
   de-linked) rather than producing a broken internal route.

6. **AC6 — TOC with per-section video counts.** The plus side shows a Table of Contents that lists
   a "＋ General" entry first, then one entry per article section; each entry with anchored videos
   shows a count badge, and sections with zero videos still appear as TOC entries. Clicking a TOC
   entry scrolls the article to that section.

7. **AC7 — ＋plus infobox counts (curated).** In the curated state, the ＋plus infobox shows the
   topic-level counts (videos / creators / curators) derived from the topic's clips, as indigo
   big-numeral blocks.

8. **AC8 — General strip.** In the curated state, the full-width General band after the lead
   renders each general (whole-topic) clip as a thumbnail-forward tile in a horizontally
   scrollable row, with a count of general videos.

9. **AC9 — Anchored clip card content.** In the curated state, each section-anchored clip renders
   in the rail as a card showing: a thumbnail, the creator (name + handle + platform), a
   **stance** chip and an **accuracy** chip that are **text-labeled** (the label text is present,
   not conveyed by color alone), the curator **context note**, and a link to its article section.

10. **AC10 — Vertical vs. horizontal aspect.** A clip whose `orientation` is `vertical` renders its
    thumbnail/player frame at a 9:16 aspect; a `horizontal` clip renders at 16:9.

11. **AC11 — Click-to-load playback (no autoload).** No video iframe/embed is loaded on initial
    page render; activating a YouTube clip's thumbnail loads and plays it (embedded player), and
    activating a TikTok/non-YouTube clip opens its watch URL in a new tab. (Embed-never-host.)

12. **AC12 — Scroll sync: article → rail.** Scrolling the article so a section with anchored
    video(s) reaches the reading line advances the plus rail to that section's card and applies the
    active-pairing highlight to the section marker, the active card, and the current TOC entry.

13. **AC13 — Scroll sync: rail → article and jump-to.** Scrolling the rail to a section's card
    scrolls the article to that section anchor, and clicking a card's section link (or its TOC
    entry) jumps both sides to that section.

14. **AC14 — Empty-state CTA & infobox.** When a topic has zero curated clips, the page renders the
    empty state from `inline-indigo-empty-v2.html`: the infobox shows "0" / "videos curated" and a
    prominent "Be the first to curate" call-to-action.

15. **AC15 — Unvetted candidate treatment is visually distinct.** In the empty state, suggested
    candidates are unmistakably distinct from curated clips: dashed (not solid) borders, no solid
    offset shadow, a desaturated/hatched thumbnail, an outline "SUGGESTED" badge, and — in place of
    a curator context note — an auto-suggest reason with a "no context yet" hint. No stance/accuracy
    chips appear on candidates.

16. **AC16 — Empty-state General band + inline section candidates.** In the empty state, the
    General band reads as "Suggested videos · uncurated" with a candidate count, and where a
    candidate matches a section it appears as a single inline candidate block under that section
    (rendered after the section's article text, not interrupting it).

17. **AC17 — Empty-state TOC badges are distinct.** In the empty state, TOC count badges render in a
    dashed/outline style (visually distinct from the solid curated-count badges) reflecting
    suggestion counts.

18. **AC18 — Manual source actions.** In the empty state, a "Search TikTok" and a "Search YouTube"
    action each open the respective platform's search for the topic in a new tab (`target=_blank`,
    `rel=noopener`), and an "Add video" control opens the add-by-link modal.

19. **AC19 — Promote / Not relevant entry points.** Each candidate exposes a "Promote" control
    (opens the "Curate this clip" modal) and a "Not relevant" control (removes the candidate from
    the current view and decrements the visible suggestion counts).

20. **AC20 — DataStore-driven, no hardcoded topic.** The page's topic, clips, and counts are read
    through `lib/data/` (the DataStore seam), not hardcoded into the component; rendering the
    curated vs. empty state is determined by whether the store returns clips for that topic. The
    swap point in `lib/data/index.ts` remains the single source of the active store.

21. **AC21 — Accessibility baseline.** Interactive elements (TOC entries, candidate Promote/Not
    relevant/Add/Search controls, clip thumbnails, modal open/close) are keyboard-operable with
    visible focus states; all fact-vs-opinion signals carry text labels (not color alone); chip and
    text color combinations meet WCAG AA contrast.

22. **AC22 — Builds clean.** `yarn typecheck` and `yarn build` (Next.js static export,
    `output: "export"`) both complete without errors, producing a static bundle deployable to
    GitHub Pages under the workflow's `basePath`.

---

## Success metric

This is a prototype with no analytics backend, so success is defined as **fidelity + the curated
core working end-to-end**, measured at QA/UX review:

- **Primary (fidelity & coherence):** A reviewer comparing the built curated page to
  `inline-indigo-sync.html` and the built empty page to `inline-indigo-empty-v2.html` judges each a
  faithful realization of the committed design (the structural elements in AC1–AC19 present and
  recognizably Indigo Press), with **zero** AC failures on the numbered criteria above.
- **Secondary (the "what good looks like" check):** On a seeded curated topic, a reader can, in one
  pass, (a) read the article, (b) see its curated clips each with a context note and a
  text-labeled fact-vs-opinion signal, and (c) tell at a glance how to weigh each one — and on an
  uncurated topic is offered clearly-unvetted candidates plus an obvious path to curate.
- **Forward indicator (post-launch, deferred to Analytics):** once write-persistence + auth land,
  the loop's real metric becomes *share of topic visits that end with a reader having watched ≥1
  curated clip* and *promotions per uncurated visit* — defined here, instrumented later.

---

## Assumptions

Recorded because the prompt/design doc leave these open and the owner is offline.

- **A1 — Replace, don't extend, the stub.** The current `app/topic/TopicView.tsx` and
  `components/ClipCard.tsx` are a generic placeholder that does not match the committed design, so
  v1 **replaces** them with Indigo Press components rather than layering onto them. `lib/wiki/`,
  `lib/embed/`, and `lib/data/` are reused/extended, not discarded.

- **A2 — Article fetch is upgraded to full sections.** The existing `fetchArticleSummary`
  (lead-only) is insufficient for the TOC/section anchoring AC3 requires; v1 fetches richer article
  HTML (MediaWiki REST page HTML or sectioned content) and derives a section list. Exact endpoint
  and DOMPurify allowlist are Dev's call within ARCHITECTURE's "Article rendering" guidance.

- **A3 — Reference topic is Photosynthesis (the mockups' topic) or the existing seed.** The seed in
  `lib/data/index.ts` (`Q146` "Cat") is fine as a default; QA should seed/point at a topic with
  real sections (the mockups use Photosynthesis) to exercise the curated state. v1 should seed at
  least one fully-curated topic and rely on any uncurated QID for the empty state.

- **A4 — Candidates are seeded/mock data this round, not live search.** Per Out-of-scope, the
  empty-state candidate UI is driven by seeded candidate data (a fixed mock set), matching the
  reference mockup's `data/content-empty.js`. This lets the empty-state ACs be verified without a
  YouTube key, consistent with "no key in local/cloud builds."

- **A5 — The clip/topic model is extended to carry the design's fields.** `lib/data/types.ts`
  gains the fields the cards/strip/infobox need and that ARCHITECTURE's data model already implies:
  on `Clip` — `general` (boolean) / derive from `sectionAnchor`, `orientation`
  (`vertical|horizontal`), `thumbnailUrl`, `embedUrl`/`watchUrl`, optional `upvotes`, and creator
  `avatar`/`followerCount`/display fields; a lightweight **candidate** shape for unvetted
  suggestions (source + match reason, no context/stance/accuracy). Topic-level counts (videos /
  creators / curators) are derived from clips or stored on the topic. Final field names are Dev's,
  but the seam interface in `lib/data/store.ts` must still describe them.

- **A6 — Curated and empty are the same page in two states**, switched by whether the store returns
  curated clips for the topic — not two separate routes.

- **A7 — Promote/Add/dismiss are non-persisting this round.** Matching the reference mockups, the
  curation modals submit as mocks (no write to the store) and "Not relevant" affects only the
  current view; this keeps the round free of the auth/persistence work that's explicitly deferred.

- **A8 — "Faithful, not pixel-perfect."** The committed design's structure, interaction model, and
  color system are binding; finer visual details are refinable in implementation (per
  `docs/TOPIC_PAGE_DESIGN.md`). UX owns the buildable design spec that pins specifics for Dev.

- **A9 — Single-column mobile behavior is a graceful fallback**, not a fully redesigned mobile
  experience (the design doc defers mobile specifics); the page must remain readable and operable
  narrow, with sync allowed to relax.
