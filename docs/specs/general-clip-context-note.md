# Spec — Surface the curator's context note (+ stance/accuracy) on curated General clips

- **Status:** Ready for UX + Development (build spec)
- **Owner:** Product
- **Issue:** #63 (`type: build`, `status: ready`)
- **Inputs:** `docs/VISION.md`, `docs/CURATION_STANDARD.md` (§1 context note, §2 stance, §3 accuracy,
  §4 non-color rule, §5.4 "context by &lt;curator&gt;"), `docs/TOPIC_PAGE_DESIGN.md` (§"The General
  strip", §"Fact-vs-opinion signal (chips)", §"The pinned candidate player"), `docs/ARCHITECTURE.md`
  (Prototype phase).
- **Grounding code (read, not changed by Product):** `components/topic/GeneralStrip.tsx:257-332`
  (curated General tile), `components/topic/ClipCard.tsx:104-148` (the parity target — chips row +
  "Curator note" block + "context by"), `components/topic/PlayerModal.tsx` (renders no note),
  `components/topic/ModalShell.tsx`, `components/topic/Chips.tsx` (`StanceChip` / `AccuracyChip`),
  `app/topic/TopicView.tsx:162,1607-1608` (the player state + mount site).
- **Feeds:** UX (where each signal surfaces on the compact tile vs. the opened player; microcopy is
  already fixed by CURATION_STANDARD, so UX places, it does not author), Development (what to render
  and where), QA & Review (acceptance criteria below).

---

## Problem

A reader cannot read the curator's **context note** — wiki+'s core, original contribution — for a
curated **General** clip (the whole-topic overviews shown in the General strip). Today:

- The General tile (`GeneralStrip.tsx:257-332`) shows the caption, the creator handle + platform, a
  `context by <curator>` *attribution* line, and the upvote control — but **no context-note text** and
  **no stance/accuracy chips**.
- Clicking a curated General clip opens the blocking `PlayerModal`, which renders **only the video
  frame** (`PlayerModal.tsx`) — no note, no chips, no curator attribution.

So for a General clip the note is effectively **invisible**, and the fact-vs-opinion chips are absent
entirely. The section-anchored rail `ClipCard` (`ClipCard.tsx:104-148`) already renders all of this —
the chips row plus the "Curator note" block — so the two clip placements are at **parity-failure**: the
same curated object surfaces its trust signals in one place and hides them in the other. This was
surfaced by the first live curation (a test user) on `/topic/Japanese_kitchen_knife/`, where the
General clip's note could not be read on the tile or in the player.

## User value

The context note is the thing that makes a wiki+ clip more trustworthy than the same video in a feed:
it draws the **fact-vs-opinion line**, flags reliability honestly, and says why the clip is worth the
reader's time (CURATION §1; VISION "what good looks like" — the reader leaves understanding *how to
weigh each clip*). Hiding it on General clips defeats the product's core value for exactly the clips a
reader meets first (the whole-topic overviews appear immediately after the lead, before any
section-anchored rail — TOPIC_PAGE_DESIGN §"The General strip"). The fix delivers:

- **Reachable contextualization** — a reader can actually read the note and see the stance/accuracy
  chips for a curated General clip, not just the curator's name.
- **Trust-model parity** — a curated clip carries the same curation signals (note + stance + accuracy
  + "context by") wherever it appears, so trust does not depend on where the clip happens to sit.

## Scope

