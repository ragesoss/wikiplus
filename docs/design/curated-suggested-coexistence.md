# Curated and suggested videos coexist on a Topic page — design spec

- **Status:** Design pass (pre-build). Buildable contract for the issue **#60** build-loop run.
- **Owner:** UX / Design
- **Branch:** `issue-60-curated-suggested-coexistence`
- **Primary input:** `docs/specs/curated-suggested-coexistence.md` (Product) — acceptance criteria
  AC1–AC16. **AC10 (no-churn stability) is the primary bar.**
- **Other inputs read:** `docs/TOPIC_PAGE_DESIGN.md` (the committed two-world / General-strip /
  Two-infoboxes / Unvetted-treatment baseline — this spec **supersedes its two-state framing with a
  three-state model**); `docs/design/declutter-candidate-state.md` + `docs/specs/declutter-candidate-state.md`
  (issue #14 — the **once-per-context** unvetted-signal discipline, preserved here and rescoped to the
  *suggestion subset*); `mockups/inline-indigo-empty-v2.html` + `mockups/inline-indigo-empty-v3-declutter.html`
  (suggestion language) and `mockups/inline-indigo-sync.html` (curated language) — the two visual
  languages blended on one page.
- **Touchpoints the build implements against (named in the Product spec):** `app/topic/TopicView.tsx`
  (retire the binary `mode` gate at the current `:445`; the `tocEntries` count branch; the rail render;
  the `aria-label`s), `components/topic/GeneralStrip.tsx`, `components/topic/Toc.tsx`,
  `components/topic/Infobox.tsx`, `components/topic/CandidateBits.tsx`
  (`CandidateSetHeader` reword + a new "see more" control), and a single named constant in
  `lib/candidates/` (the General-pool default count).

> **Decision-not-question.** Where the Product spec or #14 left an item to UX (the exact default
> count, the header/count wording, the "see more" affordance, whether to ship the fade), this spec
> **states the call as a decision**, not an open question. Those are flagged **[DECISION]**.

---

## 0. The shape of the change (orientation for Dev)

Today the page is governed by a single binary: `mode = clips.length > 0 ? "curated" : "empty"`
(`TopicView.tsx`). That one value drives the Infobox face, the TOC count style, the General band,
the rail contents, the set header, and every `aria-label`. The whole feature is **retiring that
binary** in favor of a derived **three-state** value and rendering **both** content types when they
co-occur.

**Replace the `mode` derivation with a derived state computed from two independent facts** — the
curated count and the *remaining* suggestion count (`liveCandidates`, already deduped against
`curatedVideoKeys()` and `persistedDismissed`):

```
hasCurated     = clips.length > 0
hasSuggestions = liveCandidates.length > 0     // remaining, deduped — the existing memo

state = !hasCurated                 ? "empty"          // 0 curated, ≥1 suggestion (or 0)
      :  hasCurated && hasSuggestions ? "mixed"          // ≥1 curated AND ≥1 suggestion
      :                                "fully-curated"   // ≥1 curated, 0 suggestions
```

This is a presentation derivation, not a data-model change. **Every component that currently takes
`mode: "curated" | "empty"` should instead receive the facts it needs** (`hasCurated`,
`hasSuggestions`, and the curated + suggestion lists/counts) so it can render the *coexistence*
case. The component contracts below specify exactly what each needs. *How* Dev threads this
(a derived `state` string, or just passing both lists) is a Dev call — the outcome is: when both
lists are non-empty, both render, curated first.

**The no-churn invariant is structural, not a polish concern (AC10 — the bar).** Curating one
suggestion must change exactly one video's state and leave the others' identity, order, and
on-screen position untouched, with **no re-run of `suggestCandidates` and no re-derivation of the
candidate set from scratch**. The current code already has the right seams: `liveCandidates` is a
`useMemo` that *filters* `candidates` (it removes the just-curated id, never reorders), and the
candidate-pipeline effect deliberately **excludes `clips` from its deps** (so curating does not
re-fire the search). This spec's ordering rules (§2) must be implemented as a **stable sort over the
already-derived set** — never a re-fetch, re-rank, or re-keyed remount. §6 specifies the (optional)
transition; the stability is independent of it.

---

## 1. Personas & user stories

### Personas (carried from the committed Topic-page direction)

- **The reader** lands on a Topic page to read the encyclopedia article and, on the plus side,
  weigh short videos about it. On a partly-curated topic they want the trustworthy curated clips
  *and* the chance to discover good unvetted candidates worth watching next.
- **The curator** (logged-in) vets candidates into curated clips. They experience vetting as a
  triage loop: watch, compare to the article, curate or dismiss, move on. They need each act to feel
  like *changing one video's state in place* — steady progress on a stable list, not a re-roll.
- **The moderator/reviewer** is out of scope here (their affordances ride the existing clip card,
  unchanged); the coexistence model must not disturb them.

### User stories this feature serves

1. *As a **reader** on a partly-curated topic, I want to see the vetted clips and the still-unvetted
   candidates together, so the page stays useful through the whole middle of the curation curve
   instead of going dark after the first clip.* → **AC2, AC4, AC5, AC8**
