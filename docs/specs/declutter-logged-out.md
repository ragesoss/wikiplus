# Spec: Declutter the logged-out reader's Topic view

- **Status:** Ready for build-loop (Product) — GitHub issue #71
- **Owner:** Product
- **Inputs:**
  - GitHub issue #71 — "[build] Declutter the logged-out reader's Topic view — strip per-video
    CTAs, move the curate CTA into the player" (the owner intent this spec encodes).
  - `docs/VISION.md` ("What 'good' looks like") — browsing reads as reading; the call to join
    arrives once the reader has engaged.
  - `docs/TOPIC_PAGE_DESIGN.md` — §"Curated-tile anatomy", §"Curated player anatomy", §"Curation
    entry points", §"The pinned candidate player", §"Three states".
  - `docs/design/pinned-player.md` — the pinned-player contract (metadata-only dock → gains a
    logged-out curate CTA for the candidate case).
  - `docs/specs/upvotes.md` — establishes that the displayed count is **derived from distinct real
    identities** (seed baseline + real `clip_vote` rows); reading the count is anonymous.
  - `docs/specs/declutter-candidate-state.md` — the prior calm-before-engagement decluttering of
    the candidate state (the "Curate" verb, once-per-context unvetted signal); this spec extends
    that ethic to the logged-out reader across both content types.
- **Hand-off:** UX (flows + the player-CTA placement/microcopy against the design spec; confirm the
  non-modal `PinnedPlayer` and modal `PlayerModal` CTA behaviors), then Development (the build).
  QA & Review verifies against the **Acceptance criteria** below; UX evaluates the built UI.

---

## Problem

For a **logged-out reader**, every video tile on a Topic page carries an action control the reader
cannot use without first logging in. Curated-clip tiles show a **"Log in to upvote"** form
(`UpvoteControl` logged-out branch); candidate tiles show **"Curate"** and **"Not relevant"**
buttons that, when clicked, only route to a login gate. The same "log in to participate" message is
therefore asserted **once per tile**, repeated down the rail and across the General strip. This
clutters the reader view, eats vertical space, and turns browsing into a wall of disabled-feeling
invitations — in exactly the state (anonymous, still deciding whether to engage) where the reader
should be *reading and weighing clips*, not being pitched on every row.

The invitation to participate is also mistimed: it arrives on every tile **before** the reader has
watched anything, rather than at the moment it actually lands — right after they watch a clip and
form an opinion.

## User value

A logged-out reader gets a **calmer, denser-with-content** Topic view: tiles carry the trust
signals that help them weigh each clip (caption, creator credit, stance/accuracy chips, context-note
preview, match reason, source pill) but **no repeated per-tile "log in" noise**. Browsing reads as
reading. The call to join arrives **once, at the right moment** — after the reader has watched a
video in the player and is most likely to feel "I'd vouch for / curate this." This directly serves
"what good looks like" in `docs/VISION.md`: the reader leaves having engaged with clips, and the
path to becoming a curator is offered when their intent is highest, not as ambient chrome.

## Scope

### In scope

- The **logged-out (reader) Topic view only.** Removing per-video action CTAs from:
  - **Curated-clip tiles** — section-anchored rail (`ClipCard`) and General strip (`GeneralStrip`
    curated tile): the `UpvoteControl` "Log in to upvote" form, plus any owner/reviewer manage rows
    (already gated, confirm).
  - **Candidate tiles** — rail (`CandidateBits` → `CandidateCard` / `CandidateActions`) and General
    strip candidate tile (`GeneralStrip`): the **Curate** and **Not relevant** buttons.
- Adding the relocated **participate/curate CTA to the two player surfaces**, logged-out only:
  - `PinnedPlayer` (a **candidate** just watched) — a text-labeled **"Curate this video"** CTA.
  - `PlayerModal` (an **already-curated** clip) — a softer join/vouch nudge.
- The doc updates that record the logged-out reader model and the player-CTA change
  (`docs/TOPIC_PAGE_DESIGN.md`, `docs/design/pinned-player.md`).

### Out of scope

- The **signed-in experience.** Functional controls stay exactly where they are: the upvote toggle,
  candidate **Curate** / **Not relevant** on the tile, and owner/moderator rows are visually and
  functionally **unchanged** for a signed-in user. (See Decision 3 / the scope decision below: the
  candidate curate action does **not** move into the player for everyone — logged-out only.)
- The **vote-affordance redesign / up-down voting / `clip_vote` schema** — that is **#65**. No
  schema work and no change to how the count is computed here; this spec only changes
  **presentation/gating** of the existing derived count. The two should land consistently.
- **Topic-level CTAs**, which are intentional once-per-page invitations, **not** per-video noise,
  and stay as-is: the empty-state **"Be the first to curate"** (`Infobox` / wiki+ panel) and the
  General-band **"Find more" cluster** (Search TikTok / YouTube / Add video).
