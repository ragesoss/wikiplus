# Design — Reader-mode chrome reduction (pass 1): calmer, thumbnail-forward Topic page

**Issue:** #164 · **Lane:** Standard · **Slug:** `topic-reader-calm`
**Status:** owner-reviewed first pass (the three subjective forks were confirmed with the owner before
this spec was committed — see *Owner decisions* below). This is **pass one** of an effort expected to
iterate; it sets the direction and a first reduction, not a final state.

## Why (the user problem)

A reader — especially a **logged-out, video-hungry one** — should land on a Topic page and feel a
calm, trustworthy, knowledge-first tool: video-forward, low-clutter. Today the plus side's reader
surfaces (the **General strip** and the **suggested/candidate** tiles) stack so much chrome and text
*above and around a small thumbnail* that the strip can read like a third-party banner ad on an
ad-riddled "slop" site. The thumbnail — the thing a video-hungry visitor actually wants — is the
*smallest* element on the tile.

**Hard guardrail (from the issue):** curation info is the value and is never sacrificed for calm.
Curated clips **keep** their context notes, fact-vs-opinion chips, and curator credit. The calm comes
from **bigger thumbnails**, **trimming non-signal chrome**, and **not showing curator tools to readers
who can't use them** — never from cutting a curated trust signal.

## Personas / stories served

- **The logged-out, video-hungry reader (primary lens).** *"I came for good short video on this topic.
  Show me the videos big and let me scan them — don't bury them under toolbars and repeated labels I
  can't act on."*
- **The self-directed learner who will never curate.** *"I want to weigh each curated clip — its note,
  whether it's fact or opinion, who vouched for it — but I don't want the page shouting curation tasks
  at me."* (Trust signals stay; curator *tools* recede when logged out.)
- **The signed-in curator.** *"My controls still work."* (Curator affordances are unchanged in
  function; they only sit on a calmer, larger tile.)

## Owner decisions (confirmed before build)

1. **Logged-out "Find more" toolbar → hidden when logged out.** The General-strip *Find more* cluster
   (Search TikTok / Search YouTube / ＋ Add video) is a **curator** tool (＋ Add video needs login; the
   search launchers are a curation-discovery aid). A logged-out reader sees **none of it**. Signed in,
   the cluster is unchanged.
2. **Candidate match line → removed from tiles.** The per-candidate match-reason line (e.g. *"Search
   result for 'Photosynthesis'"*) is near-identical card-to-card boilerplate. It is **removed from the
   reader tiles** (General-strip candidate tile **and** rail `CandidateCard`). It is **not** lost —
   the per-clip "Why suggested" reason still lives **one tap away in the player** (`MobilePlayerDock`'s
   *See context* reveal renders `clip.matchReason`).
3. **Curated tiles → conservative trim.** Grow the thumbnail **modestly** and let the wider tile relax
   the text; **keep every signal** — caption, both chips (`CURATOR NOTE` label included), the note
   panel, `context by <curator>`, upvote. Nothing removed. Chip **text size is unchanged** (already
   10px on AA-safe fills — shrinking it would risk the AA/readability baseline).

## The change, element by element

### A. Thumbnails carry the load (the core lever)

`VideoThumb`'s **`strip`** variant changes from a fixed short `h-24` (≈96px) band to a true
**`aspect-video w-full`** frame, so the thumbnail **scales with the tile width**. Combined with the
wider tiles below, the picture becomes the dominant element on every General-strip tile.

| Tile | Width (was → now) | Resulting 16:9 thumbnail |
|---|---|---|
| **Curated** General tile | `w-44` (176px) → **`w-52`** (208px) | ≈208×117 (**modest** growth) |
| **Suggested/candidate** General tile | `w-44` (176px) → **`w-64`** (256px) | ≈256×144 (**notable** growth) |
| Suggestion **loading skeleton** tile | `w-44` → **`w-64`** | matches the candidate tile it stands in for |

Candidate tiles are **notably** larger than curated tiles (per the issue), and — with the match line
gone — are nearly all thumbnail + a one-line caption + a quiet credit line. Rail `CandidateCard`
thumbnails are already full-rail-width `aspect-video`; they are unchanged in size (the rail is already
thumbnail-led at ~360px) — only their match line is removed.

The strip thumbnail stays a **uniform landscape (16:9)** frame for every tile (it does not switch to
9:16 for vertical Shorts) so the horizontal scroll row reads as a clean, even band rather than a
ragged mix of portrait and landscape — the same uniform-tile behavior the strip has today, just larger.

### B. Suggested/candidate tile — minimal, thumbnail-forward

A candidate tile (General strip) is, top-to-bottom: **large thumbnail → 1–2 line caption → `@handle ·
platform` credit → (signed-in only) Curate / Not relevant**. The **match-reason line is gone**. The
platform is already named on the thumbnail's corner tag, so the tile reads cleanly with no repeated
signal. The dashed/desaturated unvetted treatment is **unchanged** (the once-per-context unvetted
signal still lives in the band header / divider / rail set-header — see the source-of-truth doc).

Rail `CandidateCard`: identical treatment — the per-card match-reason line is removed; the section
label, source pill, thumbnail, caption, credit, and (signed-in) actions are unchanged. The rail's
one-time `CandidateSetHeader` (the once-per-context signal) is untouched.

### C. General-strip header — quieter

Drop the descriptive subtitle that adds words without signal:
- **Mixed / fully-curated** (`＋ General`): remove *"— quick visual overview across both columns."* The
  `＋ General` heading and the curated `N video` count pill remain.
- **Empty** (`＋ Suggested videos`): **keep** the `UNCURATED` pill and *"— auto-found candidates, not
  yet vetted."* — that text **is** the once-per-context unvetted signal in the empty state (required;
  not chrome). Only the non-signal curated-state subtitle is removed.

