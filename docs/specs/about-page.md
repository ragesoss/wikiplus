# Spec — About page (centerpiece + "How it works")

**Type:** build · **Milestone:** Functional prototype
**Status:** Product spec (Phase 1) — feeds UX (flows/layout) and Development (implementation).
**Design input (the heart of this build):** `docs/design/about-centerpiece-handoff/README.md`
and the `.dc.html` visual references beside it (`Centerpiece.dc.html` is the assembled hero).

> The deliverable replaces the **content** of the existing `/about` page (today a "coming soon"
> stub) with the real About page: the centerpiece illustration that explains the wiki+ thesis in
> one image, plus a "How it works" explainer below it. Copy is **placeholder lorem ipsum** this
> round — the owner supplies real copy after the design is implemented (see Assumptions). The
> centerpiece's Topic-page miniature gets one piece of **real, required behavior**: its article
> title is a live entry point — type any Wikipedia title, press Enter, land on that Topic page.

---

## Problem

A first-time visitor cannot tell, from any single wiki+ surface, *what wiki+ actually is*. The
one-line pitch — "a curation and contextualization layer over Wikipedia: curated short video,
each with a human context note, composed on top of the encyclopedia article" — is abstract until
you see it. The homepage hero's primary CTA already points at `/about` ("How it works"), but
`/about` is a placeholder shell (`app/about/page.tsx` — a heading and "Coming soon"). So the one
destination dedicated to explaining the product explains nothing.

The owner has commissioned a high-fidelity design answer: a **hero centerpiece** that makes the
thesis legible in a single image — a warm **projector** throws a beam onto a Wikipedia **Topic
page**, and the indigo **＋plus layer** (curated-video cards arranged as a literal "+") *reads as
the projected light*. The encyclopedia is the calm ground; wiki+ is the light added on top. That
illustration, recreated as real React/Tailwind from the committed handoff and paired with a
plain-language "How it works" explainer, is this build.

## User value

- A **self-directed learner / first-time visitor** understands wiki+ at a glance: the projector→page
  metaphor shows that we add a curated, contextualized video layer *on top of* Wikipedia (not a fork,
  not a video host). This serves the VISION's primary persona — the reader who will never contribute —
  before any ask to curate.
- The visitor gets an **honest, secondary** sense of the model from the "How it works" steps, without
  the page becoming a recruitment pitch (per VISION "what good looks like").
- The centerpiece doubles as a **live entry point**: the article title in the miniature Topic page is
  editable and prepopulated; type any Wikipedia article title and press Enter to land on that Topic
  page. The About page is not a dead end — it routes the curious straight into the product.

## Scope

### In scope

1. **Replace the `/about` page content** (`app/about/page.tsx`) with the real About page: the
   centerpiece hero + a "How it works" explainer section below it. The route stays `/about`.
2. **Recreate the centerpiece illustration** in real React/Tailwind/SVG from the committed handoff
   (`Centerpiece.dc.html`), high-fidelity per the handoff's *Fidelity* section: the dark-theater
   scene, the angled "on" projector (lower-left, lamp blazing), the three nested warm beam cones, and
   the brightly/evenly-lit Topic-page miniature on the right with its warm outer glow. The projector +
   beams are **inline SVG**; the Topic-page miniature is **HTML/CSS** (a normal component tree).
3. **The Topic-page miniature** reproduces the handoff's *Topic Page* element: the serif article title
   over a hairline rule, abstracted placeholder body lines, the indigo plus cards (overview + TOC) and
   the indigo video clips with white play triangles and curation bars, composed so the gutter crossing
   the general strip reads as the "+". The abstracted contents (placeholder lines, solid play-button
   blocks) **are** the design, not TODOs.
4. **The live title-input interaction** (see Acceptance criteria 8–12): the miniature's article title is
   a text input, prepopulated, styled to look exactly like the static serif title (no form-control
   affordance), that navigates to the corresponding Topic page on Enter via the app's existing
   `topicHref` / `router.push` navigation primitive.
5. **A "How it works" explainer section** below the centerpiece: a heading and a small number (3–4) of
   numbered steps, built as a clean structure that real copy drops into (placeholder lorem ipsum copy
   this round). The handoff also places a "How it works" zine hardbox card inside the centerpiece's
   dark space — whether the explainer lives only inside the centerpiece, only below it, or both is a
   UX layout decision; the **requirement** is that the page contains a "How it works" explainer with a
   clean copy-injection structure.
