# Design Spec: Live YouTube candidate auto-suggestion

- **Status:** Draft for build-loop (UX) — input to Development, written before code.
- **Owner:** UX / Design
- **Designs from:** `docs/specs/youtube-autosuggest.md` (Product spec; resolves 5 decisions, 15
  acceptance criteria). Built on the committed baseline: `docs/TOPIC_PAGE_DESIGN.md` (§Empty state,
  Indigo Press identity), `docs/CURATION_STANDARD.md` §6 (unvetted-candidate rule), and the
  reference mockups `mockups/inline-indigo-empty-v2.html` (empty) / `inline-indigo-sync.html`
  (curated).
- **Designs for (existing components — behavior/microcopy only, NOT a redesign):**
  `components/topic/GeneralStrip.tsx`, `components/topic/InlineCandidate.tsx`,
  `components/topic/CandidateBits.tsx`, and the load/state plumbing in `app/topic/TopicView.tsx`.
- **Hand-off:** Development implements; QA & Review + UX evaluate the built UI against this spec.

---

## 1. What this spec is (and is NOT)

The Product spec swaps the candidate **data source** behind `DataStore.listCandidates(topicQid)`
from a seeded mock to a **live, cached YouTube Data API search**. The empty-state UI already exists
and already consumes `Candidate[]`. This spec is therefore **not** a component redesign. It is the
**buildable contract for the new runtime states** the live source introduces — loading, zero
results, no-key fallback, error/quota — plus the **microcopy** for `matchReason`, the unvetted
labeling, and the now-**sticky** dismissal.

**No new components. No change to the `Candidate` type. No new chips.** Every state below is
expressed through the components that exist today. Where a state needs a visual treatment the
components don't yet render (a loading skeleton, a "nothing found" line), it is specified as a
small, additive branch inside the *existing* component — called out explicitly so Dev and QA can
trace it.

**The non-negotiable carried forward (CURATION §6, AC4):** a candidate stays visibly
un-vouched-for. No `stance` chip, no `accuracy` chip, no context note — only the outline
`SuggestedBadge`, the `MatchReason` block, and the "No context yet — a human hasn't reviewed this."
hint. Live data does **not** change this; real results are still suggestions, not endorsements.

---

## 2. Personas served

- **The Reader (anonymous, primary).** Lands on a Topic page from search or a wikilink. Most
  arrivals hit an *uncurated* topic, so the empty state is their first impression of wiki+. They
  want to know "is there anything worth watching here, and can I trust it?" — and they must never
  be misled into thinking an auto-found video is vouched-for. The live source exists to turn a dead
  empty shell into "here's what's out there for *this* topic; help us weigh it."
- **The would-be Curator (anonymous → logs in to act).** Sees the same candidates as a *worklist*:
  real, relevant videos one "Promote" click from becoming a contextualized clip. They need honest
  `matchReason` lines (why did this surface?) and a frictionless dismissal for the ones that don't
  belong — and the dismissal must *stick* so their triage isn't lost on reload.
- **The Contributor / Reviewer without an API key (every local/cloud/CI build).** Opens the app
  with no `NEXT_PUBLIC_YOUTUBE_API_KEY`. They must see a **sensible, coherent page** — identical to
  today's seeded/empty behavior — never a "search is broken" error. This persona is why the no-key
  path is a first-class design state, not an afterthought.

---

## 3. User stories (these feed Product's acceptance criteria)

1. *As a reader on an uncurated topic, I want to see a few real, clearly-unvetted videos for this
   exact topic, so the page is a useful starting point instead of an empty shell.* → AC2, AC3
2. *As a reader, I want each suggestion to tell me plainly why it showed up — and never to claim
   it's accurate or good — so I can weigh it myself.* → AC6, AC4
3. *As a reader on a genuinely obscure topic, I want an honest "nothing found yet" rather than a
   broken or misleadingly-empty page, so I trust the product's honesty.* → AC2 (zero-results)
4. *As a would-be curator, when I mark a suggestion "Not relevant," I want it to stay gone after I
   reload, so my triage isn't wasted.* → AC9
5. *As a contributor or reviewer running the app with no API key, I want the page to look like a
   normal sensible empty/seeded state, so I can work without secrets and never debug a phantom
   "search failed."* → AC1, AC14
