# Spec: Curated and suggested videos coexist on a Topic page

- **Status:** Ready for build-loop (Product) — GitHub issue #60
- **Owner:** Product
- **Inputs:**
  - GitHub issue #60 — "[build] Curated and suggested videos coexist on a Topic page (retire the
    all-or-nothing empty↔curated flip)" (the owner intent this spec encodes, including the fixed
    owner decisions captured below).
  - `docs/VISION.md` ("What 'good' looks like", the MVP core loop, the candidate/empty-state seed of
    the flywheel) — the product value this serves.
  - `docs/TOPIC_PAGE_DESIGN.md` (§"Empty / zero-curation state", §"Clip placement: General vs.
    section-anchored", §"The General strip — the one crossover", §"Two infoboxes", §"Unvetted
    treatment") — the committed Topic-page UX this **supersedes from two states to three**.
  - `docs/specs/declutter-candidate-state.md` + `docs/design/declutter-candidate-state.md` (issue
    #14) — the **once-per-context** unvetted-signal discipline this spec must keep, but rescope from
    "the whole context is suggestions" to "the suggestion *subset* within a mixed band/rail."
  - `docs/specs/youtube-autosuggest.md` — the candidate pipeline, section matching, and
    `platform:videoId` dedup whose **stability** this spec depends on.
  - `docs/ARCHITECTURE.md` (§"Candidate suggestion & the empty state", §"Prototype phase") — the
    constraint that candidates are computed/cached, not stored, and that nothing here touches the
    server, persistence, auth, or the deferred read-path caching.
- **Hand-off:**
  - **UX / Design** — flows + a buildable design spec for the three states (empty / mixed /
    fully-curated): how curated and suggestion content read together in the General band and a
    section rail, the "see more" overflow control, the reworded once-per-context unvetted headers,
    the mixed-state wiki+ panel count format, and the mixed TOC dual-count treatment. UX owns the
    exact wording, the exact default count, and the visual treatment; this spec sets only the
    outcome.
  - **Development** — implement against the UX design spec + the acceptance criteria below. The
    issue names the touchpoints (`app/topic/TopicView.tsx`, `components/topic/GeneralStrip.tsx`,
    `components/topic/Infobox.tsx`, the TOC count branch); *how* to retire the binary `mode` gate is
    a Dev decision.
  - **QA & Review** verifies against the **Acceptance criteria**; UX evaluates the built UI against
    the design spec.

---

## Problem

Today a Topic page is **all-or-nothing**. Auto-suggested candidate videos appear **only** when zero
clips are curated; the instant a curator adds the first curated clip, **every suggestion
disappears**. The root cause is a single binary gate (`app/topic/TopicView.tsx:445` —
`mode = clips.length > 0 ? "curated" : "empty"`); the General band, the plus rail, the TOC counts,
and the wiki+ panel all branch on it.

This abandons the **middle-ground topic** — the common, important case where a topic is *partly*
curated. A topic with one or two curated clips and twenty good suggestions still waiting to be vetted
is exactly the state the curation flywheel lives in, yet today it looks identical to a fully-curated
topic: the suggestions that would seed the next curation are hidden the moment the first clip lands.
Worse, the flip is jarring and feels destructive — a curator who curates one suggestion watches the
rest of the suggestion set vanish, with no signal that they were merely hidden, not ruled out.

## User value

- **A reader** on a partly-curated topic sees the vetted clips *and* still discovers the unvetted
  candidates worth watching next — the page stays useful all the way along the curve from
  zero-curated to fully-curated, instead of going dark in the middle.
- **A curator** experiences vetting as **changing one video's state in place**: curating a suggestion
  promotes that one card to curated and leaves every other suggestion exactly where it was. The page
  evolves smoothly from all-suggestions toward all-curations, so curation feels like steady progress
  on a stable list — not a re-roll of the whole selection on every action. This directly serves the
  flywheel in `docs/VISION.md` (the empty/seeded state bootstraps curation) by extending it across the
  *entire* partly-curated middle, not just the zero state.
- **Both** keep the trust guarantee from "what good looks like": curated clips carry wiki+'s vouch
  and full chrome; suggestions stay **unmistakably distinct and visually subordinate**, so a reader is
  never misled into treating an unvetted auto-suggestion as a vouched-for clip.

## Owner decisions (fixed product constraints — the acceptance criteria below operationalize these)

These were settled by the owner in the issue and are **not open for re-litigation** by UX or Dev;
they are the contract:

1. **Three states, not two.** *empty* (0 curated), *mixed* (≥1 curated **and** ≥1 suggestion
   remaining), *fully-curated* (≥1 curated, 0 suggestions remaining). The binary empty↔curated flip is
   retired.
2. **Coexistence + priority.** Curated clips always sort and render **before** suggestions — in the
   General band and within a section's rail. Suggestions keep the existing dashed/unvetted visual
   treatment and stay visually subordinate; curated content takes priority placement and prominence.
3. **Generous default + see-more.** The General suggestion pool shows a **generous default count**
   (owner guidance: ~8–10) with a **"see more" toggle** revealing the rest. The default is a single
   **named constant**.
4. **Displacement = reflow, not deletion.** When a section-anchored suggestion loses its slot (a
   curated clip occupies / takes priority in that section, etc.), it **folds back into the General
   suggestion pool** rather than disappearing. Suggestions are never silently dropped — only
   reorganized and overflow-collapsed under "see more."
5. **Stability / no-churn is the hard requirement (the actual acceptance bar).** Curating one
   suggestion removes **only that video** from the suggestion set (it is already deduped via
   `curatedVideoKeys()` in `lib/data/index.ts`). The remaining suggestions **must keep their identity,
   order, and on-screen position**. Curating must **not** re-run the candidate pipeline,
   reshuffle, or re-fetch the set. The smooth suggested→curated transition is **aspirational** (a
   light, `prefers-reduced-motion`-gated fade is welcome) — the **no-churn stability is the bar, not an
   animated morph**.
6. **Mixed-state chrome.** The wiki+ panel shows **both** a curated count and a suggestion count; TOC
   entries show **both** a solid curated count and a dashed suggested count for sections that have
   both; the "Be the first to curate" CTA appears **only** at 0 curated. The once-per-context unvetted
   signal (issue #14 — wiki+ panel, General-band header, one-time rail "unvetted set" header) is
   **retained** but **reworded** to introduce the *suggestion subset* within a mixed band/rail (no
   per-card "SUGGESTED" badges reintroduced).

## Scope

### In scope

- The Topic-page **coexistence rendering behavior** across all three states: the General band, the
  plus rail (general + section-anchored), the TOC counts, the wiki+ panel counts, and the
  once-per-context unvetted headers.
- **Curated-before-suggestions ordering** in both the General band and within a section's rail.
- The **General suggestion-pool default count + "see more"** overflow control, with the default as a
  single named constant.
- **Section→General reflow** of a section-anchored suggestion that is displaced by a curated clip.
- **Candidate-set stability** across curation actions (the no-churn invariant) — within the existing
  client-side, computed-and-cached candidate model.
- The **doc reconciliation**: `docs/TOPIC_PAGE_DESIGN.md` updated from the two-state "empty vs
  curated" framing to the three-state coexistence model (priority placement, the general-pool default
  + "see more", the section→general reflow rule, and where the unvetted signal/counts live in the
  mixed state). *(Doc-text reconciliation is part of the build; this Product spec defines the outcome,
  not the wording.)*

### Out of scope

- **TikTok auto-suggestion** — stays YouTube-only per the MVP limitation (`docs/ARCHITECTURE.md`).
- **The curate-clip modal / curation form itself**, and the **curated-modal vs candidate-pinned-player
  split** — no change to either surface.
- **Suggestion relevance re-ranking / quality scoring**, and **re-surfacing previously-dismissed
  candidates** — the candidate set's *composition and ordering* are an input, unchanged here.
- **Phrase-level anchoring**, the **mobile single-column sync mechanics overhaul**, and any
  **server / persistence / auth / read-path caching** work (still the client-side prototype with the
  localStorage-backed `DataStore` seam; candidates remain computed/cached, never stored as rows).
- **A mandatory animated morph transition** — a reduced-motion-gated fade is welcome but not required;
  the no-churn stability invariant (AC10) is the bar.

## Acceptance criteria

Each item is independently verifiable by QA & Review — by a Vitest/RTL unit/component test where a
state can be constructed from props/store, or by a manual check against the running prototype where
noted. "Suggestion" = a live, non-dismissed candidate (the `liveCandidates` set); "curated clip" = a
`Clip`. "Remaining suggestions" excludes any video already curated (deduped via `curatedVideoKeys()`).

### Three states render correctly

1. **Empty state (0 curated).** On a topic with **0 curated clips** and ≥1 suggestion, the page
   renders suggestions exactly as the current empty state does (dashed/unvetted treatment, the
   once-per-context unvetted signal, the "Be the first to curate" CTA). No regression to the
   zero-curation experience.
2. **Mixed state (≥1 curated and ≥1 suggestion).** On a topic with **≥1 curated clip and ≥1
   remaining suggestion**, **both** curated clips **and** suggestions render together on the same
   page — in the General band and in the rail. The legacy "first curated clip hides all suggestions"
   behavior is **gone** (the binary `mode` gate no longer drives whether suggestions render).
3. **Fully-curated state (≥1 curated, 0 suggestions remaining).** On a topic with **≥1 curated clip
   and 0 remaining suggestions**, only curated content renders; no suggestion chrome (no "see more",
   no unvetted set header, no dashed suggestion count) appears. This is the steady end-state of the
   curve and must be visually clean — equivalent to today's fully-curated page.

### Coexistence + priority ordering

4. **Curated-before-suggestions in the General band.** When the General band contains both curated
   general clips and general suggestions, **every curated clip sorts and renders before every
   suggestion** in the band's reading/scroll order. Curated clips keep full curated chrome;
   suggestions keep the dashed/unvetted, visually-subordinate treatment.
5. **Curated-before-suggestions within a section rail.** For a section that has both curated
   section-anchored clips and section-anchored suggestions, **the curated clips render before the
   suggestions** within that section's rail group. The two are not interleaved.

### Generous default + see-more

6. **General suggestion pool has a generous default + "see more".** In the empty and mixed states,
   the General suggestion pool shows **up to a default count** of suggestions (owner guidance ~8–10;
   the exact number is UX's call) and, when more remain, a **"see more" control** that reveals the
   rest. The default is a **single named constant** (verifiably one constant, not a literal repeated
   at call sites). Curated general clips are **not** subject to this cap (curation is the priority
   content; only the suggestion overflow collapses).
7. **"See more" is reversible and toggles only suggestion visibility.** Activating "see more" reveals
   the remaining suggestions without re-fetching, reshuffling, or changing the curated content; a
   "see less"/collapse path returns to the default count. The control is present only when the
   suggestion count exceeds the default.

### Displacement = reflow, not deletion

8. **Displaced section suggestion folds into the General pool.** When a section-anchored suggestion
   loses its section slot because a **curated clip** occupies / takes priority in that section, the
   displaced suggestion **appears in the General suggestion pool** instead — it is **not** removed
   from the page. (Testable: construct a state where a section has a curated clip and a
   section-matched suggestion for the same section; assert the suggestion is reachable in the General
   pool, not absent.) No suggestion is ever silently dropped by displacement — only relocated and, if
   it overflows the default, collapsed under "see more" (AC6).

### Stability / no-churn (the hard requirement)

9. **Curating one suggestion changes only that one video.** Curating a single suggestion turns
   **only that video** into a curated card and removes **only that video** from the suggestion set
   (via the existing `curatedVideoKeys()` dedup). All other suggestions remain present and unchanged.
10. **No churn: remaining suggestions keep identity, order, and position.** After curating one
    suggestion, the **remaining suggestions retain their identity, their relative order, and their
    on-screen position** — there is **no reshuffle and no re-fetch**. Specifically: curating a clip
    does **not** re-run the candidate pipeline (`suggestCandidates`) and does **not** re-derive or
    re-order the candidate set from scratch; the candidate ordering is **stable for the session**.
    (Testable: snapshot the suggestion list's order/identity before and after a curation action of an
    unrelated suggestion; assert the non-curated entries' order and identity are unchanged, and that
    the pipeline was not re-invoked.) **This is the primary acceptance bar of the feature.**

### Mixed-state chrome — counts, CTA, and the once-per-context unvetted signal

11. **wiki+ panel shows both counts in the mixed state.** In the mixed state, the wiki+ panel
    (`components/topic/Infobox.tsx`) surfaces **both** a curated count **and** a suggestion count
    (the exact label/format is UX's). In the empty state it shows the suggestion count (and the
    "Be the first to curate" CTA); in the fully-curated state it shows only curated counts (no
    suggestion count).
12. **TOC shows both solid + dashed counts where applicable.** A TOC entry (including the "General"
    entry) for a section that has **both** curated clips and suggestions shows **both** a **solid
    curated count** and a **dashed suggested count**. A section with only curated clips shows only the
    solid count; a section with only suggestions shows only the dashed count; a section with neither
    shows no count (a normal wiki TOC entry). The TOC count no longer branches on the binary `mode`.
13. **"Be the first to curate" CTA only at 0 curated.** The "Be the first to curate" CTA appears
    **only** in the empty state (0 curated) and is **absent** in the mixed and fully-curated states.
14. **Once-per-context unvetted signal, rescoped to the suggestion subset.** The issue-#14
    once-per-context unvetted signal is **retained in its three locations** (wiki+ panel, General-band
    header, one-time rail "unvetted set" header) but is **reworded to introduce the suggestion
    *subset*** within a mixed band/rail (e.g. it describes "the suggested videos below," not "this
    whole topic is unvetted"). **No per-card "SUGGESTED" badge is reintroduced** (the #14 discipline
    holds); per-card genuine information (the compact match-reason line and the text-labeled source
    pill) is unchanged. In the fully-curated state the unvetted signal is absent (no suggestions to
    introduce).

### Accessibility

15. **A11y preserved.** **AA contrast** holds for every shipping text-on-background pair in the
    changed UI. **No meaning is carried by color or border-style alone** — the curated/suggested
    distinction is reinforced by text (the reworded once-per-context unvetted wording and the TOC's
    text-labeled solid/dashed counts), never by the dashed border or color alone. Every new
    interactive element (notably the **"see more"/"see less" control**) is **keyboard-reachable**,
    shows the project's visible `:focus-visible` ring, and meets the ≥44px touch target where it is a
    primary control. Any suggested→curated transition (the optional fade) is **gated by
    `prefers-reduced-motion`** and degrades to an instant state change. The new control is announced
    sensibly to assistive tech (labeled, with expanded/collapsed state).

### Build

16. **Build is green.** `yarn build`, `yarn typecheck`, and `yarn test` all pass on the branch, and
    `docs/TOPIC_PAGE_DESIGN.md` is updated to the three-state coexistence model (per *In scope*).

## Success metric

**Primary (the intent — the no-churn invariant, directly verifiable):** on a mixed-state topic,
curating one suggestion changes the on-screen state of **exactly one** video (suggested→curated) while
**100% of the other suggestions retain their identity, order, and position**, with **zero** re-runs of
the candidate pipeline. This is the operational definition of "curation feels like changing one
video's state in place," confirmed by QA against AC9–AC10 and by UX's evaluation of the built
transition.

**Secondary (coexistence is real):** on a mixed-state topic, the count of suggestions visible to a
reader is **> 0** (the legacy flip would make it 0); curated clips render before suggestions in 100%
of mixed bands and section rails (AC4–AC5); and a section-anchored suggestion displaced by a curated
clip is reachable in the General pool in 100% of displacement cases (AC8) — i.e. no suggestion is lost
to coexistence.

**Deferred (post-traffic, owned here until Analytics splits out):** once mixed-state topics see real
readers, the leading indicator that coexistence helped the flywheel is the **curate-CTA engagement
rate on mixed-state topics** (suggestion-card "Curate" opens ÷ mixed-state Topic-page views) being
**non-zero and comparable to the empty-state rate** — i.e. keeping suggestions visible through the
partly-curated middle continues to seed curation rather than the page going dark after the first clip.
A complementary leading indicator is **topics progressing past their first curation** (share of
topics with ≥2 curated clips among those with ≥1) trending up. Not measured in the prototype; stated
here so it is instrumentable when analytics lands.

## Open questions for later refinement (deferred — these go to UX / Curation)

- **Exact General-pool default count.** Owner guidance is ~8–10; UX picks the exact number and Dev
  encodes it as the single named constant (AC6). Whether the default differs between empty and mixed
  states (e.g. show fewer suggestions when curated content is already present) is a UX call.
- **Mixed-state header + count wording.** The reworded once-per-context unvetted headers for a mixed
  band/rail (AC14), the wiki+ panel's two-count format (e.g. how "N curated · M suggested" reads —
  AC11), and the General-band header copy when curated clips sit above suggestions — all UX/Curation,
  extending the #14 once-per-context model rather than reintroducing per-card badges.
- **The optional suggested→curated transition.** Whether to ship the light reduced-motion-gated fade
  at all, and its exact treatment — UX's call; not required by any acceptance criterion (the no-churn
  stability is the bar, AC10).
- **"See more" / "see less" affordance details.** Exact label, whether it shows a remaining-count, and
  whether collapse is offered — UX, within AC6/AC7.
- **Displacement priority rule edges.** The precise rule for *which* section-anchored suggestion is
  considered "displaced" when a section gains a curated clip (e.g. all section suggestions vs. only an
  exact-match collision) — Dev/UX, within the AC8 outcome (no suggestion is dropped; displaced ones
  reach the General pool). Re-ranking/quality-scoring of the reflowed pool stays out of scope.
