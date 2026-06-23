# Design spec — In-player curation (candidate player: watch + act)

**Issue:** [#123](https://github.com/ragesoss/wikiplus/issues/123) · **Role:** UX / Design ·
**Status:** design spec (written *before* Dev) · **Revises:** `docs/design/pinned-player.md`
(§6 position rationale, §6.5/§7 "no actions in dock", §7.1 logged-out CTA, §9 state table, §10
microcopy) · **Feeds:** Development (build), then QA & Review + UX (evaluation).
**Scope:** the **candidate `PinnedPlayer`** (desktop `≥ lg`). The curated `PlayerModal` and the mobile
`MobilePlayerDock` (#120) are touched only for *action-model consistency* (§4), not redesigned here.

This is the buildable contract for closing the candidate **triage loop inside the player**. Today a
signed-in reader can *watch* a candidate in the pinned dock, but to *act* (Curate / Not relevant) they
must go back to the candidate's card — the decision the preview exists to inform happens somewhere
other than where they just watched. #123 moves both actions **into the player** and pares the chrome
down to exactly two jobs: **watch** the clip while you keep reading, and **act** on it.

> **What this is NOT.** Not a new play surface (the dock from #10 stays), not a curated-playback
> change (the modal stays — #65 owns its vote/manage "act"), not the mobile layout overhaul (#120),
> not a change to dismissal persistence/sharing semantics (#45 — reused as-is), not a change to which
> candidates get a player or the embed facade.

---

## 1. Personas & user stories served

Carried forward from `pinned-player.md`: **Priya** (the deciding reader), **Cory** (keyboard / AT
reader), **Mona** (the curator-in-the-making). #123 sharpens Mona's and Priya's loop.

- **S1.** *As Mona, I want to Curate the clip I'm watching right from the player, so I act where I
  just decided — no hunt back to the card.* → DW1
- **S2.** *As Mona, I want to mark the clip Not relevant from the player and have it disappear
  instantly, so I can keep triaging.* → DW1, DW3
- **S3.** *As Mona, after I dismiss the clip I'm watching, I want the player to move me to the next
  suggestion (or get out of the way), so the loop is watch → decide → next.* → DW3
- **S4.** *As Priya (logged out), I want the same one-tap "Curate this video" invitation in the
  player, and a Dismiss that honestly asks me to log in rather than pretending it worked.* → DW4
- **S5.** *As Priya, I want the player to read as just "watch + act" — video, who made it, two
  choices — nothing extra to parse.* → DW2
- **S6.** *As Cory, I want the new action buttons to be real tabbable buttons with visible focus and
  text labels, the region to stay a non-modal landmark that never steals or traps my focus, and focus
  to land somewhere sensible after a dismiss.* → DW5
- **S7.** *As any reader, I want every new control to clear AA contrast and never be signalled by
  color alone.* → DW5

**"Done when" (issue #123) → story map:** DW1 (curate + dismiss from the player) ← S1, S2; DW2 (reads
as watch + act, no extraneous chrome) ← S5; DW3 (dismiss optimistic + rollback + sensible
advance/close) ← S2, S3; DW4 (logged-out CTA + honest gated Dismiss) ← S4; DW5 (a11y holds) ← S6, S7.

---

## 2. The decision (recorded for the two timeless docs)

### 2.1 Reversal: the player now carries Curate + Not relevant for signed-in readers

The candidate player carries **both** actions — **Curate** and **Not relevant** — for **signed-in**
readers, not only the logged-out "Curate this video" CTA. This **supersedes** the
`pinned-player.md` §6.5/§7 / `TOPIC_PAGE_DESIGN.md` "Metadata alongside" rule that said *no
Promote/Dismiss inside the dock; they stay on the card.*

**Rationale.** Candidate evaluation is a triage loop — watch, compare against the article, decide,
next. The dock was built to keep the reader *in* that loop (non-modal, persists across scroll). The
one place the loop broke was the decision itself: the buttons lived on the card, off-screen from the
player. The original "actions on the card, not the dock" rule was motivated by a *layout* concern
(don't let the dock cover the card's right-side controls — §4 below), not by a belief that the dock
shouldn't act. With the actions now *in* the dock, the decision happens where the watching happened.
The logged-out CTA (#71) already proved the pattern — a curate action lives well in the dock at the
"ready to decide" moment; #123 generalizes it to signed-in and adds Dismiss.

### 2.2 Recommendation on the open question — keep the on-card controls (redundant), in-player primary

**Recommendation: KEEP** the on-card `CandidateActions` (Curate / Not relevant) for signed-in readers
as a **redundant, secondary** path; make the **in-player actions primary**. (This is the issue's
lowest-risk default, and it is the right call — see trade-off.)

- **Why keep (recommended).** The card actions serve a real, distinct entry point: a reader
  triaging *from the rail / General band* who hasn't opened the player (e.g. judging by caption +
  match reason + thumbnail alone, or batch-dismissing obvious mismatches without watching). Removing
  them would force "open the player to act," adding a step to the no-watch-needed case and coupling
  two affordances that today work independently. The two paths share one wiring (`promote` /
  `dismiss` in `TopicView`), so redundancy costs no new logic and no divergence risk — both routes
  call the same handlers, so behavior (gating, optimistic-dismiss-with-rollback) is identical.
- **The trade-off (so the owner can choose to drop them).** Dropping the on-card controls would make
  the player the **sole** action site — a cleaner, single-affordance story ("to act on a clip, watch
  it") and a quieter card (watch-only, matching the logged-out card today). The cost: the
  act-without-watching path disappears, and a reader must open each candidate to dismiss it, which is
  slower for obvious-mismatch triage. **This is a bigger change** (it removes a working affordance and
  reshapes the card for *all* signed-in readers) and is **not assumed here.** If the owner prefers the
  sole-site model, it is a one-line follow-up: stop rendering `CandidateActions` in `CandidateCard`
  (the card becomes watch-only at every auth state, §8). **Iteration point IP-5.**

### 2.3 Exact text the two timeless docs should carry (written in the build phase)

Per the project "no history cruft in timeless docs" rule, the docs state the *current* design, not
the change trail. In the build PR:

- **`docs/TOPIC_PAGE_DESIGN.md` → "The pinned candidate player (in-app preview)" → the "Metadata
  alongside" bullet** should be rewritten to read (in spirit): *"The dock carries the clip's caption +
  creator credit (CC BY-SA) and the candidate's two actions — **Curate** (primary) and **Not
  relevant** — so a reader can decide on the clip where they watched it. Logged out, the action row is
  a single **Curate this video** CTA (Dismiss is gated, not shown). No match reason inside the
  dock."* Drop the "no Promote/Dismiss inside the dock; they stay on the card" sentence entirely (it
  no longer describes the design). Add one clause to the existing on-card description noting the card
  keeps Curate / Not relevant as a secondary path (unless the owner takes IP-5).
- **`docs/design/pinned-player.md`** — §7/§7.1 should describe the action row as the dock's bottom
  region for **both** auth states (signed-in: two buttons; logged-out: one CTA), and §6 should carry
  the position decision in §4 below. State the current design; do not narrate the reversal.

---

## 3. The streamlined "watch + act" chrome (the centerpiece)

The dock is three stacked regions inside the Indigo Press hardbox (2px `ink` border, `6px 6px 0`
offset shadow on desktop, white/ink chrome, **no gold**):

```
┌──────────────────────────────────────────────┐  ← 2px ink border, ink fill
│  ＋plus · preview                              │  TITLE BAR (metadata + Close)
│  How mycorrhizal networks move carbon       ✕ │   caption (clamp-1, bold) · "✕ Close"
│  @forestfloor · YouTube                        │   creator credit (CC BY-SA), muted
├──────────────────────────────────────────────┤
│                                                │  VIDEO FRAME (the hero)
│                  ▶  (iframe)                   │   16:9 full width, or 9:16 height-capped
│                                                │
├──────────────────────────────────────────────┤
│  [ ✦ Curate ]        [ ✕ Not relevant ]        │  ACTION ROW (the new "act")
└──────────────────────────────────────────────┘
```

### 3.1 Reading order — metadata → video → **actions** (actions move to the bottom)

The action row sits **below the video frame**, not above it. This is a deliberate change from #71's
logged-out CTA, which sat *between* the title bar and the frame.

- **Why below now.** With two persistent actions present in the signed-in case, "watch then decide"
  is the literal top-to-bottom reading order: see what it is (metadata) → watch it (frame) → act on it
  (buttons). The bottom edge is the natural "I'm done watching, now choose" resting place for the
  hand/eye, it never overlays the video, and it mirrors the mobile dock's *below-the-frame* action
  region (#120, §4) so the two surfaces share one model. The logged-out single CTA moves to this same
  bottom slot too, so logged-out and signed-in are *one row in two states*, not two layouts.
- **Iteration point IP-3:** below-frame (recommended) vs. #71's above-frame slot. Recommend below;
  alternative is keeping it above the frame to exactly preserve #71's position.

### 3.2 What's in / what's removed

| Region | In | Notes |
|---|---|---|
| Title bar | `＋plus · preview` eyebrow, **caption** (`line-clamp-1`, bold), **creator credit** (`handle · platformLabel`), **✕ Close** | Unchanged from #10/#71. Credit is the required CC BY-SA attribution. |
| Video frame | the YouTube iframe (autoplay), black backing, orientation-sized (§6) | Unchanged. The hero. |
| Action row | **Curate** + **Not relevant** (signed in) **or** **Curate this video** (logged out) | **New for signed-in.** |
| ~~Match reason~~ | **removed** — never was in the dock; stays out | The "why suggested" line lives on the card (`MatchReason`); the dock is watch + act only. |

Nothing else is added. No source pill, no avatar, no follower count, no link-out, no "play next"
chrome — the dock stays small so the video dominates and the two jobs read instantly.

### 3.3 The two buttons — placement, weight, microcopy

- **Order & placement:** **Curate first (left), Not relevant second (right)**, in one horizontal row
  pinned to the dock's bottom, `gap: 8px`, padding `10–12px`. Curate is the affirmative, more-frequent
  intent (the dock exists to *find clips worth curating*), so it leads.
- **Visual weight (Curate = primary/brand, Not relevant = secondary):**
  - **Curate** — solid `brand` (`#676EB4`) fill, white bold text, 2px `ink` border, **`flex: 1`** so
    it grows to dominate the row. Decorative `✦` (`aria-hidden`). Reuses the exact treatment of the
    on-card Curate button and the #71 CTA — one visual language across all three sites.
  - **Not relevant** — `white` fill, `ink` text, 2px `ink` border, **intrinsic width** (does not
    grow). Decorative `✕` (`aria-hidden`). The destructive-ish action is quieter; weight favors
    Curate. (Not red — "not relevant" is a triage judgment, not a warning; red is reserved for genuine
    failure/alert per the palette. Border + label carry it, never color.)
  - Both: `min-height: 44px` (touch target), the global `:focus-visible` ring (3px `brand`,
    `offset 2px`), `hover: shadow 2px 2px 0 #000`.
- **Microcopy (ship verbatim):**
  - Curate button label: **`✦ Curate`** (`✦` decorative). `aria-label="Curate this clip: {caption}"`,
    `aria-haspopup="dialog"`. (Matches `CandidateActions` exactly.)
  - Not relevant button label: **`✕ Not relevant`** (`✕` decorative). `aria-label="Dismiss as not
    relevant: {caption}"`. (Matches `CandidateActions` exactly — same word the card uses, so the two
    sites read as one action.)
  - **Iteration point IP-1 — the dismiss label.** Recommend **"Not relevant"** (the verbatim word
    already on the card → one shared vocabulary; describes the *judgment*, not the mechanism).
    Alternatives the owner may prefer: **"Dismiss"** (shorter, mechanism-named — but diverges from the
    card and reads more permanent) or **"Hide"** (softest, but understates that it's shared/persisted
    per #45). **Keep the card and player labels identical whatever is chosen.**
  - **Iteration point IP-2 — button order.** Recommend **Curate-left / Not-relevant-right** (positive
    intent leads; matches the card's order). Alternative: Not-relevant-left if the owner wants the
    "clear it out" gesture to lead during heavy triage. (Whatever is chosen, match the card order.)

### 3.4 One pattern, two states (logged-out ↔ signed-in unification)

The action row is **one component slot with two renderings**, driven by `signedIn`:

- **Logged out:** a single **full-width** `Curate this video` CTA (`flex: 1`, brand fill) — the #71
  pattern, moved to the bottom slot. **No Not relevant button** logged out (see §5, State J: a
  logged-out dismiss has no honest optimistic hide, so it isn't offered as a visible action in the
  player; the on-card path, when present, is where a logged-out dismiss is gated). Label verbatim:
  **`✦ Curate this video`**; `aria-haspopup="dialog"`,
  `aria-label="Curate this video — log in to write a context note and vouch for it"`.
- **Signed in:** the two-button row (§3.3).

This keeps logged-out and signed-in as *the same row in two states*, not two different chromes —
exactly the `(signedIn)` parameterization the component already carries from #71.

---

## 4. Dock position decision (given actions now live in the dock)

**Decision: keep the desktop dock in the bottom-LEFT corner** (`bottom: 1rem; left: 1rem`, width
`min(380px, calc(100vw − 2rem))`, vertical 9:16 height-capped per the existing §6). Mobile is
unchanged (#120's `MobilePlayerDock`, out of scope here).

- **Why the original constraint relaxes but the position holds.** Bottom-left existed to keep the
  *card's* right-side Promote / Not-relevant controls operable while the dock played (AC3 of #10).
  Now that the actions also live *in* the dock, the reader no longer **needs** the card controls
  reachable to act — so that specific constraint relaxes. But bottom-left is still the right home:
  - It keeps the sticky **plus rail** (the 360px right column) and the card controls **visible and
    operable** — and §2.2 keeps those card controls as a redundant path, so "don't cover them" still
    has value (just no longer *load-bearing*).
  - The dock now contains its own actions, so wherever it sits, the reader can fully act without
    touching anything underneath it — meaning there is **no new reason to move it.** Moving it to
    bottom-right (over the rail) would gain nothing and would re-introduce the overlap the original
    rule avoided. Bottom-left remains the lowest-friction, lowest-change choice.
- **AC3 ("don't cover the card controls") restated.** The dock still does not cover the plus rail or
  the card's controls at `≥ lg` (it's in the empty lower-left; no spacer needed on desktop). AC3 is
  now *satisfied-and-no-longer-critical*: even if the dock did overlap a control, the reader has the
  in-dock action — but we keep the clearance anyway because the redundant card path is real.
- **Iteration point IP-4 — position.** Recommend **keep bottom-left**. Alternative the owner might
  weigh: now that the dock self-contains its actions, a **bottom-right** dock (nearer the rail/eye,
  conventional "now playing" corner) becomes defensible. Recommend against it this run (no payoff,
  re-introduces overlap, diverges from the documented rationale) — but it's a low-cost flip if
  desired.

---

## 5. Every state (with ship-verbatim microcopy) — extends `pinned-player.md` §9

States **A–H** from `pinned-player.md` §9 are **unchanged** (idle, loading, playing, swap, no-embed
new-tab, non-YouTube, dismissed-by-Close). #123 adds the **action** states below. The dock element is
the same single instance throughout; "advance" / "close" describe what `TopicView` sets the dock
state to, not a re-mount.

### State I — Signed-in, playing, with actions (the new default for a signed-in viewer)
- **Trigger:** a signed-in reader has a YouTube candidate playing in the dock.
- **Render:** title bar + frame (States B/C) **plus** the two-button action row (§3.3): `✦ Curate`
  (primary) and `✕ Not relevant` (secondary). Page stays interactive; non-modal (§7).

### State J — Logged-out, playing (one CTA; Dismiss is gated, not shown)
- **Trigger:** a logged-out reader has a candidate playing.
- **Render:** title bar + frame + the **single** `✦ Curate this video` CTA (§3.4). **No Not relevant
  button is shown.** Rationale: a logged-out dismiss cannot honestly optimistic-hide (the persistence
  boundary rejects an unauthenticated write — a false "dismissed"), so the player does not offer a
  Dismiss control that would either lie or immediately bounce to a login gate from inside the watch
  surface. (A logged-out reader who wants to dismiss does so from the on-card path, where the existing
  `dismiss` login gate lives — when the card controls are kept, §2.2.) **This is the honest-gate
  decision DW4 names.**
  - **Iteration point IP-6 (lower priority):** offer a logged-out `✕ Not relevant` in the player that
    routes straight to the dismiss login gate (no optimistic hide). Recommend **NOT** this run
    (gating from inside the watch surface is a jarring detour and DW4's "no false optimistic hide" is
    cleanly met by simply not showing it). Flagged so the owner can ask for it.

### State K — Curate from the player (post-action: modal over dock)
- **Trigger:** the reader activates **Curate** (signed in) or **Curate this video** (logged out).
- **Behavior:** routes through `TopicView.promote(candidate)` for the **currently-playing**
  candidate — exactly the existing gate: **signed in → open `CurateModal`** for that candidate;
  **logged out → the `curate` login gate** (no auto-resume; UX standard). The dock and its iframe
  **stay mounted behind the modal** (the transient "modal over pinned player" coexistence is
  acceptable — `pinned-player.md` §4; the modal's focus trap correctly governs while it's up).
- **After the modal:** if the curate **succeeds**, the candidate becomes a curated clip and is removed
  from `liveCandidates` — so on modal close the dock should **advance/close** by the same rule as a
  dismiss (State L): the playing candidate is gone. If the curate is **cancelled**, the dock is
  unchanged and keeps playing. (Implementation note: the existing curate-success path already removes
  the candidate id; the dock-advance hook is the same one State L uses.)
- **No new microcopy** — reuses the gate + `CurateModal` strings.

### State L — Dismiss from the player (optimistic hide; dock advances or closes)
- **Trigger:** a signed-in reader activates **Not relevant** in the player.
- **Behavior:** routes through `TopicView.dismiss(candidate)` for the currently-playing candidate —
  the **existing optimistic-dismiss-with-rollback** path (`runDismiss`): hide the card instantly,
  persist in the background, **roll back (card reappears + a polite notice) on write failure**, gate
  on an expired session, calm notice on rate-limit. **Reused verbatim — no change to #45 semantics.**
- **Dock advance-or-close (the DW3 decision):** because the playing candidate is now dismissed (gone
  from `liveCandidates`), the dock must not keep showing a dead clip. **Decision: the dock CLOSES**
  (state → `null`; iframe torn down; playback stops) on a dismiss from the player.
  - **Why close, not auto-advance (recommended).** Auto-advancing to "the next suggestion" would
    start *playing a new video the reader didn't choose* — that violates the dock's standing
    "no play-next automation; swap only on explicit click" rule (`pinned-player.md` §9 E) and the
    embed-never-host/explicit-intent facade (autoplay is only ever justified by a click). Closing is
    honest (the thing you were watching is gone), returns the reader to the rail/band to pick the next
    candidate by their own choice, and reuses the existing dismiss teardown + focus-return with no new
    machinery. The triage *loop* continues — watch → decide → **back to the list** → watch next —
    just without auto-playing an unrequested clip.
  - **Focus after close:** reuse the existing `focusBandHeading()` pattern (send focus to
    `#general-band h2`, `tabindex=-1`) — the same anchor `runDismiss` and the Close button already
    use. The dismissed card is gone, the dock is gone; focus lands on a stable heading, never dropped
    to `<body>`, never trapped.
  - **On rollback:** if the background persist **fails**, the candidate card **reappears** (existing
    behavior) and the polite notice shows — but the dock has already closed. That's correct: the
    reader made the dismiss gesture; the rollback restores the *card* so they can retry, and the dock
    needn't re-open a clip they chose to stop watching. (The clip is recoverable from the card; no
    data loss.)
  - **Iteration point IP-7 — advance vs. close.** Recommend **close** (above). The alternative is
    **advance to the next candidate without autoplay** — i.e. swap the dock to the next suggestion's
    metadata + frame but require a click to play (no autoplay), keeping the dock open as a "next up"
    affordance. Recommend against this run (more machinery, ambiguous half-state); flagged because the
    issue explicitly says "advance OR close" and the owner may want the open-and-queued feel.

### Updated state table (appends to `pinned-player.md` §9)

| State | Dock in DOM? | iframe? | Action row | Post-action |
|---|---|---|---|---|
| I Signed-in playing | yes | yes | `✦ Curate` + `✕ Not relevant` | — |
| J Logged-out playing | yes | yes | `✦ Curate this video` (only) | — |
| K Curate (either auth) | yes (behind modal) | yes | n/a | gate → `CurateModal`; on success advance/close per L |
| L Dismiss (signed in) | **no** (closes) | **no** | n/a | optimistic hide + persist (rollback on fail); dock closes; focus → band heading |

---

## 6. Responsive behavior (the new action row)

Desktop (`≥ lg`) is the only surface this spec governs (mobile = #120). At both *dock* sizes:

- **16:9 landscape dock (≈ 380px wide):** the action row is a single horizontal flex row under the
  full-width frame; Curate `flex: 1`, Not relevant intrinsic. Comfortable at 380px.
- **9:16 vertical dock (narrowed to ≈ 260px):** the **same** horizontal row. At ≈ 260px the two
  buttons + gap still fit ("✦ Curate" + "✕ Not relevant" ≈ 230px of text/padding); Curate `flex: 1`
  absorbs slack. If a future longer dismiss label (IP-1) overflows at the narrow width, the row may
  **wrap** to two stacked full-width buttons (`flex-wrap`, Curate on top) — acceptable, but design for
  the single-row default. Both buttons keep `min-height: 44px`.
- **Logged-out CTA:** full-width single button at both dock widths (§3.4).

No layout shift on the page from the action row (it's inside the fixed dock). The mobile spacer logic
(`pinned-player.md` §6.2) is unchanged and not in scope.

---

## 7. Accessibility contract (preserved + extended) — DW5

The non-modal contract from `pinned-player.md` §8 holds **unchanged**; the new buttons live inside it:

- **Non-modal landmark preserved.** The dock root stays `<section aria-label="Video preview">` — no
  `role="dialog"`, no `aria-modal`, no focus trap, no backdrop, **not** routed through `ModalShell`.
  Adding buttons does not change this.
- **No focus-steal on open / on action-render.** Opening the dock still moves no focus (no autofocus,
  no `.focus()` on mount). The action buttons are present and Tab-reachable but **never focused on
  open or on a swap.** `document.activeElement` stays where the reader was (the card's play button,
  or wherever they were reading).
- **Real tabbable buttons.** Curate and Not relevant are real `<button>`s in normal tab order,
  operable by Enter/Space, showing the global `:focus-visible` ring (3px `brand`, offset 2px). Tab
  flows **through** the dock and out — never trapped. Tab order within the dock: Close → (frame) →
  Curate → Not relevant (DOM order; Close stays first as today).
- **Curate → CurateModal trap is fine.** When Curate opens `CurateModal`, *that modal's* focus trap
  governs (it's a real dialog). The dock itself never traps; the modal correctly does. This is the
  intended, contract-consistent nesting.
- **Focus after Dismiss/close (State L).** Reuse `focusBandHeading()` — focus → `#general-band h2`
  (`tabindex=-1`). The activated Not-relevant button is inside the dock that just unmounted, so its
  focus must move to a live, sensible anchor rather than `<body>`. Same anchor the Close button and
  on-card dismiss already use → one focus-return story across every candidate-removal path.
- **AA contrast on every new control.**
  - Curate: white text on `brand #676EB4` at bold — meets AA for the bold/large weight (the same
    combination already shipped on the on-card Curate button and the #71 CTA; precedent verified).
  - Not relevant: `ink #2C2C2C` text on `white` (≈ 15:1) — AAA.
  - Both buttons on the `ink` action-row backing are bounded by their 2px `ink` border + their own
    fill; the boundary is shape + border, not hue.
- **Never color-alone.** Both actions carry their **word** (`Curate`, `Not relevant`); the `✦` / `✕`
  glyphs are decorative (`aria-hidden`) and never the sole signal. Curate's primacy is conveyed by
  size/fill **and** its label, not color alone; Not-relevant is conveyed by label + border, not by
  being red (it isn't red).
- **Keyboard operability end-to-end.** A keyboard reader can: Tab to Curate → Enter → operate the
  modal (its own trap) → close → focus returns sensibly; or Tab to Not relevant → Enter → card hides,
  dock closes, focus lands on the band heading. No mouse required for either job.

---

## 8. Component-orientation hand-off for Dev (orientation only — Dev owns implementation)

The seam already exists from #71/#120 — this is mostly *wiring the props that are already declared*.

- **`components/topic/PinnedPlayer.tsx`** — already takes `signedIn`, `onCurate`. **Add an `onDismiss`
  prop** (the Not-relevant handler). Render the **action row at the bottom** (below the frame), not the
  current between-title-and-frame slot:
  - `signedIn && onCurate && onDismiss` → the two-button row (`✦ Curate` primary `flex-1` + `✕ Not
    relevant` secondary), labels/aria per §3.3.
  - `!signedIn && onCurate` → the single `✦ Curate this video` CTA (the #71 button, moved to the
    bottom slot).
  - Keep it a non-modal `<section>`, no `ModalShell`, no autofocus (§7).
- **`app/topic/TopicView.tsx`** — wire the dock's `onCurate` to `promote(pinnedCandidate)` and the new
  `onDismiss` to `dismiss(pinnedCandidate)` (both already exist; `pinnedCandidate` is already held
  alongside `pinned`). After a player-driven dismiss, **close the dock** (`setPinned(null)` +
  `setPinnedCandidate(null)`), reusing `runDismiss`'s optimistic-hide-with-rollback and
  `focusBandHeading()`. After a successful curate, the existing candidate-removal already fires; close
  the dock the same way (State K). No new gate kinds, no new persistence, no #45 change.
- **`components/topic/CandidateBits.tsx` (`CandidateActions` / `CandidateCard`)** — **stays** as-is
  (the redundant on-card path, §2.2). No change unless the owner takes **IP-5** (drop on-card
  controls), which would be: stop rendering `CandidateActions` in `CandidateCard` for signed-in
  readers (the `signedIn && <CandidateActions .../>` block), making the card watch-only at every auth
  state.
- **Consistency with #120 / #65 (design-only, no work here).** The player's **action model is one
  shared model:** below-the-frame action region, Curate = brand primary, the destructive/triage action
  = quiet secondary with a text label, post-action via the same `promote`/`dismiss` handlers. #120's
  `MobilePlayerDock` already places candidate actions below the frame and parameterizes by `(kind ×
  signedIn)` — the desktop dock now matches it. #65's curated vote/manage is the *curated* analog of
  "act" and should sit in the same below-the-frame region with the same weight grammar (primary action
  branded, secondary quiet, text-labeled) so curated and candidate players read as one family. Dev
  should not build #120 layout or #65 voting here — only ensure this dock's action affordance doesn't
  diverge from theirs.

---

## 9. Acceptance-criteria → design map (issue #123 "Done when")

| "Done when" | Satisfied by |
|---|---|
| DW1 — signed-in reader can Curate (→ curate flow) and mark Not relevant (→ optimistic dismiss) from the player without leaving it | §3.3 action row; §5 States I/K/L; §8 wiring `promote`/`dismiss` from the dock |
| DW2 — player reads as watch + act (video + minimal credit + two actions, no extraneous chrome) | §3.2 (what's in/removed); §3.1 reading order; no match reason/pill/avatar in the dock |
| DW3 — dismiss optimistically hides + rolls back on failure (existing behavior, from the player); dock advances/closes sensibly | §5 State L — reuses `runDismiss` rollback; **dock closes**; focus → band heading |
| DW4 — logged-out still works (Curate CTA gate; logged-out Dismiss routes through the dismiss login gate, no false optimistic hide) | §3.4 + §5 State J — single CTA shown; **no** Dismiss button shown logged-out (no false hide); gated curate via `promote` |
| DW5 — a11y: non-modal landmark, no focus-steal/-trap, keyboard-operable actions w/ visible focus ring, AA, text-labeled (never color-alone) | §7 in full |
| Decisions recorded in `TOPIC_PAGE_DESIGN.md` + `pinned-player.md`; screenshots refreshed | §2.3 (exact doc text); build phase adds catalog scenes (logged-in-with-actions, logged-out, post-dismiss) + refreshes `docs/design/ui-screenshots/` |

---

## 10. Hand-off

- **To Development:** build per §3–§8. Add `onDismiss` to `PinnedPlayer`; render the action row at the
  dock bottom (two buttons signed-in, one CTA logged-out); wire `onCurate`→`promote(pinnedCandidate)`
  and `onDismiss`→`dismiss(pinnedCandidate)` in `TopicView`; **close the dock** after a player-driven
  dismiss (and after a successful curate), reusing the existing rollback + `focusBandHeading()`. Keep
  the on-card `CandidateActions` (redundant path) unless the owner takes IP-5. Ship the §3.3/§5
  microcopy verbatim. No new gate kinds, no #45 change. Add the three screenshot scenes to
  `e2e/screenshots/catalog.ts` and refresh `docs/design/ui-screenshots/`.
- **To QA & Review + UX evaluation:** verify against §9 and the §5 state table — curate/dismiss from
  the player both gated and ungated, the optimistic-dismiss rollback reached *from the player*, the
  dock closes + focus lands on the band heading after a player dismiss, logged-out shows the single CTA
  and **no** Dismiss button, and the §7 non-modal/keyboard/AA contract holds with the buttons present.

---

## Iteration points the owner should weigh in on (controls + text)

The owner asked to see the **button integration first** and iterate. Flagged decisions, with my
recommendation:

- **IP-1 — Dismiss label.** Recommend **"Not relevant"** (matches the card; names the judgment). Alts:
  "Dismiss" / "Hide".
- **IP-2 — Button order.** Recommend **Curate-left, Not-relevant-right**. Alt: swap for heavy triage.
- **IP-3 — Action-row position.** Recommend **below the frame**. Alt: #71's above-frame slot.
- **IP-4 — Dock position.** Recommend **keep bottom-left**. Alt: bottom-right (self-contained now).
- **IP-5 — Keep vs. drop on-card controls.** Recommend **keep as redundant, in-player primary**. Alt:
  drop them → player is the sole action site (bigger change).
- **IP-6 — Logged-out Dismiss in the player.** Recommend **not shown** (gated, honest). Alt: show it,
  route straight to the dismiss login gate.
- **IP-7 — Post-dismiss: advance vs. close.** Recommend **close** (no autoplay of an unrequested
  clip). Alt: advance to the next candidate without autoplay (open + queued).
