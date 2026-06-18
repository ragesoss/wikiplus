# Design spec: Landing page v2 — the video-centric entry point (DESIGN ONLY)

**Role:** UX / Design · **Status:** design spec — **no app code this round** (AC13a; implementation
explicitly deferred) · **Issue:** [#15](https://github.com/ragesoss/wikiplus/issues/15) · **Phase:**
prototype
**Builds on:** the v1 landing design ([`landing-page.md`](landing-page.md)) — v2 *adds to* that page,
it does not replace it. **Source spec:** [`docs/specs/landing-page.md`](../specs/landing-page.md) §5
(in-scope v2 deliverable) + A4.
**Reuse target:** `lib/candidates/` (`matching.ts`, `pipeline.ts`, `types.ts`) — the existing
**topic→candidate** matcher that v2's **video→article** suggestion **inverts**. Feeds the
ARCHITECTURE decision Dev records (AC13b).

> **What this spec is, and is not.** It designs the *experience and the reuse boundary* for a
> video-centric on-ramp: a logged-in curator pastes a high-quality video URL, wiki+ suggests which
> Wikipedia article(s) it belongs to, and offers to start a curation; plus a "curate a suggested
> topic" entry. It states **how these coexist with the v1 search** and **how much of `lib/candidates/`
> the video→article matcher reuses** (the proposal that feeds AC13b). It is **design-level only** —
> states/empty/error/loading at the experience level, no implementation, no UI code. The numbers,
> the suggest API surface, and the exact reuse depth are confirmed when v2 is *built* in a future
> issue (spec A4).

---

## 1. Personas & user stories

### 1.1 Cory — the curator with a clip, no topic in mind (primary for v2)

Cory has found a genuinely good creator video (a TikTok explainer, a YouTube Short) and wants to
contextualize it on wiki+ — but isn't sure *which* Wikipedia topic it belongs to, or whether the
obvious one already exists. v1 forces Cory to first guess the article title and search for it. v2
lets Cory **start from the video.**

- **V1.** *As a curator, I want to paste a video URL and have wiki+ suggest the Wikipedia article(s)
  it belongs to, so I can start a curation from the clip without first guessing the topic.* → §3 flow.
- **V2.** *As a curator, I want to pick from a few suggested topics for my video and go straight into
  curating it on the chosen one, so the paste flows directly into the existing curation form.* → §3.5.
- **V3.** *As a curator with no clip in hand, I want a small list of suggested topics worth curating,
  so I have a way in that doesn't require me to think of a topic.* → §4 "curate a suggested topic".

### 1.2 Rosa / Dev — the anonymous reader (must not be disturbed)

The first-time visitor and the returning reader from v1 still land here. v2 must **not** make the
front door feel like a contribution tool.

- **A1.** *As an anonymous reader, I want search to stay the primary, obvious, get-out-of-the-way
  path, so the page is still "find a topic" and the curation tools don't crowd me.* → §2 coexistence.

**Coexistence is the governing constraint:** search stays primary and anonymous; the video-centric
entries are an **additional, login-gated curation on-ramp** layered *below* the search hero — never a
replacement (spec §5 bullet 3).

---

## 2. How the video entry coexists with search on the landing page

The v1 hero is untouched: **`HeaderProjector` → "Find a topic" search → explanation**, the search the
clear focus (v1 AC1). v2 adds a **distinct, secondary "Curate" zone** below the explanation and
*above or interleaved with* "Explore example topics":

```
┌──────────────────────────────────────────────────────────────┐
│  [ wiki + ]  projector header                                  │
│              Find a topic   [ search …………………… 🔍 ]  ◄ PRIMARY  │
│              wiki+ is a curation & contextualization layer…     │
│  ───────────────────────────────────────────────────────────  │
│  Have a video to contextualize?               ◄ CURATE ZONE    │  ← v2, login-gated, secondary
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Paste a video link…                          [ Suggest ] │ │  ← §3 paste-a-video
│  └──────────────────────────────────────────────────────────┘ │
│  Or curate a suggested topic:  [ Topic ] [ Topic ] [ Topic ]   │  ← §4 suggested topics
│  ───────────────────────────────────────────────────────────  │
│  Explore example topics                       ◄ EXPLORE (v1)   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
└──────────────────────────────────────────────────────────────┘
```

**Coexistence rules (binding for the v2 build):**

1. **Search is visually + ordinally first** and remains anonymous. The Curate zone is clearly
   secondary (smaller heading, `.plus-card`/`hardbox` Indigo-Press framing to read as "the plus
   side"), placed *after* the explanation.
2. **The Curate zone is login-gated, but not login-walled at rest.** Anonymous visitors **see** the
   paste field and the suggested topics (so the affordance is discoverable), but acting — **Suggest**
   on a pasted URL, or **Curate** on a suggested topic — routes through the existing `useRequireLogin`
   gate (the same gate the Topic page's Curate/Add use). No new auth model.
3. **It is an Indigo-Press surface**, visually distinct from the neutral search hero: the paste field
   and topic chips use the committed `.plus-card` / `hardbox-sm` look (indigo, 2px ink border, hard
   offset shadow) so a reader instantly reads "this is the curation/plus side," not "another search."
4. **The video entry never competes for the first action.** On mobile it stacks *below* the search +
   explanation; the search is never pushed below the fold by the Curate zone.

---

## 3. The paste-a-video → suggest-article(s) flow (V1/V2)

The heart of v2 and the inverse of the candidate pipeline (§5).

### 3.1 Entry

A single **"Paste a video link…"** input in the Curate zone (Indigo-Press framed) with a **"Suggest"**
action. Microcopy heading: **"Have a video to contextualize?"**; helper: *"Paste a YouTube or TikTok
link — we'll suggest the Wikipedia topics it fits."* (Platforms named match the embed support already
in ARCHITECTURE: YouTube + TikTok by link; the suggest step needs the video's *metadata*, see §5.2.)

### 3.2 Gate

Activating **Suggest** runs the login gate if anonymous (gate reason `"suggest"`, copy parallel to the
existing `"add"`/`"curate"` gates — Curation/Editorial owns the exact words; UX proposes *"Log in to
suggest a topic for this video"*). No auto-resume on return (the project's C/D1 UX rule). A logged-in
curator proceeds directly.

### 3.3 Resolve the pasted URL → video metadata

We resolve the URL the same way add-by-link already does: **oEmbed / the provider's documented
metadata** (ARCHITECTURE *Video handling*; *Add by link*). We read the **title, description (where
available), tags/channel** — the `searchText`-equivalent the matcher needs (§5.2). **No video is
hosted; embed-never-host is unchanged.**

### 3.4 Match → suggest candidate article(s)

The resolved video metadata is tokenized and scored against candidate Wikipedia articles (§5 — the
inverse matcher). The result is a **short ranked list of suggested topics** (target 3–5), each shown
as an Indigo-Press topic chip/card with: the **article title**, a one-line **description** (Wikipedia
short description), and a **match reason** in the existing non-asserting voice (e.g. *"Mentions
'photosynthesis'"* / *"Top match for this video"* — never asserts quality, mirroring
`matching.ts`'s `matchReason` discipline). Each suggested topic carries a **"Curate here"** action.

### 3.5 Curate on the chosen topic

Choosing **"Curate here"** on a suggested topic takes the curator into the **existing curation flow on
that topic page** — i.e. navigate to `topicHref(<suggested title>)` and open the Add/Curate modal
pre-seeded with the pasted video (the same modal the Topic page already uses for add-by-link). v2 adds
*no* new curation form: it routes the paste into the existing one. The pasted video URL + resolved
metadata are carried into the Add modal so the curator lands on "write the context note," not
"re-paste the link."

> **Reuse note:** §3.5 deliberately funnels into the *existing* Add-by-link → CurateModal path
> (`TopicView`'s `onAddSubmit` / `persistClip`), so v2 is an *on-ramp to* the shipped curation flow,
> not a parallel one.

---

## 4. The "curate a suggested topic" entry (V3)

For a curator **without a clip in hand**: a small **"Or curate a suggested topic"** row of Indigo-Press
topic chips, offering a way into curation that starts from a suggested topic rather than a search.

- **Source of the suggestions (design-level, deferred):** the simplest v2 source is **uncurated /
  thinly-curated seeded topics** (topics with zero or few clips — read from the existing
  `store.listTopics()` + clip counts), surfaced as "topics that could use curation." A richer future
  source (trending Wikipedia topics, gaps) is out of scope for the v2 *design* and is a forward note.
- **Action:** each chip's **"Curate"** runs the same login gate (§2 rule 2) then navigates to that
  topic's page (its empty/curate state — the existing create-on-demand empty state is already an
  invitation to curate, per VISION + v1). No new screen.
- **Distinct from "Explore example topics" (v1):** the v1 explore grid is **anonymous, read-first**
  ("go read this topic"); the v2 suggested-topics row is **curation-first** ("come *add* to this
  topic"), login-gated, and Indigo-Press framed. They can sit adjacent but must be labeled distinctly
  so the reader isn't confused about which is "read" vs. "contribute."

---

## 5. Relationship to `lib/candidates/` — the reuse boundary (feeds AC13b)

v2's video→article suggestion is the **inverse direction** of the shipped pipeline:

- **Today (topic→candidate):** given a topic's title + article section keywords, rank YouTube *video*
  results. `matching.ts` tokenizes section titles, scores candidate video `searchText` against them;
  `pipeline.ts` orchestrates a pluggable source + dedup + placement + cache.
- **v2 (video→article):** given **one video's metadata** (title/description/tags), rank candidate
  **Wikipedia articles**. The *scoring substrate* is the same — tokenize text, score keyword overlap,
  rank by a deterministic tie-break, attach a non-asserting `matchReason` — only the **direction**
  flips: the video is now the *query* and articles are the *results*.

### 5.1 Proposed reuse boundary (REUSE / NEW)

| `lib/candidates/` piece | v2 verdict | Why |
|---|---|---|
| **`tokenize()`** (lowercase, split non-alphanumerics, drop stopwords + ≤2-char tokens) — `matching.ts` | **REUSE as-is** | The tokenizer is direction-agnostic. The video's title/description tokenizes exactly like a section title does today. The stopword list (incl. "video", "youtube", "watch", "explainer") is *already tuned for video text* — ideal for the video-as-query side. |
| **`sectionKeywords()` / distinct-keyword scoring + deterministic tie-break (`isBetter`)** — `matching.ts` | **REUSE the heuristic shape** (generalize, don't fork) | The "distinct non-generic keyword overlap, title-weighted, deterministic tie-break" scoring is the matcher's reusable core. v2 scores a *video's tokens* against an *article's tokens* (title + short description + section titles) — the same overlap math, applied to article candidates. Generalize the existing functions to "score a query token-set against a candidate token-set" rather than re-implementing. |
| **`matchReason` copy discipline** (`sectionMatchReason`/`generalMatchReason` — names a keyword, never asserts quality, no platform stutter) — `matching.ts` | **REUSE the discipline** (new strings) | v2 needs the same non-asserting reason voice (§3.4), with article-side wording (*"Mentions 'X'"*, *"Top match for this video"*). Same rule, new copy. |
| **`CandidateSource` / `RawCandidate` pluggable-source shape** — `types.ts` | **REUSE the *pattern*, define a new article-source interface** | The pipeline's value is "a pluggable source returns provider-neutral normalized hits; a pure matcher ranks them." v2 wants the **mirror**: a pluggable **article-candidate source** (e.g. a Wikipedia search/`opensearch` call that returns candidate articles for the video's keywords) returning normalized article hits, ranked by the reused scorer. Define a parallel `ArticleCandidateSource` shape *modeled on* `CandidateSource` — reuse the design, not the YouTube type. |
| **`pipeline.ts` orchestration + 24h cache + no-key/error posture** | **REUSE the *posture*, new orchestration** | The pipeline's discipline (one call per query, dedup, cache with TTL, silent degrade on no-source/error, never throw to React) is exactly right for v2 and should be mirrored. The *specific* dedup-against-curated/dismissed logic is topic-scoped and does not apply; v2's orchestration is "tokenize the video → query the article source → score → rank → cache by video id." |
| **`youtube.ts` (the YouTube Data API source)** | **NOT reused** | That is the *video* source for the topic→candidate direction. v2's source queries **Wikipedia for articles** (the inverse), so it is a new source — but built to the reused pluggable-source *pattern*. |
| **`placeCandidates()` (section placement, one-home-per-video)** | **NOT reused** | Section placement is specific to laying candidates into a topic's sections. v2 produces a *flat ranked list of articles* for one video, not a section layout. |

### 5.2 The video→article suggest input (design-level; confirmed at build — A4)

The matcher's query side reads the resolved video's **title + description + tags/channel** joined into
a `searchText`-equivalent, tokenized by the reused `tokenize()`. The candidate-article side: a
pluggable article source returns candidate articles (title + short description; the existing Wikipedia
`opensearch`/REST search the v1 `TopicSearch` typeahead already uses, `lib/wiki/suggest.ts`, is the
natural first source — key-free, anonymous, CORS), each tokenized the same way; the reused scorer ranks
overlap; the top 3–5 become suggested topics. **How rich the matcher gets** (e.g. weighting tags vs.
title, pulling article section titles into the candidate token-set) is a build-time decision (A4) — the
*reuse boundary* above is the design commitment.

### 5.3 The architecture decision this proposal feeds (AC13b)

Dev records in `docs/ARCHITECTURE.md` (in/adjacent to *Candidate suggestion & the empty state*): the
v2 video→article suggestion is the **inverse direction** of the existing candidate pipeline and is
expected to **reuse its tokenizer + keyword-scoring heuristic + the pluggable-source pattern** (a
mirror `ArticleCandidateSource`, an article-side scorer generalized from `matching.ts`, the
pipeline's cache/no-key/silent-degrade posture) rather than introduce a parallel matcher. **Decision
recorded now; implementation deferred** to a future issue.

---

## 6. States — design level (every state of the v2 flow)

The build-loop gate "cover every state" applies at the design level here (no code this round).

### 6.1 Paste-a-video flow states

| State | When | What the curator sees |
|---|---|---|
| **Idle** | Curate zone at rest | The "Paste a video link…" field + "Suggest" action + helper text. Anonymous users see it too (§2 rule 2). |
| **Gate** | Anonymous activates "Suggest" | The login gate (reason `"suggest"`); on return, no auto-resume — the curator re-pastes/re-activates. |
| **Resolving** | After Suggest (signed in), resolving the URL via oEmbed/metadata | A calm inline progress affordance (e.g. "Looking up that video…"), `role="status"`, polite — never a blocking spinner over the whole page. |
| **Suggestions** | Match returns ≥1 article | A short ranked list of suggested-topic chips/cards, each with title + description + non-asserting match reason + "Curate here". |
| **No match** | Match returns 0 articles | Non-blocking, honest line: *"No topic match found — search for the topic instead"* with a link/affordance back to the v1 search (search is the fallback, never a dead end). Mirrors v1's no-results posture. |
| **Unsupported / unresolvable URL** | The pasted text isn't a resolvable video URL (bad link, unsupported platform, oEmbed fails) | An inline, non-blocking error: *"Couldn't read that video link — check it's a public YouTube or TikTok URL."* No stack, no page error; the field keeps the typed text. |
| **Resolve/network error** | oEmbed or the article source fails | Silent-degrade posture (like the candidate pipeline): a polite *"Couldn't suggest topics right now — try again, or search for the topic."* The page never breaks; search remains. |

### 6.2 Suggested-topics row (V3) states

| State | When | What the curator sees |
|---|---|---|
| **Loading** | Suggestions being read (uncurated/thin topics) | A quiet "Loading…" or skeleton chips; non-blocking. |
| **Populated** | ≥1 suggested topic | The Indigo-Press chip row, each with "Curate". |
| **Empty** | No suggested topics available | Hide the row (or a muted *"No suggestions right now — search for a topic to curate."*). Never an empty error. |
| **Read error** | The topic/clip-count read fails | A muted honest line, consistent with the v1 topic-list read-error floor; never a hang. |
| **Gate (per-chip)** | Anonymous activates "Curate" | The login gate (reason `"curate"`), then navigate to the topic's empty/curate state. |

### 6.3 Accessibility (carry forward from v1 + the inherited gates)

- The Curate zone is keyboard-reachable **after** the search hero (search stays the first interactive
  target — §2 rule 4). The paste field is a labeled text input; "Suggest" and per-chip "Curate" are
  buttons with clear accessible names.
- Progress/no-match/error lines are `role="status"` `aria-live="polite"` (non-blocking, never
  `assertive`) — the same posture as the Topic page's dismissal/upvote notices.
- Indigo-Press color framing is **not** the only signal that the zone is "curation" — the heading
  ("Have a video to contextualize?") and labels carry it in text (never color alone).
- The login gates reuse the existing `useRequireLogin` model (focus management, expired-session
  handling) — no new a11y surface.

---

## 7. Out of scope for v2 (this round)

- **All implementation** — no app code, no `lib/` changes, no new components this round (AC13a; spec
  Out of scope). v2 is built in a future issue.
- A **full search-results page** or non-Wikipedia search — unchanged from v1.
- A **richer suggested-topics source** than uncurated/thin seeded topics (trending, gap analysis) — a
  forward note, not designed here.
- **Moderation / quality gating** of pasted videos beyond the existing curate flow's discipline —
  Curation/Editorial's domain.
- Confirming the **exact suggest API surface + reuse depth** — resolved at build (spec A4); §5 fixes
  the *boundary*, not the signatures.

## 8. Hand-off

- **Development (future issue):** build the paste-a-video → suggest flow + the suggested-topics entry
  per §2–§6, reusing `lib/candidates/` per the §5 boundary (generalize the tokenizer + scorer; mirror
  the pluggable-source pattern as an `ArticleCandidateSource`; reuse the pipeline's cache/no-key/silent
  posture; do **not** fork a parallel matcher). Funnel "Curate here" into the **existing** Add/Curate
  flow (§3.5) — no new curation form. Honor the coexistence rules (§2) — search stays primary/anonymous.
- **Development (this round, AC13b):** record the inverse-direction + reuse-not-reinvent architecture
  decision in `docs/ARCHITECTURE.md` (§5.3), implementation deferred.
- **Curation / Editorial:** owns the exact gate microcopy for the new `"suggest"` gate reason and the
  vetting expectations for paste-sourced curations.
- **Product:** the v2 success metric (curation on-ramp usage) and whether v2 graduates to a built issue.
