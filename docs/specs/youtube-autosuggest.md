# Spec: Live YouTube candidate auto-suggestion

- **Status:** Draft for build-loop (Product) — GitHub issue #3
- **Owner:** Product
- **Inputs:** `docs/ARCHITECTURE.md` (§"Candidate suggestion & the empty state", §"Prototype
  phase" — the `NEXT_PUBLIC_YOUTUBE_API_KEY` notes), `docs/CURATION_STANDARD.md` §6
  (unvetted-candidate rule), `docs/TOPIC_PAGE_DESIGN.md` (§Empty state), `docs/VISION.md`.
  Existing code: the `Candidate` type (`lib/data/types.ts`), the DataStore seam
  (`lib/data/store.ts`, `lib/data/local-store.ts`, `lib/data/index.ts`), the seeded mock
  candidates (`lib/data/seed.ts`), and the empty-state UI that already consumes candidates
  (`components/topic/InlineCandidate.tsx`, `CandidateBits.tsx`, `GeneralStrip.tsx`).
- **Hand-off:** UX (any flows/microcopy for the live/empty/no-key states named below), then
  Development. QA & Review verifies against the Acceptance criteria.

---

## Problem & user value

Every wiki+ topic begins with **zero curations**, so the empty state is most arrivals' first
impression (`docs/ARCHITECTURE.md` §"Topic discovery & search"). Today that empty state is
bootstrapped with **seeded mock candidates** (`lib/data/seed.ts`, only for the one demo topic
`Cellular respiration`); any other uncurated topic shows **no candidates at all** and dead-ends.
The mock data can't seed the flywheel for a real topic a reader navigates to.

**User value:** on an uncurated topic, a reader (or would-be curator) sees a small set of
**real, relevant, clearly-unvetted** video candidates pulled live for *that* topic — a credible
starting point that says "here's what's out there; help us weigh it" — instead of an empty shell.
This is the on-ramp to the curation loop: a candidate is one click ("Promote") from becoming a
contextualized clip. The candidates are honestly labeled as un-reviewed (no chips, no context
note — `docs/CURATION_STANDARD.md` §6), so the empty state is useful **without** falsely implying
endorsement.

This feature replaces the seeded mock source with a **live YouTube Data API search**, behind the
existing `DataStore` seam, for the **client-side static SPA prototype**.

---

## Scope — this round

Swap the candidate **source** behind `DataStore.listCandidates(topicQid)` from seeded mock data to
a **live, cached YouTube Data API search**, keeping everything downstream (the empty-state UI, the
`Candidate` shape, promote/dismiss) unchanged.

In scope:

1. **A pluggable candidate-source interface.** Build the candidate pipeline
   **platform-agnostic** (a source interface that returns `Candidate[]` for a topic), with
   **YouTube as the only registered source at launch** (ARCHITECTURE §"Candidate suggestion":
   "multi-platform by design; YouTube-only in the MVP"). The interface is what a future TikTok or
   Vimeo source plugs into; this round registers only YouTube.

2. **General-bar candidates from a topic-level search.** Run one **YouTube Data API v3 `search`**
   query for the topic (the topic title, optionally with a light qualifier — see D1/Decision 1)
   and turn the top results into `general: true` candidates for the General/Suggested band
   (`GeneralStrip.tsx`).

3. **Inline section candidates by metadata matching.** Match candidate metadata
   (title / description / tags) against the **article section titles/keywords** (the section list
   the Topic page already derives — `ArticleSection[]`), and surface the **best single match per
   section** as a `general: false` candidate anchored by `sectionSlug`/`sectionLabel`, with a
   populated `matchReason` (ARCHITECTURE §"Candidate suggestion"; the inline-candidate UI is
   `InlineCandidate.tsx`). A weak match must not surface (Decision 2's threshold).

4. **Correct `Candidate` shape.** Every produced candidate carries `vetted: false`,
   `source: "YouTube"`, `platform: "youtube"`, `platformLabel: "YouTube"`, a human-readable
   `matchReason`, and **no** `stance` / `accuracyFlag` / `contextNote` (it is a `Candidate`, not a
   `Clip` — enforced by the type, restated as AC for QA). Orientation is decided per Decision 4.

5. **Per-topic caching with a TTL.** Cache the computed candidate set **per topic** in
   `localStorage` for the prototype, keyed and TTL'd per Decision 5, so repeated visits to a topic
   do **not** re-spend the (expensive) YouTube quota.

6. **Dedup against curated clips and dismissed candidates.** Do not surface a candidate that is
   already a curated clip for the topic, or that the user has dismissed (Decision 3).

7. **Graceful no-op when the key is unset.** When `NEXT_PUBLIC_YOUTUBE_API_KEY` is absent (every
   local / cloud / CI build — the key only reaches the GitHub Pages deploy via the Actions
   secret), the live search path **must not run, must not throw, and must not break the build or
   tests**; it falls back to the existing seeded/empty candidate behavior (Critical constraint;
   AC1). The downstream empty-state UI is unchanged in that case.

8. **The swap stays at the seam.** `listCandidates` is the only call site that changes source;
   `lib/data/index.ts` remains the single place that wires the store. Call sites in components are
   untouched.

This round is the **client-side prototype** only.

---

## Open product decisions (resolved here)

These are the orchestrator's recorded open decisions. Each is resolved with reasoning so Dev and
QA build to one target.

### Decision 1 — How many General-bar candidates per topic

**Decision: surface up to `5` General candidates** (`GENERAL_CANDIDATE_COUNT = 5`), from a single
YouTube `search` call requesting a small `maxResults` (e.g. 10–12, to leave room for dedup and
the "best per section" picks below before truncating the general list to 5).

*Reasoning:* the General/Suggested band (`GeneralStrip.tsx`) is a single horizontally-scrollable
row; ~5 tiles fill it without turning the empty state into an endless feed, and it matches the
curated-mode density. Critically, **one `search.list` call costs 100 units of a default 10,000/day
quota** — so the constraint is *number of calls*, not results per call. We therefore make **one
search call per topic** and slice its results into both the General set and the section-match pool
(no extra calls per section). Five is a deliberately small N mindful of quota and of the
"2–5 clips a reader is glad they watched" bar in VISION.

### Decision 2 — Section-matching heuristic

**Decision:** match by **case-insensitive keyword overlap** between a section's keywords and the
candidate's searchable text:

- **Section keywords** = the section title tokenized into words, lowercased, with stopwords and
  ≤2-char tokens removed (e.g. "Light-dependent reactions" → {`light`, `dependent`, `reactions`}).
- **Candidate text** = `title` + `description` + `tags` (when the search response includes them),
  lowercased and tokenized the same way.
- **Score** = the count of distinct section keywords that appear in the candidate text. (Optional
  light weighting: a hit in the **title** counts more than one in the description — Dev's call, but
  title hits should dominate ties.)
- **Minimum-match threshold:** a section surfaces a candidate **only if** at least **one
  *distinct, non-topic-generic* section keyword** matches **and** the score meets a small floor.
  Concretely: require **≥1 keyword overlap where that keyword is not also a token of the topic
  title** (so "respiration" matching the "Cellular respiration" topic does not, by itself, qualify
  a section — that's just the topic, not the section). Single-word generic sections (e.g. "History",
  "Overview", "See also") **do not** get an inline candidate.
- **Best single match per section:** for each section, take the highest-scoring candidate; **only
  one** inline candidate per section (ARCHITECTURE: "best single match per section").
- **Tie-breaking** (deterministic, in order): (1) higher title-hit count, (2) higher total score,
  (3) earlier position in the YouTube result order (YouTube's own relevance ranking), (4)
  `videoId` lexical order as a final stable tiebreak.
- **No duplicate placement:** a given video appears **at most once** on the page — if a video is
  the best match for a section, it is **not also** shown as a General candidate (and not matched to
  a second section); assign each video to its single best home (prefer the section match over
  General when it clears the threshold).

*Reasoning:* keyword overlap is cheap, deterministic, testable, and needs no extra API calls (it
runs over the one search response). The non-topic-generic rule is the guard against weak matches —
without it every section "matches" because every result mentions the topic. Determinism matters for
QA: the same inputs must produce the same placement.

### Decision 3 — Dedup against curated clips and dismissed candidates

**Decision:** dedup by **provider video identity** = (`platform`, provider video id parsed from
`watchUrl`/`embedUrl`). Exclude a YouTube result from candidates if either:

- a **curated `Clip`** for the topic already has that video identity (don't suggest what's already
  curated), or
- the user has **dismissed** that candidate for this topic.

*Prototype mechanism:* curated-clip dedup reads the topic's clips via the store. Dismissal in the
prototype is per-browser; record dismissed `(topicQid, platform, videoId)` in `localStorage`
(mirrors the production `dismissed_candidate` table — ARCHITECTURE Data model). The existing
`onDismiss` UI handler is wired to persist a dismissal so a dismissed candidate **does not resurface
on reload** (today it only updates in-memory state — this round makes dismissal sticky for the
prototype). Also **de-dup within the result set itself** (YouTube can return the same video twice).

*Reasoning:* "promotable / dismissable, doesn't resurface" is the candidate contract
(ARCHITECTURE; CURATION §6). Video identity is the stable key the production schema already uses
(`unique(topic_id, provider, provider_video_id)`), so the prototype keys the same way and the
production move is a store swap, not a redesign.

### Decision 4 — Orientation (`vertical` vs `horizontal`) for a YouTube result

**Decision:** default to **`horizontal`** (16:9) for a YouTube search result, and treat it as
**`vertical`** (9:16, a Short) only when there is a **positive signal** the result is a Short —
in priority order:

1. the watch URL is a **`/shorts/<id>`** URL (Shorts links are unambiguous), or
2. the search was scoped with `videoDuration=short` *and* a vertical signal is present, or
3. (best-effort) thumbnail aspect ratio from the search snippet indicates a portrait frame.

If no positive Shorts signal exists, **`horizontal`**.

*Reasoning:* the YouTube Data API `search` response does **not** reliably expose aspect ratio, and
a regular video shown in a 9:16 frame letterboxes badly. ARCHITECTURE notes "Shorts are ordinary
YouTube videos shown in a vertical frame," so the orientation only needs to be right when we *know*
it's a Short; defaulting to 16:9 is the safe, correct-most-of-the-time choice for the embed frame.
We do **not** spend a second (`videos.list`) API call to fetch precise dimensions this round (quota
+ no server) — a follow-up can refine orientation server-side when search moves to the backend.

### Decision 5 — Cache TTL and cache key

**Decision:**

- **Cache key** = `wikiplus.candidates.<topicQid>` (one cached entry per topic; the QID is the
  canonical key). The cached value stores `{ fetchedAt, candidates }`.
- **TTL = 24 hours.** A cached set older than 24h is stale; on the next visit the search re-runs
  (key permitting) and the cache is refreshed. Within the TTL, `listCandidates` returns the cached
  set with **no API call**.
- **Cache miss / stale + no key** → fall back to seeded/empty (AC1); do not write a cache entry
  from a no-key no-op (so the search runs once the key is available).
- Cache invalidation is **lazy** (refresh on read when stale), matching ARCHITECTURE's
  "refresh lazily" posture. A dismissal or a promotion updates the *displayed* set immediately via
  the dedup rules (Decision 3) without forcing a full re-search.

*Reasoning:* the YouTube quota is the binding constraint, so the cache exists to **stop re-spending
it**. 24h is long enough that revisiting a topic the same day is free, short enough that a topic's
candidate set isn't frozen for weeks. The QID key matches the canonical topic identity and the
production Redis-cached-set design (ARCHITECTURE §"Candidate suggestion": "cache candidate sets per
topic"), so the prototype's `localStorage` cache is the same shape as the eventual Redis one.

---

## Acceptance criteria

Numbered, testable. QA & Review verifies each; the no-key (AC1) and no-chips (AC4) criteria are
mandatory.

1. **No-key graceful no-op (critical).** With `NEXT_PUBLIC_YOUTUBE_API_KEY` **unset** (the state of
   every local / cloud / CI build): `listCandidates(topicQid)` makes **no** network request to the
   YouTube API, **throws no error**, returns the existing seeded/empty candidate result, and
   `yarn build` and `yarn test` both pass green. (Verifiable without a key — the default sandbox
   state.)
2. **Live search when keyed.** With the key **set**, visiting an uncurated topic triggers a single
   YouTube Data API v3 `search` call for that topic, and the returned results populate the
   General/Suggested band and (where matched) inline section candidates. (Verified with the live
   path mocked — the network call is intercepted in tests, as the article fetch already is.)
3. **General-bar count.** A keyed topic surfaces **at most 5** `general: true` candidates in
   `GeneralStrip`, derived from **one** search call (no per-section API calls).
4. **Candidate carries no stance/accuracy/note (critical, CURATION §6).** Every candidate produced
   by the live source has `vetted: false`, `source: "YouTube"`, `platform: "youtube"`, a non-empty
   `matchReason`, and **no** `stance`, `accuracyFlag`, or `contextNote` field set. (Enforced by the
   `Candidate` type and asserted in tests.)
5. **Section matching surfaces the best single match.** For a topic whose article has sections, an
   inline section candidate appears **only** for a section that clears the Decision-2 threshold
   (≥1 distinct non-topic-generic keyword overlap); **at most one** inline candidate per section;
   the chosen candidate is the highest-scoring per the Decision-2 tie-break order. Weak/generic
   sections (e.g. "History", "See also") get **no** inline candidate.
6. **`matchReason` is populated and honest.** General candidates show a reason naming the source +
   the topic search (e.g. *"Top result · YouTube search 'cellular respiration'"*); section
   candidates name the matched keyword/section (e.g. *"Mentions 'glycolysis' · matched to a section
   heading"*). The reason describes *why it matched*, never asserts quality or accuracy.
7. **No duplicate placement.** A given video id appears **at most once** across the whole page (not
   both General and a section, not two sections); duplicate results within a single search response
   are de-duped.
8. **Dedup against curated clips.** A video already curated as a `Clip` for the topic is **not**
   surfaced as a candidate.
9. **Dismissal is sticky (prototype).** Dismissing a candidate ("Not relevant") records the
   dismissal for that topic so the **same candidate does not reappear** after a reload / re-fetch
   within the prototype (per-browser `localStorage`).
10. **Orientation rule.** A `/shorts/` result (or one with a positive Shorts signal per Decision 4)
    is `orientation: "vertical"`; otherwise `orientation: "horizontal"`. Default is `horizontal`.
11. **Per-topic cache with TTL.** A second visit to the same topic **within 24h** returns the
    cached candidate set with **no** additional YouTube API call; a visit after the TTL re-runs the
    search (key permitting). The cache key is per-QID.
12. **Seam unchanged downstream.** The change lives behind `DataStore.listCandidates`; the
    empty-state components (`GeneralStrip`, `InlineCandidate`, `CandidateBits`) and the `Candidate`
    type are **not** modified to accommodate the source (they already consume `Candidate[]`).
    `lib/data/index.ts` remains the single store-wiring point.
13. **Pluggable source.** YouTube search is implemented behind a **source interface** (returns
    `Candidate[]` for a topic) such that adding another platform source is additive, not a rewrite;
    YouTube is the only source registered this round.
14. **Wikimedia/YouTube etiquette & resilience.** The search request sends a descriptive
    `User-Agent`/identifying header where the platform allows it, and any API error, rate-limit, or
    quota-exceeded response is **caught and degrades to seeded/empty** (never an unhandled throw,
    never a broken page) — same posture as AC1.
15. **No key in the repo.** The key is read **only** from `process.env.NEXT_PUBLIC_YOUTUBE_API_KEY`
    (baked at build time per ARCHITECTURE §"Prototype phase"); it is never committed to the repo or
    hard-coded. (Security check for QA.)

---

## Out of scope (explicit)

- **TikTok auto-suggestion.** No live TikTok pull this round (no practical official search API —
  ARCHITECTURE). The existing manual **"Search TikTok"** deep-link in `GeneralStrip` /
  `InlineCandidate` stays as-is. The source interface (AC13) must *accommodate* a future TikTok
  source, but none is built.
- **The production server-side search move.** No Server Actions, Redis, or Postgres this round.
  Note the seam (search moves server-side, key becomes a server secret, the cached set moves to
  Redis — ARCHITECTURE §"Prototype phase" / §"Open questions"), but do **not** build the backend.
- **Precise orientation via a second API call** (`videos.list` for aspect ratio) — deferred
  (Decision 4); the default-horizontal + Shorts-signal rule is sufficient for the prototype.
- **AI-assisted ranking / relevance scoring** of candidates (no in-product AI for end users in the
  MVP — VISION non-goals). Matching is the deterministic keyword heuristic only.
- **oEmbed metadata enrichment** of candidates (creator avatar, follower count). Candidates render
  from the search snippet (title, channel title, thumbnail); oEmbed is the curation/promote path,
  not the suggestion path.
- **Add-by-link** and the **promote → Clip** authoring flow themselves (existing; this feature only
  changes where the *suggested* candidates come from).
- **Multilingual / non-English** search tuning.

---

## Success metric

**Primary:** **empty-state coverage** — the share of uncurated topics (where the key is present)
that render **≥1 relevant candidate** instead of an empty shell. Target: a clear majority of common
encyclopedic topics produce at least the General set; the live source should beat today's mock
source, which covers **exactly one** topic. (Analytics-as-role is deferred — VISION; this metric is
defined here for when instrumentation lands.)

**Supporting signals (define now, instrument later):**

- **Promote rate from live candidates** — of surfaced live candidates, the fraction promoted to a
  curated clip. This is the flywheel signal: candidates good enough to curate. (A high *dismiss*
  rate flags the matching heuristic as too loose — feeds tuning of Decision 2's threshold.)
- **Section-match yield** — average number of sections that receive a relevant inline candidate per
  topic (too low ⇒ threshold too strict; near-every-section ⇒ too loose).
- **Quota efficiency** — API calls per topic-view should trend toward **≪ 1** as the 24h cache
  absorbs revisits (AC11); a value near 1 means the cache isn't working.

**Guardrail (qualitative, per VISION "what good looks like"):** a candidate must never read as
endorsed — the unvetted treatment + absent chips/note (AC4, CURATION §6) hold, so the empty state
helps a reader *start weighing* without being told what to think.

---

## Hand-off notes

- **UX:** confirm microcopy/flows for three states the live source introduces — (a) **keyed +
  results** (the existing empty-state UI, now real data), (b) **keyed + zero results** for an
  obscure topic (what the General band says when a real search returns nothing), and (c) **no key**
  (the local/CI fallback — should be visually identical to today's seeded/empty so contributors and
  reviewers see a sensible page without a key). No new components are expected; the `Candidate`
  contract is unchanged. The "no context yet" candidate language (CURATION §6) already lives in
  `CandidateBits.tsx` and must be preserved.
- **Development:** build the pluggable source + the YouTube source behind
  `DataStore.listCandidates` (the swap stays in `lib/data/`), the per-QID 24h `localStorage` cache,
  the deterministic section-matching + dedup, and the **no-key guard** as the first check on the
  live path. Make the dismissal sticky in `localStorage` (mirror `dismissed_candidate`). Mock the
  YouTube fetch in tests the way the MediaWiki/Wikidata fetches are already mocked (no network in
  the sandbox). Do **not** touch the empty-state components or the `Candidate` type for this. Keep
  `yarn build` + `yarn test` green with **no** key set (AC1).
- **QA & Review:** AC1 (no-key no-op, build/tests green) and AC4 (no stance/accuracy/note on
  candidates) are mandatory pass/fail; plus the security check that the key is env-only (AC15) and
  that all API/quota errors degrade gracefully (AC14).