Two surfaces carry the curation info for a curated General clip; this is **and**, not **either/or**
(owner steer resolving the issue's open question):

1. **The General strip tile** (the compact tile). It must surface **more than today** — at minimum the
   **stance + accuracy chips** (the parity ask). Whether the note text also shows inline on the
   compact tile, and the exact compact treatment, is a **UX-design decision** (next role).
2. **The opened player view** (after clicking the clip — the blocking `PlayerModal`). It must show the
   **full context note text**, the **stance + accuracy chips**, and the **"context by &lt;curator&gt;"**
   attribution, for **any curated clip it opens** — General or section-anchored.

**Parity goal:** the curated trust signals — context-note text, stance chip, accuracy chip, and the
"context by &lt;curator&gt;" attribution — are **reachable for both General and section-anchored
clips**. Reachable = on the tile/card directly and/or via the click-to-open player; at minimum the
opened player shows the full note, and the General tile shows the chips.

The signals and their microcopy are already fixed by `CURATION_STANDARD.md` (§1 note, §2 stance label
map, §3 accuracy label map, §4 text-label/non-color rule, §5.4 "context by &lt;curator&gt;" / the
`@prototype` "seed clip · no curator" stub) and rendered today by `ClipCard`'s "Curator note" block and
the existing `StanceChip` / `AccuracyChip`. This spec asks to **reuse those existing, standard-compliant
treatments on the General tile and in the player** — it does **not** define new note/chip/attribution
content or a new standard.

## Acceptance criteria

Each item is testable; QA maps a test to each ID.

- **AC1 — Note text reachable for a curated General clip.** For a curated General clip with a non-empty
  `contextNote`, a reader can read the note **text** (the words of the note, not merely the "context by"
  attribution). At minimum this is satisfied by the opened player view (AC3); UX may additionally surface
  it on the tile. (Resolves issue "Done when": *a reader can read a general curated clip's context-note
  text, not just the attribution*.)
- **AC2 — Stance + accuracy chips render on the curated General tile.** A curated General clip's strip
  tile renders both a `StanceChip` (from `clip.stance` + optional `stanceModifier`) and an `AccuracyChip`
  (from `clip.accuracyFlag` + optional `accuracyModifier`), using the same chip components and the same
  CURATION §2/§3 label map the rail `ClipCard` uses. (Resolves "Done when": *stance + accuracy chips
  render for general curated clips*.)
- **AC3 — The opened player view shows the note for any curated clip.** When a **curated** clip is opened
  in the player view (the blocking `PlayerModal`, reached from both the General tile and the
  section-anchored rail card), the view renders, in addition to the video: the full **context-note text**,
  the **stance chip**, the **accuracy chip**, and the **"context by &lt;curator&gt;"** attribution. This
  holds for both a General clip and a section-anchored clip. (Resolves "Done when": *the player/expanded
  view for a curated clip shows the context note*.)
- **AC4 — Parity between General and section-anchored clips.** For the same curated clip data
  (`contextNote`, `stance`/`stanceModifier`, `accuracyFlag`/`accuracyModifier`, `curatedBy`), the full set
  of curated trust signals — note text, stance chip, accuracy chip, and "context by" attribution — is
  **reachable** whether the clip is shown as a General tile or a section-anchored rail card (on the
  card/tile directly and/or via its opened player). Neither placement hides a signal the other shows.
- **AC5 — Standard-compliant attribution distinctions preserved.** Wherever the curator attribution is
  newly surfaced (the player view), it renders per CURATION §5.4 / Decision C7: the **"context by
  &lt;username&gt;"** line links **in** to the curator's profile and stays **textually and visually
  distinct** from the creator credit (which links **out** to the platform); a clip attributed to the
  `@prototype` stub shows the non-linked **"seed clip · no curator"** label, not a fake profile link.
  (The General tile already renders `ContextByLink` — this AC guards that any new surfacing keeps the
  rule; it does not reopen the standard.)
- **AC6 — Accessibility preserved (AA, focus, text-labeled, never color alone).** All newly surfaced
  signals meet the project a11y baseline (CLAUDE.md; CURATION §4; TOPIC_PAGE_DESIGN AA requirement):
  - Each chip's **label text** carries the meaning; color is reinforcing only — two same-color accuracy
    values (e.g. `opinion` vs `misleading`) are distinguishable by their words, never by shade alone.
  - Chip text and the note text meet **WCAG AA** contrast against their fill, including the General
    tile's **indigo** background and the player view's surface (the General tile's chips/note must not
    be placed at sub-AA contrast on the indigo band).
  - Newly surfaced interactive elements (e.g. the "context by" link in the player) are
    **keyboard-operable** and have an **accessible name**; focus management for the player view is not
    regressed.
- **AC7 — No regression to existing curated/candidate/held behavior.** The section-anchored `ClipCard`
  note/chips render unchanged; **candidates** (suggested cards) still show **no note and no chips**
  (CURATION §6) on both the tile and any preview — this change adds signals to **curated** clips only;
  and a **held** clip keeps its existing "In review · not yet vouched" marking (CURATION §7.1) alongside
  the now-surfaced note/chips.

## Out of scope

- **Voting changes.** The upvote control is unchanged; any voting behavior is a separate issue.
- **Candidate / suggested cards.** Candidates carry **no context note and no chips** (CURATION §6); this
  spec does not add a note to anything that has none. Only **curated** General clips gain the surfaced
  signals.
- **Editing the note** (that is D2 / `clip-edit-delete.md`) and **changing the note standard** (CURATION
  / Editorial owns the standard; this spec only *surfaces* the existing note + existing chips).
- **The candidate pinned-player** path (`PinnedPlayer`, issue #10). Curated clips use the blocking
  `PlayerModal`; this spec touches the curated-clip player view only and does not change how candidates
  preview.

## Success metric

**Definition (Analytics deferred — metric defined here per Product's standing remit):**

- **Primary — context-note reachability for General clips = 100%.** For every curated General clip with a
  non-empty `contextNote`, the note text is reachable by a reader (tile or opened player) and both chips
  render. This is the binary "the core value is no longer invisible for General clips" measure; it is
  fully verifiable at build time via the acceptance criteria (it does not require traffic), and it is the
  bar the issue's "Done when" sets. Target: **100%** (zero curated General clips whose note is
  unreadable).
- **Supporting — parity holds across placements.** Zero curated trust signals (note text, stance,
  accuracy, "context by") that are shown for a section-anchored clip but unreachable for the equivalent
  General clip. Target: **zero parity gaps** (AC4).
- **Later, when Analytics + traffic exist (not built now, recorded for continuity):** among readers who
  open a curated General clip's player, the share who are exposed to its context note — expected to rise
  from ~0 (today the player shows nothing) toward the section-anchored clip's exposure rate — is the
  eventual behavioral signal that "readers can now weigh General clips." Not measured in this build.

## Assumptions (from ambiguity)

- **A1 — The note/chip/attribution content already exists and is standard-compliant; this is a rendering
  gap, not a data gap.** A curated General `Clip` already carries `contextNote`, `stance`(+`stanceModifier`),
  `accuracyFlag`(+`accuracyModifier`), and `curatedBy`; the `player` state at the mount site is already the
  full `Clip` (`TopicView.tsx:162,1607-1608`). So the work is to *render* existing fields in two places, not
  to fetch or author anything. (Surfaced by grounding; Development confirms.)
- **A2 — "Reachable" is satisfied per-signal by tile-and/or-player.** The acceptance bar is that each
  curated signal is reachable for a General clip, not that every signal appears in both places. The hard
  floors are: the **opened player shows the full note** (AC3) and the **tile shows the chips** (AC2). The
  remaining placement choices (note inline on the compact tile? chips also in the player? — yes per AC3)
  are UX's, within the parity goal. UX should not regress the compact tile into an over-stuffed card; the
  player is the natural "tell me more" surface for the full note (issue outline's UX recommendation).
- **A3 — The player view is the shared "expanded" surface.** Because the same `PlayerModal` opens curated
  clips from both the General tile and the rail card (and is reused on the contributor profile,
  `ProfileView.tsx:245`), giving the player the curated-signal block is what delivers parity in one place.
  Whether the contributor-profile player also shows the block is acceptable (it is still a curated clip);
  it is not required by this spec's ACs and not a regression if it does.

## Required follow-up doc updates (for later roles, not Product to make now)

- If UX changes the General-tile or player anatomy (e.g. adds the chips/note block to the tile or the
  player), **`docs/TOPIC_PAGE_DESIGN.md`** §"The General strip" and §"The pinned candidate player" should
  be updated to reflect the new curated-tile / curated-player anatomy (issue "deliverables": *update
  TOPIC_PAGE_DESIGN.md if the card/player anatomy changes*). This is Development's/UX's doc update at
  build time, recorded here so it is not lost.

---

*Hand-off:* **UX** decides where each signal surfaces on the compact General tile vs. the opened player
(within the parity goal and the fixed CURATION microcopy), and produces the design spec / flow.
**Development** renders `clip.contextNote` + `StanceChip`/`AccuracyChip` + the "context by" attribution
in the player view (widening what `PlayerModal` receives/renders) and the chips on the General tile,
reusing the existing standard-compliant `ClipCard` treatments, and adds tests per the acceptance
criteria.
