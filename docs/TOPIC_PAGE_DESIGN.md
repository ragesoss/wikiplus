# wiki+ — Topic Page Design Direction

The design for the core Topic page. The reference mockup is **`mockups/inline-indigo-sync.html`** —
the committed layout/interaction model with the committed **"Indigo Press" plus identity** (see
*Plus visual identity* below). The structure, interaction model, and color system below are the
committed direction; finer visual details are refined during implementation.

## The two worlds

A Topic page presents two deliberately contrasting visual languages, split by column:

- **"Wiki" (left column)** — the real Wikipedia article, styled to look like Wikipedia:
  serif title and section headings with hairline rules, sans-serif body, blue wikilinks, and
  right-floated captioned figures (Wikimedia Commons images). The article is **never disrupted**
  by video — it reads as the encyclopedia.
- **"＋plus" (right column)** — everything wiki+ adds, in a colorful, playful, short-form-video
  visual language (the "Indigo Press" treatment — see *Plus visual identity*). Practicality,
  usability, and accessibility are the baseline (contrast, focus states, keyboard support,
  text-labeled signals — never color alone).

The wordmark is **one seam-aligned lockup straddling the column divider** (not two separate
per-column labels): a single `wiki | plus` mark whose internal seam — where the serif "Wiki" ends
and the indigo "+" block begins — lands on the **real article↔plus column divider**, so the lockup
labels the two columns *by position*: "Wiki" sits over the article column and "＋plus" over the plus
rail because the seam is on the boundary between them. It is the shared "Daylight Projector"
header — the same `HeaderProjector` lockup the landing page uses, with its seam driven onto the
measured gutter centre at `≥ lg`; below `lg` the columns stack and the lockup carries its split
within itself. See `VISUAL_IDENTITY.md` §6.0 and `docs/design/shared-header.md`.

> **Implementation note (per ARCHITECTURE).** The article body is fetched and rendered
> **client-side** from Wikipedia (sanitized), and its **wikilinks resolve to internal wiki+
> topics** (`/topic/…`), not out to Wikipedia.

## Plus visual identity — "Indigo Press"

The ＋plus side has a bold, editorial "zine" treatment, recolored from the **Wiki Education
Dashboard** brand palette so wiki+ reads as part of that brand world. Defining traits:

- **Light, editorial cards** — white/very-light panels with **2px ink (`#2C2C2C`) borders and
  solid offset drop-shadows**, big numerals for counts, chunky count tags, color-blocked panels,
  and bold oversized display headings on plus blocks.
- **Indigo-dominant**; gold is an accent only. The ＋plus header label, the **wiki+ panel** (see
  *Two infoboxes*), and the General band are **indigo `#676EB4`** color-blocks; count numerals/tags
  are indigo. Gold (`#E5AB28`) is a tertiary accent reserved for the header wordmark (see
  `VISUAL_IDENTITY.md`), never a color-block or a functional signal.
