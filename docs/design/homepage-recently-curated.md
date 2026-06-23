# Design spec: Homepage — the "recently-curated topics" section

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written before
implementation) · **Issue:** [#125](https://github.com/ragesoss/wikiplus/issues/125) — the homepage
redesign, **last part** (the bottom topics section) · **Phase:** prototype

**Builds on the contract:**
- [`docs/specs/landing-page.md`](../specs/landing-page.md) — the v1 acceptance criteria the redesign must
  not regress (search primary; projector at Tier A; topic-list states — **AC7**).
- [`docs/design/landing-page.md`](landing-page.md) §2 (hero composition), §6 (the demoted topic list + its
  four data states), §7 (responsive). This spec **supersedes §6's "Explore example topics" framing** for the
  bottom section only; everything else in `landing-page.md` stands.
- [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) — the Indigo-Press hardbox language (`.plus-card`,
  `.hardbox-sm`, `.hardbox-lg` in `app/globals.css`), the gold-as-accent discipline.

**Inherits (not re-specified here):** the **simplified search segment** and the **"Wiki, plus video." intro
hero** directly above this section — both already shipped (PRs #129/#130, live in `app/page.tsx`). This spec
only designs the section *beneath* them and how it **visually harmonizes** with that hero. It does **not**
redesign the search, the hero, or the projector header.

**Hands off to:** Development (restyle the section container/heading/grid framing in `app/page.tsx`; one
cheap DB-side ordering change in `lib/db/drizzle-store.ts`). After build, UX evaluates the running section
against this spec + the stories below.

---

> **What this spec is.** The buildable contract for reframing the homepage's bottom topic list from
> "Explore example topics" into **"Recently curated"** — a confident, on-identity close to the page rather
> than a bare list under a quiet rule. It specifies the persona/story served, the section composition
> top-to-bottom, **exact microcopy for the heading + supporting line + all four data states**, the
> recency-ordering decision, the Indigo-Press visual treatment (referencing the committed hardbox
> primitives), responsive behavior, and accessibility. It carries **one hard boundary**: the topic **card
> markup is unchanged** — only the section *container / heading / grid framing* is restyled (§7).

---

## 1. Persona & story served

The whole homepage has one job — **be the front door, "find a topic."** Search leads; the intro hero
orients; this section is the **third and last beat**: *somewhere to go when you don't have a topic in
mind.* It serves one persona primarily.

### 1.1 Rosa — the first-time visitor who scrolls past search (primary)

Rosa arrives not knowing what wiki+ is. If she knows what she wants, she searches (top). If she doesn't,
she scrolls: the **"Wiki, plus video." intro hero** tells her *what this is*, and **this section** answers
*"okay — show me."* It is the page's proof that the product is **live and active**, not an empty promise.

- **RC1.** *As a first-time visitor who scrolled past the search, I want to see real topics people have
  already curated, so the product feels alive and I have somewhere concrete to start.* → §3 populated
  state, §4 recency ordering.
- **RC2.** *As a first-time visitor, I want this section to read as a deliberate, finished part of the page
  — not a leftover list — so wiki+ looks like confident product, not a prototype scaffold.* → §5 visual
  treatment (Indigo-Press framing that rhymes with the hero above).
- **RC3.** *As a first-time visitor, I want to understand that what I'm seeing is shared prototype data
  (everyone sees the same topics), so I'm not confused about why it's the same for everyone.* → §3 the
  prototype-disclaimer microcopy.

### 1.2 Dev — the returning reader (secondary)

Knows wiki+; usually searches. This section is his **browse-when-idle** affordance — explicitly demoted so
it never competes with the search for "the thing to do" (`landing-page.md` D2 / AC7). Reframing it as
*recently curated* makes idle browsing rewarding: the freshest curations surface first.

- **D2 (inherited).** *As a returning reader, I want a few topics to explore when I don't have one in mind,
  but never as the headline.* → this section stays below the hero, secondary in weight (§5).

**Story → AC trace** (feeds Product's criteria; reconcile, don't duplicate): RC1 → "recently-curated section
shows real topics, recency-ordered"; RC2 → "section reads as on-identity finished product"; RC3 → "shared-data
disclaimer present"; D2 → AC7 (list stays demoted, all four states preserved, no regression).

---

## 2. Where this sits in the page (composition context — top to bottom)

The homepage, after PRs #129/#130, reads top to bottom:

```
  [ Daylight Projector header ]      ← unchanged (out of scope)
  [ simplified search segment  ]      ← the FIRST, primary action — unchanged (out of scope)
  [ "Wiki, plus video." hero   ]      ← eyebrow · headline · subheading · two offset-shadow CTAs (out of scope)
  ─────────────────────────────
  [ RECENTLY-CURATED section   ]      ← THIS SPEC
```

This section is the **last band**. Its job is to land the page on a confident, active note while staying
**subordinate** to the search and the hero. It must **read as a continuation of the same Indigo-Press
voice** the hero just established directly above it (§5) — not a stylistically different "list region."

---

## 3. Section composition, top to bottom (THIS section)

A single full-width band, aligned to the existing wider container (`mx-auto max-w-5xl px-4`), separated
from the hero above by a quiet full-width rule. Top to bottom:

1. **Section heading (eyebrow + title pairing).** To rhyme with the hero (which opens with an indigo-rule
   eyebrow over a big headline), this section opens with the **same eyebrow device** at a smaller scale,
   then the section title. See §5.1 for the exact treatment.
   - **Eyebrow (kicker):** `FRESH FROM THE COMMUNITY`
   - **Title (`<h2>`):** `Recently curated`
2. **Supporting line** — one sentence, directly under the title, that frames the section *and* carries the
   prototype "shared data" disclaimer (RC3). See §3.1 for exact copy.
3. **The topic card grid** — the **existing card markup, unchanged** (§7 boundary). Recency-ordered
   server-side (§4). Reflows 2-col → 1-col (§6).
4. **The four data states** render in place of the grid as appropriate (§3.2).

### 3.1 Heading + supporting microcopy (exact strings)

| Element | Exact copy | Notes |
|---|---|---|
| **Eyebrow** | `FRESH FROM THE COMMUNITY` | Uppercase, tracked, indigo accent rule before it (§5.1). Signals these are real human curations, not editorial picks — supports RC1. Rendered visually uppercase via CSS; author the string in normal case is acceptable, but the displayed text is all-caps. |
| **Title** (`<h2>`) | `Recently curated` | Sentence case. Replaces the old "Explore example topics." States *what* (curated topics) + *recency* in two words — the framing RC1/D2 want. |
| **Supporting line** | `The topics most recently curated on wiki+. (Prototype: curations are shared, so everyone sees the same topics and clips.)` | One line. First clause = the recency framing (RC1); the parenthetical = the prototype shared-data disclaimer (RC3), carried here because "shared" is most relevant where the shared content is shown. Styling §5.2. |

**Copy ownership note (for Product / Curation-Editorial):** the eyebrow `FRESH FROM THE COMMUNITY`, the
title `Recently curated`, and the supporting line's first clause are **proposed** — Product owns final
sign-off and Curation/Editorial owns voice (per issue #125 "Copy ownership"). The **shared-data disclaimer
parenthetical is functionally required** (it tells the user why the data is identical for everyone) and
should survive any copy revision in some form. If Product prefers to keep the eyebrow free of the word
"community" (e.g. to avoid implying a logged-in social graph that doesn't exist yet), an acceptable
alternative is `LATELY ON WIKI+`; UX is neutral between them and defers the pick.

### 3.2 Every data state (exact microcopy — AC7, preserve & do not regress)

The data path is **unchanged** (`store.listTopics()` in the client `useEffect`, with the existing
`topics: Topic[] | null` + `loadError` state machine in `app/page.tsx`). The four states are inherited from
the current build and **must not regress** — only their *framing and visual treatment* change. Each renders
in the grid's place:

| State | Condition (existing) | Exact microcopy | Treatment |
|---|---|---|---|
| **Loading** | `topics === null` (and not `loadError`) | `Loading recently curated topics…` | Muted helper text, `text-sm text-ink/50`. (The old copy was a bare `Loading…`; this is more descriptive but still a one-liner — Dev may keep `Loading…` if a string change is undesirable, but the descriptive form is preferred for clarity. Either passes AC7 — the *state* is what must not regress.) |
| **Read-error floor** | `loadError` (a server read can fail — DB down) | `Couldn't load topics — please refresh.` | Muted helper text, `text-sm text-ink/50`. **Verbatim — must be preserved (AC7 verify line).** An honest line, never a hang on "Loading…". No retry button (out of scope; refresh is the affordance). |
| **Empty** | `topics.length === 0` | `No topics curated yet — be the first by searching for one above.` | Muted helper text, `text-sm text-ink/50`. Reframed from the bare `No topics yet.` to point back at the search (the front-door action) — turns the empty state into an invitation (RC1). The pointer is **text only** (no auto-focus, no scroll-jack — keyboard order is sacred, §8). Dev may keep `No topics yet.` if a string change is undesirable; the invitation form is preferred. |
| **Populated** | `topics.length > 0` | The card grid (existing markup), recency-ordered (§4). | §5 framing around the unchanged grid. |

All four states render **inside the same section** (under the heading + supporting line), so the section's
heading and identity are always present — the user always knows *what* region they're looking at even when
it's loading, empty, or errored.

---

## 4. Recency-ordering decision

**Decision: order DB-side by `updated_at` descending (most recently created-or-touched topic first).**

- **What "recently curated" means here:** the topics whose `topic` row was **most recently created or
  updated**. In the current data model a topic row's `updated_at` advances when the topic is created and
  when its metadata is upserted; it is the cheapest available proxy for "recently active." This is an
  honest, defensible reading of "recently curated" for the prototype.
- **Why this and not "latest clip":** a true "newest curation activity" ordering would join `clip` and sort
  by `max(clip.created_at)` per topic — heavier (a join + group-by, or a correlated subquery), and the
  issue explicitly flags it as more than the cheap path. `updated_at desc` requires **no join** and is a
  one-line change to the existing query. It is the right cost/value trade for the prototype.
- **The change (cheap, DB-side):** in `lib/db/drizzle-store.ts`, `listTopics()` currently does
  `.orderBy(topic.title)` (alphabetical). Change it to order by `updatedAt` descending (e.g.
  `.orderBy(desc(topic.updatedAt))`). That is the entire data change. **No new column, no migration, no
  `Topic` type change** — recency is expressed only as *ordering*; the client never receives or displays a
  timestamp (the cards are unchanged, §7, and show no "curated N ago" — that would be card-internal and is
  the deferred follow-up). The localStorage `local-store.ts` is the legacy/test seam; if it is still
  exercised, mirror the intent there (sort the returned array by any available recency signal, else leave
  as-is) — but the production path is the Drizzle store and that is the one that matters.
- **Tie-breaker:** when `updated_at` is equal (e.g. seed data inserted in one batch with identical
  timestamps), append a stable secondary sort by `title` ascending so ordering is deterministic across
  renders (avoids the grid reshuffling between loads). `.orderBy(desc(topic.updatedAt), topic.title)`.
- **Fallback the issue permits:** if for any reason `updated_at` ordering proves unworkable at build time
  (it should not — it's a one-liner), fall back to the **existing alphabetical order** and ship the heading
  reframe alone. The issue explicitly permits this. **Do not** build clip-join recency plumbing for this
  round.

**Assumption for Product to refine:** seeded topics may all carry near-identical `updated_at` values (a
single seed batch), in which case the visible ordering is effectively the `title` tie-breaker until real
curation activity differentiates them. That is acceptable for the prototype — the ordering becomes
meaningful as soon as topics are created/updated at different times — but Product should know the seed data
won't visibly demonstrate recency until it varies. (No action required this round; flagged so the
post-build screenshot of seed data isn't mistaken for a broken sort.)

---

## 5. Visual treatment — Indigo-Press framing that harmonizes with the hero (RC2)

The defect to fix: today this section is a bare list under a thin `border-t border-ink/10` rule with a quiet
`text-lg font-medium` heading — it reads as a leftover, stylistically disconnected from the confident
hardbox hero directly above. The fix is **not** new visual language; it is **reusing the committed
Indigo-Press devices the hero already uses**, at a quieter, subordinate scale (this section is secondary —
it must echo the hero without rivaling it). **Do not fork the zine block or invent new framing.**

### 5.1 The heading — echo the hero's eyebrow device

The hero opens with an **indigo accent rule + uppercase tracked eyebrow** over a large headline (see the
shipped hero in `app/page.tsx`: `<span aria-hidden class="mr-3 h-[2px] w-8 bg-brand" />` + uppercase
tracked text). **Reuse that exact device** to open this section, so the two bands rhyme:

- **Eyebrow row:** a short **indigo (`bg-brand`) 2px accent rule** (`h-[2px] w-8`, `aria-hidden`, `mr-3`)
  followed by the eyebrow text in `text-xs font-bold uppercase tracking-[0.18em] text-ink2` — **identical
  classes to the hero's eyebrow**, so they are visibly the same device. (Gold is reserved for the wordmark;
  the eyebrow rule is **indigo**, per VISUAL_IDENTITY §9.1 — never gold here.)
- **Title (`<h2>`):** `Recently curated` in `text-2xl font-bold text-ink` (the projector serif is **not**
  used here — that's the wordmark + the hero headline's storytelling voice; this is a section title, so it
  uses the standard bold sans, deliberately a step **down** from the hero's display headline so it reads as
  secondary). Sits a small margin under the eyebrow (`mt-3`/`mt-4`).

This makes the section's top edge feel authored by the same hand as the hero, resolving RC2, while the
smaller title keeps it subordinate (D2 / AC7 — never the headline).

**On the two stacked "Wiki/plus" treatments (issue #125 design tension):** that tension is between the
**projector wordmark** (header) and the **hero headline** — both above this section and out of scope. This
section deliberately introduces **no third** "Wiki/plus" or "plus"-block treatment: its heading is plain
text. That is intentional — adding another plus-block here would multiply the tension the issue flags. The
section borrows only the **eyebrow rule device**, not the plus block.

### 5.2 Supporting line

`text-sm text-ink2` for the first clause; the prototype parenthetical in a muted `text-ink/50` (it may be a
trailing muted `<span>` within the same `<p>`, or a second muted line). `max-w-[60ch]` so it doesn't run the
full grid width. Sits `mt-2` under the title.

### 5.3 The separation from the hero above

Replace the thin hairline with a treatment that reads as a **deliberate band boundary**, consistent with the
page's hardbox-on-grey rhythm. Two acceptable options (Dev's call; (a) preferred for being the lightest
touch that still reads as intentional):

- **(a) Generous whitespace + a full-width indigo-tinted hairline.** Keep a single full-width rule but make
  it intentional: `border-t border-ink/15` (very slightly stronger than today's `/10`) with **generous
  vertical breathing room** above and below (`pt-12`/`pt-14`, `mt-4` to the hero), and let the §5.1 eyebrow
  device carry the "new section" signal. The rule is a quiet divider; the eyebrow + title do the work.
- **(b) Section on a subtle surface shift.** If the hero sits on body grey and the section wants more
  separation, the section may sit on `--content-white` (or vice-versa) so the band boundary is a gentle
  surface change rather than a line. Only do this if it reads cleanly with the hero's existing background;
  do not introduce a heavy colored band that competes with the hero.

**Do not** wrap the whole section in a large `.hardbox-lg` card — that would make the section rival the
hero for weight (it must stay secondary). The hardbox language belongs to the **cards** (already present in
the card markup, §7) and the hero's CTAs/plus-block, not to a giant section frame.

### 5.4 The cards themselves — unchanged (see §7)

The card grid keeps its existing markup and styling. The Indigo-Press harmonization in this round is the
**section heading/eyebrow/spacing framing around** the grid, **not** the cards. Restyling the cards (their
border/shadow toward `.plus-card`, title treatment, per-card stats) is the explicitly deferred follow-up
issue (§7).

---

## 6. Responsive behavior (web-first, responsive)

The section inherits the existing container width and grid; the framing additions must be clean at all three
breakpoints.

| Breakpoint | Section framing | Grid |
|---|---|---|
| **Desktop / tablet (`≥ sm`, ~≥640px)** | Eyebrow rule + eyebrow text inline; title `text-2xl`; supporting line on one line up to `60ch`. Generous `pt-12`/`pt-14`. | **2 columns** (`sm:grid-cols-2`) — unchanged. |
| **Mobile (`< sm`)** | Same eyebrow device; title may drop to `text-xl` if `text-2xl` crowds the narrow column; supporting line wraps naturally within `60ch`/full width. Slightly reduced top padding (`pt-10`). | **1 column** (grid reflows to single column) — unchanged. |

- The section never pushes the search below the fold on load — it is the **last** band, far below the search;
  the search's primacy (it sits at the top, first viewport) is unaffected by anything here (issue "Done when":
  *the search is never pushed below the fold by the hero* — this section is below both and cannot affect that).
- The four data-state lines (loading/empty/error) are single short strings that wrap fine at mobile; no
  special responsive handling needed beyond the muted text styling.

---

## 7. Hard boundary — card markup is UNCHANGED (so Dev does not over-reach)

**This is the explicit scope fence (issue #125 Out of scope).** Redesigning the topic **cards** — their
title treatment, the Wikipedia-article identity, per-card curation stats, the card border/shadow — is a
**separate, deferred follow-up issue.** Do **not** touch the card's internal structure.

**What Dev MAY restyle (the section container/heading/grid *framing*):**

- The section's **heading**: replace the old `<h2>Explore example topics</h2>` + its muted disclaimer line
  with the §5.1 eyebrow device + `Recently curated` title + §5.2 supporting line.
- The section's **separation** from the hero (§5.3) — the divider/spacing/background treatment of the
  `<section>` wrapper.
- The section's **padding / vertical rhythm** (the `pt-*`/`pb-*` on the `<section>`).
- The **grid container** wrapper attributes only insofar as needed for the framing — but the grid's
  **column behavior stays** `grid gap-3 sm:grid-cols-2` (2-col → 1-col).

**What Dev MUST leave untouched (the card itself):**

- The `<li>` / `<Link href={topicHref(t.title)}>` card markup and its classes — the existing
  `block rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-brand/40`, the
  title `<span>`, the description `<span>`, and the QID `<span>`. **Keep this exactly as-is.**
- The card's internal layout, the QID display, the description truncation — all deferred.

If, while building, the *unchanged* cards look stylistically out of step with the new framing, that is
**expected** and is the deferred follow-up's job to resolve — **do not** "fix" it by restyling the cards in
this round. Note it for the follow-up; do not act on it. This boundary is non-negotiable.

---

## 8. Accessibility (baseline, AA)

- **Keyboard order — the search must remain reachable first (sacred).** This section is the **last** thing
  in the document order, after the search and the hero. Its links (the topic cards) come **after** the
  search input and the hero CTAs in tab order — **do not reorder, and do not introduce any autofocus or
  scroll-jack** that would steal focus toward this section on load (the empty-state pointer to search in §3.2
  is **text only**, never a programmatic focus move). The existing tab flow (search → hero CTAs → topic
  cards → footer) is preserved.
- **Heading semantics.** The section title is an `<h2>` (the page already uses a visually-hidden `<h1>wiki+</h1>`
  and `<h2>`s for the hero/sections — this `<h2>` slots into that outline as a peer section heading, keeping a
  logical heading hierarchy for screen readers).
- **The eyebrow rule is decorative** — `aria-hidden="true"` on the `<span>` accent rule (it carries no
  meaning; the eyebrow text is the label), exactly as the hero's eyebrow rule is. **The eyebrow text itself
  is real text** and is read normally.
- **Contrast (AA).** Title `text-ink` (`#2C2C2C`) on white/grey — far exceeds AA. Eyebrow `text-ink2`
  (`#595959`) at `text-xs` bold uppercase — `#595959` on `#fff` ≈ 7:1, passes AA. The muted state lines and
  the disclaimer use `text-ink/50` — these are **non-essential supplementary** text; ensure the **essential**
  state messages (the read-error line especially) are legible: keep the read-error line at `text-ink/50` over
  white (≈ 4.6:1 — passes AA for normal text) and **not** lighter. If any state message risks dropping below
  AA, darken it to `text-ink2` rather than lightening. (The disclaimer parenthetical may stay `/50` as it is
  genuinely supplementary.)
- **Signals are text-labeled, never color-alone.** The section conveys no color-coded status; the eyebrow's
  indigo rule is decorative, and the state messages are plain text. Nothing here relies on color to carry
  meaning, satisfying the never-color-alone rule.
- **Focus states.** The topic-card links keep their existing focus behavior (unchanged markup); the section
  framing adds no new interactive elements, so no new focus styling is introduced. (If §5.3 option (b)
  changes the background behind the cards, verify the cards' existing focus ring still meets contrast against
  the new surface — it does against both white and body grey.)

---

## 9. What Development must build vs. leave untouched (hand-off summary)

**Build (in `app/page.tsx`, the existing demoted `<section>` near the bottom):**

1. Replace the heading block: the old `<h2>Explore example topics</h2>` + its muted parenthetical line →
   the **§5.1 eyebrow device** (indigo `bg-brand` 2px rule, `aria-hidden`, + `FRESH FROM THE COMMUNITY` in
   the hero's exact eyebrow classes) + **`<h2>Recently curated</h2>`** (`text-2xl font-bold text-ink`, drop
   to `text-xl` at `< sm` if needed) + the **§3.1 supporting line** (recency framing + the shared-data
   disclaimer parenthetical, §5.2 styling).
2. Restyle the section **separation/spacing** per §5.3 (preferred: generous padding + a slightly stronger
   `border-ink/15` rule; the eyebrow carries the "new section" signal). **Do not** wrap the section in a
   large hardbox card (§5.3).
3. Update the **state microcopy** per §3.2 (loading/empty preferred reframes; **read-error line verbatim
   and preserved**). Keep the existing `topics`/`loadError` state machine and the `store.listTopics()` data
   path exactly.
4. Keep the grid container's column behavior (`grid gap-3 sm:grid-cols-2`).

**Build (in `lib/db/drizzle-store.ts`):**

5. `listTopics()` ordering: `.orderBy(topic.title)` → **`.orderBy(desc(topic.updatedAt), topic.title)`**
   (most recently created/updated first, with a stable `title` tie-breaker) — §4. The single data change.
   No new column, no migration, no `Topic` type change. (Mirror the intent in `local-store.ts` if that seam
   is still exercised; production is the Drizzle store.)

**Leave untouched (hard boundaries):**

6. **The topic card markup** — every `<li>`/`<Link>`/`<span>` and its classes inside the grid (§7). The
   card redesign is a deferred follow-up issue.
7. **The search segment, the "Wiki, plus video." hero, and the projector header** — all above this section,
   all out of scope (issue #125). Harmonize *with* the hero; do not edit it.
8. **`TopicSearch` internals** and the search behavior — unchanged.
9. **Do not** add a per-card "curated N ago" timestamp, a retry button, autofocus, or scroll-jack —
   none are in scope, and the last two would violate §8.

**Screenshot baseline:** this is a landing/shared-surface change — per CLAUDE.md, refresh the homepage UI
screenshot baseline (`docs/design/ui-screenshots/`) in the same PR (a full or homepage-group refresh as
appropriate). Capture the populated state at mobile/tablet/desktop; capture the empty + read-error states if
the catalog has scenes for them.

---

## 10. Open questions / assumptions flagged for Product

- **OQ-1 — eyebrow copy.** `FRESH FROM THE COMMUNITY` vs. `LATELY ON WIKI+` (§3.1). Product/Curation own the
  final pick; UX is neutral. The word "community" implies human curators (true) but not a logged-in social
  graph (which doesn't exist yet) — flagged so Product picks deliberately.
- **OQ-2 — seed-data recency is flat.** Seeded topics likely share a near-identical `updated_at`, so the
  recency ordering won't *visibly* differ from alphabetical until real curation varies the timestamps (§4
  assumption). Expected and acceptable for the prototype; flagged so a screenshot of seed data isn't read as
  a broken sort.
- **OQ-3 — state-string changes.** The loading/empty reframes (§3.2) are preferred but optional; the
  read-error line is verbatim-required. Product confirms whether the friendlier loading/empty strings are
  wanted or whether to keep the terser originals — either passes AC7.
