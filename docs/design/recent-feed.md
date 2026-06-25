# wiki+ — Recent curations feed (`/recent`) — design spec

**Role:** UX / Design · **Status:** Buildable design contract — written BEFORE implementation, the
input to Development · **Issue:** #160 · **Phase:** prototype.

The first **non-topic-centric** surface in wiki+: a single, full-viewport vertical scroll of the
clips most recently **curated** onto topics across the whole site, **newest first**. A reader
discovers great curations — and the curators behind them — without starting from a specific topic,
then jumps to a topic and curates. It is a flywheel driver: *browse great curations → find a topic →
curate.*

It is **not** a bare video feed. Each item is a **curation**, shown with its full wiki+ trust layer:
the human-written context note, the fact-vs-opinion chips, the creator credit, "context by
@curator," and a jump-to-topic link. The trust layer is what distinguishes wiki+ from any
short-video app, so it travels with every clip wherever the clip appears.

**This spec covers the BASE feed with CLICK-TO-PLAY playback.** Opt-in autoplay-on-scroll is a
separate follow-up and is **out of scope** here (§12). Also out of scope: filtering / sorting beyond
newest-first, personalization / "for you," and any write action from inside the feed.

---

## 1. Personas & user stories

### 1.1 Personas served

- **The discovery reader (primary, logged-out or logged-in).** Arrives without a topic in mind —
  from the home page, a shared link, or curiosity. Wants to *graze* curated short videos and decide
  what's worth their attention. They do not necessarily intend to curate; the feed must be useful as
  pure browsing. This is the same self-directed learner the wiki+ panel's value line serves on the
  Topic page, met here cross-topic.
- **The prospective curator (logged-in or about-to-log-in).** Browses the feed, sees what good
  curation looks like, recognizes a topic they know, and follows the jump-to-topic link to go
  curate. The feed is where they catch the habit. **They do not curate *from* the feed** — every
  write action lives on the topic page; the feed routes them there.
- **The returning curator (logged-in).** Checks "what's new across the site" — a pulse of recent
  community activity, newest first. Recognizes their own and others' work.

### 1.2 User stories

1. *As a discovery reader, I want a single scroll of recently-curated clips so I can browse great
   video across all topics without picking one first.*
2. *As a discovery reader, I want each clip shown with its context note and fact-vs-opinion chips so
   I can weigh what I'm watching — the same trust layer I'd get on a topic page.*
3. *As a discovery reader, I want to play a clip with one deliberate tap (not have five videos
   autoplay at me) so I stay in control of what's loading and making sound.*
4. *As a prospective curator, I want a clear "go to this topic" link on each item so a clip I like
   leads me to the place I can curate.*
5. *As a prospective curator, I want to see who wrote the context note ("context by @curator") so I
   can recognize the people doing the work and follow their other curations.*
6. *As a logged-out reader, I want the whole feed to be browsable without an account, and I want to
   see how many people upvoted a clip as honest social proof — but I expect the upvote/curate
   controls to live on the topic page, not be dangled in the feed.*
7. *As a keyboard / screen-reader user, I want to move through the feed item by item, play a clip
   with Enter/Space, and have every signal carry a word (never color alone).*
8. *As any reader, I want the feed to keep loading as I scroll (newest first, no pagination
   buttons to hunt for) and to tell me honestly when it's loading, when it's empty, and when it
   broke.*

These stories feed Product's acceptance criteria; reconcile there rather than duplicating.

---

## 2. The feed item — anatomy

A feed item is **one curated `Clip` carried out of its topic** (the data shape is the existing
`ContributorClip` — a `Clip` plus `topicTitle`; `topicQid` already rides on `Clip`). It needs the
parent topic title + QID for the jump-to-topic link, exactly what `ContributorClip` already models.
**No data-model change is required for the item.** (The feed-level cursor query is §3.4.)

Each item is a **full-viewport "stage"** split into two regions, composed top-to-bottom on mobile
and side-by-side on wide viewports (§9):

- **The video stage** (the hero): a poster/thumbnail with a play affordance; on play it becomes the
  embedded player in place (§3.2). Embed-never-host: a click-to-load iframe facade.
- **The curation panel**: the shared **`CurationBlock`** (creator credit → held marking → stance +
  accuracy chips → full context note → "context by @curator"), plus a **jump-to-topic** affordance.

### 2.1 Reuse `CurationBlock` — do NOT redesign it

The curation panel **is** the existing shared `components/topic/CurationBlock.tsx`, rendered with
`signedIn` and **no `onJoin`** (see §6.4 — the feed shows no join nudge inside the block). This is
the single source of truth for the note / chips / creator credit / "context by" and must not be
re-typed or restyled. It already renders on a light card (white fill, 2px ink border) in the
Indigo-Press register; the feed places that card in the curation region of the item.

