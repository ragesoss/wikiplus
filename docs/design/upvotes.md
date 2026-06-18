# Design Spec: Upvotes as a persisted, one-per-user, toggleable signal (milestone D4)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#55](https://github.com/ragesoss/wikiplus/issues/55) — milestone **D**, run **4 of 5**).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/upvotes.md` — the Product spec. This design serves **AC1–AC11** and the reader/curator
    stories below, and honors Decisions **1** (vote row keyed `(clip, contributor)`; count derived =
    seed baseline + distinct votes), **2** (frozen seed baseline; own-vote state from `clip_vote`
    only), **3** (self-vote allowed), **4** (`toggleUpvoteAction` returns `{ voted, count }`), **5**
    (anonymous → C's login gate; expired → the D1 expired-session prompt; the gate is server-side), and
    **6** (the per-viewer voted-state lives in the authenticated client session, **off** the cached
    topic read path).
  - `docs/design/curate-add-persistence.md` (D1) — the **pending / error / expired-session** state
    patterns and the **optimistic-with-rollback** posture (`runDismiss`); the `isAuthRequired` →
    `showExpiredGate` route. D4 reuses these, not a redesign.
  - `docs/design/clip-edit-delete.md` (D2) + `docs/design/contributor-profiles.md` (D3) — how a
    per-viewer affordance (`ownsClip()` → `clip.curatorId === myContributorId`) is computed **only** in
    the already-authenticated client session, with **no** read-path cost. D4 reuses this exact "split
    the public part from the per-viewer part" pattern for "have I voted?".
  - `docs/design/topic-page-v1.md` — **the committed Topic-page baseline.** Specifically: the clip card
    **§5.9** (the provenance footer where `▲ {upvotes}` sits), the General band / `GeneralStrip` tile
    **§5.5 / §6.3**, the chips + **AA contrast §9.3** (the load-bearing ratios), **focus-visible §11.2**
    (3px indigo outline, 2px offset), text-labeled signals **§11.1**, reduced-motion **§10.4**, and
    **responsive §12**.
  - `docs/TOPIC_PAGE_DESIGN.md` (committed Topic-page UX + Indigo Press identity); reference mockups
    `mockups/inline-indigo-sync.html` (curated).
- **Implementable against (current code this spec extends, not redesigns):**
  - `components/topic/ClipCard.tsx` — the provenance footer (lines 108–120): the **static**
    `▲ {clip.upvotes}` `<span>` (lines 109–113) is the element D4 makes interactive; the `ContextByLink`
    attribution + `curatedAt` on the right are unchanged; the owner Edit/Delete row below is unchanged.
  - `components/topic/GeneralStrip.tsx` — the curated tile (lines 183–233). **It shows NO upvote count
    today** (only caption + creator subline + `ContextByLink` + the owner row). D4 **adds** the
    interactive upvote control to this tile (§5).
  - `app/topic/TopicView.tsx` — `myContributorId` from `useSession()` (line 68), `ownsClip()` (lines
    816–820), the optimistic-with-rollback dismissal `runDismiss` (lines 597–634) **D4's voting clones**,
    `requireLogin({ gate, action })` + `showExpiredGate` + `gateElement` (line 61), the
    `isAuthRequired(err)` branch, and `focusBandHeading()`.
  - `components/auth/useRequireLogin.tsx` (the gate hook; `GateKind = keyof AUTH_COPY.gates`),
    `lib/auth/microcopy.ts` (`AUTH_COPY.gates` — D4 **adds an `upvote` entry**, §6.2), `lib/auth/auth-error.ts`
    (`isAuthRequired`).
- **Feeds:** Development (build to **this spec** for the D4 deltas, on top of the committed
  `topic-page-v1.md §5.9` card + the `GeneralStrip` tile). Then QA & Review (correctness/security) + UX
  evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It specifies the **deltas** D4 adds:
> the **static `▲ {n}` count becomes an interactive, text-labeled, one-per-user toggle** that shows the
> count **and** whether the signed-in viewer has voted; the **optimistic-with-rollback** toggle posture;
> the **logged-out → C's login gate** and **expired-session → D1's prompt** routes; the **anonymous
> reader** who can read the count but is gated to act; and the **self-vote** (allowed, no special case).
> It does **not** redesign the card, the footer, the General band, the chips, or the modals; the
> committed `topic-page-v1.md` baseline and the D1/D2/D3 surfaces stand. Reading the count stays
> anonymous — D4 adds **no** per-user work to the cached topic read path (the count is public/derivable;
> the voted-state is the already-authenticated client-session compute, Decision 6). The **security
> control is the server-side `requireContributor()` gate inside `toggleUpvoteAction`** (AC4/AC5) — not
> the UI; this spec designs the affordance and never claims the button protects the write. Every
> requirement is tagged with the Product AC(s) and the story it makes buildable.

---

## 1. Personas & stories served

D4 is the one **reader-side** participation run of milestone D. D1/D2/D3 served the **curator** (publish,
revise, attribute); D4 serves the **reader's** single lightweight way to say "I'm glad I watched this."
Of the three Topic-page personas (`topic-page-v1.md` §1), D4 serves **P1 the reader** as the primary
user, with **P2 the curator** served identically (a curator is also a signed-in viewer who can upvote —
including their own clip, §2.3) and **P3 the moderator** out of scope (anti-gaming / vote-fraud
enforcement is **D5**).

### P1 — Priya, the weighing reader (PRIMARY this run)
The same persona `topic-page-v1.md` §1 named. Priya watches a clip, reads its context note, and weighs
it. D1–D3 made the note real, owned, and attributable — but her **own** signal back ("this one was worth
it") was **fake**: today `▲ {n}` is a static demo number nothing writes per person. D4's increment: when
signed in, Priya can **upvote a clip she's glad she watched, exactly once**, and **toggle it off** if she
changes her mind — and the count reflects **distinct real people**. She does **not** log in to *read* the
count (it is public — CURATION §7); only the *act* is gated. The control must read as "you can do this
(log in)", never as broken or inert nothingness when she is logged out.

### P2 — Marcus, the curator/contributor (served identically)
A signed-in curator is, for D4, just a signed-in viewer. He upvotes clips he values exactly as a reader
does — **including a clip he curated himself** (self-vote allowed, Decision 3 / §2.3): the control on his
own clip behaves identically, no special case. His stake is the same as Priya's: a real, one-per-person
"glad I watched this" signal under the trust Wikipedia-shaped identity gives it.

### P3 — Mod, the moderator (CONTEXT ONLY — out of scope)
The one-per-user cap (the DB unique constraint) and login-gating are the **only** controls in D4. Vote
brigading, sockpuppets, self-vote rings, per-identity rate limits — the anti-gaming posture — are **D5**
(CURATION §7 enforcement). D4 buys the §7 prerequisite (a vote ties to an identity) but enforces no
limit. Named only so the gate + one-per-user read as the front of a real accountability system.

### User stories this run serves (each feeds a Product AC; Product owns the criteria)
- **S27 — signal I'm glad I watched this.** *As a signed-in reader, I want to upvote a clip I found
  worth watching, and see the count go up, so I can register "I'm glad I watched this" — and know my
  vote stuck.* *(AC1, AC6.)*
- **S28 — change my mind.** *As a signed-in reader who upvoted, I want to click again to take my vote
  back, and see the count come back down, so the signal stays honest to what I actually think now.*
  *(AC2.)*
- **S29 — see whether I've already voted.** *As a signed-in reader, I want each clip to show me whether
  **I** have already upvoted it — by more than just a color — so I'm never unsure if my vote registered
  or whether a re-click adds a second one.* *(AC6; the count reflects distinct users — AC3.)*
- **S30 — one real person, once.** *As a reader trusting the count, I want it to mean **distinct real
  people** — a second vote by the same person never double-counts — so the number is worth reading.*
  *(AC3; the load-bearing integrity story — its enforcement is the server/DB, not this UI.)*
- **S31 — reading the count is free; voting needs a login.** *As an anonymous visitor, I want to **read**
  each clip's count with no login (it's public), and — if I try to vote — be cleanly prompted to log in
  with Wikipedia, never silently no-op'd and never shown a fake "voted".* *(AC4, AC7.)*
- **S32 — told honestly if my vote didn't take.** *As a signed-in reader, when I toggle and the write
  fails or my session has ended, I want my vote to roll back to the truth and be told — never left
  looking voted when nothing was written.* *(AC5; inherits D1's S15 honesty bar.)*

---

## 2. The interaction, end to end (the one control, five states)

The upvote control is a **single toggle button** that lives on two surfaces: the **`ClipCard` footer**
(the rail, light surface — §4) and the curated **`GeneralStrip` tile** (the indigo band — §5). The same
behavior drives both; the only differences are tone/size (light vs. indigo, full vs. compact) and are
specified per surface. This section is the behavior; §3 is the state table; §§4–5 are the two surfaces.

### 2.1 The signed-in toggle (S27 / S28 / S29) — AC1 / AC2 / AC6
1. **Render.** On a Topic page the control shows, for **every** visible clip: the **count** (the public
   derived total — §7) **and**, when the viewer is **signed in**, whether **they** have voted (§3). The
   voted-state is resolved in the already-authenticated client session (§8 / Decision 6) — it hydrates
   after the topic shell renders; an anonymous load does no voted-state work (§7).
2. **Activate (not voted → voted).** A signed-in viewer activates the control on a clip they have **not**
   voted on. D4 uses **optimistic-with-rollback** (§2.4, the recommended posture): the control flips to
   **voted** and the displayed count **increments by one immediately**, then `toggleUpvoteAction(clipId)`
   fires in the background. On the server's `{ voted: true, count }` return, the optimistic state is
   reconciled to the authoritative count (§2.4). *(AC1.)*
3. **Activate again (voted → not voted).** The same viewer activates the control on a clip they **have**
   voted on: the control flips to **not voted** and the count **decrements by one immediately**;
   `toggleUpvoteAction` deletes the row and returns `{ voted: false, count }`, reconciled as above.
   *(AC2.)*
4. **No reload.** The voted-state and the count update together in the **same session, no manual reload**,
   from the server's authoritative return (§7 / Decision 4). *(AC6.)*

### 2.2 The logged-out attempt (S31) — AC4 / AC7
A **logged-out** viewer sees the control rendered as **"Log in to upvote"** (the count still visible and
readable — §3, §7). Activating it routes through C's gate **before any write or optimistic change**:
`requireLogin({ gate: "upvote", action })` opens the **"Log in to upvote"** login prompt (§6.2). **No
optimistic vote is shown** — the count does not move, the control does not flip to "voted" (a vote that
cannot persist must never read as cast — AC4). The server gate (`requireContributor()` in
`toggleUpvoteAction`) is the authoritative control; this UI gate is the experience. If the user logs in
from the prompt, the action is **not** auto-resumed (the C/D1 `UX-2` rule — no auto-replay); they return
signed-in and can click upvote again, now as the signed-in toggle (§2.1). *(AC4; the count stays readable
— AC7.)*

### 2.3 The self-vote (Decision 3) — AC9
A signed-in viewer **may** upvote a clip whose `curatorId` is their own — exactly as any other clip: the
control behaves identically (toggle, one row, one increment), with **no** UI special-case (no hide, no
disable, no "you made this" note). This is deliberately uniform: an asymmetry ("you can't upvote a clip
you made") would read as odd, and the one-per-user cap already bounds any self-inflation to **+1**. (The
abuse posture, including any reconsidering of self-votes, is **D5** — §1 P3.) *(AC9.)*

### 2.4 Optimistic-with-rollback (the chosen posture; mirrors `runDismiss`) — AC2 / AC5
D4 uses **optimistic-with-rollback**, not an awaited spinner — chosen because (a) the project already
uses it for the closest sibling write (the dismissal `runDismiss`, `TopicView` lines 597–634), so the
pattern + the failure handling exist; (b) an upvote is a low-stakes, instant-feel signal where a
round-trip spinner would feel heavy and laggy; (c) the toggle's truth is small (a boolean + a count by
±1) and trivially reversible. Concretely (Dev clones the `runDismiss` shape):

1. **Optimistic apply (instant).** On a signed-in activation, flip the per-viewer voted-state and adjust
   the displayed count by exactly **±1** in client state immediately (voted → +1; un-voted → −1). The
   control reflects the new state at once — no spinner-gating the click.
2. **Fire the write.** `toggleUpvoteAction(clipId)` runs in the background (`void (async () => …)()`).
3. **Reconcile on success.** On `{ voted, count }`, set the control's voted-state and count to the
   **server's authoritative values** (not the optimistic guess) — so the displayed count is the true
   derived total (seed baseline + distinct votes, §7), reconciling any concurrent change. The optimistic
   ±1 and the server count normally agree; the reconcile is the source of truth.
4. **Rollback on error (S32).** If the write rejects:
   - **Expired session** (`isAuthRequired(err)` true) → **roll back** the optimistic vote (the count and
     voted-state revert to pre-click) **and** surface the **expired-session gate** (`showExpiredGate()` —
     the D1 path, §6.3), **not** a generic error. *(AC5.)*
   - **Any other error** (network, DB, boundary) → **roll back** the optimistic vote to the truth, and
     surface a **non-blocking polite notice** (§3 "error", §6.4) so the viewer knows it didn't take. No
     silent loss; the control is never left looking voted when nothing was written. *(AC5 / S32.)*
5. **Guard concurrency.** Per-clip, ignore a stale resolve / prevent a second in-flight toggle for the
   same clip from racing its own optimistic state (the `alive`-style guard `runDismiss` uses, scoped per
   clip — Dev's mechanism; the contract is "the displayed state always ends matching the server's last
   authoritative return for that clip"). A double-click while in flight must not desync the count.

> **The toggle is idempotent by contract** (Product Decision 4): the post-state is "voted" or "not
> voted", reached whether the click flips a real vote or is a no-op race; the server's
> upsert/`onConflictDoNothing` + delete-absent-is-no-op backs this, and the unique constraint makes
> one-per-user a DB invariant (AC3). The UI never needs to guard against a double-count — but it **does**
> reflect the server's returned count, so a race resolves to the truth.

---

## 3. Every state, explicitly (the gate; AC1/AC2/AC4/AC5/AC6/AC7/AC9)

The control renders exactly **one** of these states per clip. The voted vs. not-voted distinction is
carried by **more than color** (Decision: a **text label change** + **`aria-pressed`** + a **filled-vs-outline
glyph**, never color alone — §9 / CURATION §4). The count is **always** visible (even logged-out, even
on error).

| # | State | When | What the control shows | Behavior on activate |
|---|---|---|---|---|
| **3a** | **Not voted (signed in)** | signed in; `voted === false` for this clip | **outline** ▲ glyph + count + the count is the resting accessible name "Upvote — N upvotes" (§9); `aria-pressed="false"` | optimistically votes (§2.1.2 / §2.4): glyph fills, count +1, `aria-pressed="true"`, then reconcile |
| **3b** | **Voted (signed in)** | signed in; `voted === true` | **filled** ▲ glyph + count + an explicit **"Voted"** text cue (§9) + accessible name "Upvoted — N upvotes, click to remove"; `aria-pressed="true"` | optimistically un-votes (§2.1.3): glyph outlines, count −1, `aria-pressed="false"`, reconcile |
| **3c** | **Pending (in flight)** | a toggle is mid-write (optimistic; §2.4) | the **already-applied** optimistic state (filled/outline, the ±1 count) — the control is **not** disabled and shows **no spinner** (optimistic = the new state is the feedback); a second activation for the same clip is ignored until resolve (§2.4.5) | — (resolves to 3a/3b on success, or rolls back to the prior state on error) |
| **3d** | **Logged out** | no session (`status !== "authenticated"`) | the **count** (read-only, the public total) + a **"Log in to upvote"** affordance — a real button, **not** disabled, reading as actionable (§4.3 / §5.3); `aria-pressed` is **absent** (it is not a toggle for a logged-out user, it is a gate trigger) | routes to C's **"Log in to upvote"** gate (§2.2 / §6.2); **no** optimistic vote, the count does not move |
| **3e** | **Expired session** | the session was valid at render, invalid at toggle | momentarily the optimistic 3b/3a state, then **rolled back** to pre-click on the boundary `AuthRequiredError` (§2.4.4) | the **expired-session gate** appears (§6.3, "Your session ended…"); nothing written; count/state reverted |
| **3f** | **Error (write failed, not auth)** | a non-auth toggle rejection | the optimistic state **rolled back** to the truth; a **non-blocking polite notice** appears (§6.4) | the notice is informational; the control returns to 3a/3b at the rolled-back truth; the viewer can retry |
| **3g** | **Anonymous reader (count only)** | the same as 3d, framed for the read-only reader | the count is **visible and readable** with no session and no per-user work (§7); the control reads as the 3d "Log in to upvote" gate trigger — **never** as a broken/disabled-nothing element | activating = the 3d gate route |

Notes that bind:
- **3d vs. 3g are the same rendered control** — a logged-out viewer's control. Listed twice because the
  Product spec calls out both "logged-out activation routes to login" (AC4) and "reading the count stays
  anonymous, the control must not read as broken" (AC7); both are the **"Log in to upvote"** button with
  the visible count. It is **never** rendered `disabled` (a `disabled` button is not focusable and reads
  as "nothing you can do"); it is an **enabled** button whose label says what it does (log you in to
  upvote).
- **Pending is optimistic (3c), not an awaited/disabled state** — there is **no** busy spinner and the
  control is **not** disabled during the round-trip (unlike D1's *modal* publish, which is awaited; an
  upvote toggle is the `runDismiss` posture — §2.4). The feedback is the already-applied new state. The
  only concurrency guard is per-clip in §2.4.5 (a second activation for the same clip is ignored until
  the first resolves), which prevents desync without a visible disabled treatment.
- **The seed never leaks into voted-state.** "Have I voted?" (3a vs. 3b) is **only** a `clip_vote`
  lookup (Decision 2 / AC8): a seeded clip with a large baseline and no real vote by this viewer renders
  **not voted** (3a). The seed affects the **count** only, never the toggle state (§7).

---

## 4. The control on the `ClipCard` footer (light surface) — §5.9

### 4.1 Where it goes (the delta to the existing footer)
Today the footer (`ClipCard.tsx` lines 108–120) is:
`▲ {clip.upvotes}` (a static `<span class="font-bold text-brand">` on the **left**) — `ContextByLink` +
`curatedAt` on the **right**. **D4 replaces only the left `<span>`** with the interactive upvote control.
The footer's layout (`flex items-center justify-between gap-2 text-[11px]`), the right-side attribution,
and the owner Edit/Delete row below are **unchanged**. The control sits where `▲ {n}` sat — bottom-left
of the card, below the curator note, left of the attribution.

### 4.2 Anatomy (signed-in — 3a/3b)
A real `<button type="button">`, `text-[11px]`, the existing `font-bold` weight, a `flex items-center
gap-1` of:
- a **glyph** — **outline** ▲ when not voted (3a), **filled** ▲ when voted (3b) (`aria-hidden`,
  decorative — the meaning is text-carried, §9). Use a filled vs. outline triangle (e.g. `▲` filled /
  `△` outline) **or** a same-shape glyph with an outline/filled style — Dev's exact glyph, the contract
  is a **shape difference**, not only a color difference;
- the **count** — the derived total (§7), `font-bold`;
- a **"Voted" text cue** when voted (3b) — a small `text-[10px]` `text-brand` "· Voted" (or the
  accessible name carries it; the **visible "Voted" word** is required so the state is text-distinct on
  the page, not only to AT — §9). When not voted (3a), no "Voted" word (the resting state is the count +
  outline glyph + the "Upvote" accessible name).

Tone (Indigo Press — §10): the **brand indigo `#676EB4`** is the upvote color on light (it already is:
`text-brand` today). **Not voted (3a):** the glyph + count in `text-brand`, the outline glyph reads as
"you can vote". **Voted (3b):** the glyph **filled** in `text-brand` + the **"Voted"** word in
`text-brand`, the filled glyph reads as "you have". Hover/focus: the global `:focus-visible` 3px indigo
ring (§11.2); a subtle hover (e.g. underline or a 1px ink offset, Dev's call within the identity) marks
it interactive. **Gold is not used** for any vote state (§10).

### 4.3 Anatomy (logged out — 3d/3g)
The same `<button>`, **enabled**, reading **"▲ N · Log in to upvote"** — the count stays visible and
`font-bold text-brand`; the **"Log in to upvote"** is the actionable label (`text-[11px]`, the action/brand
tone). It is **not** `disabled` and **not** styled as inert. `aria-pressed` is **absent** (it is a gate
trigger, not a toggle). Accessible name: **"Log in to upvote — N upvotes"** (§9). Activating routes to
the gate (§2.2). The footer must never render a bare count with no actionable affordance for a
logged-out viewer — the count is read-only data, the button is the (gated) action.

### 4.4 AA on light (binding — §9.3)
`text-brand` (`#676EB4`) on the card's light surface (`bg-white` / `bg2`): the count + glyph + the
"Voted"/"Log in to upvote" text must clear **WCAG AA (≥4.5:1)** at `text-[11px]`/`text-[10px]`. Indigo
`#676EB4` on white is ≈ **4.0:1** for *white-on-indigo* (§9.3) — but here it is **indigo text on white**,
the inverse, which is the same ≈4.0:1 and is **below 4.5:1 for normal text**. **Binding: use the
deeper indigo `#5248AF` (≈5.9:1 on white per §9.3) for the upvote control's text/glyph on the light
card** so it clears AA at 10–11px — the same darkening §9.3 mandates for small indigo. (`text-brand`
today on the static decorative number is a pre-existing AA gap this run must fix as it makes the element
interactive.) QA verifies.

---

## 5. The control on the curated `GeneralStrip` tile (indigo band) — §6.3

### 5.1 The delta (the tile shows no count today — D4 adds the control)
The curated `GeneralStrip` tile (`GeneralStrip.tsx` lines 183–233) currently shows: thumbnail → caption →
creator subline → `ContextByLink` → the owner Edit/Delete row. It shows **no upvote count**. D4 **adds**
the interactive upvote control to the tile so the count + voted-state are reachable on the General band
too (the band is part of the curated experience, and a reader weighing a General clip should see/cast the
same signal). Place it **below** the `ContextByLink` line (line 200–202) and **above** the owner action
row (line 208) — one short line, `text-[11px]`, so the tile does not grow taller than the rail expects
(it must not push the `w-44` tile or the strip's row height; the control is a single inline line).

### 5.2 Anatomy on indigo (signed-in — 3a/3b)
The same `<button>` as §4.2, retoned for the **indigo band** (`bg-brand`, white text). The brand indigo
is the *surface*, so the vote color cannot be indigo here — the control is **white**:
- **glyph** outline/filled ▲ in **white** (`aria-hidden`); the **count** `font-bold text-white`;
- **voted (3b):** the glyph **filled** + a **"Voted"** word in `text-white` + a **persistent underline on
  the control** (the underline, not a color shift, carries "this is the active/toggled state" on indigo —
  the same indigo-band tactic `ContextByLink` uses for its link, §6.3 of D3). `aria-pressed="true"`.
- **not voted (3a):** outline glyph + count in `text-white`, no underline, `aria-pressed="false"`.
- Compact: `text-[11px]`, tight; the control wraps within the `w-44` tile if needed but normally is one
  short line (`▲ N` + the small voted cue).

### 5.3 Logged out on the band (3d/3g)
The same control reading **"▲ N · Log in to upvote"** in `text-white` (the count visible), **enabled**,
routing to the gate (§2.2). The "Log in to upvote" text on indigo is white (and may carry the underline
"it's actionable" cue) — AA-safe (§5.4).

### 5.4 AA on the indigo band (binding — §9.3)
White text on `bg-brand` (`#676EB4`) is ≈ **4.0:1** — **below AA for normal text** (§9.3). The control's
text is `text-[11px]` normal weight in places, so: render the upvote count + glyph + "Voted"/"Log in to
upvote" **bold** and rely on the **underline** (for the voted/actionable cue) rather than a color shift —
**and**, where the white-on-indigo text is `< 14px bold`, darken the *tile's local* treatment is not an
option (the band is brand by identity), so **use the bold + underline treatment §9.3 permits for
white-on-indigo**, exactly as the `GeneralStrip`'s existing white text and `ContextByLink`'s white
underline do. QA confirms the control's text clears AA (bold-large or the §9.3 white-on-indigo allowance);
if a specific element dips, Dev applies the §9.3 deep-violet only to that element's own background is not
available on the band — so the binding fallback is **bold + ≥14px-equivalent treatment + underline**, the
same posture the band already uses. (This is the one place the count text may need to be a touch larger /
bolder than the light card to clear AA; Dev confirms.)

---

## 6. Microcopy (the accessible names + the gate + error copy — used verbatim)

Centralize these strings so the control's states + the gate can't drift (Dev: a small
`lib/curation/upvote-copy.ts` or extend an existing copy module; the gate string goes in
`lib/auth/microcopy.ts` — §6.2).

### 6.1 The control's accessible name, per state (the text-carried signal — §9)
The **visible** text is the count (+ the "Voted" / "Log in to upvote" words); the `aria-label` (or
`aria-pressed` + visible label) carries the full meaning to AT. Use, verbatim (`<N>` = the displayed
count, pluralized "1 upvote" / "N upvotes"):
- **Not voted (3a):** visible `▲ <N>`; accessible name **"Upvote this clip — <N> upvotes"**; `aria-pressed="false"`.
- **Voted (3b):** visible `▲ <N> · Voted`; accessible name **"You upvoted this clip — <N> upvotes. Activate to remove your upvote."**; `aria-pressed="true"`.
- **Logged out (3d/3g):** visible `▲ <N> · Log in to upvote`; accessible name **"Log in to upvote this clip — <N> upvotes"**; **no** `aria-pressed`.
- Keep it concise + honest; do not invent a "score" or "like" — the word is **upvote** throughout
  (matches the Product spec + the reader's "glad I watched" framing). The count noun is **"upvotes"**.

### 6.2 The login gate (the new gate subject "upvote") — AC4
D4 adds an **`upvote` entry** to `AUTH_COPY.gates` (`lib/auth/microcopy.ts`) so `requireLogin({ gate:
"upvote", … })` resolves (today `GateKind = keyof AUTH_COPY.gates`, so the subject must exist). Verbatim:
> **title:** `Log in to upvote`
> **body:** `Upvoting a clip ties your vote to your Wikimedia identity, so the count means one real person, once. Reading the count stays anonymous — only voting needs a login.`

This matches the C/D1 gate language (a gated *contribution*; reading is anonymous — CURATION §7) and the
existing `curate`/`add`/`dismiss` gate copy shape. The **"Log in with Wikipedia"** button in the prompt is
C's existing `AUTH_COPY.signInFull`, unchanged.

### 6.3 The expired-session gate — AC5
Reused **unchanged** from D1: `showExpiredGate()` surfaces the existing expired-session prompt carrying
the verbatim **"Your session ended — please log in again."** (`AUTH_COPY.errors.expiredSession`). D4 adds
no new auth string here — it reuses the hook exactly as `runDismiss` does.

### 6.4 The write-failed notice (non-auth error, 3f) — AC5
A **non-blocking, polite** notice (not a modal, not blocking — the same posture as the dismiss-failed
notice). Verbatim:
> **Couldn't record your upvote — please try again.**
Surfaced in a `role="status" aria-live="polite"` region (NOT `role="alert"`/assertive — an upvote failure
is informational, not urgent, and must not interrupt the reader). After it shows, the optimistic vote is
already rolled back (§2.4.4) so the control shows the truth; the notice is the explanation. It dismisses
on its own (a short timeout) or on the next interaction — Dev's call; it must not stick or stack. (Reuse
the dismiss-error notice surface in `TopicView` if one exists; the contract is "polite, non-blocking,
honest".)

---

## 7. The count display semantics (Decision 2) — AC7 / AC8

- **The displayed count = the public derived total** = `(clip.upvotes ?? 0)` seed baseline **+** the
  count of distinct real `clip_vote` rows for that clip (Decision 2). It is **never** a mutable counter
  incremented in place — so it cannot drift (the Product spec's "derive, don't store" rule). The UI
  renders **whatever the server's derivation yields**; on a toggle it renders the count from the action's
  `{ voted, count }` return (§2.4.3).
- **Public, readable anonymously (AC7).** The count rides the topic read (it is the same for every viewer
  — Decision 6) or a small public read; it requires **no** session and **no** per-user work. An anonymous
  reader sees every clip's count with no login. The control still renders for them (the 3d/3g "Log in to
  upvote" button) — but reading the **number** is free.
- **The toggle changes the count by exactly one, in-session, no reload (AC1/AC2/AC6).** A signed-in
  toggle: optimistically ±1 (§2.4.1), then reconciled to the server's authoritative derived count
  (§2.4.3). The count and the voted-state update **together** (the same `{ voted, count }` return drives
  both). No manual reload.
- **The seed is a frozen baseline (AC8).** A seeded clip (`clip.upvotes = N`, no real votes) shows **N**;
  a real vote makes it **N+1**; un-voting returns it to **N**. The seed is never mutated and never floors
  below the baseline (you can't un-vote the demo seed — the honest edge Decision 2 records). The
  **voted-state** (3a vs. 3b) never comes from the seed (§3 last note).

---

## 8. The voted-state read — OFF the cached read path (Decision 6) — AC6 / AC7

This is the binding read-path discipline; it mirrors D2/D3's `ownsClip()`. **UX fixes the constraint; Dev
picks the mechanism.**
- The **count** (public, §7) may ride the topic read / `listClips` (it is the same for every viewer).
- The **per-viewer "have I voted?"** state is resolved **only** in the **already-authenticated client
  session** — a small read of *the viewer's own* votes for the visible clip ids (a `votedClipIds(clipIds)`-shape
  seam read scoped to the viewer + the visible clips), or hydrated client-side after the topic shell
  renders. It is **NOT** baked into `listClips` or the cached/SSG topic shell. Exactly as `myContributorId`
  + `clip.curatorId` drive `ownsClip()` in the client session with **no** read-path cost (D2 §3.1 / D3
  §9.1). Dev records the chosen mechanism in ARCHITECTURE (AC11).
- **No per-user work for an anonymous reader (AC7).** An anonymous topic load does **zero** voted-state
  work; the control renders the 3d/3g logged-out form (count + "Log in to upvote") with no session read on
  the read path. The render of a clip's footer/tile for an anonymous reader is byte-for-byte the public
  count + the gate-trigger button — no per-user query.
- **Hydration is graceful.** While the voted-state read is in flight for a signed-in viewer (just after
  shell render), the control may show the **not-voted** form (3a) as the neutral default, then update to
  3b for clips the viewer has voted on when the read resolves — a quiet correction, not a flash of wrong
  state that misleads (it never shows "voted" before confirming; it only *adds* the voted cue once known).
  This must not announce per clip on hydration (§9 / no over-announce).

---

## 9. Accessibility — voted-state distinguishable without color; keyboard; AT announcement (binding — CURATION §4 / §11)

- **Never color-alone (the load-bearing rule).** The voted vs. not-voted distinction is carried by **all
  of**: (1) a **visible text cue** ("Voted" word when voted; "Upvote"/"Log in to upvote" otherwise via the
  accessible name); (2) **`aria-pressed`** (`true` when voted, `false` when not — a real toggle button);
  and (3) a **filled-vs-outline glyph** (a *shape* difference, not only a fill color). A user who cannot
  perceive color, or on a screen reader, or in high-contrast, gets the full state from the text + the
  `aria-pressed` + the glyph shape. Color (indigo on light / white-underline on indigo) only **reinforces**.
- **A real toggle button.** The control is a native `<button type="button">` with **`aria-pressed`**
  reflecting the voted state (3a `false` / 3b `true`); it is **Tab-reachable**, **Enter/Space activates**
  (toggles), and the global **`:focus-visible` 3px indigo outline, 2px offset** (§11.2) applies on both
  surfaces. The logged-out form (3d/3g) is the **same button without `aria-pressed`** (it is a gate
  trigger, not a toggle) and is also Tab-reachable/focus-visible — it is **never** `disabled` (a disabled
  button is not focusable and reads as inert — §3 note).
- **Announce the count change appropriately, do not over-announce.** When the viewer toggles, the
  `aria-pressed` change + the button's accessible-name change ("Upvote this clip — N upvotes" ⇄ "You
  upvoted this clip — N+1 upvotes…") are conveyed by the SR on the press the user just made — **no extra
  live region is needed for the user's own toggle** (the button is the focused element; its state change
  is announced). **Do NOT** wrap the count in an `aria-live` region that fires on every render / every
  clip's hydration (§8) — that would spam the SR as counts hydrate or other viewers' votes arrive. The
  **only** live announcement D4 adds is the **error notice** (§6.4, `role="status" aria-live="polite"`,
  fired once on a failed write). The expired-session gate (§6.3) announces itself as a dialog.
- **Pluralize honestly.** "1 upvote" vs. "N upvotes" in the accessible name (the visible count is the bare
  number; the accessible name pluralizes the noun).

---

## 10. Indigo Press palette & non-color rule (binding)

Within the committed identity (`CLAUDE.md`; `topic-page-v1.md` §5 / §9.3 notation):
- **Brand indigo `#676EB4`** — the upvote color on the **light** card (glyph + count + "Voted"), the same
  `text-brand` the static count uses today — but **darkened to `#5248AF`** at the control's small text
  sizes to clear AA on white (§4.4 / §9.3). The voted state is the **filled glyph + the "Voted" word**,
  reinforced (not signaled) by the indigo.
- **On the indigo band (`GeneralStrip`)** — the control is **white** (`text-white`); the voted state is the
  **filled glyph + "Voted" word + a persistent underline** (the underline carries the toggled/actionable
  cue on indigo without a color shift — §5.2/§5.4), exactly as `ContextByLink` does on the band. AA per
  §9.3 (bold + underline; QA confirms).
- **Action blue `#1F6F95`** — available for the "Log in to upvote" affordance tone if Dev prefers an
  action-tinted gate trigger on light (≈5.5:1 on white, passes AA); not required (the darkened-indigo or
  action tone both work — Dev's call within AA).
- **`accred` red** — **not** an upvote signal. (No downvote, no negative state in D4.) It remains the
  error/destructive color elsewhere; the upvote **error notice** (§6.4) is text-carried and non-blocking,
  not a red alert.
- **Sprout/teal `#2A8270`** — not a D4 signal.
- **Ink `#2C2C2C`** — borders, body text (existing).
- **Gold `#E5AB28`** — **not used.** It is a tertiary accent, never a functional/signal color, and must
  **never** be enlisted for the voted state, the count, the pending/optimistic state, or the gate trigger.
- **Non-color rule (CURATION §4, §11.1):** every D4 signal is text-carried — the voted state is the
  **"Voted" word + `aria-pressed` + the filled-vs-outline glyph shape**; the count is the **number**; the
  logged-out gate is the **"Log in to upvote" words**; the error is the **notice sentence**. Color only
  reinforces; the voted state is **never** signaled by color alone.

---

## 11. Responsive behavior (~390px; `topic-page-v1.md` §12)

Web-first, responsive. D4 adds one small control to surfaces that already collapse to a single readable
column narrow; the requirement is that it stays usable + tappable at ~390px:
- **`ClipCard` footer (rail).** The footer is `flex items-center justify-between gap-2 text-[11px]`; the
  upvote control on the left and the `ContextByLink` + `curatedAt` on the right **wrap** rather than
  overflow at narrow widths (the footer already wraps via the flex; the added "· Voted" / "· Log in to
  upvote" text may push the right side to a second line — acceptable). The control is a comfortable tap
  target (the button's padding gives ≥ the row height; ensure ≥24px effective hit area — pad the small
  button so a thumb can hit it on a phone). No horizontal scroll at ~390px.
- **`GeneralStrip` tile (band).** The tile is `w-44` and horizontally scrolls at all widths; the upvote
  control is one short line that stays within the tile (truncate/clamp the "Log in to upvote" if the tile
  is tight — but the **count + glyph must always show**; the gate label may abbreviate to "Log in" if
  needed at the narrowest, keeping the accessible name full). The control + the owner action row below it
  both fit the `w-44` tile without breaking the strip.
- Target tested widths (QA + UX eval): ~1280px, ~768px, ~390px — the control in **all** states (3a–3g) on
  **both** surfaces at each.

---

## 12. Accessibility requirements (consolidated — verifiable against AC1/AC2/AC4/AC6/AC7 / CURATION §4)

- **The control** — a native `<button type="button">` on both surfaces; **`aria-pressed`** reflects the
  voted state (3a `false` / 3b `true`); the logged-out form (3d/3g) is the same button **without**
  `aria-pressed` (a gate trigger), **never** `disabled`; Tab-reachable, Enter/Space activates,
  `:focus-visible` 3px indigo ring (§11.2).
- **Voted-state distinguishable without color** — carried by the **"Voted" visible word + `aria-pressed`
  + the filled-vs-outline glyph shape**; color only reinforces (§9 / §10). The accessible name changes per
  state (§6.1).
- **Count change announcement** — conveyed by the focused button's `aria-pressed` + accessible-name change
  on the user's own toggle; **no** per-render / per-clip `aria-live` on the count (§9 — do not
  over-announce). The **only** added live region is the error notice (§6.4, `role="status"
  aria-live="polite"`).
- **Logged-out** — routes to C's "Log in to upvote" gate (§6.2); **no** optimistic vote; the count stays
  visible + readable (AC7). The gate dialog carries its own a11y (C's `LoginPromptDialog`).
- **Expired session** — routes to the D1 expired-session gate (§6.3, "Your session ended…"); the optimistic
  state is rolled back; not a silent failure.
- **Contrast (AA, binding)** — the control's text/glyph clears **WCAG AA (≥4.5:1)** in **both** states on
  **both** surfaces: light card → **deep-indigo `#5248AF`** at 10–11px (§4.4 / §9.3); indigo band → white,
  **bold + underline** treatment (§5.4 / §9.3). QA spot-checks the smallest text on each surface.
- **Responsive** — the control operable by keyboard and touch at ~390px on both surfaces (§11).
- **No per-user work on the read path (AC7)** — restated as an a11y/perf invariant: an anonymous reader's
  footer/tile render is the public count + the gate-trigger button, with no session read on the read path;
  the voted-state is the already-authenticated client-session compute (§8).

---

## 13. Deltas from the committed baselines (Dev: build these on top)

The committed `topic-page-v1.md §5.9` card, the `GeneralStrip` tile, and the D1/D2/D3 surfaces stand. D4
changes exactly these points; everything else is unchanged.

1. **`ClipCard` footer: static `▲ {upvotes}` → interactive toggle.** Replace the left static
   `<span class="font-bold text-brand">▲ {clip.upvotes}</span>` (lines 109–113) with the interactive
   upvote control (§4): a native `<button aria-pressed>` showing the **derived count** + the voted-state,
   in the 3a/3b/3c/3d/3e/3f/3g states (§3). The right-side `ContextByLink` + `curatedAt` and the owner
   row are **unchanged**. *(AC1, AC2, AC6.)*
2. **`GeneralStrip` curated tile: add the upvote control.** Add the same control (§5) below the
   `ContextByLink` line and above the owner action row — the tile shows **no** count today; D4 adds it,
   retoned white-on-indigo with the underline voted cue (§5.2/§5.4). *(AC1, AC2, AC6.)*
3. **The voted-state is a per-viewer, off-read-path client-session compute** (§8) — Dev surfaces a
   viewer-scoped `votedClipIds`-shape read on the seam (`lib/data/store.ts` / `lib/data/index.ts`), or
   hydrates on mount; **never** on `listClips` / the cached shell (Decision 6). The **count** is public
   (rides the topic read / a public read). *(AC6, AC7.)*
4. **Optimistic-with-rollback toggle in `TopicView`** (§2.4) — clone the `runDismiss` shape: optimistically
   flip the per-viewer voted-state + the count ±1, fire `toggleUpvoteAction(clipId)`, reconcile to
   `{ voted, count }` on success, **roll back** on error (`isAuthRequired` → `showExpiredGate()`; else the
   polite §6.4 notice). Per-clip concurrency guard (§2.4.5). Wire the control's `onToggle` (signed-in) /
   gate route (logged-out) on both `ClipCard` and `GeneralStrip` to `TopicView` handlers. *(AC1, AC2, AC5.)*
5. **Logged-out routes through C's gate** — add an **`upvote` entry** to `AUTH_COPY.gates`
   (`lib/auth/microcopy.ts`, §6.2 verbatim) so `requireLogin({ gate: "upvote", action })` resolves; the
   logged-out control (3d/3g) is the "Log in to upvote" gate trigger with the count visible, **no**
   optimistic vote (§2.2). *(AC4, AC7.)*
6. **Self-vote: no special case** (§2.3) — the control on the viewer's **own** clip behaves identically;
   `ownsClip()` does **not** gate the upvote control (it only gates Edit/Delete). *(AC9.)*
7. **Microcopy centralized** (§6) — the per-state accessible names + the "Voted" cue + the gate body + the
   error notice as verbatim strings (a small copy module; the gate string in `AUTH_COPY`).

No change to: the reader-facing clip-card content above the footer (thumbnail / chips / note / creator
credit), the `ContextByLink` attribution (§D3), the owner Edit/Delete affordances (§D2/D3), the chip label
map + AA fills (`topic-page-v1.md` §9), the candidate / empty-state treatment, the scroll-sync, the
article side, the curate/add/edit/delete modals, and the cached topic read path (no per-user work —
Decision 6 / AC7). Reading the count stays anonymous.

---

## 14. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | What it requires | Spec sections |
|---|---|---|
| AC1 | Signed-in upvote persists; count +1; one row | §2.1, §2.4, §3 (3a→3b), §7 |
| AC2 | Re-click toggles off; count −1; idempotent | §2.1, §2.4, §3 (3b→3a) |
| AC3 | Count = distinct users; no double-count | §2.4 (idempotent note), §7 — *server/DB invariant is Dev/QA* |
| AC4 | Anonymous toggle → login gate; no optimistic vote; writes nothing | §2.2, §3 (3d), §6.2 — *server gate is Dev/QA* |
| AC5 | Expired session → expired-session prompt, not generic error; rollback | §2.4 (4), §3 (3e), §6.3 |
| AC6 | Per-viewer voted-state shows, no reload; off the cached read path | §2.1, §3, §7, §8 |
| AC7 | Reading the count stays anonymous; no per-user work on read path | §3 (3g), §7, §8 |
| AC8 | Seed = frozen baseline; own-vote state from `clip_vote` only | §3 (last note), §7 |
| AC9 | Self-vote allowed; no special case | §2.3 |
| AC10 | Build/typecheck/test green; tested w/o live provider | (Dev/QA — no design blocker) |
| AC11 | ARCHITECTURE records vote model + read-path discipline | (Dev — docs-as-built) |

---

## 15. What UX will evaluate at Phase 4

Against this spec **and** the stories (S27–S32), on the running prototype with the session stubbed
signed-in where needed (the C/D1/D2/D3 pattern — no live OAuth in CI):
- **Signed-in toggle (AC1/AC2/AC6/S27/S28):** on a `ClipCard` and a curated `GeneralStrip` tile, the
  control shows the count + the **not-voted** state; activating optimistically flips to **voted** and the
  count **+1** with no reload; re-clicking flips back to **not voted** and **−1**; the state + count
  reconcile to the server's truth; a reload preserves the vote.
- **Voted-state legible without color (AC6/S29):** the voted vs. not-voted distinction is carried by the
  **"Voted" word + `aria-pressed` + the filled-vs-outline glyph shape**, not color alone — verifiable in
  grayscale / with a screen reader; the accessible name changes per state.
- **Logged-out (AC4/AC7/S31):** logged out, the control shows the **count** (readable) + **"Log in to
  upvote"**; activating opens C's **"Log in to upvote"** gate with **no** optimistic vote and no count
  movement; the control never reads as broken/disabled-nothing; an anonymous topic load does no per-user
  voted-state work.
- **Expired session (AC5/S32):** with a stubbed expired session at toggle, the optimistic vote **rolls
  back** and the **"Your session ended…"** gate appears, not a generic error; nothing is written.
- **Write-failed (AC5/S32):** a stubbed non-auth failure rolls the optimistic vote back and shows the
  **polite** "Couldn't record your upvote — please try again." notice (non-blocking); the control returns
  to the truth.
- **Self-vote (AC9):** the owner's control on their **own** clip behaves identically (toggle, +1/−1) —
  no hide, no disable, no special note.
- **Count semantics (AC7/AC8):** the count is the **derived total** (seed baseline + distinct votes); a
  seeded clip shows its baseline and a real vote adds **+1** on top; the **voted-state** never comes from
  the seed (a seeded clip the viewer didn't vote on shows **not voted**); reading the count needs no login.
- **A11y in practice:** `aria-pressed` toggle semantics; visible focus on the control (both surfaces);
  AA contrast — deep-indigo `#5248AF` on the light card, white bold+underline on the indigo band;
  Enter/Space toggles; no over-announcing on hydration; operable at ~390px.
- **Indigo Press fidelity:** brand indigo (darkened for AA) on light / white on the band; gold unused;
  no `accred`/red for any vote state; signals text-carried (§10).

Defects route back to **Development**; a pass is reported to the orchestrator. (UX evaluation is distinct
from QA & Review's correctness/security pass — UX asks "does it match intent and feel right"; QA verifies
the server-side gate AC4, the one-per-user DB invariant AC3, and the derivation AC8 at the action/store.)
