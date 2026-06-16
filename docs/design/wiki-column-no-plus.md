# Design spec: Keep the Wiki column free of plus content

- **Status:** Design contract for build-loop (UX) — GitHub issue #21
- **Owner:** UX / Design
- **Input artifact:** `docs/specs/wiki-column-no-plus.md` (Product spec, issue #21).
- **Grounds in:** `docs/TOPIC_PAGE_DESIGN.md` (the committed Topic-page design + the
  self-contradiction this resolves), `docs/design/topic-page-v1.md` (the prior buildable design
  spec — §5.6, §6.4, §10 responsive), `docs/design/youtube-autosuggest.md` (the empty-state /
  candidate design spec — §5.1, story 7, §microcopy), and the settled mockups
  `mockups/inline-indigo-empty-v2.html` (empty) / `mockups/inline-indigo-sync.html` (curated).
- **Hand-off:** Development implements against this contract (a mostly-subtractive code change +
  the doc-reconciliation edits this contract validates). QA & Review verifies; UX evaluates the
  built UI against this spec.
- **Nature of change:** **Subtractive, layout/placement only — no new UI.** We remove the
  duplicate inline rendering of section-matched suggested videos from the Wikipedia article body
  (empty state only); those candidates remain in the plus rail, anchored by scroll-sync. No new
  affordance is added to compensate (Product's decision — see §7).

---

## 1. The one principle being enforced

`docs/TOPIC_PAGE_DESIGN.md` states a firm boundary — **the General strip is the *only* place
plus content crosses into the Wikipedia article column.** Everything else wiki+ adds lives in the
right-hand plus rail; the article reads as the encyclopedia, undisrupted. This is the "two worlds"
contract and core to "what good looks like."

The empty (zero-curation) state currently breaks that boundary: each section-matched
auto-suggested candidate renders a **second time, inline inside the article body** — an
`<aside class="candcard">` labeled "Suggested for this section," interleaved between the
encyclopedia text — in addition to the same candidate's card in the plus rail. This contract
removes the inline placement. The candidate keeps its rail card; the article column becomes pure
Wikipedia plus the one General-strip crossover.

This is faithful to the committed design, not a redesign — it deletes the element that *violated*
the committed boundary. The mockup that shows the inline block
(`mockups/inline-indigo-empty-v2.html`, the per-section `<aside class="candcard">` rendered inside
each `<section class="sec">`) is the design mistake; the curated mockup
(`mockups/inline-indigo-sync.html`) already renders section bodies with **no** inline card and is
the correct reference for what the article column should look like in both states.

## 2. Personas & user stories served

**Primary persona — the Reader.** Lands on a Topic page (often via search or a wikilink) to read
about the topic. Wants the left column to read as a trustworthy, faithful Wikipedia article, and
trusts wiki+'s additions precisely because they announce themselves as a *separate* layer rather
than masquerading as encyclopedia text. Unvetted, auto-suggested candidates interleaved with
vetted article prose are the most corrosive case of the boundary breaking.

- **R1 — Faithful reading column.** *As a reader, I want the Wikipedia article column to read as a
  faithful encyclopedia — uninterrupted by wiki+ video cards — so I can trust what I'm reading is
  the article, not a suggestion someone bolted on.*
- **R2 — Unvetted content stays out of the article.** *As a reader, I want auto-suggested,
  un-reviewed candidate videos kept out of the article body entirely, so I'm never unsure whether a
  block between paragraphs is encyclopedia content or an un-vetted guess.*
- **R3 — One predictable crossover.** *As a reader, I want plus content to appear in exactly one
  predictable place inside the article flow — the full-width General strip after the lead — so the
  boundary between "the encyclopedia" and "wiki+'s layer" is legible and consistent.*

**Secondary persona — the Curator (browsing the empty state).** Triages auto-suggested candidates:
watch, compare against the article, promote or dismiss.

- **C1 — Candidates stay reachable & section-paired.** *As someone curating, I want every
  section-matched candidate to remain visible and tied to the section it relates to, so I lose no
  triage power when the inline copy goes away.* — Served by the rail card + scroll-sync, which
  already highlights the active section's card and TOC entry as the reader scrolls.

The change must serve R1–R3 (the win) **without** regressing C1 (no candidate is lost; the rail +
scroll-sync preserves the section→candidate pairing).

## 3. States — the buildable contract

The Topic page renders in one of these states. Only the **empty** state's article column changes;
the contract for every other state is "confirm unchanged."

### 3.1 Empty / zero-curation — **the state that changes**

**Before (current, wrong):** the article body renders each section, then — for each section with a
matched candidate — an inline `<aside class="candcard">` headed by a SUGGESTED badge + "Suggested
for this section," with a thumbnail, caption, creator line, match-reason, Promote / Not relevant
buttons, and a per-section "Search TikTok for '<section>' ↗" link. The **same** candidate also
renders as a `CandidateCard` in the rail. Plus content is in the Wiki column — the boundary is
broken.

**After (this contract):** the article column contains **only**:

1. **The lead block** — serif title, Wikidata short description, the "From Wikipedia · CC BY-SA
   4.0 · Wikidata <QID>" attribution, and the lead HTML (with the float-right Wikipedia
   infobox/lead figure, per article-fidelity). Unchanged.
2. **The General strip** — the full-width band immediately after the lead, the **one deliberate
   crossover**, carrying whole-topic candidates. In the empty state it reads "＋ Suggested videos ·
   uncurated" with the manual-source actions cluster (Search TikTok / Search YouTube / Add video).
   **Unchanged by this work.**
3. **The article body sections** — each `<section class="sec">` with its serif heading, body
   paragraphs, and float-right `figure.wikifig` figures. **Nothing else.** No `<aside
   class="candcard">`, no "Suggested for this section" block, no inline thumbnail, no inline
   Promote/Dismiss, no inline per-section TikTok-find link. This is the deletion.

The article column now reads as pure Wikipedia plus the single General-strip crossover — identical
in structure to the curated state's article column.

**Where the removed content goes:** nowhere new — it was always **also** in the rail. The
section→candidate relationship is preserved entirely in the plus rail via the existing
scroll-sync, **with no new rail emphasis this round** (Product's decision, §7):

- Each section-matched candidate keeps its `CandidateCard` in the sticky right rail, anchored by
  `sectionSlug` / `sectionLabel`. The card shows the SUGGESTED badge, the "↳ <sectionLabel>"
  section link, thumbnail, creator, match-reason, Promote / Not relevant, and the per-section
  TikTok-find link — exactly as before. (All the affordances on the removed inline block already
  exist on the rail card; nothing is orphaned.)
- As the reader scrolls the article, scroll-sync continues to: highlight the active section's
  heading (the −10px indigo left-bar + indigo wash), scroll the rail to the matching card and mark
  it active (indigo border + faint offset), and mark the active TOC entry. The pairing the inline
  block once made *spatially* is now made *temporally* by sync — which is how the curated state has
  always worked.
- The TOC keeps its dashed/outline per-section suggestion count (`~n`), driven by the same
  section-matching. The matching pipeline is untouched; only the *placement* it once implied
  (inline, in the article column) is retired.

**The empty-state plus elements that DON'T change:** the wiki+ panel ("0 videos curated" + "Be the
first to curate" CTA + "suggestions synced …"), the General strip and its manual-source actions,
the TOC and its counts, the rail's `CandidateCard`s, the dashed/desaturated unvetted visual
language, and the pinned candidate player. Reconfirm all present and correct.

### 3.2 Curated / non-empty — **confirm unaffected**

The article body already renders **no** inline plus content in the curated state: the inline render
is gated on `mode === "empty"`, so in the curated state the per-section candidate lookup yields
nothing and no card is emitted. (This matches `mockups/inline-indigo-sync.html`, whose article body
renders sections only.) The rail uses `ClipCard` (curated clips with stance/accuracy chips + curator
note), unchanged. **No regression permitted:** the curated article column must still show only
lead + General strip + sections, and the curated rail must be byte-for-byte the same experience.

### 3.3 Loading — **confirm unaffected**

Only the **article body** depends on the Wikipedia fetch. While it's in flight the article column
shows the `ArticleSkeleton` (title bar + paragraph bars, `aria-busy`, an `sr-only` "Loading
article…" status); the plus side renders immediately from store/candidate data. No inline candidate
ever rendered during loading (skeletons would disrupt the article), so this state is structurally
untouched. The rail may still show "Looking for suggestions…" while candidates load. Confirm
unchanged.

### 3.4 Error — **confirm unaffected**

If the article fetch fails, the article column shows the inline error card ("Couldn't load the
article" + "Try again" + "Open on Wikipedia ↗") and the plus side still renders. The inline
candidate path never touched this state. Confirm unchanged.

## 4. Responsive behavior

Web-first, responsive. The layout is a CSS grid: `grid-cols-1` by default, `lg:grid-cols-[1fr_360px]`
at `lg`+. The article `<main>` is the first grid child; the plus rail `<aside>` is the second.

- **`lg`+ (two-column):** article left, sticky rail right. After this change the article column has
  no inline candidate cards; the rail (`CandidateCard`s) sits in the second column, scroll-synced.
  The General strip spans full width above the grid. No layout shift versus the curated state.
- **Below `lg` (single-column, mobile/tablet — columns stack):** the grid collapses to one column,
  so the article body renders first and the **entire rail (with all `CandidateCard`s) renders
  below it**, in source order. **This is the load-bearing responsive requirement:** removing the
  inline cards must **not** cause section-matched candidates to reappear interleaved within the
  article flow on narrow screens. There is exactly one correct single-column reading order:

  > lead → General strip → **complete, uninterrupted article body** → then the plus rail
  > (`CandidateCard`s) in a block below.

  No candidate may be injected between article sections at any breakpoint. The candidates live
  **only** in the rail block beneath the article when stacked. (Scroll-sync's side-by-side pairing
  has no spatial meaning in one column and may relax below `lg`; TOC/section jump-to still works as
  in-page anchors. That behavior is unchanged — this contract only forbids re-introducing
  interleaving.)
- **General strip at all breakpoints:** the full-width crossover stays full-bleed and horizontally
  scrollable at every width (it already works narrow). Confirm it behaves identically at ~1280px,
  ~768px, and ~390px — it is the sole crossover, untouched by this change.

QA target widths (unchanged): ~1280px (two-column), ~768px (single-column tablet), ~390px (phone).

## 5. Microcopy

**Removed (inline-only — these strings leave the product):**

- The inline block's visible label **"Suggested for this section"** (violet, `text-[11px]` bold) —
  removed with the inline `<aside>`.
- The inline block's accessible name **`aria-label="Suggested video for <section>"`** — removed
  with the `<aside>`.
- The inline block's per-section link text **"Search TikTok for '<section>' ↗"** — removed *from
  the article column only.* (The identical per-section TikTok-find link still exists on the rail
  `CandidateCard` and the General strip — those are unchanged.)

**Unchanged (verify present, identical wording):**

- Rail `CandidateCard`: SUGGESTED badge ("Suggested"), "↳ <sectionLabel>" section link, the
  match-reason block (eyebrow "Auto-suggested"; body "<source> · <matchReason>"; hint "No context
  yet — a human hasn't reviewed this."), "✓ Promote" / "✕ Not relevant", and the card's own
  "Search TikTok for '<section>' ↗".
- General strip: "＋ Suggested videos", the "uncurated" tag, "— auto-found candidates, not yet
  vetted", the "<n> candidates" count, and the "Find more" manual-source cluster (Search TikTok /
  Search YouTube / ＋ Add video).
- wiki+ panel empty copy ("0 / videos curated", "<n> auto-suggestions from <sources>", "✦ Be the
  first to curate", "suggestions synced …") and the rail loading / zero-results lines ("Looking for
  suggestions…", "No suggestions for this topic yet — use 'Find more' above to add the first
  video.").

No new microcopy is introduced.

## 6. Accessibility

- **A11y win — uninterrupted reading & focus order (call this out).** Removing the inline
  `<aside class="candcard">` from each section means the article column's reading order and tab
  order are now **uninterrupted** by interactive video controls. Previously, a keyboard or
  screen-reader user moving through the article hit a SUGGESTED block — thumbnail button, Promote,
  Not relevant, a TikTok link — *between* sections of encyclopedia prose. After the change, tabbing
  through the article column traverses only article links; all candidate controls live in the rail.
  This is a genuine usability improvement, not just a removal.
- **No orphaned focus targets.** Every interactive element on the removed inline block (thumbnail
  play button, Promote, Not relevant, the per-section TikTok-find link) has an **identical, still-
  present counterpart on the rail `CandidateCard`**. Nothing the keyboard could previously reach is
  lost; the same candidate's actions are still reachable in the rail. Verify focus is never dropped
  to `<body>` after the removal (e.g. a dismiss interaction that previously lived inline must still
  resolve cleanly on the rail card).
- **Rail candidates stay keyboard-reachable and announced.** The rail `<aside>` keeps its landmark
  label ("wiki+ suggested videos"); its `CandidateCard`s remain in the tab order with the project's
  visible focus ring (`:focus-visible` 3px indigo outline, AA). The polite live region announcing
  the candidate search is unchanged.
- **No signal by color alone.** Unchanged and reconfirmed: the unvetted state is signaled by the
  literal word "Suggested," the dashed border, the "Auto-suggested" eyebrow, and the "No context
  yet…" hint — not by color. The active-section pairing is signaled by the TOC current-entry change
  and the section-link text, not by highlight color alone.
- **Contrast / palette unchanged.** Indigo Press palette, AA-checked, no new colors: brand
  `#676EB4`, sprout `#2A8270`, action `#1F6F95`, ink `#2C2C2C`; gold `#E5AB28` remains deliberately
  unused. The Wikipedia column keeps its faithful Wikipedia look.

## 7. No new affordance this round (validated)

Product asked whether anything should compensate for losing the inline section cue (e.g. extra
rail emphasis when a section is active). **From a UX standpoint, the existing scroll-synced rail is
sufficient and adding new emphasis would be wrong this round.** Rationale:

- The rail already pairs the active section with its card (section heading wash + active-card
  border + TOC current-entry) via scroll-sync — the section→candidate relationship is preserved
  without re-crossing into the Wiki column.
- Any new active-section emphasis is net-new design scope that *reopens the very boundary this
  issue closes* and should be decided separately on evidence (deferred), not bundled into a
  subtractive fix.

I confirm Product's "no compensation this round" decision. This contract specifies removal only.

## 8. Doc-reconciliation validation (UX sign-off on the intended doc edits)

Development makes the actual documentation edits; **this section validates the intended
language/approach so Dev's edits are correct and complete.** From a UX standpoint the
reconciliation decision is right: **the "one crossover" principle wins; the empty-state
"inline candidate under that section" text is the mistake and must be retired.** Section-*matching*
is preserved as the behavior that anchors a candidate to its section **in the rail** and drives the
TOC count; only the *placement* it once implied (inline, in the article body) is removed.

The contradiction is not confined to one passage — it propagates across three design docs. **All
three must be reconciled** so the design corpus stops contradicting itself (the Product spec scopes
`TOPIC_PAGE_DESIGN.md` as the required edit and explicitly invites reconciling the autosuggest
spec's wording; this contract makes the full set explicit). Passages, and the effect each edit must
achieve:

1. **`docs/TOPIC_PAGE_DESIGN.md` — §"Empty / zero-curation state"** (the bullet beginning
   "Auto-suggestion is multi-platform by design"). The clause *"…it surfaces as a **single inline
   candidate** under that section."* is the contradicting language. **Effect:** revise so a
   metadata match **anchors the candidate to its section in the plus rail (and drives the TOC
   section count)** — *not* inline in the article body. The result must read consistently with
   §"The General strip — the one crossover" (plus content crosses into the Wiki column **only** in
   the General strip) and §"Clip placement: General vs. section-anchored" (section-anchored items
   are "shown in the plus rail"). Add a one-line legibility note that the inline-under-section
   placement was retired, pointing to this issue (#21) / spec. A reader of the doc must **not** be
   able to derive "render a candidate inline in the article body."

2. **`docs/design/topic-page-v1.md`** — the prior buildable design spec carries the same mistake in
   three places; reconcile all:
   - **§5.6 "Article body (Wiki)"** — the Contrast note *"(Contrast: the empty state* does *inline a
     candidate after a section's text — §6.4.)"* **Effect:** remove/revise so the rule reads "the
     article is never interrupted by a video card in **either** state — the General strip is the
     only crossover." Delete the empty-state exception.
   - **§6.4 "Inline section candidate (empty only)"** — the entire section specifies the inline
     `<aside class="candcard" aria-label="Suggested video for <section>">` placement. **Effect:**
     retire the inline-placement spec; preserve the *matching* as the rail-anchoring + TOC-count
     behavior (the candidate's content/visual language already lives in the rail-card spec). A
     legibility note (retired per #21) keeps history.
   - **§10 responsive** — the line *"In the empty state, inline section candidates (§6.4) remain the
     most useful single-column pattern (they sit right under their section); the rail's duplicate
     cards still render below."* This directly contradicts §4 of this contract. **Effect:** revise
     to "the article body renders complete and uninterrupted; section-matched candidates render in
     the rail block below it — never interleaved in the article flow." Also reconcile the
     §-references/traceability rows that cite §6.4 (e.g. the AC16 row, the SR-anatomy "Inline
     candidate = `<aside aria-label="Suggested video for …">`" line) so they no longer assert an
     article-body placement.

3. **`docs/design/youtube-autosuggest.md`** — the empty-state/candidate spec asserts the inline
   placement in: the components list (`InlineCandidate.tsx`), user story 7 ("inline suggestions …
   fully usable"), §5.1 "Inline section candidates (`InlineCandidate`): rendered *after* a matched
   section's [text]…", the empty-state "none render" note, the responsive "Inline section
   candidates: already a stacked flex card; on mobile…", the microcopy line ("`InlineCandidate`
   label → `Suggested for this section`"), and the traceability row "§5.1 one inline per matched
   section | AC5". **Effect:** reconcile each so the *matching* is preserved as **rail-anchoring +
   TOC-count** behavior and the *article-body placement* is retired — keeping this spec mutually
   consistent with `TOPIC_PAGE_DESIGN.md`. The matching pipeline itself (`lib/candidates/*`) is
   **out of scope and unchanged**; only the doc's placement language changes.

After these edits, no design doc may instruct rendering a candidate inline in the Wikipedia article
body, and all must agree that section-matching anchors candidates **in the plus rail** and drives
the TOC count.

## 9. What Development builds (hand-off summary)

A focused, mostly-subtractive change in the client-side SPA, plus the doc reconciliation validated
above:

1. **Stop rendering plus content inline in the article column** (empty state). Remove the
   `InlineCandidate` render from `ArticleSections` (`components/topic/ArticleBody.tsx`), and the
   now-dead wiring: the `inlineCandidates` memo and the `inlineCandidates` prop threading in
   `app/topic/TopicView.tsx` and on `ArticleSections`. Remove `components/topic/InlineCandidate.tsx`
   if nothing else imports it. (Per Product spec §Scope.)
2. **Leave the rail, the General strip, scroll-sync, TOC counts, the wiki+ panel, and the matching
   pipeline untouched.** Section-matched candidates remain in the rail via `CandidateCard`, anchored
   by `sectionSlug`/`sectionLabel`.
3. **Reconcile the three design docs** per §8 (with legibility notes pointing to #21).
4. **Add regression tests** asserting the new boundary: the empty-state article body renders **no**
   plus/suggestion content, and a section-matched candidate is still present in the rail.

**Acceptance is owned by Product's spec (`docs/specs/wiki-column-no-plus.md`, AC 1–6).** This
contract is the UX intent those criteria verify against; UX will evaluate the built empty state
against §3.1, §4, and §6 (article column reads as faithful Wikipedia, no interleaving at any
breakpoint, uninterrupted reading/focus order, candidates intact in the rail).