6. **Universal chrome:** the page uses `SiteHeader host="page"` (the projector header) at the top and
   `SiteFooter` at the bottom — no bespoke header (CLAUDE.md: every view uses the projector header).
7. **Responsive** behavior across mobile / tablet / desktop (AC13–AC14).
8. **Accessibility** baseline (AC15–AC17): the decorative illustration is correctly hidden from assistive
   tech; the title input is a properly-labeled, keyboard-operable control; AA contrast; text-labeled
   signals.
9. **Tokens:** any color/value from the handoff that is not already a codebase token is **added to the
   token system** (`@theme` in `app/globals.css`), not hard-coded inline (AC18).
10. **Build for a future plus-layer toggle/animation** (structure only — see Out of scope): compose the
    centerpiece so the ＋plus layer (the indigo cards + clips) can be hidden/revealed/animated separately
    from the article ground later, without a rewrite. Do **not** build the animation now.
11. **Refresh the UI screenshot baseline** for the new/changed About surface (per CLAUDE.md — a new
    surface is added to `e2e/screenshots/catalog.ts` and captured).

### Out of scope (state explicitly)

- **The animated centerpiece.** The handoff describes a planned animation (projector flickers on →
  dim article-only page → beam hits and the ＋plus layer fades/scales in). The deliverable is the
  **static final state**. Build so the plus layer *can* be toggled/animated later (in-scope item 10),
  but ship no animation. Any future motion is gated behind `prefers-reduced-motion`. (Future follow-up.)
- **Final / real copy.** Headings, the "How it works" step text, and body copy ship as placeholder
  lorem ipsum; the owner supplies real copy in a later pass. Acceptance criteria here target structure,
  layout, illustration, interaction, responsiveness, accessibility, and tokens — **never** the literal
  marketing wording. (Follow-up.)
