# Design spec — ＋plus overview panel redesign (issue #16)

The buildable contract for redesigning the **wiki+ panel** (the ＋plus rail's top
component, `components/topic/Infobox.tsx`). Written before implementation; Dev builds to this,
QA verifies against it, UX evaluates the built UI against it.

**Scope.** Only the ＋plus overview/infobox component, in all three derived states (empty /
mixed / fully-curated) plus loading/error. Out of scope: candidate card redesign (#14), the
General strip, the curation flow itself beyond the entry points this panel exposes, and any
backend/data-model change — the redesign works entirely within the existing `TopicStats` and
`liveCandidates` props already threaded to the component.

---

## 1. The problem (why this redesign)

Today's panel is framed around curation mechanics and internal plumbing, which serves the wrong
goal for most arrivals:

- **"suggestions synced just now"** reads as irrelevant internal status to a reader — it
  describes our pipeline, not their value.
- **"✦ Be the first to curate"** names a task without explaining or pitching it.
- The empty state offers **nothing to a reader who isn't there to curate** — no orientation to
  what the plus side is *for*.

The panel is the first thing a user sees on the plus side. It must **lead with what wiki+ adds
to this Wikipedia topic** — short topical video for self-directed learning, weighed for fact vs.
opinion — be **useful even on an uncurated topic and to a reader with zero interest in
curating**, and pitch curation **honestly as a secondary** "help the next learner" invitation
that does not crowd out reading/browsing utility.

---

## 2. Personas served

| # | Persona | What they want from this panel | Will they curate? |
|---|---------|--------------------------------|-------------------|
| P1 | **Self-directed learner** (lands from search/a wikilink, here to understand the topic) | Orientation: *what is this plus column, and is there anything here worth my time?* | No |
| P2 | **Clip browser** (skims short video, sampling) | A fast way into the videos; a sense of how many and how vetted | Rarely |
| P3 | **Prospective curator** (sympathetic, never curated) | An honest, legible pitch of the curation task once they've gotten value | Maybe, after reading/watching |
| P4 | **Returning curator** (the flywheel) | A low-friction, always-present way to add/curate; a sense of the topic's state | Yes |

The redesign's north star is **P1 first**: the learner who will never curate must still get
value and orientation. P3/P4 are served by a secondary, honest invitation that never becomes the
headline. This ordering is the VISION amendment's "reader/learner utility first, curation as the
secondary flywheel" made concrete in one component.

---

## 3. Candidate elements × persona relevance

Every element the panel *could* carry, scored for relevance per persona, with the disposition we
chose. (H = high, M = medium, L = low / noise.)

| Element | P1 learner | P2 browser | P3 prospect | P4 returning | Disposition |
|---|---|---|---|---|---|
| **Value statement** ("short videos to learn this topic, weighed for fact vs. opinion") | **H** | M | M | L | **KEEP — the lead, both states.** This is the missing orientation. |
| **Browse / jump affordance** (scroll to videos) | **H** | **H** | M | M | **KEEP — primary action.** The concrete useful thing for a non-curator. |
| Curated counts (videos / creators / curators) | M | M | M | M | **KEEP in curated/mixed** as a compact trust/volume signal; not in empty (there are none). |
| Suggestion volume ("N videos found / suggested") | M | **H** | M | M | **KEEP, reframed** as learner-facing volume ("N videos to weigh in / suggested"), not pipeline status. |
| Source provenance ("from YouTube/TikTok") | L | L | L | L | **DROP from the panel.** The unvetted/source signal already lives once-per-context in the General band + rail set header (#14). Repeating it here is clutter; "unvetted" is carried in the panel by the word *suggested/unreviewed*, in text. |
| **"synced just now"** | L | L | L | L | **REMOVE.** Internal plumbing; no persona benefits. (See §9 open question on a non-decorative freshness signal.) |
| Curate CTA | L | L | **H** | **H** | **KEEP, demoted + honestly framed.** Secondary, below the value + browse; explains the task. |
| Contributor recognition (who curated) | L | L | L | M | **DEFER.** Out of scope here; lives on clip cards + contributor profiles (#54). |
| "What is wiki+" deep explainer | L | L | L | L | **DROP.** One value sentence is enough at this altitude; a full explainer belongs on a landing/about surface, not the per-topic rail. |

**The reframing rules that fall out of this table:**

1. The panel **opens with value, not counts or status.**
2. **Counts/volume are reframed in learner terms** and demoted below the value line.
3. **Curation is always present but always secondary**, with task-explaining microcopy.
4. **"synced"** and **per-panel source provenance** are removed from the reader surface.

---

## 4. Directions explored (mockups)

Three alternatives committed under `mockups/`, each covering empty + curated:

- **A — Value-first masthead** (`mockups/plus-overview-A-value-first.html`): one structure across
  all states; value line → state-appropriate counts/volume block → browse/jump → a bordered
  secondary curation invite. Stable vertical rhythm; the counts block is the only part that
  reshapes between states.
- **B — Editorial pitch card** (`mockups/plus-overview-B-pitch-card.html`): two distinct
  treatments. Empty is a bold "zine cover" (indigo header carries a large display headline) that
  sells the plus side hard; curated is a calmer counts panel. Most on-brand/striking, but the
  empty state is tall and the two states diverge structurally.
- **C — Utility-first compact** (`mockups/plus-overview-C-tabs-utility.html`): smallest
  footprint — value line, an inline count *chip* (no numeral grid), a primary Browse action, and
  the curation invite collapsed to one quiet inline link. Keeps the sticky rail short; least
  expressive, and the curated counts lose their "big numeral" Indigo-Press flourish.

### Trade-offs

| | A value-first | B pitch card | C compact |
|---|---|---|---|
| Leads with value | ✓ | ✓ (loudest) | ✓ (quietest) |
| Useful to non-curator | ✓ browse + volume | ✓ browse + volume | ✓ browse + chip |
| Curation honestly secondary | ✓ clearly demoted | ✓ demoted | ✓ demoted (smallest) |
| One structure across states | ✓ | ✗ (two treatments) | ✓ |
| Sticky-rail height | medium | tall (empty) | short |
| Indigo-Press "big numeral" identity | ✓ retained | ✓ retained | partial (chips) |
| Build complexity | low | medium | low |

---

## 5. Decision — **Direction A (Value-first masthead)**

**One structure across empty / mixed / fully-curated**, reshaping only the counts/volume block.

**Rationale.** A directly serves the issue's three goals in priority order (value → non-curator
utility → secondary honest curation) while keeping the curated and empty states a **single
coherent component** — easier to build, easier to keep accessible, and it answers the issue's
second open question (converge, don't fork). It keeps the Indigo-Press big-numeral identity for
the curated counts, stays shorter in the sticky rail than B's empty "zine cover," and is more
expressive than C. B's boldness is attractive but its structural divergence and empty-state
height are costs without a matching user benefit at this altitude; we fold B's best idea (the
one-line "how it works" framing) into A's value line. C's compactness is a fallback if the rail
proves too tall in evaluation, but it sacrifices the numeral identity and the clear separation of
"browse" from "curate."

**Resolved open questions (issue):**

- **(a) Does the empty-state value prop need consumable content for a non-curator, or is that
  #14's territory?** *Decision:* The panel itself does **not** embed consumable clips — that
  would duplicate the General band and the candidate rail, which #14 owns. The panel's job is
  **orientation + a path to that content**: the value sentence (what's here and how to weigh it),
  the reframed volume ("N videos to weigh in"), and a **Browse suggested videos ↓** action that
  scrolls to the General band. The consumable content stays where it lives; the panel makes it
  legible and reachable. This keeps the #16/#14 boundary clean.
- **(b) Should curated and empty converge on one structure or stay two treatments?** *Decision:*
  **Converge** (Direction A). One component, one reading order, with the counts/volume block as
  the single state-variant region. Lower build/a11y surface and a consistent mental model.

---

## 6. The chosen component — anatomy & all states

Reading order, top to bottom (constant across states):

1. **Header block** — indigo `#676EB4` color-block, `＋plus` display wordmark + `on this topic`
   uppercase label, 2px ink bottom border. (Unchanged identity; label reworded from none/"this
   topic" to `on this topic` for a full readable phrase.)
2. **Value statement** — the lead line, **identical in every state**:
   > **Short videos to learn this topic, each weighed for what's fact vs. opinion.**
   `plus-sans`, ~15px, bold, ink. This is the orientation P1 was missing.
3. **Counts / volume block** — the single state-variant region (see per-state below).
4. **Primary action** — a full-width bordered button that scrolls the page to the relevant
   content (Browse/Jump). Always present except loading/error.
5. **Secondary curation invite** — separated by a 2px ink top border: one line of
   task-explaining microcopy + a demoted curation button.

### 6.1 Empty (0 curated, ≥1 suggestion)

- **Counts/volume block:** a **dashed-border, light (`bg2`) panel** (visually "provisional," matching
  the unvetted candidate language) containing the suggestion count as a big indigo numeral with:
  - line 1 (bold): `videos found to weigh in`
  - line 2 (`ink2`, small): `none vouched for yet — these are unreviewed suggestions`
  - The word **"unreviewed/suggested" carries the unvetted meaning in TEXT** (never color/border
    alone).
- **Primary action:** `Browse suggested videos ↓` (bordered white button) → scrolls to the
  General band. This is the non-curator's useful path.
- **Secondary invite:**
  > Watched one worth keeping? **Vouch for it** and write a note so the next learner knows how to
  > weigh it.
  - Button: **`＋ Curate a video`** (teal `#2A8270` fill, hardbox). Teal (sprout) distinguishes
    the contribute action from indigo navigation and reads as the secondary/"grow" action.
  - This **replaces** "✦ Be the first to curate": it now explains the task (watch → vouch →
    note) and frames the *why* (help the next learner).

### 6.2 Mixed (≥1 curated AND ≥1 remaining suggestion)

- **Counts/volume block:** the **three-numeral grid** (Videos / Creators / Curators) in a solid
  2px ink-bordered box, **plus** a centered two-count line beneath it:
  > `{V} curated · {M} suggested to weigh in`
  - This is the issue-#60 rescoped once-per-context volume signal (the word *suggested* carries
    the unvetted meaning in text). "to weigh in" reframes it toward the learner.
- **Primary action:** `Jump to videos ↓`.
- **Secondary invite:** the "broaden coverage" framing (see 6.3 copy) + **`＋ Add a video`**
  (white bordered button — calmer than empty's filled teal, since the topic already has content).

### 6.3 Fully-curated (≥1 curated, 0 remaining suggestions)

- **Counts/volume block:** the three-numeral grid only. **No** suggestion count, no unvetted
  line — matching the #60 rule that the unvetted signal is absent everywhere in fully-curated.
- **Primary action:** `Jump to videos ↓`.
- **Secondary invite:**
  > Know a clip that belongs here? **Add & curate one** to broaden how this topic is shown.
  - Button: **`＋ Add a video`** (white bordered).

### 6.4 Loading

- The panel is gated behind `storeReady` in `TopicView` (see the `{storeReady && …}` wrapper), so
  the curated/empty body never renders mid-load. **No change required**: the existing behavior
  (the aside simply not yet present) stands. If Dev later renders a skeleton, it must reserve the
  header + value-line height to avoid layout shift, and announce nothing (decorative).

### 6.5 Error (store-read failure)

- `TopicView` already carries a `storeError` floor. The panel should **still render the header +
  value statement** (they need no data) and, in place of the counts block, a calm one-line:
  > `Couldn't load this topic's video stats. The article is unaffected.`
  in `ink2`, with **no** numerals and **no** curation button (a write surface is meaningless when
  reads are failing). This honest line replaces a permanent skeleton. *(New microcopy; Dev wires
  the existing `storeError` signal into the panel — no new data field.)*

---

## 7. Microcopy (the exact strings)

| Slot | String |
|---|---|
| Header label | `on this topic` |
| Value statement (all states) | `Short videos to learn this topic, each weighed for what's fact vs. opinion.` |
| Empty volume line 1 | `videos found to weigh in` |
| Empty volume line 2 | `none vouched for yet — these are unreviewed suggestions` |
| Empty primary action | `Browse suggested videos ↓` |
| Empty invite copy | `Watched one worth keeping? Vouch for it and write a note so the next learner knows how to weigh it.` |
| Empty curate button | `＋ Curate a video` |
| Mixed two-count line | `{V} curated · {M} suggested to weigh in` |
| Mixed/curated primary action | `Jump to videos ↓` |
| Mixed/curated invite copy | `Know a clip that belongs here? Add & curate one to broaden how this topic is shown.` |
| Mixed/curated add button | `＋ Add a video` |
| Error line | `Couldn't load this topic's video stats. The article is unaffected.` |
| Count grid labels | `Videos` · `Creators` · `Curators` |

**Removed strings:** `suggestions synced {label}`, `synced {n} · {v} shown`, `✦ Be the first to
curate`, `N auto-suggestion(s) from {sources}`. The `syncedLabel` and `sources` props become
**unused by this component** (see §10).

---

## 8. Responsive behavior

- **`lg`+:** the panel is the sticky right rail (~360px). All structure as specified.
- **`< lg`:** the rail collapses into the stacked single column below the article lead; the panel
  keeps the same internal structure (it is already narrow). The numeral grid stays 3-up (it fits
  at 360px and narrower). The primary "Browse/Jump ↓" action still scrolls to the General band /
  first video; on a stacked layout that is a downward in-page scroll, which is correct.
- Buttons are full-width within the panel at all widths. Text wraps; no truncation of the value
  line or invite copy (they must remain fully readable — they are the point).

---

## 9. Accessibility (baseline, written into the contract)

- **Contrast (AA):** white text on indigo `#676EB4` (header) is the established lockup; **small
  body text is never placed on the bare indigo band** — value line, volume, and invite copy sit
  on white/`bg2` (`#F7F7F7`/`#F0F1F3`) with ink (`#2C2C2C`)/`ink2` (`#595959`) text, all
  AA-compliant. Indigo numerals on white are large display type (AA large). The teal `#2A8270`
  curate button uses **white text** (AA). Dev must verify each pairing at build.
- **Never color/border alone:** the unvetted state is signaled in **text** (`suggested`,
  `unreviewed`, `to weigh in`) — the dashed border and `bg2` fill are reinforcement only. (Same
  rule the rest of the page follows.)
- **Buttons vs. scroll actions:** the curate/add controls are real `<button>`s with
  `aria-haspopup="dialog"` (they open the Curate/Add modal). The Browse/Jump action scrolls
  in-page; implement as a `<button>` (it performs a scripted scroll, not navigation) with a clear
  accessible name, e.g. `aria-label="Browse suggested videos"` / `"Jump to videos"`. The existing
  `curateFirst`/scroll handler already encapsulates this.
- **Gold is not used** in this component (no functional gold; identity stays indigo/ink/teal).
- **Focus:** every interactive element shows the project's 3px indigo focus ring
  (`:focus-visible`), already global.
- **Keyboard:** all actions are buttons in normal DOM order → tabbable, Enter/Space activate. No
  custom key handling needed.
- **Heading semantics:** the panel is inside the existing `<aside aria-label="…">`. The value
  statement is a `<p>`, not a heading (it is a tagline, and the rail already has its labelled-aside
  landmark); do not introduce a competing `<h>` that would disrupt the page outline.

---

## 10. Implementation notes for Dev (within scope — no data change)

- **Props.** The component already receives `hasCurated`, `stats: TopicStats`, `suggestionCount`,
  `sources`, `syncedLabel`, `onCurateFirst`. After this redesign:
  - `sources` and `syncedLabel` are **no longer rendered** by the panel. Remove them from the
    component's props and drop the now-dead `sources`/`syncedLabel="just now"` wiring at the call
    site in `app/topic/TopicView.tsx` (the `sources` value is computed only for this panel; verify
    no other consumer before deleting its derivation). Removing dead props is in scope; do **not**
    add new props/data fields.
  - The three states derive exactly as today: `isEmpty = !hasCurated`, `isMixed = hasCurated &&
    suggestionCount > 0`, fully-curated = `hasCurated && suggestionCount === 0`.
  - For the **error** line (§6.5), thread the existing `storeError` boolean from `TopicView` into
    the panel as a prop (it is already in `TopicView` state; this is wiring an existing signal, not
    a new data field). When `storeError` is true, render header + value + the error line, no counts,
    no buttons. *(If the team prefers to keep the error handling entirely in `TopicView` and not
    render the panel at all on `storeError`, that is acceptable — but then `TopicView` must show
    the equivalent honest line in the rail; do not leave a permanent skeleton.)*
- **Primary action handler.** Reuse the existing scroll-to-General-band behavior. `onCurateFirst`
  is currently overloaded (it scrolls when there's nothing to curate, else opens curate). Split
  the concerns: the **Browse/Jump** button always scrolls to the General band / first video; the
  **Curate/Add** button always opens the curate/add entry (gated by login as today). Keep the
  existing `requireLogin` gating on the curate/add path.
- **No interleaving with #14.** This component shows counts + entry points only; it renders no
  candidate cards. The General band and rail keep their #14/#60 treatments untouched.

---

## 11. What Dev should build (summary)

Rebuild `components/topic/Infobox.tsx` to Direction A: header → constant value statement →
state-variant counts/volume block (empty dashed volume / mixed grid+two-count / fully-curated
grid) → primary Browse-or-Jump scroll button → secondary, honestly-framed curation invite (teal
`＋ Curate a video` in empty, white `＋ Add a video` otherwise). Add the §6.5 error line off the
existing `storeError` signal. Remove the `synced` line, the `sources`/`syncedLabel` rendering, and
"Be the first to curate". Wire the call site in `TopicView` accordingly. No new data fields.

## 12. What UX evaluation (next round) + QA should check

- **UX (against this spec):** the value statement leads in every state; a non-curator has a clear,
  working Browse/Jump path; curation is visibly secondary with task-explaining copy; "synced" and
  per-panel source provenance are gone; all three states + error render with stable rhythm; the
  panel is not too tall in the sticky rail at `lg` (if it is, fall back toward Direction C's
  compactness). Render the standard screenshot matrix for the Topic page (empty / mixed /
  fully-curated, logged-out + logged-in, the standard widths).
- **QA:** AA contrast on every text/background pairing (esp. teal button, indigo numerals, ink2
  body); visible focus + keyboard activation on all three buttons; unvetted signal present in text
  (not color alone); `storeError` path renders the honest line, not a skeleton; no new data field
  introduced; `yarn build` passes; the `sources`/`syncedLabel` removal leaves no dead references.

---

## Open questions for the owner (revisit on the PR)

- **Freshness signal.** "synced" is removed as plumbing. If a *reader-meaningful* freshness cue is
  ever wanted (e.g. "updated weekly"), it would be a deliberate, plain-language line — not the raw
  sync status. Out of scope here; flagging in case the owner wants one later.
- **Value-line wording.** The single value sentence is load-bearing; the owner may want to tune it
  (e.g. emphasize "creator" video, or "self-directed learning" explicitly). Easy to change — it's
  one string in §7.
- **Compactness fallback.** If the sticky rail feels tall in evaluation, Direction C is the
  pre-approved fallback shape (chip counts, collapsed invite). Calling it out so the choice is
  legible on the PR.
- **Teal for the curate button.** Using sprout/teal for the contribute action (vs. indigo) is a
  deliberate signal-separation choice; confirm it reads right against the rest of the plus side.
