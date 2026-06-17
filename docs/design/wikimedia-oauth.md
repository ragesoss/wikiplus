# Design contract: Wikimedia OAuth login — "Log in with Wikipedia" (milestone C)

**Issue:** milestone item **C** ("Log in with Wikipedia") · **Type:** build (the **first user-facing identity surface**)
**Role:** UX / Design · **Builds from:** Product spec `docs/specs/wikimedia-oauth.md` (AC1–AC14; UX serves the user-facing **AC1, AC2, AC5, AC10, AC11** and must not contradict AC4/AC6–AC9/AC12)
**Parent epic:** [#35](https://github.com/ragesoss/wikiplus/issues/35) — Functional-prototype MVP, section **C**
**Builds on:** [#45](https://github.com/ragesoss/wikiplus/issues/45) — shared Postgres behind a Server-Actions write boundary; the `contributor`/`account` tables are Auth.js-adapter-shaped and unused by writes; interim writes attribute to a stub `@prototype`. **Inherits the async-write / focus / live-region conventions** from `docs/design/persistence-postgres.md` (pending/failure UX, polite live regions, "never yank focus on failure", honest copy in the existing error slot).
**Feeds:** Development (build to this contract) · **Evaluated by:** UX (AC2/AC5/AC10/AC11 walk) + QA & Review (correctness/security).

---

## Framing — what C changes for the user, in one paragraph

Reading stays **completely anonymous** (AC11): a logged-out reader sees the entire product exactly as
today, with **one** addition — a sign-in affordance in the header. The only place login becomes
*required* is **contribution** (CURATION §7): the real persisted writes (`/contribute` add,
candidate **dismiss**) and the in-product **Curate / Add-video** entry points. C's make-or-break UX
(AC10 / Decision D7) is that a logged-out contribute attempt **always resolves to a clear "Log in
with Wikipedia" prompt** — never a dead end, a silent no-op, a server error, or a false "saved." This
doc specifies three surfaces (header affordance, logged-out contribute experience, return-from-OAuth),
each in all four states (signed-out / signed-in / in-progress / error), with microcopy, responsive
behavior, accessibility, and a component breakdown.

> **Scope guard (do not design these — they are D):** wiring `CurateModal` / `AddModal` to real
> persistence (D4), edit/delete-your-own, contributor profiles, the CC BY-SA agreement field at
> submit, upvote identity. C **gates the boundary** those flows call and **specifies their
> logged-out behavior** (prompt to log in); it does **not** make the modals persist. Where this doc
> touches a modal it is *only* to specify what a **logged-out** user sees on its trigger.

---

## Personas & stories served

Two personas (no new ones; the moderator persona is later).

### The reader who lands on a Topic page (anonymous, AC11)
- *As a reader, I want the whole page — article, TOC, curated clips, candidate suggestions, the
  pinned player, search, wikilinks — to work with no login wall, so I can read and weigh a topic
  without an account.* (AC11)
- *As a reader, I want a single, unobtrusive way to sign in if I decide to contribute, located
  consistently in the header, so I'm never hunting for it and it never interrupts reading.* (AC1)
- *As a reader using a screen reader or keyboard, I want the sign-in control and the signed-in
  identity to be a normal, labeled, keyboard-operable part of the header.* (a11y / AC1)

### The curator / contributor
- *As a curator, I want to sign in with my **Wikipedia/Wikimedia account** so the clips I curate, the
  notes I write, and the candidates I rule out are tied to **my** Wikimedia identity — an accountable
  vouch, not an anonymous edit.* (AC1, AC2, AC6, AC8)
- *As a logged-out person who clicks **Curate** / **Add video** / **Not relevant**, or opens
  `/contribute`, I want to be told plainly "log in with Wikipedia to do this" and given the button —
  not a silent failure, an error, or a fake success.* (AC10 / D7 — the make-or-break story)
- *As someone returning from authorizing at meta.wikimedia.org, I want to land back where I was, see
  that I'm now signed in (my username), and be able to continue, so the round-trip doesn't feel like
  it lost my place.* (AC1, the return moment)
- *As a signed-in curator, I want to see who I'm signed in as and a clear way to sign out; after I
  sign out, the product returns to the anonymous state and contributing is gated again.* (AC2, AC5)
- *As a curator mid-OAuth, I want the in-progress state to be visible (not a frozen button) and, if I
  cancel or the provider fails, an honest error with a way to try again — never a stuck spinner.*
  (in-progress + error states)

These feed Product's AC1/AC2/AC5/AC10/AC11; they are not restated as criteria here.

---

## The auth model that shapes the UX (from the spec / ARCHITECTURE — not relitigated)

The UX must reflect these mechanics; Development owns their implementation:

- **Full-page redirect round-trip.** "Log in with Wikipedia" sends the browser to
  `meta.wikimedia.org` to authorize, then back to a wiki+ callback. This is **not** an in-page modal
  auth — it is a navigation away and back (Auth.js `signIn("wikimedia")`). The UX therefore spans a
  **redirect boundary**: state and focus do not survive it the way an in-page interaction would. The
  spec design points below address that boundary explicitly.
- **JWT session, no per-read DB lookup** (AC4). Whether the header renders signed-in or signed-out is
  resolved from the session, **not** a per-render DB hit. The reader read path stays free of auth work.
- **Wikimedia only** (D2). One provider, one button. Copy says "Wikipedia" (the user-facing name);
  the provider id is `wikimedia`. No Google button, no provider chooser, no email/password field.
- **Identity shown = the Wikimedia username** (AC2), e.g. `Ragesoss`. Avatar only if trivially
  granted (D5) — the design must degrade gracefully when there is no avatar.
- **The gate is server-side** (D1). The UI prompt is a courtesy, not the security control; a
  logged-out user who somehow reaches a write action is rejected at the boundary (AC7/AC8). So our
  job is to make the *common* path never hit that rejection blindly — surface the login prompt
  *before* the write — while knowing the boundary is the real guard.

---

## Surfaces & flows overview

```
                      ┌─────────────────────────── HEADER (every page) ───────────────────────────┐
  signed-out reader → │  [ Log in with Wikipedia ]                                                  │
                      └────────────────────────────────────────────────────────────────────────────┘
                                   │ click
                                   ▼
                      full-page redirect → meta.wikimedia.org (authorize)  ──(in-progress)──┐
                                   │ authorize                                              │ deny / cancel / fail
                                   ▼                                                        ▼
                      return to wiki+ callback → land back on origin page          land back + ERROR state
                      (signed-in: header shows username + Sign out)                (header still signed-out +
                                                                                    honest "couldn't sign in" notice)

  CONTRIBUTE ENTRY POINTS (logged-out):  /contribute page · Curate · Add video · Not relevant (dismiss)
        each → an explicit "Log in with Wikipedia" PROMPT (never a dead end / no-op / error / false save)
```

**Three surfaces specified below:**
1. **Header sign-in affordance** (§1) — on both the home/contribute header and the Topic `TopicHeader`.
2. **Logged-out contribute experience** (§2) — the AC10 make-or-break; the page and each control.
3. **Return-from-OAuth moment** (§3) — where the user lands and the transition to signed-in.

Then: **all states matrix** (§4), **microcopy table** (§5), **responsive** (§6), **accessibility** (§7),
**visual/Indigo-Press spec** (§8), **component breakdown for Dev** (§9), and the **evaluation
checklist** (§10).

---

## §1 — Header sign-in affordance

There are **two header surfaces** in the app today; the affordance must appear in **both**, styled to
each. (This replaces the hardcoded stub identity: `app/topic/TopicView.tsx` `IDENTITY = "@sage"` and
the `TopicHeader` `identityHandle` pill, and the `AddModal` `identityHandle` prop, all become driven
by the **real session**.)

### 1a. The auth control component (one component, two skins)

A single client component — **`AuthControl`** — renders one of three things based on session state.
It is placed into both headers. It must render **identically for SSR and first client paint as the
signed-out affordance** to avoid a hydration flash (see a11y §7); the signed-in identity resolves
client-side from the session on mount (same pattern as the existing store-read effects).

**State: signed-out → a single action.**
- Label: **"Log in with Wikipedia"** (full), with a Wikipedia/W-mark glyph (`aria-hidden`) to the
  left. On the narrowest header (Topic header `< lg`, see §6) the label may abbreviate to **"Log in"**
  with the same glyph and an `aria-label="Log in with Wikipedia"`.
- It is a real `<button>` (it triggers `signIn`), not a link, with `type="button"`.
- Activating it begins the OAuth round-trip (in-progress state, §4).

**State: signed-in → identity + menu.**
- Shows the **avatar** (if present) or an initial-blocked fallback (first letter of the username on a
  brand fill), then the **Wikimedia username** (e.g. `Ragesoss`).
- The username + avatar form a **disclosure button** (`aria-haspopup="menu"`, `aria-expanded`)
  opening a small menu with **one** item for C: **"Sign out."** (Future D items — "My curations,"
  "Profile" — slot into this menu; build it as a menu, not a bare button, so D is additive.)
- Rationale for a menu over a bare "Sign out" link: keeps the header uncluttered, gives D a home,
  and matches the conventional account-menu mental model. If Dev prefers to ship C with the username
  as a static label + a visible "Sign out" button (no disclosure) to avoid adding a menu primitive,
  that is an **acceptable C-only simplification** — but it must still be keyboard-operable and
  labeled, and D will then introduce the menu. **Default: the disclosure menu** (spec'd in §9).

**State: in-progress → the button reflects it.** See §4; the control disables and its label becomes
**"Connecting…"** with `aria-busy="true"` for the brief moment before the browser actually navigates
away.

### 1b. Placement — home / contribute header (`app/page.tsx`, and the `/contribute` chrome)

The home header today is a simple flex row: the `wiki+` wordmark (left) and a "Contribute" link
(right), with the topic search below. Place `AuthControl` **at the right end of that top row**, after
"Contribute":

```
 wiki+                         Contribute   |   [ Log in with Wikipedia ]
 ───────────────────────────────────────────────────────────────────────
 [ topic search ............................................. ]
```

- Signed-out: the "Log in with Wikipedia" button, **action-blue** (`bg-action`, white text — AA 5.58).
- Signed-in: avatar/initial + username + caret, opening the Sign-out menu.
- **`/contribute`** currently has **no app header** (the form renders in a bare `max-w-xl` container).
  §2 requires a minimal header row on `/contribute` so the auth affordance and the login prompt have a
  home; reuse the same home-header top row (wordmark + `AuthControl`) above the form.

### 1c. Placement — Topic page header (`components/topic/TopicHeader.tsx`)

The Topic header is the split-wordmark two-world bar. The **＋plus side is where all plus identity
lives**, so the auth affordance belongs in the **＋plus block** (the indigo `bg-brand` block on the
right at `lg+`), replacing the current stubbed `identityHandle` pill:

```
 Wiki  [search…]            Photosynthesis │ ＋plus  curated video        [ Log in with Wikipedia ] │
                                            └──────────────── bg-brand (indigo) block ─────────────┘
```

- **Signed-out (`lg+`):** within the indigo block, a **white-bordered "Log in with Wikipedia" button**
  (`bg-white text-action`, or `bg-brand` darker-on-hover) sitting where the stub pill was. Must clear
  AA on the indigo block — use **white fill + action/ink text**, not indigo-on-indigo.
- **Signed-in (`lg+`):** the avatar/initial + username inside the block (white text on indigo, AA via
  white text 4.7:1+), as a disclosure opening the Sign-out menu. This is the real version of today's
  decorative chip (which showed `@sage · signed in`).
- **The ＋plus block is `hidden < lg`.** Below `lg`, the Topic header collapses to the Wiki row only.
  The auth affordance must **not vanish on mobile** (a curator on a phone must be able to log in /
  see who they are). Two options — **pick A** unless Dev finds it crowds the bar:
  - **A (preferred):** add a compact `AuthControl` to the **Wiki row's right end** on `< lg` (after
    the search disclosure): a small **"Log in" button** (signed-out) or **avatar/initial disclosure**
    (signed-in). It is the same component in its compact skin.
  - **B (fallback):** surface the auth affordance only at the point of need — i.e. the logged-out
    contribute prompts (§2) carry their own "Log in with Wikipedia" button, so a phone user who never
    contributes never needs the header control. **A is preferred** because "see who I am / sign out"
    should not require starting a contribution.

### 1d. The stub-identity cleanup (required, in-scope for the header to be honest)

C must remove the **hardcoded stub** so the header tells the truth (AC2: "not `@prototype`, not
'anonymous'"):
- `app/topic/TopicView.tsx`: drop the `IDENTITY = "@sage"` constant and the
  `identityHandle={mode === "empty" ? IDENTITY : undefined}` prop wiring; the Topic header's identity
  now comes from the session via `AuthControl`, in **both** modes (not only empty), and only when
  actually signed in.
- `components/topic/TopicHeader.tsx`: the `identityHandle` prop is replaced by rendering `AuthControl`.
- `components/topic/AddModal.tsx`: the `identityHandle` "signed in as …" pill becomes the **real**
  username (a logged-out user never reaches a *functional* Add modal — see §2; if the modal is shown
  at all in C it is behind the gate). Since C does **not** wire the modal to persistence (D4), the
  cleanest C behavior is to **gate the modal's trigger** (§2) so the modal only opens when signed in,
  and then the pill shows the real username.

---

## §2 — Logged-out contribute experience (AC10 — the make-or-break)

**The rule (D7):** every contribute attempt by a logged-out user resolves to an explicit **"Log in
with Wikipedia"** prompt. Never: a dead end, a silent no-op, a thrown server error surfaced raw, or a
false "saved." There are **four entry points**; each gets a specified logged-out behavior.

### The decided pattern: gate-at-trigger with an inline login prompt; do NOT resume the action post-login

Two decisions, stated with rationale so Dev doesn't guess:

**Decision UX-1 — Gate at the *trigger*, with an inline prompt, not a redirect-on-click.**
When a logged-out user activates a contribute control, **show an inline "Log in to contribute" prompt
in place** (a small panel / dialog appropriate to the control), rather than silently bouncing them to
meta.wikimedia.org. Why inline-first:
- It's **honest and non-surprising**: the user clicked "Curate," and instead of being teleported to
  Wikipedia with no explanation, they're told *why* ("Contributing requires a Wikipedia login") and
  *then* choose to proceed. This is the D7 "never a dead end / never surprising" intent.
- It keeps the **anonymous reading experience** intact — the prompt is the only thing that changed; we
  didn't turn a curiosity click into a forced navigation.
- The prompt's button **is** the redirect (`signIn`), so it's one extra click, not a wall.

**Decision UX-2 — After login, the user lands back signed-in but the action does NOT auto-resume.**
The user returns from OAuth to the **same page, signed-in**, and **re-initiates** the action (clicks
Curate again, now succeeding). The intended action is **not** replayed automatically. Why:
- **Correctness & honesty over cleverness.** Auto-resuming a *content-bearing* action across a
  full-page redirect boundary is fragile (the in-flight form state — a half-typed context note,
  the selected candidate — does not reliably survive the navigation away to meta.wikimedia.org and
  back). A dropped-then-silently-resumed write risks exactly the **false-success / silent-loss**
  failure D7 forbids.
- For C the gated actions are **lightweight to re-initiate**: clicking "Curate" again, "Not relevant"
  again, or re-opening `/contribute` is trivial. There is no long form to lose because **C does not
  wire the curate/add modals to persistence** (D4) — the only real form is `/contribute`, and
  re-initiating it is acceptable (see the `/contribute` handling below for how we minimize re-entry).
- **D can revisit** intent-resume for its richer authoring flows (e.g. preserve a draft note in
  `sessionStorage` keyed by candidate, restore after login). For C, the contract is: **return
  signed-in to the same place; the user finishes the action with one more click.** This is recorded
  as the C decision; D is free to add resume.

> **Net AC10 guarantee:** logged-out trigger → inline "Log in with Wikipedia" prompt → (user chooses)
> redirect → return signed-in to the same page → user completes the now-permitted action. At no point
> is there a silent failure or a false success.

### 2a. Entry point: visiting `/contribute` while logged out

`/contribute` is a real route a logged-out user can navigate to directly (typed URL, the home
"Contribute" link, the `?qid=` deep link). Today it renders the full add form. Logged-out behavior:

- **Replace the form with a login-gate panel** (do not render the form fields to a logged-out user —
  rendering an interactive form they can't submit is the "dead end / false affordance" D7 forbids).
  The page shows:
  - A heading: **"Add a clip"** (kept, so the user knows they're in the right place).
  - A gate panel (the **`LoginPrompt`** component, §9): icon + **"Log in with Wikipedia to contribute"**
    + one line of context (microcopy §5) + the **"Log in with Wikipedia"** primary button + a quiet
    **"Browse topics instead →"** link back to `/`.
- **Preserve the `?qid=` across login** so the user lands back on `/contribute?qid=Q…` signed-in with
  the QID still prefilled. Mechanism: `signIn("wikimedia", { callbackUrl: <current path+query> })`
  (Auth.js carries `callbackUrl`). This is the one piece of "resume" C *does* keep — it's a URL param,
  not in-memory form state, so it survives the redirect reliably. After return, the full form renders
  with the QID prefilled exactly as today; the user types the rest (no note was lost because they
  hadn't typed one yet — the gate showed before the form).
- **Signed-in:** the page renders the existing add form unchanged (the §4 success/pending/failure
  behavior is the inherited persistence-doc contract, plus the write now attributes to the real
  contributor per AC6).

### 2b. Entry point: **Curate** (Promote) on a candidate card / "Be the first to curate"

The candidate **Curate** button (`CandidateActions`, `aria-haspopup="dialog"`) and the infobox
**"✦ Be the first to curate"** button both open `CurateModal` today (`setCurateOpen(true)`).
Logged-out behavior:

- On activation while **logged out**, **do not open `CurateModal`.** Instead open the **`LoginPrompt`
  as a small modal dialog** (reusing `ModalShell` for the focus-trap/Esc/return-focus behavior —
  §7), titled **"Log in to curate"**, body microcopy §5, with the **"Log in with Wikipedia"** primary
  button and a **"Cancel"** secondary that returns focus to the triggering control.
- The `callbackUrl` for this `signIn` is the **current Topic page URL** (so the user returns to the
  same topic signed-in). Per UX-2 the curate modal is **not** auto-opened on return — the user clicks
  Curate again, now opening the real `CurateModal` (which in C is still the mock submit, D4).
- **Signed-in:** unchanged — opens `CurateModal` as today.
- **Why a modal here (not an inline panel):** the trigger is itself a dialog-opening control
  (`aria-haspopup="dialog"`); swapping one dialog (curate) for another (login) is the least
  surprising substitution and reuses the existing modal a11y machinery.

### 2c. Entry point: **Add video** ("＋ Add video" in the General strip)

The `onAdd` button opens `AddModal` today. Logged-out behavior mirrors **2b**: open the `LoginPrompt`
modal titled **"Log in to add a video,"** not `AddModal`. Signed-in: opens `AddModal` (real username
in its pill; still mock submit in C per D4).

### 2d. Entry point: **Not relevant** (dismiss) on a candidate

This is the subtlest one. Dismiss is a **real persisted write** in C (`recordDismissalAction`, gated
by AC8) and today it is **optimistic with rollback** (hides the card instantly, persists in the
background, re-shows on failure — `persistence-postgres.md`). For a **logged-out** user the write
will be rejected at the boundary (AC8), so an optimistic hide would be a **false success** (the card
vanishes but nothing persisted) — exactly what D7 forbids.

**Logged-out dismiss behavior:**
- **Do not optimistically hide the card.** On a logged-out **Not relevant** click, **do not** call
  `setDismissed` first. Instead, show the **`LoginPrompt`** — because dismiss is a small, in-rail
  action and a modal would be heavy for it, prefer an **inline prompt**: a compact, non-blocking
  **"Log in to dismiss"** line that appears **attached to that candidate card** (replacing or beneath
  its action row), with a small **"Log in with Wikipedia"** button and a **"Not now"** dismiss-the-prompt
  control. The card stays visible (honest: nothing was dismissed).
  - If an inline-per-card prompt is too fiddly to build cleanly, the **acceptable fallback** is the
    same `LoginPrompt` **modal** used in 2b/2c, titled **"Log in to dismiss this suggestion."** Either
    is correct; the binding rule is **no optimistic hide while logged out** and an explicit prompt.
- `callbackUrl` = the current Topic URL. Per UX-2, the dismissal is **not** auto-replayed on return;
  the user clicks "Not relevant" again, now signed-in, and the normal optimistic-with-rollback path
  runs.
- **Signed-in:** unchanged — the existing optimistic-with-rollback dismissal (`persistence-postgres.md`).

> **Implementation seam (so the gate is consistent):** the three handlers in `TopicView`
> (`promote`, `curateFirst`, `onAdd`, `dismiss`) each first check session state; if logged out they
> route to the prompt instead of their action. A single helper — `requireLogin(action, opts)` — that
> either runs `action()` (signed-in) or opens the prompt with the right title + `callbackUrl` (logged
> out) keeps all four entry points consistent and is the natural place the **server boundary's**
> rejection (AC7/AC8) is also caught and surfaced as the same prompt (defense in depth: if a session
> expired between render and click, a boundary `AuthError` is caught and shown as "Your session
> ended — log in again," not a raw error — see §4 error state).

---

## §3 — Return-from-OAuth moment

After authorizing at meta.wikimedia.org, Auth.js returns the browser to the wiki+ callback, which
redirects to the **`callbackUrl`** we passed (the page the user was on). The UX of that landing:

- **Land on the origin page, signed-in.** Because every `signIn` call sets `callbackUrl` to the
  current path+query (§2), the user returns to **the same page they left** — the same Topic, the home
  page, or `/contribute?qid=…` — now in the signed-in state. They are **not** dumped on a generic
  "/account" or home page. (AC1: "returns to wiki+ in a signed-in state.")
- **The header now shows the username** (AC2). The transition the user perceives: the page loads
  (normal load), and the header's `AuthControl` resolves to signed-in (avatar/initial + username +
  Sign-out menu) instead of the "Log in" button. Because the header reads the JWT session (AC4, no DB
  hit), this resolves immediately on the page's first authenticated render — there is **no separate
  "you're now logged in" interstitial screen**, and none should be added.
- **A brief pending state on return is allowed but bounded** (§4 in-progress): if the session/identity
  needs a beat to resolve client-side, the header may show a neutral **"…"/skeleton chip** for that
  instant rather than flashing the "Log in" button and then swapping to the username (which would look
  like a glitch). The signed-out → signed-in swap must be **one clean step**, never a flicker back and
  forth. Prefer rendering the signed-out affordance only once we know there is no session.
- **No auto-resume of the gated action** (UX-2). The user lands signed-in on the topic; if they came
  from clicking "Curate," they click "Curate" again (now opening the real modal). The exception is
  `/contribute?qid=` whose QID is preserved by the URL (§2a).
- **A subtle confirmation is welcome, not required.** A small, polite, auto-dismissing confirmation —
  e.g. a one-line **"Signed in as Ragesoss"** announced to AT and optionally shown as a brief toast —
  helps orient the user. If built, it must be **polite/non-blocking** (reuse the live-region pattern),
  must **not** steal focus, and must **not** be a blocking modal. Keeping it to the header swap +
  an AT announcement is sufficient for C.

---

## §4 — Every state (the gate — all four, every surface)

| State | Header affordance | `/contribute` page | Curate / Add / Dismiss triggers | Return-from-OAuth |
|---|---|---|---|---|
| **Signed-out** | "Log in with Wikipedia" button (action-blue on light headers; white-fill on the indigo ＋plus block). Compact "Log in" on narrow Topic header. | `LoginPrompt` gate panel replaces the form (no form fields rendered). `?qid=` preserved into `callbackUrl`. | Activation opens a `LoginPrompt` (modal for Curate/Add; inline-or-modal for Dismiss). **Dismiss is NOT optimistically hidden.** | n/a |
| **Signed-in** | Avatar/initial + Wikimedia username + caret → disclosure menu with **Sign out**. | The existing add form, unchanged; write attributes to the real contributor (AC6); pending/success/failure per the inherited persistence contract. | Opens the real `CurateModal` / `AddModal` (mock submit in C, D4) / runs the optimistic-rollback dismiss. | Lands here: header swaps to signed-in in one clean step; same page; no interstitial. |
| **In-progress (auth round-trip)** | The clicked control disables, label → **"Connecting…"**, `aria-busy="true"`, for the brief moment before the browser navigates to meta.wikimedia.org. (After navigation the wiki+ page is gone; the provider's own page is shown.) On **return**, an allowed brief neutral chip while the session resolves — never a signed-out→signed-in flicker. | If the gate's "Log in" was clicked: same "Connecting…" on that button, then navigation away. | The `LoginPrompt`'s "Log in with Wikipedia" button shows "Connecting…" / `aria-busy` before navigating away. | The bounded pending chip above. |
| **Error (denied / cancelled / provider failure)** | Header returns to / stays in **signed-out** state. An **honest, non-blocking notice** is shown near where login was initiated (or at the top of the page on return to the callback with an error param): copy §5. A **"Try again"** affordance = the same "Log in with Wikipedia" button. Never a stuck spinner, never a raw stack/500. | Same gate panel re-shown signed-out, with the error notice above the "Log in with Wikipedia" button. | The `LoginPrompt` stays open (or re-opens) showing the error notice + the button as Try-again. | If OAuth returned an error, the user lands back **signed-out** on the page with the error notice; the header is the "Log in" button (Try again). |

**Error taxonomy (keep it minimal — D7 / the persistence doc's "don't over-engineer error
taxonomy"):** two user-facing cases, distinguished only because the copy differs:
- **User cancelled / denied** at meta.wikimedia.org (Auth.js `error=AccessDenied` / `OAuthCallback`
  with a cancel): copy is gentle — **"Login cancelled. You can try again whenever you're ready."**
- **Provider / network failure** (Auth.js `Configuration` / `OAuthCallback` errors, timeout):
  **"Couldn't sign in just now — please try again."** (Same honest-error register as the persistence
  doc's "Couldn't save your clip — please try again.")
- A **session that expired between render and a write click** (caught at the boundary, AC7/AC8):
  **"Your session ended — please log in again."** shown via the same prompt.

All three are **non-blocking** and resolve by the user pressing the same "Log in with Wikipedia"
button (Try again). No error is a modal the user can't escape; none dumps a raw error.

---

## §5 — Microcopy (exact strings — Dev uses these verbatim)

| Context | String |
|---|---|
| Header sign-in (full) | **Log in with Wikipedia** |
| Header sign-in (narrow/compact) | **Log in** (with `aria-label="Log in with Wikipedia"`) |
| In-progress button label | **Connecting…** |
| Signed-in identity (visible) | the Wikimedia username verbatim, e.g. **Ragesoss** (no leading `@`; it is a Wikimedia username, not a social handle — distinct from creator handles which keep their `@`) |
| Signed-in disclosure `aria-label` | **Account: {username}** |
| Sign-out menu item | **Sign out** |
| Post-logout (optional polite announce) | **Signed out.** |
| Post-login (optional polite announce / toast) | **Signed in as {username}.** |
| `/contribute` gate heading | **Add a clip** |
| `/contribute` gate panel title | **Log in with Wikipedia to contribute** |
| `/contribute` gate panel body | **Contributing — adding a clip and writing its context note — requires a Wikipedia login, so your curation is tied to your Wikimedia identity. Reading stays anonymous.** |
| `/contribute` gate secondary link | **Browse topics instead →** |
| Curate gate (modal) title | **Log in to curate** |
| Curate gate body | **Writing a context note and vouching for a clip requires a Wikipedia login. Log in to curate this clip.** |
| Add-video gate (modal) title | **Log in to add a video** |
| Add-video gate body | **Adding a video by link requires a Wikipedia login. Log in to add and curate a clip.** |
| Dismiss gate (inline/modal) title | **Log in to dismiss this suggestion** |
| Dismiss gate body | **Ruling a suggestion out is a curation action and requires a Wikipedia login.** |
| Gate primary button (all gates) | **Log in with Wikipedia** |
| Gate secondary (modal gates) | **Cancel** |
| Dismiss inline gate secondary | **Not now** |
| Error — cancelled | **Login cancelled. You can try again whenever you're ready.** |
| Error — provider/network | **Couldn't sign in just now — please try again.** |
| Error — expired session at write | **Your session ended — please log in again.** |

Tone: plain, neutral, librarian register (matches CURATION §1.3 and the persistence doc's honest-error
copy). No hype, no "Join wiki+!", no exclamation beyond none. Every gate states **why** (accountability
/ tied to Wikimedia identity) and reassures that **reading stays anonymous** at least once
(`/contribute` gate body) so the policy reads as principled, not gatekeeping.

---

## §6 — Responsive behavior

Web-first, responsive (CLAUDE.md). Breakpoints follow the app's existing `md` / `lg`.

**Home / contribute header**
- All widths: `wiki+` left; `AuthControl` at the right of the top row (after "Contribute"). On very
  narrow screens the row wraps naturally (it's a flex row); the auth button keeps its full
  **"Log in with Wikipedia"** label if it fits, else wraps to its own line — it does **not** collapse
  to an icon on home (parallel to the search-never-collapses-on-home rule, `TopicSearch variant="home"`).

**Topic header (`TopicHeader`)**
- **`lg+`:** auth affordance lives in the indigo **＋plus block** (right). Full label / username + menu.
- **`md`–`lg` and `< md`:** the ＋plus block is `hidden`. Put the compact `AuthControl` (Option A, §1c)
  at the right end of the **Wiki row**, after the search disclosure: signed-out = a small **"Log in"**
  button (labeled); signed-in = a small avatar/initial disclosure (the username may be hidden behind
  the avatar at the very narrowest, with the menu still showing it). The Wiki row already holds
  wordmark + search + (≥md) title; the compact auth control sits after them and the title truncates
  first if space is tight (`shrink truncate` is already on the title).

**Gates**
- **`/contribute` gate panel:** the existing `mx-auto max-w-xl` container; the panel is full-width
  within it, stacking heading → panel. Fine at all widths.
- **Curate / Add gate modals:** reuse `ModalShell` (`w-full max-w-md`), centered, padded; identical
  responsive behavior to the existing curate/add modals (they already handle small screens with
  `max-h-[90vh] overflow-y-auto`).
- **Dismiss inline gate:** sits within the candidate card / rail, so it inherits the rail's responsive
  width; on mobile (single-column) it appears in the card flow. Keep it to two short lines + a button
  so it doesn't dominate the card.

**Touch targets:** every interactive auth control meets the existing **44px min-height** convention
already used on `CandidateActions` / `GeneralStrip` buttons (`min-h-[44px]`).

---

## §7 — Accessibility (baseline, written into the build)

All of CLAUDE.md's baseline applies; the auth-specific points:

- **AA contrast (verified):** white-on-`action #1F6F95` = 5.58; white-on-`brand #676EB4` = 4.70;
  ink-on-white = 13.97; `action`-on-white = 5.58; white-on-`accred #B0353B` = 6.14 — all pass AA for
  the bold ≥14px button/label text used here. **Do not** put indigo text on the indigo ＋plus block;
  on that block use **white fill + action/ink text** for the login button and **white text** for the
  username. Re-confirm any final fill against AA before merge.
- **Text-labeled, never color alone:** the sign-in control is the **word** "Log in with Wikipedia"
  (the glyph is `aria-hidden` decoration); signed-in is the **username text**; in-progress is the
  **word "Connecting…"** (not just a disabled grey); errors are **sentences** in the error slot.
- **Focus across the redirect boundary (the auth-specific a11y crux):**
  - On the **outbound** click, the browser navigates away — focus management on *our* page ends there;
    no special handling needed beyond the button being normally focusable.
  - On **return**, focus lands per normal page load (top of document). That is acceptable for C — do
    **not** force focus into the header. **But** for the **gate modals** (Curate/Add/Dismiss), the
    `signIn` navigates away from a modal that had a focus trap; on return the modal is gone (UX-2, no
    auto-reopen), so `ModalShell`'s "return focus to trigger" cleanup won't run across the navigation —
    that is fine, the page reloaded. The requirement: **no focus is left trapped or lost in a way the
    keyboard user can't recover** — a normal fresh page load satisfies this.
  - For the gates that **don't** navigate immediately (the inline `/contribute` gate, the dismiss
    inline gate, and the brief "Connecting…" window), normal focus rules apply: the gate's primary
    button is reachable and, for the modals, the trap/Esc/return-focus of `ModalShell` is reused.
- **Keyboard operability:** the sign-in button, the signed-in disclosure, the Sign-out menu item, and
  every gate button are reachable and operable by keyboard. The **disclosure menu** must follow the
  WAI-ARIA menu-button pattern: `aria-haspopup="menu"`, `aria-expanded`, open on Enter/Space/Down,
  arrow-key navigation within, Esc closes and returns focus to the button. (If a headless primitive is
  used, see §9; if hand-built, match this pattern — the project already hand-builds the
  combobox/listbox for search.)
- **ARIA / labels:**
  - Signed-out button: visible text is the label; compact variant uses `aria-label="Log in with
    Wikipedia"`.
  - Signed-in disclosure: `aria-label="Account: {username}"`, `aria-haspopup="menu"`, `aria-expanded`.
  - Avatar/initial is `aria-hidden` (the username text carries the name).
  - Gate dialogs: `role="dialog"` + `aria-modal` (via `ModalShell`) + `aria-labelledby` the gate title;
    the inline gates use a labeled region.
- **Live-region announcements (reuse the existing polite pattern from `TopicView`/contribute):**
  - Post-login (optional): polite **"Signed in as {username}."**
  - Post-logout: polite **"Signed out."**
  - Auth error: the error sentence is in a **polite** `role="status"` region (it's informational and
    recoverable, not an interrupting alert) — except the **expired-session-at-write** case may use
    `role="alert"`/assertive since it interrupts an action the user just attempted.
- **No hydration flash:** render the **signed-out** affordance for SSR + first paint, resolve
  signed-in client-side; or gate the first render until session state is known to avoid a
  signed-in→signed-out→signed-in flicker (§3). No `Date.now()`/locale value rendered into server HTML
  (the persistence doc's hydration caution still applies).
- **`prefers-reduced-motion`:** any optional toast/menu open animation is motion-gated like the
  existing dock-in / shimmer (the project's established pattern). The menu and gates work fully
  without animation.

---

## §8 — Visual spec (Indigo Press)

Honor the committed identity (CLAUDE.md, `TOPIC_PAGE_DESIGN.md`). The sign-in affordance is **plus-side
UI** — it gets the editorial/Indigo treatment, never the Wikipedia-side serif look. Gold `#E5AB28`
stays unused (no functional signal, no fill).

- **Primary "Log in with Wikipedia" button (light headers / gates):** `bg-action` (`#1F6F95`), white
  bold text, the project's hardbox border/shadow vocabulary where it fits the surface (a gate panel
  CTA may use `hardbox-sm` like the "Be the first to curate" button: `border-2 border-ink bg-brand` —
  **note** if on a light surface, `bg-brand` indigo + white text is also AA-safe and on-brand; choose
  `action` vs `brand` for the *primary* by consistency with the surface, but keep **one** consistent
  primary-login look across all gates). **Recommendation: one canonical login button** =
  `border-2 border-ink bg-brand text-white` with `hardbox-sm` shadow and the W-glyph — indigo is the
  plus brand, AA-safe (4.70), and visually marks "this is a wiki+/plus action." Use it everywhere a
  login is offered, including inside the indigo ＋plus block where it instead uses a **white fill**
  (`bg-white text-action border-2 border-ink`) so it reads against indigo.
- **Signed-in identity chip:** avatar (rounded, `border-2 border-ink`) or initial-block fallback
  (brand fill, white initial), username in bold ink (light header) or bold white (indigo block), a
  small caret (`aria-hidden`). This is the real version of the current decorative chip in
  `TopicHeader` — keep that chip's visual weight (don't make it shouty).
- **Sign-out menu:** a small `plus-card`-style popover (white, `border-2 border-ink`, offset shadow)
  with the "Sign out" item; hover/focus row highlight in `bg2`. Keyboard focus ring is the global
  `:focus-visible` 3px brand outline.
- **Gate panel (`LoginPrompt`):** a `plus-card` (white, ink border, offset shadow) with the indigo
  header block (matching the modal headers in `CurateModal`/`AddModal`: `bg-brand text-white` title
  bar), body text in ink/ink2, the canonical login button, and the quiet secondary link/button.
- **Error notice:** the established honest-error treatment — `accred`/`#B0353B` for the modal alert
  variant (matching `AddModal`'s `border-2 border-accred bg-[#FDEDED] text-accred`), or the
  `text-red-700` inline style the contribute form uses; pick the one matching the surface, text is a
  full sentence (never color alone).
- **Focus states:** global `:focus-visible` (3px brand outline) covers buttons; the menu items get
  the same. Don't suppress outlines.

---

## §9 — Component breakdown (what Development builds)

New / changed components and wiring. Dev owns implementation; this is the buildable contract.

**New components**
- **`AuthControl`** (`components/auth/AuthControl.tsx`, client) — the header affordance. Props: a
  `variant` (`"home" | "topic-plus" | "topic-compact"`) selecting the skin (action-blue light button /
  white-on-indigo / compact). Reads session state (signed-out / signed-in / loading). Renders:
  signed-out button (`signIn("wikimedia", { callbackUrl })`), in-progress "Connecting…", or the
  signed-in identity + disclosure menu (Sign out → `signOut({ callbackUrl: "/" })`). Handles the
  no-flash first render (§7).
- **`AuthMenu`** (may be folded into `AuthControl`) — the signed-in disclosure menu (WAI-ARIA
  menu-button). For C it has one item, **Sign out**. Either hand-build to the menu-button pattern
  (project precedent: hand-built combobox) **or** add a headless primitive. The architecture allows
  Radix; `@radix-ui/react-popover` is already a dependency — `@radix-ui/react-dropdown-menu` is the
  natural add for an accessible menu and is the **recommended** route (less a11y to hand-roll). If
  added, keep the Indigo Press styling (not Radix defaults / not shadcn).
- **`LoginPrompt`** (`components/auth/LoginPrompt.tsx`, client) — the gate UI, used in two forms:
  - **`LoginPromptPanel`** — inline panel (for `/contribute`): heading slot + body + primary login
    button + secondary link. Props: `title`, `body`, `callbackUrl`, optional `secondary`.
  - **`LoginPromptDialog`** — the same content inside `ModalShell` (for Curate/Add, and as the dismiss
    fallback). Props add the `ModalShell` wiring (`onClose`, `labelledBy`). Reuses `ModalShell`
    verbatim for focus-trap/Esc/return-focus.
  - Both render the canonical login button and an optional **error notice** slot (so an OAuth error on
    return can be shown in the same component).
- **`useRequireLogin`** (a small hook/helper in `lib/auth/` or co-located) — wraps the gate decision:
  `requireLogin({ action, gate })` runs `action()` when signed-in, else opens the right gate with the
  current URL as `callbackUrl`. Used by `TopicView`'s `promote` / `curateFirst` / `onAdd` / `dismiss`.

**Changed surfaces**
- **`app/page.tsx`** — add `AuthControl variant="home"` to the header top row (after "Contribute").
- **`app/contribute/page.tsx`** — when logged out, render `LoginPromptPanel` instead of the form
  (heading kept); preserve `?qid=` into `callbackUrl`; when signed-in render the existing form (write
  attributes to the real contributor — Dev/boundary work, AC6). Add the minimal home-style header row
  (wordmark + `AuthControl`) above the form so the affordance has a home (§1b).
- **`components/topic/TopicHeader.tsx`** — replace the `identityHandle` prop with `AuthControl`
  (`variant="topic-plus"` in the ＋plus block at `lg+`; `variant="topic-compact"` in the Wiki row
  `< lg`). Remove the decorative stub chip markup.
- **`app/topic/TopicView.tsx`** — remove `IDENTITY = "@sage"` and the `identityHandle` prop pass;
  route `promote` / `curateFirst` / `onAdd` / `dismiss` through `requireLogin`; for **dismiss**, the
  logged-out branch must **not** call `setDismissed` (no optimistic hide) before showing the gate
  (§2d). Catch a boundary `AuthError` from `recordDismissalAction` and surface the expired-session
  gate (§4) rather than the generic dismissal-failure rollback notice.
- **`components/topic/AddModal.tsx`** — `identityHandle` becomes the real session username (only
  reached when signed-in). No persistence change (D4).
- **`components/topic/CurateModal.tsx`** — unchanged behavior in C (still mock submit, D4); reached
  only when signed-in (the gate is at the trigger in `TopicView`).
- **Session provider** — whatever Auth.js client/session provider the app needs wraps the tree
  (likely in `app/layout.tsx` or a client boundary) so `AuthControl` can read session state. Dev's
  call on the exact provider wiring; the UX requirement is that the header resolves session state
  without a per-read DB hit (AC4) and without a hydration flicker (§7).

**Not built in C (D):** the `CurateModal`/`AddModal` persistence, the CC BY-SA agreement field, "My
curations"/profile menu items, the resume-the-action-after-login draft preservation for the curate
flow. The `AuthMenu` is built as a menu so those D items slot in.

---

## §10 — Phase-4 evaluation checklist (UX sign-off)

UX walks this against the running app (deployed or local `next start` with the provider mocked/live).
Pass = the behavior below holds in every row. Any miss is a **design defect** routed back to Development
(surface + observable + expected).

**Header affordance (AC1, AC2, AC5)**
- [ ] Signed-out: "Log in with Wikipedia" present in the home header and the Topic header (＋plus block
      `lg+`; compact in the Wiki row `< lg` — not vanished on mobile).
- [ ] Signed-in: the real **Wikimedia username** shows (not `@sage`, not `@prototype`, not "anonymous"),
      with avatar-or-initial and a keyboard-operable **Sign out** in the disclosure menu.
- [ ] Sign out returns the header to the "Log in with Wikipedia" state and re-gates contribution.
- [ ] No hydration flicker (no signed-out→signed-in→signed-out flash on load/return).

**Logged-out contribute (AC10 / D7 — the make-or-break)**
- [ ] `/contribute` logged-out shows the `LoginPromptPanel` (not an unusable form), `?qid=` preserved
      across login.
- [ ] **Curate** (card + "Be the first") logged-out opens the login gate, not `CurateModal`.
- [ ] **Add video** logged-out opens the login gate, not `AddModal`.
- [ ] **Not relevant** logged-out shows a login gate and does **NOT** optimistically hide the card
      (no false "dismissed").
- [ ] Every gate offers the **"Log in with Wikipedia"** button; none is a dead end, silent no-op, raw
      server error, or false success.

**Return-from-OAuth**
- [ ] User lands back on the **same page** signed-in (Topic / home / `/contribute?qid=` with QID kept).
- [ ] No generic interstitial; the header swap is one clean step; (optional) polite "Signed in as …".
- [ ] The gated action is **not** auto-replayed (UX-2); the user re-initiates with one click and it
      now succeeds (or opens the real modal).

**States (all four)**
- [ ] In-progress: the clicked control shows **"Connecting…"** / `aria-busy` before navigating away;
      on return a brief neutral chip is allowed, never a flicker.
- [ ] Error (cancel): gentle "Login cancelled…" + Try-again button; header stays signed-out; no spinner
      stuck, no raw error.
- [ ] Error (provider/network): honest "Couldn't sign in just now…" + Try-again.
- [ ] Expired-session-at-write: a logged-out write attempt is caught and surfaced as "Your session
      ended — please log in again," not the generic failure notice or a raw boundary error.

**Reading stays anonymous (AC11)**
- [ ] Logged-out: home, Topic pages, article body, TOC, browsing candidates, watching clips (modal +
      pinned player), search, wikilinks all work with **no login wall** and no new per-user read work
      (the only logged-out change is the header affordance).

**Accessibility**
- [ ] AA contrast on every login button / username / error (white-on-indigo, white-on-action,
      ink-on-white, accred); no indigo-on-indigo.
- [ ] Text-labeled (Log in with Wikipedia / Connecting… / username / error sentence), never color-only.
- [ ] Keyboard: button, disclosure menu (menu-button pattern), Sign out, all gate buttons operable;
      Esc closes gate modals and returns focus to the trigger; no focus trapped/lost across the
      redirect.
- [ ] Live regions: post-login/out polite announcement; auth error announced; reuse the existing
      polite-region pattern, no gratuitous assertive region (except expired-session-at-write).
- [ ] `<html lang="en">` intact; `prefers-reduced-motion` honored on any menu/toast motion; no new
      console error / hydration warning across all states.

**Verdict.** All boxes pass → UX signs off (reader is untouched; the curator has a real, accountable
Wikimedia identity; every logged-out contribute path resolves to an honest login prompt). Any unchecked
box → a design defect routed back to Development; re-evaluate after the fix.

---

## Hand-off

- **To Development:** build §9's components and wiring to this contract; the gated entry points (§2),
  the four states (§4), the exact microcopy (§5), the responsive rules (§6), the a11y (§7), and the
  Indigo-Press visual spec (§8). Remove the `@sage` stub (§1d). Keep `CurateModal`/`AddModal` mock
  submits (D4) — C only gates their triggers and shows the real username. The auth gate is **defense
  in depth**: the UI prompt *plus* the server boundary's rejection (AC7/AC8), with the boundary
  rejection caught and surfaced as the expired-session gate. Hand off to QA & Review.
- **To QA & Review:** the AC1/AC2/AC5/AC10/AC11 behavior here is the UX-evaluable surface; the server
  gate (AC7/AC8), identity mapping (AC2/AC3), JWT/no-per-read (AC4), and no-secret-in-bundle (AC12)
  are QA's correctness/security pass. UX evaluates the built UI against §10.
- **To issue D (the inheritance):** D wires `CurateModal`/`AddModal` to real persisted, auth-gated,
  CC-BY-SA-capturing writes — adopting `persistence-postgres.md`'s **awaited** async-write contract
  and this doc's gate. D may add **action-resume** (preserve a draft note in `sessionStorage` keyed by
  candidate, restore after login) — explicitly deferred from C (UX-2). D adds the profile / "My
  curations" items into the `AuthMenu` (built as a menu for exactly this).
- **Out of scope → route to:** the context-note standard / `stance`/`accuracy` vocab
  (**Curation/Editorial**); the boundary auth check, JWT session, find-or-create identity mapping,
  Auth.js provider config (**Development**, AC1–AC9/AC13); `AUTH_SECRET` + consumer secret + prod
  callback URL + `Secure` cookie (**Operations**); correctness/security verification (**QA & Review**).
```
