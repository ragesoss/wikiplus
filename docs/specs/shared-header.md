# Spec: Shared "Daylight Projector" header across Home + Topic — seam aligned to the content divider, scroll-aware beam

**Issue:** [#72](https://github.com/ragesoss/wikiplus/issues/72) · **Type:** build · **Status:** spec
**Owner:** Product · **Feeds:** UX (flows + buildable design spec for the unified header), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#15 / #61](https://github.com/ragesoss/wikiplus/issues/15) (the **first** `HeaderProjector` build — Tier A, the dynamic apex/seam measurement, the geometry props `variant` / `projectionX` / `seamRatio` / `beamSlope` / `burnY` / `beamCrossUp` / `beamEdgeInset` / `fullBleed`), [#12](https://github.com/ragesoss/wikiplus/issues/12) (`TopicSearch` — `home` / `topic-inline` / `topic-disclosure`), issue C (`AuthControl` — `home` / `topic-plus` / `topic-compact`)
**The spec for this feature:** [`docs/VISUAL_IDENTITY.md`](../VISUAL_IDENTITY.md) §2.2 (the seam *is* the split), §6.0 (align internal seam to the column divider), §6.2/§6.3 (tiers + small-size), §9.2/§9.3 (split preserved via seam alignment; article body untouched), §10.1 #2–#3, §10.2 #6, **§10.3 (Dev hand-off)**
**Relates to:** [`docs/TOPIC_PAGE_DESIGN.md`](../TOPIC_PAGE_DESIGN.md) ("The two worlds" + "Layout": article ~1fr, plus rail ~360px — the §9.2 reconciliation is owed here), [`docs/design/landing-page.md`](../design/landing-page.md) §4.3/§4.7/§5 (the projector geometry + API the dynamic Topic behavior extends)

---

## Problem

The "Daylight Projector" wordmark is the product's central piece of visual storytelling — a curation layer **projected onto** Wikipedia — and `VISUAL_IDENTITY.md` is explicit that the lockup's `wiki | plus` seam, **aligned to the page's real wiki/plus column divider**, *is* how the mark labels the two columns by position (§2.2, §6.0, §9.2). The landing page (#15/#61) built the projector at Tier A in a free-standing hero. But the **Topic page** — the one place where the seam-to-divider alignment is the whole point — never got it. Today the two pages have **two separate header implementations**:

- **Landing** (`app/page.tsx`) hosts `HeaderProjector variant="projector"` with the full beam.
- **Topic** (`app/topic/TopicView.tsx` → `components/topic/TopicHeader.tsx`) hosts a **bespoke** header: a `lg`-grid two-world bar with **no beam**, an **unlinked wordmark** (a plain serif "Wiki" + a separate `＋plus` block, *not* the projector lockup, so it does not navigate home), and **auth duplicated in two places** (a `topic-plus` control inside the indigo block at `lg+` *and* a `topic-compact` control on the Wiki row `< lg`).

Concretely, today's Topic header:
- does **not** carry the brand's central metaphor (no aperture, no beam, no "pedia" ghost);
- does **not** align a real lockup seam to the article↔plus divider — it fakes "two worlds" with two unrelated label blocks;
- has the **wordmark go nowhere** (no home link), breaking the most basic site-navigation expectation;
- **duplicates auth**, which is two code paths to keep correct and two surfaces to keep AA-safe.

This issue **unifies** them into ONE header component used by both pages and delivers the `VISUAL_IDENTITY.md` §10.3 Dev hand-off and §10.1 #2 / §10.2 #6 doc reconciliation.

## User value

- **A reader on a Topic page** sees the product's identity working *as designed*: the `wiki | plus` lockup sits across the real article↔plus divider, so the mark itself says "the encyclopedia here, the curation layer there" by where it sits — the same one-glance promise the landing page makes.
- **Anyone on any page** can click the wordmark to get home — the universal "logo → home" affordance, currently missing on Topic.
- **A reader scrolling a long article** is not robbed of vertical space: the full beam greets them at the top, then the header **collapses to a slim, sticky bar** (beam faded out) that keeps the wordmark, search, and auth reachable without eating the viewport.
- **A reader on a phone** still gets a header that fits: search collapses to an icon that reveals the field on tap; a logged-in user shows their first initial; logging in is one tappable icon — nothing overflows or overlaps.
- **The team** maintains **one** header (one auth path, one search-slot contract, one accessibility model, one set of geometry tokens) instead of two divergent ones — the future is a config change, not a third build.

## Scope

This is **one coherent build** (acknowledged on the larger side; see *Phasing note*). It unifies the header and adds two genuinely new behaviors to the Topic context: **live seam-to-divider alignment** and the **scroll-aware Tier-A → slim-sticky beam fade**.

### In scope

1. **One shared header component** — a single implementation of the wordmark + beam + auth card + an **optional search slot**, used by **both** `app/page.tsx` (Home) and the Topic view (replacing `components/topic/TopicHeader.tsx`). It is a thin **page-host wrapper around `HeaderProjector`** plus the search/auth slots; the visual mark stays `HeaderProjector` (do not fork it). The bespoke `TopicHeader.tsx` is **retired** (deleted or reduced to a re-export of the unified header — Dev's call, but it is no longer a second header implementation).
2. **Optional search slot.** **Absent on Home** (the landing hero already owns search as the page's dominant element — unchanged). **Present on Topic at the upper-left** (the wordmark shifts right so its `wiki | plus` seam aligns to the content divider, freeing the upper-left for search). The slot **reuses the existing `TopicSearch`** (`topic-inline` ≥ md, `topic-disclosure` icon-reveal < md) — no new search component.
3. **Seam-to-divider alignment on Topic (Tier A, ≥ lg).** The lockup's internal seam (where "Wiki" ends and the indigo block begins) lands on the **real** article↔plus column divider — driven off the measured column boundary, not a hardcoded center. The article column is `1fr` and the plus rail `360px` within `max-w-[1200px] px-5 gap-7` (the committed Topic grid), so the divider is layout-derived and the seam tracks it.
4. **Scroll-aware beam on Topic.** At scroll-top the Topic header shows the **full beam (Tier A)**. As the reader scrolls past a threshold it **collapses to a slim, sticky bar with the beam faded out**, and stays slim + sticky while scrolled. Scrolling back to the top restores Tier A. (Decisions on threshold, fade mechanism, and the collapsed tier are in *Decisions*.)
5. **Wordmark → home.** The wordmark is a link to `/` from **both** pages (`HeaderProjector` already supports `as="a" href`).
6. **Collapsed mobile affordances.** Search → an **icon that reveals the field on tap** (`TopicSearch variant="topic-disclosure"`); auth → **first-initial only** for a logged-in user and an **icon for "log in"** for a logged-out user (the existing `AuthControl variant="topic-compact"` already provides the initial avatar + compact login; this issue places it, and confirms a logged-out compact state reads as an icon/short control, never an overflow).
7. **Auth consolidation.** One `AuthControl` instance in the unified header, reachable at **every** breakpoint (no more two-places duplication). The existing variants (`home` / `topic-plus` / `topic-compact`) are reused/placed; **no new auth functionality**.
8. **Doc reconciliation deliverables** (§10.1 #2 / §10.2 #6 / §9.2):
   - `TOPIC_PAGE_DESIGN.md` — update the split-wordmark wording ("The wordmark is split to label the columns") to the **single seam-aligned lockup straddling the column divider**, not two separate per-column labels.
   - `VISUAL_IDENTITY.md` §10 — mark the resolved items (§10.1 #3 adoption: both pages; §10.2 #6 breakpoint + seam-to-column mapping) and record the chosen scroll-transition + breakpoint as decisions.
   - `docs/design/landing-page.md` §5 — refresh to reflect that `projectionX` / `seamRatio` now have a **second, dynamic consumer** (the Topic header drives the seam off the real column ratio), no longer a landing-only reserved hook.
9. **No visual regression to the landing page** — its current Tier-A-at-every-width, one-row, beam-at-every-width behavior (the #61 owner decisions) is preserved exactly.

### Out of scope (state explicitly)

- The Wikipedia **article body** rendering — **untouched** (`VISUAL_IDENTITY` §9.3): no border, tint, or chrome added to the article; the beam burns to the content's own white.
- **Favicon / app-icon (Tier D)** — separate (§10.2 #4). The `glyph` variant already exists; this issue does not wire a favicon.
- **Dark-mode projector** — deferred (§6.4 / §10.2 #5); the existing `forced-colors` → flat-lockup fallback is kept, no dark inversion is designed.
- **Pre-rendered static SVG/PNG asset optimization** of the mark (§10.2 #7) — only if perf demands; otherwise defer. (The scroll handler must still be cheap — see AC11.)
- The topic **search's own behavior/results** beyond **placement + collapse** — `TopicSearch`'s typeahead, routing, keyboard model, and degrade are inherited from #12, not re-specified or changed here.
- **New auth functionality** — only the placement/collapse/consolidation of the existing `AuthControl`. No new menu items, OAuth providers, or session behavior. OAuth-only stands (VISION non-goal: no bespoke accounts).
- The **scroll-synchronized article↔rail behavior** (`TOPIC_PAGE_DESIGN.md` "synchronized scrolling") — unrelated; not touched by this header work.
- A second `HeaderProjector` implementation — the dynamic Topic behavior is a **new driven configuration** of the existing parameterized component, not a fork.

## Decisions (the four open product questions — RESOLVED, recorded as decisions)

These resolve the issue's open questions. They are **decisions for this build**, refinable by UX/Dev only on the explicit flags below.

### (a) The breakpoint where Topic columns stop sitting side-by-side — REUSE the existing `lg`.

**Decision: the side-by-side ↔ stacked handoff is the existing `lg` breakpoint already used by the Topic grid** (`lg:grid-cols-[1fr_360px]` in `TopicView`; below `lg` it is `grid-cols-1`). At `≥ lg` the article and plus columns sit side-by-side and there **is** a real divider — so the §6.0 seam-to-divider alignment applies (Tier A). At `< lg` the columns **stack**, there is no divider to hit, and the lockup carries its `wiki | +plus` split **within itself** as a self-contained unit (§6.3). Reusing `lg` is correct because the divider *only exists* where the grid is two-column, and that boundary is `lg` by the committed layout — inventing a different header breakpoint would let the seam aim at a divider that is not there (or fail to align at a width where it is). This makes the handoff a single, already-load-bearing breakpoint, not a new magic number.

### (b) Scroll threshold(s) + the beam-fade mechanism — fade by opacity, collapse the band height; threshold ≈ the flare distance.

**Decision:**
- **Threshold:** the header is **Tier A (full beam) while `scrollY` is at/near the top, and collapses once `scrollY` exceeds a single threshold** of roughly the beam's flare distance — **default ~`burnY` (≈ 130px)**, i.e. once the reader has scrolled about the height of the projected region. A single threshold (with a small hysteresis band so it doesn't flicker on a pixel boundary) — **not** a continuous scroll-linked scrub — keeps it cheap and predictable. (Exact px is a UX/Dev refinement; the *rule* is "about one beam-flare of scroll".)
- **Mechanism:** the beam (and the cool-fluorescent band below the lockup) **fade out via `opacity` → 0** while the **header band collapses in height** to the slim bar (the lockup row height, ~`56–64px`). Opacity for the beam fade (cheap, compositor-friendly, reversible); a height/transform transition for the collapse. **Roughly:** beam opacity `1 → 0` and band height `~130px → ~56–64px` over the transition. Use a short transition (~150–200ms) and **gate any motion on `prefers-reduced-motion`** (reduced-motion users get the slim state with no animated tween — the project's existing reduced-motion handling). The fade is opacity + height, **not** a re-layout of the lockup/search/auth (those persist across both states to avoid content jump).

### (c) Slim sticky collapsed state — go FLAT (Tier C), not lit-aperture (Tier B).

**Decision: the slim sticky bar is the FLAT lockup (Tier C) — `wiki | +plus` with the flat indigo "+" block, no lit aperture, no glow.** Justification: (1) the lit aperture (Tier B) exists *to be the source of a beam* — "you're looking into the projector lamp." With the beam faded out, a lit-but-projecting-nothing lamp reads as an orphaned glow, not a deliberate state; the metaphor only pays off when the beam is present. (2) Tier C is the cheapest render (no radial core, no screen-blend bleed, no `mix-blend-mode`/filters) — exactly what a *sticky* element repainted on scroll should be, supporting the perf guardrail (AC11). (3) `VISUAL_IDENTITY` §6.2 already assigns the **compact/sticky** Topic header to Tier C. So: **scroll-top = Tier A (lit aperture + full beam); scrolled = Tier C (flat lockup), beam faded out.** Tier B is **not used** in this build (it remains defined for future shorter-header contexts).

### (d) Where the article title lives in the unified Topic header — ASSUMPTION: it does NOT live in the header.

**Decision/assumption (flagged for UX/Dev refinement): the article title is NOT a header element.** The article already renders its own title in the article column (the `ArticleLeadBlock` `<h1>` "From Wikipedia · CC BY-SA 4.0"), which is the canonical, accessible page title. Today's bespoke `TopicHeader` echoes the title as a muted serif string at `≥ md` — a redundant echo that competed for the upper-left space we now want for **search**. Removing the header echo (a) frees the upper-left for the search slot the owner asked for, (b) avoids a duplicate `<h1>`/title, and (c) keeps the slim sticky bar genuinely slim. **Assumption to confirm:** that losing the in-header title echo is acceptable — in the slim sticky state the article title scrolls out of view, so a reader deep in a long article has no always-visible "what am I reading" cue in the header. If UX finds that cue is needed, the natural refinement is a **muted title in the slim sticky state only** (where the article `<h1>` has scrolled away), not in Tier A (where the article title is right there). This is the one place I am explicitly stating an assumption for UX/Dev to refine; everything else above is a decision.

## Acceptance criteria

Each is independently verifiable by a **test**, a **code-review check**, or a **screenshot of the built UI** at a stated breakpoint. (Per the prototype phase, UI-state ACs are verified by tests + screenshots/built UI; this round ships per the build-loop's normal delivery.)

- **AC1 — One shared header, used by both pages.** A single header component (the page-host wrapper around `HeaderProjector`) is imported and rendered by **both** `app/page.tsx` and the Topic view. There is **no** second header implementation: `components/topic/TopicHeader.tsx`'s bespoke two-block markup is gone (file deleted or reduced to a re-export of the unified header). *(Verify: code review — one header component file is the source of the wordmark+beam+auth; `git grep` shows no surviving bespoke `＋plus` header block in `TopicHeader.tsx`; both hosts import the unified header.)*

- **AC2 — Topic seam aligns to the real content divider at ≥ lg.** On a Topic page at `≥ lg`, the lockup's internal `wiki | plus` seam lands on the **measured** article↔plus column divider (the boundary between the `1fr` article column and the `360px` plus rail) within a small tolerance (**≤ 4px**), driven off the real column geometry — not a hardcoded `cw/2`. *(Verify: a test that, given the Topic grid's measured column boundary, the lockup is positioned so the seam x equals the divider x ± 4px; and a desktop screenshot showing "Wiki" over the article column and "+plus" over the plus rail.)*

- **AC3 — Wordmark navigates home from both pages.** The wordmark is a link with accessible name `wiki+` whose href is `/`; activating it (click or Enter) navigates to the home page from **both** the landing page and a Topic page. *(Verify: a test asserting the wordmark renders as a link to `/` on the Topic page with accessible name `wiki+`; a click/keyboard test that it routes home.)*

- **AC4 — Scroll-aware transition: Tier A at top → slim sticky, beam faded, while scrolled.** On a Topic page, at `scrollY ≈ 0` the header renders the **full Tier-A treatment** (lit aperture + descending beam + gold edge). After scrolling past the threshold (≈ `burnY`, decision (b)), the header **collapses to a slim sticky bar** (flat Tier-C lockup, decision (c)) with the **beam faded out (opacity → 0)** and remains slim + `sticky`/`fixed` at the top while scrolled; scrolling back to the top restores Tier A. *(Verify: a test toggling the scroll state asserts the beam element is present/opacity≈1 at top and absent/opacity≈0 + reduced band height when scrolled, and that the bar is sticky; screenshots of both states.)*

- **AC5 — Beam fade respects reduced motion.** When `prefers-reduced-motion: reduce` is set, the Tier-A↔slim transition applies the end states **without an animated tween** (no beam opacity/height animation); the slim sticky state is still reached. *(Verify: a test or DOM/CSS assertion that the transition is gated by the reduced-motion media query; the collapsed state is reachable with motion disabled.)*

- **AC6 — Optional search slot: absent on Home, present upper-left on Topic.** The unified header renders **no** search on the landing page (the landing hero owns search, unchanged), and renders `TopicSearch` in the **upper-left** of the Topic header (the wordmark having shifted right to align the seam to the divider). *(Verify: code review/test — the header's `search` slot is unset on the Home host and set to `TopicSearch` on the Topic host; a Topic screenshot showing search at the upper-left; a Home screenshot showing no header search and the landing hero search unchanged — AC13.)*

- **AC7 — Collapsed mobile search (icon-reveal).** On a Topic page `< md`, the header search renders as the **`topic-disclosure` icon** that reveals the input field on tap (the existing #12 disclosure variant), not an always-open full-width field. *(Verify: a test that at the disclosure variant the field is hidden until the toggle is activated, then shown; a narrow Topic screenshot showing the magnifier icon.)*

- **AC8 — Collapsed mobile auth (first-initial / login-icon).** On a Topic page at narrow widths, a **logged-in** user's auth control shows their **first initial** (the avatar), and a **logged-out** user sees a **compact login affordance** that reads as an icon/short control (`AuthControl variant="topic-compact"`), neither overflowing nor overlapping the wordmark/search. *(Verify: a test rendering `topic-compact` in both session states asserts the initial avatar (signed-in) and the compact "Log in" control (signed-out); narrow Topic screenshots of both states with no overflow.)*

- **AC9 — Auth reachable at every breakpoint, consolidated to one instance.** The unified header renders **exactly one** `AuthControl` instance per header, and the login/account affordance is present and operable at **every** breakpoint (`< md`, `md`–`lg`, `≥ lg`) on the Topic page — the old two-places duplication (`topic-plus` inside the block **and** `topic-compact` on the row) is gone. *(Verify: code review — a single `AuthControl` in the header; a test that the auth control is in the DOM and focusable at the small, medium, and large breakpoints.)*

- **AC10 — `< lg` stacked layout: the split is carried within the lockup, no broken alignment.** On a Topic page `< lg` (columns stacked), the header does **not** attempt to align the seam to a (nonexistent) divider; the lockup shows its self-contained `wiki | +plus` split (§6.3) and nothing is stretched across or mis-aimed at a divider that is absent. *(Verify: a narrow Topic screenshot showing an intact, self-contained lockup; a test/assertion that below `lg` the seam-to-divider positioning is not applied.)*

- **AC11 — The scroll handler is cheap (no jank).** The scroll-state toggle does **not** thrash layout or re-measure on every scroll event: it uses a passive, throttled/`requestAnimationFrame`-gated or threshold-with-hysteresis listener, and the slim sticky state is the cheap Tier-C render (no `mix-blend-mode`/filter on the sticky bar). *(Verify: code review — the scroll listener is passive and rate-limited, reads scroll position without forcing synchronous layout in a tight loop, and the collapsed state renders Tier C; no per-frame `getBoundingClientRect` measurement of the column divider on scroll.)*

- **AC12 — The landing page is visually unchanged (no regression).** The landing header keeps its #61 behavior exactly: Tier A at **every** width, one row (lockup + single `AuthControl`, no top strip, no second row), beam-at-every-width with the true-scale stem + asymmetrical arms, no "Contribute" label, and the hero search below it unchanged. *(Verify: a landing screenshot diff against the pre-change build at desktop and narrow widths; the existing #15/#61 landing tests still pass.)*

- **AC13 — Accessibility & contrast preserved on the unified header.** On both pages the wordmark exposes the accessible name `wiki+` with decorative layers `aria-hidden`; the real serif "Wiki" meets AA on the header field and the white "plus" passes AA-large on indigo `#676EB4`; the search and auth in the Topic header are keyboard reachable (tab to search, reveal/type; tab to auth, operate); gold is never the sole carrier of meaning. The slim sticky bar keeps the wordmark, search, and auth all keyboard-operable. *(Verify: an accessible-name assertion (`wiki+`, decorative layers hidden); a keyboard pass through Topic search + auth in both Tier-A and slim states; a contrast check on the two real-text pairs — inherited from #15's a11y model, re-asserted here for the Topic host.)*

- **AC14 — Build, types, tests green.** `yarn typecheck`, `yarn test`, and `yarn build` all pass. *(Verify: CI / local run.)*

- **AC15 — Doc reconciliation deliverables present.** The diff includes: (a) `TOPIC_PAGE_DESIGN.md` updated so the split-wordmark wording reflects the single seam-aligned lockup straddling the divider (not two separate per-column labels); (b) `VISUAL_IDENTITY.md` §10 updated to mark §10.1 #3 (adoption: both pages) and §10.2 #6 (breakpoint = `lg`; seam-to-column mapping) resolved and to record the scroll-transition decision; (c) `docs/design/landing-page.md` §5 refreshed to note `projectionX`/`seamRatio` now have the dynamic Topic consumer. *(Verify: all three edits present in the diff; the wording matches the decisions above.)*

## Success metric

- **Primary (qualitative this round; trackable at launch):** a reader on a Topic page can tell **at a glance, from the header alone**, which column is the encyclopedia and which is the curation layer — verified by **UX evaluation** that the seam lands on the divider and the lockup reads as labeling both columns (the §2.2/§6.0 intent), and by the wordmark being a working home link. The launch-time trackable proxy: **wordmark→home navigations from Topic pages** (confirming the affordance is discovered and used) and an absence of "where's the search/login on the topic page?" confusion.
- **Secondary (qualitative):** the scroll-aware behavior is judged to *return vertical space* — UX confirms the slim sticky bar keeps wordmark/search/auth usable while reclaiming the beam's height on a long article, with no jank and no content jump on the Tier-A↔slim transition.
- **Guardrail:** **zero** regression to the landing page (AC12) and to `TopicSearch`/`AuthControl`'s existing #12 / issue-C behavior; one header path replaces two with no loss of any current Topic-header capability (search at every breakpoint, auth at every breakpoint).

## Assumptions

- **A1 — `HeaderProjector` is extended, not forked.** The dynamic Topic seam/scroll behavior is a **new driven configuration** of the existing parameterized `HeaderProjector` (driving `projectionX`/`seamRatio` off the real column ratio, and toggling Tier A↔C on scroll). The component already measures apex/seam live and supports `as="a" href`, the geometry props, and the tier variants — this build *drives* those, it does not re-implement the mark. *(If Dev finds the component must be meaningfully restructured to host the scroll-aware swap, that is a Dev structural decision, not a re-spec — the contract is "one mark implementation".)*
- **A2 — The "real content divider" is the committed Topic grid boundary.** The divider the seam aligns to is the article(`1fr`)↔rail(`360px`) boundary in `max-w-[1200px] px-5 gap-7 lg:grid-cols-[1fr_360px]`. If the Topic grid ratio ever becomes user-adjustable (the `seamRatio` forward-looking note in the landing design spec), the seam follows it — same prop, different driver. UX/Dev map the exact divider x (gutter center vs. rail start) at build; the *rule* (seam = the divider, measured) is fixed.
- **A3 — Reused variants suffice for the collapsed states.** `TopicSearch` (`topic-inline` / `topic-disclosure`) and `AuthControl` (`topic-plus` / `topic-compact`) already provide the search icon-reveal and the first-initial/compact-login affordances. This build **places** them; it does not add new variants unless UX finds a gap (e.g. a logged-out compact control that reads cleanly as an icon at the very narrowest widths) — flagged for UX, not pre-built.
- **A4 — Article title placement.** Per decision (d), the title is not a header element; if UX determines a slim-state title cue is needed, that is the sanctioned refinement.
- **A5 — Topic-header geometry numbers are UX/Dev's to map.** The Topic header is a different height/context than the landing hero (it is sticky and shorter when collapsed); the strip-canvas / landing `burnY=130`, `cyMid=44` numbers are the landing config. The Topic Tier-A height, the slim-bar height, and the exact scroll threshold are mapped to the real Topic layout at build (the *meaning* — seam-on-divider, beam-at-top, slim-when-scrolled — is fixed; the px are not pre-decided here).

## Phasing note (if a smaller first merge is wanted)

This is acknowledged on the larger side: **seam-to-divider measurement** and the **scroll-driven beam fade** are both new behaviors that did not exist after #15. If the owner wants a smaller first merge, the natural split (per the issue) is:
1. **Unify** — one shared header, seam-aligned at Tier A, wordmark→home, the search/auth slots, the collapsed mobile variants, auth consolidation, the doc reconciliation (AC1–AC3, AC6–AC10, AC13, AC15).
2. **Polish the scroll transition** — the Tier-A→slim-sticky beam fade and its reduced-motion + perf guarantees (AC4, AC5, AC11).

Default is one build; the split is available if scope pressure demands.

## Hand-off

- **UX:** produce the buildable design spec for the **unified header** (written before implementation): the Topic header composition (search upper-left, lockup seam on the divider, auth right), the **exact** seam-to-divider mapping (which pixel the seam targets), the **Tier-A and slim-sticky** compositions and the transition (threshold, fade, the reduced-motion behavior), the `< lg` stacked composition (self-contained split), and the mobile collapsed states (search disclosure, auth compact). Resolve the assumption flags (A3 narrow logged-out control; A4 slim-state title cue). Then evaluate the built header against `VISUAL_IDENTITY.md` (seam-on-divider fidelity, the beam at Tier A, the slim-state read) per §10.3.
- **Development:** build the **one shared header** (host wrapper around `HeaderProjector`) consumed by `app/page.tsx` (no search slot, unchanged landing behavior — AC12) and the Topic view (search slot + seam-on-divider + scroll-aware Tier A↔slim + wordmark→home + consolidated auth). **Retire** `components/topic/TopicHeader.tsx`. Drive `projectionX`/`seamRatio` off the measured Topic column divider; implement the cheap, reduced-motion-gated scroll toggle (Tier A↔Tier C). Add tests for AC1–AC14. Make the doc edits (AC15). **Do not** touch the article body (§9.3) or add new auth functionality.
- **QA & Review:** verify AC1–AC15 (tests + screenshots at the named breakpoints + scroll states), code quality (one header path, no forked mark, cheap scroll handler), and a security pass (the header adds inline SVG + a scroll listener, no new external fetch; auth/search paths unchanged from issue C / #12).