### D. Find-more cluster — gated on `signedIn`

The entire *Find more* cluster (the full Search TikTok / Search YouTube / ＋ Add video group in
empty+mixed, and the lone quiet ＋ Add video in fully-curated) renders **only when `signedIn`**. A
logged-out reader never sees it. No new prop is needed — `GeneralStrip` already receives `signedIn`.

### E. Curated General tile — conservative (signals intact)

Only the thumbnail grows (via A) and the wider `w-52` tile relaxes wrapping. **All** of these stay,
unchanged in content: caption, held pill (when held), `StanceChip` + `AccuracyChip`, the white
`CURATOR NOTE` panel + its 2-line note preview, `context by <curator>`, the upvote control, and the
owner/reviewer manage rows. No signal is removed, quieted, or resized.

## States (every state must hold)

- **Empty (0 curated, ≥1 suggestion):** `＋ Suggested videos` + `UNCURATED` + the unvetted subtitle
  (kept). Logged-out: **no** Find-more cluster; large candidate tiles only. Signed-in: Find-more
  cluster + candidate tiles with on-tile Curate / Not relevant.
- **Mixed (≥1 curated, ≥1 suggestion):** `＋ General` (no subtitle) + count pill; curated tiles
  (larger, all signals) → `Suggested · uncurated` divider → larger candidate tiles → `See N more`.
  Find-more gated on `signedIn`.
- **Fully-curated (≥1 curated, 0 suggestion):** `＋ General` + count; curated tiles only. Find-more
  reduces to the lone ＋ Add video **and** is hidden logged-out.
- **Loading:** suggestion-region skeletons, now `w-64` to match the candidate tile; never disturbs the
  curated group.
- **Zero results / store error:** the honest single line — unchanged.

## Accessibility (baseline, preserved)

- **No trust signal is carried by size or color alone** — chips keep their text labels + AA-safe fills
  at unchanged 10px; the unvetted signal stays in words (header / divider / set-header).
- **Bigger thumbnails change geometry, not contrast** — chip fills, the white note panel over the
  indigo band, and `context by` all keep their existing AA treatment.
- **Focus + keyboard** unchanged: the thumbnail is still a `<button>`; Curate / Not relevant / See more
  / upvote are unchanged native controls with the project focus ring; ≥44px targets preserved.
- **Removing the match line removes no interaction** — it was static text; the `Why suggested` reason
  remains reachable in the player reveal (with its `sr-only` "Why suggested:" intact there).
- **Hiding the Find-more cluster logged-out** removes only controls a logged-out reader could not use
  for curation; no reader navigation is lost (the wiki+ panel's Browse path is unchanged).

## Out of scope (this pass)

- Removing any curated context note, chip, or curator credit (explicitly retained).
- The feed surfaces (#160–#163).
- A final/settled design — this is pass one; further reductions are separate runs.
- Changing the *function* of signed-in curator controls.
- Switching strip thumbnails to honor 9:16 vertical orientation (kept uniform landscape for a calm row).

## Build notes (for Dev)

- `VideoThumb`: `strip` variant → `aspect-video w-full` (drop the `h-24` branch).
- `GeneralStrip`: curated `<li>` `w-44`→`w-52`; candidate tile `w-44`→`w-64`; skeleton tile
  `w-44`→`w-64`; remove the `<MatchReason>` from the candidate tile; drop the curated-state subtitle
  span; wrap the entire Find-more block in `signedIn && (…)`.
- `CandidateBits` / `CandidateCard`: remove the `<MatchReason>` usage; the `MatchReason` **component**
  is then unused by tiles — remove it (the player renders `clip.matchReason` itself, not this
  component). Keep `SourcePill`, `CandidateActions`, `CandidateSetHeader`, `SeeMoreButton`.
- Update the `ReviewRow size="tile"` doc comment's "w-44" reference to the new width.
- Refresh `docs/TOPIC_PAGE_DESIGN.md` (the curated-tile anatomy, the candidate per-card information,
  and the logged-out reader model) to describe the calmer state as a timeless directive.
</content>
</invoke>
