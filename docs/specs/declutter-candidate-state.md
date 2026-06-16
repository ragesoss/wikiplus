# Spec: Declutter the candidate / suggested-video empty state

- **Status:** Ready for build-loop (Product) — GitHub issue #14
- **Owner:** Product
- **Inputs:**
  - GitHub issue #14 — "[build] Declutter the candidate/suggested-video state — cut redundant
    chrome before a user engages" (the owner intent this spec encodes).
  - `docs/design/declutter-candidate-state.md` — the **owner-approved buildable design spec** (the
    "after" contract). This Product spec's acceptance criteria are derived from, and must not
    contradict, that design.
  - `mockups/inline-indigo-empty-v3-declutter.html` — the approved "after" mockup (already
    committed; the visual reference). Baseline "before": `mockups/inline-indigo-empty-v2.html`.
  - `docs/TOPIC_PAGE_DESIGN.md` (§"Empty / zero-curation state", §"Plus visual identity") — the
    committed doc text the build must reconcile to the shipped design.
  - `docs/CURATION_STANDARD.md` (§6 Unvetted-candidate rule) — the standard the unvetted
    distinction must continue to satisfy; "promotion" is its internal-mechanism term, not a
    pinned user-facing verb.
  - `docs/VISION.md` ("What 'good' looks like") — the calm-before-engagement value this serves.