- **`/about/data`.** The separate data-notice subpage (`app/about/data/page.tsx`, issue #66) must keep
  working unchanged. This build does not touch its content, route, or behavior.
- **Topic-page production behavior.** The miniature is an *illustration on the About page* that reuses
  the `topicHref` navigation primitive; it is not the real Topic page and does not change any Topic-page
  production behavior, data, or the real `TopicView`.
- **New search/typeahead machinery.** The title input is a single-field "edit + Enter → navigate"
  control. It does **not** need the navbar `TopicSearch` combobox/typeahead/listbox (no suggestions,
  no debounce). The header's own `TopicSearch` already provides full search on this page via
  `SiteHeader`. (If UX judges that reusing `TopicSearch` is the cleanest implementation, that's a Dev/UX
  call — but it is not required, and the title must still *look like the serif title*, not a search box.)

## Acceptance criteria

Each is independently testable. None depends on final/real copy.

**Route, chrome, structure**

1. Visiting `/about` renders the new About page (the centerpiece + a "How it works" explainer), not the
   old "Coming soon" stub. The route remains `/about` and returns 200.
2. The page renders `SiteHeader` with `host="page"` as its top chrome (the universal projector header)
   and `SiteFooter` at the bottom. No bespoke/forked header markup is introduced.
3. `/about/data` still renders its own page (the data notice) unchanged — its route, content, and the
   header/footer it already uses are unaffected by this change.
4. The page sets a sensible `<title>`/metadata (a non-empty document title for the About page); the
   exact words are placeholder and may change with real copy (so AC asserts presence, not wording).

**Centerpiece fidelity vs. the handoff**

5. At desktop (`≥ lg`) the centerpiece shows, against a dark-theater background, an **angled "on"
   projector at lower-left** with a lit (blown-out / warm) aperture and warm light bleed, and a
   **Topic-page miniature on the right**, with the projector→page left-to-right relationship from the
   handoff's *Composition* element.
6. The projector and its beams are rendered as **inline SVG** (not raster images / no external image
   assets); the Topic-page miniature is rendered as an HTML/CSS component tree (divs), per the handoff.
7. Three **nested warm beam cones** originate at the projector aperture and fall toward the Topic-page
   miniature (outer/middle/center, layered faint→bright), reading as a soft plus over the dark room;
   the page miniature itself reads as evenly/brightly lit with a warm outer glow (the beams do not paint
   a light gradient onto the page). The colors, proportions, and layering match the handoff's stated
   values (high-fidelity; verified by UX against `Centerpiece.dc.html`).
8. The Topic-page miniature contains the handoff's *Topic Page* elements: a serif article title over a
   hairline rule; abstracted placeholder body lines; the two indigo plus cards (overview + TOC); the
   indigo video clips with centered white play triangles and a curation bar (teal / red / blue) on each;
   composed so the vertical gutter crossing the horizontal general strip reads as a "+". The abstracted
   contents are present as designed (this is fidelity, not literal-content matching).

**The title-input → navigate interaction (real, required behavior)**

9. The article **title** in the Topic-page miniature is a real, editable **text input**, **prepopulated**
   with the placeholder article title shown in the handoff (e.g. "Acer palmatum").
10. The title input is **styled to look like the static serif title, not a form control**: in its
    resting state it shows no visible box / border / background / caret-affordance that distinguishes it
    from the surrounding serif title text (a focus indicator on keyboard focus is allowed and expected
    for accessibility — AC16).
11. Pressing **Enter** in the title input navigates the browser to the canonical Topic URL for the
    field's current value, using the app's existing primitive: `router.push(topicHref(<value>))` →
    `/topic/<Title>/`. This holds **both** when the value is unchanged (Enter on the prepopulated title
    navigates to that title's Topic page) **and** when the user has edited the value to a different
    title (Enter navigates to the edited title's Topic page). The title is passed **raw** to `topicHref`
    (no hand-encoding; `titleToSlug` does the encoding).
12. **Empty / whitespace-only** input is handled gracefully: pressing Enter with an empty or
    whitespace-only value is a **no-op** (no navigation, no error) — matching the existing search
    primitive's `value.trim()` guard.

**Responsive**

13. At desktop (`≥ lg`) the projector→page left-to-right relationship is preserved (AC5). The page body
    never scrolls horizontally at any supported width.
14. Below `lg` (tablet and mobile) the centerpiece **degrades gracefully** and remains usable and
    on-brand: it either stacks (projector above, page below) or shows the Topic-page miniature alone, per
    the handoff's *Responsive notes* (the exact mechanism is a UX decision). The title-input interaction
    (AC9–AC12) and the "How it works" explainer remain present and functional at every supported width
    (mobile, tablet, desktop). Verified at representative phone / tablet / desktop widths.

**Accessibility (baseline)**

15. The decorative centerpiece illustration (projector, beams, the abstracted page graphics) is correctly
    handled for assistive tech: it conveys no information that exists only as the picture — it is exposed
    as decorative (e.g. `aria-hidden` on the purely-decorative SVG/graphics) and/or given an appropriate
    text alternative, so a screen-reader user is not read meaningless placeholder graphics. The **title
    input** is exempt: it is a real, named control (AC16), not decoration.
16. The title input has an accessible name (a programmatic label, not relying on the visible placeholder
    title alone), is reachable and operable by keyboard, and shows a **visible focus indicator** when
    focused (the resting "looks like text, not an input" treatment of AC10 must not remove the focus
    state).
17. Text and meaningful UI meet **AA contrast**, and any state/signal in the explainer or page is conveyed
    by more than color alone (text-labeled, never color-only) — including against the dark-theater
    background where the explainer card sits.

**Tokens & placeholder-copy structure**

18. Every color/numeric value introduced for the centerpiece that is not already a token in
    `app/globals.css` (`@theme`) is **added as a token** and referenced via that token (Tailwind utility
    or CSS var), not hard-coded as an inline literal in component markup. (The existing Indigo Press
    tokens — `--color-brand`, `--color-sprout`, `--color-action`, `--color-ink`, etc. — are reused where
    they apply; gold stays an accent only, never a block fill or a signal color.)
19. The "How it works" explainer is a clean, **copy-injection-ready structure**: a heading plus a small
    number (3–4) of numbered steps, each step a heading/eyebrow + body slot, with the placeholder lorem
    ipsum text isolated so real copy can be dropped in by editing text values only — no structural change
    required. (Verified by inspecting the component: the copy is not entangled with layout/illustration
    logic.)

## Success metric

Because Analytics is deferred (no instrumentation ships here), success is defined as **observable
conditions** the owner / QA / UX can confirm, plus the metric to instrument when Analytics exists:

- **Primary (qualitative, confirmable now):** a first-time visitor who lands on `/about` can, from the
  centerpiece alone, correctly state the thesis — *wiki+ adds a curated, contextualized video layer on
  top of a Wikipedia article* (the projector→page→＋plus reading). Confirmed by UX evaluation against the
  handoff and an informal read by the owner.
- **Functional:** the About page replaces the stub, passes all acceptance criteria, and the title-input
  entry point successfully routes to a real Topic page for a typed Wikipedia title (manually verified
  end-to-end against the live `/topic/<Title>/` route).
- **Deferred-instrumentation metric (define now, measure later):** once Analytics exists, the headline
  metric is the **About → Topic conversion rate** — the share of About-page sessions that navigate onward
  into a Topic page (via the title-input entry point or the header search) — i.e. how often the About page
  turns a curious visitor into a reader of an actual topic. A secondary signal is About-page bounce /
  dwell. (No tracking is added in this build; this defines what to instrument when it splits out.)

## Assumptions / follow-ups

These are product assumptions made to keep this build unblocked; the **owner should confirm the starred
ones**.

- ★ **Real copy is pending (owner-supplied).** The page ships with lorem ipsum placeholder copy for the
  headings, "How it works" steps, and body. A follow-up build replaces it with real copy. Acceptance
  criteria deliberately do **not** assert the literal wording. *Owner confirm: copy comes after the
  design is implemented, as a separate pass.*
- ★ **The placeholder article title** in the miniature follows the handoff ("Acer palmatum"). It is a
  live entry point, so any reasonable Wikipedia title works on Enter; the specific prepopulated value is
  cosmetic and may be swapped with real copy. *Owner confirm the default title is fine (or supply a
  preferred default).*
- **The animated centerpiece is deferred** to a future follow-up issue; this build ships the static final
  state and structures the plus layer so it can be toggled/animated later (gated behind
  `prefers-reduced-motion` when built).
- **Explainer placement** (inside the centerpiece's dark space as the handoff's zine card, below the
  centerpiece as a separate section, or both) is left to UX as a layout decision; the product requirement
  is only that a copy-ready "How it works" explainer is present.
- **The title input does not reuse the navbar `TopicSearch` typeahead.** It is a plain edit-and-Enter
  field reusing only the `topicHref`/`router.push` navigation primitive; full search remains available via
  the header's own `TopicSearch` (which `SiteHeader host="page"` provides). UX/Dev may reuse `TopicSearch`
  internally if cleaner, but the field must read as the serif title, not a search box, and the typeahead
  is not a requirement.
- **No new fonts required.** The handoff calls for Source Sans 3 / Open Sans (UI/body) and Georgia (the
  article-side serif); the app already wires these (`.plus-disp`, `.projector-serif`, body Open Sans). Reuse
  the existing font setup rather than adding loaders.
- **A future roadmap doc** (`docs/ROADMAP.md`) does not yet exist; sequencing for this build is recorded
  here. The deferred-Analytics metric above is the Product-owned metric definition that moves to Analytics
  when that role splits out.

## Hand-off

- **UX (next):** turn this spec into the About-page layout + flow design spec at `docs/design/about-page.md` —
  the page composition (centerpiece + explainer placement), the responsive behavior `< lg` (stack vs.
  Topic-page-only) and exact breakpoints, the title-input resting/focus treatment (looks-like-title yet
  meets AC16), the a11y handling of the decorative illustration, and the explainer's copy-slot structure.
  Work pixel-closely from `docs/design/about-centerpiece-handoff/` (the `.dc.html` references are the
  visual spec).
- **Development (after UX):** implement the About page from the UX design spec — an inline-SVG projector +
  beams component, the HTML/CSS Topic-page miniature with the editable serif title wired to
  `topicHref`/`router.push`, the explainer, new tokens in `@theme`, `SiteHeader host="page"` + `SiteFooter`,
  responsive + a11y per the criteria, and a refreshed UI screenshot baseline (catalog scene).