The block renders identically to the Topic page's `PlayerModal` and `MobilePlayerDock` — so a clip a
reader met in the feed carries the **same** trust layer if they later open it on its topic page. That
parity is the point.

What the feed **adds around** the block (not inside it):

- **The video stage** above/beside the block (§3.2).
- **A jump-to-topic affordance** (§2.4) — the feed's one feed-specific control.
- **Read-only upvote social proof** for logged-out readers and the read-only count generally (§6).

### 2.2 Reading order within an item (DOM + visual + focus order)

Top-to-bottom (mobile) / the equivalent reading order (wide, §9):

1. **Video stage** — poster + play button, or the playing iframe.
2. **Caption** — the clip's `caption`, bold, ≤2 lines (`line-clamp-2`). The caption sits with the
   curation panel (it is the clip's own title, distinct from `CurationBlock`'s creator credit). It
   is the item's accessible label anchor (§8.2).
3. **`CurationBlock`** — creator credit · held marking (only if held) · stance + accuracy chips ·
   full context note · "context by @curator." Rendered whole, unmodified.
4. **Jump-to-topic** affordance — "Curated on **{Topic}** →" (§2.4).
5. **Upvote count** — read-only social proof when the count > 0 (§6.2); a `count === 0` clip shows
   no figure.

The caption + jump-to-topic + count are the feed's wrapper; (3) is the shared block verbatim.

### 2.3 Vertical (9:16) vs. landscape (16:9) — the letterbox

Many curated clips are **16:9, not 9:16** (the feed is cross-platform: YouTube explainers, TikTok
shorts, etc.). They **letterbox** in the vertical feed. Accepted for v1 — design the letterbox
cleanly, never crop the video and never distort it.

- **The video stage has a fixed maximum frame box** sized to the viewport (§9). The clip's frame
  sits **centered within the stage on a solid black backing** (`bg-black`), letterboxed:
  - **9:16 vertical** → the frame is height-capped to the stage height and centered; black bars
    left/right when the stage is wider than 9:16 (common on wide viewports / tablet).
  - **16:9 landscape** → the frame fills the stage width at 16:9 and is centered vertically; black
    bars top/bottom within the stage on mobile (the stage is taller than 16:9).
- This reuses the established cap mechanic from `MobilePlayerDock` / `PinnedPlayer` (a `[aspect-ratio]`
  frame, `mx-auto`, `bg-black` backing) — the same `clip.orientation` discriminant drives it. **Do
  not invent a new sizing system**; lift the orientation→frame logic from those components.
- **Letterbox bars are pure black, no chrome** — the trust layer lives in the curation panel below
  (mobile) / beside (wide), never overlaid on the video. The video stage stays a clean picture.
- The poster (pre-play) uses the same frame box + black backing, so play does not resize the stage
  (no layout jump). Use `clip.thumbnailUrl` with the `clip.thumbGrad` gradient fallback (the
  existing `VideoThumb` fallback behavior).

### 2.4 Jump-to-topic affordance

Each item carries **one** link to the clip's parent topic page — the feed's flywheel hinge.

- **Label (microcopy):** `Curated on {topicTitle}` with a trailing `→` glyph (`aria-hidden`). The
  topic title is the link's distinctive text. Accessible name: `Go to the {topicTitle} topic`.
- **Href:** the canonical title-based topic route, `/topic/{topicTitle}/` (the same canonical
  `/topic/<Title>/` form the contributor profile's "On {Topic}" link builds — reuse that helper;
  underscores/encoding handled there).
- **Placement:** directly **below the `CurationBlock`** in the curation panel, as a distinct row so
  it reads as "this curation lives here, go see it." Indigo-Press treatment: a text-forward link in
  the `action`-blue link tone (`text-link`) on the light panel, with the project's visible focus
  ring; **not** a heavy button (it competes with nothing — it is the one navigational control).
- It is a real `<a>` (an `<Link>`), keyboard-focusable, in normal tab order, **never** color-alone
  (the word "Curated on {Topic}" carries the meaning).
- **Why a link, not a write action:** curate/upvote/dismiss are topic-page actions (§6). The feed's
  only forward motion is *to the topic*, where the participation surfaces live. This keeps the feed
  honest as a discovery surface and routes intent to where it belongs.

---

## 3. The scroll model & playback

### 3.1 Full-viewport vertical snap-scroll

The feed is a **single vertical column of full-viewport items** with **scroll snap**, so each item
settles into view one at a time — the short-video grazing gesture, reframed around curations.

