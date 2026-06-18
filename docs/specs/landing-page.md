# Spec: Landing page — prominent search + concise explanation (v1), and a design for a video-centric entry point (v2)

**Issue:** [#15](https://github.com/ragesoss/wikiplus/issues/15) · **Type:** build (the product's front door) · **Status:** spec
**Owner:** Product · **Feeds:** UX (landing flow + the v2 video-entry design spec), Development (build) · **Verified by:** QA & Review + UX
**Builds on:** [#12](https://github.com/ragesoss/wikiplus/issues/12) (`TopicSearch` reusable search component — shipped, already on the home page via `variant="home"`), [#11](https://github.com/ragesoss/wikiplus/issues/11) (`titleToSlug`/`topicHref` encoding — shipped), title-based routing + create-on-demand (#1/#13 — shipped), `lib/wiki/article.ts` `resolvePage` (title→QID resolution — shipped)
**Debuts:** the **Daylight Projector** header wordmark — `docs/VISUAL_IDENTITY.md`, variant `01`, Tier A — its **first implementation** (LOCKED design, never built)
**Relates to:** `docs/TOPIC_PAGE_DESIGN.md` (Indigo Press identity, palette, AA baseline), `lib/candidates/` (the topic→candidate pipeline the v2 video→article suggestion **inverts**)

---

## Problem

The home page (`app/page.tsx`) does not look or behave like a front door for the product. It is a
bare **"Topics"** list with a one-line blurb. #12 already placed the reusable `TopicSearch` in the
header, so a search box now exists — but the page does **not lead with it**: the search sits inside a
small utility header above an `<h1>Topics</h1>` and a card grid that dominates the page, and there is
**no concise statement of what wiki+ is or why it exists**. A first-time visitor cannot tell, in one
glance, that the product is "find a topic, read it, weigh its clips" (VISION, *MVP loop step 1 — Find a
topic*). The page is also visually generic: the **Daylight Projector** header wordmark — the locked
piece of visual storytelling about what the product *is* (a curation layer projected onto Wikipedia) —
has been designed and signed off but **never built**, so nothing on the page carries the brand's
central metaphor.

This issue rebuilds the landing page so the front door matches the product, and uses that rebuild as the
**first implementation of the Daylight Projector**. It also produces a **design spec (not code)** for a
more featureful **v2** entry point: a **video-centric** path where a curator pastes a high-quality video
and the system suggests which Wikipedia article(s) it belongs to — the inverse of the existing
topic→candidate matching.

## User value

- **A first-time visitor** understands, in one or two sentences, what wiki+ is and why it exists — and is
  pointed at the single most important action (find a topic) without scanning a list first.
- **A returning reader** reaches any Wikipedia topic by name immediately, from a search that is the visual
  and interaction focus of the page (existing topic → its curated page; uncurated/created-on-demand topic
  → its empty state, which is itself an invitation to curate — VISION *create-on-demand*; ARCHITECTURE
  *Topic discovery & search*).
- **Everyone** meets the product's identity at the front door: the projector header says "a curation layer
  projected onto Wikipedia" before a single word of explanation is read.
- **The team** gets the Daylight Projector built **once, reusably, and tier-aware**, so the future
  shared-header rollout (the Topic page adopting Tiers B/C of the same component) is a configuration change,
  not a second implementation.

## Scope

This issue is **one coherent build (v1)** plus **one written design deliverable (v2 design only)**.

### In scope — v1 build (`app/page.tsx` + a new reusable header component)

1. **Lead with search.** Rebuild `app/page.tsx` so the **existing `TopicSearch` component**
   (`components/search/TopicSearch.tsx`, `variant="home"`, shipped in #12) is the **prominent, primary
   entry** — the visual and interaction focus of the page, in a hero placement directly under the projector
   header. **Reuse `TopicSearch` exactly as-is; do not spec, fork, or build a second/divergent search.** Its
   behavior (debounced Wikipedia typeahead, APG combobox+listbox, keyboard model, silent degrade,
   `router.push(topicHref(<raw title>))` on select/submit) is already specified and verified by
   `docs/specs/navbar-topic-search.md` and is **inherited, not re-specified, here.**
2. **A concise project explanation**, sourced from `docs/VISION.md` (*What it is* / *Why it exists*): one or
   two sentences that say wiki+ is a **curation and contextualization layer over Wikipedia** that attaches
   **curated, contextualized creator video** to the topics people read about, each clip with a human-written
   note separating fact from the creator's opinion. Kept tight — get out of the user's way; the search is the
   action, the explanation is orientation. (The current prototype-disclaimer line — "curations are shared" —
   may be kept as secondary/muted text.)
3. **Demote the seeded topic list to secondary content.** Keep the existing seeded-topics list (read via
   `store.listTopics()`), but reposition and reframe it as **secondary** content below the search hero — an
   "examples" / "explore" affordance, not the page's headline. Its existing states (loading, read-error
   floor, empty, list) are preserved; only its prominence and framing change.
4. **Debut the Daylight Projector header at full Tier A**, implemented as a **new reusable, tier-aware
   component** (working name `HeaderProjector`), per `docs/VISUAL_IDENTITY.md`:
   - The landing page renders the **complete §5 Tier-A treatment** of **variant `01` "Daylight — subtle
     glow"**: the lit **"+"** aperture (white-hot core + thin gold rim + "+"-outline bleed onto the indigo
     card), the geometric **"+"-shaped beam** descending from the aperture and **flaring/burning to white**
     into the hero/search area, the **solid gold border** running **off both page edges** at the content
     boundary, and the faint **"pedia" ghost** behind the aperture (Wikipedia persists). The `wiki | +plus`
     lockup (serif "Wiki" + the indigo `.plus-card`-matching zine block) is the irreducible core (§6.1).
   - **Free-standing hero placement (landing-specific).** The landing page has **no wiki/plus column
     divider**, so VISUAL_IDENTITY **§6.0** ("align the internal seam to the column divider") is **N/A here**.
     On the landing page the projector is a **free-standing hero**: the beam projects onto the
     **search-entry / hero area** (the product's front door), not onto a two-column article body. (Seam-to-
     column alignment remains a **future** Topic-page Tier-A concern — out of scope; see *Out of scope* and
     *Forward-looking design considerations*.)
   - The component must be **tier-aware**: it exposes a `variant` prop spanning the four tiers
     (`"projector" | "lockup-lit" | "lockup-flat" | "glyph"`, i.e. VISUAL_IDENTITY **§6.2 Tiers A/B/C/D**),
     even though **only the landing page consumes Tier A this round.** Building it tier-aware now is the
     deliberate setup for the future shared-header rollout.
   - **Geometry is parameterized, not hardcoded constants** (see *Forward-looking design considerations*).
     v1's Tier-A landing render must be expressible as **one configuration** of that parameterized component
     (geometry exposed as props/tokens with sensible defaults), not as magic constants baked into the layout.
   - **Accessibility model** per VISUAL_IDENTITY §7: the mark exposes the accessible name **`wiki+`** (e.g.
     `aria-label="wiki+"` on the wordmark link/container); the decorative SVG/beam/bleed/rim and the "pedia"
     ghost are **`aria-hidden="true"`**; the real text ("Wiki" serif, white "plus") meets AA contrast
     (serif "Wiki" ~17:1; white "plus" passes AA-large at the bold/large setting); the gold is **decorative
     and never a functional signal** (§7.3); font fallbacks per §7.5.
   - Pin the new **gold tokens** (`#EECE87`, `#FFECB2`) and **surface tokens** (`--header-field #fafbfe`,
     `--content-white #ffffff`, the bleed/ghost values) in the Tailwind config / CSS variables (§4.2),
     keeping them **disciplined per the gold-as-accent rule** (CLAUDE.md / VISUAL_IDENTITY §9.1).
   - **Do not modify the Wikipedia article body** (§9.3): this is a header treatment only.

### In scope — v2 design deliverable (UX produces; documents only, no app code)

5. **A committed v2 design spec for the video-centric entry point** — `docs/design/landing-page-v2-video-entry.md`
   (UX-owned; final filename UX's call). It must cover:
   - The **paste-a-video → suggest candidate article(s)** flow: a logged-in curator pastes a high-quality
     video URL; the system suggests the Wikipedia article(s)/topic(s) it should be attached to, and offers
     to start a curation on the chosen one.
   - The **"curate a suggested topic"** entry (a way into curation that starts from a suggested topic rather
     than a search).
   - **How these coexist with search** on the landing page — search stays the primary, anonymous,
     get-out-of-the-way path; the video-centric entries are an additional, login-gated curation on-ramp, not
     a replacement.
   - The relationship to the existing pipeline: the video→article suggestion is the **inverse** of the
     existing **topic→candidate** matching in `lib/candidates/` (today: given a topic's title + section
     keywords, rank YouTube results — `matching.ts`/`pipeline.ts`; v2: given one video's metadata, rank
     candidate **articles**). The spec must state **how much it reuses** `lib/candidates/` (the
     tokenization/keyword-scoring heuristic and the pluggable-source shape) versus what is new.
6. **Record the video→article architecture decision** in `docs/ARCHITECTURE.md` (Product/Dev): a short note,
   in or adjacent to *Candidate suggestion & the empty state*, stating that the v2 video→article suggestion
   is the **inverse direction** of the existing candidate pipeline and is expected to **reuse** its
   tokenization + keyword-scoring heuristic and pluggable-source interface rather than introduce a parallel
   matcher. (Decision recorded now; **implementation deferred** to a future issue.)

## Acceptance criteria

Each item is independently verifiable by a **test** or a **screenshot of the built UI**. Per the owner's
PR-only delivery this round (a parallel agent is active; no merge/deploy), AC are verified by **tests +
screenshots / built UI**, **not** by a live URL.

- **AC1 — Search is the prominent primary entry.** On the landing page, the `TopicSearch` (`variant="home"`)
  is the visual and interaction focus: it sits in a hero directly under the projector header, **above** the
  seeded topic list, full-width, never collapsed to an icon. *(Verify: screenshot of the built page; the
  search is visually dominant and positioned above the topic list.)*
- **AC2 — Search reuses the existing component, unforked.** The landing page imports and renders the same
  `components/search/TopicSearch.tsx` from #12; **no second/divergent search component, input, or
  resolution path is introduced.** *(Verify: code review — single `TopicSearch` import; no new search
  component file; `git grep` shows no duplicate combobox/typeahead implementation.)*
- **AC3 — Search routes an existing title to its Topic page.** Selecting a suggestion or submitting a title
  that maps to an existing wiki+ topic navigates to `topicHref(<title>)` (`/topic/<Title>/`). *(Verify:
  test on `navigateTo`/route behavior — already covered by #12's tests; this AC asserts the landing page does
  not alter it. Screenshot of an existing seeded topic opening from the landing search.)*
- **AC4 — Search routes a created-on-demand title.** Submitting a valid Wikipedia title that has **no**
  existing wiki+ topic still navigates to `topicHref(<title>)`; `TopicView` resolves title→QID
  (`resolvePage`) under the hood and renders the **empty/curate** state (create-on-demand — VISION;
  ARCHITECTURE *Topic discovery & search*). The landing page adds **no** write and **no** QID to the URL.
  *(Verify: test that submit/select calls `router.push(topicHref(title))` for a non-seeded title; screenshot
  of the resulting empty-state Topic page.)*
- **AC5 — The unknown-title path is defined and non-blocking.** When the typed text matches **no** Wikipedia
  article, the search shows its **non-blocking no-results hint** ("No matching articles — press Enter to
  open "{q}"") and **Enter still navigates** to `topicHref(<typed text>)`; the resulting Topic page reaches
  its **not-found / no-article** state without the landing page erroring or hanging. The landing page relies
  on `TopicSearch`'s existing behavior here and **does not add a separate results page.** *(Verify: test —
  Enter on a no-match query still pushes the route; screenshot of the hint row + the downstream not-found
  state.)*
- **AC6 — A concise explanation is present and sourced from VISION.** The page shows a one-to-two-sentence
  explanation that wiki+ is a curation/contextualization layer over Wikipedia attaching curated,
  contextualized creator video with fact-vs-opinion context notes — faithful to `docs/VISION.md` *What it is
  / Why it exists*. *(Verify: screenshot; copy review against VISION.)*
- **AC7 — The seeded topic list is demoted to secondary content.** The seeded-topics list still renders (from
  `store.listTopics()`), but **below** the search hero and **framed as examples/explore**, not as the page's
  headline. Its loading / read-error / empty / populated states are preserved. *(Verify: screenshot showing
  the list below the hero with the secondary framing; test or screenshot of the read-error floor line still
  present.)*
- **AC8 — The Daylight Projector renders at Tier A per VISUAL_IDENTITY.** The landing header renders the full
  §5 Tier-A treatment of variant `01`: the `wiki | +plus` lockup, the lit "+" aperture, the geometric "+"
  beam burning to white into the hero, the solid gold border running off both page edges, and the faint
  "pedia" ghost. The beam burns to the hero's own white (no chrome on any article body — none exists on this
  page). *(Verify: screenshot compared against `mockups/wordmark-projector-illuminate.html?solo=01`; UX
  evaluation of fidelity — the burn-to-white seam, gold-edge-only signal, "pedia" halation.)*
- **AC9 — The projector is a reusable, tier-aware component.** A single new component (working name
  `HeaderProjector`) implements the mark and exposes a `variant` prop covering all four tiers
  (`projector` / `lockup-lit` / `lockup-flat` / `glyph` = §6.2 Tiers A/B/C/D). The landing page consumes the
  Tier-A (`projector`) variant. The component is **not** inlined into `app/page.tsx` as one-off JSX.
  *(Verify: code review — the component file exists, accepts a tier `variant` prop, and the landing page
  imports it; `typecheck` confirms the prop type covers four tiers.)*
- **AC10 — Geometry is parameterized, not magic constants.** The component's beam geometry (width/flare/slope
  and horizontal projection position) and the lockup seam position are exposed as **props/tokens with
  sensible defaults**, such that the v1 Tier-A landing render is **one configuration** of the component. No
  layout-specific geometry value is hardcoded inline at the call site in a way that would require a second
  implementation to vary it later. *(Verify: code review — geometry passed via props/typed config with
  defaults; the dynamic behavior itself is NOT implemented, only the parameterized shape — see Out of scope.)*
