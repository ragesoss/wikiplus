# Design contract: Persistence — `localStorage` → Postgres + Drizzle (shared, multi-user, async writes)

**Issue:** [#45](https://github.com/ragesoss/wikiplus/issues/45) · **Type:** build (infrastructure / data layer — **no new screen, no visual redesign**)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/persistence-postgres.md` (AC1–AC19; UX owns AC9 + AC12)
**Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP, section **B**
**Feeds:** Development (build to this contract) · **Evaluated by:** UX (Phase-4 parity + shared/async pass) + QA & Review (correctness)
**Precedent:** `docs/design/node-ssr-server.md` — the prior "no-new-UI, freeze-what-ships" parity contract. This one inherits its method and adds **one genuinely new axis**: the data path goes from synchronous in-browser `localStorage` to an **async client→server round-trip**, so a *write* can now be **pending** and can now **fail**. localStorage never could. That new failure mode is the heart of this contract.

---

## Framing — a parity contract plus one new UX surface

This issue swaps the **data layer** under the prototype: from a `localStorage` `DataStore`
(`lib/data/local-store.ts`, per-browser, synchronous) to **Postgres via Drizzle behind a server
data-access boundary** (Server Actions or route handlers), so the seeded topics and every curated
clip and dismissal live in **one shared database** on the VPS. After this, everyone on
`wikiplus.wikiedu.org` reads and writes the **same data**.

The Product spec is explicit (Hand-off → UX): B is a **parity + multi-user contract, not a redesign —
there are no new flows and no visual change beyond the home page's now-false "data lives in your
browser's local storage" copy.** So most of this doc is the *inverse* of a normal design spec: I
**enumerate what must not change**, state by state, in observable terms, so "identical" is checkable.

But B is **not** purely a freeze, the way the SSR runtime switch (#37) was. Two things genuinely
change for the user, and I contract both:

1. **The data is now shared and durable** (the new *reality*). Another person's curation simply
   appears on your next load; your curation survives a different device, a different browser, a
   redeploy. There is **no new UI** for this — but there is a new *expectation* the design must keep
   honest (and one true copy line to replace).
2. **A write is now an async round-trip** (the new *mechanic*). A dismissal / add that was an
   instantaneous synchronous `localStorage.setItem` is now `client → server → Postgres → back`. That
   introduces, for the first time in this app, a **pending** window and a **failure** outcome (DB
   down, network drop, constraint violation). localStorage effectively never failed and never made
   the user wait. This contract specifies the pending / success / **failure** UX so Development builds
   it deliberately instead of shipping a silent hang or a lie.

The baseline this freezes is the **live behavior today** as defined by the committed specs B sits on:
`docs/TOPIC_PAGE_DESIGN.md`, `docs/design/topic-page-v1.md`, `node-ssr-server.md`,
`declutter-candidate-state.md`, `pinned-player.md`, `canonical-topic-url.md`, `bare-path-redirect.md`,
`article-fidelity.md`, `youtube-autosuggest.md`. Nothing in those changes. A divergence is the
regression this contract exists to catch.

### What B actually moves server-side (the precise write inventory)

This matters because the async-write contract only applies to writes B *actually relocates*. From the
spec scope (deliverable 4) and the live code, the DB reads/writes that move behind the boundary are:

| Call site | DB operations that move server-side | Stays client-side |
|---|---|---|
| `app/page.tsx` (home) | `listTopics` (read); retire per-browser `seedIfEmpty` → DB seed | — |
| `app/topic/TopicView.tsx` | `getTopic`, `getTopicByTitle`, `upsertTopic`, `listClips`, `listCandidates` (reads/sync write); **the sticky dismissal write/read** (`recordDismissal` / `isDismissed`, currently in `lib/candidates/dismissals.ts`) | Title→QID resolution, article fetch, TOC, **live YouTube `suggestCandidates`** |
| `app/contribute/page.tsx` | `upsertTopic` + `addClip` (the real persisted write today) | URL parsing (`parseVideoUrl`) |

**Three things are NOT in B's write contract — call them out so nobody designs UX they shouldn't:**

- **CurateModal / AddModal are mock submits today** (`onClose()`, *no persistence* — the A7 stub). B
  does **not** wire them to the DB. The real promote / add-by-link persistence — with server-side
  validation and the **CC BY-SA agreement capture** — is the **curation-action product layer, issue
  D**, explicitly out of scope here. So in B, "Publish curation" and "Add & curate" still just close
  the modal. **This contract still specifies the async-write pending/failure pattern** (below), and
  flags it as the **inheritance D must adopt** when those modals become real writes — so D doesn't
  reinvent it. (See *Hand-off to D*.)
- **Upvote** appears in the spec's example write list and the `DataStore` interface (`updateClip`),
  but there is **no upvote affordance wired in the live UI** today. If B exposes none, none needs UX;
  if a future issue adds the control, it inherits the async-write contract below verbatim.
- **The live YouTube candidate search stays client-side** (AC8). Its existing loading skeleton /
  "Looking for suggestions…" / polite announcement are **unchanged** and are *not* the DB-write
  surface. Do not conflate the (unchanged) candidate-search pending UI with the (new) DB-write
  pending UI.

So the **one DB write B actually relocates in the reader/curate path is the sticky dismissal**, plus
the **contribute-form add**. Those two are where the new pending/failure UX is observable today.
Everything else B moves is a **read** (whose only new mode is latency, covered under loading).

---

## Personas & stories served

Two existing personas, no new ones. The user value is **shared, durable curation with zero learning
curve** — the product gains a capability (multi-user persistence) while the *experience* is meant to
feel identical.

### The reader who lands on a Topic page
- *As a reader on `wikiplus.wikiedu.org`, I want to see the real, accumulated curation — the seeded
  topics plus whatever anyone has curated — not an empty page or only my own browser's leftovers, so
  the clips and context notes that help me weigh a topic are actually there.* (the shared reality;
  AC10, AC11)
- *As a reader, I want every Topic state — article, TOC, curated clips, candidate suggestions, the
  empty/loading/error/populated transitions — to look and behave exactly as before, so I never know
  the data moved to a server.* (parity; AC12)
- *As a reader who opens a topic someone else just curated on another device, I want their clip to
  simply be there on my load — no "sync" button, no realtime flicker, no per-user empty state.* (the
  shared reality, on next load — no realtime needed)
- *As a reader using a screen reader or keyboard, I want every announcement, focus move, and keyboard
  path to work exactly as before, and any new "saving…/couldn't save" state to be announced, not
  silent.* (a11y, below; AC9)

### The curator / contributor
- *As a curator, I want my contribution to persist and reach other people — across my own devices,
  across sessions, across deploys — so curation stops being throwaway and actually matters.* (the core
  value B unlocks; AC11)
- *As a curator dismissing an irrelevant candidate, I want it gone and to stay gone for everyone, the
  same instant feel as before — and if the dismissal can't be saved, I want to know, not to think it
  worked when it didn't.* (the dismissal write, now async; the new failure mode)
- *As a curator adding a clip by link (the contribute form), I want the same form and the same "added
  → view it" confirmation; and if the save fails, I want my typed note and link preserved and a clear
  retry, never a silent loss of what I wrote.* (the contribute add, now async; **no silent data loss**)

These feed Product's acceptance criteria (AC9, AC11, AC12); they are not re-stated as criteria here.

---

## The parity contract — every state must remain behaviorally identical

For the **home list**, the **Topic page**, and the **contribute flow**: each state (empty / loading /
error / populated) and what must **not** regress. Every row is an observable a person or QA can
confirm against the live `wikiplus.wikiedu.org` behavior before/after the swap. The *components do not
change*; only where their data comes from does.

### Home list (`app/page.tsx`)

| State | What the user sees today | Must NOT regress under Postgres |
|---|---|---|
| **Loading** | `topics === null` → "Loading…" (`text-ink/50`) while the store resolves. | The "Loading…" line still shows during the read; it is the **same transient**, not a longer/blank flash. The read is now a server round-trip — keep the transient visually identical (no spinner swap, no layout shift). |
| **Empty** | `topics.length === 0` → "No topics yet." | Practically unreachable post-seed (the DB seeds the three topics for everyone, AC10), but the branch must stay — same copy, same style. **Never** a per-browser empty: the seed is server-side, so every visitor sees the seeded list, not an empty page awaiting their own `seedIfEmpty`. |
| **Populated** | Grid of topic cards (title, description, QID) linking to `topicHref(title)`. | Identical cards, identical order source (the list now comes from Postgres), identical links. The three seeded topics (`Photosynthesis`, `Cellular respiration`, `Cat`) load from the DB seed (AC10), and **any topic anyone has curated also appears** for everyone. |
| **Error** *(new latent surface)* | localStorage never failed, so there is no error branch today. | If the `listTopics` server read **fails** (DB down), the page must not hang on "Loading…" forever or crash to a blank screen. See *The new async surface* → "read failure." A minimal honest fallback is required, not a white screen. |

**The one permitted copy change** lives here — see *Home-page copy replacement* below.

### Topic page (`app/topic/TopicView.tsx`) — the four states, frozen

These are the committed four states (`topic-page-v1.md`, `declutter-candidate-state.md`,
`node-ssr-server.md`). B changes none of them; it changes only that the clip/candidate/dismissal data
behind them is shared and fetched async.

- **State A — Loading.** The `TopicHeader`, then `ArticleSkeleton` on the left and the rail/TOC/＋plus
  panel appearing as `storeReady` resolves. The `role="status"` "Loading topic…" announcement still
  fires on the #13 bare-path hop and **only** there. **Must not regress:** no "Topic not found." flash
  on any real-topic load; no new/longer white flash; the skeleton→article transition stays one smooth
  step. The store read is now a server round-trip (latency) — see *async loading* for the bound this
  puts on the skeleton window.
- **State B — Empty (zero curations).** The ＋plus panel with the big `0` / "videos curated", the
  once-per-context "*N auto-suggestions from {sources}*" line, the "✦ Be the first to curate" CTA; the
  General / Suggested band with its single header and no per-card badge; the one-time
  `CandidateSetHeader`; candidate cards with compact match reason + source pill, dashed/unvetted
  treatment; the polite candidate-search live region gated to `mode === "empty"`. **Must not regress:**
  the #14 once-per-context signal (panel + band header + one-time rail header, never per card); the
  no-key no-op (no live-search flash/announcement when `NEXT_PUBLIC_YOUTUBE_API_KEY` is unset); Curate
  / Not-relevant controls; the CTA. **New:** the candidate set the reader triages is no longer
  per-browser — a candidate **dismissed by anyone** stays dismissed for everyone (AC5), because the
  dismissal now persists in `dismissed_candidate`, not local browser state.
- **State C — Error.** Two existing surfaces, unchanged: **article-fetch failure** → the
  `ArticleError` block with the canonical "From Wikipedia" link + working **Retry** (`loadArticle`),
  rail/TOC/＋plus chrome still renders; **unresolvable topic** → the graceful "Topic not found. Back
  home" dead end. **Must not regress:** the two error surfaces stay distinct; Retry works; copy/links
  unchanged; no console error. These are **client-side** outcomes (article fetch / title resolution
  stay client-side, AC8) — B does **not** touch them. **New, separate:** a *store* read failure (DB
  down) is a *different* error than an article-fetch failure — see *async read failure*; do not route a
  DB read failure into `ArticleError` (that block is about Wikipedia, and offers a Wikipedia link +
  Wikipedia retry, which would mislead).
- **State D — Populated / curated.** The full two-world page: Wikipedia-styled article + infobox +
  citations on the left; the ＋plus panel (videos / creators / curators numerals + synced status), TOC
  with per-entry counts (General first), section `ClipCard`s, the General strip; synchronized
  scrolling; the curated `PlayerModal` (blocking, focus-trapping); candidates on the non-modal pinned
  player; in-SPA wikilink navigation; #23 canonicalization. **Must not regress:** every one of those.
  **New:** the clip set is shared — the infobox counts (videos / creators / curators) reflect the
  **shared** clip set (AC11), and a clip curated in another browser appears here on load.

### Contribute flow (`app/contribute/page.tsx`)

This is the **real persisted write path** B relocates, so its states carry the new async mechanic.

| State | Today (synchronous localStorage) | Under Postgres (async server write) — contract |
|---|---|---|
| **Form (idle)** | The "Add a clip" form: QID, video URL, creator handle, context note, stance, accuracy `select`s, "Add clip" submit. `?qid=` prefills the QID. | **Identical** form, fields, labels, prefill, layout. No new fields (CC BY-SA agreement is **D**, not B). |
| **Validation error** | Synchronous, pre-write: empty QID / unrecognized URL / empty note → the red `error` line (`text-red-700`). | **Identical** — these validations stay client-side and synchronous (they gate *before* the round-trip). Same copy, same placement. |
| **Submitting** *(new)* | None — the write was instant. | **New pending state.** On submit, after client validation passes, the write is now a round-trip. The submit button shows a **pending/disabled** state ("Adding…", `disabled`, `aria-busy`) so a double-submit can't fire two `addClip`s, and the user sees the system is working. See *async write* for the disabled-until / spinner rule. |
| **Success** | `setSavedQid(id)` → "Clip added." + "View the topic →" link (`?qid=` route). | **Identical** success view and copy — but reached only **after the server confirms the write** (awaited, not optimistic; see *optimistic vs awaited*). The clip is now durable and shared. |
| **Write failure** *(new)* | Impossible — localStorage didn't fail. | **New failure state.** If the server write rejects (DB down, network drop, constraint), the form must show an **honest error**, **preserve every typed field** (QID, URL, handle, note, stance, accuracy — *no silent data loss*), re-enable the submit as a **Retry**, and **not** show the "Clip added." success. See *async write failure* for exact copy. |

---

## The new async surface — shared reality + pending / success / failure

This is the part the SSR contract did not have. localStorage was synchronous and never failed; a
server write is neither. Below is the buildable contract for the new states, applied to the writes B
actually relocates (the **sticky dismissal** and the **contribute add**), and **inherited by D** for
promote / add-by-link.

### Shared reality — what "shared across browsers" looks like to a reader

- **No realtime, no sync UI.** Another person's curation appears on the reader's **next load** of the
  topic (the `listClips` read now hits shared Postgres). There is **no** websocket, no polling, no
  "new clips available — refresh" banner, no realtime flicker. The reader simply sees more than they
  did yesterday. This is intentional and matches the spec ("on next load — no realtime needed").
- **No per-user empty state.** Because the seed and all clips live in one shared DB, a topic is empty
  (State B) only if *nobody* has curated it — not because *this browser* hasn't. A reader never sees
  "0 videos curated" on a topic others have curated. (Under SSR the server can't see the DB during the
  client-rendered resolve either way — the existing **loading → curated, never empty → curated**
  invariant from `node-ssr-server.md` §FOWC still holds and must be re-verified, AC9.)
- **Dismissals are shared too.** A candidate dismissed by anyone does not resurface for anyone (AC5),
  matched by `(topic, provider, provider_video_id)`. The reader perceives this as "the obviously-bad
  suggestions are already gone" — there is no per-card "someone dismissed this" marker; dismissed
  candidates are simply absent.
- **Synced label stays cosmetic.** The ＋plus panel's "synced · just now" / `deriveStats().synced`
  string is a static decorative label today (`"just now"` / `"2h ago"`), **not** a real sync state.
  B keeps it cosmetic — do **not** wire it to a real timestamp or turn it into a live indicator
  (that would imply realtime, which B does not have, and risks a hydration mismatch if it renders a
  `Date.now()`-derived value into server HTML — see `node-ssr-server.md` §1). Leave it exactly as is.

### Optimistic vs. awaited — the decided pattern

The two relocated writes have **different** correct patterns, because their failure stakes differ:

- **Sticky dismissal → optimistic, with rollback on failure.** Dismissing a candidate is a low-stakes,
  high-frequency triage action; today it hides the card **instantly** (`setDismissed` fires before any
  persistence, and `recordDismissal` is fire-and-forget). To preserve that instant feel, the dismissal
  stays **optimistic**: hide the card immediately, fire the server write in the background. **But**
  because the write can now fail, optimism requires a **rollback contract**: if the server write
  rejects, the card **reappears** (the optimistic hide is reverted) and a **non-blocking, polite**
  notice tells the user it couldn't be saved and to try again — *no silent loss of the user's intent,
  no permanently-hidden-but-not-saved limbo*. The card reappearing in its place is itself the honest
  signal ("that didn't take"); the notice names why.
- **Contribute add → awaited, never optimistic.** Adding a clip is a deliberate, content-bearing
  action (the user wrote a context note — the whole point). It must **not** optimistically show "Clip
  added." before the server confirms, because a failure after a false success would either lose the
  note or strand the user on a success screen for a clip that doesn't exist. So the add is **awaited**:
  submit → pending/disabled → on success show "Clip added." → on failure show the error and keep the
  form populated. The brief pending wait is acceptable here; correctness and no-data-loss outweigh
  instantaneity for a once-in-a-while authoring action.

> **Rule of thumb for D (promote / add-by-link):** content-bearing writes that carry a context note or
> the CC BY-SA agreement are **awaited** (like the contribute add); reversible, low-stakes toggles
> (dismiss, upvote) may be **optimistic with rollback** (like the dismissal). Default to *awaited*
> when unsure — a wrong optimistic state is worse than a half-second wait.

### Pending state (both writes)

- **Disable the trigger while in flight.** The submit button / action control is `disabled` during the
  round-trip so the same write can't fire twice (no duplicate `addClip`, no double dismissal). For the
  contribute form: button label swaps to **"Adding…"**, `disabled`, `aria-busy="true"`.
- **Show motion only if it's slow.** For the optimistic dismissal there is **no visible pending UI**
  by design — the card is already gone; the write happens silently in the background (success is the
  expected case and needs no confirmation). For the awaited contribute add, the "Adding…" disabled
  button *is* the pending affordance; no separate spinner/overlay is required for a single quick write.
- **Announce to AT.** A polite live region announces the pending→result transition for the awaited add
  (e.g. "Adding clip…" → "Clip added." / "Couldn't add clip."). See a11y.
- **Bound the wait.** The pending window must stay short; if the server is unreachable the request
  should fail into the failure UX (below) rather than hang the button indefinitely. (The exact
  timeout/abort mechanism is Development's call; the UX requirement is: it resolves to success or a
  visible failure — never an indefinite disabled spinner.)

### Success state (both writes)

- **Contribute add:** unchanged "Clip added." + "View the topic →" — but only **after** the server
  confirms. The clip is durable and shared.
- **Dismissal:** no success affordance (the card being gone is the success). The persisted-dismissal
  read (`isDismissed`) keeps it gone on reload, in another session, and in another browser (AC5).
- **No false success.** Neither write shows its success state before the server has confirmed
  (dismissal's "success" is the optimistic hide *plus* a silent confirmed write; if the write fails the
  hide is rolled back, so a hidden card is never an unsaved card for longer than the round-trip).

### Write failure (the genuinely new failure mode)

A DB/network write error is a failure mode `localStorage` never had. Specify it so Development builds
it, not so it hangs or lies:

- **Contribute add — failure UX (awaited):**
  - **What the user sees:** the form stays on screen with **every field preserved** (QID, URL, handle,
    context note, stance, accuracy) — *no silent data loss of the context note the user wrote*. The
    "Clip added." success is **not** shown.
  - **Error message:** an honest, non-blaming line in the existing red error slot — copy:
    **"Couldn't save your clip — please try again."** (If the failure is distinguishable as offline,
    "Couldn't save — you appear to be offline. Try again." is an allowed refinement; do not over-engineer
    error taxonomy in B.) Use the *same* red `error` styling the form already uses for validation
    errors so there's one error surface, not two competing ones.
  - **Retry:** the submit button re-enables (label back to "Add clip"); pressing it re-attempts the
    **same** write with the preserved fields. No data re-entry.
  - **No partial/broken state:** if the write is two operations (`upsertTopic` then `addClip`), a
    failure must not leave the user believing the clip saved. (Whether the boundary makes the pair
    atomic is Development's concern; the *UX* requirement is the user is never told "added" for a clip
    that isn't.)
- **Dismissal — failure UX (optimistic rollback):**
  - **What the user sees:** the dismissed candidate card **reappears** in place (the optimistic hide is
    reverted; the suggestion count goes back up), and a **non-blocking polite** notice — copy:
    **"Couldn't dismiss that — please try again."** The notice does not steal focus, does not block the
    page (it is informational, like a toast or an inline line near the band), and dismisses itself /
    is replaceable by the next action. Focus is **not** yanked (the user may have moved on).
  - **Retry:** pressing "Not relevant" again re-attempts. No special retry control needed — the control
    is right there on the reappeared card.
  - **No silent loss:** the candidate reappearing *is* the no-silent-loss guarantee — the user's intent
    is never quietly dropped, and a card is never left hidden-but-unsaved beyond the round-trip.
- **Read failure (home list / topic store reads):**
  - localStorage reads never failed; a server read can. The page must **not** hang on the loading
    transient forever or crash to blank.
  - **Home list:** if `listTopics` fails, show an honest line in the topics region — copy:
    **"Couldn't load topics — please refresh."** (replacing the "Loading…" transient, not appended to
    it). Keep the header/search chrome rendered.
  - **Topic page store read:** if the clip/candidate read fails, the article (client-side, AC8) can
    still render; the ＋plus rail should show an honest line rather than a permanent skeleton — copy:
    **"Couldn't load curated videos — please refresh."** Do **not** route this into `ArticleError`
    (which is about the Wikipedia fetch and offers a Wikipedia link). This is a graceful degradation
    requirement, not a new designed screen — minimal honest copy, no white screen, no infinite spinner.

> **Scope honesty:** the read-failure copy above is a *floor* (don't hang, don't lie). B's primary job
> is the happy path on a healthy DB; an elaborate offline/error design system is **not** in B's scope.
> The requirement is that failure is *visible and honest*, not *beautifully designed*.

---

## Home-page copy replacement (the one permitted copy change)

`app/page.tsx` currently reads:

> A curation layer over Wikipedia — each topic pairs the article with curated, contextualized clips.
> *(Prototype: data lives in your browser's local storage.)*

The parenthetical is now **false** — data lives in shared Postgres on the server, visible to everyone.
Replace it. The replacement must be **honest, simple, and not over-claim** (no "realtime", no
"sign in", no "accounts" — those are C/D). Recommended replacement:

> A curation layer over Wikipedia — each topic pairs the article with curated, contextualized clips.
> *(Prototype: curations are shared — everyone sees the same topics and clips.)*

- **Style:** keep the exact same treatment as today — same sentence, same trailing parenthetical in
  the muted `text-ink/50` span, same `max-w-2xl text-sm text-ink/70` paragraph. Only the words inside
  the parenthetical change. No new line, no new layout.
- **Acceptable shorter variant** (if Development prefers brevity): *"(Prototype: curations are shared
  and saved on the server.)"* — either is fine; both are honest and avoid implying sign-in/realtime.
- **Do not** add a "made with Postgres" / tech-stack note — the parenthetical is a *reader-facing*
  honesty note about where their work goes, not a stack badge.

This is the **only** copy change in B. Every other string in the three surfaces is frozen (AC12).

---

## Accessibility invariants to re-verify

All existing a11y behavior is **unchanged by design** — but the data-layer swap touches the
render/hydration seam (per `node-ssr-server.md`) and adds new pending/error states that must be
**announced**, not silent. Re-check, do not assume:

- **AA contrast** — the new error/pending text must meet AA. The contribute form already uses
  `text-red-700` for errors (verify AA on white); the new write-failure line reuses it. Any new
  "Adding…" / disabled button state must keep AA contrast (a `disabled` button must not drop below AA
  or rely on color alone to read as disabled — pair the visual with the **"Adding…"** word).
- **Text-labeled signals, never color alone** — pending = the **word "Adding…"** (not just a greyed
  button); failure = the **error sentence** (not just red). The dismissal-failure reappearance is
  signaled by the card returning **and** the worded notice, never by color.
- **Live-region announcements (new — the key a11y addition):**
  - The awaited contribute add announces its transition in a **polite** live region: "Adding clip…" →
    "Clip added." / "Couldn't save your clip — please try again." A sighted user sees the button +
    success view; an AT user must hear the equivalent. (`role="status"` / `aria-live="polite"`.)
  - The dismissal-failure notice is **polite** and does **not** steal focus.
  - Reuse the existing polite-live-region pattern already in `TopicView` (the candidate-search
    announcement) — do not introduce an assertive/interrupting region for routine saves.
- **Focus management** — on a write **failure**, focus is **not** yanked away from where the user is:
  - Contribute add failure: focus stays in the form / returns to the submit (so a keyboard user can
    immediately retry); the preserved fields are still tabbable in the same order.
  - Dismissal failure: focus is **not** stolen to the reappeared card (the user may have scrolled on);
    the existing `focusBandHeading` pattern already handles the *dismiss* focus move — failure must not
    fight it.
- **Keyboard support** — the disabled-while-pending submit must not trap or lose keyboard focus; the
  retry path is fully keyboard-operable. All existing keyboard paths (modal traps, non-modal pinned
  player, TOC, wikilinks) are unchanged — re-verify they still work after the rewire.
- **No new hydration mismatch / no new console error** — the data reads move server-boundary-side but
  the *render* stays client-driven (reads happen in effects post-mount, as today). Confirm `localStorage`
  removal didn't leave a server/client divergence, and that no DB value, `Date.now()`, or
  locale-formatted string is rendered into server HTML (the "synced" label stays cosmetic — see above).
  Console must be clean across all states (AC9).
- **`<html lang="en">`**, `prefers-reduced-motion` gating, AA on all existing chips/panels/pills —
  unchanged; re-confirm none re-rendered differently after the rewire.

---

## Phase-4 evaluation checklist (UX sign-off)

UX (me, next round) walks this against the running app (the deployed `wikiplus.wikiedu.org` build, or
a local `next start` with Postgres) and a **two-browser** test. Pass = identical behavior + the new
async states behave as contracted. Any divergence is a **design defect** routed back to Development.

**Setup**
- [ ] App runs against Postgres (not localStorage); DevTools console open for every state.
- [ ] A second browser / private window available for the multi-user check.

**Parity — home list**
- [ ] Loading transient identical (same "Loading…", no longer/blank flash) while `listTopics` resolves.
- [ ] The three seeded topics load **from the DB seed** (AC10) — not a per-browser `seedIfEmpty`.
- [ ] Topic cards (title, description, QID, links) identical to today.

**Parity — Topic page (the four states)**
- [ ] **Loading (A):** skeleton → article one smooth step; no "Topic not found." flash; bare-path
      `role="status"` "Loading topic…" fires only on the #13 hop; store-read latency doesn't lengthen
      the skeleton beyond today's feel.
- [ ] **Empty (B):** ＋plus `0` panel, once-per-context "*N auto-suggestions from {sources}*", "Be the
      first to curate", single band header, no per-card badge; no-key build silent; #14 invariant holds.
- [ ] **Error (C):** article-fetch failure → `ArticleError` + canonical "From Wikipedia" + working
      Retry, chrome still renders; unresolvable title → "Topic not found. Back home"; no console error.
- [ ] **Populated (D):** full two-world page; scroll-sync; curated `PlayerModal` blocking + trapping;
      candidate pinned player non-modal; in-SPA wikilinks; #23 canonical/display split preserved.

**Parity — contribute flow**
- [ ] Idle form identical (fields, labels, `?qid=` prefill); validation errors identical (synchronous,
      red line); success view ("Clip added." + "View the topic →") identical on the happy path.

**Shared reality (the multi-user check — AC11, AC5)**
- [ ] A clip added in browser A appears on browser B's **next load** of that topic (and the home list)
      — proving shared Postgres, no shared localStorage.
- [ ] Infobox counts (videos / creators / curators) reflect the **shared** clip set.
- [ ] A candidate dismissed in browser A does **not** resurface in browser B (sticky, shared dismissal).
- [ ] No realtime UI appeared (no "refresh for new clips" banner, no live flicker); the "synced" label
      is still the cosmetic static string, not a live timestamp.

**New async-write states**
- [ ] **Contribute add pending:** submit disables, label → "Adding…", `aria-busy`; no double-submit.
- [ ] **Contribute add success:** "Clip added." shows **only after** the server confirms (awaited).
- [ ] **Contribute add failure** (simulate DB down / offline): honest error line, **all fields
      preserved** (especially the context note — no silent loss), submit re-enables as retry, **no**
      false "Clip added.".
- [ ] **Dismissal optimistic + rollback:** dismiss hides the card instantly (same feel as today); on a
      simulated write failure the card **reappears**, count restores, a polite "Couldn't dismiss"
      notice shows, focus not stolen.
- [ ] **Read failure:** home list shows "Couldn't load topics — please refresh." (not an infinite
      "Loading…"); a topic store-read failure shows an honest rail line, not a permanent skeleton, and
      is **not** routed into `ArticleError`.

**Accessibility re-check**
- [ ] Zero hydration warnings / "did not match" / new console errors across all states (AC9).
- [ ] Pending/result announced in a polite live region (add: "Adding clip…" → result); failure notices
      worded, not color-only; AA contrast on error/pending/disabled states.
- [ ] Focus not yanked on either failure; retry fully keyboard-operable; existing modal/pinned-player/
      TOC/wikilink keyboard paths unchanged.
- [ ] `<html lang="en">` present; `prefers-reduced-motion` gating intact; existing chips/pills/panels
      AA unchanged.

**Verdict.** All boxes pass → UX signs off (reader notices nothing; curator's work is now shared and
durable; the new async states are honest). Any unchecked box → a **design defect**: route the specific
divergence (surface + observable + expected) back to Development; re-evaluate after the fix.

---

## Hand-off

- **To Development:** build deliverables 1–8 to this contract. The freeze: every parity row above. The
  new work: the **async-write pending / success / failure** UX for the **contribute add** (awaited,
  fields-preserved, honest error, retry) and the **sticky dismissal** (optimistic with rollback, polite
  failure notice), plus the **read-failure** graceful degradation floor, plus the **home-page copy
  replacement** (exact strings above). The "synced" label stays cosmetic. UX evaluates the built UI
  against AC9 + AC12 and this checklist.
- **To issue D (curation-action product layer) — the inheritance:** CurateModal / AddModal stay mock
  submits in B. When D wires them to real persisted, auth-gated, CC-BY-SA-capturing writes, it
  **adopts the async-write contract in this doc verbatim** — content-bearing writes are **awaited**
  (pending/disabled trigger, fields preserved on failure, honest error + retry, no false success, no
  silent loss of the context note or the agreement). D does **not** need to redesign this; it extends
  it with validation + the agreement field.
- **Out of scope → route to:** the CC BY-SA agreement field and curation validation (Curation/Editorial
  standard → UX+Dev build in **D**); real sign-in / per-user identity (**C** — interim writes attribute
  to the stub contributor, no sign-in UI); ISR/Redis caching, Cloudflare, the production read-path
  (**Operations**, production-MVP); correctness/security/no-DB-creds-in-bundle verification (**QA &
  Review**, AC7).

---

## Change record — production seed walked back (issue [#75](https://github.com/ragesoss/wikiplus/issues/75))

This doc's **AC10** ("the deployed app opens NON-EMPTY for everyone" — the three demo topics + the
curated Photosynthesis demo clips seeded on deploy) is **walked back for production**. The owner is
hand-building real curation examples and wants the fabricated demo clips gone and staying gone, so
they neither linger nor compete with the real work — a topic should read honestly as "not yet
curated" rather than padded with placeholder clips attributed to the non-person `@prototype` stub.

What changed (current state recorded in `docs/ARCHITECTURE.md` → *Production seed policy*):

- **The seed is now a TEST / LOCAL-DEV FIXTURE only.** `lib/db/seed.ts` `seedDatabase` is unchanged
  and still runs directly in tests + local dev (so the contract is still exercised in CI). What
  changed is its **production deploy invocation**: the deploy entrypoint (`scripts/migrate.ts`) gates
  it behind the **`SEED_DEMO_CONTENT`** env flag — **default ON** (unset / empty / any non-disabling
  value seeds; only the literal `"false"`/`"0"` disables), set **OFF** only in the prod compose
  `migrate` service (`deploy/docker-compose.yml`). Migrations still apply when the seed is skipped; the
  run exits 0.
- **The existing prod demo rows are purged once** via the standalone, idempotent
  `scripts/purge-demo-content.ts` (Product decision **2a** — a documented, owner/ops-run one-off, not
  folded into the deploy path). It deletes the seeded Photosynthesis demo clips (topic-scoped + matched
  on the seed `watchUrl`s, so a non-seeded real clip survives), removes the orphaned `@prototype`
  contributor (only when it has no remaining clips), is idempotent, and leaves the seeded topic rows
  intact. Exact owner/ops invocation + the verifying test (`test/prod-seed-purge.test.ts`, pglite) are
  recorded in `docs/ARCHITECTURE.md`.

This is a **data + deploy-env-gate** change: no schema change, no auth-model change, and no change to
the parity/async-write contract above (which still holds). The localStorage / GitHub-Pages demo seed
(`lib/data/seed.ts` as used client-side) is untouched.