- The scroll container is a vertical, **mandatory-snap** track (`scroll-snap-type: y mandatory`);
  each item is a snap stop (`scroll-snap-align: start`) sized to the **usable viewport height** below
  the sticky header (§9 gives exact heights per breakpoint). Use `100dvh` (dynamic viewport height)
  minus the header so mobile browser-chrome show/hide does not mis-size items.
- **Snap is mandatory on touch/wheel but must never trap the keyboard or AT** — `Tab` moves through
  focusables in source order regardless of snap; arrow-key / Page navigation scrolls normally and
  snap simply settles the result. Snap is a settling behavior layered on ordinary scrolling, not a
  custom scroll hijack. **Do not** build a JS wheel-jacking carousel.
- **`prefers-reduced-motion`:** the snap *settle* is a browser scroll behavior, not our animation, so
  it is acceptable under reduced motion; but **any** smooth-scroll we trigger programmatically (e.g.
  focus-into-view on keyboard nav, §8.3) must respect `prefers-reduced-motion: reduce` and jump
  instead of animate. No parallax, no item entrance animation.
- **One item ≈ one viewport.** A 16:9 clip letterboxes within its stage (§2.3) so the item height is
  stable regardless of orientation; the curation panel takes the remaining height and **scrolls
  internally** if a long note exceeds it (the panel is the item's sole internal scroll region — the
  video stage never scrolls). This mirrors the `MobilePlayerDock` "frame pinned, body scrolls"
  discipline.

### 3.2 Click-to-play (the embed facade)

**No video loads or plays until the reader explicitly plays it.** Each item's stage is a poster with
a play affordance; on activation the poster is replaced **in place** by the embedded iframe player.

- **The play affordance** is a real, full-stage `<button>` overlaying the poster: a centered play
  glyph (`▶`, `aria-hidden`) with an accessible name `Play: {caption}`. The whole poster is the
  target (large tap area), keyboard-focusable, Enter/Space activates. The project's visible focus
  ring applies.
- **On play:** mount the iframe with `src = embedUrl + autoplay=1` (autoplay is honest — the user
  clicked), `allow="… autoplay …"`, **`allowFullScreen`** — the **exact** iframe attributes used by
  `PlayerModal` / `PinnedPlayer` / `MobilePlayerDock`. Lift them verbatim; do not author a new embed.
  The iframe replaces the poster within the same frame box, so there is **no layout shift**.
- **Embed-never-host facade preserved:** the iframe is created on the play click and torn down when
  the reader plays a different item or the item leaves the active window (see §3.3). No iframe exists
  on initial render.
- **Fullscreen** is the embed's **own native button** inside the iframe (`allowFullScreen` stays) —
  no custom maximize control, consistent with the player components. On a phone, rotating to
  landscape is the reader's path to a bigger picture via the native control; the feed itself does not
  add a maximize affordance.
- **Non-embeddable / no `embedUrl`:** a curated clip may lack an `embedUrl` (e.g. TikTok, or an
  unresolved add-by-link clip). For those, the stage's play affordance is a **link-out**: a
  full-stage `<a href={watchUrl} target="_blank" rel="noopener">` labeled `Watch on {platformLabel}
  ↗` (accessible name `Watch on {platformLabel} (opens in a new tab): {caption}`). The poster shows a
  small `↗ {platformLabel}` corner pill (a word, never glyph-alone) so the reader knows it leaves the
  site. The curation panel (note + chips) renders fully regardless — the note is worth reading even
  when the clip can't be embedded in place (the same principle `PlayerModal` follows).

### 3.3 Single active player

At most **one** clip plays at a time, to keep the reader in control (story 3) and to avoid stacking
iframes.

- **Playing a second clip stops the first**: tearing down the prior iframe (back to its poster) when
  a new item is played. This is the feed analog of the players' single-instance guarantee.
- **Optional (recommended) auto-pause on scroll-away:** when a *playing* item is scrolled out of the
  snap window (no longer the active item), tear its iframe down back to the poster, so audio never
  trails from an off-screen clip. This is **not** autoplay (the next item does **not** auto-start —
  that is the out-of-scope follow-up); it is only "stop the one the reader walked away from." Dev may
  implement this via an `IntersectionObserver` on the active item. If deferred, the single-active
  rule (stop-prior-on-new-play) is the minimum bar.

### 3.4 Cursor-based infinite scroll / load-more

The feed loads **newest first** and **pages by cursor** — never an offset (offset drifts as new
curations arrive; a cursor is stable).

