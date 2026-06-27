# wiki+ — Watchlist: follow topics + a watchlist feed — Product spec

**Role:** Product · **Status:** Buildable spec — written BEFORE design + code · **Issue:** #162 ·
**Depends on:** #160 (the `/recent` feed — reuse, don't rebuild) · **Phase:** prototype.

## Problem & user value

A signed-in reader has no way to **follow** the topics they care about and keep up with new
curations on them. The recent feed (`/recent`, #160) shows *every* curation site-wide, newest first
— great for discovery, but not for "the handful of topics I follow." The watchlist gives a
signed-in user a personal list of topics and a **watchlist feed**: the same vertical curation feed as
`/recent`, sourced from **only the curations on the topics they watch**, newest first. It turns the
discovery surface into a follow loop — a flywheel driver (browse → follow → keep up → curate).

## Scope (in)

- A per-user, **wiki+-side** watchlist of topics (add / remove), persisted per account.
- A **login-gated watchlist feed** at `/watchlist`, reusing #160's feed UI / `CurationBlock` /
  cursor-paginated query, sourced from curations on watched topics, **newest first**, cursor-paginated.
- A **login-gated watch / un-watch control** on the topic page, with sensible empty states.

## Scope (out)

- The base feed UI/component + the global recent-curations query (delivered in #160 — **reuse, don't
  rebuild**) and autoplay (#161).
- **Wikipedia-watchlist integration / sync** — the initial version is entirely wiki+-side; pulling or
  syncing a user's real Wikipedia watchlist is an explicit future.
- Notifications, unread counts, "new since last visit" badges — future.
- Filtering / sorting beyond watched-topics + newest-first.

## Decisions (resolving the issue's open questions)

- **D1 — Watching is available to ANY signed-in contributor**, not curator-restricted. It is a
  *personal follow*, not a curation action. (Confirms the issue's stated assumption.)
- **D2 — A separate `/watchlist` route** (login-gated), not a scope tab on `/recent`. A separate
  destination keeps `/recent`'s anonymous, cached-friendly discovery surface unchanged and gives the
  personal feed its own login-gated home. (UX owns the final shape of the route; the route is fixed.)
- **D3 — The watch control is login-gated *on click***, shown to every viewer on the topic page (not
  hidden from logged-out readers). A logged-out tap opens the login gate (the established
  `requireLogin` contribute-flywheel pattern — curate/add/upvote/dismiss); a signed-in tap toggles
  the watch. UX owns the exact placement (recommendation: the wiki+ overview panel foot).
- **D4 — Data model:** a `watchlist` join — `(contributor_id × topic_id)` with a `watched_at`, unique
  on the pair. Recorded in `docs/ARCHITECTURE.md`.
- **D5 — Feed source:** a new `listWatchlistCurations({ contributorId, cursor?, limit })` store read
  that **reuses #160's keyset-cursor query** (same `(created_at, id)` ordering + opaque cursor + the
  `removed_at IS NULL` + `vetted = true` visibility), adding a join/filter to the viewer's watched
  topic set. No new feed component; the same `RecentFeedView` is parameterized by scope.
- **D6 — Per-viewer, off the read path:** the "am I watching this topic?" state hydrates only in the
  already-authenticated client session (the `votedClipIds` posture), never baked into the cached topic
  read; an anonymous topic load does zero watch work.

## Acceptance criteria (testable)

1. **AC1 — Add persists.** A signed-in user can add a topic to their watchlist; the watch persists
   (a fresh read returns the topic as watched).
2. **AC2 — Remove persists.** A signed-in user can remove a watched topic; the un-watch persists (a
   fresh read no longer returns it).
3. **AC3 — Idempotent add.** Adding an already-watched topic is a no-op (one row, not a duplicate /
   error) — the unique `(contributor, topic)` invariant holds.
4. **AC4 — Feed is watched-only, newest first.** `/watchlist` shows only curations whose parent topic
   the viewer watches, newest first; a curation on an un-watched topic never appears.
5. **AC5 — Same feed UI + cursor pagination.** The feed reuses #160's `RecentFeedView` /
   `CurationBlock` and pages back through history with the same stable keyset cursor (no dupes/gaps);
   `nextCursor === null` is the end marker.
6. **AC6 — Visibility parity.** Only vouched, non-removed clips appear (`removed_at IS NULL` **and**
   `vetted = true`), exactly as `/recent` — a held or removed clip on a watched topic does not appear.
7. **AC7 — Login-gated feed.** A logged-out visit to `/watchlist` gets the login gate (a clear
   prompt to log in), **never** a blank page or a leak of someone else's watchlist.
8. **AC8 — Login-gated control.** The topic-page watch control rejects a logged-out / anonymous
   write server-side (the security gate is the Server Action, not the hidden button); a logged-out
   tap opens the login gate.
9. **AC9 — Empty: no topics watched.** A signed-in user with an empty watchlist sees a non-blank
   prompt to add topics (not the generic "no curations" panel).
10. **AC10 — Empty: watched but no curations yet.** A signed-in user who watches topics that have no
    (vouched) curations yet sees a non-blank "nothing new yet" state, not a broken/blank feed.
11. **AC11 — Per-viewer isolation.** One user's watchlist + feed is scoped to their own
    `contributor.id`; it never returns another user's watched topics or their watched-only feed.

## Success metric

Follow adoption + return: the share of signed-in users who watch ≥1 topic, and repeat `/watchlist`
visits per watching user. (Analytics-as-role is deferred; this is the definition for when it lands.)

## Hand-off

- **UX:** personas/stories → flows → a buildable `docs/design/watchlist.md` covering the watch-control
  placement + states (idle/watching/in-flight/error, login-gated), the `/watchlist` route (login gate
  + the two empty states + the reused populated feed), microcopy, responsive, a11y.
- **Development:** the `watchlist` migration + schema, the store reads/writes (reusing #160's keyset
  query), the auth-gated Server Actions, the topic-page watch toggle, the `/watchlist` view, the login
  gate + empty states; update `docs/ARCHITECTURE.md`; add scenes to `e2e/screenshots/catalog.ts`.

*(Spec written by Claude Code, wearing the Product hat, for issue #162.)*