6. *As any user on a slow first visit, I want a clear, announced "looking for videos" state rather
   than a flash of "nothing here," so I'm not misinformed while the search is in flight.* → AC2,
   AC11 (loading before the 24h cache is warm)
7. *As a user on a phone, I want the suggested band and inline suggestions to be fully usable in one
   column with thumb-reachable actions, since the whole build loop is mobile-drivable.* → responsive

---

## 4. The flow (what happens, per state)

`TopicView` resolves the topic, then calls `store.listCandidates(qid)`. Today that call resolves
synchronously-ish from `localStorage`/seed. With the live source it may: hit a warm cache (instant),
run a network search (latency), find nothing, hit no key, or error. The UI must distinguish these
**five outcomes**. They collapse into **three visible faces**:

| # | Source outcome | Visible face | Spec §§ |
|---|---|---|---|
| 1 | Keyed + cache hit, **or** keyed + live results | **Populated** suggested state (today's UI, real data) | §5.1 |
| 2 | Keyed, live search in flight (cold cache, first visit) | **Loading** suggested state (skeleton + announce) | §5.4 |
| 3 | Keyed + live search returns **zero** results | **Empty-empty** honest state | §5.2 |
| 4 | **No key** (local/cloud/CI) → seeded/empty fallback | **Identical to today's seeded/empty** — never an error | §5.3 |
| 5 | Search **errors / quota-exceeded** → degrades to seeded/empty | **Same as #3 or #4** (graceful), never an error dump | §5.5 |

Critical design rule binding #4 and #5: **a missing key and a failed search look like a normal
empty state, not a malfunction.** There is no "search is broken" UI in this feature.

---

## 5. State-by-state contract

All five states live inside `GeneralStrip` (`mode="empty"`) and the inline/rail candidate
components. The infobox suggestion count (`liveCandidates.length`) and the TOC suggestion badges
follow from the candidate array, so they're covered transitively — each state notes what they show.

### 5.1 Populated — keyed + results (AC2, AC3, AC4, AC6, CURATION §6)

**The visual contract does NOT change.** Real candidates render through exactly the path
`mockups/inline-indigo-empty-v2.html` established and the current components already implement:

- **General/Suggested band** (`GeneralStrip`): heading `＋ Suggested videos`, the `uncurated`
  outline tag, the sub-line `— auto-found candidates, not yet vetted`, and the count tag
  (`N candidates`). Up to **5** general tiles (AC3), each: desaturated/hatched candidate thumbnail
  (`VideoThumb … candidate`), outline `SuggestedBadge`, caption, `handle · platformLabel`, the
  `MatchReason` block on white, and the `Promote` / `Not relevant` actions.
- **Inline section candidates** (`InlineCandidate`): rendered *after* a matched section's
  paragraphs, never interrupting them — one per matched section (AC5). Dashed-border `candcard`,
  `SuggestedBadge` + "Suggested for this section", thumbnail, caption, creator line, `MatchReason`,
  actions, and the existing "Search TikTok for '<section>' ↗" deep-link footer.
- **Rail candidate cards** (`CandidateCard`): mirror the clip-card footprint, dashed, with the
  `General`/section label, `SuggestedBadge`, `MatchReason`, actions.

**Confirm (no change required), for QA traceability:**
- Candidates carry **no** stance/accuracy chip and **no** context note — only `MatchReason` +
  "No context yet" (AC4, CURATION §6). The `Candidate` type structurally forbids chips; the design
  forbids adding any.
- The thumbnail stays in the unvetted treatment (desaturated + hatch) regardless of data source —
  a real YouTube thumbnail must still render *as a candidate*, not as a curated clip.
- A given video appears **once** on the page (AC7) — this is the source's job; the UI renders
  whatever array it's handed, so no duplicate-suppression logic belongs in the components.
- Infobox shows `N suggestions`; TOC `＋ Suggested` row and per-section rows show their
  dashed/outline candidate counts.

### 5.2 Empty-empty — keyed + zero results (story 3; honest empty state)

A real search for an obscure topic can legitimately return nothing (after dedup, even a few results
may all be already-curated or dismissed). Today the components have **no** zero-candidates branch —
the band renders its header and an **empty tile row**, which reads as "broken/still loading." We
fix that with a small honest message. **This is the one net-new visual the feature requires.**

**Band (`GeneralStrip`, `mode="empty"`, `generalCandidates.length === 0` AND not loading):**
- Keep the header `＋ Suggested videos`, but the count tag reads **`0 candidates`** (use the existing
  `pluralize` — it must produce "0 candidates", confirm pluralize handles 0).
- Replace the empty tile row with a single full-width honest line, styled as a quiet panel on the
  indigo band (white text, no tile chrome):

  > **Microcopy (band, zero results):**
  > "No videos found for this topic yet. Try a manual search below, or add one by link."

- The **"Find more" action group stays** (Search TikTok ↗ / Search YouTube ↗ / ＋ Add video) — it
  is the user's escape hatch and the honest next step. It must remain visible in this state.
- **Inline section candidates:** none render (there are no candidates to match). Sections simply
  show their article text with no suggestion block — correct and quiet, no placeholder.
- **Rail:** shows no candidate cards. Add a quiet rail line mirroring the curated-mode empty line:

  > **Microcopy (rail, zero results):**
  > "No suggestions for this topic yet — use 'Find more' above to add the first video."

- **Infobox:** suggestion count is `0`; the existing empty-state "invite to curate" CTA
  (`onCurateFirst`) remains — but with zero candidates it should scroll to the band's "Find more"
  group rather than open Curate on a nonexistent first candidate. (Behavior already falls through to
  `scrollIntoView` when `liveCandidates[0]` is null — confirm and keep.)
- **TOC:** `＋ Suggested` row shows count `0`; section rows show `0`. No dashed badge needed at 0.

**Why this copy:** it is honest (says nothing was *found*, not that nothing *exists*), it never
implies a failure ("yet" + a clear next action), and it routes to the manual paths that are the
whole point of the empty state. It must read identically whether zero is because the topic is
obscure (5.2) or because the search errored/degraded (5.5) — the user is told the truth at their
level of need without an error dump.

### 5.3 No-key fallback — local / cloud / CI (AC1, story 5)

With `NEXT_PUBLIC_YOUTUBE_API_KEY` unset, the live path **must not run** and the result must be
**pixel-identical to today's behavior**: the seeded candidates for the one demo topic (`Cellular
respiration`), and the *normal empty state* (the 5.2 honest line) for every other topic — because
with no key and no seed there are genuinely no candidates.

**Design requirement — there is NO "no-key" UI.** Do **not** add a banner, a tooltip, a disabled
state, or any "set an API key" affordance to the reader-facing page. The reader/reviewer must not
be able to tell a key is missing. Concretely:

- A seeded topic with no key → renders **populated** (§5.1) from seed, exactly as today.
- An unseeded topic with no key → renders the **empty-empty honest state** (§5.2). The "No videos
  found for this topic yet…" line and the "Find more" manual paths are the correct, sensible page —
  not an error.
- `yarn build` and `yarn test` stay green with no key (AC1) — the UI never depends on the key being
  present.

(If a developer wants a console hint that the live path is dormant, that's a Dev/log concern, **not**
a UI element. Nothing about the missing key surfaces to the user.)

### 5.4 Loading — live search in flight (story 6; AC2/AC11 cold cache)

On the **first** visit to an uncurated, keyed topic (cache cold), the live search has real latency.
Today `TopicView` gates the whole plus side on `storeReady`, and `listCandidates` is awaited inside
a `Promise.all` — so a slow search would block the infobox, TOC, and band from appearing at all,
making the page feel hung. The design needs a **distinct, announced loading face** for the suggested
content, decoupled from the article fetch (which has its own `ArticleSkeleton`).

**Design requirement:** while candidates are loading (live search pending, no cached set yet), the
band shows a **skeleton suggested state**, and it is **announced to assistive technology**.

- **Band header renders immediately** (`＋ Suggested videos` + `uncurated` tag) so the page
  structure is stable. The count tag shows **`Finding videos…`** instead of a number while loading.
- **Tile row:** render **3 skeleton placeholder tiles** — the candidate thumbnail box in a muted
  shimmer/static fill (reuse the candidate desaturated treatment; no real image), with two short
  gray bars for caption/creator. No badge, no actions on a skeleton (nothing to act on yet).
- **Accessibility (required):** the band's tile container gets `aria-busy="true"` while loading, and
  a visually-hidden live region announces the transition:
  - on entering loading: a polite live region (`aria-live="polite"`) reads
    **"Looking for suggested videos…"**
  - on resolve: it updates to **"Found N suggested videos."** (or, for zero, **"No suggested videos
    found."**). One announcement per resolution; do not spam on re-render.
- **"Find more" manual group:** show it during loading too (it doesn't depend on the search) so the
  user always has an immediate path.
- **Inline + rail:** no skeletons inline (they'd disrupt the article); the rail may show a single
  quiet "Looking for suggestions…" line, `aria-live="polite"`, replaced when results arrive.
- **Decouple from the article:** the suggested-loading state is independent of `fetchState` for the
  article. The article can be ready while suggestions still load, and vice-versa.

**Plumbing note for Dev (design-driven, not prescribing code):** the current `Promise.all` that
awaits clips + candidates together should be split so a slow `listCandidates` does not delay
`storeReady` / the article-adjacent chrome. Surface a `candidatesLoading` flag the band can read.
This is a behavior the design requires; the exact state shape is Dev's.

**Reduced motion:** the skeleton shimmer must respect `prefers-reduced-motion` — a static muted
placeholder (no animation) when reduced motion is set. (`TopicView` already tracks
`prefersReduced`.)

### 5.5 Error / quota-exceeded — degrade silently (AC14, story 5)

Per AC14 any API error, rate-limit, or quota-exceeded response is **caught and degrades to
seeded/empty**. The design consequence: **the user sees the graceful empty state (§5.2) or the
seeded state — never an error.**

- A keyed topic whose search throws/quota-fails → renders **exactly** the §5.2 empty-empty honest
  state ("No videos found for this topic yet…"). No error toast, no red banner, no "retry search"
  button, no stack/quota message anywhere in the UI.
- A seeded topic that errors on the live refresh → keeps showing the **last good / seeded**
  candidates (cache + seed are the fallback); the user sees a normal populated page.
- **Distinction from the article error state:** the *article* fetch failing still shows
  `ArticleError` (with retry) — that's an existing, separate contract and stays. The *candidate*
  search failing must **not** mimic it. Suggestions degrading is a quiet non-event by design;
  the article failing is a loud, recoverable event. Keep them visually and behaviorally separate.

**Why silent:** candidates are a bonus layer over the article. A reader who came for the
encyclopedia article should never be confronted with a YouTube-quota error. Honesty here means "we
have no suggestions to show," not "our integration broke" — the second is noise the reader can't act
on.

---

## 6. Microcopy

### 6.1 `matchReason` templates (AC6 — honest, never asserts quality)

`matchReason` is the honest "why it surfaced" line that *replaces* a context note on a candidate. It
renders inside `MatchReason` as `{source} · {matchReason}` under the "Auto-suggested" eyebrow, above
the "No context yet — a human hasn't reviewed this." hint. **It describes why it matched; it must
never assert accuracy, quality, or endorsement** (no "best," "top-quality," "trusted," "accurate").
"Top result" is acceptable — it describes the search rank, a factual position, not a quality claim.

Templates (Dev fills the `<…>` slots; keep the exact wording, casing, and the `·` separators):

- **General candidate** (`general: true`):
  - Template: **`Top result · YouTube search '<topic title>'`**
  - Example: `Top result · YouTube search 'cellular respiration'`
  - For the 2nd–5th general tiles, "Top result" still reads honestly (they *are* among the top
    results); do not number them. If Dev prefers to distinguish, the only allowed variant is
    **`From YouTube search '<topic title>'`** (drop "Top result") for ranks 2+. Pick one and be
    consistent. "Top result" for rank 1 + "From YouTube search…" for the rest is the preferred split.
  - Rendered with the component's `source` prefix this reads:
    `YouTube · Top result · YouTube search 'cellular respiration'` — the doubled "YouTube" is
    redundant. **Design fix:** since `MatchReason` already prepends `candidate.source` ("YouTube"),
    the `matchReason` string itself should **not** repeat the platform. Use:
    - General rank 1: **`Top result for '<topic title>'`**
    - General rank 2+: **`Search result for '<topic title>'`**
    - so the rendered line is `YouTube · Top result for 'cellular respiration'`. (This honors AC6's
      intent — names the source + the topic search — without the stutter. QA: verify the rendered
      line names YouTube once and the topic once.)

- **Inline / section candidate** (`general: false`, has `sectionLabel`):
  - Template: **`Mentions '<matched keyword>' · matched to '<section label>'`**
  - Example: `Mentions 'glycolysis' · matched to 'Glycolysis'`
  - When the matched keyword and section label are effectively the same word, collapse to:
    **`Matched to the '<section label>' section`** (avoids "Mentions 'glycolysis' · matched to
    'Glycolysis'" reading as a stutter). Prefer naming a *distinct* matched keyword when one exists
    (per Decision 2 the qualifying keyword is non-topic-generic), since that's the more honest "why."
  - Rendered: `YouTube · Mentions 'glycolysis' · matched to 'Glycolysis'`.

**Rules for the template (so QA can check any topic):**
- Always names *why* (a search position or a matched keyword/section). Never a quality word.
- Single-quote user/topic-derived strings; keep them lowercase only if the source is lowercase —
  use the topic title and section label as given (don't force-case).
- Non-empty for every candidate (AC6) — a general candidate always has at least the topic; a section
  candidate always has at least its section label.

### 6.2 Unvetted labeling — confirmed, unchanged (CURATION §6, AC4)

These already exist and **must be preserved verbatim**:

- `SuggestedBadge` → outline badge reading **`Suggested`** (uppercase, letter-spaced). Keep outline
  (border, white fill) — never a solid/filled badge (filled = curated).
- `MatchReason` eyebrow → **`Auto-suggested`** (with the decorative 🔍, `aria-hidden`).
- `MatchReason` hint → **`No context yet — a human hasn't reviewed this.`** (italic, muted).
- `GeneralStrip` empty header → **`＋ Suggested videos`**, tag **`uncurated`**, sub-line
  **`— auto-found candidates, not yet vetted`**.
- `InlineCandidate` label → **`Suggested for this section`**.

No copy change here. The only addition is the count-tag verb during loading (`Finding videos…`,
§5.4) and the zero-results lines (§5.2).

### 6.3 Dismissal — now sticky (AC9, Decision 3; story 4)

Today `dismiss` only updates in-memory `dismissed` state; on reload the candidate returns. The spec
makes dismissal **sticky** in `localStorage`. **Design of the affordance and feedback — keep it
lightweight, no modal, no undo dialog:**

- The control stays the existing **`✕ Not relevant`** button in `CandidateActions` (label and
  `aria-label="Dismiss as not relevant: <caption>"` unchanged).
- **Feedback on dismiss:** the candidate **animates out** (collapse/fade, ~150ms, respecting
  `prefers-reduced-motion` → instant removal) and is gone. The infobox suggestion count and the
  TOC/band count tags **decrement immediately** (they already derive from `liveCandidates`). That
  count change *is* the confirmation — no toast required for the prototype.
- **Persistence:** the dismissal is recorded per `(topicQid, platform, videoId)` so the **same
  candidate does not reappear** on reload or on the next (cache-warm or re-fetched) load (AC9). The
  UI doesn't need to show that it persisted; the proof is that it stays gone — which is exactly the
  user's mental model ("I told it no; it listened").
- **Undo:** **out of scope** for this round (keep it lightweight). A dismissed candidate is gone;
  re-surfacing it is not a designed path here. (Note for a future round: an "undo" snackbar or a
  "show dismissed" affordance could be added; not now.) If the band empties to zero via dismissals,
  it transitions to the §5.2 zero-results face — which still offers "Find more," so the user is
  never stranded.
- **No confirmation prompt.** Dismissal is reversible-enough (it only hides a suggestion, destroys
  no user work) that a confirm dialog would be friction. One click, gone.

---

## 7. Responsive behavior (mobile-first; the loop is mobile-drivable)

The two-column sync collapses to a single column below `lg` (existing `lg:grid-cols-[1fr_360px]`).
The candidate states must be fully usable in that single column.

- **General/Suggested band:** stays full-bleed; tiles stay in a **horizontally-scrollable row**
  (`overflow-x-auto`) on all widths — this is the established pattern and works on mobile. On
  narrow screens the header wraps (`flex-wrap` already present): heading, `uncurated` tag, sub-line,
  count tag stack gracefully. Tiles keep `w-44 shrink-0` so they don't crush; the row scrolls.
- **"Find more" action group:** wraps to multiple rows on narrow screens (`flex-wrap` present).
  Buttons keep a **≥44px touch target height** — current `py-1` text buttons are borderline; Dev
  should ensure the tappable area is ≥44px (padding or min-height) on touch. Required for mobile.
- **Loading skeleton tiles:** same `w-44 shrink-0` row; show ~3 so the row hints "more loading"
  without overflowing a phone.
- **Zero-results line:** full-width within the band's `max-w-[1200px] px-5` container; wraps
  naturally; readable single-column.
- **Inline section candidates:** already a stacked flex card; on mobile the thumbnail + text column
  stay side-by-side but Dev must confirm the thumbnail doesn't crowd out the caption below ~360px —
  allow the text column to wrap under the thumb if needed.
- **Rail candidate cards:** in single-column the rail flows below the article; cards are full-width;
  actions wrap (`flex-wrap` present). Loading/zero rail lines render inline in that flow.
- **Actions on touch:** `Promote` / `Not relevant` keep ≥44px touch targets and ≥8px gap so they're
  not mis-tapped on a phone.

---

## 8. Accessibility requirements (baseline, written into the contract)

Per CLAUDE.md principles and `docs/TOPIC_PAGE_DESIGN.md`. Every state above must satisfy:

- **Loading announced (required, §5.4):** `aria-busy="true"` on the candidate container while
  loading; a polite live region announces "Looking for suggested videos…" → "Found N suggested
  videos." / "No suggested videos found." Screen-reader users must learn the search happened and
  resolved — they can't see the skeleton.
- **Zero-results is real text (§5.2):** the "No videos found for this topic yet…" line is rendered
  text (read by AT), not a styling-only absence. The empty band must not be a silent void to a
  screen reader.
- **Never color alone:** the unvetted signal is carried by the **`Suggested` text badge** and the
  **"No context yet" text**, not by the dashed border / desaturation alone (those reinforce). The
  `uncurated` tag is text. This already holds — keep it.
- **Focus states:** every actionable control (Promote, Not relevant, Search TikTok/YouTube ↗, Add
  video, the inline TikTok deep-link) has a **visible focus ring** meeting AA. Skeleton tiles are
  **not** focusable (nothing to do).
- **Keyboard:** the horizontally-scrollable tile row must be reachable and operable by keyboard —
  actions are real `<button>`s (they are), so Tab order works; ensure the scroll row doesn't trap or
  hide focused actions (focused tile should scroll into view).
- **AA contrast:** white text on the indigo `#676EB4` band already passes AA for the body sizes used;
  re-confirm the new zero-results line and the `Finding videos…` tag (white on indigo) meet AA. The
  white `MatchReason` panel uses ink text on white — passes. No new color pairings are introduced.
- **Dismissal feedback (§6.3):** the count decrement is perceivable; the removed candidate's focus
  must move sensibly (don't strand focus on a removed node — move to the next candidate's action or
  the band heading). Required for keyboard/AT users.
- **Reduced motion:** skeleton shimmer and dismiss animation both respect `prefers-reduced-motion`
  (static / instant).

---

## 9. Traceability — states ↔ acceptance criteria

| Design state / element | Spec AC | Notes |
|---|---|---|
| §5.1 Populated, no chips/note, thumbnail stays unvetted | AC4, CURATION §6 | Mandatory; structurally enforced |
| §5.1 ≤5 general tiles | AC3 | UI renders the array; source caps at 5 |
| §5.1 one inline per matched section | AC5 | `inlineCandidates` map already de-dupes by section |
| §5.1 one placement per video | AC7 | Source's job; UI must not duplicate-render |
| §5.2 zero-results honest line (band + rail) | AC2 (zero case) | Net-new copy; only added visual |
| §5.3 no-key looks identical to seeded/empty; no "broken" UI | AC1 | No key-aware UI element exists |
| §5.4 loading skeleton + `aria-busy` + live-region announce | AC2, AC11 | Cold-cache first visit |
| §5.5 error/quota → silent degrade to §5.2/seeded | AC14 | No error UI for candidates |
| §6.1 `matchReason` honest templates | AC6 | Names source + why; never quality |
| §6.2 Suggested badge / "No context yet" preserved | AC4, CURATION §6 | Verbatim, unchanged |
| §6.3 sticky dismissal, count decrement, no resurface | AC9 | localStorage; lightweight, no undo |
| §7 mobile single-column, ≥44px targets | (responsive) | Mobile-drivable loop |
| §8 a11y: announce loading, text signals, focus, AA | (a11y baseline) | Gate requirement |

---

## 10. Hand-off

**What Development must build (to this spec):**
1. **Zero-results honest state (§5.2)** — in `GeneralStrip` (`mode="empty"`, no candidates, not
   loading): replace the empty tile row with the line *"No videos found for this topic yet. Try a
   manual search below, or add one by link."*, keep the "Find more" group, show `0 candidates`. Add
   the rail zero line *"No suggestions for this topic yet — use 'Find more' above to add the first
   video."* Confirm `pluralize(0, "candidate")` → "0 candidates".
2. **Loading state (§5.4)** — a `candidatesLoading` flag (decouple `listCandidates` from the
   `storeReady`/article gating so a slow search doesn't block the page); skeleton header + 3
   skeleton tiles; count tag reads `Finding videos…`; `aria-busy="true"`; a polite `aria-live`
   region announcing "Looking for suggested videos…" → "Found N suggested videos." / "No suggested
   videos found."; rail "Looking for suggestions…" line; respect `prefers-reduced-motion`.
3. **`matchReason` honest copy (§6.1)** — produced by the source (not the UI), per the templates:
   general rank 1 `Top result for '<topic>'`, rank 2+ `Search result for '<topic>'`; section
   `Mentions '<keyword>' · matched to '<section>'` (collapse to `Matched to the '<section>' section`
   when keyword == section). Never a quality word. The UI prepends `source` ("YouTube") once — the
   `matchReason` string must not repeat the platform.
4. **Sticky dismissal (§6.3)** — persist `(topicQid, platform, videoId)` to `localStorage`; wire
   `onDismiss` to persist so the candidate doesn't resurface (AC9); animate-out + count decrement as
   confirmation (no toast, no undo, no confirm dialog); move focus sensibly on removal;
   `prefers-reduced-motion` → instant.
5. **No-key / error parity (§5.3, §5.5)** — ensure the no-key and error/quota paths render the §5.2
   or seeded state with **no** key-aware or error UI for candidates; the article `ArticleError`
   contract stays separate and unchanged.
6. **Preserve** (do **not** modify): the `Candidate` type, the chip/note absence on candidates, the
   `SuggestedBadge` / "Auto-suggested" / "No context yet" copy, the existing populated visual
   contract (§5.1, §6.2), and the seam (change stays behind `DataStore.listCandidates`).
7. **Responsive + a11y (§7, §8)** — ≥44px touch targets on band/candidate actions; visible AA focus
   rings; loading announced; zero-results as real text; reduced-motion respected.

**What QA & Review must evaluate against this design:**
- **AC4 / CURATION §6 (mandatory):** no candidate renders a stance chip, accuracy chip, or context
  note in any state; only `SuggestedBadge` + `MatchReason` + "No context yet". Real thumbnails still
  render in the unvetted (desaturated/hatched) treatment.
- **AC1 (mandatory):** with no key, every uncurated topic shows the §5.2 honest empty state (not an
  error, not a void, no "set a key" UI); the seeded topic still shows seeded candidates; build/tests
  green.
- **AC2/AC11 loading:** cold-cache visit shows the skeleton + `aria-busy` + the live-region
  announcement; resolves to populated or zero without a flash of the wrong state.
- **AC2 zero-results:** an obscure/zero-result topic shows the honest line + "Find more", not an
  empty tile row; rail shows its zero line; counts read 0.
- **AC6 honest `matchReason`:** rendered line names YouTube once and the topic/section once, states
  *why* it matched, asserts no quality. Check a general and a section candidate.
- **AC9 sticky dismissal:** dismiss a candidate, reload — it stays gone; the count decremented; no
  undo/confirm; focus didn't strand.
- **AC14 silent degrade:** a forced search error degrades to the §5.2/seeded state — no error
  toast/banner/retry for candidates; the article error path is untouched.
- **A11y in practice:** keyboard reaches and operates all candidate actions across states; visible
  focus; loading announced; reduced-motion honored; AA contrast on the new white-on-indigo text.
- **Responsive:** single-column on mobile, scrollable band, ≥44px touch targets, no clipped actions.

UX will separately evaluate the built UI against this spec (visual fidelity to the Indigo Press
empty-state identity, interaction feel of loading→populated→zero transitions, and that the unvetted
treatment never reads as endorsement) after Development hands off.