- **AC11 — Accessibility & contrast on the real text.** The wordmark exposes the accessible name **`wiki+`**;
  decorative layers (beam, bleed, rim, glow, the "pedia" ghost) are `aria-hidden="true"`; the real serif
  "Wiki" and white "plus" meet AA (serif "Wiki" on the header field passes AA/AAA; white "plus" on indigo
  `#676EB4` passes **AA-large** at its bold/large setting). The search hero remains fully **keyboard
  accessible** (tab to the input, type, arrow through suggestions, Enter to navigate — inherited from
  `TopicSearch`) and the gold is never the sole carrier of meaning. *(Verify: an accessible-name test/DOM
  assertion that the wordmark container is named "wiki+" and decorative layers are `aria-hidden`; a contrast
  check on the two real-text pairs; a keyboard pass through the search.)*
- **AC12 — Build, types, and tests are green.** `yarn build`, `yarn typecheck`, and `yarn test` all pass.
  *(Verify: CI / local run output.)*
- **AC13 — The two doc deliverables exist.** (a) A committed v2 design spec for the video-centric entry point
  (UX, e.g. `docs/design/landing-page-v2-video-entry.md`) covering the paste-video→article-suggestion flow,
  the curate-a-suggested-topic entry, coexistence with search, and the degree of `lib/candidates/` reuse; and
  (b) a recorded video→article architecture decision in `docs/ARCHITECTURE.md` (inverse of the candidate
  pipeline; reuse-not-reinvent; implementation deferred). *(Verify: both files/edits present in the diff.)*

