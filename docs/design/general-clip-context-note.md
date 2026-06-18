# Design Spec: Surface the curator's context note (+ stance/accuracy) on curated General clips

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#63](https://github.com/ragesoss/wikiplus/issues/63)).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/general-clip-context-note.md` — the Product spec. This design serves **AC1–AC7**, the
    assumptions **A1–A3**, and the reader story below. It honors the owner steer: **two surfaces, and not
    either/or** — the compact General tile **and** the opened player both gain curation signals, within the
    parity goal (AC4).
  - `docs/CURATION_STANDARD.md` — the editorial contract whose microcopy is **already fixed**; UX **places**
    the signals, it does **not** author copy. Specifically:
    - **§1 / Decision C1** — the context note (1–3 sentences, ~40–320 chars). The full note text is the
      thing that was invisible on General clips; this spec makes it reachable.
    - **§2 / §3** — the **stance** + **accuracy** vocabularies that render as `StanceChip` / `AccuracyChip`,
      driven by the single enum→label map in `lib/curation/labels.ts` (UX writes **no** alternate label
      strings).
    - **§4** — the **text-label / never-color-alone** rule; chip text carries the meaning, color reinforces.
    - **§5.4 / Decision C7** — the public **"context by &lt;username&gt;"** attribution (links **in** to the
      curator profile; distinct from the §5.2 creator credit, which links **out** to the platform) and the
      `@prototype` non-linked **"seed clip · no curator"** label — both already realized in `ContextByLink`.
    - **§6** — the unvetted-**candidate** rule (no note, no chips). This spec adds signals to **curated**
      clips only; candidates must **not** regress.
    - **§7.1 / Decision C8** — the **held** "In review · not yet vouched" marking, which **coexists** with
      the note/chips/curator on a held clip.
  - `docs/TOPIC_PAGE_DESIGN.md` — the committed Topic-page UX + Indigo Press identity. Specifically:
    §"The General strip" (the curated tile in the full-bleed **indigo `#676EB4`** band), §"Fact-vs-opinion
    signal (chips)", §"The pinned candidate player" (the **candidate** preview surface — out of scope here;
    curated clips use the blocking `PlayerModal`). **This spec updates that doc's curated-tile and
    curated-player anatomy — see §11.**
  - `docs/design/vetted-review-hold.md` (D5b) — the **held marking** treatment (`HeldMarking` / `HeldPill`)
    this spec must keep coexisting with the now-surfaced note/chips, and its tone guard.
  - `docs/design/topic-page-v1.md` — the committed baseline: the curated clip card chips + curator-note
    block, **AA contrast §9.3** (the load-bearing chip fills), **focus-visible §11.2** (3px indigo outline,
    2px offset), text-labeled signals **§11.1**, **responsive §12**.
  - `docs/VISION.md` — the trust model ("a curator writes a context note that separates the creator's take
    from the established facts, flags how accurate it is… so a reader can weigh each clip").
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/GeneralStrip.tsx:257–332` — the curated General tile (VideoThumb → held pill →
    caption → creator handle/platform → `ContextByLink surface="indigo"` → upvote → owner/review rows).
    Today it has **no chips and no note text**. This spec adds the **chips row** (AC2) and a **compact note
    treatment** (decided in §4).
  - `components/topic/ClipCard.tsx:95–148` — the section-anchored rail card, the **parity target** and the
    treatment to **reuse**: `CreatorCredit` → `HeldMarking` → chips row (`StanceChip` + `AccuracyChip`) →
    "Curator note" block → provenance footer (`ContextByLink surface="light"`). Renders **unchanged**
    (AC7).
  - `components/topic/PlayerModal.tsx` + `components/topic/ModalShell.tsx` — the blocking, focus-trapping
    player. Today it renders **only** the video frame + a close control. This spec adds a **curation block**
    below the frame for any **curated** clip it opens (AC3). `ModalShell` (focus trap / Esc / backdrop /
    focus-return) is **unchanged**; the new content lives **inside** the trap.
  - `components/topic/Chips.tsx` — `StanceChip` / `AccuracyChip` (reuse verbatim).
  - `components/topic/ContextByLink.tsx` — the `surface="light" | "indigo"` "context by" attribution
    (reuse verbatim; the player uses `surface="light"` — see §5.4).
  - `app/topic/TopicView.tsx:162` — the `player` state is **already the full `Clip`**
    (`useState<Clip | null>`); `:1607–1608` is the mount. So delivering the player block is a **render**
    change, not a data change (A1): widen what `PlayerModal` reads from the clip it already holds.
- **Feeds:** Development (build to **this spec**, reusing the `ClipCard` chips/note treatments and the
  shared `ContextByLink`); then QA & Review (correctness/AC tests) + UX evaluation (this spec + the story,
  Phase 4).

> **This spec is the contract, written before implementation.** It specifies the **deltas** #63 adds:
> (1) the **stance + accuracy chips** plus a **compact, truncated note** on the curated General tile, and
> (2) a **full curation block** (full note text + both chips + "context by") in the opened `PlayerModal`
> for any curated clip. It does **not** redesign the note, the chips, the candidate/held/empty treatments,
> or the modal's focus model. The microcopy is **fixed by CURATION_STANDARD**; UX places it. Every
> requirement is tagged with the Product AC(s) it makes buildable.

---

## 1. Personas & user stories served

**Primary persona — the Reader weighing a General clip.** Lands on a Topic page, reads the lead, and meets
the **General strip first** — the whole-topic overview clips, before any section-anchored rail (TOPIC_PAGE
§"The General strip"). This is the curated content the reader meets **first**, yet today it shows the
curator's *name* but never the curator's *words*. The reader is exactly VISION's target: someone who needs
the fact-vs-opinion line drawn so they can decide how much to trust an engaging-but-opinionated clip.

Stories (these feed Product's AC1–AC7; reconcile, don't duplicate):

- **R1 — "As a reader, I want to see at a glance whether a General clip is an explainer or an opinion, and
  how accurate it is, so I can decide whether it's worth my time before I play it."** → the **chips on the
  tile** (AC2). *Resolved on the compact tile.*
- **R2 — "As a reader, I want to read the curator's note for a General clip — the actual words drawing the
  fact/opinion line — not just who curated it."** → the **full note in the opened player** (AC1, AC3), with
  a **compact preview on the tile** (§4). *Reachable via the player; previewed on the tile.*
- **R3 — "As a reader, I want a curated clip to carry the same trust signals wherever I meet it, so my
  ability to weigh it doesn't depend on whether the curator filed it as General or section-anchored."** →
  **parity** (AC4): the player shows the same block for both, the tile shows chips like the card does.
- **R4 — "As a reader, I want to know when a General clip's vouch is still in review, even while I read its
  note and chips."** → the **held marking coexists** with the now-surfaced note/chips (AC7; §6 held state).
- **R5 — "As a reader, I must never be misled into trusting an auto-suggestion as if a human vouched for
  it."** → candidates gain **nothing** new — no note, no chips (AC7; CURATION §6). *Explicit non-regression.*

These trace every design decision below: each signal placement maps to a story and an AC.

---

## 2. The UX decision (the issue's open "tile-inline vs reveal-on-open" question), recorded

**Decision — surface chips + a *truncated* note preview on the compact tile; reserve the *full* note for the
player.** Concretely:

| Signal | Compact General tile | Opened player (`PlayerModal`) |
|---|---|---|
| Stance chip (`StanceChip`) | **Yes** — full chip, with modifier | **Yes** |
| Accuracy chip (`AccuracyChip`) | **Yes** — full chip, with modifier | **Yes** |
| Context-note **text** | **Preview only** — clamped to **2 lines** (`line-clamp-2`), no separate "read more" affordance (the whole tile is already the click-to-open trigger) | **Full text** — untruncated "Curator note" block |
| "context by &lt;curator&gt;" | **Yes** (already present today — `ContextByLink surface="indigo"`) | **Yes** (new — `ContextByLink surface="light"`) |
| Creator credit (handle · platform) | **Yes** (already present) | **Yes** (new — name/handle · platform) |
| Held marking (when held) | **Yes** — `HeldPill` (already present) | **Yes** — `HeldMarking` (new in the player block) |
| Upvote / Edit / Delete / Review rows | **Unchanged** (already present; out of scope) | **No** (player is read-only; manage/vote live on the tile) |

**Rationale.**

1. **The chips are the cheap, high-value glance — they belong on the tile (AC2, R1).** They are tiny,
   fixed-size, text-labeled, and already AA-safe on any surface (they carry their own dark fills + 2px ink
   border, so the indigo band never touches the chip text — §7). They let a reader triage *before* the
   commitment of opening the player. This is the parity ask the spec names as the tile's hard floor.
2. **The full note belongs in the player, not crammed onto the tile (A2, R2).** The compact tile lives in a
   **horizontally-scrolling strip of fixed-width `w-44` (176px) tiles**. A full 320-char note (CURATION §1.3
   soft cap) would either blow the tile's height (breaking the uniform scroll row) or need an in-tile
   expander (a second interactive control fighting the thumbnail's own click-to-play). The player is the
   natural **"tell me more"** surface — the reader has already committed to this clip by opening it, has the
   room, and is exactly where they pair the note against the playing video. (Spec A2 / the issue's UX
   recommendation: *do not over-stuff the compact tile; the player is the natural full-note surface*.)
3. **A 2-line clamp on the tile is a *preview*, not the answer — and that's the right altitude.** It gives
   the reader the first sentence (the fact/opinion line usually leads — CURATION §1.1.1) as a hook, while
   the chips deliver the machine-readable summary, and the player delivers the whole note. It needs **no
   "read more" link**: the entire tile (its thumbnail) is already the affordance that opens the player, and
   adding a second "read more" control would (a) duplicate that affordance and (b) re-introduce the
   over-stuffing problem. The tile's accessible name for the play button already says "Play: &lt;caption&gt;";
   the note preview is supporting text, not a separate control.
4. **AC1 ("note text reachable") is satisfied by the player; the tile preview is additive.** Per spec A2 the
   hard floor is *opened player shows the full note* + *tile shows the chips*; the tile note **preview** is
   the additional surfacing UX is invited to add, kept deliberately lightweight so it informs without
   over-stuffing.

> **What the tile shows vs. what the player reserves, stated precisely:** the **tile** shows both chips
> (full), a **2-line-clamped note preview**, and (already) the creator credit + "context by" + upvote/manage
> rows. The **player** reserves the **full untruncated note text**, and *additionally* renders both chips +
> the creator credit + "context by", so a reader who opens any curated clip — General or section-anchored —
> gets the complete curation block in one place (AC3/AC4).

---

## 3. Anatomy — the curated General tile (with chips + note preview)

The tile is the existing `GeneralStrip.tsx:257–332` `<li>` (a `w-44 shrink-0` column). This spec inserts the
**chips row** and the **note preview** into the existing vertical stack; everything else keeps its current
order and treatment. Top-to-bottom order (★ = new/changed by #63):

```
┌─ <li> w-44 shrink-0 ──────────────────────────────┐
│  VideoThumb (variant="strip", h-24)               │  ← unchanged (click = open player)
│  HeldPill            (only when clip.held)         │  ← unchanged
│  Caption             line-clamp-2, bold, white     │  ← unchanged
│  Creator handle · platformLabel   white/70         │  ← unchanged
│ ★ Chips row: [StanceChip] [AccuracyChip]           │  ← NEW (AC2) — flex-wrap, gap-1.5
│ ★ Note preview: 2-line clamp, on a readable fill   │  ← NEW (AC1 preview) — see §3.1
│  context by <curator>   (ContextByLink indigo)     │  ← unchanged
│  UpvoteControl                                     │  ← unchanged
│  [Edit] [Delete]     (owner only)                  │  ← unchanged
│  ReviewRow           (reviewer/moderator only)     │  ← unchanged
└────────────────────────────────────────────────────┘
```

**Ordering rationale.** Chips and the note preview sit **between** the creator line and the "context by"
attribution — i.e. immediately after *what the clip is* (caption + creator) and before *who vouched for it*
(context by) + *the reader's action* (upvote). This mirrors the rail `ClipCard` reading order (creator →
held → chips → note → context-by) so the two placements read the same (R3). When the clip is **held**, the
`HeldPill` stays where it is today (above the caption) so the status reads first; the chips/note then follow,
intact (R4 / §6).

### 3.1 The tile note-preview treatment (the contrast-critical new element)

The note preview must be **AA-legible on the indigo `#676EB4` band**. Body-weight note text directly on
indigo would be the at-risk element (white on `#676EB4` is ≈4.0:1 — passes AA for ≥18px/bold but is marginal
for small body text; ink on indigo fails). **Resolve this the same way the tile's other small text-blocks do
(`HeldPill`, candidate match-line): put the note preview on its own readable fill, not on the bare band.**

- **Treatment:** a compact block with a **white fill** (`bg-white`) and a **2px ink border** matching the
  Indigo-Press hardbox language, holding `text-ink2` (`#595959`)/`text-ink` body text — i.e. the **same
  "Curator note" content on a white panel** the candidate match-line and `HeldPill` already use to clear AA
  on the indigo band. The note text is `text-[11px]`/`text-[12px]` `line-clamp-2`.
- **Optional eyebrow:** a small `text-[10px]` uppercase **"Curator note"** label (the rail card's eyebrow
  word) may lead the preview so the white block is unambiguously the note and not the caption. This is the
  rail card's exact eyebrow string — Dev reuses it; UX writes nothing new.
- **Do not** place note body text directly on `bg-brand` (the indigo band) at small sizes — that is the
  sub-AA case AC6 explicitly flags. The white-panel treatment removes the indigo from behind the text
  entirely.
- **Height discipline:** the 2-line clamp + the fixed `w-44` keep the tile within the uniform strip height;
  the white panel must not grow the tile so much that it breaks the horizontal scroll row's visual rhythm
  (keep the preview to ~2 lines, ~`leading-snug`).

> **Reuse note for Dev:** this is the rail `ClipCard`'s "Curator note" block (the eyebrow + the note `<p>`),
> **re-skinned for the indigo band**: on the rail it sits on `bg2` with a `border-l-4 border-brand` rule;
> on the tile it sits on a **white fill + 2px ink border** so the text clears AA over indigo, and the body
> is **`line-clamp-2`** (the rail shows it in full). Same content, same eyebrow word, surface-appropriate
> chrome — the `surface`-variant pattern `ContextByLink` / `HeldMarking` already establish.

---

## 4. Anatomy — the opened player curation block (`PlayerModal`)

Today `PlayerModal` renders a near-black `ModalShell` (`dark`, `max-w-3xl`) containing only: a close button
+ the video frame. This spec adds a **curation block beneath the frame** for any **curated** clip. The block
lives **inside** the existing `ModalShell` (so it is inside the focus trap and the Esc/backdrop/focus-return
behavior — §8) and **below** the frame (so the video stays the primary element and the block does not push
the frame off-screen on open).

```
┌─ ModalShell role=dialog aria-modal (focus-trapped) ─────────┐
│  ┌─ black frame container (border-2 border-ink) ─────────┐  │
│  │  [ ✕ close ]                              (unchanged)  │  │
│  │  <iframe> / "can't be embedded"           (unchanged)  │  │
│  └────────────────────────────────────────────────────────┘ │
│ ★ ┌─ curation block (NEW) — light surface ────────────────┐  │
│ ★ │  Creator credit:  name · handle · platformLabel       │  │  links OUT (CURATION §5.2)
│ ★ │  HeldMarking            (only when clip.held)          │  │  (CURATION §7.1)
│ ★ │  Chips row: [StanceChip] [AccuracyChip]                │  │  (AC3)
│ ★ │  Curator note (FULL, untruncated)                      │  │  (AC1/AC3)
│ ★ │  context by <curator>   (ContextByLink light)          │  │  links IN (CURATION §5.4)
│ ★ └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Reading order = the rail `ClipCard`'s order** (creator → held → chips → full note → context by). This is a
deliberate parity choice (R3, AC4): a reader who opens *any* curated clip — General **or** section-anchored —
sees the identical curation block in the identical order. The block is, in effect, **the rail card's
chips + note + footer, lifted into the player** (minus the upvote/manage rows, which are tile/card actions,
not player actions — the player is a read-only viewing surface).

### 4.1 Surface & visual treatment of the player block

- The frame container stays **black** (the video's surround — unchanged). The **curation block sits below it
  on a light surface** (white / `bg2`), inside the same dialog, so the note + chips read in the Indigo-Press
  light-card register (the same surface the rail card uses) — **not** white-on-black body text, and **not**
  on the near-black overlay. Concretely: give the block a `bg-white`/`bg-bg2` panel with the project's 2px
  ink border, directly under the black frame container, within the `max-w-3xl` dialog width.
- This means the player block uses **`ContextByLink surface="light"`** and the standard `StanceChip` /
  `AccuracyChip` (AA-safe on any surface — §7) and the rail card's "Curator note" block **verbatim** (the
  `border-l-4 border-brand bg-bg2` treatment, full text). Maximum reuse, minimum new chrome.
- The block scrolls with the dialog if the combined frame + block exceeds the viewport (the dialog already
  centers in a `p-4` flex container; allow the dialog content to scroll rather than clipping the note). On a
  vertical 9:16 clip the frame is already height-capped (`max-h-[80vh]`); ensure the note block remains
  reachable (scroll) rather than pushed off-screen — see §9 responsive.

### 4.2 Curated vs. non-curated in the player (what triggers the block)

- The block renders for a **curated `Clip`** — i.e. one that carries a `contextNote` (+ stance/accuracy +
  curatedBy). Per A1 the `player` state is already the full `Clip`, so the trigger is "this is a curated
  clip with a note," which is **always true** for a curated clip opened here (curated clips always have a
  note — CURATION §1; candidates never open this modal — they use the pinned player, §6/out-of-scope).
- **`PlayerClip` interface widens.** Today `PlayerModal` accepts a narrow `PlayerClip` (`embedUrl`,
  `caption`, `orientation`). To render the block, `PlayerModal` needs the curation fields it does not have
  today: `contextNote`, `stance`(+`stanceModifier`), `accuracyFlag`(+`accuracyModifier`), `curatedBy`,
  `creator`, `platformLabel`, `held`. Since the mount already passes the full `Clip` (A1), the cleanest
  contract is to **pass the full `Clip`** (or widen `PlayerClip` to include these fields). *Implementation
  choice is Dev's;* the design requirement is that the block renders from the clip's existing fields, with
  **no new data fetch** (A1).

---

## 5. Microcopy — where each fixed CURATION string goes

UX authors **no** new copy; every string below is the CURATION_STANDARD-fixed value, already centralized in
code. This table says **where** each goes on the two surfaces.

| Element | Verbatim source string / derivation | Tile | Player |
|---|---|---|---|
| Stance chip text | `STANCE_LABEL[stance]` (+ ` · {stanceModifier}`) via `chipText()` — CURATION §2 | ✓ | ✓ |
| Accuracy chip text | `ACCURACY_LABEL[accuracyFlag]` (+ ` · {accuracyModifier}`) via `chipText()` — CURATION §3 | ✓ | ✓ |
| "Curator note" eyebrow | the rail card's exact eyebrow word **"Curator note"** (`ClipCard.tsx:117–119`) | preview eyebrow (§3.1) | block eyebrow |
| Context-note **text** | `clip.contextNote` (the curator's words — CURATION §1) | **2-line clamp** | **full** |
| "context by &lt;username&gt;" | `ContextByLink` — `CONTEXT_BY_PREFIX` + linked `curatedBy`; accessible name `contextByAccessibleName(username)` — CURATION §5.4 | ✓ (indigo) | ✓ (light) |
| `@prototype` provenance | `ContextByLink` → non-linked **"seed clip · no curator"** (`SEED_CLIP_LABEL`) — CURATION §5.4 | ✓ | ✓ |
| Creator credit | `clip.creator.name` / `clip.creator.handle` · `clip.platformLabel`, links OUT to `creator.url` (the `CreatorCredit` pattern) — CURATION §5.2 / C10 | ✓ (existing) | ✓ (new) |
| Held marking | `HELD_EYEBROW` "In review · not yet vouched" (+ `HELD_EXPLAINER` where space allows, + `HELD_ACCESSIBLE_NAME`) — CURATION §7.1 | `HeldPill` (eyebrow only) | `HeldMarking` (eyebrow + explainer — the player has room) |

**No new strings.** If Dev finds itself writing a label that isn't in this table, that's a defect — route
back to UX/Curation.

---

## 6. Every state — both surfaces

Each state names what the **tile** shows and what the **player** shows. ★ = the new behavior #63 adds.

| State | Tile (`GeneralStrip`) | Player (`PlayerModal`) |
|---|---|---|
| **Populated** — curated clip, non-empty `contextNote`, both chips | ★ chips row + ★ 2-line note preview (white panel) + (existing) caption, creator, context-by, upvote, manage rows | ★ full curation block: creator → chips → **full note** → context-by, below the frame |
| **`@prototype` seed clip** (`curatedBy` absent / `@prototype`) | chips + note preview render normally; `ContextByLink` shows the **non-linked "seed clip · no curator"** label (existing behavior — §5.4) | ★ block renders normally; "context by" slot shows the **non-linked "seed clip · no curator"** label, never a fake profile link (AC5) |
| **Missing an optional modifier** (`stanceModifier`/`accuracyModifier` absent) | chip shows the base **Label** with **no " · modifier"** suffix (`chipText` already handles this) — no empty separator, no placeholder | same |
| **Held** (`clip.held === true`) | ★ chips + note preview render **intact**; the existing `HeldPill` ("In review · not yet vouched") stays **above the caption** so the status reads first (R4 / AC7) | ★ block renders **intact** *plus* `HeldMarking` (eyebrow + explainer) above the chips, per the rail card's order — the held status banners the whole vouch (AC7) |
| **Candidate** (a `Candidate`, not a `Clip`) | **No change — no note, no chips** (CURATION §6). Candidate tiles keep the dashed `candcard` + match-reason + source pill; #63 adds **nothing** to them (AC7, R5) | candidates **never open this modal** (they use the pinned player, out of scope) — so no curation block ever renders for a candidate |
| **Loading** (clip data / band loading) | the band's existing **suggestion-region skeleton** is unchanged; curated tiles render only once their `Clip` data exists (the curated group is never a skeleton — it's already-loaded data). No new loading state for chips/note: they ship with the clip | the player only mounts on an explicit click of an already-loaded curated clip, so there is **no loading state** for the curation block; the **video frame** keeps its existing states (iframe loads on open; the "can't be embedded" fallback below) |
| **Error / can't embed** | n/a (the tile is static markup over already-loaded clip fields — no fetch to fail) | the video frame keeps its existing **"This clip can't be embedded."** fallback (no `embedUrl`); ★ the **curation block still renders below it** — a non-embeddable clip still shows its note + chips + context-by (the contextualization does not depend on the embed) |
| **Empty note** (defensive — `contextNote` empty string) | the note preview block is **omitted** (render nothing rather than an empty white panel); chips still render | the "Curator note" block is **omitted**; chips + context-by still render. *(Per A1 a curated clip always has a note; this is a defensive render guard, not an expected state.)* |

**Explicit non-regressions (AC7):** the rail `ClipCard` chips/note render **unchanged**; **candidates** gain
**nothing** (no note, no chips) on the tile or anywhere; a **held** clip keeps its marking alongside the
now-surfaced note/chips. These are stated so QA can assert them.

---

## 7. Accessibility requirements (AC6 — concrete & buildable)

The project a11y baseline (CLAUDE.md; CURATION §4; TOPIC_PAGE_DESIGN AA) applies to every newly-surfaced
signal. Buildable requirements:

### 7.1 Text-labeled, never color alone (CURATION §4)
- Each chip's **label text** carries the meaning (`StanceChip`/`AccuracyChip` already render the §2/§3 Label
  text from the enum map). Two same-color accuracy values (e.g. `opinion` vs `misleading`, both the AA-safe
  red `#B0353B`) are distinguishable by their **words** — never shade alone. **Reuse the existing chips
  verbatim; do not introduce a color-only variant.**
- The note preview is **text** that stands on its own (CURATION §1.2 last bullet) — its meaning never depends
  on the chip color.

### 7.2 WCAG AA contrast — the load-bearing pairs (give Dev verifiable targets)
- **Chips (both surfaces):** the chip fills are centralized and **already AA-safe** in `lib/curation/labels.ts`
  — stance `#5248AF` (≈5.9:1 white text), accuracy `#1F6757`/`#1F6F95`/`#B0353B` (all ≥5:1 white text), each
  with a 2px ink border. Because the chip carries its **own** fill, the indigo band behind it does **not**
  touch the chip text — **the chips clear AA on the indigo tile and on the light player surface alike**
  (AC6's "chips on the indigo band must not drop below AA" is satisfied by the chip's own fill, not by the
  band). **Dev must not re-tint the chips for the indigo band** (no white/transparent chip variant that would
  put label text on indigo).
- **Tile note preview:** placed on a **white fill** (§3.1), so the contrast pair is **ink/ink2 on white**
  (`#595959` on `#FFFFFF` ≈ 7:1; `#2C2C2C` on white ≈ 12:1) — comfortably AA. **The forbidden pair is small
  note body text directly on the indigo band `#676EB4`** (ink on indigo fails; white body on indigo ≈4.0:1
  is marginal at small sizes) — §3.1 removes the indigo from behind the text by using the white panel.
- **Player note + block:** on the light panel (§4.1), same ink-on-white pair as the rail card — AA by reuse.
- **"context by" link:** `ContextByLink` already picks the AA-safe tone per `surface` — `indigo` (white +
  persistent underline on the band), `light` (`text-action` underline). The player uses **`surface="light"`**
  (the block is a light panel), so it inherits the AA-safe light tone. Do not place the link on the black
  frame.
- **Rule for the dev to verify:** every new text element must clear **4.5:1** (AA, normal text) or **3:1**
  (AA, ≥18px/bold) against the fill **immediately behind it** — and that fill must be the white/`bg2` panel,
  never the bare indigo band, for the note preview.

### 7.3 Keyboard & accessible name — the player block
- The new **"context by &lt;curator&gt;" link in the player** is keyboard-operable (it is a `next/link`
  `<a>`) and carries its accessible name `contextByAccessibleName(username)` ("context by &lt;username&gt;,
  view their curations") — **already** provided by `ContextByLink`. The creator credit link (OUT) keeps its
  existing accessible treatment.
- The chips are **non-interactive** `<span>`s with visible text — they need no role/tabstop; their text is
  their accessible name. Do **not** make them buttons.

### 7.4 Focus management — not regressed (the player)
- The new block lives **inside** `ModalShell`, so it is inside the existing **focus trap**; its focusables
  (the two links) join the Tab cycle automatically (the shell queries `a[href]`). **Do not** add a separate
  trap or change `ModalShell`.
- Initial focus, Esc-to-close, backdrop-close, and **focus-return to the trigger** on close are
  `ModalShell`'s behavior and must remain **unchanged** — the trigger is the tile/card thumbnail button, and
  focus must return there on close (this is the existing contract; #63 must not break it).
- The block adds links **after** the close button in DOM order, so the existing "close is the first
  focusable / initial focus" behavior is preserved (close stays first; the new links are reachable by Tab).
- Any motion is gated by the existing `prefers-reduced-motion` signal (no new animation is required by this
  spec).

### 7.5 Touch targets
- The tile note preview is non-interactive (the whole tile/thumbnail is the play affordance, already a ≥44px
  target). The chips are non-interactive. No new sub-44px interactive targets are introduced. The "context
  by" link in the player is a text link in a roomy block (rail-card precedent).

---

## 8. Interaction flow (no new flow — reuse the existing open/close)

1. Reader scrolls to the General strip → sees a curated tile with **chips + a 2-line note preview** (R1/R2)
   — enough to triage without opening.
2. Reader clicks the tile thumbnail → the existing `onPlay(clip)` sets `player` (the full `Clip`) →
   `PlayerModal` mounts (A3) with the video **and** the curation block (full note + chips + context-by).
   Reader pairs the note against the playing clip (R2/R3).
3. Reader closes (✕ / Esc / backdrop) → focus returns to the tile (§7.4). No change to the open/close flow.

The same flow holds opening a **section-anchored** clip from the rail card — same `PlayerModal`, same block
(AC4/A3). The contributor-profile player reuse (`ProfileView.tsx`) also gets the block for free; that is
acceptable, not required (A3).

---

## 9. Responsive behavior

**The General strip (tile).** The strip is a single horizontally-scrolling row of fixed `w-44` tiles
(`overflow-x-auto`) at **all** widths (TOPIC_PAGE §"The General strip"). #63 does not change the strip's
scroll model:
- **Narrow / mobile:** tiles stay `w-44` and scroll horizontally; the **chips wrap** within the tile
  (`flex-wrap gap-1.5`) so a long "Accurate, with a caveat · simplified" chip + a stance chip stack to two
  rows rather than overflowing the tile; the note preview stays a 2-line clamp. The tile grows vertically by
  the chips + preview but the strip remains a horizontal scroller (consistent tile width, variable height is
  fine as long as the row aligns to a common top).
- **Wide:** same, with more tiles visible per scroll. No layout change beyond the added rows.
- Keep the chips + preview from making the tile so tall it dominates the band; the 2-line clamp is the height
  governor.

**The player modal.** `ModalShell` centers the dialog in a `p-4` flex container at all widths; `PlayerModal`
is `max-w-3xl`:
- **Mobile:** the dialog is effectively full-width (minus the `p-4` gutter). The video frame (16:9 full-width
  or 9:16 height-capped) sits above the curation block; if frame + block exceed the viewport, the **dialog
  content scrolls** (the note must be reachable, never clipped — §4.1). Verify the full note is reachable on
  a short mobile viewport with a 9:16 clip (the height-capped frame + scrollable block).
- **Wide:** frame + block both within `max-w-3xl`, block below the frame, no scroll needed for a typical note.
- The block reuses light-surface type at readable sizes (the rail-card note sizes) at every width — no
  separate mobile type scale is required.

---

## 10. Reuse map (so Dev never re-implements a standard-compliant treatment)

| Need | Reuse | Notes |
|---|---|---|
| Stance / accuracy chips | `Chips.tsx` `StanceChip` / `AccuracyChip` | verbatim, both surfaces; AA-safe fills already centralized |
| Chip label text | `lib/curation/labels.ts` (`STANCE_LABEL`/`ACCURACY_LABEL` + `chipText`) | no new strings; modifier handled |
| Curator-note block (full) | `ClipCard.tsx:116–123` "Curator note" block | verbatim in the **player**; **re-skinned to a white panel + 2-line clamp** on the **tile** (§3.1) |
| "context by" attribution | `ContextByLink.tsx` | player → `surface="light"`; tile already uses `surface="indigo"` |
| Held marking | `HeldMarking.tsx` `HeldMarking` (player) / `HeldPill` (tile, existing) | tone guard intact (§7.1) |
| Creator credit (player) | `ClipCard.tsx`'s `CreatorCredit` pattern | links OUT; degrades to name-only / non-linked per C10 |
| Modal shell / focus | `ModalShell.tsx` | unchanged — new content inside the existing trap |

---

## 11. Required `docs/TOPIC_PAGE_DESIGN.md` updates (anatomy changed → doc must follow)

The issue requires `TOPIC_PAGE_DESIGN.md` be updated if the curated-tile / curated-player anatomy changes.
It does. **Development should apply these edits as part of building #63** (this spec is the source of truth
for them):

1. **§"The General strip"** — the curated-tile anatomy now includes the **stance + accuracy chips** and a
   **2-line context-note preview** (on a white panel for AA over the indigo band), in addition to the
   existing caption / creator / "context by" / upvote. Note that the **full** note lives in the opened
   player, not the tile (the tile shows a clamped preview).
2. **New/updated player anatomy** — the committed doc describes the **candidate** pinned player (§"The pinned
   candidate player") but never specified the **curated** clip's blocking `PlayerModal` content. Add (or
   note under the General strip / clip-placement section) that the **curated `PlayerModal` now renders a
   curation block below the video frame** — full context-note text + stance chip + accuracy chip + "context
   by &lt;curator&gt;" (and the held marking when held) — for any curated clip, General or section-anchored,
   delivering the parity goal.
3. Keep the change scoped to **anatomy**: do not restate the CURATION microcopy or the chip color system in
   TOPIC_PAGE_DESIGN (those live in CURATION_STANDARD / `labels.ts`); reference them.

*(Either Development applies these doc edits during the build, or UX applies them on evaluation; the issue's
deliverable is that the doc reflects the shipped anatomy. This spec records exactly what must change so it is
not lost.)*

---

## 12. Out of scope (per the Product spec)

- **Voting, Edit/Delete, Hold/Approve/Remove** — unchanged; those rows stay as they are on the tile/card and
  are absent from the read-only player.
- **The candidate pinned player** (`PinnedPlayer`, #10) — candidates do not gain a curation block (they have
  no note/chips — CURATION §6); curated clips use the blocking `PlayerModal` only.
- **Editing the note / changing the note standard** — D2 (`clip-edit-delete.md`) / Curation own those; this
  spec only **surfaces** the existing note + existing chips.
- **New microcopy** — all strings are CURATION-fixed; UX places, does not author.

---

## 13. Definition of done (what Development should build to)

1. **Curated General tile** (`GeneralStrip.tsx`) renders, for a curated clip: the **stance + accuracy chips**
   (AC2) and a **2-line context-note preview** on a white panel (AC1 preview / §3.1), inserted between the
   creator line and the "context by" attribution, without disturbing the existing caption / creator / held
   pill / context-by / upvote / manage rows.
2. **Opened `PlayerModal`** renders, below the video frame, a **curation block** for any curated clip: the
   **full context-note text + stance chip + accuracy chip + "context by &lt;curator&gt;" attribution** (+ the
   held marking when held + the creator credit) on a light surface, inside the existing focus trap (AC1/AC3).
3. **Parity** (AC4): the player block is identical for General and section-anchored clips; the rail
   `ClipCard` is unchanged (AC7).
4. **States** (§6): `@prototype` seed shows the non-linked "seed clip · no curator" (AC5); missing modifier
   = base label only; held coexists with note/chips (AC7); candidate shows **nothing** new (AC7); the
   "can't be embedded" player still shows the curation block; empty-note defensively omits the note block.
5. **A11y** (§7, AC6): chips AA on both surfaces by their own fills (no re-tint); the tile note preview on a
   white panel (never small body text on indigo); the player "context by" link keyboard-operable with its
   accessible name; `ModalShell` focus model unchanged.
6. **Doc** (§11): `docs/TOPIC_PAGE_DESIGN.md` updated to the new curated-tile + curated-player anatomy.

Then QA & Review verifies AC1–AC7 (tests) and UX evaluates the built UI against this spec + the R-stories.
