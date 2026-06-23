# Design spec: Topic header md–lg (768–1023px) wordmark composition — fix the tablet overlap

**Role:** UX / Design · **Status:** buildable design spec (the input to Development; written
**before** implementation) · **Issue:** [#144](https://github.com/ragesoss/wikiplus/issues/144) ·
**Phase:** prototype
**Builds on / corrects:** [`docs/design/shared-header.md`](shared-header.md) (the committed shared
"Daylight Projector" header — §0a, §4.4, §5.2, §5.6) ·
[`docs/TOPIC_PAGE_DESIGN.md`](../TOPIC_PAGE_DESIGN.md) ·
[`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) §10.x.
**Components grounded in:** `components/wordmark/HeaderProjector.tsx` (the centered-vs-left-anchored
apex decision + `leftInset`), `components/header/SiteHeader.tsx` (`TopicSiteHeader`,
`TOPIC_GEOMETRY`/`SEARCH_RESERVE`, the title-cue gate), `components/search/TopicSearch.tsx` (the
`topic-inline` field tokens), `components/auth/AuthControl.tsx` (the login/account widths).
**Hands off to:** Development (implement the md–lg left-anchor + widened `leftInset` + cue gate, and
make AC6's doc re-correction) → QA & Review verifies AC1–AC6 against the pure-fn tests + jsdom suite.

> **What this spec is.** A *scoped* buildable contract for **one** broken band: the Topic
> (scroll-aware) host at **md–lg (768–1023px CSS)**. It decides where the wordmark and the slim
> title-cue go so that **search / wordmark+home-link / title-cue / auth occupy non-overlapping
> horizontal boxes** in both scroll states and both sessions. It changes **nothing** at ≥ lg
> (seam-on-divider), < md (phone), or on Home (the centered hero). It is the UX call the issue
> defers (the "Recommended approach — UX to finalize the composition").

---

## 0. Summary of the load-bearing decisions (read this first)

| Decision | Call | Where |
|---|---|---|
| **Composition** | **Recommended direction (NOT the fallback).** Extend the self-contained, **left-anchored** lockup regime across the **whole `< lg` range** for the scroll-aware Topic host (it already does this `< md`). The full wordmark is preserved at tablet — the better UX. | §3 |
| **Anchor breakpoint** | The centered-vs-left-anchored decision keys off **`lg` (1024)** for the scroll-aware (`continuous`) Topic host; **Home keeps `md` (768)** — its ≥ md centering is the AC4 guardrail, unchanged. | §3.1 |
| **`leftInset` (md–lg band)** | **320px** (token-derived; §3.2). Stays **64px** `< md`. The left-anchored lockup's left edge ("Wiki" begins) sits at 320px, clearing the **inline** `topic-inline` search field. | §3.2 |
| **Title-cue gating** | **Gate the cue to `≥ lg`** (`md:inline` → `lg:inline`). Confirmed — consistent with shared-header §4.4 ("the cue is the first to drop under width pressure"). At md–lg the cue does not render. | §3.3 |
| **`.projector-lockup-fit`** | Remains the safety valve at the tight low end (≈768–820px): it scales the lockup down (transform-origin = aperture) before auth would be reached — exactly as it does `< md`. | §3.4 |

---

## 1. Personas & user stories touched

The shared-header personas (Rosa the reader, Cory the curator, Pat the wordmark-navigator) are
unchanged; this fix restores three of their stories that the md–lg overlap broke.

- **R2 / P1** — *"As anyone, I want to click the wordmark to get home, as a real `wiki+` link."* The
  overlapping mark still links home, but it sits **on top of** the search field, so a tap near the
  field's right edge is ambiguous (which target?) and the mark reads as broken chrome, not a logo.
  Fixing the anchor restores a clean, unambiguous home affordance. → §3 / AC5.
- **Rosa (the page's search)** — *"As a reader I want to use the topic search at the top-left."* At
  md–lg the "Wiki" serif lands on the field's right edge (visible in
  `docs/design/ui-screenshots/topic-header-slim-tablet-logged-in.png`), so the field looks crowded
  and its right portion is visually occluded. Left-anchoring the lockup past the field clears it. → §3 / AC1.
- **R4** — *"As a reader deep in an article I want a quiet which-article cue."* The cue currently
  renders at md–lg (`md:inline`) **into the same space the centered lockup occupies** — the second
  overlap (the faint "…ensis" behind the "+plus" block in the reporter's screenshot). Gating it to
  ≥ lg removes that collision; at md–lg the article `<h1>` returning into view on scroll-up and the
  search field are sufficient orientation. → §3.3 / AC1.

**Goal (one sentence):** at md–lg, in both scroll states and both sessions, the four header regions
— search · wordmark+home-link · title-cue (only if shown) · auth — are **non-overlapping**, with the
**full wordmark preserved** (recommended direction, not the glyph-squeeze fallback).

---

## 2. Why the recommended direction, not the fallback

The issue offers two paths. **This spec adopts the recommended direction.**

- **Recommended direction (adopted):** left-anchor the full lockup across `< lg`, widen `leftInset`
  to clear the inline field, gate the cue to ≥ lg. It keeps the **full "Wiki + plus" wordmark** at
  tablet — the identity reads at full strength on the most common tablet (iPad) viewport. The cost is
  a host-driven anchor threshold (the Topic/`continuous` host left-anchors below `lg` instead of
  below `md`); the geometry math (§3) shows the full lockup fits at 768/834/1023 with room to spare,
  with `.projector-lockup-fit` as the established safety valve at the very low end.
- **Fallback (rejected):** extend the Tier-D glyph "squeeze" up to `< lg` for Topic only — show only
  the "+" tile, not the full lockup, at tablet. Smaller code, but it is a **visual downgrade**: a
  768–1023px viewport has ample room for the full wordmark (§3 proves it), so dropping to the bare
  glyph there throws away identity for no spatial reason. The squeeze exists for genuinely tight
  rows (`< 380px`); md–lg is not tight. **Reasoning recorded per the issue's request.**

The decision is **scoped to the Topic (`continuous`) host**. Home's ≥ md centered hero is correct and
is the AC4 no-regression guardrail — it is **not touched** (§4).

---

## 3. The md–lg composition for the Topic host

The Topic header is a full-bleed band; the chrome controls live in the top `SLIM_BAR_HEIGHT` (56px)
row (`.header-chrome`, `mx-auto max-w-[1200px] px-5`, `gap-3`). The wordmark is **not** in that flex
row — it is the absolutely-positioned `HeaderProjector` layer behind it, anchored by `apexX`. At
md–lg there is **no column divider** (the Topic grid is single-column below `lg`), so the seam is
**not** aimed at a divider; the lockup is **self-contained, left-anchored** (its own intact
`wiki | +plus` split — `shared-header.md` §5.6 / §6.3), exactly as it is `< md`, just begun further
right so it clears the wider inline search.

### 3.1 Wordmark anchor — left-anchored, keyed off `lg` for the Topic host

The scroll-aware Topic host must **left-anchor** the lockup across the whole `< lg` range (not center
it at `cw/2`). Mechanism (Dev's exact seam is its call; either is acceptable):

- The centered-vs-left-anchored decision in `HeaderProjector` currently flips at `MD_BREAKPOINT`
  (`narrow = cw < 768`). For the scroll-aware (`continuous`) host, that threshold must be **`lg`
  (1024)** instead of `md` — e.g. a `selfContainedMaxWidth` / `narrowBelow` geometry input the Topic
  host sets to 1024 while Home leaves it at the 768 default, **or** the Topic host drives the anchor
  explicitly (passes a left-anchored apex below lg). Home's threshold stays **768** (AC4).
- Below `lg` the Topic host already passes **no `projectionX`** (`measureSeam` returns `undefined`
  below `LG_BREAKPOINT`, `SiteHeader.tsx`), so the lockup is laid out from `leftInset` — this part is
  correct and unchanged. The bug is only that `HeaderProjector` then *centers* it (because `narrow`
  is false at 768–1023). Making `narrow` (self-contained) true across `< lg` for this host is the fix.

**Result:** at md–lg the lockup's left edge ("Wiki" begins) = `leftInset`, the aperture/apex follow by
construction (`apexX = leftInset + apertureX`), and the beam (Tier A) flares from that left-anchored
apex with asymmetrical arms — exactly the landing page's narrow-but-beamed behavior, on the Topic host.

### 3.2 `leftInset` for the md–lg band — **320px**, token-derived

The self-contained lockup begins past the reserved inline search. The current `SEARCH_RESERVE = 64`
is sized for the `< md` disclosure **magnifier** (a 44px box + the 20px page inset). At md–lg the
search slot renders `topic-inline` — a **`max-w-[280px]`** field (`TopicSearch.tsx`) — far wider than
64px, which is why the centered (and even a 64px-anchored) lockup collides with it. Derivation from
real tokens:

| Term | Token | px |
|---|---|---:|
| Page inset (left) | `px-5` on `.header-chrome` | 20 |
| Inline search field max width | `TopicSearch topic-inline` `max-w-[280px]` | 280 |
| Chrome-row gap (search slot → next region) | `gap-3` on `.header-chrome` | 12 |
| Small clearance (so "Wiki" never kisses the field edge) | — | 8 |
| **`leftInset` (md–lg)** | | **320** |

So at md–lg the Topic host passes **`leftInset = 320`**; `< md` it stays **`64`** (unchanged — the
magnifier reserve). Dev makes `SEARCH_RESERVE` / `TOPIC_GEOMETRY.leftInset` **width-aware**: 320 at
≥ md, 64 below md. (This is a value the host computes from its `isNarrow`/media state, or a
width-keyed geometry input — Dev's seam.)

**Non-overlap proof (the AC1 geometry math).** Lockup intrinsic width ≈ "Wiki" advance (~95px,
`WIKI_W_EST`) + 2px block margin + block `bw` (`CUT_CX 27 + ARM_B 18 + 13 + 64 = 122px`) ≈ **219px**.
So the lockup occupies **[320, 539]**. The single right-anchored auth (`px-5` = 20px from the right
edge): logged-out "Log in with Wikipedia" (WikiGlyph + text + `px-3` + `border-2`) ≈ **194px** wide;
logged-in `SignedIn` (avatar + username + ▾) ≈ **150px** wide — the logged-out button is the wider,
governing case.

| viewport | search box (left) | lockup [left, right] | auth box [left, right] | gap lockup→auth | overlap? |
|---:|---|---:|---:|---:|---|
| **768** | [20, 300] | [320, 539] | [554, 748] | **15px** | **none** |
| **834** | [20, 300] | [320, 539] | [620, 814] | 81px | none |
| **1023** | [20, 300] | [320, 539] | [809, 1003] | 270px | none |

At all three representative widths the four regions are non-overlapping. The tightest case is **768
logged-out** (~15px lockup→auth gap); §3.4 names the safety valve that guarantees it never goes
negative. Logged-in is roomier at every width (auth ~44px narrower).

### 3.3 Title-cue gating — **gate to ≥ lg** (confirmed)

The slim-state muted article-title cue is currently gated `md:inline` (`SiteHeader.tsx`), so it
renders at md–lg and lands where the centered lockup sat — the second overlap. **Decision: gate the
cue to `≥ lg`** (`md:inline` → `lg:inline`). Rationale:

1. It is consistent with `shared-header.md` §4.4's own rule that the cue is **"the first thing to
   truncate/drop under width pressure."** md–lg is exactly such a band — once the wordmark is
   left-of-center there, the cue has no clean home (it would either re-collide with the left-anchored
   lockup or be squeezed against the auth).
2. At ≥ lg the wordmark is far-right on the divider and the cue **owns the center** (left-of-centre,
   on the article side) with room — its proper home.
3. The cue is a *convenience* echo of the article `<h1>` (it is `aria-hidden`; the real `<h1>` is in
   the lead block). At md–lg, scrolling up returns the `<h1>` into view and the search field anchors
   orientation, so dropping the cue costs no essential information (no a11y impact — it never carried
   the accessible name).

So at md–lg the cue does **not** render in either scroll state; the slim row is search · wordmark · auth.

### 3.4 `.projector-lockup-fit` — the safety valve (unchanged mechanism)

`.projector-lockup-fit` already scales the lockup down (transform-origin = the aperture, so the apex
stays put) on the tightest widths **before** the auth is reached — the established `< md` behavior. It
remains in force across `< lg`. At the worst case (768 logged-out, ~15px gap) it has nothing to do;
if a future auth-label change widened the button, this is the documented mechanism that absorbs it
without overlap. **No new scale rule is introduced** — this is the same fit behavior, now also
covering md–lg because the lockup is self-contained there.

---

## 4. The md–lg composition at the representative widths × both scroll states × both sessions

All four regions below are **non-overlapping horizontal boxes** (the AC1 gate). Search is upper-left
(`topic-inline` field, `[20, 300]`); the wordmark is the left-anchored lockup `[320, 539]`; the
title-cue is **absent** (gated ≥ lg, §3.3); auth is right-anchored. The only thing that changes
between the two scroll states is the **wordmark treatment** (lit Tier-A lockup + beam at scroll-top →
flat Tier-C lockup, beam faded, when scrolled) and the **band height** (104 → 56) — the four regions'
horizontal boxes are identical in both states (the controls live in the top 56px row at every `p`).

### Tier A — scroll-top (lit aperture + beam, band 104px)

```
 768 / 834 / 1023, logged-out
 ┌──────────────────────────────────────────────────────────────────────────────┐ band 104
 │ [🔍 Search any Wikipedia topic… ]      ● wiki│+plus            [ Log in w/ Wiki ]│  search 20–300
 │  inline field, left                     left-anchored @320      auth, right      │  mark 320–539
 │                            ╲──── short cone (asymmetrical arms) ────╱            │  auth …–748
 │ ═══════════ gold border off both viewport edges ══════════════                  │  (no title cue)
 └──────────────────────────────────────────────────────────────────────────────┘
```

| width | session | search | wordmark (Tier-A lit, left-anchored) | title-cue | auth |
|---:|---|---|---|---|---|
| 768 | logged-out | inline `[20,300]` | `[320,539]` lit lockup + beam (apex ≈ 449) | — | "Log in with Wikipedia" `[554,748]` |
| 768 | logged-in | inline `[20,300]` | `[320,539]` | — | `SignedIn` avatar+name+▾ `[~598,748]` |
| 834 | logged-out | inline `[20,300]` | `[320,539]` | — | "Log in with Wikipedia" `[620,814]` |
| 834 | logged-in | inline `[20,300]` | `[320,539]` | — | `SignedIn` `[~664,814]` |
| 1023 | logged-out | inline `[20,300]` | `[320,539]` | — | "Log in with Wikipedia" `[809,1003]` |
| 1023 | logged-in | inline `[20,300]` | `[320,539]` | — | `SignedIn` `[~853,1003]` |

### Slim — scrolled (flat Tier-C lockup, beam faded, band 56px)

```
 768 / 834 / 1023, logged-in
 ┌──────────────────────────────────────────────────────────────────────────────┐ band 56
 │ [🔍 Search any Wikipedia topic… ]      wiki│+plus              [ E  E2ETester ▾]│  same boxes as
 │  inline field, left                     flat lockup @320        auth, right      │  Tier A; only the
 └──────────────────────────────────────────────────────────────────────────────┘  mark goes flat
```

Same horizontal boxes as the Tier-A table above (the lockup stays at the identical `apexX` origin —
`shared-header.md` §4.2 single-origin transition; only opacity + band height animate). The wordmark is
the **flat Tier-C lockup** (no lit aperture, no beam). **No title-cue** in either session (gated ≥ lg).
Auth is the same DOM node, right-anchored, operable.

> **Contrast with the desktop and phone references (correct, unchanged):**
> - `docs/design/ui-screenshots/topic-header-slim-desktop-logged-in.png` — ≥ lg: seam on the gutter
>   divider, far right; search left, auth right; **title-cue present** (center). Unchanged (§3.3, AC2).
> - `docs/design/ui-screenshots/topic-header-slim-mobile-logged-in.png` — < md: left-anchored at 64px,
>   clearing the magnifier; compact auth. Unchanged (AC3). The md–lg fix makes tablet behave like this
>   (left-anchored, clearing search) but with the **wider 320px inset** for the inline field and the
>   **full lockup** (not the magnifier-reserve 64px, not a glyph).

---

## 5. What is explicitly UNCHANGED (the no-regression guardrails)

- **Home is untouched (AC4 / shared-header §4.5).** `HomeSiteHeader` renders the centered hero at
  every width: `HeaderProjector variant="projector"` centered at `cw/2` for ≥ md (Home's anchor
  threshold stays **`md` = 768**), no search slot, beam at every width, no scroll-aware collapse. The
  md–lg anchor change keys off **`lg` for the `continuous` host only** and must not alter Home's
  markup, behavior, or geometry (a byte-for-byte / screenshot-diff guardrail).
- **≥ lg Topic seam-on-divider is unchanged (AC2).** At ≥ 1024 the seam still lands on the measured
  gutter divider (±4px) via the `projectionX` probe; search left / auth right; **title-cue present**
  (center). Nothing in §3 touches the ≥ lg path — the anchor change only affects the `< lg`
  self-contained regime, and `measureSeam` still drives `projectionX` at ≥ lg.
- **< md phone behavior is unchanged (AC3).** Below 768: the `topic-disclosure` magnifier-reveal
  search, the left-anchored lockup clearing the magnifier at **`leftInset = 64`**, the `< 380px`
  squeeze glyph, the narrow-search-open whole-projector suppression (`suppressWordmark` →
  chrome-row middle `GlyphTile`), and the compact auth — all unchanged. The only change is that the
  **left-anchored regime now also covers md–lg** (with `leftInset = 320`), which previously fell into
  the centered path.

---

## 6. Accessibility (no change to the inherited model; re-asserted for this band)

- **Wordmark stays a reachable `wiki+` → `/` home link (AC5).** The left-anchored lockup at md–lg is
  the same `HeaderProjector` flat-lockup link (`aria-label="wiki+"`, `href="/"`) that is the
  interactive home affordance in every other state. Left-anchoring it (vs centering it over the
  search) **improves** reachability — it no longer overlaps the search field, so neither target's tap
  region is ambiguous. All decorative layers stay `aria-hidden`.
- **The single `AuthControl` is operable at every breakpoint + both scroll states (AC5).** Exactly
  one `AuthControl` instance (≥ md `home` skin) renders at md–lg; it is the same DOM node across the
  Tier-A ↔ slim transition (no remount, focus preserved). Right-anchored, never overlapped by the
  left-anchored lockup (§3.2 proof).
- **Tab order is unchanged:** wordmark link → search → auth, identical in both scroll states.
- **AA contrast is unaffected.** No color, type, or surface changes — only horizontal placement and
  the cue's breakpoint gate. The "Wiki" serif on `--header-field`, white "plus" on indigo, the login
  button, and (at ≥ lg only now) the title-cue all keep their inherited AA-verified pairings
  (`shared-header.md` §7.2). The cue not rendering at md–lg removes a visible element; it carried no
  accessible name (it is `aria-hidden`), so removing it at md–lg has **no a11y consequence**.
- **Reduced motion / forced-colors:** unchanged (the `continuous` end-states and `forced-colors-flat`
  fallback are untouched).

---

## 7. Acceptance-criteria map (so Dev and QA can verify)

| AC (issue #144) | This spec | How verified (offline gate) |
|---|---|---|
| **AC1 — No overlap at md–lg.** At 768/834/1023, both scroll states, both sessions: search · wordmark+home-link · title-cue (if shown) · auth are non-overlapping. | §3.1 (left-anchor), §3.2 (`leftInset = 320` + the [320,539] vs auth proof), §3.3 (cue absent → no middle collision), §4 (the full matrix). | Pure-fn unit test of the anchor/apex helper (`lib/header/`, mirroring `lib/header/progress.ts`): at md–lg the lockup left edge ≥ search reserve (320) **and** lockup right edge < auth left edge, for 768/834/1023; cue gated off < lg. jsdom `setViewport` assertions in `test/shared-header.test.tsx`. The written-not-run e2e `overlaps()` cases at 768/834/1023 in `e2e/shared-header-defects.spec.ts`. |
| **AC2 — No regression ≥ lg.** Seam on the gutter divider (±4px), search left / auth right, cue present. | §3.1 (anchor change is `< lg` only; `projectionX` still drives ≥ lg), §3.3 (cue stays ≥ lg), §5. | Pure-fn test: ≥ lg path returns the seam-driven apex (projectionX), not the left-anchor. jsdom "< lg ⇒ no projectionX / ≥ lg ⇒ projectionX present" assertion (already present, extended). |
| **AC3 — No regression < md.** Disclosure, left-anchor @64 clearing the magnifier, < 380 squeeze, narrow-search suppression, compact auth — unchanged. | §3.2 (`leftInset` stays 64 < md), §5. | Pure-fn test: < md returns left-anchor at 64. Existing jsdom < md cases unchanged. |
| **AC4 — Home untouched.** Centered hero, no search, beam every width, threshold stays `md`. | §2 (scope = `continuous` host only), §5 (Home threshold stays 768). | Pure-fn test: Home/`md` threshold path centers at `cw/2` for ≥ 768 (unchanged). Home screenshot-diff (deferred to chromium). |
| **AC5 — Wordmark stays `wiki+`→/ link; single AuthControl operable at every breakpoint + both scroll states.** | §6. | jsdom: the flat-lockup `aria-label="wiki+"` `href="/"` link present at md–lg; exactly one AuthControl; tab order wordmark→search→auth. |
| **AC6 — Docs reconciled.** `shared-header.md` §5.2/§0a re-corrected to **left-anchored, clearing the inline search** (matching §5.6), with the cue gating recorded. | §8 (intended end state). | The `shared-header.md` diff is in the Dev PR; QA confirms §5.2/§0a no longer say "centered." |

---

## 8. Doc reconciliation — intended end state of `docs/design/shared-header.md` (AC6, done in Dev)

The AC6 edit to `shared-header.md` is made in the **Dev phase** (the build-loop produces it), but this
spec states the intended end state so Dev edits to a target and QA can check it. Per the CLAUDE.md
timeless-doc rule, the edits **state what the design IS now** — no "was centered / now left-anchored"
change-history narration in that timeless doc.

- **§5.2 (md–lg row)** — re-correct so the md–lg lockup is described as **left-anchored, self-contained,
  clearing the inline search** (matching §5.6's "left-anchored self-contained unit across all of < lg").
  The inline parenthetical that currently asserts "the md–lg lockup is **centered** — apex at `cw/2` …
  the centered lockup clears [the search]" must be replaced with: the md–lg lockup is **left-anchored**
  at `leftInset = 320px` (the inline-field-clearing reserve), the same self-contained regime as < md
  (which uses `leftInset = 64px` for the magnifier); the seam-on-divider `projectionX` is applied only
  at ≥ lg.
- **§0a** — the bullet that "corrected" §5.2 to *centered* and recorded the centered build as intended
  must be removed/re-corrected: the md–lg lockup is **left-anchored** (the §5.6 intent), not centered.
  State the current design; do not narrate the prior centered build.
- **§5.6** — already correct ("left-anchored self-contained unit across all of < lg"); confirm it now
  agrees with §5.2 and note the **two leftInset values** (64px < md for the magnifier; 320px md–lg for
  the inline field).
- **§4.4 (the title cue)** — record that the cue is **gated to ≥ lg** (it renders only where the
  wordmark is far-right on the divider and the cue owns the centre); below lg it does not render
  (consistent with the same section's "first to drop under width pressure" rule).
- **§5.1 table** — the slim md–lg cell should reflect **no title cue** below lg.

---

## 9. Files in scope (for Dev — this spec writes none of them)

- `components/wordmark/HeaderProjector.tsx` — host-driven self-contained threshold (`lg` for
  `continuous`, `md` for Home), so the lockup left-anchors across `< lg` on the Topic host.
- `components/header/SiteHeader.tsx` — width-aware `leftInset` (320 ≥ md / 64 < md) on the Topic
  `TOPIC_GEOMETRY`; the title-cue gate `md:inline` → `lg:inline`.
- `lib/header/` + `test/` — the pure anchor/apex helper + unit tests (the offline verification gate).
- `e2e/shared-header-defects.spec.ts` — add 768/834/1023 `overlaps()` cases (written, run deferred).
- `docs/design/shared-header.md` (§0a/§5.1/§5.2/§5.6/§4.4) — the AC6 re-correction (§8 above).

## 10. Out of scope

- ≥ lg seam-on-divider math, the beam geometry, the continuous scroll transition (#96) — unchanged.
- < md phone behavior — unchanged.
- Search / auth **behavior** — placement only, no functional change.
- The screenshot-baseline refresh of the stale tablet PNGs
  (`topic-header-{tierA,slim}-tablet-{logged-in,logged-out}.png`) — **deferred to a chromium-capable
  session** (this and the build session have no chromium); the Dev PR must flag it, not silently skip it.
