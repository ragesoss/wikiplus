# Design spec — Topic page loading states (issue #146)

- **Role:** UX / Design · **Status:** design contract for build (written *before* implementation) ·
  **Issue:** [#146](https://github.com/ragesoss/wikiplus/issues/146)
- **Designs against:** `docs/specs/topic-loading-states.md` (Product spec, AC1–AC9 — the authority
  for scope and "done").
- **Reads:** `docs/VISUAL_IDENTITY.md` §2 (the projector / beam metaphor), `docs/TOPIC_PAGE_DESIGN.md`
  (§"Three states", §"Two infoboxes", the plus rail, the Indigo Press palette),
  `mockups/inline-indigo-empty-v3-declutter.html` (the legitimate settled-empty (b) reference),
  `mockups/inline-indigo-sync.html` (the curated reference), `components/wordmark/HeaderProjector.tsx`
  + `components/header/SiteHeader.tsx` (the existing projector mark — **not** to be forked),
  `components/topic/ArticleBody.tsx` (the existing `ArticleSkeleton` / `ArticleError`).
- **Feeds:** Development (build the treatment + coordinate the flows + add the three scenes) →
  QA & Review (verify AC1–AC9) + UX evaluation (judge the built UI against this spec).

---

## 0. The user problem, in one line

A reader who lands on a Topic page must **never read copy that contradicts what the page is actually
doing.** Today the page tells a still-loading or outright-failed topic "no suggestions for this topic
yet" — a verdict it has no basis to make. This spec designs a coordinated, projector-styled loading
experience so the three honest conditions stay visually distinct:

- **(a) Loading** — a region's data is pending → the **projector loading treatment** (never empty/error copy).
- **(b) Loaded-and-genuinely-empty** — settled, zero curated + zero remaining suggestions → the
  legitimate empty/bootstrap copy (mockup `inline-indigo-empty-v3-declutter.html`). **This is the only
  place the "none yet / weigh-in" copy may appear.**
- **(c) Load failed / errored** — the article fetch failed, or the plus store read failed → the
  relevant **error treatment**, and **no** "no suggestions" copy as a side effect.

## 1. User stories (what each state serves)

- **(a)** *As a reader on a slow connection, I want the page to show me it's working — in the product's
  own visual voice — so I trust it's loading and don't read a false "nothing here" verdict.* (AC1, AC4)
- **(a, warm)** *As a reader on a fast/warm connection, I want the settled page immediately — no loader
  flashing in front of content that's already ready.* (AC5)
- **(b)** *As a reader who arrives at a brand-new topic, I want to understand there's nothing vouched-for
  yet and see how to weigh in — only once the page has actually checked.* (AC1, AC8)
- **(c)** *As a reader when Wikipedia is unreachable, I want a clear "couldn't load the article" with a
  retry — and I do not want the page to also tell me the topic is empty, which makes no sense.* (AC2, AC9)
- **(c, plus-preserved)** *As a reader when the article fails but curated videos exist, I want those
  videos still on the right — the failure of one region shouldn't blank the other.* (AC9)
- **(a11y)** *As a screen-reader user, I want to be told a region is loading and told when it has
  loaded — and never to hear a "no suggestions" announcement during load.* (AC6)

---

## 2. The two regions and their independent state machines

The Topic page has two regions that load on independent async flows. **They are designed to load
independently and never block one another** (the plus side stays useful when the article fails — AC9;
the article renders even if the store read fails). The coordination this spec adds is **honesty of
copy**, not a single shared spinner.

### 2.1 Article column (left, `1fr`)

Driven by `fetchState: "loading" | "ready" | "error"` (the Wikipedia fetch).

| `fetchState` | What renders | Component |
|---|---|---|
| `loading` | **Projector skeleton — article variant** (§3.2) | `ArticleSkeleton` (upgraded) |
| `ready` | The faithful article (lead block in masthead, sections in reader) | `ArticleLeadBlock` / `ArticleSections` |
| `error` | The article error card — **no suggestion copy anywhere on the article side** | `ArticleError` |

### 2.2 Plus side (right rail `360px` + the full-bleed General band + TOC + wiki+ panel)

Driven by two facts that settle independently:
- **store** — `storeReady` (gates the panel / TOC / band) and `storeError` (the read failed). Per the
  existing design `storeReady` flips `true` *even on a store error*, so the rail shows an honest line,
  not a permanent skeleton.
- **candidates** — `candidatesLoading` (the live suggestion search), decoupled from `storeReady` so a
  slow YouTube search never blocks the page chrome.

The plus side therefore has these settled faces (the §"Three states" model is **unchanged** — AC8):

| Plus state | Meaning | Renders |
|---|---|---|
| **loading (store)** | `!storeReady` | **Projector skeleton — plus variant** (§3.3) in place of the panel/TOC/band region |
| **loading (candidates)** | `storeReady && candidatesLoading` and no suggestions resolved yet | the panel/TOC render; the rail's suggestion region shows the **`Looking for suggestions…` projector line** (§3.4) |
| **settled-populated** | `storeReady && !candidatesLoading` with curated and/or suggestions | the three-state render (empty/mixed/fully-curated), unchanged |
| **settled-empty (b)** | `storeReady && !candidatesLoading` with 0 curated **and** 0 remaining suggestions (and `!storeError`) | the legitimate empty/bootstrap copy — **the only place it appears** |
| **error (store)** | `storeError` | the rail's honest `Couldn't load curated videos — please refresh.` floor; **no empty-suggestion copy** |

---

## 3. The projector loading treatment

### 3.1 Concept — "the lamp is warming up"

The brand's identity is a **daylight projector**: the plus layer is a lamp projecting curation-light
onto Wikipedia (`VISUAL_IDENTITY.md` §2). The loading treatment is the visual answer to *"the projector
is warming up; the image hasn't resolved yet."* Concretely: a **single warm beam of light sweeps across
a neutral skeleton**, left→right, as if the lamp is scanning the surface it will project onto. When it
settles, the real content takes the skeleton's place. This reads unmistakably as wiki+ (a moving warm
beam over a surface), not as an off-the-shelf radial spinner.

**One motif, two coordinated variants.** Both regions share **one** loading language — the *scan beam
over a skeleton* — so the page reads as one coherent loading event, with two variants tuned to each
region's shape:
- **Article variant** — a quiet, Wikipedia-flavored skeleton (this is the *source* side; it must not
  feel like the colorful plus side). The scan beam is faint.
- **Plus variant** — a more present skeleton in the Indigo Press card idiom (bordered boxes), with a
  slightly stronger warm scan, because this is the plus side's own surface.

This is deliberately **not** a literal re-render of the `HeaderProjector` beam SVG. The header mark is
the *projector lamp itself*; the loading treatment is *what the lamp's light does to a surface that
hasn't resolved* — the same daylight/scan vocabulary, applied as a CSS sweep over skeleton geometry.
**Do not fork or re-mount `HeaderProjector`** for loading; reuse only its **tokens** (the daylight
gold, the surface whites) and its *idea*.

### 3.2 Geometry, motion, color (the buildable detail)

The treatment is an **overexposure scan**: a soft, warm, low-opacity vertical band that travels
horizontally across the skeleton container, brightening each skeleton bar as it passes — overexposing
it toward white at the band's center, exactly the §2.5/§2.9 "burn to white" principle in motion.

- **Skeleton base.** Reuse the existing `.skeleton-bar` geometry (neutral `--color-surface-2` bars,
  3px radius). The *bars* are the structure; the *scan* is the projector signal layered over them. Keep
  the existing `ArticleSkeleton` bar layout (a title bar + 7 body bars) for the article variant; the
  plus variant uses bordered card-shaped blocks (§3.3).
- **The scan band.** A `mix-blend-mode: screen`, `blur(8px)`, ~`28%`-of-width vertical gradient band
  (`transparent → rgb(238,206,135 / .42) → rgb(255,252,246 / .65) → rgb(238,206,135 / .42) →
  transparent`) — the daylight golds (`--gold-rim #EECE87`, `--bleed-warm-white #FFFCF6`) from
  `VISUAL_IDENTITY.md` §4.2. Screen-blend means it **brightens** the skeleton (overexposes toward
  white) without ever darkening it, and it is a near no-op off the bars.
- **Motion.** The band translates `background-position` (or `transform: translateX`) from `-30%` to
  `130%` of the container width, **`1.8s` `ease-in-out` infinite**, a single left→right pass that loops.
  One direction only — a sweep, never a bounce (a bounce reads as a generic shimmer, not a projection).
- **Speed relation to the header.** Slower and softer than any header animation; the loading scan is
  ambient, not attention-grabbing. It must never compete with the (static) header mark.
- **Token reuse.** Pin the scan as a single CSS class (proposed `.projector-scan`) consuming the
  existing daylight-gold values — **no new gold introduced** (AC7; gold stays the lighter, desaturated
  daylight gold, never the brand `#E5AB28`, never a functional signal).

**Relationship to the existing `.skeleton-bar` shimmer.** The current `@keyframes wikiplus-shimmer`
(an opacity pulse on each bar) is a generic shimmer with no brand meaning. **Replace the per-bar
opacity pulse with the single container-level projector scan.** The bars stay static neutral; the scan
band is the one animated element per region. This is cheaper (one animated layer, not N pulsing bars)
and on-brand. `ArticleSkeleton`'s existing `role="status"` + `aria-busy` markup is **preserved**
(§5).

### 3.3 Plus-side skeleton (the plus variant)

While `!storeReady`, the rail/panel region renders a **plus-flavored skeleton** in place of the wiki+
panel + TOC (and the General band shows a matching skeleton row):

- **wiki+ panel placeholder** — a single white card with a **2px ink (`#2C2C2C`) border** (the
  `.plus-card` hardbox idiom, so it reads as the plus side even while loading), containing 3 neutral
  skeleton bars (a value-line-width bar, a counts-block block, an action-width bar). The card border is
  drawn (not skeletoned) so the Indigo Press identity is present from the first frame.
- **TOC placeholder** — 4–6 short neutral bars.
- **General band placeholder** — a single full-bleed row of 3–4 neutral thumbnail-shaped blocks
  (16:9-ish), matching the strip's thumbnail-forward shape, so the band's height doesn't jump when it
  resolves.
- The **projector scan** (§3.2, plus variant — slightly stronger) sweeps across each of these.

The skeleton card carries the border but **no indigo color-block and no text** — small text is never
placed on a loading surface, and the indigo band only appears once content is real (keeps the AA rule
in §5 trivially satisfied: there is no small text on indigo during load).

### 3.4 The rail suggestion-loading line

When `storeReady && candidatesLoading` and no rail suggestions have resolved, the rail shows a single
status line (after any curated cards, so curated content is never disturbed — AC9): the existing
`Looking for suggestions…` line, restyled to carry a **small inline scan glyph** — a 3-dot warm
daylight-gold scan that reuses the same `.projector-scan` warmth at small scale (decorative,
`aria-hidden`), so even the text line reads as "the lamp is still finding things," not a generic
ellipsis. The line's text is the carrier of meaning; the glyph is decoration (AC7).

### 3.5 Reduced-motion fallback (required — AC4's treatment must respect it)

Under `prefers-reduced-motion: reduce`, the **scan does not animate.** The fallback is a **static
overexposure**: the warm daylight band is rendered **once, centered** over the skeleton at a fixed
position (a soft static glow across the middle of the skeleton), giving the still treatment the same
projector character without motion. The skeleton bars are static (already the case — globals.css
disables `.skeleton-bar` animation under reduced motion). The `aria-busy` + `role="status"`
announcement (§5) is **unaffected** by motion preference, so a reduced-motion user is told it's loading
exactly the same way. (This mirrors the project's existing reduced-motion discipline: the static
end-state stands in for the animation.)

### 3.6 No minimum display time — fast loads show settled content (AC5, binding)

**This treatment must impose no artificial delay.** It is a **pure render-time conditional**: a region's
loading treatment mounts **only if** that region's data is still pending **at render time**. There is
**no** minimum-display timer, no `setTimeout`, no "show the loader for at least N ms," no fade-out
gate before settled content. When `fetchState` is already `ready` (or the store/candidates already
resolved) on first render — a warm/fast load — the reader sees the settled content with **no loading
treatment mounted at all**, and therefore no flash. Dev: do not add any debounce/min-duration; if a
reviewer finds a timer gating the settled render, that is an AC5 defect. (The scan loops while present;
the loop is interrupted the instant the data resolves and the conditional swaps to content.)

---

## 4. The state matrix — article × plus side (the disambiguation contract)

The two regions are independent, so the page is the **product** of an article state and a plus state.
This table is the buildable contract; the **highlighted rows are the bug** (b's copy leaking into a or
c) and must be handled as specified.

| # | Article (`fetchState`) | Plus side | Article column shows | Plus side shows | Note |
|---|---|---|---|---|---|
| 1 | loading | store loading | **article scan skeleton** | **plus scan skeleton** | the (a) screenshot; **no empty copy, no error copy** |
| 2 | loading | candidates loading | article scan skeleton | panel/TOC settled + `Looking for suggestions…` (§3.4) | both regions honest-pending |
| 3 | ready | store loading | article (real) | plus scan skeleton | article fast, plus still loading — both honest |
| 4 | ready | candidates loading | article (real) | panel/TOC + curated (if any) + `Looking for suggestions…` | **no "no suggestions" yet** (AC1) |
| 5 | ready | settled-populated | article (real) | three-state render (empty/mixed/fully-curated) | the settled product, **unchanged** (AC8) |
| 6 | **ready** | **settled-empty (b)** | article (real) | **legitimate empty/bootstrap copy** (the (b) screenshot) | the ONLY place (b) copy appears |
| 7 | ready | store error | article (real) | rail floor `Couldn't load curated videos — please refresh.` | **no empty-suggestion copy** (AC2) |
| 8 | **error** | **store loading** | **`ArticleError` card** | **plus scan skeleton** | **AC2 critical:** error + loading, NO "no suggestions" |
| 9 | **error** | **candidates loading** | `ArticleError` card | panel/TOC + `Looking for suggestions…` | error + pending, NO empty verdict |
| 10 | **error** | **settled-empty (b)** | `ArticleError` card | **(b) copy may show on the PLUS side only** | **AC2:** (b) is the plus side's *own* honest state; it is **never** presented as the page's verdict on the failed article, and `ArticleError` itself carries **no** suggestion copy |
| 11 | error | settled-populated | `ArticleError` card | rail still lists curated clips (AC9) | the plus side stays useful |
| 12 | error | store error | `ArticleError` card | rail error floor | both regions errored, each honest, no cross-contamination |

**The single load-bearing gate (the fix).** The "no suggestions" / empty-suggestion line renders
**only** when **all** of these hold (AC1, AC2):

```
storeReady === true            // the store has settled
&& storeError === false        // the store did NOT error
&& candidatesLoading === false // the candidate search has settled
&& !hasCurated                 // 0 curated
&& sectionCandidates.length === 0 && generalCandidates.length === 0  // 0 remaining suggestions
```

This is a **plus-side** condition only — it is **blind to `fetchState`** *as a positive enabler* (it
never depends on the article succeeding) and it is **never** triggered *by* an article error. Per
row 10, when the article errors and the plus side genuinely settled empty, the legitimate (b) copy
still belongs **on the plus side** (that is the honest truth of the plus side), but:
- the **article-error region (`ArticleError`) carries no suggestion/empty copy of its own**, and
- the empty copy is **never** worded or positioned as "this topic is empty" — it is the plus rail's
  own "none vetted yet" state, exactly as in the legitimate (b) render.

The misleading bug — empty copy appearing while `candidatesLoading` or `!storeReady`, or as a
consequence of the article failing — is eliminated by this gate.

---

## 5. Accessibility (AC6, AC7)

### 5.1 The announcement model — one polite live region per loading region

Each loading region exposes a busy state **and** a polite announcement, so a screen-reader user is told
content is loading and told when it has loaded — and **never** hears a contradictory "no suggestions"
during load (AC6).

- **Article column (loading).** Keep `ArticleSkeleton`'s existing pattern: the skeleton container
  carries `aria-busy="true"` and an `sr-only role="status"` node announcing **`Loading article…`**.
  When `fetchState` becomes `ready`, the skeleton unmounts and the article renders; the status node
  is gone, so AT is not left "busy."
- **Plus side (store loading).** The plus skeleton container (the placeholder for panel/TOC/band)
  carries `aria-busy="true"` and an `sr-only role="status"` node announcing **`Loading videos…`**.
- **Candidate search (loading).** The existing polite live region (`<p role="status" aria-live="polite">`
  carrying `candidateAnnounce`) already announces the candidate search; it is **preserved**. Its copy
  must be a *loading* announcement (`Looking for suggestions…` / when resolved, the settled count or
  silence) — it must **never** fire the "no suggestions" string while `candidatesLoading` is true.
  The rail's visible `Looking for suggestions…` line keeps `aria-live="polite"`.
- **On settle.** When the candidate search resolves to zero on a genuinely-empty topic, the polite
  region announces the settled empty state **once** (e.g. nothing, or a brief "No suggestions found")
  — but only under the §4 gate, so it can never announce empty during load or because of an article
  error.

### 5.2 No color-only signals (AC7)

- The projector scan is **decorative** and is **never the sole carrier of "loading"** — the meaning is
  carried by the `aria-busy` + the `role="status"` text ("Loading article…", "Loading videos…",
  "Looking for suggestions…"). A user who can't perceive the warm sweep still gets the state from text
  and from the skeleton shape.
- The error states carry **text** ("Couldn't load the article", "Couldn't load curated videos —
  please refresh.") and shape (the bordered alert card / the rail floor), not color alone.
- The settled-empty (b) state carries its honest text copy (§6), never color/border-style alone.

### 5.3 AA contrast (AC7)

- All loading skeletons are **neutral bars + a decorative warm scan** — no text on them, so no contrast
  concern during load. The plus skeleton card uses a drawn 2px ink border on white (the hardbox
  idiom), not an indigo color-block, so **no small text ever sits on the bare indigo `#676EB4` band
  during loading.**
- The error / empty copy follows the committed rule: small body text stays on **white panels** (the
  `.plus-card` / rail-floor treatment), never bare on the indigo band (`TOPIC_PAGE_DESIGN.md`). The
  rail error floor's red text (`text-red-700` equivalent) and the `text-muted` empty line both sit on
  the light rail surface — confirm ≥4.5:1 at build (both clear AA on the light rail).
- The daylight-gold scan is exempt from text-contrast rules (decorative, never meaningful — same
  basis as `VISUAL_IDENTITY.md` §7.2/§7.3 for the wordmark gold).

---

## 6. Microcopy (quote exactly)

Keep the existing legitimate strings — they are already honest; this issue only *gates* them. The
strings, by state:

**Loading (a) — announcements (sr-only / status):**
- Article loading: **`Loading article…`** *(existing — preserved)*
- Plus store loading: **`Loading videos…`** *(new — the plus skeleton's status node)*
- Candidate search loading (visible rail line + polite region): **`Looking for suggestions…`**
  *(existing — preserved)*

**Settled-empty (b) — the legitimate copy (this is the ONLY place it appears):**
- The rail empty line: **`No suggestions for this topic yet — use ‘Find more’ above to add the first
  video.`** *(existing — preserved; gated per §4)*
- The wiki+ panel empty volume block copy and the General-band header copy are **unchanged** from the
  committed empty-state model (`TOPIC_PAGE_DESIGN.md` §"Empty / zero-curation state",
  `mockups/inline-indigo-empty-v3-declutter.html`). This spec does **not** change empty-state copy —
  it ensures the empty render only appears when the plus side has genuinely settled empty.

**Error (c):**
- Article error (existing `ArticleError`): heading **`Couldn't load the article`**, body **`We couldn't
  reach Wikipedia just now. The curated videos are still here on the right.`**, actions **`Try again`**
  / **`Open on Wikipedia ↗`**. *(All existing — preserved.)* Note the body copy already correctly
  references the still-present plus side (AC9) and makes **no** claim about emptiness.
- Plus store error (existing rail floor): **`Couldn't load curated videos — please refresh.`**
  *(existing — preserved.)*

> Copy ownership: the context-note / empty-state editorial copy belongs to Curation/Editorial; this
> spec embodies the existing committed strings and changes none of them. If any string above needs to
> change, that is a Curation/Editorial decision, not part of #146.

---

## 7. Responsive behavior

The Topic grid is `grid-cols-1` below `lg` (columns stack: article first, then the rail/panel) and
`lg:grid-cols-[1fr_360px]` at `≥ lg` (side-by-side). The loading treatment follows the same layout —
it occupies exactly the box its settled content will occupy, so **nothing shifts when content
resolves** (no layout jump at any width).

- **Desktop (`≥ lg`, ~1280).** Article scan skeleton in the `1fr` column; plus scan skeleton in the
  `360px` rail (sticky position matches the settled rail). General-band skeleton full-bleed below the
  masthead. Both scans run; they are independent (they may resolve at different times — that is honest
  and expected).
- **Tablet (`md`, ~834).** Same two-column structure as desktop for the masthead; the plus skeleton
  card spans its column. Scan timing identical.
- **Mobile (`< lg`, ~390).** Columns **stack**: the article scan skeleton renders first (full width),
  the plus scan skeleton (panel placeholder + TOC + band row) stacks **below** it, full width. The
  scan band is sized to each stacked region's own width (it sweeps each region independently). The
  reduced-motion static glow (§3.5) is centered per region.
- The scan band width is **a fraction of its container** (~28%), so it scales naturally — no fixed-px
  band that looks wrong at 390 vs 1280.

---

## 8. The three required catalog scenes (AC3 evidence)

Dev must add **three** `Scene`s to `e2e/screenshots/catalog.ts` (one object each; they are then
captured across viewports × auth and indexed automatically) so the gallery proves the three conditions
are distinct (AC3). Each needs a `prepare`/`ready` step that drives the page to — and **holds** — the
state worth seeing. Group them under **`Topic · loading & states`**.

### Scene (a) — `topic-loading`
- **Label:** `Topic — loading (projector scan, both regions)`
- **Note:** `Both regions pending: the projector scan over the article + plus skeletons. No empty or error copy.`
- **State to hold:** `fetchState === "loading"` **and** `!storeReady` (or `candidatesLoading`), i.e.
  the article fetch and the plus store both still pending. The fixture must delay/hold both flows so
  the capture lands during load (e.g. a stub that never resolves within the capture window, or a
  `prepare` that intercepts and stalls the article + store reads). This is the row-1 cell of §4.
- **Captures:** the masthead region (article skeleton + plus skeleton) — clip the two-column masthead,
  or `fullPage` if the band skeleton is in frame. Both viewports/auth as default.
- **Evidence for:** AC1 (no empty copy during load), AC4 (projector-derived treatment), AC6 (the
  skeleton's `aria-busy`/status is present — verified in test, not the shot).

### Scene (b) — `topic-settled-empty`
- **Label:** `Topic — settled, genuinely empty (legitimate bootstrap)`
- **Note:** `A real topic that settled with 0 curated and 0 suggestions: the legitimate empty/weigh-in copy. Distinct from loading and from error.`
- **State to hold:** `fetchState === "ready"`, `storeReady`, `!storeError`, `!candidatesLoading`,
  0 curated, 0 remaining suggestions — the row-6 cell. Use the existing `empty` stub profile but with
  the candidate search resolving to **zero** results (so the §4 gate is satisfied and the legitimate
  (b) copy renders). Mirrors `mockups/inline-indigo-empty-v3-declutter.html`.
- **Captures:** `fullPage` (the wiki+ panel empty volume block + the rail empty line + the General-band
  empty header are all in frame). Both viewports/auth.
- **Evidence for:** AC1/AC3 (the (b) copy appears here and ONLY here), AC8 (the settled empty render is
  unchanged from the committed model).

### Scene (c) — `topic-article-error`
- **Label:** `Topic — article load failed (error card, no contradictory empty copy)`
- **Note:** `The reported bug, fixed: the article error card with NO "no suggestions" message. The plus side reflects its own state independently.`
- **State to hold:** `fetchState === "error"` — drive the article fetch to fail (the existing fixtures
  have a path for an unreachable/failed article; reuse it). Pair it with a plus side that has **curated
  clips** (the `curated` stub) so the shot also demonstrates AC9 (the rail still lists clips while the
  article errored) — this is the row-11 cell, the most informative error shot. (Row 8/10 — error +
  loading / error + settled-empty — are covered by unit/integration tests on derived state per AC2;
  the screenshot uses the populated-plus case so the "no contradictory empty copy" point is visible
  alongside the preserved plus side.)
- **Captures:** the masthead region (the `ArticleError` card on the left + the populated rail on the
  right), `fullPage` acceptable. Both viewports/auth.
- **Evidence for:** AC2 (article error never surfaces as empty copy), AC3 (distinct from a and b),
  AC9 (plus side preserved).

These three, side by side in the gallery, are visibly different: (a) is neutral skeletons under a warm
scan; (b) is a fully-formed empty plus side with weigh-in copy; (c) is a bordered error alert with a
populated rail. **Refresh the baseline gallery** (`docs/design/ui-screenshots/`) in the same PR — this
is a new surface/state set, so add the three `Scene`s and run `scripts/dev/shots.sh --scene
topic-loading,topic-settled-empty,topic-article-error --commit ui` (or `--all` if the skeleton change
touches shared CSS broadly).

---

## 9. Traceability to AC1–AC9

| AC | Where this spec satisfies it |
|---|---|
| **AC1** No empty copy before settle | §4 gate (the five-condition rule); §2.2 matrix rows 1–4; §3.6 |
| **AC2** Article error never → empty copy | §4 rows 8–10 + the gate being blind to `fetchState` as an enabler; §6 (ArticleError carries no suggestion copy) |
| **AC3** Three conditions visually distinct | §8 (the three catalog scenes); §3 (the (a) treatment), §6 (b copy), §2.1 (c card) |
| **AC4** Built around the projector concept | §3.1–§3.2 (the daylight scan-beam motif, daylight-gold tokens, the "lamp warming up" read) |
| **AC5** Fast = instant, no delay | §3.6 (render-time conditional only; no timer — binding instruction to Dev) |
| **AC6** Announced to AT | §5.1 (one `aria-busy` + polite `role="status"` per region; candidate live region preserved, never fires empty during load) |
| **AC7** No color-only; AA | §5.2 (text/shape carry meaning; scan decorative), §5.3 (no small text on indigo during load; error/empty on white panels) |
| **AC8** Settled states unchanged | §2.2 (three-state render untouched), §6 (no copy changed), §8 scene (b) note |
| **AC9** Plus side useful on article error | §4 rows 10–11; §8 scene (c) pairs error with a populated rail |

---

## 10. Hand-off to Development

Build, in `TopicView` + the components it renders + `app/globals.css`:

1. **The projector scan treatment** (§3): a `.projector-scan` CSS class (screen-blend warm daylight
   band, `1.8s ease-in-out` sweep, reduced-motion static-glow fallback), replacing the per-bar
   `wikiplus-shimmer` opacity pulse. Reuse the existing daylight-gold values — **introduce no new
   gold, do not fork `HeaderProjector`.**
2. **Upgrade `ArticleSkeleton`** (`components/topic/ArticleBody.tsx`) to layer the scan over its
   existing bars; **keep** its `aria-busy` + `role="status"` `Loading article…`.
3. **A plus-side skeleton** (§3.3) for the panel/TOC/General-band region, rendered while `!storeReady`,
   with `aria-busy` + an `sr-only role="status"` **`Loading videos…`** node — in the `.plus-card`
   bordered idiom, no indigo color-block, no text.
4. **The §4 gate** on the empty-suggestion line (and the empty volume block): the five-condition rule,
   blind to `fetchState` as an enabler, never triggered by an article error. The candidate polite live
   region must never announce empty during `candidatesLoading`.
5. **No artificial delay** (AC5, §3.6) — render-time conditionals only; no timer/min-duration/debounce
   gating settled content.
6. **The three catalog scenes** (§8) + refresh `docs/design/ui-screenshots/` in the same PR.

Then **QA & Review** verifies AC1–AC9 (the misleading-empty case is gone; the three conditions are
distinct; no timer; a11y + AA hold) with fresh eyes, and **UX evaluates** the running loading treatment
against this spec (does the scan read as the projector identity; are a/b/c distinct and honest; does a
warm load show no flash; reduced-motion fallback present).
