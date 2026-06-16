# Spec: Article fidelity — citations, tables & infobox, math, navigational tail

- **Status:** Draft for build-loop (Product). Bundles four sibling issues into ONE build-loop run.
- **Bundled issues:** #24 (citations & references), #25 (tables & infobox), #26 (math),
  #27 (navigational tail & hatnotes). The owner (Sage) has decided to build them together: they are
  explicitly siblings of one comprehensive article-fidelity push, all touch the **same code
  surfaces** (`lib/wiki/article.ts` — `DROP_SECTIONS`, `stripChrome`, the DOMPurify
  `ALLOWED_TAGS`/`ALLOWED_ATTR` allowlist, `rewriteLinks`, `externalize` — and `app/globals.css`
  `.wiki-body`), and so are cheaper and safer to ship and verify as a single change than as four
  conflicting branches.
- **Inputs:** `docs/VISION.md`, `docs/ARCHITECTURE.md` ("Article rendering (client-side)" + the
  **DOMPurify allowlist** open-question recording the v1 "references/tables/math/tail deferred"
  decision this spec flips), `docs/TOPIC_PAGE_DESIGN.md` ("The two worlds", the +plus infobox),
  `CLAUDE.md`. Current behavior to change: `lib/wiki/article.ts`, `app/globals.css`.
- **Hand-off:** UX (one design spec covering all four areas: citation interaction, infobox placement
  + naming disambiguation, math styling, tail/hatnote styling and TOC treatment), then Development.

---

## Problem & user value

A wiki+ Topic page commits to "the two worlds": the left column **is** the real Wikipedia article,
read undisturbed as the encyclopedia (`docs/TOPIC_PAGE_DESIGN.md`). Today it is not — the v1 article
pipeline (`lib/wiki/article.ts`, the deferral recorded in `docs/ARCHITECTURE.md`'s DOMPurify
open-question) deliberately strips four things a Wikipedia reader takes for granted:

- **Citations** — every inline `[n]` marker is dropped, footnote anchors are de-linked to plain text,
  and the References section is removed. There is **no way to see what any statement is sourced to.**
- **Tables & the article infobox** — data tables pass sanitize but are `display:none` in CSS
  (`.wiki-body table { display:none }`); the Wikipedia infobox is stripped outright (`table.infobox`).
- **Math** — formula markup is not in the allowlist, so equations on science articles drop or garble.
- **The navigational tail & hatnotes** — See also, Further reading, External links, and top
  disambiguation hatnotes are all dropped as "chrome" (`DROP_SECTIONS`, `.hatnote`).

