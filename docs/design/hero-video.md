# Design spec: Hero video — a prominent must-watch clip per topic

- **Status:** Design contract for build-loop (UX) — GitHub issue #158. Written **before** Dev.
- **Owner:** UX / Design
- **Implements:** `docs/specs/hero-video.md` (Product spec) — AC1–AC14. This doc is the **buildable
  contract** for the prominent hero rendering at the front of the General strip, the **Mark as hero /
  Unmark** control, the logged-out parity, and the responsive + accessibility behavior. Product set the
  *outcomes and the model*; this doc sets *form, placement, microcopy, states, responsive behavior, and
  accessibility* so Dev never guesses.
- **Inputs read:**
  - `docs/specs/hero-video.md` — the data-model decision (`topic.hero_clip_id`; `Topic.heroClipId`),
    curated + general-only eligibility (§3.2), any-signed-in-curator permissions (§3.4), logged-out
    parity (§3.5), the candidate hero layout (§4.3), AC1–AC14.
  - `docs/TOPIC_PAGE_DESIGN.md` — §"The General strip — the one crossover" (the full-bleed indigo band,
    the curated-tile anatomy this hero extends), §"Curated player anatomy", §"Logged-out reader model
    (issue #71)" (the `signedIn` affordance axis).
  - `components/topic/GeneralStrip.tsx` — the curated-tile composition the hero re-renders larger: the
    `VideoThumb` strip thumbnail, the held pill, caption, `creator · platform`, the `StanceChip` /
    `AccuracyChip` pair, the white-panel "Curator note" preview, `ContextByLink`, `UpvoteControl`, the
    owner Edit/Delete row, and the `ReviewRow` (Hold/Approve/Remove). The hero reuses **every** one of
    these — re-laid-out, never re-implemented.
  - `components/topic/Infobox.tsx` (issue #159) — the prior art for a signed-in-only curator control on
    the plus side: a quiet secondary (raised/white) button whose **word states what tapping does** (no
    `aria-pressed`/`role=switch`), optimistic-with-rollback in the host, busy word while in flight.
  - `docs/VISUAL_IDENTITY.md` — Indigo Press palette, the AA baseline, **text-labeled signals (never
    color alone)**, and **gold is decorative / tertiary, never a functional signal** (so the hero
    marker is not gold-as-signal).

This is the contract for the **prominence + control**, not a CSS authoring guide. Token names and
existing component seams are cited so Dev never guesses; the exact markup/CSS is Dev's within these
references.

---

## 1. Personas / stories served

Grounded in spec §2 and `VISION.md` ("the plus side serves the self-directed learner first").

- **The curator who knows the best intro (signed-in).** *As a curator, I want to mark the one clip
  that best introduces this topic as its hero — and change my mind freely — so readers start there.*
  → The **Mark as hero / Unmark** control on curated General clips (§3), signed-in only, any-curator.
- **The reader arriving cold.** *As a reader, I want an obvious "start here" so I don't have to weigh
  every tile myself.* → The **prominent hero block** at the front of the General strip (§2), visible to
  everyone, every trust signal intact so I can still judge it.
- **The logged-out reader (issue #71).** *As a reader without an account, I still want the curator's
  start-here signal.* → The hero prominence renders for me; the mark/unmark control does **not** (§3.4).
- **The keyboard / assistive-tech user.** *As a reader navigating by keyboard or screen reader, I want
  the hero announced as the lead video and the control reachable in a sensible order, operable with a
  visible focus ring, its state in words.* → §6.

---

## 2. The hero block (the prominent rendering)

The hero renders **inside the existing full-bleed General band** (`GeneralStrip`), **above** the
horizontally-scrollable row of the remaining curated tiles + suggestions. It is the band's lead element
when a hero is set; the band header (`＋ General` + count) and the Find-more cluster are unchanged and
sit above it as today.

### 2.1 Layout — horizontal on the band, stacked on narrow

A single bordered card spanning the band's content width (`max-w-[1200px]` inner), on a **white /
`surface-raised` fill with the 2px `hardbox` border** (so its small body text clears AA over the indigo
`#676EB4` band — the same reason the tile's note panel is white). Two regions:

- **≥ sm (horizontal):** a large thumbnail on the **left** (~`w-64`/`w-72`, the clip's natural aspect
  via `VideoThumb` — `aspect-video` for horizontal, the vertical frame for a 9:16 clip), and a
  **metadata column beside it (right)** taking the remaining width: the prominence marker eyebrow, the
  caption (larger than a tile — `text-base`/`text-lg`, up to 2–3 lines), `creator · platform`, the
  stance + accuracy chips, the context-note (a **fuller** preview than the tile's 2-line clamp —
  ~3–4 lines, the white "Curator note" panel re-used at the larger scale), `context by <curator>`, the
  upvote control, and the curator/owner/reviewer control rows (§3, §5).
- **< sm (stacked):** the thumbnail on **top** (full card width), the metadata column below it. Still
  visibly larger than a peer tile (full-width vs. `w-44`, the larger caption + fuller note carry the
  prominence in greyscale).

The thumbnail is the click-to-play affordance (`VideoThumb` → `onPlay` for YouTube, link-out
otherwise) — identical behavior to a tile, just larger. There is **no** separate "read more" control;
opening the player shows the full note (parity with the tile).

### 2.2 The prominence marker (text-labeled, never color alone)

A small eyebrow at the top of the metadata column reading **"★ Hero"** (`★` decorative `aria-hidden`;
the **word "Hero" carries the meaning**) — uppercase, bold, tracked, on the white panel in
`text-brand`/`text-violet` ink (AA on white). It is **not** gold (`VISUAL_IDENTITY` — gold is never a
functional signal) and **not** color-only (the word is the signal; the size + position reinforce). The
hero `<li>`/region also carries an accessible label so AT announces it as the lead video (§6).

### 2.3 What the hero keeps (every trust signal — spec AC7)

The hero is the curated tile's content at a larger scale — it **reuses**, never replaces:
`StanceChip` + `AccuracyChip` (with modifiers), the "Curator note" white panel (fuller line clamp),
`ContextByLink` (`surface="indigo"` stays correct — the link sits on the white panel), `UpvoteControl`
(`surface="indigo"`), the `HeldPill` **if the hero is held** (above the caption, as on a tile), the
owner Edit/Delete row (when `ownsClip`), and the `ReviewRow` (Hold/Approve/Remove per the same
predicates). Prominence is placement; the vouch and its honesty are unchanged.

### 2.4 Peer clips (spec AC8)

The remaining curated General clips (all general clips **except** the hero) render in the existing
scroll row exactly as today, in their existing order, each a `w-44` tile. The hero is **removed** from
that row (it is not duplicated). Suggestions, the "Suggested · uncurated" divider, and "See N more" are
unchanged and follow the curated row as today. If the hero is the topic's **only** general clip, the
scroll row shows only suggestions (or, if none, nothing) — the hero block stands alone, which is correct.

### 2.5 No hero set (the default — unchanged)

When `heroClipId` is absent (or resolves to no visible general clip — e.g. it was deleted/removed,
spec AC12), the band renders **exactly as today**: no hero block, all general clips in the uniform
scroll row. The hero block is purely additive; an anonymous read of a hero-less topic is byte-for-byte
unchanged.

---

## 3. The Mark as hero / Unmark control

A **signed-in-only** affordance (spec §3.4/§3.5 — the security control is the server-side curator
re-check). It appears on **curated General clips only** (AC10/AC11 — never on a candidate, never on a
section-anchored clip).

### 3.1 Placement + form

- **On a peer (non-hero) curated General tile:** a quiet control in the tile's affordance area (the
  same cluster as Edit/Delete / the ReviewRow), reading **"★ Make hero"** — a secondary
  raised/white button matching the tile's other plus-side controls (border-2 `hardbox`,
  `surface-raised`, ≥44px touch target, the site focus ring). The `★` is `aria-hidden`; the word
  carries it.
- **On the hero block:** the control reads **"Unmark hero"** (same quiet secondary treatment), placed
  in the hero's control row. Activating it clears the topic's hero.
- Marking a *different* clip as hero while one exists is just "★ Make hero" on that other tile — the
  prior hero is replaced (spec AC3); no separate "replace" affordance is needed.

It is a **labeled action button** (not `aria-pressed`/`role=switch`) — "Make hero" / "Unmark hero" each
state what tapping does, the clearer model (the `Infobox` mark-complete precedent). While a hero
mark/unmark write is in flight the activated button shows a brief busy word ("Setting…" / "Clearing…")
and is disabled to block a double-submit (the visual change is optimistic, so the busy word is brief).

### 3.2 Eligibility gating (affordance)

The control renders only when **`signedIn` && `clip.general`**. It never renders on a candidate tile
(candidates have no such control path) or on a section-anchored clip. This is the affordance layer; the
server independently rejects an ineligible or anonymous call (spec AC4/AC10/AC11).

---

## 4. Host wiring (TopicView)

The host owns the booleans + the optimistic-with-rollback write, mirroring `toggleComplete` (issue
#159). This component (GeneralStrip) is presentational.

- **Derive the hero:** `heroClipId = topic?.heroClipId`; `heroClip = heroClipId ? generalClips.find(c
  => c.id === heroClipId) : undefined` (so a stale/cleared reference that matches no visible general
  clip yields no hero block — AC12). Pass `heroClipId`, `signedIn`, and the two handlers +
  the in-flight flag to `GeneralStrip`.
- **`setHero(clip)` / `clearHero()`:** optimistic — set/clear `topic.heroClipId` in the in-memory
  `topic` immediately (the strip re-renders the hero live), fire the curator-gated Server Action in the
  background, reconcile to the server's authoritative `heroClipId` on success, and on failure **roll
  back** to the pre-click value + show a calm non-blocking notice. The same **three-arm catch** as the
  other writes: `isAuthRequired` → the expired-session gate; `isRateLimited` → the calm limit notice;
  else the generic red line. A per-topic in-flight guard blocks a double-submit. (AC13.)

---

## 5. The control rows (composition note for Dev)

The hero block's control area composes, in this order, the same controls a tile carries plus the hero
toggle: the **upvote** control; the **owner Edit/Delete** row (when `ownsClip`); the **ReviewRow**
(Hold/Approve/Remove); and the **hero toggle** ("Unmark hero"). On a peer tile, the hero toggle
("★ Make hero") joins the existing affordance cluster. Reuse the existing components — this is layout,
not new controls.

---

## 6. Accessibility (AC14)

- **Announce the hero as the lead.** The hero region carries an accessible label naming it the
  topic's hero video (e.g. `aria-label` on the hero `<li>`/section like "Hero video: <caption>"), so AT
  users get the same "start here" signal sighted users do — the prominence is not conveyed by size
  alone.
- **Text-labeled state, never color alone.** The "★ Hero" marker's meaning is the **word**; the
  control's state is the **word** ("Make hero" / "Unmark hero" / the busy word). The `★` glyph and any
  emphasis fill are reinforcement only.
- **Keyboard + focus.** The control and the play affordance are real `<button>`s, keyboard-operable,
  with the visible site focus ring; ≥44px touch targets. Reading order is sensible: the hero block
  precedes the scroll row in the DOM, so tab order reaches the lead video first.
- **AA contrast.** All hero text sits on the **white `surface-raised` panel** (not bare indigo), so
  small body text, the note, chips, and `context by` all clear 4.5:1 — the same reason the tile note
  panel is white. The chips carry their own AA-safe fills + ink borders (unchanged).
- **Reduced motion.** No new motion is introduced; the optional curated fade is unchanged and stays
  reduced-motion-gated.

---

## 7. States summary (the buildable matrix)

| State | Hero block | Peer scroll row | Control |
|---|---|---|---|
| No hero, logged-out/in | absent (band unchanged) | all general clips, uniform | "★ Make hero" on each general tile **iff signed-in** |
| Hero set, logged-out | prominent block, all trust signals, **no control** | general clips minus hero | none |
| Hero set, signed-in | prominent block + **"Unmark hero"** | general clips minus hero, each with "★ Make hero" | both |
| Hero is held | prominent block **with HeldPill** | — | unchanged |
| Hero clip deleted/removed | absent (reference resolves to no clip) | remaining clips | — |
| Mark/unmark in flight | optimistic block change + busy word on the button | — | disabled (busy) |

---

## 8. Screenshots to refresh (part of done)

Refresh the General-strip baseline showing a hero, across mobile/tablet/desktop × logged-out/logged-in
(`scripts/dev/shots.sh`). Add a **hero scene** to `e2e/screenshots/catalog.ts` (a seeded topic with a
hero set) so the prominent block + the signed-in control are captured and indexed automatically. The
seeded Photosynthesis demo topic is the natural carrier (set one of its General clips as the hero in
the seed). Commit the regenerated PNGs + `index.html` with the UI change.
