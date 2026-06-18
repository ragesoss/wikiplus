# Design Spec: Contributor profiles, "my curations", public "context by <curator>" attribution, and owner Edit/Delete on the General band (milestone D3)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#54](https://github.com/ragesoss/wikiplus/issues/54) — milestone **D**, run **3 of 5**).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/contributor-profiles.md` — the Product spec. This design serves **AC1–AC11**,
    the curator/reader stories below, and honors Decisions **1** (URL `/contributor/<username>`;
    public = username + granted avatar + curated clips; never email; non-unique handle resolves to a
    single identity), **2** ("my curations" = your own public profile viewed as owner; no separate
    private view), **3** (fold the General-clip owner Edit/Delete gap into D3), **3b** ("context by
    <curator>" links IN, distinct from the §5.2 creator credit which links OUT), **4** (`@prototype`
    gets no browsable profile; non-linked label), and **5** (no per-user work on the cached topic
    read path).
  - `docs/CURATION_STANDARD.md` **§5.2** (creator credit — links OUT), **§5.3 / §5.4 / Decision
    C7** — the two canonical attribution strings, used **verbatim** below and centralized for Dev:
    - curator attribution: **`context by <username>`** (lowercase "context by"; `<username>` =
      `clip.curatedBy`; links IN to `/contributor/<username>`; accessible name
      **"context by <username>, view their curations"**).
    - legacy stub label: **`seed clip · no curator`** (NON-linked, no profile link).
    - the **distinctness rule (load-bearing):** creator credit names the video's maker and links
      **OUT** to the platform; curator attribution names the note-author and links **IN** to the
      profile. **Direction is the editorial tell**; never merge them, never share a link, never imply
      the creator wrote the note.
    - the public profile shows username + **granted** avatar only — **never** email.
  - `docs/design/curate-add-persistence.md` (D1) — the curate surface + the pending/error/expired
    state patterns (referenced, not changed by D3).
  - `docs/design/clip-edit-delete.md` (D2) — **D3 REUSES** D2's `EditModal`, `DeleteConfirmDialog`,
    the `ownsClip()` owner-affordance mechanism (Decision 6 (a): `clip.curatorId === session
    contributorId`), and the post-delete `focusBandHeading()` / no-reload patterns. This spec
    specifies the **deltas** D3 adds, not a redesign.
  - `docs/design/topic-page-v1.md` — **the committed Topic-page baseline.** Specifically: the clip
    card **§5.9**, the General band / `GeneralStrip` **§5.5 / §6.3**, the chips **§9** + AA contrast
    **§9.3**, the two-world header **§5.1 / §6.1**, modal a11y **§11.4**, focus-visible **§11.2**,
    keyboard **§11.3**, landmarks **§11.5**, responsive **§12**.
  - `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity); reference mockups
    `mockups/inline-indigo-sync.html` (curated).
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/ClipCard.tsx` — the creator-credit block (lines 63–84, links OUT) and the
    **decorative provenance footer** (`{curatedBy} · {curatedAt}`, lines 102–111) — the anchor that
    D3 evolves into the linked **"context by"** attribution; the existing owner Edit/Delete row
    (lines 117–140) is reused.
  - `components/topic/GeneralStrip.tsx` — the curated tile (lines 166–177): caption + creator
    subline, **no** curator attribution and **no** owner affordance today (the two D3 gaps).
  - `components/topic/EditModal.tsx` + `components/topic/DeleteConfirmDialog.tsx` — reused **as-is**
    (no new modal).
  - `app/topic/TopicView.tsx` — `ownsClip()` (lines 816–820), `myContributorId` from `useSession()`
    (lines 67–68), `EditModal` / `DeleteConfirmDialog` already wired for the rail (lines 1143–1161),
    `onEditSubmit` / `onDeleteConfirm` (the host write + in-place re-render / removal).
  - `components/auth/AuthControl.tsx` — the header identity; the `SignedIn` Radix `DropdownMenu`
    (lines 96–132) **already reserves an additive slot above "Sign out" for D's "My curations"**
    (the comment at line 84). Three skins: `home`, `topic-plus` (≥lg, white-on-indigo block),
    `topic-compact` (<lg).
  - `app/topic/[[...slug]]/page.tsx` — the catch-all Topic route pattern the **new
    `app/contributor/[username]/` route parallels** (App Router page; `dynamicParams = true`).
  - `lib/data/types.ts` (`Clip.curatedBy` / `Clip.curatorId`), `lib/curation/labels.ts` (the
    enum→label chip map), `lib/wiki/topicRoute.ts` (`topicHref` / `titleToSlug` — the topic-link
    helper the profile's "on Topic" link reuses), `lib/db/drizzle-store.ts` (`STUB_HANDLE =
    "@prototype"`).
- **Feeds:** Development (build to **this spec** for the D3 deltas), then QA & Review
  (correctness/security) + UX evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the D3 **deltas**: a new
> **public profile route** `/contributor/<username>` (with every state — populated / empty /
> not-found / `@prototype` / loading), the **"my curations" header entry**, the **"context by
> <curator>" attribution** on the clip card + the General tile + the profile, and the **folded-in D2
> owner Edit/Delete** on the General band + the profile list. It does **not** redesign the clip card,
> the modals, the header shell, or the chips; the committed `topic-page-v1.md` baseline and the
> D1/D2 surfaces stand. Reading any profile is **anonymous**; D3 adds **no** per-user work to the
> cached topic read path (the attribution is static markup from `clip.curatedBy`; the owner
> affordance reuses the already-authenticated client-session compare). Every requirement is tagged
> with the Product AC(s) and the story it makes buildable.

---

## 1. Personas & stories served

D3 closes the *legibility* half of VISION's thesis: a curator's vouches become a **visible, browsable
body of work**, and the note acquires a **clickable author**. Of the three Topic-page personas
(`topic-page-v1.md` §1), D3 serves **P1 the reader** and **P2 the curator** in roughly equal measure,
with **P3 the moderator** out of scope (removing *others'* clips is D5).

### P1 — Priya, the weighing reader (PRIMARY for the public surface)
Anonymous, unchanged on the topic read path. Priya is weighing a note on a clip; D2/D1 made the note
real, but it had no author she could question. D3's increment: she can click **"context by
<curator>"** to reach that curator's **public profile** — the other clips they have vouched for, each
with topic context — and decide how much to trust this voice, exactly as a Wikipedia reader checks an
editor's contributions. She never logs in for any of it; the profile is a public attribution surface.

### P2 — Marcus, the curator/contributor (PRIMARY for the owner surface)
The same persona D1/D2 served. D3 gives Marcus the place his work lives: **"my curations"** — his own
public profile, reached from the header, where he sees everything he has vouched for in one place
and can **manage all of it**, including the General-filed clips D2 left without an Edit/Delete
affordance (the curate form defaults to General, so this bit his primary path). His profile is public
by design; when *he* is the viewer it additionally carries the owner controls and reads as "my
curations." He works mostly on desktop but may be on a phone, a keyboard, or a screen reader; the
profile, the attribution links, the header entry, and the General-band affordances must work for all.

### P3 — Mod, the moderator (CONTEXT ONLY — out of scope)
A profile shows a contributor's clips as-is; D3 adds no report/flag/remove-others capability and no
moderator-viewed profile. The `@prototype` stub (owned by no current user) is inert to everyone — it
has no browsable profile and its clips show the non-linked `seed clip · no curator` label. Moderation
is D5.

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S21 — browse a curator's body of work.** *As a reader weighing a note, I want to click an
  attribution and see the other clips that curator has vouched for, across topics, with enough
  context to judge — so I can decide how much to trust this voice.* *(AC1, AC6.)*
- **S22 — the note has a visible, clickable author distinct from the creator.** *As a reader, I want
  to tell "who wrote the context note" apart from "who made the video," and click through to the
  note-author's profile — never confusing the two.* *(AC6; CURATION §5.4 distinctness rule.)*
- **S23 — reach my own curations.** *As a signed-in curator, I want a header entry that takes me to
  my own curations in one place — which is simply my public profile, seen by me, with my owner
  controls.* *(AC5.)*
- **S24 — manage ALL my clips, including General ones.** *As a curator, I want Edit/Delete on every
  clip I own — including the ones filed General — so I'm not stuck with a General clip I created but
  can't manage.* *(AC7; closes the D2 gap.)*
- **S25 — only my public identity is shown; never my email.** *As a contributor, I want my profile to
  show only what I present publicly (my Wikimedia username and, if granted, my avatar) — never my
  email or private OAuth data.* *(AC2; CURATION §5.4.)*
- **S26 — a missing or empty profile fails gracefully.** *As a reader, when I land on a profile for a
  username that doesn't exist, or a real contributor who hasn't curated anything, I want a clear
  honest page — never a crash or a blank screen.* *(AC3, AC4.)*

---

## 2. Information architecture — the new surfaces & where they live

D3 adds **one new route** and **three additive treatments** on existing surfaces. Nothing is moved or
removed.

| Surface | What D3 adds | Reuses |
|---|---|---|
| **`/contributor/<username>`** (new route) | The public profile page: identity header + curated-clip list with topic context; every state (§3–§6). | The header/footer shell, the chips (`Chips.tsx`), the clip-card content language, the topic-link helper (`topicHref`). |
| **Header** (`AuthControl` `SignedIn` menu) | The **"My curations"** menu item, signed-in only (§7). | The existing Radix `DropdownMenu` slot reserved above "Sign out". |
| **`ClipCard`** (rail) | The linked **"context by <curator>"** attribution, evolving the decorative provenance footer (§8.1). | The card; nothing else changes. |
| **`GeneralStrip`** curated tile | The linked **"context by <curator>"** attribution **and** the owner Edit/Delete affordance (§8.2, §9). | D2's `EditModal` / `DeleteConfirmDialog`, `ownsClip()`. |
| **Profile clip list** | Owner Edit/Delete on each owned row, when the viewer is the owner (§9.3). | D2's modals + `ownsClip()`. |

**Route shape (informs Dev; not the route authority — Dev owns the App Router wiring).** The profile
lives at **`/contributor/<username>`**, an App Router page paralleling the Topic catch-all
(`app/topic/[[...slug]]/page.tsx`). `<username>` is the Wikimedia username (`clip.curatedBy` /
`contributor.handle`). The page reads `getContributorByUsername(username)` + (if it resolves)
`listClipsByContributor(contributorId)` through the seam — **anonymous, no session** (AC1, AC2). The
state the page renders is decided by those reads (§3). Reading is a plain dynamic read page; **no**
ISR/Redis caching is added (deferred), and the profile reads run **only here**, never on the Topic
shell (Decision 5 / AC9).

---

## 3. The profile route — the four states (the gate; AC1, AC3, AC4)

`/contributor/<username>` renders exactly **one** of these states. Dev wires the decision from the two
reads; UX fixes what each state looks like and reads.

| State | Trigger | Renders |
|---|---|---|
| **Loading** | The reads are in flight (client-side hydration of the dynamic page). | A neutral skeleton (§3.5) — never a "not found" flash. |
| **Populated** | `getContributorByUsername` resolves **and** the contributor has ≥1 curated clip. | Identity header (§4) + the curated-clip list (§5). |
| **Empty** | The username resolves to a **real** contributor with **zero** curated clips. | Identity header (§4) + the empty line (§3.3). |
| **Not-found** | The username resolves to **no** contributor (`getContributorByUsername` → null), **or** the username is the `@prototype` stub. | The not-found page (§3.4) — a clear "no such contributor," not a crash. |

The not-found and the `@prototype` cases render the **same** not-found page (Decision 4 / AC4): the
stub is "not a real person to profile," so it is treated as if the username resolved to nothing — no
browsable list of stub-attributed clips ever renders.

### 3.1 Page chrome (all states)
The profile reuses the app shell. Because the profile is **not** a Topic page, the two-world Wiki/＋plus
header (`TopicHeader`) does **not** apply; use the simpler app header context (the same `AuthControl`
identity affordance is reachable — Dev: the existing `home`/global header skin, so a signed-in viewer
keeps their account menu, and a logged-out reader sees "Log in with Wikipedia" — but this is *chrome*,
not a profile control; the profile itself requires no login). The page body is a single centered
column, `max-w-[760px]`, `px-5`, comfortable reading measure — this is a *contributions list*, not the
two-column reader. A back-affordance to the topic graph is not required; the breadcrumb is the per-clip
"on <Topic>" link (§5.4).

### 3.2 Populated — overview
Top: the **identity header** (§4). Below: an `<h2>` section label **"Curated clips"** (or, on the
owner-viewed profile, **"My curations"** — §7.3) carrying a count
(**`<n> clip` / `<n> clips`**, pluralized), then the **clip list** (§5) in reverse-chronological order
(newest vouch first — the same order the topic clip list uses; Dev orders by `createdAt` desc). A
contributor's clips may span several topics; the list is flat (not grouped by topic) with each clip
naming its parent topic (§5.4). No pagination is required at prototype scale (note: if a future
contributor has very many clips, pagination is a later enhancement — do not build it now).

### 3.3 Empty (a real contributor, zero clips) — AC3
The identity header (§4) renders normally — this is a coherent identity, not a broken page. In place
of the list, a single honest line, `text-sm` `text-ink2`, centered in the content column with generous
vertical padding:

> **<username> hasn't curated any clips yet.**

(The username is the resolved handle, plain text — not a link, you are already on their profile.) No
chrome, no CTA, no skeleton. This is a *valid* profile that simply has no body of work yet — it reads
as "nothing here yet," never as "something failed." On the **owner-viewed** empty profile the same
line reads **"You haven't curated any clips yet."** (§7.3) — Dev swaps the subject when the viewer is
the owner.

### 3.4 Not-found (unknown username, or `@prototype`) — AC3 / AC4
A clear, calm not-found page in the content column — **not** a 500, not a blank screen, not the topic
"Topic not found" string (a different surface). Anatomy:
- An `<h1>` **"No such contributor"** (`plus-disp`, the display face, `text-2xl`).
- A line, `text-sm` `text-ink2`: **"We couldn't find a contributor with that username."** (Do **not**
  echo the raw `@prototype` handle or imply a stub identity — for the stub case the page reads
  identically to a genuinely unknown username; Decision 4: the stub is not profiled, not explained.)
- A link **"Back home"** → `/` (`text-action underline`), matching the topic dead-end's affordance.
This page does **not** render an identity header or any clip list. Dev: ensure the route returns this
state cleanly (an App-Router `notFound()` / a rendered not-found body — Dev's call) so it is honest to
crawlers and screen readers alike; never a stack trace, never a hydration flip from a half-rendered
identity.

### 3.5 Loading — AC3-adjacent
While the reads are in flight, render a neutral skeleton in the content column: a header-shaped block
(an avatar circle placeholder + a username-width bar) over 2–3 clip-row skeletons. Honor
`prefers-reduced-motion` (static blocks, no shimmer, as `GeneralStrip`'s skeleton does). The loading
state must **never** show "No such contributor" — an unresolved-yet read is not a not-found (the same
ordering rule the bare-path redirect honors in `app/not-found.tsx`). Announce politely via a
`role="status" aria-live="polite"` "Loading profile…" line (sr-only) so a screen-reader user is not
left silent during the client read.

---

## 4. The public identity header (AC1, AC2; CURATION §5.4)

The header asserts "here is a curator." It shows **only** public identity (Decision 1 / AC2 — the
load-bearing privacy line):

- **Avatar** — a 56px round avatar, **2px ink border** (`border-ink`, the card-language ring). If
  `contributor.avatarUrl` was **granted** (C is identify-scope, so it may be absent), render the
  image with **`alt=""`** (it is decorative — the username beside it carries the identity, so the
  alt must not duplicate it; an empty alt is correct here per the non-redundant-alt rule). If **no**
  avatar was granted, render the **same gradient-initial fallback** the rest of the app uses (the
  `bg-gradient-to-br from-brand to-violet` circle with the uppercase first initial, as `AuthControl`'s
  `SignedIn` avatar and `ClipCard`'s creator avatar do) — `aria-hidden` (decorative; the username is
  the name). Graceful with or without the avatar — no broken-image, no layout shift.
- **Username** — the Wikimedia handle as an `<h1>`, `plus-disp` display face, `text-3xl` `font-bold`
  `text-ink`. This is the public identity and the accessible page name. (On the owner-viewed profile,
  add the "my curations" framing per §7.3 — the username stays the `<h1>`; the framing is an adjacent
  eyebrow, not a replacement.)
- **A one-line role descriptor**, `text-sm` `text-muted`: **"Curator on wiki+"** — orients a reader
  who arrived cold to what this page is (a wiki+ contributor's curations), without inventing any
  bio/stats the data doesn't have.

**Never rendered (binding — AC2 / CURATION §5.4):** the contributor's **email** or any other
non-public `account` field. The header is built from the **public-safe projection only** (id /
username / avatarUrl). UX asserts no field beyond username + granted avatar + the static "Curator on
wiki+" descriptor; there is **no** bio, no display-name-distinct-from-handle, no follower/clip
counts beyond the list's own `<n> clips`, no email, no join date, no edit-profile control (all out of
scope — Product Out-of-scope; D3 is read-only over existing identity).

---

## 5. The curated-clip list (topic context) (AC1)

Each row shows enough to be meaningful **out of** the Topic-page setting (a reader landed here from an
attribution link, not from a topic). A profile clip row reuses the **clip-card content language**
(`topic-page-v1.md` §5.9) — it is the same vocabulary the reader already knows — but it is **not** the
scroll-sync rail card (no active nub, no section-jump scroll behavior; there is no article beside it).
Render the list as `<ul role="list">`, one `<li>` per clip, each an `<article class="plus-card">` with
this vertical stack:

### 5.1 Parent-topic line (the new context, top of the row) — AC1
At the **top** of each row, a topic breadcrumb so the reader knows *which article* this clip
contextualizes:

> **On <Topic title>** — a link to that Topic page.

- The whole **"<Topic title>"** is an `<a>` to `topicHref(topicTitle)` (the canonical
  `/topic/<Title>/` route — reuse `lib/wiki/topicRoute.ts`), `text-[13px]` `font-bold` `text-action`,
  underline on hover (the `text-action` internal-link tone, matching the card's section link). "On"
  is a plain `text-muted` prefix. Accessible name: the link text is the topic title; prefix it for
  AT clarity if the bare title is ambiguous (`aria-label="On <Topic title> — view this topic"`).
- Dev supplies the topic title (+ QID) on each clip via the `listClipsByContributor` join
  (Product scope #2). If a clip is **General** vs section-anchored, optionally append the placement
  in muted text after the title (**"On <Topic> · General"** / **"On <Topic> · <section>"**) — small
  enrichment, not required; the topic link is the required element.

### 5.2 Thumbnail + creator credit (links OUT — §5.2 unchanged)
The clip's **thumbnail facade** (reuse `VideoThumb`) and the **creator credit** exactly as on the clip
card (`topic-page-v1.md` §5.9.4 / CURATION §5.2): avatar + creator name + **"<handle> · <platformLabel>"**
subline, **linking OUT** to the creator on their platform (`target="_blank" rel="noopener"`). This is
the §5.2 creator credit — **unchanged** by D3, and it is the OUT half of the distinctness pair (§8.4).

### 5.3 Chips + context note
The **stance chip** + **accuracy chip** (text-labeled, the closed-enum label map, `topic-page-v1.md`
§9 — reuse `Chips.tsx`) and the **context note** block (the 4px indigo-left-border `bg2` block with
the "Curator note" eyebrow, §5.9.6). Identical treatment to the clip card.

### 5.4 The "context by" attribution on a profile row (decide: suppress) — Decision
On the profile, **every** clip is by the **same** curator (the profile's owner). Repeating "context by
<username>" on every row would be redundant noise — the page header already says whose profile this is.
**Decision: SUPPRESS the per-row "context by <curator>" attribution on the profile clip list.** The
identity is asserted **once**, in the §4 header; the rows carry topic context + creator credit + chips
+ note, not a repeated self-attribution. (This is the profile analog of the topic page's
once-per-context candidate header — issue #14 declutter: assert identity once, don't repeat it per
card.) The **creator credit (§5.2) is still shown** on every row (it differs per clip and links OUT).
A `@prototype` profile never exists (§3.4), so the `seed clip · no curator` label has no place here.

### 5.5 Owner affordances on the row (when the viewer is the owner) — §9.3
When the profile's owner is the viewer, each row additionally shows the D2 **Edit / Delete** owner
action row, identical to the clip card's (§9.3). On any other viewing (anonymous reader, or a
different signed-in contributor) the rows carry **no** owner affordance.

---

## 6. "context by <curator>" on the Topic-page surfaces (AC6; CURATION §5.4 / Decision 3b)

This is the public attribution that makes a note's author clickable. It renders on the **`ClipCard`**
(rail) and the curated **`GeneralStrip`** tile, links IN to the profile, and stays **visually +
textually distinct** from the §5.2 creator credit.

### 6.1 The attribution element (canonical, shared) — used verbatim
A single shared element (Dev: one small component, e.g. `ContextByLink`, so the markup + the strings
+ the `@prototype` suppression are defined once and reused on the card and the tile):

- **Real curator** (`clip.curatedBy` is a real username, not the stub):
  > **context by <username>**
  - Lowercase **"context by "** (the fixed always-present label, `text-muted`) + **`<username>`** as
    the **link** (`<a href={`/contributor/${username}`}>`, `text-action` underline-on-hover — the
    internal-link tone, distinct from the OUT creator link, §6.4).
  - **Accessible name** (verbatim, CURATION §5.4): **`context by <username>, view their curations`**
    (`aria-label` on the link). The visible text carries "context by <username>"; the aria-label adds
    "view their curations" so a screen-reader user knows where it goes.
  - The **word "context" carries the meaning** — never color-alone (CURATION §4). Keyboard-operable
    link; the global `:focus-visible` 3px indigo ring applies (`topic-page-v1.md` §11.2).
- **Legacy `@prototype`** (`clip.curatedBy === STUB_HANDLE` / no real curator — Decision 4):
  > **seed clip · no curator**
  - A **non-linked** plain label (`<span>`, `text-muted`), verbatim **`seed clip · no curator`** — no
    `<a>`, no profile href, no dead link. Honest about provenance (seeded, not vouched for by a
    person), implies no real author. Dev detects the stub via `STUB_HANDLE` (or a clip with no
    real `curatedBy`).

### 6.2 Placement on the `ClipCard` (rail) — §8.1
Today the card's **decorative provenance footer** (lines 102–111) reads
`{curatedBy} · {curatedAt}`. **D3 evolves this footer into the attribution:** replace the bare
`{curatedBy}` text with the §6.1 **"context by <username>"** element. The footer stays where it is
(below the curator note, above the owner action row), `text-[11px]`. Keep the upvote count (▲ <n>,
indigo bold) on the left as-is; the **"context by"** attribution sits on the right (where `curatedBy`
sat). The relative `curatedAt` may stay as a trailing muted text after the attribution, or be dropped
— Dev's call; the required change is that the bare curator name becomes the **linked "context by"**
attribution. (The footer is no longer purely decorative — it now carries an interactive link; update
the comment, and the footer's text is no longer the sole carrier inside an `aria-hidden`.)

### 6.3 Placement on the `GeneralStrip` curated tile — §8.2
The curated tile (lines 166–177) shows caption + the **"<handle> · <platformLabel>"** creator subline
(this subline is currently NOT a link — the General tile's creator credit is text-only today; that is
acceptable and unchanged). D3 adds, **below** the creator subline, the §6.1 **"context by <username>"**
attribution line (`text-[11px]`). Because the band is the full-bleed indigo surface (white text on
`bg-brand`), the attribution's link must clear AA **on indigo**: render the link in **white with an
underline** (`text-white underline`) — the underline carries the "this is a link" signal so it does
not depend on a color shift against the indigo (§8.4 / §10). The "context by " prefix is `text-white/80`.
For a `@prototype` tile, the non-linked `seed clip · no curator` label renders in `text-white/80`. Keep
the tile compact — the attribution is one short line; it must not push the tile taller than the rail
cards expect (it line-clamps with the caption as needed).

### 6.4 Distinct from creator credit — the load-bearing rule (CURATION §5.4)
On **every** surface the two must read as two separate things:

| | Creator credit (§5.2) | Curator attribution (§5.4) |
|---|---|---|
| **Names** | the video's maker | the wiki+ note-author |
| **Direction** | links **OUT** (`target="_blank" rel="noopener"`) | links **IN** (in-SPA, `/contributor/<username>`) |
| **Text tell** | name + "<handle> · <platform>" | **"context by <username>"** |
| **On the card** | the avatar + name block (§5.9.4), with the thumbnail above it | the footer attribution (§6.2), below the note |
| **Visual tell** | no underline on light; opens a new tab | **underlined** internal-link tone (`text-action` on light, white-underline on indigo) |

They are **never merged into one line, never share a link, never imply the creator wrote the note**.
The "context by" wording does the textual work; the OUT-vs-IN direction + the placement (creator
credit up by the thumbnail, curator attribution down by the note) do the visual work. Dev must not
collapse them to save space.

---

## 7. The "My curations" header entry (AC5; Decision 2)

"My curations" is **your own public profile, reached as the owner** — there is no separate private
route or private data (Decision 2). The entry lives in the header's existing account menu.

### 7.1 Where it appears
In `AuthControl`'s `SignedIn` Radix `DropdownMenu` (`AuthControl.tsx` lines 118–131) — the slot the
existing comment already reserves "for D's My curations" **above** "Sign out". Add a `DropdownMenu.Item`:

> **My curations**

- It renders **only when signed in** (`status === "authenticated"` with a `session.user.username`) —
  the `SignedIn` component only mounts then, so the item inherits that gating (AC5: signed-out → no
  entry; it needs the user's username). Across all header skins (`topic-plus`, `topic-compact`, and the
  global/`home` header on the profile + other pages) the menu carries it identically.
- `onSelect` navigates (in-SPA, `next/navigation`) to **`/contributor/<session.user.username>`** —
  the viewer's own profile. (Decision 1's deterministic single-identity resolve means this username
  maps to one profile, the viewer's own.) Order in the menu: **My curations** (top), then a hairline
  divider, then **Sign out** — so the destructive/exit action stays last.
- Keyboard + a11y: it is a Radix menu item (roving focus, Enter/Space activates, Esc closes the menu)
  — the existing menu a11y carries it; no new wiring. Its text is the signal ("My curations"), never
  an icon alone.

### 7.2 What it reads vs. the public profile
It is the **same** route and page as §3–§5. The difference is only the §7.3 owner framing + the owner
affordances (§9.3), which the page already derives from "is the viewer the profile's owner?"
(`ownsClip` / the username compare). There is **no** separate "my clips" view, no private data, no
extra query.

### 7.3 The owner-viewed profile reads as "my curations"
When the viewer **is** the profile's owner (their `session.user.username` matches the profile's
username — Dev: the same compare `ownsClip()` uses, or `session.user.contributorId ===
profile.contributorId`), the page additionally:
- **Reframes the section label** from "Curated clips" to **"My curations"** (the `<h2>`), and the empty
  line from "<username> hasn't curated any clips yet." to **"You haven't curated any clips yet."**
  (§3.3). The identity `<h1>` (the username) is **unchanged** — the owner still sees their public
  identity as others see it; "my curations" is the framing, not a different identity.
- Optionally adds a small eyebrow above the `<h1>`, `text-[11px]` uppercase `text-muted`:
  **"Your public profile"** — a quiet honesty cue that this is what everyone else sees (Decision 2:
  one surface, public, with owner controls when it's you). Optional; the section-label reframe is the
  required cue.
- **Surfaces the owner Edit/Delete affordance** on each clip row (§9.3).

A logged-out viewer, or a different signed-in contributor, sees the **plain public profile** (§4–§5):
"Curated clips", no "my curations" framing, no owner affordances.

---

## 8. (Reserved — the attribution surfaces are §6; numbering kept aligned with the deltas list §13.)

*(See §6 for the "context by" attribution; §9 for the owner affordances.)*

---

## 9. Owner Edit/Delete on the General band + the profile list (the folded-in D2 gap) (AC7)

D2 placed the owner Edit/Delete affordance on the rail `ClipCard` only. D3 extends the **existing**
affordance — D2's `EditModal`, `DeleteConfirmDialog`, and the `ownsClip()` mechanism, **unchanged
server actions** — to the two surfaces D2 left out: the **`GeneralStrip` curated tile** and the
**profile clip list**. This is reuse, not a new control. The **server-side id-based ownership gate
from D2 is the security control and is unchanged** (AC8) — this run only adds the *affordance* where
it was missing.

### 9.1 When the affordance renders (the fixed constraint; D2 §3.1, Decision 6)
Identical to D2: the Edit + Delete affordance renders **only** when the viewer is **signed in** **and**
**owns** the clip (`ownsClip(clip)` — `clip.curatorId === myContributorId`, the already-authenticated
client-session compare). In every other case it is absent:
- logged out → no affordance on any clip;
- a clip curated by a different contributor → no affordance;
- a legacy `@prototype` clip (no `curatorId`) → no affordance to anyone (AC7 / AC8).

**No read-path cost (binding — AC9):** the ownership compare runs only in the already-authenticated
client session, on `clip.curatorId` already loaded. An anonymous reader's render of the General band
is byte-for-byte unchanged (no affordance, no session read on the read path). The profile is its own
route; its owner-compare also runs only in the viewer's authenticated session.

### 9.2 On the `GeneralStrip` curated tile
The curated tile is compact (a `w-44` horizontally-scrolling strip tile, lines 166–177). The owner
affordance must fit without breaking the strip:
- Add, **below** the creator subline and the §6.3 "context by" line, a small **owner action row**
  rendered **only** when `owned`: a `role="group" aria-label="Manage your curated clip"` row,
  `flex flex-wrap gap-1.5`, with the **same two buttons** as the `ClipCard` row (§D2 3.2) — **"Edit"**
  (`.srcbtn` secondary: white fill, 2px ink border, ink text — but on the indigo band, this white
  button reads fine as it already does for the band's "Add video"/"Search" controls) and **"Delete"**
  (the `accred`-bordered destructive). Because the tile sits on the **indigo band**, match the band's
  existing button language (white-fill buttons with 2px ink border, as the empty-state "Find more"
  cluster uses — `GeneralStrip` lines 97–120) so the buttons are legible on indigo. Keep them small
  (`text-[11px]`, `px-2 py-1`) to fit the `w-44` tile; they wrap if needed.
- `aria-label`s carry the clip caption and "your curation" (D2 §3.3): `"Edit your curation:
  <caption>"` / `"Delete your curation: <caption>"`.
- Activation is identical to the rail: **Edit** opens D2's `EditModal` (pre-filled, conditional
  re-agreement); **Delete** opens D2's `DeleteConfirmDialog`. Dev wires `onEdit` / `onDelete` props
  on `GeneralStrip` (it does not have them today) up to `TopicView`'s existing `setEditClip` /
  `setDeleteFor` (the same handlers the rail card uses).

