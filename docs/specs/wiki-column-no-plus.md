# Spec: Keep the Wiki column free of plus content

- **Status:** Draft for build-loop (Product) — GitHub issue #21
- **Owner:** Product
- **Inputs:** `docs/TOPIC_PAGE_DESIGN.md` (§"The General strip — the one crossover" vs.
  §"Empty / zero-curation state" — the self-contradiction this spec resolves), `docs/VISION.md`
  ("What 'good' looks like"; non-goals), `CLAUDE.md` ("the Wiki article side keeps a faithful
  Wikipedia look"), `docs/specs/youtube-autosuggest.md` (the candidate/section-matching pipeline
  that feeds the rail — unchanged here). Existing code: `components/topic/InlineCandidate.tsx`;
  `components/topic/ArticleBody.tsx` (`ArticleSections`, the `inlineCandidates` prop, the
  `mode === "empty"` inline render at ~L82/L100); `app/topic/TopicView.tsx` (`inlineCandidates`
  memo ~L306, the `ArticleSections inlineCandidates={…}` prop ~L666); the rail's section-anchored
  `CandidateCard` render (`app/topic/TopicView.tsx` ~L699, `components/topic/CandidateBits.tsx`).
- **Hand-off:** UX (confirm there is no flow/microcopy gap from removing the inline affordance —
  the product decision below says there is not), then Development (mostly-subtractive change +
  doc edit). QA & Review verifies against the Acceptance criteria.

---

## Problem

The Topic page design has one firm rule about the boundary between its two columns: the
**General strip is the only place plus (wiki+) content crosses into the Wikipedia article
column.** Everything else wiki+ adds lives in the right-hand plus rail. The Wikipedia article
reads as the encyclopedia, undisrupted.

On the **empty (zero-curation) state**, that rule is currently broken. Section-matched
auto-suggested candidates render a **second time, inline inside the Wikipedia article body** —
"Suggested for this section" cards interleaved with the article text — in addition to the same
candidate's `CandidateCard` in the plus rail. Observed live on the empty state of
`https://ragesoss.github.io/wikiplus/topic/Aromatic_compound`.

In the code this is the `mode === "empty"` branch of `ArticleSections`
(`components/topic/ArticleBody.tsx`) rendering an `InlineCandidate` per matched section, fed by
the `inlineCandidates` memo in `app/topic/TopicView.tsx`. The section-matched candidate is
**already** rendered in the rail via `CandidateCard`; the inline copy is a duplicate placement in
the wrong column.

**Root cause is a self-contradiction inside `docs/TOPIC_PAGE_DESIGN.md`.** Two sections of the
same doc disagree about whether plus content may appear in the Wiki column:

- §"The General strip — the one crossover" states the General strip is **the only** place plus
  content reaches into the Wiki column.
- §"Empty / zero-curation state" designs the opposite: where a candidate's metadata matches a
  section's keywords, it "surfaces as a **single inline candidate** under that section" — i.e.
  inside the article body.

The build faithfully implemented the second passage, which contradicts the first. Resolving the
contradiction in the doc — not just deleting code — is the heart of this task.

## User value

A reader on a wiki+ Topic page gets a **faithful, uninterrupted Wikipedia reading column**: the
article reads as the encyclopedia, with plus content kept to the plus rail and the one
deliberate, full-width General-strip crossover. This is core to "what good looks like"
(`docs/VISION.md`) and to the "two worlds" contract (`docs/TOPIC_PAGE_DESIGN.md`): the Wiki side
is a faithful Wikipedia look; wiki+'s additions announce themselves as a distinct, colorful layer
in their own column rather than masquerading as part of the article. Unvetted suggested candidates
in particular do not belong interleaved with vetted encyclopedia text. The candidates lose nothing
useful — they remain fully present and reachable in the plus rail, where the scroll-sync already
ties each one to the section it relates to.

## The doc-reconciliation decision

**The "one crossover" principle wins.** The General strip is, and remains, the *only* place plus
content crosses into the Wiki article column. The §"Empty / zero-curation state" text that
designs an "inline candidate under that section" (inside the article body) is the mistake and
**must be revised/removed** so `docs/TOPIC_PAGE_DESIGN.md` no longer contradicts itself.

This is a **deliverable of this spec, not a side effect of the code change.** Development must
edit `docs/TOPIC_PAGE_DESIGN.md` so that:

1. The empty-state section no longer instructs that a section-matched candidate appear inline
   under its section in the article body.
2. The section-**matching** behavior is preserved in the doc as the thing that **anchors a
   candidate to its section in the plus rail** (and drives the TOC section count) — i.e. matching
   still happens; only the *placement* it once implied (inline, in the article column) is retired.