2. *As a **reader**, I want curated clips to read as clearly vouched-for and suggestions to read as
   clearly not-yet-reviewed, so I'm never misled into trusting an auto-suggestion as a curated clip.*
   → **AC4, AC5, AC14, AC15**
3. *As a **curator**, when I curate one suggestion I want only that video to change and everything
   else to stay exactly where it was, so curation feels like steady progress, not a re-roll.* →
   **AC9, AC10 (the bar), AC7**
4. *As a **reader**, I don't want to be buried under fifty candidates — show me a generous default
   and let me ask for more.* → **AC6, AC7**
5. *As a **curator**, when I curate a clip in a section that also had a suggestion, I don't want that
   suggestion to vanish — I want it to still be reachable (in the General pool) so I can vet it too.*
   → **AC8**
6. *As a **reader** using a keyboard or a screen reader, I want the curated/suggested split and the
   counts conveyed in words (not just dashed borders/colors), and every new control operable by
   keyboard with a visible focus ring.* → **AC12, AC14, AC15**

---

## 2. The coexistence model — ordering, grouping, and the divider

The defining rule (owner-fixed, AC4/AC5): **curated content always sorts and renders before
suggestions**, in the General band and within each section's rail group. They are **never
interleaved**. Curated content keeps the full Indigo-Press curated language (solid 2px ink border +
offset shadow, stance/accuracy chips, context-by attribution, upvote, owner/reviewer rows).
Suggestions keep the #14 unvetted language (dashed `candcard`, desaturated/hatched thumbnail, no
chips, compact match line + source pill) and stay **visually subordinate**.

### 2.1 The General band (full-bleed, `GeneralStrip.tsx`)

In **mixed** state the band renders **one horizontally-scrollable row** read left→right:

```
[ band header — see §5.3 ]
[ curated general clip ][ curated general clip ] … │ [ "Suggested" divider ] │ [ suggestion ][ suggestion ] … [ see more ]
                          ← curated group (all) →     ← subordinate group header →   ← suggestion group, capped at the default →
```

- **Curated group first, in full.** Every general curated clip renders before any suggestion. The
  curated group is **NOT capped** (curation is the priority content — AC6).