- Landing page, header, and `Add video` modal internals.

---

## Decisions (resolved in this discovery step)

### Decision 1 — Logged-out curated-clip tile keeps a **read-only upvote count** (no control)

The upvote **count stays, as a static read-only figure**; only the interactive control disappears.

**Rationale.** Per `docs/specs/upvotes.md`, the displayed count is **derived from distinct real
identities** (legacy seed baseline + real `clip_vote` rows) and **reading the count is already an
anonymous action** — it is meaningful, non-inflatable social proof, exactly the kind of "how do
others weigh this clip" signal the reader needs to judge a clip (a core VISION value: the reader
understands *how to weigh* each clip). Removing it would discard genuine trust information to save a
trivial amount of chrome. The noise being removed is the **"Log in to upvote" call-to-action**, not
the number. So the logged-out curated tile shows the count as a plain, non-interactive label (e.g.
"12 upvotes") with **no button, no toggle, no "log in" affordance, and no focusable/clickable
control**. It must read unambiguously as a static figure, never as a disabled or pressable control
(no button chrome, no hover/press affordance). A clip with a zero count shows no count figure (no
"0 upvotes" — that adds chrome without signal); this matches treating the count purely as social
proof.

### Decision 2 — Logged-out candidate tile becomes **watch-only** (confirmed)

Confirmed as stated in the issue. For a logged-out reader, a candidate tile:

- **Keeps:** the thumbnail as the click-to-open affordance (opens the `PinnedPlayer` for an
  embeddable YouTube candidate, or link-out per the existing `VideoThumb.activate()` split), the
  **match-reason** line, the **source pill**, the caption, and the creator credit.
- **Removes:** the **Curate** and **Not relevant** buttons (`CandidateActions`).

The candidate's visual language (dashed border / unvetted treatment) is unchanged — decluttering
removes the action buttons, not the unvetted distinction (consistent with #14 /
`declutter-candidate-state.md`). The reader can still watch and weigh; the invitation to curate
moves into the player (Decision 3).

### Decision 3 — Player CTAs, and the scope decision