The user value is **verifiability and fidelity**, which is the core of Wikipedia's value and of our
**CC BY-SA framing**: a reader weighing a curated clip against the encyclopedia must be able to see
the citation behind a claim, read the data table or infobox the prose refers to, see the equation a
science topic is built on, and follow the article's See-also links — *as a Wikipedia reader would.*
Restoring citations and the navigational tail directly strengthens our attribution story (we surface
the sources Wikipedia credits, and the See-also graph feeds wiki+'s own topic graph). None of this
conflicts with the licensing posture: we are displaying, never editing, Wikipedia content.

This is the highest-leverage fidelity gap remaining after Topic Page v1. Of the four, **citations is
the highest single value** (verifiability), but because all four edit the same allowlist and strip
logic, they ship as one coherent "make the article real" change.

---

## Scope — one feature, four areas

This is the **client-side static-export SPA prototype**. The article body is fetched from the
MediaWiki REST `page/html` endpoint (Parsoid HTML), sanitized with DOMPurify, link-rewritten, and
rendered in the browser (`lib/wiki/article.ts`); all data access goes through the `lib/data/` seam.
**Nothing here is server-side** — there is no server-side rendering of references, no ISR/Redis. The
change is: widen the DOMPurify allowlist safely, stop stripping the four content categories, render +
style them faithfully, route their links correctly, and keep genuine chrome stripped.

In scope, framed as one feature:

- **Area A — Citations & references (#24):** inline `[n]` markers, footnote interaction
  (popover and/or references list), the References/Notes-as-citations section, citation link routing.
- **Area B — Tables & infobox (#25):** data tables (un-hidden, styled, responsive) and the Wikipedia
  infobox (rendered in the left article column), with Commons image credit + license, link routing,
  and a precise strip list so genuine navboxes/metadata are still removed. Resolve the +plus-infobox
  **naming collision** in docs.
- **Area C — Math (#26):** inline and display equations rendered legibly on the seeded science topics,
  with the chosen render approach recorded as a decision.
- **Area D — Navigational tail & hatnotes (#27):** See also / Further reading / External links sections
  and top hatnotes, restored from `DROP_SECTIONS`/`stripChrome`, with correct link routing and
  consistent TOC/scroll-sync treatment.

**Cross-cutting:** all four widen the same DOMPurify allowlist; the sanitizer must still block XSS
after widening. None may regress the existing TOC, scroll-sync, or clip→section matching.

---

## Acceptance criteria

Testable, numbered, organized into the four issue-mapped groups plus a cross-cutting group so QA can
map each issue. "Markers/anchors/links" criteria are verified against the **seeded science topics**
(`Photosynthesis`, `Cellular_respiration`) where they are content-dependent, since those are the
articles the build session must inspect (see *Open questions*) and the e2e fixtures cover.

### Group A — Citations & references (#24)

- **A1.** Inline `[n]` citation markers appear in the article prose where Wikipedia shows them
  (the `sup.reference` markers are no longer stripped by `stripChrome`).
- **A2.** Activating a citation marker reveals the full citation text for that marker (per the UX
  decision — popover, jump to the reference, or both; Product recommends **both**, see *Open
  questions*).
- **A3.** A **References section** renders at the foot of the article (numbered list, in the order
  Wikipedia presents) and is **no longer dropped** from the body by `DROP_SECTIONS`/`stripChrome`.
- **A4.** Each reference's back-link returns the reader to the corresponding inline marker (the
  footnote ↔ backref anchors are **functional**, not de-linked to plain text).
- **A5.** External source links inside citations (publisher URL / DOI / ISBN / archive links) open in
  a **new tab** via the existing `externalize` path (`target="_blank" rel="noopener"`).
- **A6.** `/wiki/` (article-namespace) links **inside** citations route to the internal `/topic/`
  route via the existing `rewriteLinks` path (same routing as body wikilinks; not de-linked).
- **A7.** Citation markers and the citation reveal (popover and/or list) are **keyboard-operable**
  (focusable, activatable by keyboard, focus managed), meet **AA contrast**, and carry a **text label**
  — the citation signal is never conveyed by color alone (CLAUDE.md accessibility baseline).

### Group B — Tables & infobox (#25)

- **B1.** Wikipedia **data tables render** (no longer `display:none`) and are styled faithfully
  (header shading, borders, captions readable).
- **B2.** Wide tables remain **readable on the narrow article column and on mobile** — they do not
  overflow the layout or break the two-column shell; the chosen treatment (horizontal scroll within a
  contained wrapper) keeps the rest of the article intact.
- **B3.** The **Wikipedia infobox** renders **in the left article column**, float-right as on
  Wikipedia (no longer stripped by `stripChrome`'s `table.infobox`).
- **B4.** The Wikipedia infobox does **not collide with the right-rail +plus infobox**
  (`components/topic/Infobox.tsx`) — both render, visibly distinct, with no overlap at the supported
  breakpoints.
- **B5.** Commons images shown in tables/infobox carry their **credit + license (CC BY-SA / per-file)**
  and link to the file page (consistent with the existing `cleanFigures` Commons-credit handling and
  ARCHITECTURE "Licensing & attribution").
- **B6.** Internal `/wiki/` links inside tables and the infobox route to the `/topic/` route via
  `rewriteLinks`; external links open out in a new tab.
- **B7.** Genuine **navboxes and metadata are still stripped** (`.navbox`, `.metadata`, `.mbox-text`,
  `.ambox`, `table.sidebar`, `table.vertical-navbox`) — the strip list stays precise so data tables
  and the article infobox are not caught, and so chrome tables are not shown.
- **B8.** Docs resolve the **+plus-infobox naming collision**: `docs/TOPIC_PAGE_DESIGN.md` (and any
  component naming the design spec drives) clearly distinguish the **Wikipedia infobox** (left column,
  encyclopedia chrome) from the **+plus infobox** (right rail, the wiki+ counts/sync element).

### Group C — Math (#26)

- **C1.** **Inline equations** render legibly within the prose line on the seeded science topics
  (`Photosynthesis`, `Cellular_respiration`).
- **C2.** **Display (block) equations** render legibly as their own block on those topics.
- **C3.** The DOMPurify sanitizer still **drops scripts and unsafe markup** after the math allowlist
  is widened (no `<script>`, event-handler attrs, or unsafe URIs survive — verified by a sanitize test
  that feeds hostile markup alongside math markup).
- **C4.** The chosen math **render approach** (Parsoid MathML, Parsoid's SVG/PNG fallback image, or a
  client lib such as KaTeX) is **recorded as a decision** in the spec/docs and in a code comment at the
  allowlist, with the reasoning (Product recommends preferring Parsoid MathML with image fallback —
  see *Open questions* — but Dev verifies live Parsoid output before choosing).

### Group D — Navigational tail & hatnotes (#27)

- **D1.** The chosen tail sections — **See also**, **Further reading**, **External links** (and genuine
  explanatory **Notes** that are not footnotes) — render at the foot of the article (removed from
  `DROP_SECTIONS`).
- **D2.** Top **hatnotes** (disambiguation / "see also" notes above the lead) render at the article top
  (no longer stripped by `stripChrome`'s `.hatnote`), styled distinctly from prose.
- **D3.** **See-also** links (and internal links in hatnotes / Further reading) open as internal
  `/topic/` routes via `rewriteLinks`.
- **D4.** **External links** (and external Further-reading entries) open **out in a new tab** via
  `externalize`.
- **D5.** Restored tail sections appear in the **TOC and scroll-sync as video-less entries** (a
  zero-video badge, consistent with the existing TOC treatment of empty sections) — they are not
  special-cased out of the section walk.
- **D6.** **Scroll-sync and clip→section matching still behave** with the restored sections present
  (an active tail section highlights correctly; no clip is mis-anchored to a tail section).
- **D7.** Navbox/metadata stripping remains intact (shared with B7); a "Notes" block that is actually
  footnotes is treated as citations (Group A), not duplicated as a tail section.

### Cross-cutting (all four)

- **X1.** `yarn test`, `yarn build`, and `yarn typecheck` are all green.
- **X2.** Unit tests cover the new transform behavior: marker/reflist retention and anchor routing (A);
  table un-hide + infobox retention + precise strip list (B); math markup survives sanitize while
  hostile markup is dropped (C); tail-section retention + link routing + TOC video-less entries (D).
- **X3.** **No regression** to the existing TOC, scroll-sync, clip→section matching, or the seeded
  curated/empty Topic states (the `lib/wiki/article.ts` and `TopicView` tests still pass).
- **X4.** After the allowlist is widened for citations, tables, infobox, and math, **DOMPurify still
  blocks XSS** — a test asserts that script tags, inline event handlers, and `javascript:` URIs are
  stripped from the widened input.
- **X5.** `docs/ARCHITECTURE.md`'s **DOMPurify allowlist** open-question is updated to record that the
  v1 "references/tables/math/tail deferred" decision is now **flipped** (with the widened allowlist and
  the kept-strip list described), so the doc remains the source of truth.

---

## Out of scope

- **Editing or adding citations / content.** We display Wikipedia's citations and tail as-is; editing
  happens on Wikipedia (VISION non-goal: editing Wikipedia text).
- **Server-side rendering of references** (or any article HTML) — the article body stays client-side
  rendered per ARCHITECTURE; there is no origin-side reference rendering.
- **Any production read-path infrastructure** — ISR, Redis, Server Actions, Postgres. This is the
  client-side static-export prototype over the `lib/data/` seam.
- **Reflowing the two-column layout** beyond what tables/infobox responsiveness requires; **redesigning
  the +plus infobox** (only the *naming* disambiguation is in scope, B8).
- **Image lightboxes / Commons galleries** beyond rendering the infobox/table images with credit.
- **Multilingual / non-English article fidelity** (scale-deferred per the MVP sequencing).

---

## Open questions / decisions to delegate

Product makes the recommendation; UX and Development own the final call within their lanes and record
it (UX in the design spec / `docs/TOPIC_PAGE_DESIGN.md`; Dev in code comments + the ARCHITECTURE note).

1. **Citation interaction (UX).** Popover-on-activation, a References list at the foot, or **both**?
   **Product recommendation: both** — a popover for in-context reading (matches the modern Wikipedia
   reader-preview behavior) *and* a full References section at the foot for completeness and back-links
   (A3/A4). UX confirms the marker styling, focus/keyboard behavior, and how the popover coexists with
   scroll-sync (the popover must not fight the active-section highlight).
2. **Math render approach (Dev).** MathML vs. Parsoid fallback image vs. KaTeX. **Product
   recommendation: prefer Parsoid MathML with the SVG/PNG fallback image** (best accessibility story,
   no extra client dependency, and it is what the REST HTML already carries) — **but Dev must inspect
   live Parsoid output for the seeded science topics before choosing**, since the exact emitted markup
   (`<math>`/MathML vs. `<img class="mwe-math-fallback-image-*">`) determines what is allowlisted and
   whether a fallback or KaTeX is actually needed. Confirm browser MathML support / fallback.
3. **Infobox responsive behavior (UX + Dev).** How the float-right Wikipedia infobox and wide data
   tables behave on the narrow article column and on mobile (stack full-width? scroll within a
   wrapper?) without colliding with the +plus rail (B2/B4). UX sets the intent; Dev implements.
4. **Build-session prerequisite (Dev).** Before coding, the build session **must inspect the live
   Parsoid `page/html` output** for `Photosynthesis` and `Cellular_respiration` to get the exact
   structure of `sup.reference` markers and the reference `<ol>` (A), table/infobox class markup (B),
   math markup (C), and the tail-section/hatnote markup (D). The current strip/drop logic was written
   against that structure; widening it correctly requires re-reading it.

**Recorded product assumptions** (made to keep the spec buildable; not escalated to the owner):

- A "Notes" section is **footnotes-as-citations by default** (Group A) unless it is plainly
  explanatory notes, in which case it is a tail section (Group D). The build session disambiguates per
  article from the live markup; the seeded topics are the reference cases (D7).
- "References", "Notes" (when citations), and the inline-marker reveal are treated as **one citation
  system** (Group A), so #24 owns footnote routing even though `DROP_SECTIONS` lists both.
- The Wikipedia infobox keeps Wikipedia's visual language (it lives on the Wiki side, which is
  faithful to Wikipedia per "the two worlds"); it is **not** restyled into Indigo Press.

---

## Success metric

**Primary (fidelity coverage):** on the seeded science topics, the four restored categories render
correctly — measured as **all Group A–D acceptance criteria passing** in QA, with **zero regression**
to the existing TOC/scroll-sync/clip-matching tests (X3). Concretely: a reader on `Photosynthesis` can
(a) open a citation and reach its source, (b) read the article's data tables and infobox, (c) see its
equations, and (d) follow its See-also links into the topic graph — none of which is possible today.

**Secondary (verifiability, post-launch):** once analytics exists, the share of Topic-page sessions
that **interact with a citation** (open a popover or follow a source/See-also link) — the signal that
fidelity is being used to *weigh* content, which is the VISION "what good looks like" bar (a reader
understands how to weigh each clip). Defined here, deferred to measure until there is traffic.

**Guardrail:** the article read path stays cheap and the page stays safe — no XSS regression (X4), and
no measurable layout breakage of the two-column shell from tables/infobox (B2/B4).