### 9.3 On the profile clip list
Each profile clip **row** (an `<article class="plus-card">`, §5) shows, when the viewer is the owner
(§9.1), the **same** owner action row as the `ClipCard` (§D2 3.2): a hairline-divided
`role="group" aria-label="Manage your curated clip"` row with **"Edit"** + **"Delete"**, below the
note. The profile is the natural home for "manage all my clips," and General-filed clips appear here
too — so an owner can reach every clip they own from one place (the §S24 promise). Activation opens
D2's `EditModal` / `DeleteConfirmDialog`.

### 9.4 Post-edit / post-delete result on these surfaces (no reload) — AC7
The host owns the write + the in-memory update, reusing D2's `onEditSubmit` / `onDeleteConfirm`:

- **Edit (both surfaces):** on success the clip object is replaced in place in the host's clip set; it
  re-renders with the new note/chips/section. On the **General tile**, a section change re-anchors the
  clip out of the General strip into its new section (or vice versa) via the existing
  `generalClips`/`sectionClips` derivations — the tile leaves the strip and the card appears in the
  rail, no reload (this falls out of D2's in-place replace; no new layout). Edit does **not** remove a
  node, so focus returns to the originating **Edit** trigger (`ModalShell` `prevActive`).
- **Delete (both surfaces): focus management is the load-bearing new bit.** Delete **removes the
  node** the action came from, so `prevActive.focus()` would target a detached node and focus would be
  lost to `<body>`. The rule:
  - **On the Topic page (General tile delete):** reuse the existing `focusBandHeading()` pattern (the
    General band heading is the shared "move focus off a removed node" anchor — `TopicView` already
    uses it for dismiss/promote/delete). After a General-tile delete the deleted tile is gone; move
    focus to the **General band heading** (it is still present — the band itself isn't removed; even if
    the last General clip is deleted the band remains, relabeling per `mode`). Schedule it post-close
    (the `requestAnimationFrame` pattern `onDeleteConfirm` already uses) so it runs after the shell's
    `prevActive`.
  - **On the profile (row delete):** there is no General band. After a row delete, move focus to a
    **stable profile anchor** — the **"My curations" / "Curated clips" `<h2>`** (give it `tabindex=-1`
    and focus it post-close, the same `focusBandHeading()` shape but targeting the profile's list
    heading). If the deleted row was the **last** clip, the list becomes the **empty** state (§3.3) —
    the heading is still present (the count updates / the empty line replaces the list); focus the
    heading. Never leave focus on `<body>`. (Dev: a small `focusListHeading()` analog of
    `focusBandHeading()` on the profile page.)
  - The infobox/topic counts behavior on the Topic page is D2's and unchanged (deleting a General clip
    drops the videos/creators/curators counts; last clip flips the page empty→... — but a General-only
    topic flipping to empty is the existing `mode` switch).

