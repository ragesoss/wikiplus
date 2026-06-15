# Design spec: Bare-path redirect — `/<Title>` → `/topic/<Title>/`

**Issue:** [#13](https://github.com/ragesoss/wikiplus/issues/13) · **Type:** build (routing — client-side fallback redirect)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/bare-path-redirect.md`
**Feeds:** Development (build) · **Evaluated by:** UX (built-UI pass) + QA & Review (correctness)
**Precedent:** [#11](https://github.com/ragesoss/wikiplus/issues/11) design spec `docs/design/topic-url-underscores.md` (proportionate, no-new-UI routing change)

---

## Framing — proportionate scope

This is **routing behavior**, not a new screen. There is **no new visual component, no new
state, no new layout, and (preferably) no new microcopy**. The entire user-facing surface is a
*transition*: a person who reaches a bare `/San_Francisco` URL should feel like the product "just
worked" and land on the Topic page — never see a 404 flash and a bounce.

My job here is small but real:
1. Specify how the redirect **hop should feel** (the one genuine UX concern), and
2. **Confirm** that the states the redirect routes *into* — the existing loading skeleton and the
   existing graceful not-found — are the right destinations and read as "handled," not "broken."

I am routing into states that already exist in `app/topic/TopicView.tsx`. I introduce no new
error/empty/loading UI. This spec invents nothing the feature does not introduce.

---

## Personas & stories served

Two existing personas, no new ones:

- **The reader who types / dictates / pastes the bare shorthand.** They reach for
  `wikiplus.../San_Francisco` because it is shorter and the natural thing to guess — the same way
  `en.wikipedia.org/San_Francisco` resolves even though it is not the canonical URL.
  - *As a reader who types or pastes* `/San_Francisco`*, I want to land on the San Francisco Topic
    page — article + curated clips — without ever seeing an error first, so the shorthand feels
    like a real, supported way in.* (AC1)
  - *As a reader who can't see the screen, when I hit a bare URL that redirects, I want to hear
    that the page is loading the topic I asked for — not be left in silence wondering whether the
    link worked.* (a11y, below)

- **The reader who follows a stale or guessed bare link.** Someone shares (or mis-remembers) a
  bare path that turns out not to be a real article.
  - *As a reader who follows a bare link to something that isn't a topic, I want a clean,
    readable "not found — back home" dead end, not a raw error, a blank page, or a spinner that
    never resolves.* (AC5)

These stories feed Product's acceptance criteria; they are not re-stated as criteria here.

---

## The redirect transition — the one real UX concern

A bare path enters through the SPA shell on the not-found boot (GitHub Pages serves `404.html` =
the copied `/topic/` shell; local `next dev` renders Next's not-found). The shell runs the
allowlist check, decides the path is a bare title, and calls `router.replace` to swap the URL to
`/topic/<Title>/`. `TopicView` then resolves the title and loads the article — the normal Topic
flow.

The risk this spec exists to prevent: a visible **"Topic not found." flash, then a bounce** to the
Topic page. That reads as a broken link that somehow recovered, not as a feature. It is jarring,
and for a screen-reader user it can mean hearing a not-found message that is immediately
contradicted.

### The required visible sequence

For a bare title that **is** a real topic:

1. **Land directly in the Topic loading state.** The first paint the user perceives is the
   **existing Topic loading UI** — `ArticleSkeleton` on the left, the rest of the page chrome
   resolving as it normally does on any cold load of `/topic/<Title>/`. The user must **never**
   see the "Topic not found." resolve-error copy first.
2. **URL settles to the canonical form.** During or before that first meaningful paint, the
   address bar reads `/topic/San_Francisco/` (the `router.replace` hop). Underscore form per #11.
3. **Resolve + load completes normally.** Skeleton → populated Topic page, identical to a direct
   load of the canonical URL. From the moment the skeleton appears, the experience is
   indistinguishable from having typed the canonical URL.

The net felt experience: **one continuous load that ends on the Topic page.** No flash, no
flicker of error copy, no perceptible "bounce." The Back button returns the user to wherever they
came from, not to the transient bare URL (this is why the redirect uses `router.replace`, not
`push` — the recommendation in the Product spec's Open questions; UX concurs, as it matches the
existing `?qid=` canonicalization at `TopicView.tsx` line 105).

### Transient chrome / "redirecting…" copy

**Do not** add a dedicated "Redirecting…" screen or visible interstitial for the visual surface.
The correct visible affordance is the **normal Topic loading state we already ship** — adding a
distinct redirect screen would make a one-hop transition feel like two steps and contradict
"it just worked." The only place a transient signal is warranted is the **non-visual / a11y
channel** (next section), and only if the destination's existing announcements don't already cover
the hop.

> **Implementation note for Dev — avoid the not-found flash.** The hazard is ordering: if the
> shell paints `TopicView` before the `router.replace` resolves the path to a title, `routeTitle`
> is `null`, no `?qid=` is present, and `TopicView` short-circuits to the `resolveError` branch
> (`TopicView.tsx` lines 441–450) — the "Topic not found." flash this spec forbids. The redirect
> decision must take effect **before** that branch can render: the bare-path boot path should
> redirect (or render a neutral loading shell) rather than mount the resolve-error UI for a path
> it is about to redirect. The user must land in the loading state, not the not-found state, on
> the way to a real topic. This is the single most important behavioral requirement of this spec.

---

## States

Enumerated for completeness. **No new state, error, empty, or loading UI is introduced** — every
outcome routes into a state that already exists.

| # | Input | Behavior | Destination state |
|---|---|---|---|
| a | **Bare title that IS a real topic** (`/San_Francisco`) | Allowlist → bare title → `router.replace('/topic/San_Francisco/')` → resolve + load | Existing **Topic loading state** (`ArticleSkeleton`) → existing **populated Topic page**. No flash of not-found. (AC1) |
| b | **Bare title that is NOT a real topic** (`/Qwxzy_Not_A_Real_Article`) | Allowlist → bare title → `router.replace('/topic/Qwxzy_Not_A_Real_Article/')` → resolve fails | Existing **graceful not-found / resolve-error** state — the "Topic not found. [Back home]" copy at `TopicView.tsx` lines 441–450. A finite, readable dead end. (AC5) |
| c | **Reserved path** (`/`, `/contribute`, `/topic/...`, `/_next/...`, a `.`-extension asset, a `:`-namespace path) | Allowlist → reserved → **no redirect** | Unchanged from today — the route renders / the asset is served / the path degrades exactly as it does now. (AC2) |
| d | **Multi-segment path** (`/foo/bar`, no reserved prefix) | Not a single segment → **no redirect** | Existing **graceful not-found** (the SPA shell's no-resolvable-route end state). (AC7) |

### Confirming destination (b) reads as "handled," not "raw error"

The resolve-error branch in `TopicView.tsx` renders:

> Topic not found. **Back home**

with "Back home" as an `/` link styled `text-action underline`. This is a calm, plain-language
dead end with a clear recovery action — it reads as **"we handled this; here's the way out,"** not
as a stack-trace or a blank page. **It is the correct destination for case (b)** and this spec
**reuses it unchanged** — no new copy, no new "this bare path didn't match" variant. A reader who
follows a stale bare link gets the same graceful, recoverable end state as any other unresolvable
Topic. (If Curation/Editorial or Product later wants warmer not-found copy, that is a separate,
cross-cutting change to the existing state — explicitly **out of scope** here.)

**No infinite spinner, ever.** Case (b) must terminate in the resolve-error state, not hang in
the loading skeleton. This is the existing resolver's behavior; the redirect must not break it.

---

## Accessibility

A client-side `router.replace` changes the route **without a full page load**, so the browser does
**not** do its native "new page" focus reset or title announcement. Left unhandled, a
screen-reader user can be stranded: the URL changed, content is loading, but nothing was announced.
This is the only real a11y concern in the change.

Required handling:

- **Screen-reader announcement covers the hop.** A non-visual user must learn that the topic they
  asked for is loading. The destination Topic page already loads through a state that should
  announce progress; the redirect must land in that flow such that the announcement covers the
  transition (the user hears the topic loading, not silence). **Confirm in implementation** that
  the existing Topic loading flow announces for this entry path.
  - **Caveat for Dev (verified against current code):** the existing polite live region in
    `TopicView.tsx` (lines 524–526) is **gated to `mode === "empty"`** and only carries
    *candidate-search* status ("Looking for suggested videos…"), and the rail's
    "Looking for suggestions…" line is likewise empty-mode-only. **Neither announces the
    title-resolve / article-load hop for a curated or just-redirected topic.** So the existing
    live region does **not**, as written, cover the redirect for the common (real, curated) case.
    Development must ensure the redirect hop is announced — see the next bullet for the minimal
    way to do that.
- **If — and only if — the destination's loading flow does not already announce, add one polite
  live-region announcement** at the redirect boundary. Keep it minimal and polite (`role="status"`
  / `aria-live="polite"`), text only, no visual chrome. Proposed exact string:
  > **Loading topic…**
  This is sufficient, honest, and not contradicted by a later not-found (it says "loading," not
  "found"). Prefer a single neutral announcement over a chatty "Redirecting you to…". Do **not**
  announce the not-found copy *before* the load resolves (that would mislead).
- **Focus is not stranded.** After the `router.replace`, keyboard focus must not be lost to
  `document.body` in a way that drops the user out of the document or strands them on a
  now-removed node. Focus should rest somewhere sensible in the loading/loaded Topic page (the
  page's normal initial focus is acceptable). Keyboard users must be able to Tab into the page and
  use the "Back home" link if they land on the not-found state (case b). No focus trap.
- **No contrast / color / visual change.** This change adds no color-coded signal and alters no
  contrast, focus ring, or visible styling. The committed AA baseline is unaffected and must not
  regress.

---

## Microcopy

**Preferred: none.** The redirect routes into existing states whose copy is unchanged — the
loading skeleton (no text) and the existing "Topic not found. Back home" resolve-error.

**One conditional string, a11y-only:** if the destination's loading flow does not already announce
the hop to assistive tech (see Accessibility — and per the code caveat above, it currently does
not for the curated case), add exactly:

> **Loading topic…**

in a polite, screen-reader-only live region. This is **not** visible product copy and **not** a
"redirecting" interstitial — it exists solely so a non-visual user isn't left in silence during
the route swap. No other new string is needed or wanted.

---

## Responsive

**No layout or responsive impact.** The change is confined to a URL swap and which already-built
state the SPA shell routes into; it touches no element box, breakpoint, column, sticky behavior,
or the web-first responsive two-column → stacked layout of the Topic page
(`docs/TOPIC_PAGE_DESIGN.md`). Untouched at every breakpoint.

---

## Hand-off to Development

Build per the Product spec `docs/specs/bare-path-redirect.md` (AC1–AC11 — allowlist predicate,
client redirect on the SPA-shell/not-found boot, #11 encoding reuse, query+hash preservation, loop
guard, tests). The **UX contract** this spec adds on top of that:

1. **No not-found flash.** A bare title that is a real topic must land **directly in the existing
   Topic loading state**, never the "Topic not found." resolve-error copy first. The redirect
   decision must take effect before `TopicView`'s `resolveError` branch (lines 441–450) can render
   for a path that is about to redirect. (The single most important behavioral requirement here.)
2. **One smooth hop, `router.replace`.** Exactly one history-replacing redirect, so the Back
   button skips the transient bare URL. Matches the existing `?qid=` canonicalization.
3. **Route into existing states only.** Real topic → existing loading → populated page. Non-topic
   bare title → existing graceful "Topic not found. Back home" state, unchanged. Reserved /
   multi-segment → unchanged behavior. **Add no new error/empty/loading/microcopy/layout.**
4. **A11y: announce the hop, don't strand focus.** Ensure the route swap is announced to assistive
   tech (the existing live region does **not** cover the curated/real-topic case — see the
   Accessibility caveat). If not already covered, add a single polite, screen-reader-only
   "**Loading topic…**" announcement at the redirect boundary. Keep focus inside the document; no
   trap; the "Back home" link must be keyboard-reachable on the not-found end state.

## Evaluation (UX built-UI pass, after Development)

Judge against this spec + the stories. Confirm:

1. Hard-loading `/San_Francisco` lands on `/topic/San_Francisco/` and renders the Topic page with
   **no visible "Topic not found." flash** on the way — the first thing seen is the loading state,
   then the populated page. (AC1, transition contract)
2. `/Qwxzy_Not_A_Real_Article` redirects once and ends on the **existing** "Topic not found. Back
   home" state — finite, readable, recoverable; no spinner that never resolves, no loop. (AC5)
3. Reserved paths (`/`, `/contribute`, `/topic/...`, assets, `:`-namespace) behave exactly as
   before; `/foo/bar` ends in graceful not-found. (AC2/AC7)
4. The route swap is announced to a screen reader (or the added "Loading topic…" polite live
   region fires); keyboard focus is not stranded and the "Back home" link is reachable.
5. No new error/empty/loading UI, no new visible microcopy, no contrast/focus/layout change at any
   breakpoint.

A pass returns to Operations via the loop; any design defect routes back to **Development**.