## Out of scope (state explicitly)

- **Implementing** the v2 video-centric entry point — the **paste-video → article suggestion** flow and the
  **curate-a-suggested-topic** entry are **DESIGN ONLY** this round (UX produces the design spec; no app code).
- A **full search-results page**, ranking, or any non-Wikipedia search. The landing search routes straight to
  a Topic page (or its empty/not-found state); there is no intermediate results view.
- **Rewiring the Topic-page header** (`components/topic/TopicHeader.tsx`) or making the header truly shared —
  the Topic page adopting Tier B/C of `HeaderProjector` is an **explicit future session.** Building the
  reusable, tier-aware component now is the *setup* for it, but only the landing page consumes it this round.
- The **dynamic** beam/seam/column-ratio behavior itself — only the **parameterized API shape** is in scope
  (per *Forward-looking design considerations*); driving the geometry dynamically by a live column ratio is
  future work.
- **VISUAL_IDENTITY §6.0 seam-to-column alignment** on the landing page — **N/A** here (no column divider; the
  projector is a free-standing hero). Seam alignment remains a future Topic-page Tier-A concern.
- **Dark-mode projector** — deferred per VISUAL_IDENTITY §6.4 (the mark is built on a light/overexposure
  metaphor; no dark-mode treatment this round).
- **Delivery is PR-only** — this work ships as a branch + PR with screenshots, **not** a merge or deploy
  (a parallel agent is active on an unrelated branch). Acceptance is verified by tests + screenshots / built
  UI, not by a live URL.