- **Brand fonts**: headings **Source Sans Pro**, body **Open Sans** (the dashboard's fonts).
  The Wiki side keeps its serif Wikipedia look — the two type systems reinforce the two worlds.

### Brand palette (from the WikiEdu Dashboard `_variables.styl`)

| Role | Hex |
|------|-----|
| Indigo (primary) | `#676EB4` |
| Deep violet | `#5248AF` |
| Teal ("sprout") / dark | `#2A8270` / `#1F6757` |
| Action blue | `#1F6F95` |
| Red (warning) | `#C44949` |
| Inks | `#2C2C2C` / `#595959` / `#717171` |
| Light bg / borders | `#F7F7F7` · `#F0F1F3` / `#D9D9D9` |

Gold (`#E5AB28`) is the palette's **accent / tertiary** color: used sparingly — and in a lighter,
desaturated form — for the header wordmark (see `VISUAL_IDENTITY.md`); it is never indigo's equal,
never a color-block fill, and never a functional signal color.

### Fact-vs-opinion signal (chips)

Each clip's accuracy/stance is shown as a **text-labeled chip** (never color alone), color-coded:

- **Accurate** → teal `#2A8270`
- **Accurate with a caveat** (simplified / condensed / exam-framed / big-picture / fast-paced) → action blue `#1F6F95`
- **Opinion / anecdotal / teaching-context / classroom** → red `#C44949`
- **Stance** chip (Explainer / Short / Demonstration / Classroom …) → indigo `#676EB4`

The red carries a mild "caution/weigh-this" tone, not "error." Every chip must meet AA contrast.

## Layout

A two-column layout from the top (article ~1fr, plus rail ~360px):

- **Left (article):** title + attribution ("From Wikipedia · CC BY-SA 4.0"), the lead, then the
  article body sections with their real headings, wikilinks, figures, and (per the
  article-fidelity feature) the **Wikipedia infobox** float-right at the top — see *Two infoboxes*
  below.
- **Right (plus rail, sticky):** the **wiki+ panel** (video / creator / curator counts), then the
  **Table of Contents**, then the curated **section videos**. The rail is
  present and pinned from the very top.

### Two infoboxes — a naming disambiguation (do not conflate)

The Topic page has **two distinct "infobox" objects**; they live in different columns, in different
visual languages, and the docs name them distinctly:

- **Wikipedia infobox** — the encyclopedia's *own* summary box (taxonomy, key facts, lead image),
  restored by the article-fidelity feature. It lives in the **left article column**, float-right at
  the top of the lead, and keeps **Wikipedia's visual language** (grey header rows, hairline
  borders) — it is part of "the Wiki world," never restyled into Indigo Press.