- **Data:** a new store read, e.g. `listRecentCurations({ cursor?, limit })`, returning
  `{ items: ContributorClip[], nextCursor: string | null }`. Items are ordered by curation recency
  **newest first** — the natural ordering key is the clip's creation/curation time plus the clip id
  as a stable tiebreaker; the cursor encodes `(curatedAt|createdAt, id)` of the last returned item.
  This is a **Development** detail to finalize against the schema (see Open Questions §11); the design
  requires only: newest-first, stable cursor, a bounded page (suggest **`RECENT_PAGE_DEFAULT = 12`**),
  and `nextCursor: null` when exhausted. Only **curated, non-removed, non-held-hidden** clips appear
  per the same visibility rules the topic read uses (held clips: see §11). Removed (`removed_at`)
  clips never appear.
- **Trigger:** an `IntersectionObserver` **sentinel** placed a screenful before the end of the
  loaded list fetches the next page when it scrolls into view — no "Load more" button to hunt for in
  the grazing gesture. **But** also render a **keyboard/AT-reachable fallback control** (§3.5 / §8) so
  non-scroll users and a failed observer are never stranded.
- **Append, never reorder:** new pages append below; already-rendered items never move (a playing
  item is never yanked by a load). A page load adds items; it does not re-key existing ones.
- **End of feed:** when `nextCursor` is null, render a quiet **end-of-feed marker** as the final
  snap stop (§4.4) — never an infinite spinner.

### 3.5 Load-more affordance & its states

The sentinel is invisible; the *visible* affordance at the tail of the list is a small status
region that doubles as the keyboard fallback:

- **Idle / more available, observer-driven:** no visible button needed during normal scroll, but a
  **"Show more curations"** `<button>` is always present at the tail (visually quiet, full-width on
  mobile) so keyboard/AT users and a stalled observer have a real control. Activating it fetches the
  next page (same path as the sentinel).
- **Loading more:** the tail region shows **"Loading more curations…"** with `aria-busy="true"` and
  `aria-live="polite"`, and the "Show more" button is disabled while in flight.
- **Error on load-more:** the tail shows **"Couldn't load more — Try again"** where *Try again* is a
  real `<button>` re-running the same fetch (§4.3). Already-loaded items stay; the reader keeps what
  they have.
- **End:** the tail becomes the end-of-feed marker (§4.4); the "Show more" button is removed.

---

## 4. Every state, with microcopy

The feed has **two scopes of state**: the **whole-feed initial state** (the first load) and the
**tail / load-more state** (§3.5). All copy below is the buildable contract — use it verbatim.

### 4.1 Loading (initial)

The first page is loading and there are no items yet.

- A centered, full-viewport **loading panel**: copy **"Loading recent curations…"**, with
  `aria-busy="true"` on the feed region and an `aria-live="polite"` announcement of the same text.
- Render **2–3 skeleton item placeholders** (a black stage box + a light note-card silhouette) under
  the announcement so the layout reads as the feed, not a blank page. Skeletons use the existing
  shimmer; under `prefers-reduced-motion: reduce` they are **static** (no pulse) — match the
  `GeneralStrip` skeleton discipline.
- The header (§5) renders immediately (it is not gated on the data).

### 4.2 Empty (no curations site-wide yet)

The read succeeded and returned **zero** items — no clip has been curated on any topic yet (the true
bootstrap state of a fresh site).

- A centered, full-viewport **empty panel** in the Indigo-Press light register (white card, 2px ink
  border, offset shadow):
  - **Heading:** **"No curations yet"**
  - **Body:** **"The recent feed shows videos as people curate them onto topics across wiki+. Be the
    first — find a topic and add a video with a context note."**
  - **Primary action:** a brand-fill button **"Find a topic →"** linking to **`/`** (the home page,
    where the topic search lives). This is the honest path: you curate *on a topic*, so the empty
    feed sends you to find one. (Do not invent a feed-level "add video" — the feed has no topic to
    add to.)
- This mirrors the home page's empty "Recently curated" voice ("No topics curated yet — be the first
  by searching for one above") so the two surfaces read as one product.

### 4.3 Error (initial read failed)