## Success metric

- **Primary:** the landing **search is used as the way into a topic.** Once analytics exist, the target is
  that a clear majority of topic arrivals that originate on the landing page come **through the search**
  (select or submit) rather than the seeded-topic list — confirming the front door now matches the product's
  "find a topic" loop. (Analytics is deferred; this is the metric definition to wire up at launch — the
  trackable event is a `TopicSearch` select/submit originating from the landing hero.)
- **Secondary (qualitative, this round):** UX evaluation confirms the projector header renders at Tier A
  with fidelity to VISUAL_IDENTITY (burn-to-white seam, gold-edge-only signal, "pedia" halation, the a11y
  model) and that the explanation reads as "what it is / why it exists" in one glance.
- **Guardrail:** no regression to the seeded-topic list's existing states (loading / read-error floor /
  empty / populated) and no regression to `TopicSearch`'s #12-verified behavior.

## Forward-looking design considerations (parameterized geometry — NOT a v1 requirement)

This shapes the **component's API**, not v1's behavior. The owner wants `HeaderProjector` conceived so its
geometry is **parameterized, not hardcoded constants**, so likely future work can drive it dynamically.
Capture this so UX and Dev shape the API accordingly — and **do not scope the dynamic behavior into this
build.** The future variability to design *for* (but not implement):