3. The result reads consistently with §"The General strip — the one crossover" and with
   §"Clip placement: General vs. section-anchored" (section-anchored items are "shown in the plus
   rail"). A one-line note that the inline-under-section placement was retired (with a pointer to
   this spec / issue #21) keeps the change legible to later readers.

The companion `docs/specs/youtube-autosuggest.md` describes the same section-matching as item 3
("Inline section candidates by metadata matching"). The **matching** there is unchanged; if its
wording implies an *article-body* placement, that phrasing should be reconciled to "anchored in
the rail" so the specs stay mutually consistent — but the matching pipeline itself is out of
scope (below).

## Scope — this round

A focused, **mostly-subtractive** change in the client-side static SPA:

1. **Stop rendering plus content inline in the Wiki column.** Remove the inline placement so
   section-matched candidates appear **only** in the plus rail (where `CandidateCard` already
   renders them). Concretely: stop rendering `InlineCandidate` from `ArticleSections`
   (`components/topic/ArticleBody.tsx`), and remove the now-dead wiring — the `inlineCandidates`
   memo and prop threading in `app/topic/TopicView.tsx` and the `inlineCandidates` prop on
   `ArticleSections`. Remove `components/topic/InlineCandidate.tsx` if nothing else imports it.
2. **Reconcile `docs/TOPIC_PAGE_DESIGN.md`** per *The doc-reconciliation decision* above.
3. **Tests** asserting the new boundary (see Acceptance criteria).

## Out of scope

- **The General strip itself** — the legitimate, intended crossover. Leave as-is.
- **The plus rail's section-anchored cards** (curated *and* candidate, via `CandidateCard`) —
  they stay. Section-matched candidates remain visible there.
- **The candidate suggestion / section-matching pipeline** (`lib/candidates/*`, the matching that
  assigns `sectionSlug`/`sectionLabel`) — **unchanged.** Only the *placement* of a matched
  candidate changes (no longer inline in the article body); the matching that anchors it to a
  section in the rail and drives the TOC count is untouched.
- **The curated (non-empty) state** — already renders no inline plus content in the article body
  (the inline render is gated on `mode === "empty"`); it must stay that way and is not otherwise
  modified.
- **TOC counts, scroll-sync mechanics, the wiki+ panel, chip vocabularies** — unchanged.
- **Any new rail affordance** to compensate for the removed inline cue — see *Open question*
  below; the decision is **no new affordance this round.**

## Acceptance criteria

1. On an **empty** Topic page (e.g. `Aromatic_compound`), the Wikipedia article body contains
   **no** plus/suggested content — no "Suggested for this section" cards (and no other candidate
   or clip content) interleaved with the article text. `InlineCandidate` is not rendered anywhere
   in the article column.
2. **Section-matched candidates remain reachable in the plus rail** — `CandidateCard` still
   renders each section-anchored candidate, anchored by its `sectionSlug`/`sectionLabel`, exactly
   as before this change (the rail render is independent of the removed inline path).
3. The **General strip still spans both columns** as the one crossover, unchanged — same content,
   same placement, same behavior.
4. The **curated (non-empty) state is unaffected** — no regression to clip rendering in either
   column; the article body still shows no inline plus content (as it already did).
5. **`docs/TOPIC_PAGE_DESIGN.md` no longer contradicts itself** on where plus content may appear
   in the Wiki column: the empty-state text is reconciled to the "one crossover" principle (no
   inline-under-section candidate in the article body), while section-matching is preserved as
   the rail-anchoring/TOC-count behavior. A reader of the doc cannot derive "render a candidate
   inline in the article body."
6. **`yarn build` + `yarn typecheck` + `yarn test` are green.** Tests include at least one
   assertion that the empty-state article body renders no plus/suggestion content, and that a
   section-matched candidate is present in the rail; no dead/unused exports remain
   (e.g. an orphaned `InlineCandidate` or `inlineCandidates` prop).

## Success metric

This worked if the **Wiki column is plus-free in the empty state with no loss of candidate
reach**:

- **Primary (binary, build-time/QA):** AC 1–6 all pass. On the live empty state of a topic
  (e.g. `Aromatic_compound`), zero plus/suggested elements appear within the article body, and the
  count of section-matched candidates reachable in the rail is unchanged from before. This is the
  pass/fail signal for the issue.
- **Secondary (design-conformance, qualitative):** UX/QA evaluation against the design principle
  confirms the article column reads as faithful Wikipedia (the "two worlds" contract holds), with
  the General strip as the sole crossover. The owner's live observation that prompted issue #21 no
  longer reproduces.
- **Net-negative diff:** consistent with a subtractive change, the implementation removes more
  code than it adds (dead inline-placement wiring deleted), with the only additions being the doc
  reconciliation and the regression tests. (Tracked as a sanity check, not a hard gate.)

(Usage analytics are deferred — no traffic yet — so the success signal is verification + design
conformance, not an engagement metric.)

## Open question — resolved by Product

**Question (from the issue):** Should anything compensate for losing the *inline* section
affordance — e.g. extra emphasis in the rail when a section is active — or is the existing
scroll-synced rail sufficient?

**Decision: no compensation this round. The rail + scroll-sync is sufficient.** Confirming the
issue's default.

Rationale: the rail already pairs the active section with its card via scroll-sync (section
marker + active card + TOC entry highlight), so the section→candidate relationship is preserved
without re-crossing into the Wiki column; adding a new active-section emphasis would be net-new
design scope that reopens the very boundary this issue closes, and should be considered
separately on evidence (deferred), not bundled into a subtractive fix.
