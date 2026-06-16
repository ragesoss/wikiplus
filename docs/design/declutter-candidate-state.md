# Declutter the empty-state candidate UI — design spec

- **Status:** Design pass (pre-build). Buildable contract for a later build-loop run against issue **#14**.
- **Owner:** UX / Design
- **Branch:** `design-14-declutter-candidate` (design-only; no app code changed)
- **Before baseline:** `mockups/inline-indigo-empty-v2.html`
- **After mockup (this pass):** `mockups/inline-indigo-empty-v3-declutter.html`
- **Inputs:** issue #14, `docs/TOPIC_PAGE_DESIGN.md` (§Empty/zero-curation state, §Plus visual
  identity), `docs/CURATION_STANDARD.md` (§6 Unvetted-candidate rule), `docs/specs/wiki-column-no-plus.md`
  (#21 — no inline-under-section candidate).
- **Touchpoints the build will implement against:** `components/topic/CandidateBits.tsx`
  (`SuggestedBadge`, `MatchReason`, `CandidateActions`), `components/topic/Infobox.tsx`
  (header label), the General strip tile + rail candidate list, and any `aria-label` strings
  for the curate CTA.

> Scope note: this changes **only the empty/zero-curation candidate presentation** and the
> curate-CTA verb. Curated clip cards, stance/accuracy chips, the context-note design, the
> "Curate this clip" modal flow, and the candidate-matching pipeline are **out of scope**
> (issue #14 "Out of scope"). The unvetted *distinction* is preserved; we remove *redundancy*,
> not the "not yet curated" signal.

---

## 1. The problem (why declutter)

In the empty state the same "this is unvetted / auto-suggested / from a video search / no human
context yet" signal is asserted **once per card** — on every General-strip tile, every rail
candidate card, and (in v2) the retired inline-under-section block — even though three things
already communicate it before the reader reads any card:

1. the **dashed border + desaturated/hatched thumbnail** (the candidate visual language),
2. the **section grouping** (candidates are collected, not interleaved with curated clips), and
3. the **shared search origin** (one auto-suggest run, named in the General band and the ＋plus panel).

The result is visual noise in exactly the state where the reader has not yet decided to engage.
The fix: the unvetted/auto-suggested **signal reads once per context**; per-card chrome carries
only what is genuinely **per-clip information** (why *this* clip matched, and its source).

---

## 2. Decisions

### D1 — Verb: "Promote" → "Curate"

The candidate CTA verb is **"Curate"** (owner-decided, confirmed). It opens the existing
**"Curate this clip"** modal, matching wiki+'s curation-not-promotion framing.

- Rationale (and consistency with `docs/CURATION_STANDARD.md`): the standard's §6 still uses the
  word "promotion" for the *act* ("a candidate becomes a curated clip only by promotion"), but
  that is internal-mechanism language. The **user-facing verb** on the button should name the
  destination the user lands in — the *Curate this clip* modal — and the product's framing is
  curation, not creator-world "promotion." "Curate" is the strongest fit; alternatives
  considered and rejected: *Add* (ambiguous with the separate "Add video" paste-a-link action),
  *Include / Consider / Review* (weaker, don't name the action's substance). **Default and
  final: "Curate."**
- The standard's prose may keep "promotion" as the internal term for the transition; the UI verb
  and the doc's user-facing references are "Curate." (A doc-text reconciliation in
  `CURATION_STANDARD.md` §6 / `TOPIC_PAGE_DESIGN.md` §Empty-state "Curation entry points" is a
  build-time edit, not part of this design pass.)

### D2 — Where the one-time signal lives

The "auto-suggested / unvetted / no context yet / source" message is stated **once per context**,
in places that already exist or naturally introduce a set — never per card:

| Context | Element (where the signal lives once) | Carries |
|---|---|---|
| Whole topic / overview | **＋plus panel** (empty mode) | "0 videos curated" + "N auto-suggestions from {sources}" + synced status |
| General strip (full-bleed band) | **General band header** | "＋ Suggested videos · **uncurated** — auto-found candidates, not yet vetted · N candidates" |
| Rail candidate list | **NEW "unvetted set" header** (one dashed-outline block atop the rail list) | "Suggested · uncurated. Auto-found from {sources}. No context notes yet — a human hasn't reviewed these. Curate one to vouch for it." |

The new rail set-header **replaces** v2's tiny "Suggested ↓ · uncurated" eyebrow **and absorbs**
the per-card "No context yet — a human hasn't reviewed this." sentence that v2 repeated on every
card.

### D3 — What stays per card vs. removed/consolidated

**Removed per card (was redundant):**

- The **"SUGGESTED" outline badge** (`SuggestedBadge`) on each tile / rail card / inline block —
  the dashed container + the set header already say "suggested."
- The repeated **"🔍 Auto-suggested" eyebrow** and the **"No context yet — a human hasn't
  reviewed this." sentence** (the bulk of `MatchReason`) — moved to the one-time set header.
- The purposeless **"this topic"** label in the ＋plus panel header (`Infobox.tsx`).

**Kept per card (the unvetted distinction survives — we removed redundancy, not the signal):**

- **Dashed (not solid) border, no solid offset shadow, desaturated + hatched thumbnail** — the
  candidate visual language stays exactly as in v2. Candidates remain unmistakable from curated
  clips. (Required by `CURATION_STANDARD.md` §6 / AC15.)
- A **compact, single-line match reason** ("why *this* clip matched", e.g. *Mentions
  "light-dependent reactions" in description*). This is per-clip **information**, not the repeated
  *signal* — it differs per card, so it earns its per-card place. Rendered small (11px, muted),
  with a small magnifier glyph (decorative) and an `sr-only` "Why suggested:" prefix for screen
  readers.
- A small **per-card source pill** (e.g. `YOUTUBE`) on the rail card header, replacing the
  position the "SUGGESTED" badge held. Text-labeled, outline style. **This is the
  multi-source-extensibility hook** (see §6) — today it just shows the clip's own `source`, but it
  exists per-card precisely so a mixed YouTube/TikTok result set reads correctly without a redesign.

> **No stance/accuracy chips and no context note on a candidate** — unchanged from v2 and required
> by `CURATION_STANDARD.md` §6. Those signals are earned by curation.

---

## 3. Microcopy (old → new)

| Where | v2 (before) | v3 (after) |
|---|---|---|
| Curate CTA button (per card) | `✓ Promote` | `✦ Curate` |
| Curate CTA `aria-label` | `Promote and curate: {caption}` | `Curate this clip: {caption}` |
| ＋plus panel header label | `＋plus` + `this topic` | `＋plus` (label removed) |
| Rail list intro | eyebrow `Suggested ↓ · uncurated` | set header: `Suggested · uncurated` + body `Auto-found from {sources}. No context notes yet — a human hasn't reviewed these. Curate one to vouch for it.` |
| Per-card "auto-suggested" eyebrow | `🔍 Auto-suggested` (every card) | removed (→ set header / band) |
| Per-card "no context" line | `No context yet — a human hasn't reviewed this.` (every card) | removed (→ set header) |
| Per-card match reason | `{source} · {matchReason}` inside a bordered block | compact single line: `{matchReason}` (source moves to the pill); `sr-only` prefix `Why suggested:` |
| Per-card source | (implicit in removed block) | source pill, e.g. `YOUTUBE` (`title="Auto-suggested from {source}"`) |
| General band header | `＋ Suggested videos` · `uncurated` · `— auto-found candidates, not yet vetted` · `N candidates` | **unchanged** (already once-per-context) |
| Dismiss button | `✕ Not relevant` | **unchanged** |

Unchanged elsewhere: the ＋plus panel "N auto-suggestions from {sources}", "Be the first to
curate" primary CTA, the TOC dashed `~N` suggestion badges, the per-section "Search TikTok for
…" link, and the Add-video / Search-TikTok / Search-YouTube manual-source cluster.

---

## 4. Affected states of the empty-state candidate UI

The decluttered treatment must hold across every state the candidate UI can be in:

- **Populated (default empty-state):** General band + rail list each introduced once by their
  header; cards show thumbnail, caption, creator credit (name · handle · platform), compact match
  line, source pill (rail), Curate + Not-relevant actions. Dashed/unvetted visual retained.
- **Loading / not-yet-synced:** the ＋plus panel and band still render their once-only "auto-found
  from {sources}" framing; while candidates stream in, the per-card chrome stays minimal so a
  half-loaded list is calm, not noisy. (No skeleton redesign here; the point is the headers carry
  the framing independent of card count.)
- **Hover / focus:** thumbnail play affordance scales on hover; **all** interactive elements
  (thumbnail button, Curate, Not-relevant, section link, source pill if made interactive later,
  set-header links) show the project focus ring (`3px` indigo outline, `2px` offset). No state
  relies on color alone.
- **Active (scroll-sync paired):** a rail candidate card highlights with the indigo dashed
  active border + faint offset (`candcard.active` / `.active-glow`) — unchanged from v2; the
  declutter does not touch the sync pairing.
- **Dismissing ("Not relevant"):** card fades/scales out (`candfade.dismissing`); the same clip
  removed everywhere it appears; counts decrement in the band, ＋plus panel, and TOC badges —
  unchanged behavior.
- **Empty after dismiss-all (edge):** when every candidate in a context is dismissed, that
  context's count reads 0 and its TOC badge hides. (The "fully empty, no candidates at all"
  state — e.g. a topic with zero search hits — is governed by the ＋plus panel's "Be the first to
  curate" CTA + manual-source buttons, which already stand alone without any candidate cards.)

---

## 5. Responsive behavior (web-first, responsive)

- **`lg`+ (two-column):** General band full-bleed across both columns; sticky right rail holds
  the ＋plus panel, the new set header, then the candidate list. As in v2.
- **`< lg` (single column):** columns stack; the band remains full-width; the rail (＋plus panel
  → set header → candidate list) flows below the article. The set header is **especially valuable
  on narrow screens** — it states the unvetted framing once at the top of the stacked list instead
  of forcing the reader past it on every card.
- **General strip:** horizontally scrollable tiles (`w-44`) at every width; cards never reflow
  their internal layout, so removing the badge simply reclaims vertical space at the top of each
  tile.
- **Touch targets:** Curate / Not-relevant keep a ≥44px min height (carried from v2's
  `min-h-[44px]` on the React buttons; the mockup uses the same padded button language).
- **Set header + match line** wrap gracefully; the source pill never wraps mid-word (it is a
  single short token).

---

## 6. Multi-source extensibility (do not hard-code single-source)

Today all auto-candidates come from one YouTube search (MVP limitation,
`TOPIC_PAGE_DESIGN.md` §Empty state), so the once-only framing can honestly say "auto-found from
YouTube." The design must not bake that assumption in such a way that a future mixed
YouTube/TikTok (or other) result set requires a redesign:

- **The set header / band / panel name `{sources}` from data**, not a hardcoded "YouTube" string.
  When the source set grows, the copy reads "auto-found from YouTube + TikTok" with no layout
  change.
- **The per-card source pill is the growth seam.** It already renders each card's own `source`,
  so a mixed list is immediately legible (this card from YouTube, that one from TikTok) *without*
  re-introducing the heavy per-card block we just removed. Keep it per-card even though, today,
  every card shows the same value — that redundancy-of-value is acceptable and intentional; it is
  the hook that makes mixed sources free later.
- **Decision rule for the build:** consolidate the *signal* (unvetted / no-context-yet) to one
  place; keep *source* as a lightweight per-card datum. Never collapse "source" into the
  once-only header in a way that assumes a single source.

---

## 7. Accessibility (baseline, must hold)

- **AA contrast** verified for every shipping text-on-background pair in the after mockup
  (set-header violet eyebrow 7.2:1, set-header body ink2 7.0:1, hint muted 4.9:1, source pill ink
  14.0:1, match line ink2 7.0:1, Curate white-on-indigo 4.7:1, genCount indigo-on-white 4.7:1 —
  all ≥ 4.5:1).
- **Text-labeled signals, never color alone:** "uncurated" / "Suggested · uncurated" are words;
  the dashed border is reinforced by the set-header text; the source pill shows the source *as a
  word*. No meaning is carried by color or border-style alone.
- **Screen-reader parity:** the compact match line carries an `sr-only` "Why suggested:" prefix so
  the reason is self-describing out of context; the Curate button's `aria-label` is the full
  "Curate this clip: {caption}"; `aria-haspopup="dialog"` is set on Curate (it opens the modal).
- **Keyboard + focus:** every interactive element is reachable and shows the `3px` indigo focus
  ring with `2px` offset (the project `:focus-visible` rule). The set header introduces the list
  but is not itself a focus trap; its links (compare-link in the mockup is mockup-only) follow
  normal tab order.
- **Motion:** dismiss/active transitions are short and gated by the existing
  `prefers-reduced-motion` posture (no new motion introduced).
- **Decorative glyphs** (magnifier in the match line, ✦/✕ on buttons) are `aria-hidden` /
  non-load-bearing; the adjacent text carries the meaning.

---

## 8. Component-level guidance for Development (the build)

Mapping the decisions onto the named touchpoints (the build-loop run owns the actual code):

- **`CandidateBits.tsx`**
  - `SuggestedBadge` — **remove from per-card render**. (Keep or delete the component itself at
    Dev's discretion; it should no longer appear on tiles/cards. The "suggested" signal now lives
    in the set header / band.)
  - `MatchReason` — **slim to a compact single line**: the magnifier glyph (decorative) + the
    `matchReason` text + an `sr-only` "Why suggested:" prefix. Drop the "Auto-suggested" eyebrow
    and the "No context yet…" sentence (those move to the new set header). Keep it visually quiet
    (11px, `text-ink2`/`text-muted`).
  - Add a small **`SourcePill`** (text-labeled, outline) rendered on the rail card header in the
    slot the badge vacated; value = `candidate.source`. Extensible per §6.
  - `CandidateActions` — rename the primary action **"Curate"** (label `✦ Curate`,
    `aria-label="Curate this clip: {caption}"`, keep `aria-haspopup="dialog"`). "Not relevant"
    unchanged.
- **New: a `CandidateSetHeader`** (one per rail candidate list) carrying the D2 rail copy. Takes
  `{sources}` from data. (The General band header already exists and is unchanged.)
- **`Infobox.tsx`** — remove the `this topic` `<span>` from the empty/curated header; header is
  just `＋plus`. Everything else in the panel is unchanged.
- **Definition of done (design):** a candidate no longer repeats the unvetted/source *signal* on
  every card; the message reads once per context; candidates remain unmistakably distinct from
  curated clips (dashed border etc. retained); the ＋plus header drops "this topic"; the CTA is
  "Curate" with a matching `aria-label`; AA contrast + keyboard/focus hold; source remains a
  per-card datum so mixed sources don't need a redesign.

---

## 9. Hand-off

- **To Development:** build the above against the named touchpoints; the after mockup
  `mockups/inline-indigo-empty-v3-declutter.html` is the visual reference and this spec is the
  contract. Reconcile the doc text in `TOPIC_PAGE_DESIGN.md` §Empty-state and
  `CURATION_STANDARD.md` §6 (Promote → Curate at the user-facing verb level) as part of that run —
  not in this design pass.
- **To QA & Review / UX-evaluation:** verify §8 "Definition of done"; UX will judge the built UI
  against this spec + the after mockup (visual fidelity, the once-per-context signal, the retained
  unvetted distinction, the verb, and accessibility-in-practice).
