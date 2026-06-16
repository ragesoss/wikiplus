# Design contract: Node SSR server — Topic-page parity

**Issue:** [#37](https://github.com/ragesoss/wikiplus/issues/37) · **Type:** build (infrastructure / runtime — **no user-facing UI change**)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/node-ssr-server.md` (AC1–AC13; reader-path AC2–AC6)
**Feeds:** Development (build to this contract) · **Evaluated by:** UX (Phase-4 parity pass) + QA & Review (correctness)
**Precedent:** `docs/design/bare-path-redirect.md` and `docs/design/topic-url-underscores.md` — the project's two prior "no-new-UI, proportionate" routing specs. This one is smaller still: it invents *nothing*; it **freezes** what already ships.

---

## Framing — this is a parity contract, not a design

This issue swaps the **runtime** under the prototype: from a static export (`output:'export'`,
served as files by GitHub Pages with `404.html` standing in for unknown titles) to a real
**Next.js App Router Node SSR server** (`next build` → `next start`, unknown titles rendered on
demand). The Product spec is explicit: this is an "infrastructure/runtime change with no
user-facing product feature. The reader experience must behave **identically** to today."

So there is **no new screen, no new layout, no new component, no new state, and no new microcopy**
to specify. Drawing any would be a defect. My job is the inverse of a normal design spec: instead
of describing what to build, I **enumerate what must not change** — state by state, in concrete
observable terms — so that "identical" is checkable rather than a vibe, and so a regression is
unambiguous when QA or my own Phase-4 pass meets one.

The baseline this contract freezes is **the live behavior today**, as defined by the committed
specs it sits on: `docs/design/topic-page-v1.md` (the four Topic states), `canonical-topic-url.md`
(#23 canonicalization), `bare-path-redirect.md` (#13 bare-path hop), `declutter-candidate-state.md`
(#14 once-per-context signal), `article-fidelity.md`, `pinned-player.md`, and `youtube-autosuggest.md`.
Nothing in those changes. If the built SSR app diverges from any of them, that is the regression
this contract exists to catch.

---

## Personas & stories served — unchanged, value = "nothing perceptible changes"

Two existing personas, no new ones. The user value of this issue is the **absence** of a perceived
change; the stories are framed as parity guarantees.

- **The reader who lands on a Topic page** (types/pastes a URL, follows a wikilink, refreshes,
  shares a deep link).
  - *As a reader, when wiki+ moves from "static files" to "a real server," I want every Topic page
    — its article, its table of contents, its curated clips, its candidate suggestions — to look
    and behave exactly as it did before, so I never know anything changed under the hood.* (AC6)
  - *As a reader who pastes an unusual or never-before-seen article title, I want it to open and
    resolve like any other topic, not 404, so the server quietly does what the `404.html` trick did
    before — only better.* (AC3)
  - *As a reader who types a sloppy or aliased title (`jfk`, `/photosynthesis`, a bare
    `/San_Francisco`), I want the same clean canonicalization and the same direct-into-loading
    landing I get today — no error flash, no URL churn, no double bounce.* (AC4, AC5)
  - *As a reader using a screen reader or keyboard, I want every announcement, focus move, and
    keyboard path to work exactly as before — the runtime switch changes none of it.* (a11y, below)

- **The curator / contributor** (browses anonymously; the empty-state triage and curate entry
  points are theirs).
  - *As someone evaluating auto-suggested candidates, I want the empty state — the candidate cards,
    the once-per-context "unvetted" signals, the pinned player, the Curate / Not-relevant controls —
    to be exactly what I used yesterday, so my triage loop is undisturbed.* (AC6)

These feed Product's acceptance criteria; they are not re-stated as criteria here.

---

## How the states are rendered today (the basis for "identical")

Understanding *what is server-rendered vs. client-rendered today* is what makes the parity contract
precise, because the SSR switch only changes *when and where* the server pass runs — not the
component tree.

- Both `app/topic/[[...slug]]/page.tsx` and `app/not-found.tsx` mount **client components**
  (`TopicView` is `"use client"`; `NotFound` is `"use client"`). All four Topic states — loading,
  empty, error, populated — are produced **client-side**, driven by React state in `TopicView`
  after it reads `location`/`localStorage` and fetches the article from Wikipedia.
- The only server-produced HTML today is the **initial shell**: the `page.tsx` `<Suspense
  fallback>` (`<p>Loading…</p>`), the `<html lang="en"><body>` layout wrapper, and — for the
  not-found boot — `NotFound`'s **server-prerender branch** (`redirecting === null` → the
  `ArticleSkeleton` loading shell, deliberately *not* `TopicView`, so there is no hydration flip to
  "not found"). Under static export this shell is computed **at build time** and frozen into HTML
  files / `404.html`. Under Node SSR it is computed **per request**.
- The data path is unchanged and stays **client-only**: `localStorage` `DataStore`, all
  `NEXT_PUBLIC_*` reads, Wikipedia title→QID resolution (`resolvePage`), the article body fetch +
  DOMPurify sanitize, and the YouTube candidate search. The server **never** talks to Wikipedia and
  **never** touches `localStorage`.

**The parity consequence:** because the states are client-rendered, the *visible end states must be
byte-for-feel identical* — the components didn't change. The genuine risk is entirely in the
**handoff seam** — the server's first HTML vs. the client's first paint (hydration), and the order
in which the client transitions from that shell to the resolved state. That seam is where this
contract concentrates (see *SSR-specific invariants*).

---

## The parity contract — every Topic state

For each state: **what the user sees**, the **URL / heading behavior**, and **what must NOT
regress**. Every row is an observable a person (or QA) can confirm on the running `next start`
server and compare against the current GitHub Pages site.

### State A — Loading (cold load / refresh of any Topic URL)

- **What the user sees.** The Topic loading UI: the split-wordmark `TopicHeader` at top, then on
  the left the **`ArticleSkeleton`** (the shimmer placeholder for title + lead + body), and the
  right rail / TOC / ＋plus panel appearing as `storeReady` resolves. No "Topic not found." text, no
  raw spinner-then-jump, no blank white page longer than today.
- **URL / heading.** The address bar shows the URL that was loaded; the heading paints once the
  display title is known. The brief `<Suspense fallback>` `Loading…` text (or its equivalent) is
  the same transient it is today — it must not become a *longer* or *different* flash under SSR.
- **#13 bare-path sub-case (critical).** A bare single-segment path (e.g. `/San_Francisco`) must
  **land directly in this loading state** — the `ArticleSkeleton` shell with the `role="status"`
  "Loading topic…" announcement — and **never** show the "Topic not found." flash before the
  `router.replace` hop to `/topic/San_Francisco/`. This is the single hardest-won behavior on the
  not-found boot; under SSR the server now renders that boot per request, so the server's HTML for a
  bare path **must be the loading shell** (the `redirecting === null` branch), never `TopicView`'s
  resolve-error copy. Query + hash preserved across the hop; reserved-prefix allowlist respected.
- **Must NOT regress.** No "Topic not found." flash on any real-topic load (bare or canonical). No
  new/longer white flash or skeleton-then-reflow jump. The loading→resolved transition stays as
  smooth as today (skeleton dissolves into the article in one step, not a multi-stage flicker). The
  `role="status"` "Loading topic…" announcement still fires on the bare-path hop and only there.

### State B — Empty (zero curations)

Two distinct entry sub-cases, both must be identical:

- **B1 — seeded-but-no-clips** (a topic the store knows but has no curated clips).
- **B2 — unknown-title rendered on demand** (a never-seeded title; previously the `404.html` trick,
  now rendered on demand by the server). **This sub-case is the one the routing change directly
  touches** — see #23/AC3 in *URL / heading* and *SSR invariants*.

- **What the user sees.** The empty-state Topic page exactly as `inline-indigo-empty-v2.html` and
  `docs/design/declutter-candidate-state.md` define it:
  - The **＋plus panel** with the big `0` / "videos curated", the once-per-context volume line
    "*N auto-suggestions from {sources}*", and the "✦ Be the first to curate" CTA.
  - The **General / Suggested band** with its single header ("Suggested videos · uncurated — …"),
    no per-card "SUGGESTED" badge, and (no-key builds) no live results — the seeded/empty set.
  - The rail's **one-time `CandidateSetHeader`** introducing section candidates (when any), and
    candidate cards with their compact match reason + source pill, dashed/unvetted treatment.
  - The polite live region for the candidate search announcement (gated to `mode === "empty"`).
- **URL / heading.** Canonical title route; heading is the plain-text `displaytitle`. For B2 the
  on-demand server render must produce the same shell, and `TopicView`'s client resolution then
  drives the same empty UI as a seeded topic — **no 404, no error page** for an arbitrary valid
  title (AC3).
- **Must NOT regress.** The #14 declutter invariant holds: the unvetted signal appears **once per
  context** (＋plus panel + band header + one-time rail header), never per card. No "N candidates"
  count on the band. The no-key no-op holds: with `NEXT_PUBLIC_YOUTUBE_API_KEY` unset (every
  local/CI build) the live path is silent — no loading skeleton flash, no announcement, the
  seeded/empty set stands. The Curate / Not-relevant controls and the "Be the first to curate" CTA
  behave identically. **Critically (B2):** an unknown title must reach the *empty Topic page*, not a
  not-found dead end — the on-demand server render replaces the `404.html` trick transparently.

### State C — Error (resolution / article-fetch failure)

- **What the user sees.** Two existing error surfaces, unchanged:
  - **Article-fetch failure** (`fetchFullArticle` throws): the **`ArticleError`** block in the left
    column — the readable error with a **"From Wikipedia" link** (built from the *canonical* title)
    and a **Retry** affordance that re-runs `loadArticle`. The rail / TOC / ＋plus chrome still
    renders (the fetch failure is scoped to the article body).
  - **Unresolvable topic** (no canonical title, no QID, no seeded hit, no resolvable `?qid=`): the
    graceful **"Topic not found. Back home"** dead end (`Link` to `/`).
- **URL / heading.** The `ArticleError` "From Wikipedia" URL uses `encodeURIComponent(canonicalTitle)`
  — the canonical, not the typed, title. An unresolvable title is **not** canonicalized (no
  `router.replace` to an empty/partial slug).
- **Must NOT regress.** The two error surfaces stay distinct (article-body error keeps the chrome;
  truly-unresolvable shows the back-home dead end). Retry still works. The error copy and links are
  unchanged. **No console error/warning** accompanies either error state (a thrown *fetch* is
  handled into `ArticleError`; it must not surface as an unhandled console error). Crucially, the
  server must **not** render an "error" or "not found" shell that then flips on the client — the
  error is a *client* outcome of a failed fetch/resolve, reached after the loading shell, exactly as
  today.

### State D — Populated / curated (article + TOC + clips)

- **What the user sees.** The full two-world Topic page per `inline-indigo-sync.html` and
  `docs/design/topic-page-v1.md`:
  - **Left:** Wikipedia-styled article — `ArticleLeadBlock` (serif title, "From Wikipedia · CC
    BY-SA" attribution, lead with citation markers), the Wikipedia **infobox** float-right,
    `ArticleSections` with real headings/wikilinks/figures, the citation popover layer, wide-table
    scroll hint.
  - **Right rail (sticky):** the **＋plus panel** with the three big numerals (videos / creators /
    curators) + synced status, the **TOC** with per-entry video counts (General row first), and the
    section-anchored **`ClipCard`s**.
  - **General strip:** the full-bleed thumbnail-forward row of whole-topic clips.
  - **Interactions:** synchronized scrolling (article ⇄ rail ⇄ TOC highlight), the curated
    **`PlayerModal`** (blocking, focus-trapping) on clip play, wikilink clicks routed in-SPA via the
    Next client router (no full reload).
- **URL / heading (#23 canonicalization — must work identically).**
  - **Redirect-follow:** an aliased arrival (`jfk` → `John F. Kennedy`, `/photosynthesis` →
    `Photosynthesis`) resolves via `resolvePage` (`redirects=1`) and the URL settles to the
    canonical slug.
  - **Canonical-vs-display split:** the URL/slug + store key + article fetch + "From Wikipedia" link
    use the **canonical** title; the **heading** (`<h1>` + compact `TopicHeader` echo) uses the
    plain-text **`displaytitle`** — so author-stylized titles legitimately differ (canonical
    `Bell_hooks` ⇄ heading `bell hooks`). Neither leaks into the other's surface.
  - **No replace loop:** an already-canonical arrival fires **zero** `router.replace`s — no history
    churn, no flicker, Back doesn't bounce through a typo. The replace is `replace`, never `push`.
- **Must NOT regress.** Scroll-sync still pairs section ⇄ active card ⇄ TOC entry. The curated modal
  stays blocking + focus-trapping; candidates stay on the non-modal pinned player (the recorded
  curated-modal / candidate-pinned split is preserved, not "fixed"). Wikilinks still resolve to
  `/topic/…` in-SPA without a full reload. Big numerals, sync status, TOC counts unchanged. The
  `prefers-reduced-motion` gate on scroll/dock motion still holds.

---

## SSR-specific UX invariants — the real regression surface

These are the failure modes the runtime switch can *introduce* even with the component tree
untouched. They are the heart of this contract; AC6 maps directly onto them.

1. **No hydration mismatch — any state.** The server's first HTML for a route must equal React's
   first client render for that route, or React logs a hydration error and may discard/replace
   server markup (visible flicker). The risk vectors specific to this app:
   - **`localStorage` / `NEXT_PUBLIC_*` must stay strictly client-only.** No server code path may
     read `localStorage`, `window`, or a `NEXT_PUBLIC_*` value *during render* in a way that makes
     the server HTML differ from the client's first paint. Reads happen in effects (post-mount), as
     today; the seam (`lib/data`, `lib/candidates`) stays client-only.
   - **The not-found boot's server branch must be the neutral shell.** `NotFound` already renders
     the `ArticleSkeleton` loading shell on the server prerender (`redirecting === null`) precisely
     so the client's first paint matches and there is no flip to "not found." Under per-request SSR
     this branch now runs on every unknown-path request — it must **still** be the loading shell,
     never `TopicView`'s resolve-error.
   - **No `Date.now()` / random / locale-formatted value rendered into server HTML** that the client
     would recompute differently (the "synced just now" / count text is derived client-side from
     store state, post-mount — keep it that way).
2. **No flash-of-wrong-content (FOWC).** Specifically: a **server-rendered "empty" must not flash
   before the client `localStorage` hydrates a curated topic.** Because the server cannot see
   `localStorage`, the server HTML for a seeded/curated topic is the **loading shell**, and the
   client then resolves to curated — i.e. loading → curated, *never* empty → curated. The reader of
   a curated topic must never glimpse the "0 videos curated" empty panel. (Today's static export has
   the same property because the same client components decide `mode`; SSR must preserve it.)
3. **No console error or warning in any state.** Open DevTools, exercise loading / empty (B1 + B2) /
   error / populated, and the bare-path + canonicalization hops: the console must be **clean** — no
   hydration warning, no "Text content did not match," no unhandled promise rejection from the
   swallowed candidate-search error, no Next dynamic-route warning from the `dynamicParams` change.
   This is an explicit AC6 line and a Phase-4 sign-off gate.
4. **Loading→resolved transition stays as smooth as today.** No new intermediate flash, no
   double-mount of `TopicView`, no skeleton that reappears after the article painted. The
   `<Suspense fallback>` transient must not become longer or visually different under SSR. Scroll
   position and focus are not disturbed by the runtime change.
5. **On-demand unknown titles render like any topic (B2).** With `dynamicParams = true` (or the
   constraint dropped) and the `404.html` trick removed, an arbitrary `/topic/<Title>/` is served by
   the running server and proceeds through the same loading → resolve → empty/populated/error flow.
   No `404.html` interstitial, no full-page reload mid-flow, no observable difference from a seeded
   title's path other than the data the client resolves.
6. **In-SPA navigation unchanged.** `<Link>` and the delegated wikilink handler still navigate via
   the client router with **no full-page reload** (no white flash, no scroll reset to top unless the
   route legitimately changes). The bare-path and `?qid=` canonicalizations still use
   `router.replace` (not `push`) so Back behaves as today.

---

## Accessibility invariants to re-verify post-switch

All unchanged by design — but the runtime switch touches the server-render/hydration seam where a
silent regression could hide. Re-check, do not assume:

- **AA contrast** across all chips, the ＋plus panel, the General band, the pinned player chrome
  (white-on-`ink`), candidate dashed treatment, and focus rings — unchanged values, confirm nothing
  re-rendered with a different fill.
- **Visible focus rings** on every interactive element (TOC entries, Curate / Not-relevant, "Be the
  first to curate", modal controls, the pinned player's "✕ Close", wikilinks) — confirm the focus
  ring still renders identically and isn't suppressed by any hydration replacement.
- **Keyboard support / focus management** — the curated `PlayerModal` focus trap; the **non-modal**
  pinned player that does **not** steal focus on open and returns focus to the General-band heading
  on keyboard dismiss; the shared `focusBandHeading` anchor after candidate dismissal. Tab order
  unchanged.
- **Live regions / announcements** — the `role="status"` "Loading topic…" on the #13 bare-path hop
  (and **only** there); the polite candidate-search live region gated to `mode === "empty"`. These
  must still fire exactly once and in the same conditions; the per-request SSR boot must not double
  them or drop them.
- **Text-labeled signals, never color alone** — the accuracy/stance chips, the source pills, the
  unvetted treatment all keep their text labels. Confirm none degraded to color-only.
- **`prefers-reduced-motion`** still gates scroll-sync easing and any dock-in motion (read
  post-mount in an effect — keep it client-only so it can't cause a mismatch).
- **`<html lang="en">`** still emitted on the server (it is, from `app/layout.tsx`) so AT gets the
  language on first byte.

---

## Phase-4 evaluation checklist (UX parity sign-off)

UX (me, next round) signs off parity by walking this against the running `next build && next start`
server, comparing each item to the current static-export behavior. Pass = identical; any divergence
is a design defect routed back to Development.

**Setup**
- [ ] `next build` produces a server build (no `out/`); `next start` serves the app. (UX confirms it
      *runs*; QA owns the AC1/AC8 build-shape verdict.)
- [ ] DevTools console open for every state below.

**State A — Loading**
- [ ] Cold load / refresh of a seeded `/topic/Photosynthesis/` shows the loading skeleton, then the
      article — one smooth transition, no longer/extra flash than today.
- [ ] Bare `/San_Francisco` lands **directly** in the loading skeleton (never the "Topic not
      found." flash), `role="status"` "Loading topic…" fires, URL settles to `/topic/San_Francisco/`,
      query + hash preserved.
- [ ] A reserved bare path (`/topic`, `/contribute`, an asset path) is **not** redirected.

**State B — Empty**
- [ ] B1 seeded-no-clips topic shows the ＋plus `0` panel, "*N auto-suggestions from {sources}*",
      "Be the first to curate", and the single band header — the #14 once-per-context signal, no
      per-card badge.
- [ ] B2 an arbitrary unseeded valid title (e.g. `/topic/Mitochondrion/` if not seeded) **renders on
      demand** as the empty Topic page — **no 404, no `404.html` interstitial**.
- [ ] No-key build: the live candidate path is silent (no loading flash, no announcement); seeded/
      empty set stands.

**State C — Error**
- [ ] An article-fetch failure shows `ArticleError` with the canonical "From Wikipedia" link + a
      working Retry; the rail/TOC/＋plus chrome still renders. No unhandled console error.
- [ ] A genuinely unresolvable title shows the "Topic not found. Back home" dead end — and is **not**
      canonicalized to a partial slug.

**State D — Populated / curated**
- [ ] A seeded curated topic shows the full two-world page: article + Wikipedia infobox + citations,
      ＋plus three-numeral panel, TOC counts, General strip, section ClipCards.
- [ ] Scroll-sync pairs section ⇄ active card ⇄ TOC entry; curated `PlayerModal` is blocking +
      focus-trapping; candidate pinned player is non-modal.
- [ ] Wikilink click navigates in-SPA (no full reload, no white flash).

**#23 canonicalization**
- [ ] `jfk` → canonical `John F. Kennedy` (redirect-follow); URL settles to the canonical slug.
- [ ] An author-stylized title shows canonical in the URL but `displaytitle` in the heading (split
      preserved; neither leaks).
- [ ] An already-canonical arrival fires **zero** `router.replace`s (verified: no URL flicker, Back
      doesn't bounce, no replace-loop) — watch the address bar and history.

**SSR invariants (the regression surface)**
- [ ] **Zero** hydration warnings / "did not match" errors in the console across all states above.
- [ ] **No empty-flash-before-curated** on a curated topic (loading → curated, never empty →
      curated).
- [ ] No new/longer flash-of-loading; no skeleton reappearing after the article paints.
- [ ] No full-page reload on in-SPA navigation; Back behaves as today on `replace` hops.

**Accessibility re-check**
- [ ] AA contrast spot-check on chips / ＋plus panel / pinned-player chrome unchanged.
- [ ] Visible focus rings on TOC, Curate / Not-relevant, CTA, modal + pinned-player Close, wikilinks.
- [ ] Keyboard: curated-modal trap; pinned player doesn't steal focus, returns focus to band heading
      on dismiss.
- [ ] Live regions fire exactly once and only in their conditions (bare-path "Loading topic…";
      empty-only candidate announcement).
- [ ] `<html lang="en">` present in the server response.

**Verdict.** All boxes pass → UX signs off parity (the reader notices nothing). Any unchecked box
is a **design defect** — route the specific divergence (state + observable + expected) back to
Development; re-evaluate after the fix.

---

## Out of scope (route elsewhere)

- AC1/AC8 (build shape: no `out/`, server build), AC7 (Server-Actions capability smoke), AC9–AC11
  (typecheck / unit / e2e green), AC12 (`deploy.yml` paused), AC13 (`docs/ARCHITECTURE.md`) — these
  are **correctness / build / infra** verdicts owned by **QA & Review** and **Development**, not UX
  parity. UX confirms the app *runs* and is *observably identical*; it does not adjudicate the build
  artifact shape or the workflow YAML.
- The `next.config` concessions (`images.unoptimized`, `trailingSlash`, `assetPrefix`, `basePath`)
  → **Development** decides keep/drop/simplify and documents why; UX only cares that the *visible
  result* is unchanged (e.g. `trailingSlash` not changing the canonical URL the reader sees).
- Host provisioning, auto-deploy restoration, secrets → **Operations** / issue A.2 (deferred).