- **Hand-off:** UX (flows/microcopy for the once-per-context signal — largely already captured in
  the approved design spec; confirm no gap), then Development (the build, against the design spec's
  named touchpoints + this spec's acceptance criteria). QA & Review verifies against the
  **Acceptance criteria** below; UX evaluates the built UI against the design spec + after mockup.

---

## Problem

On an empty / zero-curation Topic page, the auto-suggested candidate clips are **over-labeled**.
The same "this is unvetted / auto-suggested / from a video search / no human context yet" signal is
asserted **once per card** — on every General-strip tile and every rail candidate card — even
though three things already communicate it before the reader reads any single card:

1. the **dashed border + desaturated/hatched thumbnail** (the candidate visual language),
2. the **section grouping** (candidates are collected, not interleaved with curated clips), and
3. the **shared search origin** (one auto-suggest run, named in the General band and the ＋plus
   panel).

The result is visual noise in exactly the state where the reader has **not yet decided to engage**
with any specific video. On top of the redundant signal, the call-to-action to curate a candidate
reads **"Promote"** — creator-world / marketing framing that fights wiki+'s curation-not-promotion
identity — and the ＋plus panel header carries a purposeless **"this topic"** label.

## User value

A reader skimming candidates on an empty Topic page sees a **calmer, lower-chrome list**: the "this
is unvetted / auto-suggested" message is stated **once per context, not once per card**, so the
reader's attention goes to the clips themselves (and to *why each one matched*) rather than to
repeated chrome. Candidates remain **unmistakably distinct from curated clips** (the unvetted
distinction is preserved — we remove redundancy, not the signal), so the reader is never misled
into thinking an auto-suggestion is vouched-for. The CTA names the action in the product's own
language (**"Curate"**), reinforcing that wiki+ is a curation layer rather than a promotion engine.
This directly serves "what good looks like" in `docs/VISION.md`: the reader can weigh content with
less friction in the state that bootstraps the curation flywheel.

## Scope

### In scope

- The **empty / zero-curation candidate presentation only**: the General-strip candidate tiles, the
  rail candidate list (`CandidateCard` and its shared sub-parts in `components/topic/CandidateBits.tsx`
  — `SuggestedBadge`, `MatchReason`, `CandidateActions`), and a **new one-time "unvetted set"
  header** atop the rail candidate list.
- The **＋plus panel header label** in `components/topic/Infobox.tsx` (remove the "this topic"
  span).
- The **curate-CTA verb rename** "Promote" → "Curate" across the candidate UI button label and its
  `aria-label`.
- A small **text-labeled per-card source pill** on the rail candidate card (the
  multi-source-extensibility hook; must read the candidate's own `source`, not a hard-coded string).
- **Doc-text reconciliation:** revise the *Empty / zero-curation state* section of
  `docs/TOPIC_PAGE_DESIGN.md` (badge / auto-suggest-reason / "no context yet" / count / CTA-verb
  treatment) to match the shipped design, and update user-facing **"Promote"** references in
  `docs/TOPIC_PAGE_DESIGN.md` and `docs/CURATION_STANDARD.md` to **"Curate"** where they name the
  user-facing CTA.

### Out of scope

- The **curated (non-empty) clip cards**, the **stance / accuracy chips**, and the **context-note
  design** — unchanged.
- The **"Curate this clip" modal flow** itself — only the label of the button that opens it
  changes; the modal's contents, fields, and behavior are untouched.
- The **candidate-matching / search pipeline** (`lib/candidates/*`, the YouTube auto-suggest
  pipeline) and **any data-model change** — no new fields; the source pill renders an existing
  `source` value.
- The **pinned candidate player / preview work (issue #10)** — the candidate playback surface is
  untouched.
- The **mockup** `mockups/inline-indigo-empty-v3-declutter.html` — already updated to the approved
  design; the build does **not** re-author it.
- Any change to the **General-strip-as-the-one-crossover** rule or the retired inline-under-section
  placement (issue #21) — unchanged.

## Acceptance criteria

Each item is testable by QA & Review against the built empty-state UI (and the named docs/mockup),
and must match `docs/design/declutter-candidate-state.md` and the approved after mockup
`mockups/inline-indigo-empty-v3-declutter.html`.

1. **No per-card "SUGGESTED" badge.** No General-strip candidate tile and no rail candidate card
   renders the outline `SuggestedBadge` (or any per-card "SUGGESTED" label). The badge no longer
   appears anywhere on a per-card basis.
2. **Per-card auto-suggest-reason redundancy removed.** No candidate card renders the repeated
   **"🔍 Auto-suggested" eyebrow** or the **"No context yet — a human hasn't reviewed this."**
   sentence. Those strings appear **zero times per card**.
3. **Compact per-card match reason retained (as per-clip information).** Each candidate card still
   shows a **single, compact, quiet** match-reason line carrying *why this clip matched* (e.g.
   *Mentions "light-dependent reactions" in description*) — small/muted text, decorative magnifier
   glyph `aria-hidden`, with an `sr-only` **"Why suggested:"** prefix so the line is
   self-describing to screen readers. The source value is **not** in this line (it moves to the
   source pill).
4. **Per-card text-labeled source pill present and not single-source-hardcoded.** Each rail
   candidate card shows a small **text-labeled, outline** source pill (e.g. `YOUTUBE`) in the slot
   the "SUGGESTED" badge vacated. The pill's value is read **from the candidate's own `source`
   datum** — verifiably not a hard-coded "YouTube" literal — so a mixed-source result set would
   render each card's actual source without a redesign. (Multi-source-extensibility hook, design
   spec §6.)
5. **Signal lives once per context (present in all three places).** The unvetted / auto-suggested /
   source signal is present **once per context**:
   - the **＋plus panel** (empty mode) states "N auto-suggestions from {sources}";
   - the **General band header** states the kind once ("uncurated — auto-found candidates, not yet
     vetted");
   - a **new one-time "unvetted set" header** (a single dashed-outline block atop the rail
     candidate list) carries "Suggested · uncurated" + a body naming the sources and stating that
     no context notes exist yet (a human hasn't reviewed these) and inviting curation.
   This set header **replaces** v2's tiny "Suggested ↓ · uncurated" eyebrow and **absorbs** the
   per-card "No context yet…" sentence (AC2). `{sources}` is read **from data**, not hard-coded.
6. **General-band "N candidates" count label removed.** The General band header **no longer**
   renders a "N candidates" count label (the v3.1 owner refinement). The band states the *kind* of
   content once but defers the *count*.
7. **Topic-wide volume count appears once, in the ＋plus panel.** The topic-wide candidate volume
   count appears exactly once — as the ＋plus panel's "N auto-suggestions from {sources}". The rail
   set header carries **no** count. (The per-section **TOC `~N` suggestion badges are KEPT** — they
   are wayfinding, a distinct purpose from the topic-wide volume signal, and remain in their dashed
   / outline style.)
8. **Unvetted per-card distinction retained.** Every candidate (tile and rail card) remains
   **unmistakably distinct** from a curated clip: **dashed (not solid) border, no solid offset
   shadow, desaturated/hatched thumbnail** — exactly as in v2. The candidate visual language is
   preserved; only redundant text/badging is removed. (Satisfies `docs/CURATION_STANDARD.md` §6 /
   AC15.) Candidates continue to carry **no stance/accuracy chip and no context note**.
9. **CTA verb is "Curate", with matching accessible label.** The primary candidate CTA reads
   **`✦ Curate`** (not "Promote"). Its `aria-label` is exactly **`Curate this clip: {caption}`**,
   it keeps `aria-haspopup="dialog"`, and it opens the **existing** "Curate this clip" modal
   (modal behavior unchanged). The "Not relevant" dismiss action is **unchanged**.
10. **"this topic" infobox label removed.** The ＋plus panel header (`components/topic/Infobox.tsx`)
    no longer renders the "this topic" span; the header is just `＋plus`. The rest of the panel
    (counts, sync status, "Be the first to curate" CTA, "N auto-suggestions from {sources}") is
    unchanged.
11. **`docs/TOPIC_PAGE_DESIGN.md` reconciled to the shipped design.** The *Empty / zero-curation
    state* section is revised so that its description of the unvetted treatment matches what ships:
    **no per-card "SUGGESTED" badge** (signal lives once per context — ＋plus panel, General band
    header, the new set header); the per-card auto-suggest-reason is described as a **compact
    match-reason line + a source pill**, not the removed "no context yet" block; the **General-band
    count is described as removed** (volume lives once in the ＋plus panel); and the **"Curation
    entry points"** language uses the user-facing verb **"Curate"** (not "Promote") for the button
    that opens "Curate this clip". The doc must not still describe the removed per-card chrome as
    present.
12. **User-facing "Promote" references updated to "Curate".** Every reference in
    `docs/TOPIC_PAGE_DESIGN.md` and `docs/CURATION_STANDARD.md` that names the **user-facing CTA**
    is updated "Promote" → "Curate". `docs/CURATION_STANDARD.md` §6 may **retain "promotion" as the
    internal-mechanism term** for the candidate→curated transition (per the design spec's D1
    rationale); only the user-facing-verb references change.
13. **Mockup matches.** The build's empty-state UI is consistent with the already-updated approved
    mockup `mockups/inline-indigo-empty-v3-declutter.html` (the visual reference). The build does
    **not** modify that mockup.
14. **Accessibility preserved.** **AA contrast** holds for every shipping text-on-background pair
    in the changed UI (the design spec §7 records the verified ratios — all ≥ 4.5:1); **no meaning
    is carried by color or border-style alone** (the unvetted state is reinforced by the word
    "uncurated"/"Suggested · uncurated" in the set header and band, and the source pill names the
    source as a word); every interactive element (thumbnail button, Curate, Not relevant, section
    link, set-header links) is **keyboard-reachable and shows the project's `3px` indigo
    `:focus-visible` ring with `2px` offset**; Curate/Not-relevant keep a ≥44px touch target; and
    decorative glyphs (magnifier, ✦/✕) are `aria-hidden`.
15. **Build is green.** `yarn build`, `yarn typecheck`, and `yarn test` all pass on the branch.

## Success metric

**Primary (the intent):** on the empty state, the count of distinct **"this is unvetted /
auto-suggested" signal assertions per candidate card drops to zero** (the signal moves to exactly
three once-per-context locations — ＋plus panel, General band header, rail set header), while the
**per-card unvetted distinction is still present** (dashed border + hatched/desaturated thumbnail on
100% of candidate cards). This is the directly verifiable definition of "signal once per context,
distinction retained," confirmed by QA against the acceptance criteria and by UX's visual
evaluation against the after mockup.

**Qualitative (what good looks like):** UX's built-UI evaluation judges the empty state **calmer
and lower-chrome** than the v2 baseline — the reader's eye reaches the clips and their per-clip
match reasons rather than repeated chrome — with the unvetted framing read once at the top of the
list (especially valuable on narrow screens, where the set header front-loads the framing instead
of repeating it past every card).

**Deferred (post-traffic, owned here until Analytics splits out):** once the empty state sees real
readers, the leading indicator that the declutter helped the flywheel is the **curate-CTA
engagement rate on the empty state** (candidate-card "Curate" opens ÷ empty-state Topic-page views)
holding steady or rising versus the v2 baseline — i.e. removing chrome did not cost engagement, and
ideally a calmer list makes the path to curation more legible. Not measured in the prototype; stated
here so it is instrumentable when analytics lands.
