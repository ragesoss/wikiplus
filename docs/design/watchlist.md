# wiki+ — Watchlist: follow topics + the watchlist feed — design spec

**Role:** UX / Design · **Status:** Buildable design contract — written BEFORE implementation ·
**Issue:** #162 · **Spec:** `docs/specs/watchlist.md` · **Reuses:** `docs/design/recent-feed.md`
(#160 — the feed UI is reused verbatim, not redesigned) · **Phase:** prototype.

A signed-in reader follows the topics they care about (a **watch** toggle on the topic page) and
opens **`/watchlist`** — the *same* vertical curation feed as `/recent`, but sourced from only the
curations on their watched topics, newest first. This spec covers the **watch control** and the
**`/watchlist` route**; the feed body itself is the #160 `RecentFeedView`, reused and parameterized
by scope (do **not** rebuild it — `recent-feed.md` is the feed contract).

---

## 1. Personas & user stories

### 1.1 Personas served

- **The returning follower (signed-in, primary).** Knows a few topics they care about and wants a
  single place to see what's newly curated on *those* — not the whole site. The personal cut of the
  `/recent` discovery reader.
- **The prospective follower (about-to-log-in).** Browsing a topic, recognizes it as one they want to
  keep up with, taps "Watch." If logged out, the tap is their nudge to log in (the contribute
  flywheel) — watching ties the follow to their Wikimedia identity.

### 1.2 User stories

1. *As a signed-in user, I want to add a topic to my watchlist (and remove it) from the topic page so
   I can follow the topics I care about.*
2. *As a signed-in user, I want a `/watchlist` feed of the latest curations across all my watched
   topics, newest first, so I can keep up without visiting each topic.*
3. *As a logged-out reader, I want the watch control to invite me to log in (not silently fail or
   hide), and I expect `/watchlist` to ask me to log in rather than show a blank page.*
4. *As a new follower with an empty watchlist, I want a clear prompt to go find topics to watch, not
   an ambiguous empty screen.*
5. *As a follower whose topics have no new curations yet, I want an honest "nothing yet" state, not a
   broken feed.*
6. *As a keyboard / screen-reader user, I want the watch toggle to announce its state in words and the
   feed to be operable exactly as `/recent` is.*

These feed Product's acceptance criteria (`docs/specs/watchlist.md`); reconcile there.

---

## 2. The watch control (topic page)

### 2.1 Placement

The watch control lives in the **wiki+ overview panel (`Infobox`) foot**, as a dedicated row —
the same foot region that hosts the curator "Mark topic complete" toggle. It is the topic-level,
whole-page personal action, so the panel that summarizes the topic is its natural home (mirrors the
mark-complete precedent). It sits **above** the curator mark-complete control when both render (watch
is the broader, any-user action; mark-complete is the narrower curator action).

> Placement rationale vs. the topic header: the header is the universal projector mark (do not fork
> it — CLAUDE.md). A topic-scoped personal control belongs in the topic's own panel, not the site
> chrome. The overview panel foot already carries one topic-level toggle; watch joins it.

### 2.2 Affordance, states & microcopy (VERBATIM)

A single labeled action button (not a `role="switch"`/`aria-pressed` — a labeled action button is the
clearer model, matching the mark-complete precedent). The **word** states what tapping does.

- **Not watching (default, any viewer):** **"＋ Watch topic"** (the `＋` glyph is `aria-hidden`;
  the word "Watch topic" is the accessible name). `aria-label`: **"Watch this topic — follow it in
  your watchlist"**.
- **Watching (signed-in, after hydrate):** **"✓ Watching"** (the `✓` is `aria-hidden`). `aria-label`:
  **"Watching this topic — tap to remove from your watchlist"**. Visually the "active/on" state —
  a filled/brand-tinted treatment distinct from the quiet default (but never color-alone: the word
  "Watching" + the `✓` carry it).
- **In flight (optimistic):** the button shows a brief busy word — **"Adding…"** (watching) /
  **"Removing…"** (un-watching) — and is `disabled` to block a double-submit. The visual state flips
  optimistically; the busy word is momentary.
- **Helper line (under the not-watching button only):** **"Follow this topic to see its new
  curations in your watchlist."** Omitted once watching (the state is self-evident). `text-ink2`,
  small, plus-body.

The control renders **for every viewer** (discoverable; the flywheel). A logged-out tap opens the
login gate (§2.4) — it never optimistically flips for a logged-out reader (honest: the boundary would
reject it). The per-viewer "watching" state hydrates only in the signed-in session (§2.3), so a
logged-out (or not-yet-hydrated) render shows the default "＋ Watch topic".

### 2.3 Per-viewer state — off the read path

Whether *this* viewer watches *this* topic is **per-viewer** state. It hydrates only in the
already-authenticated client session, **after** the topic shell renders (the `votedClipIds` posture):
an anonymous load does zero watch work, and the cached read path is unchanged. Until hydration
resolves the button shows the default; hydration only *adds* the "Watching" cue (a quiet correction,
never a flash of a wrong "watching").

### 2.4 Login gate (logged-out)

A logged-out tap routes through the established `requireLogin({ gate: "watch", … })` seam → the
`LoginPromptDialog`. Microcopy (a new `watch` gate, VERBATIM):

- **Title:** **"Log in to watch this topic"**
- **Body:** **"Watching a topic adds it to your personal watchlist, tied to your Wikimedia identity,
  so you can keep up with new curations on it. Reading stays anonymous — only watching needs a
  login."**

No auto-resume on return (the project's UX-2): after login the reader taps Watch again. A session
that expires between render and click surfaces the expired-session gate (the established three-arm
catch), and the optimistic flip rolls back.

### 2.5 Optimistic write + rollback

Watch/un-watch is **optimistic-with-rollback**, identical in posture to mark-complete / hero:
flip the in-memory watching state immediately, fire the auth-gated Server Action in the background,
reconcile on success, and on failure roll back + show a non-blocking polite notice. Three-arm catch:
`isAuthRequired` → the expired-session gate; `isRateLimited` → the calm rate-limit notice;
else a generic **"Couldn't update your watchlist — try again."** polite line. A per-topic in-flight
guard blocks a double-submit.

---

## 3. The `/watchlist` route

`/watchlist` is **login-gated** and reuses the #160 feed body. It is a dynamic (uncached) render like
`/recent` (a per-user, freshness-on-every-curation feed). It composes the universal `SiteHeader`
(`host="page"`) exactly as `/recent` does (do not fork the header).

### 3.1 State precedence

`logged-out gate` > `error (initial read failed)` > `loading (initial)` > `empty: no topics watched`
> `empty: watched but no curations` > `populated`.

### 3.2 Logged-out → the login gate (AC7)

A logged-out visitor sees a centered, full-viewport **login gate** — never a blank page, never a leak
of anyone's watchlist. Reuse the existing `LoginPromptPanel` (the inline gate card) with `watch`-feed
microcopy:

- **Title:** **"Log in to see your watchlist"**
- **Body:** **"Your watchlist feed shows the latest curations on the topics you follow. Log in with
  Wikipedia to watch topics and keep up with them. Reading the rest of wiki+ stays anonymous."**
- The canonical "Log in with Wikipedia" button + the standard gate data-notice (inherited from the
  panel). The header renders above it.

The gate is decided in the **already-authenticated client session** (the `signedIn` predicate from
the session), so it is a client decision — no server redirect needed; the route stays a client SPA
shell like the topic + recent views.

### 3.3 Loading (initial) — reused

Identical to `/recent`'s initial loading (recent-feed.md §4.1): the polite "Loading…" status +
skeleton item placeholders. Copy: **"Loading your watchlist…"** (the one string that differs from
`/recent`, to name the personal scope).

### 3.4 Empty — no topics watched yet (AC9)

The read succeeded; the viewer watches **zero** topics. A centered, full-viewport empty panel
(Indigo-Press light card, the `/recent` empty-panel treatment):

- **Heading:** **"You're not watching any topics yet"**
- **Body:** **"Watch a topic to see its new curations here. Open a topic and tap ＋ Watch topic to
  follow it."**
- **Primary action:** brand-fill button **"Find a topic →"** → **`/`** (the home page, where topic
  search lives). Accessible name: **"Find a topic to watch"**.

### 3.5 Empty — watching topics, but no curations yet (AC10)

The viewer watches ≥1 topic, but none of those topics has a vouched curation yet (or none remain
after the visibility filter). A centered panel, distinct copy from §3.4 (do not conflate "no topics"
with "no curations"):

- **Heading:** **"Nothing new on your topics yet"**
- **Body:** **"You're watching topics, but they don't have any curations yet. New curations on the
  topics you watch will show up here, newest first."**
- **Secondary action:** a quiet text link **"Browse all recent curations →"** → **`/recent`** (a
  graceful path to the broader feed while the watched set is quiet). Accessible name: **"Browse all
  recent curations"**.

Distinguishing §3.4 from §3.5 is a **count of watched topics** (zero → §3.4; ≥1 → §3.5), resolved on
the same read that returns the first feed page (the store read returns the watched-topic count
alongside the page, or the view fetches the watched count — Dev's call; the design requires only that
the two empties are correctly told apart).

### 3.6 Error (initial read failed) — reused

Identical to `/recent` (recent-feed.md §4.3): the honest error panel + a "Try again" button. Copy:
heading **"Couldn't load your watchlist"**, body **"Something went wrong loading your watchlist."**

### 3.7 Populated + end marker — reused verbatim

The populated feed **is** the #160 `RecentFeedView` body: one full-viewport snap item per curation
(§2 of recent-feed.md), `CurationBlock` verbatim, click-to-play, jump-to-topic, read-only upvote
count, cursor pagination, the end-of-feed marker. **Nothing is redesigned.** The only feed-body
differences for the watchlist scope:

- The visually-hidden `<h1>` is **"Your watchlist"** (vs. "Recent curations").
- The end-of-feed marker copy: **"You're all caught up."** + **"That's every curation on the topics
  you watch, newest first."** (the second line names the scope).
- The data source is `listWatchlistCurations` (the viewer's watched set), not `listRecentCurations`.

To achieve this without forking the view, `RecentFeedView` takes a **`scope`** prop (`"recent"` |
`"watchlist"`) that selects: the fetcher (which store read), the `<h1>` text, the end-marker second
line, and which empty panel renders at zero items (the recent "No curations yet" vs. the watchlist
§3.5 "Nothing new… yet"). The §3.4 "no topics watched" empty and the §3.2 login gate are decided by
the **`/watchlist` page** (route-level), *before* it mounts the feed view — they are not feed-body
states. Everything else (scroll model, playback, pagination, tail states, a11y) is shared verbatim.

---

## 4. Accessibility

- The watch button is a real `<button>`, keyboard-focusable, with the visible focus ring; its
  `aria-label` states the action + current meaning in words (§2.2); the busy state sets the disabled
  attribute and shows a word, never a spinner-only.
- Every signal is a word: "Watch topic" / "Watching" / "Adding…" / "Removing…"; never color or glyph
  alone (the `＋`/`✓` are `aria-hidden` reinforcement).
- The `/watchlist` route inherits the feed's full keyboard + screen-reader model (recent-feed.md §8):
  `<main>` + a visually-hidden `<h1>` "Your watchlist", the `<ol>`/`role="list"` track, snap that
  never traps the keyboard, click-to-play with Enter/Space, the polite tail status region.
- The login gate, both empties, and the error panel each announce via `aria-live="polite"` and carry
  a real keyboard action (log in / find a topic / browse recent / try again) — never a dead end.
- AA contrast throughout (the Indigo-Press light register + the existing chips' AA-safe fills). No
  gold (palette rule — gold is the wordmark only).

---

## 5. Responsive

`/watchlist`'s feed is the #160 feed at every width (recent-feed.md §9) — no new responsive work for
the populated state. The login gate / empty / error panels center in the usable viewport below the
slim header at every breakpoint (the `/recent` non-populated shell). The watch control in the
overview panel inherits the panel's responsive behavior (the panel is the sticky aside on `lg+`, a
stacked block below the article on narrow) — a full-width button in the panel foot at every width,
min 44px tall (touch target).

---

## 6. Screenshot matrix / baseline (evaluation evidence & PR gallery)

`/watchlist` is a **new surface** and the topic-page overview panel gains a **new control**, so add
`Scene`s to `e2e/screenshots/catalog.ts` and capture via `scripts/dev/shots.sh` (the standard matrix
× widths × logged-out/logged-in). Scenes to add (at minimum):

- `watchlist-feed-populated` — a few items, top of feed (logged-in).
- `watchlist-gate` — the logged-out login gate at `/watchlist`.
- `watchlist-empty-no-topics` — the §3.4 "not watching any topics yet" panel (logged-in, empty).
- `watchlist-empty-no-curations` — the §3.5 "nothing new yet" panel (logged-in, watching-but-quiet).
- `topic-watch-control` — the topic overview panel showing the watch control (logged-out "＋ Watch
  topic" and logged-in "Watching"); since this changes the topic overview panel, refresh the topic
  group.

If the build session **cannot run chromium** (a cloud loop), the rendered gallery + baseline refresh
are **deferred to a chromium-capable run / CI** and flagged in the report + PR — never skipped
silently; the evaluation then judges against this spec + the geometry the code expresses.

---

## 7. Out of scope (not designed here)

- Redesigning the #160 feed body, `CurationBlock`, the scroll/playback/pagination model (reused).
- A "Watchlist" masthead link / nav entry (the route is URL- + control-reachable; a header entry is a
  fast-follow if desired — like #160's deferred header link).
- Notifications, unread counts, "new since last visit" badges; Wikipedia-watchlist sync; filtering /
  sorting beyond watched + newest-first (all out of scope per the spec).

*(Design spec written by Claude Code, wearing the UX hat, for issue #162.)*