- **A visual divider + inline sub-header separates the two groups** so the boundary is explicit and
  text-labeled, not implied by border style alone (AC14/AC15). **[DECISION]** the divider is an
  **inline group label** that scrolls *with* the row (so it stays attached to the suggestions even
  as the reader scrolls horizontally), styled as a vertical hairline + an uppercase eyebrow:
  - On the indigo band, the eyebrow is **white** text with a **2px white left-border rule**:
    `Suggested · uncurated` (the once-per-context wording — §5.3). It is a `<span>`, not a heading
    (the band already has the one `<h2>`; see §5.3 for the heading-level rule).
  - In the **empty** state there is no curated group, so no divider renders — the band header itself
    is the once-per-context signal (unchanged from #14).
  - In **fully-curated** there are no suggestions, so no divider and no suggestion group render.
- **Suggestion group is capped at the default** (§3) with a trailing **"see more" control** (§3.2)
  as the last item in the row when more remain.

### 2.2 Within a section rail (`TopicView.tsx` rail render)

For a section that has both curated section-anchored clips and section-anchored suggestions, the
rail renders them as **two stacked groups** in this order:

```
[ curated ClipCard ]        ← all curated clips for the section, full chrome
[ curated ClipCard ]
[ "Suggested" sub-header ]  ← the rescoped CandidateSetHeader (§5.3) — ONE per rail, atop the suggestion group
[ CandidateCard ]           ← dashed candidates, after the curated group
[ CandidateCard ]
```

- **The curated clips render before the suggestions** within the rail (AC5). They are not
  interleaved by section position; all curated rail cards come first, then the suggestion group.
- **The `CandidateSetHeader` is the divider in the rail.** It already exists (#14) and is the
  one-time "unvetted set" header. In mixed state it sits **between** the curated rail group and the
  suggestion rail group, introducing the suggestion subset (§5.3 rewords its copy). It renders
  **once** per rail, only when there is ≥1 rail suggestion to introduce. (Today it's gated on
  `mode === "empty"`; the new gate is `hasSuggestions in the rail`, independent of curated count.)
- **No "see more" inside a section rail.** The "see more" overflow applies only to the **General
  suggestion pool** (§3). Section-anchored suggestions are not capped (the candidate pipeline already
  anchors only a small number per section; capping per-section would risk hiding the only suggestion
  for a section). If a section's suggestion list is ever large, that's a pipeline concern, out of
  scope here.

### 2.3 Scroll-sync is unchanged

`railItems` (the per-section first card the scroll-sync scrolls to) currently switches on `mode`.
It must become **the union, curated-first**: for each section, prefer the first *curated* clip as
the sync anchor; if a section has only suggestions, the first suggestion anchors it. The sync
mechanics (the active-section pairing, the TOC highlight) are otherwise untouched. This is the only
sync change; do not redesign sync.

---

## 3. Generous default + "see more" (General suggestion pool)

### 3.1 The default count — **[DECISION]: 8**

The General suggestion pool shows **up to 8 suggestions by default**, in both the empty and mixed
states. (Owner guidance was ~8–10; 8 is chosen as the calm low end — enough to feel generous and
seed curation, few enough that the band stays a scannable overview rather than a wall, especially
once curated clips already occupy the front of the row. Keeping the **same** default in empty and
mixed is deliberate: it's one rule to reason about, and in mixed state the curated group already adds
length to the row, so a lower suggestion cap there would be redundant complexity for no user
benefit.)

- **This is a single named constant** (AC6) — e.g. `GENERAL_SUGGESTION_DEFAULT = 8`, defined once in
  `lib/candidates/` (alongside the pipeline constants) and imported where the band slices the pool.
  It must **not** be a literal repeated at call sites.
- **The cap applies only to the General *suggestion* group.** Curated general clips are never capped
  (AC6). Section-anchored suggestions are not capped (§2.2).
- The cap is a **display slice over the already-derived, already-ordered `generalCandidates`** — it
  never re-fetches or re-orders. `shown = generalCandidates.slice(0, expanded ? len : DEFAULT)`.

### 3.2 The "see more" / "see less" control — **[DECISION]**

- **Presence:** the control renders **only when `generalCandidates.length > GENERAL_SUGGESTION_DEFAULT`**
  (AC7 — "present only when the suggestion count exceeds the default"). Otherwise the whole pool shows
  and there is no control.
- **Placement:** it is the **last item in the General suggestion group's scroll row**, after the last
  shown suggestion tile (so it reads as "…and N more"). It is a real `<button>`, sized to the tile
  rhythm (min-height ≥44px — AC15), with the band's white-fill-on-indigo control language (2px ink
  border, white background, ink text) so it's legible on the indigo band and matches the existing
  "Add video" / "Search" buttons.
- **Label + remaining count [DECISION — show the remaining count]:**
  - Collapsed: **`See N more ▾`** where `N = generalCandidates.length − GENERAL_SUGGESTION_DEFAULT`
    (e.g. `See 7 more ▾`). Showing the remaining count sets the expectation honestly and is genuine
    information, not chrome. The `▾` glyph is `aria-hidden` (decorative).
  - Expanded: **`See fewer ▴`** (collapses back to the default). The `▴` glyph is `aria-hidden`.
- **Behavior (AC7):** activating it toggles **only suggestion visibility** — it reveals/hides the
  overflow suggestions by changing a local `expanded` boolean. It does **not** re-fetch, reshuffle,
  re-order, or touch curated content. Collapsing returns to exactly the first `DEFAULT` suggestions
  in the same order (a pure slice — identity/order preserved).
- **ARIA / keyboard (AC15):**
  - `aria-expanded={expanded}` on the button (announces collapsed/expanded state).
  - `aria-controls` points at the `id` of the suggestion-group container (so AT associates the toggle
    with what it expands).
  - The accessible name is the visible label text (`See 7 more` / `See fewer`) — self-describing
    without the glyph. (No separate `aria-label` needed; the text is sufficient and the glyph is
    hidden.)
  - Keyboard-reachable in normal tab order; shows the project `:focus-visible` ring (3px indigo, 2px
    offset). Activates on Enter/Space (native `<button>`).
  - **Focus on toggle:** focus **stays on the button** across expand/collapse (the button persists in
    the DOM; do not move focus). The newly-revealed tiles appear after it in the source order, so a
    screen-reader user continues forward into them naturally. When collapsing, the focused button
    remains; the now-hidden tiles are removed from the tab order.
- **State reset:** `expanded` is local UI state. It does **not** need to survive a curation action and
  should not be tied to the candidate-set identity — but **curating/dismissing a suggestion must not
  collapse an expanded pool** (that would be churn the reader didn't ask for). Keep `expanded` in a
  `useState` that is independent of the candidate list; removing one item from an expanded list just
  shortens it (AC10). If the pool drops to ≤ DEFAULT after dismissals, the control disappears and
  `expanded` becomes moot (harmless).

---

## 4. Section→General reflow on displacement (AC8)

When a section gains a curated clip and a section-anchored *suggestion* loses its slot, that
suggestion **folds back into the General suggestion pool** — it is never dropped from the page.

- **No special "I was moved" chrome — [DECISION].** The reflowed suggestion reads as an ordinary
  General-pool suggestion: same dashed `candcard`, same match-reason line, same source pill, same
  Curate/Not-relevant actions. Adding a "this was moved from §X" banner would be noise the reader
  didn't ask for, contradicting the #14 calm-before-engagement principle; the match-reason line
  already carries *why it matched* (which may name the section), which is the genuinely useful
  context. So: it just appears in the General pool, sorted after curated general clips, subject to
  the §3 default + see-more like any General suggestion.
- This is primarily a **derivation** outcome, not new UI: whichever suggestions the pipeline/derivation
  classifies as General (because they're displaced or because they were never section-matched) render
  in the General pool. The design requirement is only that displacement results in **General-pool
  presence, never absence** (AC8), and that the reflowed item is reachable under "see more" if it
  overflows the default (AC6). If the displaced suggestion overflows past the default-8, it lives
  under "see more" — still reachable, not lost.
- **Stability note:** reflow is a consequence of *which section a suggestion is shown under*, not a
  re-fetch. The displaced suggestion keeps its identity; only its render location changes. This must
  not trigger a candidate-pipeline re-run (AC10).

---

## 5. Mixed-state chrome — counts, headers, CTA

### 5.1 wiki+ panel two-count format (`Infobox.tsx`) — **[DECISION]**

The panel today takes `mode: "curated" | "empty"` and shows either three stat numerals (curated) or
the "0 / N auto-suggestions / Be the first to curate" empty block. It must render **three faces**.
Pass the panel the facts it needs (`hasCurated`, `suggestionCount`, `stats`) rather than the binary
`mode`.

| State | What the panel shows |
|---|---|
| **empty** (0 curated) | Unchanged from #14: the big `0`, `videos curated`, then **`N auto-suggestions from {sources}`**, then the **`✦ Be the first to curate`** CTA, then the synced line. |
| **mixed** (≥1 curated, ≥1 suggestion) | The **three curated stat numerals** (Videos / Creators / Curators) as in curated mode, **plus a two-count line** below them stating both counts (see wording). **No** "Be the first to curate" CTA (AC13). |
| **fully-curated** (≥1 curated, 0 suggestions) | Exactly today's curated panel: three stat numerals + synced line. **No** suggestion count, **no** unvetted line, **no** CTA. |

**The two-count line (mixed) — [DECISION] wording:**

> **`{V} curated · {M} suggested`**

rendered as one line beneath the three numerals, e.g. **`3 curated · 12 suggested`**. The interpunct
`·` is the existing Indigo-Press separator (used in the synced line and creator credits). Use
`pluralize` only if singular matters; here the format is count-noun pairs, so render
`${V} curated · ${M} suggested` directly (both nouns read fine at 1: "1 curated · 1 suggested"). The
word "suggested" carries the unvetted meaning in text (AC14/AC15 — not color alone). `{M}` is
`liveCandidates.length` (remaining, deduped — the same value the panel's empty mode already shows as
the suggestion count). This **is** the rescoped once-per-context volume signal for the whole topic
(the #14 "N auto-suggestions" line, now a two-count line because curated content also exists).

- Place the two-count line where the empty mode's "N auto-suggestions" line sits — directly under the
  numerals, above the synced line — so the panel's vertical rhythm is stable across states.
- The synced line stays as today's curated synced line in mixed + fully-curated.

### 5.2 TOC dual counts (`Toc.tsx`) — **[DECISION]**

Today each TOC row shows **either** a solid indigo count (curated mode) **or** a dashed violet `~n`
(empty mode) — exclusive on `mode`. A `no video` text badge handles zero-count section rows. The new
model must show **both** where a section has both.

Change the TOC count model from "one count + a mode" to **per-row `{ curated: number, suggested:
number }`** (computed in `tocEntries` in `TopicView.tsx`, no longer branching on the binary `mode`):

```
curated   = sectionClips.filter(c => c.sectionSlug === slug).length
suggested = sectionCandidates.filter(c => c.sectionSlug === slug).length
// the "General" row uses generalClips.length / generalCandidates.length
```

Render rules (per row, right-aligned, in this order — curated badge then suggested badge):

| Row has… | Renders |
|---|---|
| curated only (`c>0, s=0`) | the **solid indigo** count badge: `{c}` (unchanged) |
| suggestions only (`c=0, s>0`) | the **dashed-outline violet** badge: `~{s}` (unchanged) |
| **both** (`c>0, s>0`) | **both badges, side by side**: the solid indigo `{c}` **then** the dashed violet `~{s}` (curated-first, matching the body order) |
| neither, **section row** (`c=0, s=0`) | the muted `no video` text badge (unchanged) |
| neither, **band/General row** | nothing (the band conveys its own emptiness — unchanged) |

- **Text-labeled accessibility (AC12/AC15 — counts must not rely on solid-vs-dashed alone).** The two
  badges differ visually (solid fill vs dashed outline) AND in their **title/accessible text**:
  - Solid curated badge: `title="{c} curated video(s)"` and, for SR parity, an `sr-only` suffix or
    the title is sufficient — **[DECISION]** add an `sr-only` span inside each badge so the meaning is
    in the accessible name, not only the `title` tooltip: solid badge contains `<span class="sr-only">
    curated</span>`, dashed badge contains `<span class="sr-only">suggested, unvetted</span>`. The
    visible numerals are `{c}` and `~{s}`; the `~` plus the `sr-only` word carry "suggested" for
    sighted-with-low-color-vision and SR users respectively.
  - The existing dashed badge already has `title="{s} unvetted suggestion(s)"`; keep it and add the
    `sr-only` word so a screen reader reads "3, curated, 5, suggested unvetted" rather than two bare
    numbers.
- When a section has both, the row label is the section title (unchanged); only the badge cluster
  changes. Indentation by level is unchanged.

### 5.3 Once-per-context unvetted headers, rescoped (AC14) — **[DECISION] microcopy**

The #14 discipline holds: the unvetted signal reads **once per context**, in its three locations —
**no per-card "SUGGESTED" badge** is reintroduced; per-card keeps only the match-reason line + source
pill. What changes is the **copy**, so each location introduces the *suggestion subset* within a
mixed band/rail, not "this whole topic is unvetted." In the **empty** state the copy is unchanged from
#14 (the whole plus side is suggestions); the rewording is the **mixed-state** copy.

| Location | Empty-state copy (unchanged, #14) | **Mixed-state copy (this spec)** |
|---|---|---|
| **wiki+ panel** | `N auto-suggestions from {sources}` | the two-count line **`{V} curated · {M} suggested`** (§5.1) — the panel's count IS the rescoped signal in mixed |
| **General band divider/sub-header** (§2.1) | the band header `＋ Suggested videos` + `uncurated` pill + `— auto-found candidates, not yet vetted` (this whole band is suggestions) | the **inline group divider** label after the curated group: **`Suggested · uncurated`** with, on a second line if width allows or as the `title`, **`— auto-found, not yet vetted`**. It introduces *the videos to its right*, not the band. The band's own `<h2>` becomes **`＋ General`** in mixed (it leads with curated general clips), so the band heading no longer says "Suggested"; the divider does. |
| **Rail "unvetted set" header** (`CandidateSetHeader`, §2.2) | `Suggested · uncurated` + `Auto-found from {sources}. No context notes yet — a human hasn't reviewed these. Curate one to vouch for it.` | **`Suggested · uncurated`** + **`The suggested videos below are auto-found from {sources} — no context notes yet, not reviewed by a human. Curate one to vouch for it.`** The phrase **"The suggested videos below"** scopes it to the subset, not the topic. |

- **Implementation:** `CandidateSetHeader` takes `sources` today; add an optional prop to switch the
  body copy between the empty wording and the mixed "suggested videos below" wording (or pass the
  scoped string). The component stays a single dashed-outline block (`.candsethead`).
- **The General band `<h2>` is `＋ General` in mixed and fully-curated; `＋ Suggested videos` only in
  empty.** This keeps exactly one `<h2>` in the band (heading order is unbroken for AT), and the
  curated-leading band correctly reads as the General overview with a subordinate suggested group.
- **Fully-curated:** the unvetted signal is **absent everywhere** — no divider, no `CandidateSetHeader`,
  no suggested count in the panel or TOC (AC14, AC3). There are no suggestions to introduce.

### 5.4 "Be the first to curate" CTA — only at 0 curated (AC13)

The `✦ Be the first to curate` CTA renders **only in the empty state** (0 curated). It is **absent**
in mixed and fully-curated. (It lives in `Infobox.tsx`'s empty face; the mixed/fully-curated faces
don't render it. No new CTA replaces it in mixed — curating is reached via each suggestion's existing
`✦ Curate` button.)

---

## 6. The optional suggested→curated transition (AC10 / AC15)

**The hard requirement is no-churn stability, NOT an animated morph** (AC10). The card stays in a
stable position and swaps type. With that as the bar:

- **[DECISION] Ship a light, `prefers-reduced-motion`-gated cross-fade — but only as polish over an
  already-stable layout.** When a suggestion is curated, the suggestion card is removed from the
  suggestion group (it's now deduped out of `liveCandidates`) and the new curated clip appears at the
  **front of the curated group** (curated clips render newest-first per the existing
  `setClips((prev) => [added, ...prev])`). These are two *different* positions (suggestion group →
  front of curated group), so a true single-card morph-in-place is not what happens, and chasing one
  would risk the churn AC10 forbids.
- **Therefore the transition is a pair of independent, position-stable fades, not a flying morph:**
  - The curated clip **fades in** at the front of the curated group (a short opacity 0→1, ≤200ms).
  - The remaining suggestions **do not move, re-key, or re-fade** — they keep their DOM identity and
    on-screen position (AC10). Only the curated count/group grows ahead of them.
  - Both fades are gated by `prefers-reduced-motion`: under reduced-motion the curated clip appears
    **instantly** (no fade), and everything else is an instant state change. Reuse the existing
    `prefersReduced` signal already threaded through `TopicView`/`GeneralStrip`.
- **No layout shift for the reader's current focus.** Because the curated group grows at its *front*
  (top-left of the row / top of the rail) and the suggestion group is after it, the suggestions the
  reader may be looking at shift only by the width/height of one new curated card — acceptable and
  expected (a curation happened). Do not animate that reflow; let it be instant under reduced-motion
  and a plain fade otherwise.
- **This is genuinely optional.** If the build is time-constrained, shipping **no** fade (instant
  appearance) fully satisfies AC10 and AC15. The fade is a nice-to-have; the stability is the contract.

---

## 7. All states — the buildable state table

For each state: the General band, the plus rail, the TOC, and the wiki+ panel. (Loading/error are
per-concern overlays on top of these, §7.4/§7.5.)

### 7.1 Empty (0 curated, ≥1 suggestion) — AC1

No regression to today's empty state.

- **General band:** `<h2>` = `＋ Suggested videos`; `uncurated` pill; `— auto-found candidates, not
  yet vetted`; the **Find more** manual-source cluster (Search TikTok / Search YouTube / ＋ Add
  video); then the suggestion tiles capped at **8** with **`See N more`** if >8. No curated group, no
  divider.
- **Plus rail:** `CandidateSetHeader` (empty-state copy) atop the rail suggestion list; then the
  section-anchored suggestion cards.
- **TOC:** dashed violet `~n` badges; `no video` on empty section rows.
- **wiki+ panel:** `0` / `videos curated` / `N auto-suggestions from {sources}` / `✦ Be the first to
  curate` / synced line.

### 7.2 Mixed (≥1 curated, ≥1 suggestion) — AC2 (the new state)

- **General band:** `<h2>` = `＋ General`; `N video(s)` count pill for the curated general clips; the
  **curated general clips** (full chrome) first; the **`Suggested · uncurated` divider** (§5.3); then
  the **general suggestions** capped at **8** with **`See N more`** if >8. The **Find more** cluster:
  **[DECISION]** keep it visible in mixed too (it's the path to add a video the pipeline missed, and
  still useful on a partly-curated topic) — render it after the band header, before the curated group,
  the same as empty. *(Rationale: a partly-curated topic still benefits from manual sourcing; hiding
  it would be a regression in reach for no benefit.)*
- **Plus rail:** the **curated `ClipCard`s** for each section first (full chrome, upvote, owner/reviewer
  rows as today); then the **`CandidateSetHeader`** (mixed copy, §5.3) introducing the suggestion
  subset; then the **section-anchored suggestion `CandidateCard`s**.
- **TOC:** per the §5.2 dual-count rules — solid `{c}` and/or dashed `~{s}`; `no video` only where both
  are zero on a section row.
- **wiki+ panel:** three curated numerals + the **`{V} curated · {M} suggested`** line + synced line.
  No CTA.

### 7.3 Fully-curated (≥1 curated, 0 suggestions) — AC3

Visually clean; equivalent to today's curated page; no suggestion chrome anywhere.

- **General band:** `<h2>` = `＋ General`; `N video(s)`; curated general clips only. **No divider, no
  suggestion group, no "see more."** The **Find more** cluster: **[DECISION]** *not* shown in
  fully-curated (the band reads as a finished curated overview; "Add video" remains reachable — see
  note). *Wait —* to keep manual sourcing reachable without re-introducing empty-state chrome, **keep
  only the `＋ Add video` button** in fully-curated (drop the two "Search …" links), rendered as a
  single quiet control in the band's action row. *(Rationale: a curator on a fully-curated topic may
  still want to add a missed video; the Search-platform links are an empty-state discovery aid that's
  noise here, but Add-video is a standing action. This keeps the state clean while not stranding the
  add path.)*
- **Plus rail:** curated `ClipCard`s only. **No `CandidateSetHeader`.** If a topic's curated clips are
  all general (no section-anchored), the existing "All curated clips … are general overviews — see the
  strip above." line shows (unchanged).
- **TOC:** solid indigo `{c}` counts; `no video` on empty section rows. No dashed badges.
- **wiki+ panel:** three numerals + synced line. No suggestion count, no CTA.

### 7.4 Loading (candidate fetch in flight)

The candidate search is **decoupled from `storeReady`** (it must never block the chrome). The
curated content and the chrome render immediately from the store; suggestions stream in.

- **The curated page renders fully and is never disturbed by the candidate fetch.** Curated clips,
  the curated TOC counts, the curated panel numerals all paint from `clips` regardless of candidate
  loading. **[DECISION]** while candidates are loading, render the curated state as-is and show the
  suggestion-loading affordance only in the suggestion regions:
  - **General band:** after the curated group (mixed) or alone (empty), show the existing 3-tile
    skeleton row with `aria-busy="true"` and the transient `Finding videos…` tag. Under
    `prefers-reduced-motion` the skeletons are static (no pulse) — already implemented.
  - **Rail:** the existing `Looking for suggestions…` polite line in the suggestion region (after the
    curated rail group in mixed).
  - The polite live region announces `Looking for suggested videos…` → `Found N suggested videos.` /
    `No suggested videos found.` (already implemented; make it fire in **mixed** too, not only empty —
    today it's gated `mode === "empty"`; change to "whenever a candidate fetch runs").
- **Suggestions appear without disturbing curated content (AC10-adjacent):** when the fetch resolves,
  the suggestion group/cards populate **after** the curated group — the curated DOM is untouched (no
  re-key, no reorder). The TOC's suggested badges and the panel's suggested count appear/update as the
  set resolves; the curated badges/numerals never flicker.

### 7.5 Error / no-key / zero-results (candidate fetch)

The candidate fetch must **degrade silently** and **never** take the curated content down with it.

- **No source enabled (no key — every local/CI build):** the live path is a **no-op** — no skeleton,
  no announcement, keep the seeded/empty set (already implemented). The page renders empty/mixed/
  fully-curated purely from the seeded data.
- **Fetch error / quota / zero hits:** treat as **"no suggestions found"** — show the honest
  zero-results line in the suggestion region (General band: `No videos found for this topic yet. Try a
  manual search below, or add one by link.`; rail: `No suggestions for this topic yet …`). **Never** an
  error UI for candidates. If there ARE curated clips, the page is simply **fully-curated** for this
  load (curated content + no suggestion chrome). The curated content is unaffected.
- **Store-read error (DB down) is separate** and already handled: the rail shows `Couldn't load curated
  videos — please refresh.` and the article still renders. The candidate-fetch error path above is
  distinct from the store-read floor; don't conflate them.
- **Key principle:** suggestions can appear, disappear (dismiss, error→zero), or fail to load, and in
  **every** case the curated clips, curated TOC counts, and curated panel numerals are byte-stable.
  The state simply reads as `mixed` when suggestions exist and `fully-curated` when they don't.

---

## 8. Responsive behavior

Web-first, responsive; the `lg` breakpoint is the two-column↔single-column boundary (matching the
existing grid `lg:grid-cols-[1fr_360px]`).

- **`lg`+ (two-column):** unchanged structure — article left, sticky plus rail (360px) right; the
  General band full-bleed across both columns. New elements:
  - The General band's **curated group + divider + suggestion group** sit in the one horizontally-
    scrollable row; the **`See N more`** button is the trailing item in that row. Horizontal scroll
    behavior is unchanged (the `overflow-x-auto` row).
  - The rail's **curated group → `CandidateSetHeader` → suggestion group** stack vertically in the
    sticky rail (unchanged rail mechanics).
- **`< lg` (single column):** columns stack — article, then the full-width band, then the rail below.
  - The **band's two groups + divider** stay in the same horizontal-scroll row (it's full-width at all
    widths); the divider scrolls with the row, keeping the "Suggested" label attached to its group.
  - The rail flows below the article; **the `CandidateSetHeader` is especially valuable here** — it
    front-loads the unvetted framing once at the top of the stacked suggestion group instead of forcing
    the reader past it on every card (carried from #14).
  - The **`See N more`** button: at narrow widths the suggestion group is the same scroll row, so the
    button remains the trailing item. It must remain ≥44px tall and reachable.
  - The **TOC dual badges** wrap if needed but should fit (two short badges); the row label truncates
    (`truncate`) before the badges, never the badges.
- **The wiki+ panel two-count line** is one short line; it wraps gracefully but should fit the 360px
  rail and the full-width stacked panel without truncation.
- **Touch targets:** the `See N more` button and every existing control (Curate / Not relevant / Add /
  Search) keep ≥44px min height (AC15). The existing candidate/clip controls are unchanged.

---

## 9. Accessibility requirements (AC15 — baseline, must hold)

- **AA contrast for every new/changed text-on-bg pair:**
  - General band **`Suggested · uncurated` divider** — **white on the indigo band** (`#676EB4`): the
    band already uses white text on indigo for the `<h2>` and the `uncurated` pill; white-on-`#676EB4`
    ≈ 4.7:1 (AA for the bold ≥14px / uppercase eyebrow used). Use the same white the band header uses.
  - **`See N more` button** — ink text on white fill, 2px ink border, on the indigo band: ink
    `#2C2C2C` on white ≈ 14:1 (AA). Matches the existing "Add video"/"Search" buttons.
  - **wiki+ panel two-count line** `{V} curated · {M} suggested` — `text-ink2` (`#595959`) on the white
    panel ≈ 7:1 (AA), matching the empty mode's "N auto-suggestions" line it replaces.
  - **TOC dual badges** — solid: brand `#676EB4` on white ≈ 4.7:1 (the existing curated badge, AA);
    dashed: violet `#5248AF` on white ≈ 6.5:1 (the existing suggested badge, AA). No new color pair.
  - **`CandidateSetHeader` mixed copy** — same `text-ink2`/`text-violet`/`text-muted` on white as the
    #14 header (all ≥4.5:1, recorded in `docs/design/declutter-candidate-state.md` §7). No new pair.
- **No meaning by color or border-style alone (AC14):** the curated/suggested split is reinforced by
  **words everywhere** — the panel's `… curated · … suggested`, the TOC badges' `sr-only`
  `curated` / `suggested, unvetted` text + the `~` prefix on the suggested badge, the band divider's
  `Suggested · uncurated` label, and the rail `CandidateSetHeader`. The dashed border and violet color
  are never the *only* signal.
- **Heading structure:** the band keeps exactly **one `<h2>`** in every state (`＋ General` or `＋
  Suggested videos`); the divider and the `CandidateSetHeader` are **not** headings (`<span>` / a
  styled block) so the heading outline isn't fragmented. The `CandidateSetHeader`'s "Suggested ·
  uncurated" is an eyebrow `<span>`, not an `<h3>` (carried from #14).
- **"See more" control:** native `<button>`, keyboard-reachable, `:focus-visible` ring (3px indigo, 2px
  offset), `aria-expanded`, `aria-controls`, visible text label as the accessible name, ≥44px target.
  Focus stays on the button across toggle (§3.2).
- **Reduced motion:** the optional curated-clip fade (§6) is gated by `prefers-reduced-motion` and
  degrades to an instant state change. The loading skeleton's pulse is already reduced-motion-gated.
  No new always-on motion.
- **Live regions:** the candidate-search polite announcement must fire in **mixed** as well as empty
  (today it's empty-only). The dismiss/upvote/review notices are unchanged. None of the new chrome
  introduces an assertive/interrupting region.
- **Curated content is never disturbed by suggestion activity** — relevant to AT too: a screen-reader
  user reading curated cards is not interrupted or re-ordered when suggestions stream in, dismiss, or
  fail (the curated DOM is stable — AC10).

---

## 10. Acceptance-criteria map (design → AC)

| AC | Where this spec satisfies it |
|---|---|
| **AC1** empty unchanged | §7.1 (empty face preserved; #14 chrome intact) |
| **AC2** mixed renders both | §0 (three-state derivation), §2 (coexistence), §7.2 |
| **AC3** fully-curated clean | §7.3 (no suggestion chrome anywhere) |
| **AC4** curated-before-suggestions, General band | §2.1 (curated group first, then divider, then suggestions) |
| **AC5** curated-before-suggestions, section rail | §2.2 (two stacked groups, curated first; not interleaved) |
| **AC6** generous default + see-more, single constant | §3.1 (`GENERAL_SUGGESTION_DEFAULT = 8`, one constant; curated not capped) |
| **AC7** see-more reversible, toggles only suggestions | §3.2 (local `expanded`, pure slice, present only when >default) |
| **AC8** displaced section suggestion → General pool | §4 (reflow to General, no special chrome, reachable under see-more) |
| **AC9** curating changes only that video | §0 (stable filter), §6 (one card swaps type) |
| **AC10** no churn (the bar) | §0 (stable sort/filter, no pipeline re-run), §6 (position-stable, optional fade), §7.4/§7.5 (curated DOM byte-stable) |
| **AC11** wiki+ panel both counts (mixed) | §5.1 (three faces; `{V} curated · {M} suggested` in mixed) |
| **AC12** TOC dual counts | §5.2 (per-row curated+suggested badges, text-labeled) |
| **AC13** CTA only at 0 curated | §5.4 (empty face only) |
| **AC14** once-per-context unvetted, rescoped to subset | §5.3 (reworded 3-location copy; no per-card badge) |
| **AC15** a11y preserved | §9 (AA pairs, text-not-color, see-more keyboard/ARIA/target, reduced-motion) |
| **AC16** build green + doc reconciled | §11 (doc reconciliation note for Dev) |

---

## 11. Hand-off to Development

Build the above against the named touchpoints. **The design spec is the contract; the visual
references are the two committed mockups** (`inline-indigo-sync.html` curated language,
`inline-indigo-empty-v3-declutter.html` suggestion language) — this feature blends them on one page,
it does not invent a third visual language.

What Development should build (and reconcile):

1. **Retire the binary `mode` gate** (`TopicView.tsx` ~`:445`) in favor of the three-state derivation
   (§0). Thread the facts each component needs (`hasCurated`, `hasSuggestions`, the curated +
   suggestion lists/counts) instead of the binary `mode`.
2. **`GeneralStrip.tsx`** — render the curated group, the §2.1 divider, and the capped suggestion
   group with the `See N more` control (§3); `<h2>` = `＋ General` in mixed/fully-curated, `＋
   Suggested videos` only in empty; keep the Find-more cluster per §7.2/§7.3.
3. **`Toc.tsx` + `tocEntries`** — per-row `{ curated, suggested }` counts; render both badges where a
   section has both (§5.2); text-labeled `sr-only` words on each badge.
4. **`Infobox.tsx`** — three faces; the `{V} curated · {M} suggested` mixed line; CTA only at 0
   curated (§5.1/§5.4).
5. **`CandidateBits.tsx`** — `CandidateSetHeader` mixed copy ("The suggested videos below …", §5.3);
   the rail set-header gate becomes "≥1 rail suggestion," not `mode === "empty"`; **a new "see more"
   control** (§3.2) used by `GeneralStrip` (place it wherever Dev prefers — `CandidateBits` or inline
   in `GeneralStrip`, but its ARIA/label/behavior must match §3.2).
6. **`lib/candidates/`** — define **one** named constant `GENERAL_SUGGESTION_DEFAULT = 8` (AC6).
7. **Optional fade** (§6) — only if cheap; gated by `prefersReduced`. Skipping it satisfies AC10.
8. **Doc reconciliation (AC16):** update `docs/TOPIC_PAGE_DESIGN.md` from the two-state "empty vs
   curated" framing to the **three-state coexistence model** — the curated-before-suggestions priority
   placement, the General-pool default + "see more", the section→General reflow rule, and where the
   unvetted signal/counts live in the mixed state (the panel two-count line, the TOC dual counts, the
   reworded once-per-context headers). Do not leave the doc describing a binary flip.

**To QA & Review / UX-evaluation:** QA verifies AC1–AC16 (AC10 the primary bar — snapshot suggestion
order/identity across a curation and assert no pipeline re-run). UX will evaluate the built UI against
this spec: the three states render and read correctly, curated-before-suggestions holds in band and
rail, the divider/sub-headers carry the rescoped once-per-context signal in words, the "see more"
control is operable and accessible, and curating one suggestion visibly changes exactly one card
while the rest stay put (no churn).