**Scope decision (the scope-affecting one): the relocated curate CTA is a LOGGED-OUT-ONLY surface.**
The candidate curate action does **not** move into the player for all users. For a **signed-in**
reader the candidate tile keeps its on-tile **Curate** / **Not relevant** controls and the player
gains no curate CTA. Rationale: the issue's stated scope is "logged-out only" and the signed-in
experience is meant to stay unchanged; moving the core "Curate" action off the signed-in candidate
tile is a larger product change (it would alter the established triage loop — watch, compare,
promote/dismiss on the card — that `docs/design/pinned-player.md` is built around, where Promote /
Not-relevant must stay operable on the card while the player plays). We take the **narrower scope**
absent a strong reason otherwise. (If, after shipping, we want a single unified player-driven curate
entry point for everyone, that is a separate follow-up — flag it, don't fold it in here.)

Per-surface CTA copy + behavior (all **logged-out only**; ship copy verbatim, sentence/word case):

| Surface | When | CTA label | Behavior |
|---|---|---|---|
| `PinnedPlayer` (candidate just watched — strongest "ready to curate" moment) | logged-out reader watching a candidate in the pinned dock | **"Curate this video"** | Routes through the **login gate**, then into the **curate flow for that specific candidate** (same destination the on-tile Curate gives a signed-in user). |
| `PlayerModal` (a clip already curated) | logged-out reader watching a curated clip | **"Log in to curate videos for this topic"** | Routes through the **login gate**; a softer join/vouch nudge (no single-clip vouch action wired here — vouch/upvote affordance is #65). |

The `PinnedPlayer` CTA is the strongest moment and gets the **direct, action-specific** copy
("Curate **this** video" → that candidate's curate flow). The `PlayerModal` curated-clip moment is a
**softer, topic-level join nudge** — the reader is looking at content someone already vouched for, so
the invitation is to join the curator community, not to re-curate an existing clip. (A per-clip
"vouch"/upvote-from-the-player nudge is intentionally deferred to coordinate with #65's vote redesign;
this run does not add a logged-out vouch control.)

**A11y for both CTAs (baseline, non-negotiable):** real `<button>`/`<a>`, **text-labeled** (never
color alone), AA contrast on its surface, keyboard-operable with a visible focus ring, reduced-motion
respected. The `PlayerModal` CTA lives **inside the dialog focus trap** and participates in tab order
normally. The `PinnedPlayer` CTA is a real focusable control **in the non-modal landmark** and must
**not** steal focus on open (it respects the `PinnedPlayer` no-autofocus / non-modal contract from
`docs/design/pinned-player.md` §8 — the dock still does not `.focus()` anything on mount; the CTA is
simply present and tabbable).

This **intentionally reverses**, for the **logged-out** case only, the pinned-player rule that the
dock carries "no Promote/Dismiss inside the dock." The dock gains exactly one logged-out curate CTA;
for signed-in users the dock is unchanged (metadata-only) and Promote/Not-relevant stay on the card.
The doc update records this.

---

## Acceptance criteria (testable; drive QA)

Each is verified in the **logged-out** state unless it explicitly names the signed-in state.

1. **No curated-clip tile renders an action control when logged out.** On a Topic page with
   curated clips, logged out, **no** curated-clip tile — section-anchored rail (`ClipCard`) or
   General strip — renders an upvote button, a "Log in to upvote" form/link, or any owner/reviewer
   manage control. (No focusable action element in the tile's footer.)
2. **The curated-clip upvote count remains visible read-only when logged out.** For a curated clip
   whose count > 0, logged out, the tile shows the count as a static, non-interactive label (e.g.
   "12 upvotes") that is **not** a button/link and is **not** keyboard-focusable or clickable. For a
   clip with count 0, no count figure is shown.
3. **No candidate tile renders Curate or Not-relevant when logged out.** On a Topic page with
   candidates, logged out, **no** candidate tile — rail (`CandidateCard`) or General strip — renders
   a **Curate** or **Not relevant** button.
4. **Logged-out candidate tile stays watch-only with its weighing signals.** Logged out, a candidate
   tile still shows its **thumbnail (opening the player / link-out per the existing split)**, its
   **match-reason** line, and its **source pill** (and caption + creator credit). Clicking the
   thumbnail of an embeddable YouTube candidate opens the `PinnedPlayer`; the existing non-YouTube /
   no-embed new-tab fallback is unchanged.
5. **`PinnedPlayer` shows the candidate curate CTA when logged out.** Logged out, when a candidate is
   playing in the `PinnedPlayer`, the dock renders a real, text-labeled **"Curate this video"**
   button. Activating it routes through the login gate toward the curate flow **for that candidate**.
6. **`PlayerModal` shows the softer join nudge when logged out.** Logged out, when a curated clip is
   open in `PlayerModal`, the modal renders a real, text-labeled **"Log in to curate videos for this
   topic"** CTA inside the dialog focus trap; activating it routes through the login gate.
7. **The player CTAs do not appear when signed in.** Signed in, **neither** the `PinnedPlayer`
   "Curate this video" CTA **nor** the `PlayerModal` join nudge renders. (The signed-in player
   surfaces are unchanged.)
8. **The signed-in Topic view is visually and functionally unchanged.** Signed in: the curated-clip
   upvote **toggle** works as before; candidate tiles still show **Curate** and **Not relevant**;
   owner/moderator rows are unchanged. No control was moved off a signed-in tile.
9. **A11y preserved on every changed surface.** Each player CTA is a real keyboard-operable control
   with a visible focus ring and AA contrast, is text-labeled (never signaled by color alone), and
   respects reduced motion. The `PinnedPlayer` CTA does **not** steal focus on dock open (the
   non-modal / no-autofocus contract holds); the `PlayerModal` CTA participates correctly in the
   dialog focus trap. The read-only upvote count (AC2) is exposed to assistive tech as static text,
   not as a disabled control.
10. **No out-of-scope CTA was removed.** The empty-state **"Be the first to curate"** (wiki+ panel)
    and the General-band **"Find more"** cluster (Search TikTok / YouTube / Add video) still render
    for a logged-out reader. No `clip_vote` schema or vote-computation change was made (presentation/
    gating only).
11. **Docs updated.** `docs/TOPIC_PAGE_DESIGN.md` and `docs/design/pinned-player.md` record the
    logged-out reader model (no per-tile CTAs; read-only count) and the logged-out player CTAs
    (including the intentional, logged-out-only reversal of the dock's "no Promote/Dismiss" rule).

---

## Success metric

**Primary:** logged-out **curate-flow entry rate from the player** — the share of logged-out reader
sessions that reach the login gate via a player CTA (`PinnedPlayer` "Curate this video" or
`PlayerModal` join nudge). This is the relocation's whole bet: the invitation, moved to the
post-watch moment, should convert at least as well as the old per-tile CTAs while removing their
clutter. (We expect player-CTA entries to make up a growing share of logged-out gate hits as the
per-tile CTAs go away.)

**Guardrail (no-regression):** total logged-out → login-gate entries (any source) does **not** drop
materially after the change — i.e. relocating the CTA does not simply lose the participation
invitation. Paired with the qualitative bar from VISION: the logged-out Topic view reads as a calmer
reading surface (fewer action controls per visible tile), verified in UX evaluation.

(Analytics-as-role is deferred; these definitions sit in Product until instrumentation exists.
Until then the metric is the target the build is justified against, not a wired dashboard.)
