# Design spec: Curator marks a Topic "complete" (closed to suggestions)

- **Status:** Design contract for build-loop (UX) — GitHub issue #159. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** `docs/specs/topic-complete.md` (Product spec) — AC1–AC19. This doc is the
  **buildable contract** for the curator mark/un-mark control, the unobtrusive status indicator and
  its two opt-in paths, the per-viewer "show suggestions anyway" override, the suppression of every
  suggestion-chrome surface across the derived states, and the complete + zero-video minimal render.
  Product set the *outcomes and the model*; this doc sets *form, placement, microcopy, states,
  responsive behavior, and accessibility* so Dev never guesses.
- **Inputs read:**
  - `docs/specs/topic-complete.md` — the naming decision (`closed_to_suggestions` DB /
    `closedToSuggestions` app type; user label **"marked complete"** / gloss "closed to
    suggestions"); §3.3 interaction model; §3.5 the session-local per-viewer override; §3.6
    who-can-set; §4.2 behavior across derived states; §4.3 the complete + zero-video render; AC1–AC19.
  - `docs/TOPIC_PAGE_DESIGN.md` — §"Three states: empty / mixed / fully-curated" (the **derived**
    model this flag is orthogonal to), §"Two infoboxes" (the wiki+ panel `Infobox.tsx` — where the
    curator control + status indicator live), §"The General strip", §"Clip placement" + the TOC dual
    counts, §"Logged-out reader model (issue #71)" (the `signedIn` axis).
  - `docs/design/skin-toggle.md` (issue #143) — the **prior art** for a per-viewer, no-reload,
    session-local preference layered over the cached read path: a single canonical client control,
    instant in-place re-render, text-labeled-never-color, reflects the *resolved* state. The override
    here is the same shape, scoped tighter (per-topic, session-only, never persisted).
  - `docs/design/plus-overview-redesign.md` + `components/topic/Infobox.tsx` — the wiki+ panel's
    value-first masthead, its three faces (empty / mixed / fully-curated counts block), the §6.5 error
    floor, the Browse/Jump primary action.
  - `docs/VISUAL_IDENTITY.md` — Indigo Press palette, the universal `SiteHeader` projector header, AA
    baseline, text-labeled signals (never color alone), gold-is-decorative (never a functional signal).
  - The suppression surfaces, read in source: `components/topic/GeneralStrip.tsx`,
    `components/topic/CandidateBits.tsx` (`CandidateSetHeader`, `SeeMoreButton`, `CandidateCard`),
    `components/topic/Toc.tsx`, and the rail render in `app/topic/TopicView.tsx`.
- **Hand-off:**
  - **Development** builds the curator control + the two role-gated Server Actions (per spec §4.1),
    the **default-suppression derivation** in `TopicView`, the **session-local per-topic override**,
    the status indicator + both opt-in paths, and the minimal zero-video render — all per this doc.
    Refresh the screenshot gallery (new complete-topic surfaces/states) and update the two timeless
    docs the spec names (§3.4: `TOPIC_PAGE_DESIGN.md` §"Three states", `ARCHITECTURE.md` data model).
  - **Curation / Editorial** confirms the indicator copy stays honest (a curator's judgment, not a
    site guarantee of completeness) — this doc's §4 microcopy is written to that constraint.
  - **QA & Review** verifies AC1–AC19; **UX** evaluates the built UI against this doc.

This is the contract for the **control + indicator + override + suppression**, not a CSS authoring
guide. Token names and existing component seams are cited so Dev never guesses; the exact
markup/CSS is Dev's within these references.

---

## 1. Personas / stories served

Grounded in spec §2 and `VISION.md` ("the plus side serves the self-directed learner first").

- **The curator who is done (signed-in).** *As a curator who has finished a topic — I added every
  video I think belongs, even if that is one or zero — I want to say "this is done" so the page stops
  nudging readers toward unvetted suggestions I've implicitly decided against, and reflects my
  judgment that curation is settled.* → The **mark-complete control** in the wiki+ panel (§2),
  signed-in only, reversible by any signed-in curator.
- **The reader of a complete topic.** *As a reader landing on a topic a curator marked complete, I
  want a calm, near-plain article with only an unobtrusive note that a human marked it done — no
  nudging toward more videos — and the curated clips (if any) still reading with their full trust
  signals.* → Suppressed suggestion chrome (§5–§6) + the **unobtrusive status indicator** (§3).
- **The self-directed learner who still wants more (any viewer, incl. logged-out).** *As a learner
  who isn't sure this topic is really done, I want a one-click way to turn the suggestions back on for
  myself — without an account — and turn them off again, without changing anything for anyone else.*
  → The **per-viewer "show suggestions anyway" override** (§4), reachable logged-out, reversible
  in-session, session-local.
- **The reader who disagrees it's done and wants to contribute.** *As a reader who thinks a video is
  missing, I want a path to add/curate one right from the complete-topic note.* → The status
  indicator's second path, **add a video / curate** (login-gated for logged-out — §3.4).
- **The keyboard / assistive-tech user.** *As a reader navigating by keyboard or screen reader, I
  want to reach the control, the indicator, and the override in a sensible order, operate them with
  standard keys, hear their state in words (not color), and see a clear focus ring.* → §7.

The flag never re-words a clip's trust signals, never touches article faithfulness, and introduces
**no gold** as a functional signal (VI). Curated content is untouched (spec §3.3 / AC11).

---

## 2. The curator mark / un-mark control

### 2.1 Placement (the decision)

**The control lives in the wiki+ panel (`Infobox.tsx`), as a new bottom row beneath the panel's
primary Browse/Jump action — signed-in only.** Rationale:

- The wiki+ panel is wiki+'s own element and the home of topic-level plus actions (value line →
  counts block → Browse/Jump → curation invite). Marking a topic complete *is* a topic-level
  curation act (spec §3.6), so it belongs with the other topic-level plus controls, not on a clip and
  not in the header (the header is the universal projector chrome; a topic-scoped curator act is not
  universal — VI §10.1).
- It sits in the rail, sticky, visible without scrolling on desktop, and stacks into the collapsed
  rail on mobile (below the article lead) — reachable on every width without competing with the
  article column.
- It is **the same node** for the mark and un-mark action (a toggle of one boolean), so there is
  never a state-confusion problem (the skin-toggle posture, `docs/design/skin-toggle.md` §2).

**Visibility gate:** the control renders **only when `signedIn`** (the existing `TopicView`
`signedIn = typeof myContributorId === "number"` predicate, already passed to the rail/strip). A
logged-out reader **never** sees a mutating control (AC4). This is an *affordance* gate; the
**security control** is the role-gated Server Action (spec §4.1) — Dev must re-check the signed-in
curator server-side regardless of the button (the same posture as `ownsClip` / `canHold`).

> **Assumption (recorded for Dev).** The wiki+ panel (`Infobox`) is a client component that today
> receives `hasCurated`, `stats`, `suggestionCount`, `storeError`, `candidatesLoading`, `onBrowse`.
> Add to it: `signedIn: boolean`, `closedToSuggestions: boolean`, `marking: boolean` (write
> in-flight), and `onToggleComplete: () => void`. `TopicView` owns the boolean + the action wiring
> (it already owns `topic`, from which `closedToSuggestions` is read). The control is the panel's
> business; the override toggle (§4) is a *separate* control that belongs to the status indicator, not
> here — keep them distinct.

### 2.2 Form + the two affordances

A single bordered **toggle button** in the Indigo Press control language (the same hardbox chip the
panel's other controls use: `border-2 border-hardbox`, the `2px 2px 0 var(--color-hardbox-offset)`
hover shadow, `min-h-[44px]`). It is a plain `<button type="button">` — **not** a `role="switch"`,
**not** `aria-pressed` (consistent with the skin toggle's §5.3 reasoning: a labeled action button
whose word states what tapping does is the clearer model). Its label and accessible name derive from
the current `closedToSuggestions` value:

| Current state | Visible label (verbatim) | `aria-label` (verbatim) |
|---|---|---|
| not complete (`closedToSuggestions = false`) | `Mark topic complete` | `Mark this topic complete — close it to suggestions` |
| complete (`closedToSuggestions = true`) | `Reopen to suggestions` | `Reopen this topic to suggestions — un-mark complete` |

- **Not-complete affordance:** a **secondary** white/raised control (`bg-surface-raised`,
  `text-ink-plus`), visually quieter than the panel's brand-fill curation invite — marking complete
  is a deliberate, infrequent act, not the panel's headline. A small decorative check/flag glyph
  (`aria-hidden`) may sit before the word; the **word carries the meaning** (never the glyph or color
  alone — VI).
- **Complete affordance:** when the topic is already complete, the same button reads
  `Reopen to suggestions`. It is the un-mark. Because the status indicator (§3) already states "marked
  complete" to *every* viewer, the signed-in curator gets the state from the indicator and the
  *action* from this button — they never disagree (one boolean, one toggle).
- **A short helper line** sits under the not-complete button (panel body text, `text-ink2`,
  `text-[12px]`): *"Stops showing unvetted suggestions to readers. Any curator can reopen it."* This
  sets the honest expectation (it suppresses suggestions; it is reversible) before the click. When
  already complete, the helper line is omitted (the status indicator carries the explanation).

### 2.3 Confirmation + write feedback

- **No confirm dialog.** Marking complete is non-destructive and fully reversible by any signed-in
  curator (spec §6 — no lock, no ownership). A modal would be disproportionate. (Contrast the Delete /
  Remove confirms, which are destructive.)
- **Optimistic with rollback**, mirroring the established write posture (`runDismiss` / `runUpvote`
  in `TopicView`): on activation, flip `closedToSuggestions` in the in-memory `topic` immediately so
  the page re-derives (suppression turns on/off live, no reload — AC1/AC2), fire the role-gated Server
  Action in the background, and on failure **roll back** the flip and show a **non-blocking polite
  notice** in the existing reason-aware notice surface family (`role="status" aria-live="polite"`,
  same styling as the dismiss/upvote/review notices in `TopicView`). Three-arm catch, identical to
  the other writes: `isAuthRequired` → the expired-session gate; `isRateLimited` → the calm limit
  notice (`AUTH_COPY.rateLimit.notice`); else the generic red line:
  - mark failed: *"Couldn't mark this topic complete — please try again."*
  - un-mark failed: *"Couldn't reopen this topic — please try again."*
- **In-flight (`marking`):** the button shows a busy word and is disabled for the round-trip (`Marking…`
  / `Reopening…`), matching the awaited-busy pattern (the review-hold buttons). Because the visual
  flip is optimistic, the busy word is brief; it exists to block a double-submit (a per-topic in-flight
  guard, like `upvoteInFlight`).

### 2.4 Responsive

The control is part of the wiki+ panel and inherits its responsive behavior — there is no separate
breakpoint logic:

- **Desktop / tablet (`≥ lg`):** the panel is the sticky right rail; the control is a full-width row
  at the panel's foot, always visible.
- **Mobile (`< lg`):** the panel collapses into the stacked rail below the article lead; the control
  is the same full-width row there. `min-h-[44px]` keeps the touch target on the 44px floor.

---

## 3. The unobtrusive status indicator (shown to ALL viewers of a complete topic)

When `closedToSuggestions = true`, **every** viewer (logged-out and signed-in, override on or off)
sees an unobtrusive indicator that a curator marked the topic complete. It is **not** a blocking
modal and **not** a loud banner (AC17).

### 3.1 Placement (the decision)

**The status indicator is the top region of the wiki+ panel's body, directly under the panel header
block, above the counts/volume region.** Rationale:

- The wiki+ panel is the first thing a reader meets on the plus side and the orientation surface for
  "what is the plus side doing here." On a complete topic, "a curator marked this complete" *is* the
  answer to that question, so it belongs at the top of the panel body — before the counts.
- It is present for all viewers (the panel always renders); the curator control (§2) sits at the
  panel foot for the signed-in curator, so the *state* (indicator, top) and the *action* (button,
  foot) are both in the panel but visually separated by role.
- One surface, everyone — no logged-out/signed-in fork of the indicator itself (only the second
  opt-in path's gating differs, §3.4).

### 3.2 Form + microcopy (honest framing — the Editorial constraint)

A compact, calm **notice block** on the panel's light surface (NOT the indigo header block, NOT a
red/warning treatment — it is informational, not an error): a thin left rule in `brand` indigo
(`border-l-4 border-brand`) on `bg-surface-2`, `text-ink-plus`, with `text-[12px]`/`text-[13px]`
body. A small decorative check/flag glyph (`aria-hidden`) may precede the heading word; the **word
carries the meaning**.

Microcopy (verbatim — honestly framed as a curator's judgment, never a site guarantee of
completeness):

- **Eyebrow / heading word:** `Marked complete` (the user-facing verb from the spec naming decision).
- **Body line:** *"A curator marked this topic complete, so suggestions are hidden. This is one
  curator's judgment — not a guarantee that nothing's missing."*

This wording satisfies the Editorial constraint (spec §3.6 hand-off): "marked complete" is framed as
*a curator's* act and explicitly disclaimed as *not* a completeness guarantee; the mechanical effect
("suggestions are hidden") is stated plainly so the reader understands what changed and why the plus
side is quiet. The gloss "closed to suggestions" is expressed in the plain-language phrase
"suggestions are hidden" rather than the raw DB term (which would over-mechanize the reader-facing
copy).

### 3.3 The two opt-in paths it carries

Directly beneath the body line, the indicator carries **both** opt-in paths (AC17), as a small row:

- **(a) Turn on suggestions** — the per-viewer override toggle (full spec in §4). For *every* viewer
  including logged-out. This is the primary, leftmost path (it is the one any viewer can take with no
  account).
- **(b) Add a video / curate** — a quieter secondary text-link/button. **Login-gated for logged-out
  viewers** via the existing `requireLogin({ gate: "add" | "curate" })` seam:
  - Signed-in: label `＋ Add a video`; activates the existing Add flow (`onAdd` → `openAdd` →
    `AddModal`).
  - Logged-out: same visible affordance; activating routes through the login gate (the standard
    `requireLogin` path), exactly as the General-strip Add control does today. The reader is never
    *shown* a different control — the gate is what differs, consistent with the logged-out reader
    model (#71).

> **Assumption (recorded for Dev).** Reuse the panel's existing handler wiring rather than invent
> new flows: path (b) is the same `onAdd`/`openAdd` the General strip uses. The indicator does not
> need a new Server Action; it composes existing ones (the override is client-only, §4; add/curate is
> the existing gated flow). Pass `onAdd` and `onTurnOnSuggestions` into the panel alongside the §2
> props.

### 3.4 Why the panel, not a page banner

A top-of-page banner would (a) crowd the article reading column (the thing the reader came for), (b)
read as a site-level alert rather than a plus-side curator note, and (c) duplicate chrome the panel
already owns. Housing the indicator in the wiki+ panel keeps it on the plus side where it belongs,
unobtrusive relative to the article, and co-located with the override + add paths it carries. (AC17:
"not a blocking modal and not a loud banner that crowds out reading.")

### 3.5 Responsive

- **Desktop / tablet (`≥ lg`):** in the sticky panel at the top of its body; visible without scroll.
- **Mobile (`< lg`):** in the stacked panel below the article lead. The indicator's two-path row
  wraps (`flex-wrap`); both paths keep `min-h-[44px]` touch targets. It stays unobtrusive — a short
  notice block, not a full-width sticky bar.

---

## 4. The per-viewer "show suggestions anyway" override

A session-local, per-topic, per-viewer reveal that turns the normal suggestion presentation back on
**for that one viewer, on that one topic, for that session only** (spec §3.5). It works for
logged-out viewers (AC16). It is the skin-toggle posture, scoped tighter.

### 4.1 Where it lives + its form

The override is the **(a) path inside the status indicator** (§3.3) — it does not float elsewhere. It
is a bordered toggle button in the same control language as §2, but **brand-tinted to read as the
primary path** of the indicator's two-path row (the override is the one any viewer can take):

| Override state | Visible label (verbatim) | `aria-label` (verbatim) |
|---|---|---|
| off (default — suggestions suppressed) | `Show suggestions anyway` | `Show suggestions for this topic in this session` |
| on (overridden — suggestions shown) | `Hide suggestions again` | `Hide suggestions again — return to the complete view` |

- A plain `<button type="button">` — **not** a `role="switch"` (same reasoning as §2 / skin toggle
  §5.3): the label states the action. The word carries the meaning; an optional decorative eye/eye-off
  glyph (`aria-hidden`) may precede it.
- **Off (default):** brand-fill (`bg-brand text-white`) so it reads as the live, available path —
  this is the one click the spec wants discoverable (the secondary-metric "the opt-in is used but not
  dominant" depends on it not being buried).
- **On (overridden):** the same button flips to `Hide suggestions again` in the quieter raised/white
  treatment (`bg-surface-raised text-ink-plus`) — the suggestions are now showing, so the prominent
  call-to-reveal is no longer needed; the button now offers the reverse.

### 4.2 Behavior — the instant, local reveal

On activation (click or Enter/Space), mirroring the skin toggle's instant in-place re-render
(`docs/design/skin-toggle.md` §6.2):

1. Flip the per-viewer override state for **this topic** in client/session state (the mechanism is a
   Dev call — `sessionStorage` keyed by topic QID is the spec's suggested shape, §3.5; it must **not**
   write the DB and must **not** vary the cached read-path HTML — the suppression default is identical
   for everyone; the override is a client-side reveal). **No navigation, no reload, no remount.**
2. The page **re-derives** in place: with the override **on**, the topic renders its **normal derived
   state** for this viewer — every suppressed surface from §5/§6 reappears exactly as if the flag were
   off (AC12). With the override **off** again, suppression returns (AC15).
3. The button's own label/treatment flips to reflect the new state (§4.1), and **focus stays on the
   button** (it is the same node, not remounted).
4. The indicator's body line (§3.2) stays present in both override states — the topic is *still*
   marked complete; the viewer has only chosen to see suggestions for themselves. (Assumption: the
   body line does not change wording when overridden; the changed button label carries the "you're now
   seeing suggestions" state. This keeps one honest source of truth — the topic is complete — and
   avoids implying the override changed the topic.)

### 4.3 Scope guarantees (the spec's invariants, expressed in the UI)

- **Per-topic (AC13):** the override state is keyed by topic; overriding on topic A does not reveal
  suggestions on topic B. Dev keys the session store by QID.
- **Session-local, never persisted (AC13):** it lives only in client/session state; a fresh
  session/new device reads the complete-topic default. It is never a DB write and never an account
  preference.
- **Does not affect other viewers (AC14):** because it is purely client-side and the stored default
  is unchanged, a concurrent/subsequent different viewer still sees the suppressed default.
- **Reversible in-session (AC15):** `Hide suggestions again` returns to the suppressed default within
  the session.
- **Logged-out works (AC16):** the override is client-only and requires no auth; the logged-out
  viewer activates it and sees suggestions (still with no per-tile contribute controls — the #71
  logged-out reader model governs the revealed candidate tiles, unchanged).

### 4.4 Edge: complete + zero suggestions actually exist

If a topic is marked complete but has **zero remaining suggestions** anyway (its derived state is
`fully-curated`, or `empty`-with-no-candidates), then turning the override on reveals… nothing new —
there are no suggestions to show. To avoid offering a control that does nothing:

- **Render the override path (a) only when there is something to reveal** — i.e. when the topic's
  *underlying* derived state (computed as if the flag were off) has `≥1` remaining suggestion
  (`liveCandidates.length > 0`). When the complete topic genuinely has no suggestions, the indicator
  shows the body line + **only** the add/curate path (b); the "Show suggestions anyway" toggle is
  omitted (there is nothing to turn on). This keeps the control honest (it never promises a reveal it
  can't deliver) and matches the spec's intent that the override "re-enables the normal suggestion
  presentation" — when that presentation is empty, there is no override to offer.

> **Assumption (recorded for Dev).** `TopicView` computes the underlying suggestion count
> (`liveCandidates.length`) regardless of suppression — the candidate pipeline is unchanged (spec
> §3.3). Pass a `hasUnderlyingSuggestions: boolean` to the indicator so it can decide whether to
> render path (a). Do **not** suppress the candidate *pipeline*; suppress only its *presentation*.

---

## 5. The default-suppression derivation (one seam) + what disappears

### 5.1 The recommended seam (a Dev call within these outcomes)

The cleanest implementation — and the one this design is written against — is a **single derived
boolean in `TopicView`**:

```
suppressSuggestions = topic.closedToSuggestions && !viewerOverride[qid]
```

When `suppressSuggestions` is true, **feed the suggestion-bearing children an empty candidate set**
(present zero `generalCandidates` / `sectionCandidates` and zero suggested TOC counts) — i.e. derive
the *presentation* as if `liveCandidates` were empty, **without** touching the real
`liveCandidates`/candidate pipeline (which still computes the true count for §4.4 and for an override
flip). Because every suggestion-chrome surface **already** gates on "are there suggestions here," an
empty suggestion set collapses all of it for free, with no new conditional in each component:

- `GeneralStrip` with `generalCandidates = []` and `≥1 generalClips` → renders as **fully-curated**
  (curated tiles, `＋ General`, quiet `＋ Add video`; no divider, no suggestion group, no "See N
  more"). With `generalClips = []` too → the **complete + zero-video** minimal render (§6).
- The rail: `sectionCandidates = []` → no `CandidateSetHeader`, no `CandidateCard`s (their render is
  already gated on `sectionCandidates.length > 0`).
- `Toc`: every entry's `suggested = 0` → no dashed `~{s}` badges (the badge is gated on
  `suggested > 0`); curated `{c}` badges unaffected.
- `Infobox` (wiki+ panel): `suggestionCount = 0` → the mixed two-count line and the empty dashed
  volume block both drop (both gate on the suggestion count); the curated numeral grid stays.

This is the same "derive presentation over the unchanged pipeline" posture the coexistence feature
already uses. **The exact seam (passing empties vs. a `suppress` prop threaded into each child) is
Dev's call** — but the *outcome* below is the contract, and the empties approach is strongly
preferred because it reuses the existing zero-suggestion code paths rather than adding parallel
"suppressed" branches.

> **Assumption (recorded for Dev).** The override state must be readable in `TopicView`'s render to
> compute `suppressSuggestions`. Because it is session-local and client-only, read it after mount
> (like the skin toggle reads `data-skin`); the first SSR/again-loading frame may render the
> suppressed default (the honest default for a complete topic) and then reveal if the viewer had
> overridden earlier in the session — a one-tick reveal is acceptable and matches the skin toggle's
> no-flash discipline (reveal only adds chrome; it never flashes wrong *content*).

### 5.2 The suppression contract — exactly what disappears (flag ON, no override)

For a complete topic with `≥1` underlying suggestion and no override, **none** of the following
render, for **any** viewer (AC5–AC10):

| Surface | Component | What is suppressed |
|---|---|---|
| Candidate tiles — General band | `GeneralStrip` | the suggestion group (capped tiles) — AC5 |
| Candidate tiles — rail | `TopicView` rail / `CandidateCard` | the section-anchored candidate cards — AC5 |
| "Suggested · uncurated" divider | `GeneralStrip` | the inline vertical divider `<span>` — AC6 |
| "See N more" | `GeneralStrip` / `SeeMoreButton` | the overflow toggle — AC7 |
| Dashed / suggested TOC counts | `Toc` | every `~{s}` dashed-violet badge — AC8 |
| Rail unvetted-set header | `CandidateSetHeader` | the "Suggested · uncurated" set header — AC9 |
| wiki+ panel suggestion volume | `Infobox` | the `{V} curated · {M} suggested` line (mixed) and the dashed "{N} … to weigh in" empty volume block — AC10 |
| General-band "Find more" source links | `GeneralStrip` | the Search-TikTok / Search-YouTube discovery links collapse to the fully-curated state's quiet `＋ Add video` only (they are an empty-state discovery aid that is noise on a settled topic) |

### 5.3 What stays untouched (AC11 — curated content is never suppressed)

Everything curated renders exactly as today: curated General tiles (full chrome — stance + accuracy
chips, 2-line context-note preview, `context by <curator>`, upvote count / control), curated rail
`ClipCard`s, the General band's curated group + `＋ General` heading + the `N video` curated count,
curated TOC `{c}` badges, the wiki+ panel's videos/creators/curators numeral grid, the Browse/Jump
action, the players, and the owner/reviewer/moderator manage rows. The flag suppresses **only** the
suggestion layer.

### 5.4 Behavior across the three derived states (spec §4.2)

| Derived state (flag off) | With flag ON, no override |
|---|---|
| `fully-curated` (≥1 curated, 0 suggestions) | Visually unchanged (already no suggestion chrome); the **status indicator** appears in the panel; the override path (a) is **omitted** (nothing to reveal — §4.4). |
| `mixed` (≥1 curated, ≥1 suggestion) | Renders like `fully-curated` — curated content only, all suggestion chrome from §5.2 gone; status indicator + **both** paths (a)+(b). |
| `empty` (0 curated, ≥1 suggestion) | Renders the **minimal-plus zero-video view** (§6) — NOT the suggestion-filled bootstrap; status indicator + **both** paths. |

---

## 6. The complete + zero-video minimal render (spec §4.3)

A topic marked complete with **zero curated videos** must read as a **near-plain Wikipedia article
with the plus side dialed right down** — calm, not blank, not broken, not an error, not a loading
skeleton (AC18). This is the most design-sensitive state because the default empty state is *all*
suggestion chrome, and we are removing it.

### 6.1 The article column

Renders **normally and fully** — lead, sections, figures, the Wikipedia infobox, the universal
projector header, scroll-sync (it simply has no rail cards to pair with). The reader gets the
encyclopedia, faithfully. This is the calm we want: a complete zero-video topic should feel like
reading a clean Wikipedia article that happens to have a small plus-side note.

### 6.2 The wiki+ panel at zero videos, complete

The panel still renders (never blank), with its faces dialed down:

- **Value line:** **stays** — "Short videos to learn this topic, each weighed for what's fact vs.
  opinion." It orients the self-directed learner regardless of count (the panel's whole reason for
  leading with value). It carries **no suggestion volume** and **no "curate a video found below"
  framing** that would point at suppressed suggestions (spec §4.3).
- **Counts / volume block:** **omitted.** At zero curated and suppressed suggestions there is no
  honest numeral to show — the dashed "{N} videos found to weigh in" empty volume block is exactly the
  suggestion-volume chrome AC10 suppresses, and a "0 videos" grid would read as broken. So the panel
  shows value line → status indicator (§3) → curator control (§2, signed-in). No counts region.
- **Status indicator (§3):** present, with the body line and **both** opt-in paths (turn on
  suggestions — there *are* underlying suggestions in the `empty` case, so path (a) shows; add a video
  / curate). This is the panel's substance at zero videos: it explains the calm ("a curator marked
  this complete, suggestions hidden") and offers the two ways out.
- **Browse/Jump action:** **omitted** at zero videos (there is nothing to scroll to — the General
  band is minimal, §6.3). The panel's primary action at this state is the override / add paths in the
  indicator, not a scroll-to-nothing.
- **Error floor unchanged:** if the store read fails, the panel shows its existing §6.5 honest
  "couldn't load stats" line (no status indicator, no control) — a read failure is not a
  complete-topic state.

### 6.3 The General band at zero videos, complete

With `generalClips = []` and suppressed `generalCandidates = []`, the band must **not** show the
empty-state `＋ Suggested videos` + `uncurated` pill + Find-more cluster + suggestion tiles (that is
the bootstrap we are suppressing). Two acceptable Dev options, in preference order:

1. **Preferred — omit the General band entirely** at complete + zero-video (render nothing where the
   band would be). The band exists to present videos; with no curated videos and suppressed
   suggestions there is nothing for it to present, and the wiki+ panel's status indicator already
   carries the add path. A near-plain article + a calm panel note is the target. Dev gates the
   band's render on "has curated clips OR (has suggestions AND not suppressed) OR loading."
2. **Acceptable fallback** — if omitting the band complicates the layout/scroll-sync anchors, render
   a **single calm line** in the band's place (on the indigo band, white text, no tiles, no pills, no
   Find-more): *"This topic was marked complete. No videos are curated for it."* — and **no**
   suggestion chrome. This must not reuse the empty-state "No videos found … try a manual search"
   line (that points at suggestions/search we are deliberately hiding).

The reader must never see a suggestion tile, a dashed candidate, a "Suggested videos" heading, or a
Search-platform link on a complete zero-video topic (AC18 + §5.2).

### 6.4 Not an error / skeleton (AC18)

This state is reached only after the store has settled (`storeReady`, `!storeError`) and candidates
have settled (`!candidatesLoading`). It must render the calm composition above, **never** the plus
skeleton (`PlusAsideSkeleton` / `PlusBandSkeleton`), **never** the store-error line, **never** the
article-error pane. The loading and error states are orthogonal and keep their existing treatments
(§7.3); the complete-zero-video state is a *settled, populated* state that happens to have minimal
plus content.

---

## 7. All states + accessibility

### 7.1 State matrix (every state Dev must build)

| State | Curator control (§2) | Status indicator (§3) | Override path (a) | Suggestion chrome | Notes |
|---|---|---|---|---|---|
| Not complete (flag off) | `Mark topic complete` (signed-in only) | absent | absent | normal (per derived state) | The baseline — unchanged from today. |
| Complete, default, mixed/fully-curated | `Reopen to suggestions` (signed-in) | present | present iff underlying suggestions (§4.4) | suppressed (§5.2) | Curated content intact (AC11). |
| Complete, default, zero-video (`empty`) | `Reopen to suggestions` (signed-in) | present, both paths | present (underlying suggestions exist) | suppressed; minimal render (§6) | Calm, not blank (AC18). |
| Complete, **overridden** (any derived state) | `Reopen to suggestions` (signed-in) | present; path (a) reads `Hide suggestions again` | the toggle (now "hide") | **reappears** as normal derived state (AC12) | Per-viewer, session-local. |
| Loading (`!storeReady`) | — | — | — | — | Existing `PlusAsideSkeleton`/`PlusBandSkeleton`; the flag is read from `topic`, so no control/indicator until the store settles. |
| Store-read error (`storeError`) | — | — | — | — | Existing panel §6.5 line + rail error line; no control/indicator (a write surface is meaningless when reads fail — the panel's existing posture). |
| Write in-flight (`marking`) | busy word (`Marking…`/`Reopening…`), disabled | reflects the optimistic new state | follows | follows | Optimistic; rolls back on failure (§2.3). |
| Logged-out, complete | **absent** (AC4) | present | present (path a) | suppressed | Path (b) add/curate routes through the login gate. |

**Loading / error continuity (AC18 boundary):** the curator control and status indicator depend on a
settled `topic` (the flag lives on it). While `!storeReady`, the panel is the skeleton (no control,
no indicator). On `storeError`, the panel is the honest error line (no control, no indicator). Only
on a settled, non-errored read do the complete-topic surfaces appear — so a complete topic never
shows its indicator *over* a skeleton or an error, and the minimal zero-video render (§6) is never
confused with loading/error.

### 7.2 Accessibility (AA baseline — AC19)

- **Keyboard + focus (AC19):** the curator control (§2), the override toggle (§4), and the add/curate
  path (§3.3) are native `<button>`s (the add path may be a `<button>` opening the existing modal/gate)
  — in the natural DOM/tab order within the panel (`… value line → status indicator [override, add] →
  counts → Browse → curator control`). Enter/Space activate them. The global `:focus-visible` 3px
  `--color-focus-ring` ring (offset 2px) is the visible focus state — inherited, no bespoke handling
  (the same ring the skin toggle and panel controls use). On an override flip / mark toggle, focus
  stays on the activated button (same node, not remounted).
- **Text-labeled state, never color alone (AC19):** every state is carried by a **word** — the
  control's label (`Mark topic complete` / `Reopen to suggestions`), the override's label (`Show
  suggestions anyway` / `Hide suggestions again`), the indicator's `Marked complete` eyebrow + body
  sentence. Glyphs are decorative (`aria-hidden`). The indicator's indigo left-rule and the control
  treatments are reinforcement, never the sole signal. **No gold** encodes any state (VI).
- **AA contrast (AC19):** the indicator is `text-ink-plus` on `bg-surface-2` with a `brand` left rule
  — the same ink-on-light pairing the panel body and the calm rate-limit notice already ship (well
  above 4.5:1). The curator control's secondary treatment is `text-ink-plus` on `bg-surface-raised`
  with a `border-hardbox` boundary (the panel's existing control pairing — AA). The override's
  brand-fill state is `text-white` on `bg-brand` (`#676EB4`) — the same white-on-indigo the band's
  brand-fill controls use; **Dev must confirm** white-on-`#676EB4` clears AA for the override's body
  text size (the band's `＋ Add video` already ships this pairing, so it is a known-good combination at
  control weight). The focus ring `#676EB4` on the light panel is the committed site ring.
- **Status announcement:** the status indicator is ordinary panel content (not a live region) — a
  reader meets it in reading order on a complete topic; it does not need to interrupt. The write-result
  notices (§2.3) reuse the existing `role="status" aria-live="polite"` surfaces (non-blocking, never
  `assertive`). The override reveal changes on-page content for the acting viewer only; because focus
  stays on the toggle and the label flips to the new state, the change is self-announced by the
  button's new accessible name (no extra live region needed; Dev may add an `sr-only` polite
  confirmation if testing shows the content change is missed).
- **Reduced motion:** there is **no animation** on the mark toggle, the override flip, or the
  indicator — they are instant in-place re-renders (the skin-toggle posture). The optional curated
  cross-fade that already exists in the General strip is unaffected and remains
  `prefers-reduced-motion`-gated. No new motion to gate.
- **Forced-colors / high-contrast:** the control + indicator are bordered, word-labeled buttons/blocks
  using `currentColor`/system colors; they survive `forced-colors: active` because the meaning is in
  the word and the structural border, never color (consistent with the rest of the panel).

### 7.3 Responsive summary (per new element)

| Element | Mobile (`< lg`) | Tablet / Desktop (`≥ lg`) |
|---|---|---|
| Curator control (§2) | Full-width row in the stacked panel below the article lead; `min-h-[44px]`. | Full-width row at the foot of the sticky rail panel. |
| Status indicator (§3) | Notice block at the top of the stacked panel; two-path row wraps; `min-h-[44px]` paths. | Notice block at the top of the sticky panel body, above counts. |
| Override toggle (§4) | Inside the indicator's wrapping path row; full-width-ish, 44px. | Inside the indicator's path row, left of the add path. |
| Add/curate path (§3.3) | Second item in the wrapping path row; 44px. | Second item in the path row. |
| Minimal zero-video render (§6) | Near-plain article; calm panel note; General band omitted (or the single calm line). | Same; panel is the sticky rail. |

---

## 8. What Development should build

1. **The `topic` flag + two role-gated Server Actions** (per spec §4.1): `closed_to_suggestions`
   boolean `NOT NULL DEFAULT false` on the `topic` row; `closedToSuggestions` on the `Topic` app type
   + the `DataStore` mapper; a `setTopicClosedToSuggestions(qid, value)` action (or two actions) that
   **re-checks the signed-in curator server-side** (the security control, not the affordance) and
   rejects a logged-out caller (AC4). `TopicView` reads `topic.closedToSuggestions` and owns the
   optimistic-with-rollback toggle (§2.3), reusing the three-arm catch + notice surfaces.
2. **The curator control** in `Infobox.tsx` (§2): signed-in-only, the toggle button + helper line, the
   busy/disabled in-flight state. New panel props: `signedIn`, `closedToSuggestions`, `marking`,
   `onToggleComplete`.
3. **The status indicator** in the wiki+ panel body (§3): the calm notice block + the two opt-in
   paths, present for all viewers when `closedToSuggestions`. New panel props: `hasUnderlyingSuggestions`
   (gates path a — §4.4), `overridden`, `onToggleOverride`, `onAdd`. Microcopy verbatim from §3.2/§3.3.
4. **The per-viewer override** (§4): session-local, per-topic (keyed by QID), client-only state in
   `TopicView`; the instant in-place reveal; the `Show suggestions anyway` ⇄ `Hide suggestions again`
   toggle. Read after mount (no DB, no read-path HTML variance — the skin-toggle posture). Never
   persisted; never affects other viewers.
5. **The default-suppression derivation** (§5): `suppressSuggestions = closedToSuggestions &&
   !override`; when true, feed the suggestion-bearing children an empty suggestion set so all chrome
   in §5.2 collapses via the existing zero-suggestion code paths, while the real candidate pipeline /
   count is unchanged (for §4.4 + override). Curated content untouched (AC11).
6. **The complete + zero-video minimal render** (§6): the calm article + dialed-down panel; **omit the
   General band** (preferred) or render the single calm line; never blank/broken/error/skeleton.
7. **Docs (spec §3.4 — part of done):** add the disambiguation note to `TOPIC_PAGE_DESIGN.md`
   §"Three states" (derived `fully-curated` vs. the orthogonal curator-set "marked complete (closed to
   suggestions)") and the `closed_to_suggestions` field + the presentation-derivation note to
   `ARCHITECTURE.md` (data model + candidate/empty-state section). Do not alter the derived-state
   definitions.
8. **Screenshot gallery:** this adds new complete-topic surfaces — add `Scene`s to
   `e2e/screenshots/catalog.ts` for: a complete `mixed`/`fully-curated` topic (default, suppressed) ×
   logged-out/signed-in; the complete topic **overridden** (suggestions revealed); the **complete +
   zero-video** minimal render; and the curator control visible (signed-in). Capture across widths and
   refresh `docs/design/ui-screenshots/` in the same PR.

---

## 9. What UX will evaluate (after Dev)

- **Placement + form:** the curator control reads as a quiet, deliberate plus-side action at the panel
  foot (signed-in only — never shown logged-out, AC4); the status indicator is an unobtrusive panel
  note, never a blocking modal or loud banner (AC17); both sit in the wiki+ panel as specified.
- **Suppression contract (AC5–AC11):** on a complete `mixed` topic, every surface in §5.2 is gone for
  every viewer, and every curated surface in §5.3 is intact — verified across the screenshot matrix.
- **Override (AC12–AC16):** activating "Show suggestions anyway" reveals the normal derived state in
  place (no reload), is reversible, is session-local + per-topic, does not affect other viewers, and
  works logged-out. The §4.4 edge (no toggle when nothing to reveal) holds.
- **Zero-video minimal render (AC18):** a complete zero-video topic reads as a near-plain article + a
  calm panel note with both paths — not blank, broken, an error, or a skeleton; no suggestion chrome
  anywhere.
- **Microcopy / honesty (Editorial):** the indicator frames "marked complete" as a curator's
  judgment, explicitly not a completeness guarantee (§3.2 verbatim).
- **A11y in practice (AC19):** keyboard reach + visible focus on the control, the override, and the
  add path; text-labeled state on each (never color/glyph alone); AA on the rendered surfaces; no
  gold as a signal; focus stays put on toggle.
- **Loading/error continuity:** a complete topic never shows its indicator over a skeleton or error;
  the minimal zero-video state is not confused with loading/error.

Design defects route back to **Development**; a pass signals the build-loop forward.