- **Beam width / flare / slope is variable** — narrower for single-column contexts (the home page hero), wider
  on two-column Topic pages.
- **The projection's horizontal position is variable** — the beam can project onto different horizontal
  positions, not just the page center.
- **The wiki/plus seam position is driven by a variable column-ratio** — centered vs. offset depending on the
  relative widths of the Wiki and Plus columns (some users may want the two sections equally prominent;
  others may want the Plus side larger), with the projector position and beam adjusting **dynamically** to
  match.

**v1 requirement (the only one):** the Tier-A landing render is **one configuration** of a parameterized
component — geometry exposed as props/tokens with sensible defaults (AC10), so the future dynamic work is a
matter of *driving* those props, not re-implementing the mark. The dynamic column-ratio behavior itself is
**out of scope** this round.

## Assumptions / for-refinement

- **A1 — `TopicSearch` is the confirmed shared component.** Per the issue's "confirm the exact shared
  component at pickup" and the owner's locked decision, the landing search **is** `components/search/TopicSearch.tsx`
  (`variant="home"`), already on the home page from #12. This spec assumes no new search work; if a different
  component were intended, that is a re-scope. *(Confirmed by reading the current `app/page.tsx`.)*
- **A2 — Tier-A geometry numbers come from the canonical mockup.** VISUAL_IDENTITY §4.3's pixel values
  (`pageY=150`, `bh=56`, `tan=0.6`, etc.) are **strip-canvas** numbers, not the app's real header
  height/width. UX/Dev map them to the landing hero's real dimensions; the **meaning** (§2) is preserved even
  where pixels shift. The exact landing-header height and how far the beam flares before burning to white is a
  **UX/Dev layout-mapping** item — flagged, not pre-decided here.
- **A3 — Performance of the live mark.** The mark uses CSS `filter`/`mix-blend-mode` + SVG (VISUAL_IDENTITY
  §10.2 #7). If live DOM causes jank in the SSR'd header, shipping Tier A as a pre-rendered static SVG/PNG
  asset is an acceptable fallback (the mark is static, §6.5). Dev's call at build; not a blocker for the spec.
- **A4 — v2 suggest API + reuse depth is a UX/Dev design decision.** *How much* the video→article matcher
  reuses `lib/candidates/` (tokenizer + keyword scoring vs. a richer matcher; which provider metadata it
  reads) is resolved **in the v2 design spec** (AC13a) and the architecture note (AC13b), not pre-decided here.
- **A5 — `TOPIC_PAGE_DESIGN.md` split-wordmark reconciliation** (VISUAL_IDENTITY §9.2 / §10.1 #2) — updating
  the split-wordmark wording to reflect the seam-aligned lockup is a **Topic-page** concern tied to the future
  shared-header rollout; it is **not** required by this landing-only build and is **not** in scope here.

## Hand-off

- **UX:** produce the landing-page flow/design spec for the v1 build (hero composition, the explanation copy,
  the projector at Tier A in the free-standing hero, the demoted topic list, responsive behavior of the hero)
  **and** the separate **v2 video-entry design spec** (AC13a). Both are inputs to Dev, written before
  implementation. Then evaluate the built header against VISUAL_IDENTITY.
- **Development:** build the rebuilt `app/page.tsx` (search-led hero + concise explanation + demoted topic
  list) and the new **tier-aware, parameterized `HeaderProjector`** component (Tier A consumed; A/B/C/D
  variants + geometry props defined), pin the gold/surface tokens, wire the a11y model, add tests for
  search-to-route (existing + created-on-demand + unknown-title) and the accessible-name/`aria-hidden` model.
  Record the video→article decision in `docs/ARCHITECTURE.md` (AC13b). **Do not** touch
  `components/topic/TopicHeader.tsx` or the article body. PR-only — no merge/deploy.
- **QA & Review:** verify AC1–AC13 (tests + screenshots), code quality, and a security pass (the new component
  renders inline SVG / no new external fetch; the search path is unchanged from #12).