- **wiki+ panel** — wiki+'s *own* element in the **right rail**, and the first thing a reader
  meets on the plus side. It **leads with the plus-side value** — a constant one-line statement
  ("Short videos to learn this topic, each weighed for what's fact vs. opinion") — so a
  self-directed learner who will never curate is oriented and served before any counts or task
  framing. Below the value line sits a **state-variant counts/volume block** and a **primary
  Browse / Jump action** that scrolls to the videos (the non-curator's useful path), then a
  **secondary, honestly-framed curation invite**. It has **three faces** (see §"Three states")
  that reshape only the counts block: the videos / creators / curators
  numerals (fully-curated); the same three numerals **plus a `{V} curated · {M} suggested to weigh
  in` two-count line** (mixed); or, at 0 curated, a dashed "provisional" volume block ("{N} videos
  found to weigh in — none vouched for yet") (empty). The curation invite explains the task (watch
  → vouch → write a note) and is always **secondary**, never the headline; it is a teal `＋ Curate
  a video` at 0 curated and a white `＋ Add a video` once the topic has content. The panel carries
  **no "synced" status and no per-panel source provenance** — those are internal plumbing for a
  reader (the once-per-context unvetted/source signal lives in the General band + rail set header).
  On a store-read failure it still shows the value line plus an honest "couldn't load stats"
  line (no skeleton, no write button). It is **Indigo Press** (indigo header block, hardbox border +
  offset shadow). Reference mockup: **`mockups/plus-overview-A-value-first.html`** (Direction A,
  "value-first masthead"); full contract in `docs/design/plus-overview-redesign.md`. Implemented in
  `components/topic/Infobox.tsx`; its doc-facing name is **the wiki+ panel**.

They **cannot collide**: at `lg+` they are in separate grid columns (the Wikipedia infobox floats
*within* the article column, the wiki+ panel is the right rail beyond the grid gap); below `lg` the
Wikipedia infobox stacks full-width in the article flow and the wiki+ panel sits in the collapsed
rail below it.

### The General strip — the one crossover

Immediately after the lead, a full-width **General strip** presents whole-topic videos that
don't map to a specific section. It is the **only** place plus content reaches into the Wiki
column, and is styled like a video-platform search row — **thumbnail-forward**, a quick visual
overview, horizontally scrollable.

**Curated and suggested content coexist here, curated always first.** When a topic has
both curated general clips and general suggestions, the strip is one scroll row read left→right:
**every curated clip first** (full curated chrome, never capped — curation is the priority content),
then an inline **`Suggested · uncurated`** divider, then the **general suggestions capped at a
single named default (`GENERAL_SUGGESTION_DEFAULT = 8`)** with a trailing **`See N more`** control
that toggles only the suggestion overflow (a pure slice — no re-fetch/re-order). Curated and
suggestions are **never interleaved**. The band heading is **`＋ General`** whenever curated content
leads (mixed + fully-curated) and **`＋ Suggested videos`** only at 0 curated. See §"Three states"
below for the full model.

**Curated-tile anatomy.** A curated General tile carries the same trust signals the
section-anchored rail card does, so a reader can weigh it where they meet it first. Top-to-bottom:
thumbnail → held marking (only when held) → caption → creator handle · platform → **stance +
accuracy chips** → a **2-line context-note preview** → `context by <curator>` → upvote → owner/
reviewer manage rows. The chips are the standard fact-vs-opinion chips (see §"Fact-vs-opinion
signal" and `lib/curation/labels.ts` for their labels/colors — not restated here); they carry their
own AA-safe fills, so the indigo band behind them never touches the chip text. The note preview is
**clamped to two lines on a white panel with a 2px ink border** so its small body text clears AA
over the indigo `#676EB4` band (the same white-panel treatment the held pill and candidate
match-line use) — small note body text is **never** placed directly on the bare indigo band. The
preview is a hook only: the **full, untruncated note lives in the opened player**, and the whole
tile thumbnail is already the click-to-open affordance (no separate "read more" control). Candidate
tiles are unaffected — they carry no note and no chips (CURATION §6).

**Curated player anatomy.** On **desktop (`≥ lg`)**, opening a curated clip — General
**or** section-anchored — opens the blocking `PlayerModal`, which renders a **curation block beneath
the video frame**: creator credit (links out) → held marking (only when held) → **stance + accuracy
chips** → the **full context-note text** → `context by <curator>` (links in to the curator profile;
the `@prototype` stub shows the non-linked "seed clip · no curator" label). The block sits on a light
surface inside the existing dialog focus trap, mirroring the rail card's reading order so the same
curated clip carries identical trust signals wherever a reader opens it (the parity goal). The video
frame's own states (autoplay-on-open iframe, the "can't be embedded" fallback) are unchanged; the
curation block renders below it either way. On **mobile (`< lg`)** the same curated clip opens the
**unified mobile player** instead (§"The unified mobile video player") — a non-modal, movable,
viewport-fit dock that shows the credit + chips with the full note one tap away. The curation block's
**content** is identical across both surfaces: it is the single shared `CurationBlock` source of
truth, so the note never forks between the modal and the dock.

**Logged-out reader model.** The Topic view distinguishes a **logged-out reader** from a
**signed-in curator** along one axis (`signedIn`). Browsing reads as reading: a logged-out reader's
tiles carry the trust signals that help weigh a clip but **no per-tile action control**, and the
invitation to participate relocates into the player, where it lands after the reader has watched.

- **Curated tiles (rail + General strip):** no upvote control. The upvote **count** stays as
  read-only social proof — a static, non-interactive, unfocusable label (e.g. "12 upvotes", the noun
  honestly pluralized); a clip with **count 0 shows no figure**. Muted-ink on the light rail card,
  white on the indigo band (no underline — that is the control's actionable cue).
- **Candidate tiles (rail + General strip):** watch-only — thumbnail (opens the pinned player /
  link-out per the embed split), match reason, source pill, caption, and creator credit; **no Curate
  / Not relevant buttons**. The dashed/unvetted visual language is unchanged.
- **The two player CTAs** (logged-out only): the candidate **`PinnedPlayer`** carries a **"Curate this
  video"** button routing into the curate flow for that candidate; the curated **`PlayerModal`**
  carries a softer topic-level **"Log in to curate videos for this topic"** join nudge inside its
  curation block. Both route through the `curate` login gate.
- **Signed in:** every surface is unchanged — the upvote toggle, candidate Curate / Not relevant, and
  owner/moderator rows stay exactly where they are, and the players gain no CTA.

## Clip placement: General vs. section-anchored

Curated videos divide into two buckets:

- **General** — whole-topic intros/overviews; shown in the General strip.
- **Section-anchored** — each tied to the article section it relates to; shown in the plus rail.

The **TOC shows a per-entry video count** (a "General" entry first, then each section with a
badge for how many videos are anchored there). Sections with no videos still appear as a normal
wiki TOC entry. **A row carries DUAL counts:** where a section (or the
General row) has both curated clips and suggestions, it shows **both** a **solid indigo `{c}`**
curated badge **and** a **dashed-outline violet `~{s}`** suggested badge, curated-first (matching
the body order). A row with only curated content shows the solid badge; only suggestions, the
dashed badge; neither, the muted `no video` text badge (on section rows). Each badge carries an
`sr-only` word (`curated` / `suggested, unvetted`) so the meaning is in the accessible name, never
color or border-style alone.

## Interaction: synchronized scrolling

The article and the plus rail are **scroll-synchronized**:

- Scrolling the **article** moves the plus rail to the active section's video(s) and highlights
  the pairing (section marker + active card + TOC entry).
- Scrolling the **plus rail** scrolls the article to that anchor.

Anchoring is at **section granularity**. The exact sync mechanics
(thresholds, easing, mobile single-column fallback) are an implementation-phase detail.

## Three states: empty / mixed / fully-curated

A Topic page is **not** an all-or-nothing flip between "empty" and "curated." It derives **three
states** from two independent facts — the curated-clip count and the *remaining* (deduped)
suggestion count — and **renders both content types when they co-occur**:

- **empty** (0 curated, ≥1 suggestion) — the bootstrap state below.
- **mixed** (≥1 curated **and** ≥1 remaining suggestion) — the common middle of the curation curve:
  vetted clips **and** still-unvetted candidates render **together**, curated always first. This is
  the state the flywheel lives in; it must stay useful, not go dark after the first curation.
- **fully-curated** (≥1 curated, 0 remaining suggestions) — only curated content; **no** suggestion
  chrome anywhere (no divider, no "see more", no unvetted set header, no dashed/suggested counts).

**Derived `fully-curated` vs. the curator-set "marked complete".** The three states
above are **automatically derived** from the counts — `fully-curated` is reached *only* when the
candidate pool is empty (≥1 curated + 0 remaining suggestions), as a consequence of the pool, not a
curator's choice; it cannot apply at zero curated videos. Separately, a curator can mark a topic
**complete (closed to suggestions)** — an explicit, persisted topic-level flag
(`topic.closed_to_suggestions`) that **suppresses the suggestion layer by default for every viewer,
even when the derived state is `empty` or `mixed`** (so the page reads like `fully-curated`, and a
complete topic with zero curated videos reads as a near-plain article with a calm plus-side note —
the *complete + zero-video minimal render*). It is **orthogonal** to the derived model: it does not
rename or change the three states, only suppresses their suggestion presentation; with the flag off,
the derived behavior is exactly as defined here. Any viewer (including logged-out) can opt back in
for themselves with a session-local "show suggestions anyway" override. See
[`docs/specs/topic-complete.md`](specs/topic-complete.md) and
[`docs/design/topic-complete.md`](design/topic-complete.md).

**Priority + ordering (owner-fixed).** Curated content always sorts and renders **before**
suggestions — in the General band (curated group → `Suggested · uncurated` divider → capped
suggestion group → `See N more`) and within a section's rail (curated `ClipCard`s → one-time
`CandidateSetHeader` → `CandidateCard`s). They are **never interleaved**; suggestions keep the
dashed/unvetted, visually-subordinate treatment.

**Section→General reflow (no deletion).** When a section-anchored suggestion loses its slot because
a curated clip occupies/takes priority in that section, it **folds back into the General suggestion
pool** (no special "I was moved" chrome — it reads as an ordinary General-pool suggestion, reachable
under `See N more` if it overflows the default). A suggestion is **never silently dropped** by
coexistence — only relocated and overflow-collapsed.

**No-churn stability (the bar).** Curating one suggestion changes **exactly one** video's state
(suggested→curated, deduped out via `curatedVideoKeys()`) and leaves every other suggestion's
identity, order, and on-screen position untouched — **no re-run of the candidate pipeline
(`suggestCandidates`), no reshuffle, no re-fetch**. Ordering is a **stable sort/filter over the
already-derived `liveCandidates`**. An optional, `prefers-reduced-motion`-gated cross-fade on the newly-curated tile is
polish over an already-stable layout; the stability is the contract, not the animation.

**Where the unvetted signal/counts live in mixed (once-per-context).** The once-per-context
discipline holds — **no per-card "SUGGESTED" badge** — and the copy introduces the suggestion
*subset*: the **wiki+ panel** carries the `{V} curated · {M} suggested`
two-count line (the volume signal for the topic); the **TOC** rows carry dual `{c}` + `~{s}` counts;
the **General-band divider** and the **rail `CandidateSetHeader`** ("The suggested videos below…")
introduce the suggestions to their right/below, not "this whole topic is unvetted." In
fully-curated the unvetted signal is **absent everywhere**.

### Empty / zero-curation state (the bootstrap)

Every topic starts with **zero curations**. The empty state still aims to be useful and to drive
the curation flywheel, by bootstrapping the plus side with **auto-suggested, clearly unvetted
candidates** plus prominent paths to curate. Crucially, the empty state must also serve a reader
who will **never** curate: the **wiki+ panel leads with the plus-side value and a Browse path to
the suggested videos** (see *Two infoboxes* and `docs/design/plus-overview-redesign.md`), so
curation framing stays a secondary invitation rather than the empty state's headline. Reference
mockups: the page layout is **`mockups/inline-indigo-empty-v2.html`**; the wiki+ panel
is **`mockups/plus-overview-A-value-first.html`**.

- **Auto-suggestion is multi-platform by design.** The General bar is populated automatically with
  candidates from a video search for the topic — **YouTube and TikTok** (and potentially other
  sources); the frontend treats all auto-candidates the same. Where a candidate's metadata
  (title/description/tags) matches a specific article section's keywords, that match **anchors the
  candidate to its section in the plus rail** (and increments that section's TOC suggestion count) —
  it is **not** rendered inside the article body. The Wiki column stays plus-free except for the one
  General-strip crossover; matching governs *where in the rail* a candidate is anchored, not whether
  it crosses into the article column. A section-matched candidate appears only in the plus rail,
  never inline under the section in the article body (consistent with §"Clip placement: General
  vs. section-anchored").
  - *MVP limitation (pragmatic, not a design choice):* only **YouTube** auto-suggestion is wired up
    at first, because TikTok lacks an easily-accessible search API (see ARCHITECTURE). TikTok
    auto-suggestion switches on when it becomes practical — the design already accommodates it.
- **Manual source paths (always available).** A **"Search TikTok"** button (and possibly other
  source buttons) **launches TikTok (web/app) in a new window** for a manual search — useful
  regardless of auto-suggestion, and the interim way TikTok content gets in.
- **"Add video" (logged-in only).** Paste a **YouTube or TikTok share link** for a clip that
  auto-suggestion missed; we resolve its embed/metadata and start a curation.
- **Unvetted treatment.** Candidates are unmistakably distinct from curated clips: dashed (not
  solid) borders, no solid offset shadow, a desaturated/hatched thumbnail. No stance/accuracy chips
  yet. TOC badges show suggestion counts in a dashed/outline style, distinct from curated counts.
  - *The unvetted / auto-suggested signal reads **once per context**, never once per card.* It
    lives in exactly three places: the **wiki+ panel** (the dashed empty-state
    volume block — "{N} videos found to weigh in — none vouched for yet … unreviewed suggestions";
    the word *unreviewed/suggested* carries the unvetted meaning in text, and the panel names no
    source — see `docs/design/plus-overview-redesign.md`), the **General band header** ("Suggested
    videos · uncurated — auto-found
    candidates, not yet vetted"), and a **one-time "unvetted set" header** atop the rail candidate
    list ("Suggested · uncurated. Auto-found from {sources}. No context notes yet — a human hasn't
    reviewed these. Curate one to vouch for it."). There is **no per-card "SUGGESTED" badge** and
    **no repeated "Auto-suggested" / "no context yet" block** — the dashed container plus the
    once-per-context headers already carry the signal.
    - *In the **mixed** state these three locations introduce the suggestion
      subset, not the whole topic:* the wiki+ panel shows `{V} curated · {M} suggested
      to weigh in` (the panel count IS the signal); the General-band signal is the inline
      `Suggested · uncurated` **divider** after the curated group (the band's own `<h2>` is
      `＋ General`); and the rail `CandidateSetHeader` reads "**The suggested videos below**
      are auto-found from {sources} — no context notes yet, not reviewed by a human. Curate one to
      vouch for it." Its gate is "≥1 rail suggestion" (independent of curated count), so it sits
      **between** the curated rail group and the suggestion rail group.
  - *Per-card, a candidate keeps only genuine per-clip **information**:* a **compact single-line
    match reason** (why *this* clip matched, e.g. *Mentions "light-dependent reactions" in
    description*) and a small **text-labeled source pill** (e.g. `YOUTUBE`) reading the candidate's
    own source — the multi-source hook so a mixed YouTube/TikTok set reads correctly without a
    redesign.
  - *The General band states the kind of content once and **defers the volume count** — no "N
    candidates" label; the topic-wide count lives once, in the wiki+ panel.*
- **Curation entry points.** For a **signed-in** curator every candidate carries **Curate** (opens
  "Curate this clip" — write the context note, set stance + accuracy, confirm the section; publishing
  turns it into a vetted curated clip) and **Not relevant** (rules it out). These on-card controls are
  a secondary path for triaging without opening the player (judging by caption + match reason +
  thumbnail, or batch-dismissing obvious mismatches); the **in-player action row** carries the same two
  actions as the primary path once a clip is open (see §"The pinned candidate player"). Browsing is anonymous;
  **curating or adding a video requires login**. A **logged-out** reader sees watch-only candidate
  tiles (no Curate / Not relevant) and meets the curate invitation in the player instead — see
  §"Curated player anatomy" → *Logged-out reader model*.

## The pinned candidate player (in-app preview)

Curated clips play in a **blocking, focus-trapping modal on desktop** (`PlayerModal` / `ModalShell`).
Evaluating auto-suggested candidates is a triage loop — watch, compare against the article, promote
or dismiss, then watch the next — so **candidate** videos use a different
surface: a **persistent, non-modal pinned player** that keeps playing while the reader keeps reading
and lets a second click swap what's playing. (Full spec: `docs/design/pinned-player.md`.)

On **mobile (`< lg`)** there is no such split: **both** curated and candidate clips play in the **one
unified mobile player** (§"The unified mobile video player"), so the triage loop and the curated
viewing experience share a single surface on the small screen. The desktop split below applies at
`≥ lg`.

- **Desktop candidate dock.** At `≥ lg`, only **YouTube** candidates (with an `embedUrl`)
  open the pinned player; curated clips keep the blocking modal; **non-YouTube** candidates and
  YouTube candidates **with no `embedUrl`** open in a **new tab** (`window.open(watchUrl)`).
- **Standard position + size (desktop `≥ lg`).** A fixed dock in the **bottom-left** corner
  (`bottom/left: 1rem`), width capped at `min(380px, calc(100vw − 2rem))`; vertical 9:16 Shorts are
  height-capped (`min(60vh, 460px)`) and the dock narrows to that frame. Bottom-**left** is deliberate:
  the sticky plus rail and every candidate's **Curate / Not relevant** controls live on the right,
  so docking left keeps them visible and operable while the player is open (no overlap, no layout
  shift). On **mobile** the candidate plays in the unified mobile dock instead (below).
- **Persistent + single instance.** `position: fixed`, survives scroll (iframe never re-mounts), one
  player and one iframe at a time; a second candidate click **swaps the iframe `src` in place** rather
  than stacking. The iframe is **created on explicit play and torn down on dismiss** (embed-never-host;
  autoplay only because the user clicked).
- **Dismiss affordance.** A real, keyboard-operable **"✕ Close"** button (glyph **and** word) in the
  title bar; activating it removes the dock and its iframe from the DOM (playback stops).
- **Metadata + actions (watch + act).** The title bar carries the clip's **caption** plus **creator
  credit** (`handle · platformLabel`), reusing the strip/card footer pattern;
  no match reason inside the dock. Below the frame is the **action row**, so a reader can decide on the
  clip where they watched it: signed in, the candidate's two actions — **Curate** (primary, brand fill)
  and **Not relevant** (secondary) — using the same labels and weight as the on-card controls. Logged
  out, the action row is a single full-width **"Curate this video"** CTA; a logged-out
  dismiss is gated, not shown in the dock.
- **Accessibility model (non-modal).** The dock is a **labeled landmark** (`<section
  aria-label="Video preview">`), **not** a dialog: no `aria-modal`, **no focus trap**, no backdrop. It
  **does not steal focus on open** (no autofocus) and does not block the page. Dismiss is keyboard
  reachable with the project's visible focus ring; on keyboard dismiss focus returns sensibly (reuse
  the General-band-heading focus pattern), never dropped to `<body>`. Any dock-in motion is gated by
  `prefers-reduced-motion`. All chrome is **white-on-`ink`** (AA, no gold) and the
  Close control is signaled by its **word**, never color alone.

## The unified mobile video player

On **mobile (`< lg`)**, **every** video — curated or candidate — plays in **one** non-modal, movable,
viewport-fit player, `MobilePlayerDock`. It is one shared
component: the frame, Close, the park toggle, and the maximize behavior are **identical for every
clip**; only what the two inline reveals show differs by `(kind: curated | candidate) × (signedIn)`.
(Full spec: `docs/design/mobile-player-slim.md`; invariants in
`docs/design/unified-player-mobile.md` + `docs/design/mobile-player-launch.md`.) The viewport is
read **at play time**: a play click on a narrow viewport opens this dock; on a
wide viewport it opens the desktop modal/pinned dock above. An open dock stays in its surface across a
breakpoint crossing — only the next play re-evaluates — so a rehost never interrupts playback.

- **The slim default.** A playing mobile video is the **video frame plus ONE 46px row of four equal
  glyph-above-word cells — Close · Move · Curate · See context — and nothing else** in the default
  chrome. No caption, creator credit, chips, description, or match reason appear in the default; the
  reader keeps reading the article beside the picture. The dock is a frame-first flex column (frame →
  control bar → reveal region) and is **bounded** (capped at `88dvh − insets`, never the full screen;
  a 9:16 Short's frame caps at `min(46vh,380px)`, centered + letterboxed), so a generous slice of the
  article stays visible (≈69% for a 16:9 clip). The frame and bar never shrink or scroll; an open
  reveal's body is the dock's sole scroll area. The page reserves space at the parked edge equal to
  the dock's **measured actual height** so the article can be scrolled fully clear.
- **Two inline reveals (one open at a time).** **Curate** and **See context** are inline expander
  reveals anchored to the bar (`aria-expanded` / `aria-controls`) — never bottom-sheets, so the
  non-modal contract holds. Opening one grows the dock (the frame stays pinned above) and closes the
  other. **See context** is where **all** metadata lives — caption, **creator credit** (`handle ·
  platformLabel`), and the why/note/chips: a candidate shows the **"Why suggested"** match reason; a
  curated clip shows the held marking (if held) + stance/accuracy chips + the full **Context note** on
  a light card + **"Context by @curator."** The creator credit appears **only** here. **Curate** is
  the "act": a candidate signed in shows **✦ Curate** + **✕ Not relevant** (the same vocabulary and
  handlers as the desktop player); a candidate logged out shows a single **✦ Curate this video** CTA
  and no dismiss; a curated clip's slot holds the vote/manage affordance (or the logged-out join
  nudge). After a Not-relevant the candidate is optimistically hidden (rollback on write failure), the
  dock closes, and focus moves to the General band heading.
- **One dock at a time.** Curated and candidate mobile playback share the single-instance guarantee:
  a second play (either kind) **swaps in place** (one `<section>`, one iframe, payload changed); there
  is never a curated dock *and* a candidate dock open at once. A curated⇄candidate swap re-renders the
  same dock with the new `kind`.
- **Movable, keep-reading (the Move toggle).** The **Move** cell is a labeled park toggle whose word
  names the destination ("Move to top" / "Move to bottom", keyboard-operable, never drag — drag fights
  touch scroll and is hard for AT); it parks the full-width dock at the top or bottom edge while the
  article stays scrollable. The page reserves space at the parked edge (an additive, edge-aware spacer
  sized to the dock's measured height, removed on dismiss) so the article never hides permanently
  behind the bar.
- **Maximize is the embed's native button + automatic rotate-to-fill, never a custom control.** There
  is **no custom Maximize control** in the bar. Fullscreen is the embed's **own** native button inside
  the iframe (`allowFullScreen` stays). Rotate-to-maximize is **automatic CSS**: turning the phone
  landscape grows the **same `<section>` and the same iframe** to fill the viewport (`fixed inset-0`) —
  a 16:9 clip fills the landscape width, a 9:16 clip fills the full height upright; rotating back
  restores the slim dock. A CSS maximize is right because we embed third-party iframes and control only the
  container, not the inner `<video>`; **iPhone Safari has no Fullscreen API for an arbitrary
  element/iframe**, and programmatic native fullscreen requires a user gesture an `orientationchange`
  is not — so a CSS maximize is fully controlled, identical cross-platform, and testable.
- **Accessibility model (non-modal).** Like the candidate dock, the unified dock is a **labeled
  landmark** (`<section aria-label="Video player">`), **not** a dialog — no `aria-modal`, **no focus
  trap**, no backdrop, no focus steal on open (including when a reveal opens). The four bar cells, both
  reveals' triggers, and every action inside the reveals are real keyboard-operable `<button>`s (each
  cell ≥46px) with the visible focus ring; on keyboard Close, focus returns to the General band
  heading. All signals are carried by a **word** (the glyph is decorative `aria-hidden`), never color
  or position alone; chrome is white-on-`ink` (AA, no gold), the context note on a light surface
  (`text-ink2`). Motion (dock-in, park, maximize, reveal expand) is gated by `prefers-reduced-motion`.

## Data implications (already reflected in the clip model)

These map onto the `clip` entity in [`ARCHITECTURE.md`](ARCHITECTURE.md):

- `general` (boolean) + `sectionId` / `sectionLabel` — drives General vs. anchored placement and
  the TOC counts.
- `creator` (handle, name, platform, followers/avatar), `context` note, `stance`, `accuracy`,
  `orientation` (vertical/horizontal), `thumbnail`, `embed_url`, `watch_url` — drive the cards.
- Topic-level counts (videos / creators / curators) feed the wiki+ panel (the right-rail
  counts element; see *Two infoboxes*).

## Open refinements (deferred to implementation)

- Phrase-level anchoring instead of section-level.
- Mobile / single-column behavior (the two-pane sync collapses on narrow screens).
- TikTok embedding (thumbnails are signed URLs that can expire; embeds are unreliable) — likely
  thumbnail + link-out, with YouTube using a click-to-load iframe facade.
- How much of the larger set (`stats.totalClips`) to surface and the "see all" / browse flow.