The first read threw (DB down, etc.) — show an honest line, never hang on "Loading…" forever (the
home page's read-error floor discipline).

- A centered, full-viewport **error panel** (same light card treatment):
  - **Heading:** **"Couldn't load the feed"**
  - **Body:** **"Something went wrong loading recent curations."**
  - **Action:** a **"Try again"** `<button>` that re-runs the initial fetch. (A button, not just
    "refresh the page" prose, so it is one keyboard action.)
- No skeletons, no spinner-forever. The header still renders.

### 4.4 Populated (the normal feed) + end marker

- One full-viewport item per curation (§2), newest first, snap-scrolled (§3.1), click-to-play (§3.2),
  paged by cursor (§3.4).
- **End-of-feed marker** (final snap stop, when `nextCursor` is null): a quiet centered panel:
  - **Text:** **"You're all caught up."** with a secondary line **"That's every curation, newest
    first."**
  - **A "Back to top" `<button>`** that scrolls (or jumps, under reduced motion) to the first item
    and moves focus to it (§8.3), so the reader is never stranded at the bottom.
- **Tail / load-more states** are §3.5 (loading-more / error-more / end).

### 4.5 State precedence

`error (initial)` > `loading (initial, no items)` > `empty (0 items)` > `populated`. The tail states
apply only once `populated`.

---

## 5. The header & the entry point

### 5.1 The universal projector header — adopt, do not fork

`/recent` uses the **universal `SiteHeader` with `host="page"`** (the content-page host:
`components/header/SiteHeader.tsx`). This is the exact host built for non-Topic content pages
(`/about/data`, `/contribute`, `/contributor`): the same continuous Tier-A beam → slim Tier-C
collapse as Topic, **no** search slot, **no** seam-on-divider, **no** title cue — just the projector
beam (self-contained lockup, centered desktop / left at narrow) and a single right-anchored
`AuthControl`, plus the beam-landing page surface for free. **Do not** fork a bespoke header or build
a feed-specific one (CLAUDE.md "the projector header is universal"; `VISUAL_IDENTITY.md` §10.1).

- Auth slot: `<AuthControl variant="home" />` (the right-anchored skin `host="page"` expects — the
  same node the other content-page hosts pass).
- The wordmark is the home link (`href="/"`), per the host.
- **Sticky header + the snap track:** the `host="page"` header is `sticky top-0 z-40`. The feed's
  full-viewport items must size to **the viewport minus the slim-bar height** so the first item is
  not hidden under the header and snap stops land cleanly. Use `100dvh - {SLIM_BAR_HEIGHT}` for the
  item/track height at the collapsed state (the header collapses to `SLIM_BAR_HEIGHT = 56px` as the
  reader scrolls; size the snap stops to the collapsed bar so items don't jump as the beam recedes —
  Dev: the `host="page"` beam band is 104px at top and collapses to 56; size the snap track to the
  56 slim bar and let the first item's top clear the full band, consistent with how the page beam
  lands on the page top). Confirm in the screenshot matrix that the first item is fully visible at
  scroll-top and after collapse.

### 5.2 Entry point — recommendation (UX owns final placement)

**Primary recommendation: a persistent "Recent" link in the universal header's right cluster, beside
the `AuthControl`, on every page.**

Rationale:

- `/recent` is a **top-level destination**, not a topic-scoped one — it deserves a site-wide,
  always-reachable entry, the way a publication's "Latest" lives in the masthead. The universal
  header is the one chrome every view already has, so a header entry reaches the feed from anywhere
  (home, any topic, any content page) without forking navigation.
- The header today carries only the wordmark (home), an optional search, and one `AuthControl`. A
  single **"Recent"** text link in the right cluster (left of the auth control) is a small, legible
  addition that respects the projector header's restraint — **one word, no icon-only signal**,
  `text-link` tone with the visible focus ring, accessible name `Recent curations`.
- **This is a shared-header change**, so it must land in `SiteHeader` (and show on every host), not
  in the feed page. Because it touches the universal header, treat it as a **broad/shared UI change**
  for the screenshot baseline (§10) and flag it to Development as the one cross-cutting piece of this
  issue. **Open question for Product/Dev** (§11): whether to ship the header link in this issue or
  land `/recent` first and add the masthead link as a fast-follow. The feed is fully reachable by URL
  regardless; the header link is the discoverability layer.

**Secondary entry (recommended, low-cost, ship in this issue):** a link from the **home page**. The
home page already has a **"Recently curated"** topics section (`app/page.tsx`); add a **"See all
recent curations →"** link beside or beneath that section's `<h2>`, linking to `/recent`. This is a
natural, in-context bridge: the home section shows recently-curated *topics*; the feed shows recently
curated *clips*. The two are complementary, and the home link gives the feed a discoverable front
door even if the header link is deferred. Accessible name: `See all recent curations`.

**Not recommended:** a topic-page entry point. The topic page is topic-scoped; a cross-topic feed
link there would muddy its focus. The header (site-wide) + home (the discovery hub) are the right
homes.

---

## 6. Logged-out model & social proof

The feed is **browse/discovery — fully accessible logged-out** (no login wall). It follows the
Topic page's logged-out reader model (`TOPIC_PAGE_DESIGN.md` §"Logged-out reader model"): browsing
reads as reading; **no per-item action controls** live in the feed for anyone, logged-out or
logged-in, because **upvote / curate / dismiss are topic-page actions** (issue scope: "NO action
controls — upvote/curate/dismiss live on the topic page, not the feed").

### 6.1 No action controls in the feed (everyone)

- **No upvote toggle**, no curate button, no dismiss, no owner/reviewer manage rows in a feed item —
  for **any** viewer. The feed item is a read/watch surface. Participation is one jump-to-topic away
  (§2.4), where every control already lives.
- `CurationBlock` is rendered **without** `onJoin` (§6.4), so even the modal's logged-out join nudge
  does not appear here — the feed's "join" path is the jump-to-topic link + the header auth.

### 6.2 Upvote count as read-only social proof

The upvote **count** may show as **read-only social proof** (issue scope), matching the Topic page's
logged-out treatment of the count:

- Show the count as a **static, non-interactive, unfocusable** label, honestly pluralized:
  **"{n} upvotes"** (or **"1 upvote"**). A clip with **count 0 shows no figure** (no "0 upvotes").
- It is a label, **not** a control: no underline (underline is the actionable cue), not in tab order,
  no `onClick`. Muted-ink on the light curation panel. The word "upvotes" carries the meaning.
- Placement: in the curation panel's tail row, alongside the jump-to-topic affordance (§2.2 item 5).
- This is the **same** read-only count the existing `UpvoteControl` renders in its logged-out/static
  presentation; reuse that read-only rendering rather than authoring a new label. (It must be the
  static, non-interactive form — the feed never shows the interactive toggle, even signed in.)

### 6.3 Logged-in is the same feed

A signed-in reader sees the **same** feed: still no action controls, still the read-only count, still
jump-to-topic. The only difference is the header `AuthControl` shows their identity. We deliberately
do **not** light up upvote/curate inside the feed when signed in — keeping the feed a pure discovery
surface and the topic page the single home for participation (it also keeps the cached read path
free of per-user work, consistent with the project's read-path principle).

### 6.4 `CurationBlock` props in the feed

Render `<CurationBlock clip={clip} signedIn={signedIn} />` with **no `onJoin`**. Passing `signedIn`
keeps the block honest about state, but with `onJoin` absent the block renders no join nudge (its
nudge is gated on `!signedIn && onJoin`). The block's creator credit, chips, note, and "context by"
are exactly as on the topic page.

---

## 7. Indigo-Press visual treatment

- The **video stage** is black (`bg-black`) with the letterboxed frame (§2.3) — a clean picture, the
  one dark surface per item.
- The **curation panel** is the Indigo-Press light register: the `CurationBlock`'s own white card
  (2px ink border) for the note/chips, on the page surface; the caption above it bold ink, the
  jump-to-topic link in `text-link` (action blue), the upvote-count label muted ink. **No gold** —
  gold is reserved for the wordmark only (palette rule).
- **Chips carry their own AA-safe fills** (the standard fact-vs-opinion chips) — the panel never
  re-tints them. Stance = indigo, accurate = teal, accurate-with-caveat = action blue, opinion group
  = red; each chip carries its text label (never color alone) per `lib/curation/labels.ts`.
- Item separation on wide layouts: a hairline/space between the stage and panel; on mobile the panel
  sits directly under the stage within the one viewport. **No** heavy borders around the whole item
  — the snap viewport already delimits items.
- Beam-landing: `host="page"` paints the beam-landing page surface; the first item's top sits on that
  illuminated page top, consistent with every content page.

---

## 8. Accessibility

Accessibility is baseline (CLAUDE.md). The snap-scroll feed + click-to-play must be fully operable by
keyboard and screen reader, AA-contrast throughout, with every signal text-labeled.

### 8.1 Structure & landmarks

- The feed is a **`<main>`** with a visually-hidden `<h1>` **"Recent curations"** (the document's
  one top-level heading, like the home page's `sr-only` `<h1>`).
- The feed list is a **`<ol>` / `role="list"`** (it is an *ordered*, newest-first sequence); each
  item is a `<li>`. Each item is a **`<section>`** (or `<article>`) with an `aria-labelledby` pointing
  at its caption, or an `aria-label` of the caption, so AT announces "{caption}, curation N of …"
  context. Use `<article>` per item — each is a self-contained syndicated curation.
- The tail status region (§3.5) is an `aria-live="polite"` region; the initial loading/empty/error
  panels announce via `aria-live="polite"` + `aria-busy` as specified in §4.

### 8.2 Focus order within an item

Per item, tab order is: **play affordance** (the stage button/link) → any focusable inside
`CurationBlock` (the creator credit link out, the "context by" curator link in) → **jump-to-topic
link**. The read-only upvote count is **not** focusable (§6.2). Source order equals visual order
equals tab order (the `MobilePlayerDock` DOM-order-equals-tab-order discipline).

### 8.3 Keyboard model for snap-scroll + click-to-play

- **Tab / Shift+Tab** moves through focusables in source order across items; snap never blocks it.
  When focus lands on a focusable in an item that is off the current snap, the browser scrolls it
  into view (programmatic scroll respects `prefers-reduced-motion`, §3.1).
- **Enter / Space** on the play affordance plays the clip (§3.2); on the jump-to-topic link
  navigates; on "Show more" / "Try again" / "Back to top" activates them.
- **Arrow keys / Page Up/Down / Space (when no control is focused) / Home / End** scroll the track
  natively; snap settles the result. We do **not** hijack these.
- **No focus trap** anywhere — the feed is a page, not a dialog. The playing iframe is inline content;
  focus is never stolen on play (no autofocus into the iframe), matching the non-modal player
  contract.
- **"Back to top"** (end marker, §4.4) moves focus to the first item's play affordance after
  scrolling, so a keyboard user is returned to the top of the feed, not dropped to `<body>`.
- A **"Skip to feed"** is unnecessary beyond the standard structure, but the header's existing skip
  affordances (if any) are unaffected.

### 8.4 Contrast & text-labeled signals

- White-on-black on the video stage chrome (the play glyph + the link-out pill) ≥ AA; the link-out
  pill carries the **word** `{platformLabel}` (never the `↗` glyph alone).
- The curation panel is the `CurationBlock`'s AA-verified light register; chips are AA-safe by their
  own fills.
- Every signal is a word: "Play: {caption}", "Watch on {platformLabel} ↗", "Curated on {Topic} →",
  "{n} upvotes", "Loading more curations…", "You're all caught up." Color and glyphs are never the
  sole carrier.
- Visible focus ring (the project `:focus-visible` ring) on every interactive element.

### 8.5 Motion

All programmatic scrolling, any skeleton shimmer, and any item transition respect
`prefers-reduced-motion: reduce` (jump, not animate; static skeletons). Snap *settling* is a native
behavior and is acceptable; we add no entrance/parallax motion.

---

## 9. Responsive behavior

Web-first, responsive. The feed item is one full-viewport stage at every width; the **stage/panel
arrangement** changes by breakpoint.

### 9.1 Mobile (`< md`, ~< 768px) — the canonical short-video feed

- **Stacked within the viewport:** video stage on top, curation panel below, together filling
  `100dvh - {header slim bar}`. This is the phone short-video grazing experience.
- **Video stage:** ~ the top 55–62% of the item height. 9:16 fills the stage height, centered,
  letterboxed L/R if needed; 16:9 fills the stage width, centered, letterboxed T/B. Cap a 9:16 frame
  so it doesn't consume the whole item and leave no room for the panel (reuse the
  `min(…vh, …px)`-style cap mechanic from `MobilePlayerDock`/`PinnedPlayer`).
- **Curation panel:** the remaining height; the `CurationBlock` note **scrolls internally** if it
  overflows (the item's sole internal scroll region — the stage stays put). Caption + jump-to-topic +
  count fit in the panel; a very long note scrolls.
- Snap is most valuable here — one curation per swipe.

### 9.2 Tablet (`md`–`lg`, ~768–1024px)

- Either the stacked mobile arrangement scaled up, **or** begin the two-column arrangement (§9.3) if
  the viewport is wide enough that side-by-side reads well. Recommended: **stay stacked through
  `md`**, switch to side-by-side at `lg`. Dev may tune the exact switch; the screenshot matrix is the
  check.
- The video stage gets more letterbox on a wide-but-short tablet for 9:16 clips; keep the frame
  centered on black.

### 9.3 Desktop (`≥ lg`, ~≥ 1024px) — side-by-side stage + panel

- **Two-column item:** the **video stage left** (the larger share), the **curation panel right** in a
  fixed-ish reading column (echoing the topic page's `1fr / 360px` rhythm — the panel a comfortable
  reading width, ~360–420px). The item still snaps as one full-viewport unit.
- The stage centers its letterboxed frame on black; a 16:9 clip is large and clean; a 9:16 clip
  letterboxes L/R within the stage column. The panel holds caption · `CurationBlock` · jump-to-topic
  · count, top-aligned, scrolling internally only if a very long note demands it.
- **Max width:** cap the item content at the standard `max-w-[1200px]` content width (the page chrome
  width) and center it, so the feed doesn't sprawl edge-to-edge on ultrawide; black stage backing can
  bleed or be contained — Dev's call, verified in the matrix. Prefer **contained** (the item is a
  centered composition, not a full-bleed video wall) for legibility of the panel.

### 9.4 Shared

- Use `dvh`, not `vh`, for item/track heights (mobile chrome).
- The horizontal page body must never scroll; any wide content (a long chip row, a long caption) wraps
  or is contained.
- The header collapse (§5.1) must not change item sizing mid-scroll in a way that breaks snap — size
  snap stops to the collapsed slim bar.

---

## 10. Screenshot matrix / baseline (evaluation evidence & PR gallery)

`/recent` is a **new surface**, so add **`Scene`s** to the scene catalog (`e2e/screenshots/catalog.ts`)
and capture them via `scripts/dev/shots.sh` — the standard matrix (surface/state × mobile/tablet/
desktop × logged-out/logged-in) is the UX-evaluation evidence and the PR gallery, and the committed
baseline gallery (`docs/design/ui-screenshots/`) must be refreshed in the same PR (CLAUDE.md "UI
screenshot gallery"). Scenes to add (at minimum):

- `recent-feed-populated` — a few items, top of feed (logged-out **and** logged-in).
- `recent-feed-populated-landscape` — an item whose clip is **16:9** (the letterbox presentation).
- `recent-feed-populated-vertical` — an item whose clip is **9:16**.
- `recent-feed-playing` — a clip after click-to-play (iframe mounted) if capturable; else the poster
  with the play affordance focused.
- `recent-feed-loading` — initial loading skeletons.
- `recent-feed-empty` — the no-curations panel.
- `recent-feed-error` — the initial-error panel.
- `recent-feed-end` — the end-of-feed marker.
- (If the header "Recent" link ships) refresh the **shared header** group across hosts (broad change
  → `--all --commit ui`, since the masthead changes on every surface).

Each scene at mobile / tablet / desktop, logged-out and logged-in. Because the entry-point link is a
shared-header change, the refresh is **broad** (`--all`) if it ships in this issue.

If the build session **cannot run chromium** (a cloud loop), the rendered gallery + baseline refresh
are **deferred to a chromium-capable run / CI** and flagged in the report + PR — never skipped
silently; the evaluation then judges against this spec + the geometry the code expresses.

---

## 11. Open questions for Development to resolve

1. **Recency key & cursor shape.** The feed orders by "most recently curated." `Clip.curatedAt` is a
   *decorative relative label*; the authoritative orderable field is the persisted creation/curation
   timestamp on the clip row (the same field `listClipsByContributor` orders by, "newest first"). Dev
   must confirm the exact column (`createdAt` / a `curated_at`) and build a **stable cursor**
   `(timestamp, id)` over it. The store method (`listRecentCurations({ cursor?, limit })` →
   `{ items, nextCursor }`) is new; the per-item shape is the existing `ContributorClip` (no model
   change). Page size: suggest `RECENT_PAGE_DEFAULT = 12`.
2. **Held clips in the cross-topic feed.** On a topic page, a **held** clip still shows (with the calm
   "In review · not yet vouched" marking) because the curator/moderator is in context. In a
   cross-topic public feed, should held-but-not-yet-vouched clips appear? **Design recommendation:**
   **exclude held clips from `/recent`** — the feed is the site's public "best recent curations"
   shopfront and should show **vouched** clips only; a held clip is not yet the site's vouch. (The
   `CurationBlock` still renders `held` correctly if Dev/Product decide to include them, but the
   recommendation is to filter `held` out at the query.) Product to confirm.
3. **Header entry-point timing** (§5.2): ship the universal-header "Recent" link in this issue, or
   land `/recent` + the home-page link now and add the masthead link as a fast-follow? The feed is
   URL-reachable either way; this is a scope call. Recommendation: ship the **home-page link** in this
   issue (low-cost, in-context) and the **header link** in this issue *if* the screenshot-baseline
   refresh budget allows the broad header re-shoot; otherwise fast-follow.
4. **Auto-pause on scroll-away** (§3.3): implement the `IntersectionObserver` auto-teardown of an
   off-screen *playing* clip in this issue, or ship the minimum single-active rule (stop-prior-on-new-
   play) and add auto-pause with the autoplay follow-up? Recommendation: implement auto-pause now (it
   is small and prevents trailing audio); it is **not** autoplay.

## 12. Out of scope (explicitly not designed here)

- **Autoplay-on-scroll** — the opt-in autoplay follow-up. This spec is click-to-play only.
- **Filtering / sorting** beyond newest-first; **personalization / "for you"** ranking.
- **Write actions from inside the feed** — no upvote toggle, curate, dismiss, edit, hold, approve, or
  remove in a feed item; all participation is on the topic page (§6).
- **Redesigning `CurationBlock`** — reuse it verbatim (§2.1).
- **Curator-profile feed / per-curator feeds** — `/recent` is the whole-site feed only.