### 9.5 Never on logged-out / others' / `@prototype` (AC7 / AC8)
Restated for the two new surfaces: the affordance is shown **only** for the signed-in owner. The
**server-side id-based gate** (`updateClipAction` / `deleteClipAction`) is the authoritative control
and is **unchanged**; a non-owner / anonymous direct action call is rejected server-side regardless of
any button (AC8 — QA verifies at the action). This spec designs the affordance; it never claims the
hidden button protects data.

---

## 10. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Brand indigo `#676EB4`** — the profile identity-header is on a light surface (no indigo band
  needed); the avatar-fallback gradient (`from-brand to-violet`) and the curator-note left border are
  the existing indigo uses. The General band stays indigo (existing).
- **Action blue `#1F6F95`** — the **"context by" link** tone on **light** surfaces (the card footer,
  the profile's "On <Topic>" link) and the internal-link tone generally. It is the IN-link color,
  distinct from the OUT creator credit (which is the card's ink/name treatment, no underline on light
  + new-tab). On the **indigo band** the "context by" link is **white + underline** (the underline,
  not a color shift, carries "link" on indigo — AA-safe; §6.3).
- **Sprout/teal `#2A8270`** — not a D3 signal.
- **Ink `#2C2C2C`** / **ink2** / **muted** — borders (`border-ink` ring on the avatar, the card
  hairline), body text, the "context by " prefix and the "On" prefix (muted), the not-found/empty
  copy (ink2).
- **`accred` red `#C44949` (→ `#B83A3A` for white-on-red)** — the **Delete** destructive signal on the
  new General-tile + profile owner rows, exactly as D2 (the word "Delete" is the signal; red
  reinforces; the confirm dialog's `Delete clip` uses the AA-safe darkened red). Reused unchanged.
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional/signal color, and
  must never be enlisted for the attribution link, the profile identity, the owner affordances, or
  any D3 signal.
- **Non-color rule (CURATION §4, AC21):** every D3 signal is text-carried — the attribution is the
  **words "context by <username>"** + the **underline** marking the link (never color-alone); the
  `@prototype` provenance is the **words "seed clip · no curator"**; the owner affordances are the
  **words "Edit" / "Delete"**; the not-found/empty are their **sentences**. The IN-vs-OUT distinction
  is carried by the **words + the direction + the placement**, not by color alone. Color only
  reinforces.

---

## 11. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive. D3 surfaces collapse to a single readable column narrow:
- **The profile route** is a single centered column at every width (`max-w-[760px]`); on a phone it
  is full-width with `px-5` margins. The identity header stacks naturally (avatar over / beside the
  `<h1>` — keep avatar + username on one row if it fits, wrap below if not). Each clip row is a
  full-width `plus-card`; the thumbnail, chips, note, and the "On <Topic>" link all reflow as the
  topic clip card does narrow. No horizontal scroll at ~390px.
- **The "context by" attribution** on the `ClipCard` footer wraps with the footer; the link target is
  a comfortable tap target (the link text + padding). On the `GeneralStrip` tile (a `w-44`
  horizontally-scrolling tile at all widths) the attribution is one short line that truncates/clamps;
  the owner action row (§9.2) wraps its two small buttons within the tile.
- **The owner action rows** (General tile + profile row) are `flex flex-wrap gap-1.5/2` — buttons wrap
  rather than overflow; each is a comfortable touch target (the `.srcbtn` padding gives ≥40px on the
  profile row; the tile's compact buttons stay ≥32px and tappable).
- **The header "My curations" menu item** is the Radix menu (already responsive; opens from the
  account trigger in both `topic-plus` ≥lg and `topic-compact` <lg, and the global header on the
  profile page).
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — the profile (all four states), the
  attribution on both surfaces, the General-band + profile owner affordances, and the header entry at
  each.

---

## 12. Accessibility requirements (consolidated — verifiable against AC1/AC2/AC5/AC6/AC7 / CURATION §4)

- **The profile route** — a proper document: an `<h1>` carrying the username (the page's accessible
  name); a `<main>` landmark for the content column; the clip list as `<ul role="list">` of
  `<li><article></article></li>`; each "On <Topic>" + creator link is keyboard-operable with a clear
  accessible name; the global `:focus-visible` 3px indigo ring applies. The **not-found** and
  **empty** states are honest, named pages (an `<h1>` / a clear sentence), never a blank or a
  stack-trace. The **loading** state announces "Loading profile…" (`role="status" aria-live="polite"`,
  sr-only) and never flashes "No such contributor".
- **The avatar** — granted image: `alt=""` (decorative; the username carries identity — no redundant
  alt). Fallback gradient: `aria-hidden`. No broken-image, no layout shift when absent (AC2 graceful).
- **The "context by" link** — a real `<a>`, Tab-reachable, Enter activates; visible text **"context by
  <username>"**; `aria-label="context by <username>, view their curations"` (verbatim, CURATION §5.4);
  the **underline** marks it a link (never color-alone); AA contrast — `text-action` on light
  (≈5.5:1, pass), white-underline on the indigo band (white text is large-enough/underlined; the
  underline is the link cue independent of contrast). The non-linked `seed clip · no curator` is a
  plain `<span>`, no interactive role.
- **The "My curations" menu item** — a Radix menu item (roving tabindex, Enter/Space activates, Esc
  closes); text-labeled; appears only signed-in (AC5).
- **The owner affordances** (General tile + profile row) — native `<button>`s, text-labeled ("Edit" /
  "Delete"), Tab-reachable, Enter/Space activates, focus-visible; owner-scoped `aria-label`s ("your
  curation"); render only for the signed-in owner (§9.1); never color-alone (the word + the confirm
  dialog carry the destructive meaning; the `accred` reinforces). Reused D2 modals carry their own
  a11y (dialog role, focus trap, Cancel-as-default on delete).
- **Focus after delete** — moves to a stable anchor: the General band heading (Topic page) or the
  list `<h2>` (profile); never lost to `<body>` (§9.4).
- **Contrast (AA, binding)** — the "context by" link on both surfaces (light `text-action` and
  indigo-band white-underline); the chip fills per `topic-page-v1.md` §9.3 (reused, unchanged); the
  `accred`/`#B83A3A` Delete per §10; the muted prefix/descriptor and ink2 not-found/empty copy on
  their backgrounds (QA spot-checks the smallest text).
- **Responsive** — every D3 surface operable by keyboard and touch at ~390px (§11).
- **No per-user work on the read path (AC9)** — restated as an a11y/perf invariant: an anonymous
  reader's topic render is unchanged; the attribution is static markup; the owner affordance is the
  already-authenticated session compare; the profile reads run only on the profile route.

---

## 13. Deltas from the committed baselines (Dev: build these on top)

The committed `topic-page-v1.md` baseline + the D1/D2 surfaces stand. D3 changes exactly these points;
everything else is unchanged.

1. **New route `app/contributor/[username]/`** rendering the public profile with the four states
   (§3): **populated** (identity header §4 + clip list §5), **empty** (§3.3), **not-found** (§3.4 —
   also the `@prototype` case, AC4), **loading** (§3.5). Anonymous; reads
   `getContributorByUsername` + `listClipsByContributor` through the seam. *(AC1, AC2, AC3, AC4.)*
2. **The public identity header** (§4): avatar (granted → `alt=""`; absent → gradient-initial
   fallback, graceful) + username `<h1>` + "Curator on wiki+" descriptor. **Never** email or any
   non-public field. *(AC2.)*
3. **The curated-clip list with topic context** (§5): each row = `plus-card` with the **"On <Topic>"
   link** (`topicHref`, §5.1) + thumbnail + **creator credit (links OUT, §5.2)** + chips + context
   note. The per-row "context by" attribution is **suppressed** on the profile (§5.4 — identity is in
   the header). *(AC1.)*
4. **The "context by <curator>" attribution** (§6) — a shared element (verbatim **"context by
   <username>"**, accessible name **"context by <username>, view their curations"**) added to the
   **`ClipCard`** footer (evolving the decorative `{curatedBy}` provenance line, §6.2) and the
   **`GeneralStrip`** curated tile (white-underline on the indigo band, §6.3). Links IN to
   `/contributor/<username>`; **distinct from the §5.2 creator credit** (OUT — §6.4). The
   **`@prototype`** clip shows the non-linked **`seed clip · no curator`** label, no link. *(AC6.)*
5. **The "My curations" header entry** (§7): a `DropdownMenu.Item` in `AuthControl`'s `SignedIn` menu,
   **signed-in only**, above "Sign out", navigating to the viewer's own `/contributor/<own-username>`.
   The owner-viewed profile reframes to "My curations" + surfaces the owner affordances (§7.3).
   *(AC5.)*
6. **Owner Edit/Delete on the `GeneralStrip` tile** (§9.2) — the D2 affordance + `EditModal` /
   `DeleteConfirmDialog`, owner-only, with new `onEdit`/`onDelete` props wired to `TopicView`'s
   existing handlers; post-delete focus → `focusBandHeading()`. *(AC7.)*
7. **Owner Edit/Delete on the profile clip list** (§9.3) — the same D2 affordance on each owned row;
   post-delete focus → the profile list `<h2>` (a `focusListHeading()` analog, §9.4). *(AC7.)*
8. **No change to:** D2's server-side ownership gate (the security control — AC8), the chip label map
   + AA fills (`topic-page-v1.md` §9), the reader-facing clip-card content, the creator credit (§5.2,
   links OUT), the curate/add/edit/delete modals' internals, the scroll-sync, the article side, and
   the cached topic read path (no per-user work — Decision 5/AC9; the attribution is static markup,
   the owner-affordance is the already-authenticated client-session compare).

---

## 14. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | Profile lists a contributor's clips with topic context | §3.2, §4, §5 |
| AC2 | Public identity only; never email; avatar graceful | §4, §12 (avatar a11y) |
| AC3 | Unknown username + empty profile resolve cleanly (no 500) | §3 (table), §3.3, §3.4, §3.5 |
| AC4 | `@prototype` has no browsable profile | §3 (table), §3.4, §6.1 (non-linked label) |
| AC5 | Signed-in reaches own my-curations; signed-out has no entry | §7 |
| AC6 | "context by <curator>" links to profile, distinct from creator credit; `@prototype` non-linked | §6 (esp. §6.1, §6.4) |
| AC7 | Owner edits/deletes ALL owned clips incl. General-filed | §9 (esp. §9.2, §9.3, §9.4) |
| AC8 | Server-side ownership gate unchanged (security control) | §9.1, §9.5 (server is Dev/QA) |
| AC9 | No per-user work on the cached topic read path | §2, §9.1, §12 (invariant) |
| AC10 | Build/typecheck/test green; new reads + General edit/delete tested | (Dev/QA — no design blocker) |
| AC11 | ARCHITECTURE records the as-built route + what's public | (Dev — docs-as-built) |

---

## 15. What UX will evaluate at Phase 4

Against this spec **and** the stories (S21–S26), on the running prototype with the session stubbed
signed-in where needed (the C/D1/D2 pattern — no live OAuth in CI):
- **The public profile (AC1/AC2):** visiting `/contributor/<username>` anonymously shows the
  identity header (username + granted avatar, graceful when absent) and the clip list — each row with
  its caption, **creator credit (links OUT)**, chips, context note, and the **"On <Topic>" link** to
  the Topic page. **No email** anywhere in the page (markup + view-source). The clips shown are
  exactly that contributor's.
- **Every state (AC3/AC4):** an unknown username → a clear "No such contributor" page (not a crash);
  a real contributor with zero clips → the coherent empty profile ("…hasn't curated any clips yet.");
  `/contributor/@prototype` → the not-found / non-profile state, **no** browsable stub profile; the
  loading state never flashes "not found."
- **"context by" attribution (AC6/S22):** on a curated `ClipCard` and a curated `GeneralStrip` tile,
  the **"context by <username>"** attribution renders and links IN to the profile; it is **visually +
  textually distinct** from the §5.2 creator credit (which links OUT) — a reader can tell "who made
  the video" from "who wrote the note." A `@prototype` clip shows the non-linked **"seed clip · no
  curator"** label, no link. The accessible name is "context by <username>, view their curations."
- **My curations (AC5/S23):** signed-in, the header menu offers **"My curations"** → lands on the
  viewer's own profile, reframed as "My curations" with the owner affordances; signed-out, **no** such
  entry.
- **Owner edit/delete on General + profile (AC7/S24):** an owner sees Edit/Delete on a **General-filed**
  clip's tile and on every row of their own profile; Edit reuses the D2 modal in place; Delete reuses
  the D2 confirm and removes with no reload; **focus lands on a stable anchor** (the band heading on
  the topic page, the list `<h2>` on the profile), never `<body>`; the affordance is absent
  logged-out, on others' clips, and on `@prototype` clips.
- **A11y in practice:** the profile is a proper named document (h1 = username; main landmark; list
  semantics); the attribution link + the menu item + the owner affordances are keyboard-operable and
  focus-visible; the avatar alt is correct (empty for granted, hidden for fallback); AA contrast on
  the "context by" link (light + indigo-band); operable at ~390px.
- **Indigo Press fidelity:** brand/action/ink palette; gold unused; the "context by" IN-link styled
  distinct from the creator OUT-credit; signals text-carried (§10).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is
distinct from QA & Review's correctness/security pass — UX asks "does it match intent and feel right";
QA verifies the privacy projection AC2 and the server-side ownership gate AC8 at the read/action.)
