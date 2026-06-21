# Spec — Recover a layout-only inline-`style` subset (montage tiling + per-cell colors / taxon band)

- **Status:** Ready for the discovery spike, then UX + Dev. **Owner:** Product. **Area:** Article
  rendering (the "Wiki" left column, `.wiki-body`). **Lane:** **Heavy** — this re-opens the inline-`style`
  XSS boundary, the project's heaviest security surface. **QA's security review is the release gate.**
- **GitHub issue:** #106 (`type: build`, `status: ready`). **Resolves #91** (montage `.tmulti` tiling) and
  **#93** (per-cell colored table backgrounds). **Depends on #105** (MERGED).
- **Builds on #105:** #105 keeps the page's `<style>`/TemplateStyles *blocks* (sanitized + scoped under
  `.wiki-body`) but leaves inline `style` attributes fully stripped. This issue recovers a tightly-bounded,
  **layout-only** subset of inline `style`, reusing #105's `css-tree` **value sanitizer**
  (`lib/wiki/cssScope.ts` — escape-decode + the `url()`/`image-set()`/`expression()`/`-moz-element()` and
  `behavior`/`position`/`@`-construct strips) so the same four X4 threat properties are re-proven for inline
  `style` *values*. It does **not** touch the block path (#105 owns that) or the strip list.
- **Inputs read:** `gh issue view 106` (the groomed body — problem, allowlist, in/out scope, "Done when");
  `docs/specs/templatestyles-reuse.md` + `docs/design/templatestyles-reuse-spike.md` (#105 — the value
  sanitizer this reuses and its X4 re-argument); `lib/wiki/article.ts` (the DOMPurify config — `style` is
  **not** in `ALLOWED_ATTR`, and `width`/`height` are listed but URI-validated away by DOMPurify 3.x once a
  custom `ALLOWED_URI_REGEXP` is set, like `colspan`/`rowspan`/`scope` before the inert-attr hook);
  `lib/wiki/cssScope.ts` (the css-tree value-sanitization machinery to reuse); `docs/ARCHITECTURE.md`
  "DOMPurify allowlist" entry (the X4 guarantee; the #74 taxon-color limit; the #105 TemplateStyles-reuse
  mechanism); the existing inline-`style` X4 assertions in `test/article-fidelity-xss.test.ts`,
  `test/article-fidelity-hook-xss.test.ts`, and `test/article-fidelity.test.ts` (which assert `style` is
  *fully* dropped — those must be **revised**, see §8).

---

## 1. Problem

Inline `style` is **fully stripped** today (`style` is absent from the DOMPurify `ALLOWED_ATTR`; the X4
tests assert every inline `style` attribute dies). That is correct for the general case — inline `style` is
attacker-controllable CSS in fetched article HTML — but it discards per-element layout/color that **no
stylesheet carries**, because Wikipedia emits it inline:

- **Montage tiling (#91), the headline.** #105 restored the `.tmulti .trow{display:flex}` TemplateStyles
  scaffold, but `.tmulti` montages (`Template:Multiple image`) still render as a **stacked single full-width
  column** — verified live after #105. Each image's scaled display size is inline `style`
  (`<div class="tsingle" style="width:183px;max-width:183px">`) plus a per-image crop
  (`<div style="height:110px;overflow:hidden">`). Those are stripped, so the flex row from #105 has nothing
  to size against and collapses to a stack. The block-path stylesheet **cannot** supply these values: they
  are per-instance, computed by the template per image, and ship only inline.
- **Per-cell colored table backgrounds (#93).** Wikipedia colors individual table cells with inline
  `style="background-color:…"` (legend swatches, status/category shading). Stripped → the colors vanish and
  the cell's meaning is lost.
- **Taxobox taxon-band color (#74's documented partial).** The "Scientific classification" band color is
  emitted by `{{Taxobox colour}}` as inline `style` on the banner `<th>`. #74 deliberately accepted a
  neutral-grey band because the color lived only in stripped inline `style`; #105 confirmed it is **not**
  recoverable via the block path (it is inline, not a `<style>` block).

The reason we strip is real and must not be weakened — the **X4 guarantee**: a crafted inline `style` can
exfiltrate via `background:url(attacker/?leak=…)`, overlay/clickjack via `position:fixed/absolute`, execute
via `behavior`/`expression()`, or use escape-obfuscated variants to smuggle any of these past a naive
filter. The product question this spec answers: *can we keep a small, layout-only subset of inline `style`
— sanitized through #105's value sanitizer and confined to allowlisted properties — so montages tile and
recovered colors render faithfully, without re-opening that surface?*

## 2. User value

The article column **looks like Wikipedia** for the layouts Wikipedia carries inline.

- **The Curious Reader** (the UX persona who lands on a Topic page to read the encyclopedia next to the
  clips) sees multi-image montages laid out **side-by-side in their intended grid with a uniform crop**, not
  a broken stack of full-width images — the live failure the owner reported on Cat and San Francisco. Colored
  legend/status cells and the taxon band read as they do on Wikipedia. The CLAUDE.md promise — "the Wiki
  article side keeps a faithful Wikipedia look" — holds for inline-styled layout, the last large fidelity
  gap after #105.
- **The wiki+ team** closes #91 and #93 and recovers #74's accepted-partial taxon-band color **without**
  expanding the XSS surface — the allowlisted property set plus #105's value sanitizer is a narrow, auditable
  boundary, not "inline `style` is back on."

## 3. Scope

**In scope** — the inline-`style` **value + property allowlist** boundary in the article column
(`.wiki-body`): how each surviving element's `style` attribute is parsed, reduced to an **allowlisted
layout-only property set**, each kept declaration's value run through #105's value sanitizer
(`lib/wiki/cssScope.ts`), everything else dropped, and the cleaned `style` re-applied — so per-element
layout/color renders faithfully. Concretely:

1. Keep only an **allowlisted layout-only property set** from each inline `style` (the candidate set from
   the issue, the spike confirms the minimal sufficient set): `width`, `max-width`, `height`, `overflow`
   (montage tiling + per-image crop), `background-color`, `color` (per-cell colors, taxon band),
   `text-align`, `vertical-align`, and `border` / `border-*`. **Every other property is dropped.**
2. Run **every kept declaration's value** through #105's value sanitizer (escape-decode + drop on any
   `url()`/`image-set()`/`expression()`/`-moz-element()`/`behavior` token), and **always** drop `position`
   (the whole property, for inline style — overlay/clickjack), `behavior`, `-moz-binding`, any `@`-construct,
   and anything that could escape the cell, regardless of property.
3. Optionally restore the img **`width`/`height` presentational attributes** if the montage needs the
   image's scaled display size carried as attributes rather than as inline `style` — the spike decides
   whether this is needed and whether it is sufficient/safe (these are inert presentational attributes,
   distinct from inline `style`; today they are in `ALLOWED_ATTR` but URI-validated away by DOMPurify 3.x,
   the same way `colspan`/`rowspan`/`scope` were before #74's inert-attr hook).

**Out of scope** — do not touch:

- **`<style>`/TemplateStyles-block reuse** — delivered by #105. This spec is the inline-`style` *attribute*
  path only; #105's block path and its CSS-block X4 re-proof are unchanged and must not regress.
- **#92 pushpin locator-map overlays** — they require `position:absolute`, which this allowlist
  **deliberately blocks** (clickjack surface). #92 remains a documented accepted limit; recovering it is
  **not** a goal of this issue and must not motivate admitting `position`.
- **The strip list** (`stripChrome`) — which elements are *removed* is unchanged; this spec changes how
  *surviving* elements' inline `style` is sanitized, not which elements survive. (The `#Timeline-row`
  geologic-timebar graphic, which `stripChrome` removes precisely because its inline-`style` positioning is
  stripped, stays removed — its layout uses absolute `position`, which this allowlist still blocks.)
- The ＋plus rail / header / reading layout / two-column shell / TOC / citation popover / scroll-sync; **math**
  (the SVG-fallback mechanism); **non-English / multilingual** articles.
- Re-opening the article column to host video or any in-article wiki+ chrome, or re-admitting any non-`style`
  attribute, tag, event handler, or `javascript:`/`data:` URI that the HTML sanitizer drops today.

## 4. Acceptance criteria (numbered, individually testable, mechanism-agnostic)

These describe **required properties**, not the implementation; QA maps a test to each. **AC5–AC9 (the X4
re-proof for inline `style`) are the security release gate.** Wherever an AC names a value (a property, a
color), it is the *faithful-Wikipedia* value, not an invented one. Fidelity ACs are verified against the
live Parsoid markup of the named articles.

### Fidelity

- **AC1 — `.tmulti` montages tile faithfully (resolves #91) — the headline, verified LIVE.** On the live
  app, `Cat` and `San Francisco` (the two articles the owner reported broken) render their
  `Template:Multiple image` `.tmulti` montages with the images **side-by-side in their intended grid/row,
  each uniformly cropped** to the template's per-image dimensions — **not** a stacked, full-width single
  column. Verified at **desktop (~1366px)** and **narrow (~768px)** viewport widths. A montage that still
  renders as a vertical stack of full-width images, or with images at wildly mismatched sizes / no crop,
  **fails AC1.** (This is a *live* AC — QA loads the deployed pages, not only a unit fixture; the failure is
  a live regression and must be observed fixed on the real pages.)
- **AC2 — Per-cell colored table backgrounds render faithfully (#93).** A table whose cells carry inline
  `style="background-color:…"` (and `color:…` where Wikipedia pairs them) renders those cells with the
  faithful Wikipedia cell color (subject to AC8's AA adjustment) — not as uncolored cells. The per-cell color
  is the cell's, scoped to that cell; it does not bleed to siblings or the table frame.
- **AC3 — The taxobox taxon-band color renders faithfully (recovers #74's partial).** The "Scientific
  classification" banner band on a taxobox (e.g. on `Cat`) renders in its faithful Wikipedia taxon-band
  color carried by the banner `<th>`'s inline `style` (subject to AC8), rather than the #74 neutral grey.
  The band's *structural* signal (centered, bold, hairline) is preserved regardless, so the band still reads
  if the color is AA-darkened.
- **AC4 — No fidelity regression where inline `style` is dropped.** An element whose inline `style` carries
  **only** non-allowlisted or sanitized-away declarations renders as it does today (no stray attribute, no
  broken layout) — the recovery is additive for the allowlisted subset and a no-op everywhere else.

### X4 security re-proof for the inline-`style` boundary (the release gate)

The threat model is **re-argued for this re-opened boundary, not inherited** — keeping a layout-only subset
of inline `style` is a new surface and each property below is a testable assertion against a crafted inline
`style` attribute in fetched article HTML. "Dropped/neutralized" means the malicious effect does not occur
in the rendered page; whether the sanitizer drops the property, drops the declaration, or rewrites it inert
is the mechanism's choice (the AC stays mechanism-agnostic). **#105's value sanitizer is the reused
primitive; these ACs prove it is correctly applied to inline-`style` values.**

- **AC5 — Property allowlist is the boundary: only layout-only properties survive.** After sanitize, a
  surviving element's inline `style` contains **only** properties from the allowlisted set (§3.1); **every
  other property is dropped.** A crafted `style` mixing allowlisted and non-allowlisted properties keeps the
  allowlisted ones and drops the rest (e.g. `style="background-color:#eee; behavior:url(x); content:'…';
  z-index:99"` → only `background-color` survives). An inline `style` consisting solely of non-allowlisted
  properties leaves **no** `style` attribute.
- **AC6 — No `url()` / `image-set()` exfiltration via a kept value.** A kept (allowlisted-property)
  declaration whose value attempts a network request via a CSS value — `background-color:url(...)` is
  rejected as non-color, but more pointedly any allowlisted property carrying `url(...)` / `image-set(...)` /
  `-webkit-image-set(...)` / `-moz-element(...)` — does **not** survive: the declaration is dropped so no
  request is issued. (Reuses #105's `BAD_VALUE_FN` / token-level `valueHasBadFnToken` scan.)
- **AC7 — No off-column overlay / clickjack via `position`.** `position` (any value — `fixed`, `absolute`,
  `sticky`, and even `relative`/`static`) is **not** an allowlisted inline-`style` property and is dropped,
  so no inline-styled element can leave normal flow to overlay or clickjack wiki+ chrome (the ＋plus rail,
  header, player modal, TOC, candidate dock). (Inline `style` is stricter than #105's block path, which
  keeps `position:relative` for `td.clade-bar`; the per-element inline surface drops `position` wholesale.)
- **AC8-X4 — No script execution via `behavior` / `expression()` / `-moz-binding`.** A crafted inline
  `style` using `behavior:url(...)`, `expression(...)`, `-moz-binding:url(...)`, or `binding` is dropped
  (the property is non-allowlisted *and* the value sanitizer rejects the function token), so no script
  executes from inline `style`. *(Numbered AC8-X4 to keep the X4 block contiguous; the AA criterion is AC10.)*
- **AC9 — Escape-obfuscated and comment/whitespace-obfuscated variants are decoded, not smuggled.** Every
  property-name and value comparison runs on the **decoded** form (reusing #105's `decodeIdent` /
  comment-strip + whitespace-collapse + token-level scan), so escape-obfuscated property names
  (`po\73ition`, `\62 ehavior`), escaped function names (`\75 rl(`, `ur\6c(`), and comment/whitespace splits
  (`u/**/rl(`, `exp ression(`) are recognized and dropped — they do **not** read as benign literals and slip
  through. An un-parseable or un-tokenizable value fails closed (the declaration is dropped). This is the
  jsdom-vs-real-browser gap #105 documented: the test harness must assert the **decoded** outcome.

### Visual, accessibility, responsive, build

- **AC10 — AA contrast on recovered colors; never information by color alone.** Every recovered per-cell
  background (AC2) and the taxon band (AC3) meets **AA**: text on a recovered background ≥ 4.5:1 (≥ 3:1 for
  large text), and any meaningful boundary ≥ 3:1. Where a faithful Wikipedia color fails contrast in our
  column, the ink/border/background is **darkened/adjusted to pass** rather than shipping the failing color;
  the cell/band's meaning never depends on color alone (it survives in greyscale via text, position, weight,
  or hairline). A recovered color that ships below AA **fails AC10.**
- **AC11 — No Indigo bleed; responsive containment preserved.** No recovered inline-`style` value introduces
  Indigo Press color or treatment (`brand`/`sprout`/`action`, the hardbox border, the offset shadow, the
  Indigo fonts, gold) into the article column; recovered colors are the faithful Wikipedia values only, box
  frames stay faithful Wikipedia grey. Below the `lg` breakpoint, montages and colored tables stay contained:
  a wide montage/table scrolls within its own contained region and the article body and the two-column shell
  **never** scroll horizontally; a tiled montage that would overflow the narrow column degrades to a
  contained/wrapped layout, not a shell-widening row (consistent with AC1's narrow-width verification).
- **AC12 — Build + typecheck + full suite green.** `yarn build`, `yarn typecheck`, and the **full Vitest
  suite** are green, including: the new inline-`style` X4 regression tests (AC5–AC9); the new fidelity tests
  for montage tiling (AC1), per-cell color (AC2), and the taxon band (AC3); and the **revised** existing
  inline-`style` assertions (§8). **Docker build CI is green** (the host-`yarn build` is not a substitute —
  per the recorded QA gotcha, the Docker-context build must pass).
- **AC13 — No regression: #105 and the rest of the article column hold.** #105's TemplateStyles-block reuse
  (cladograms, `.tmulti` flex scaffold, the long-tail styled tables) and its **CSS-block X4** re-proof
  (`url()`/`@import`/`position`/scope-escape/`</style>`-injection) still pass unchanged. The block-path
  sanitizer and the DOMPurify HTML pass (allowlist, custom `ALLOWED_URI_REGEXP`, the inert-attr
  `uponSanitizeAttribute` hook removed in `finally`) gain no new leak across the shared DOMPurify singleton.
  Math (SVG fallback), the citation popover, scroll-sync, the TOC, wikilink routing, and section anchors
  behave as before on the previously-verified articles (`Photosynthesis`, `Cellular_respiration`, `Lion`,
  `Pythagorean_theorem`).

## 5. Success metric

- **Primary (the live failure is fixed):** the count of **broken `.tmulti` montages on `Cat` + `San
  Francisco` = 0** — both render side-by-side, uniformly cropped, at desktop and narrow widths (AC1). Before
  this work the count is "all of them" (every `.tmulti` stacks). The bar: a reader could not tell our montage
  from Wikipedia's, modulo column width.
- **Secondary (recovered colors are faithful and safe):** per-cell colored cells (#93) and the taxon band
  (#74's partial) render in their faithful Wikipedia color (AA-adjusted where needed), with the count of
  **AA failures on recovered colors = 0** (AC10).
- **Guardrail (non-negotiable):** **inline-`style` X4 violations = 0** — every disallowed property/value,
  including escape- and comment-obfuscated variants, is provably dropped (AC5–AC9). No fidelity or color gain
  is acceptable that admits any of the four inline-`style` threats; the X4 re-proof is a hard bound on the
  metric, verified by QA's security review as the release gate.

## 6. Discovery / decision spike — decision criteria

This issue is gated on a **developer spike that runs first.** **Product does not pick the mechanism** — the
spike does, and these ACs stay mechanism-agnostic so QA maps tests to *properties*. The value sanitizer
already exists (#105's `lib/wiki/cssScope.ts`), so the spike is **focused** — it is not a new parser, it is
the property allowlist + safe parse/re-apply of inline `style` reusing that sanitizer. The spike must:

1. **Pick the inline-`style` sanitization mechanism** that, for each surviving element's `style` attribute:
   parses the declarations, keeps **only** the allowlisted layout-only property set (§3.1), runs each kept
   value through #105's value sanitizer (`lib/wiki/cssScope.ts` — escape-decode, the
   `url()`/`image-set()`/`expression()`/`-moz-element()`/`behavior` strip, fail-closed on un-tokenizable
   values), drops everything else, and re-applies the cleaned `style` **without** re-admitting any other
   attribute, tag, hook, or URI. It must **reuse** #105's value-sanitization primitives rather than
   re-implement the threat strip (one auditable copy of the X4 value logic). It must confirm the minimal
   sufficient property set that tiles `.tmulti` faithfully and renders #93/#74 colors, **and** decide whether
   restoring the img `width`/`height` presentational attributes is needed and is sufficient/safe (and if so,
   how — without weakening the URI-validation that drops other attribute values).
2. **Record the inline-`style` allowlist + the re-argued X4 threat model** in `docs/ARCHITECTURE.md`
   (the "DOMPurify allowlist" entry, alongside the #105 mechanism) as the source of truth: the allowlisted
   property set, how `position`/`behavior`/`url()`/escape-obfuscation are each handled for inline `style`,
   how the inline path reuses #105's value sanitizer, and the img `width`/`height` decision. This is the
   re-opening of the `style` boundary; the doc must state the new boundary precisely and why X4 still holds.
3. **Honor the fallback the lane implies.** If **no approach cleanly re-proves X4** for inline `style`
   (AC5–AC9), the spike does **not** ship a weakened boundary: the fallback is to **keep inline `style` fully
   stripped** (the status quo) and record *why* the layout-only subset could not meet X4 in
   `docs/ARCHITECTURE.md`. In that outcome the fidelity ACs (AC1–AC4) are **not** met by this issue, #91/#93
   stay open, and the issue closes as "inline-`style` X4 could not be re-proven; full strip retained, reasons
   recorded," not as a partial security compromise. **The X4 guarantee is never traded for fidelity or
   color.**

The spike's output (chosen mechanism + recorded threat model, or the documented fallback) is the input that
lets the UX + Dev stages proceed.

## 7. Assumptions (recorded from ambiguity, not escalated)

- **A1 — "Faithful, layout-only" is the bar; per-pixel parity is not required where our column is narrower.**
  As in #104/#105's contract, "modulo our column width and the stripped chrome" is the only license;
  montage grid, crop, per-cell color, and band color otherwise match Wikipedia.
- **A2 — The allowlisted property set in §3.1 is the *candidate*; the spike confirms the minimal sufficient
  set.** If the spike finds a candidate property is not needed for AC1–AC3, dropping it from the allowlist is
  a welcome tightening (smaller surface). Adding a property **not** in the candidate set requires re-arguing
  X4 for it and recording why it is layout-only and safe — Product's bias is the smallest set that meets
  AC1–AC3.
- **A3 — `position` is never allowlisted for inline `style`, even `relative`.** Unlike #105's block path
  (which keeps `position:relative` for `td.clade-bar`), the inline surface is per-element and attacker-
  reachable on any element; the simplest safe rule is "no `position` at all inline." If a fidelity case ever
  *needs* inline `position:relative`, that is a separate, re-argued decision — not assumed here. #92 (pushpin
  overlays, needing `position:absolute`) stays out of scope (§3) for the same reason.
- **A4 — The taxon-band recovery (AC3) is in scope here precisely because #105 proved it is inline-only.**
  #105's spike confirmed `{{Taxobox colour}}` ships the band color as inline `style`, so it is unreachable
  by the block path and is this issue's to recover — *if and only if* the safe inline mechanism admits a
  sanitized color value without violating X4 (it does: a hex/keyword color carries no `url()`/`position`/
  banned token). If for any reason the band color cannot be recovered safely, #74's neutral grey stands as
  the accepted partial; the hard requirements are AC1 (montage), AC5–AC9 (X4), and AC10 (AA) — never a color
  at the cost of safety.

## 8. Existing inline-`style` X4 assertions to **revise** (not delete) — load-bearing for QA

This issue **changes the inline-`style` boundary** from "every inline `style` is fully dropped" to
"allowlisted layout-only properties are **kept (sanitized)**; everything else is **dropped**." The existing
tests that assert inline `style` is *fully* dropped must be **re-pointed to the new boundary — not deleted**
— and the inline-`style` X4 protections must be **re-proven, not weakened.** Dev/QA must revise at least:

- `test/article-fidelity.test.ts` (~L419–424) — "the inline style that carried the taxobox banner band/width
  is stripped (X4 — option a is necessary)": currently asserts `style=` **never** survives, the taxon band
  color does **not** survive, and `width: 200px` does **not** survive. Under the new boundary the band's
  **color survives sanitized** (AC3) and an allowlisted **`width`** may survive sanitized; revise this to
  assert the *new* boundary — non-allowlisted props/values and the X4 threats (`url()`, `position`,
  `behavior`, `expression`, obfuscated variants) are still dropped — while the allowlisted, sanitized layout
  subset is kept.
- `test/article-fidelity-xss.test.ts` (~L101–107) — "style attr on an allowed table cell is dropped (no CSS
  injection)": the payload is `background:url(javascript:alert(1))`. The **`url()` value must still die**
  (AC6); revise the assertion from "the cell has no `style` attribute at all" to "no `url()`/`javascript:`
  survives, and only the sanitized allowlisted subset (if any) remains." Add a positive case: a cell with
  `background-color:#…` keeps a sanitized `background-color` (AC2).
- `test/article-fidelity-hook-xss.test.ts` (~L57–94, and the post-fetch singleton case ~L139–167) — the
  colspan-hook assertions co-locate `style`/`on*`/`javascript:`/`position:fixed` on a banner `<th>`. The
  **`on*` handlers, `javascript:`, and `position:fixed` must still die** (AC7, AC8-X4, and the unchanged
  HTML/event-handler boundary), and `colspan`/`rowspan`/`scope` still survive. Revise the blanket
  `hasAttribute("style") === false` assertions to the new boundary: the hostile declarations are gone, while
  any allowlisted, sanitized declaration on the element is kept — and confirm the inert-attr hook still
  cannot rescue `style` itself beyond the value-sanitized layout subset.

Any other test asserting "no inline `style` survives" anywhere in the article column must be audited against
the new boundary in the same way. **The point of revising (not deleting) is that the X4 protections are
re-proven on the new boundary** — the payloads stay; only the expected *shape* of the surviving `style`
changes from "nothing" to "the sanitized layout-only subset."

---

## Hand-off

- **Discovery spike (Dev, next, gates the build):** pick the inline-`style` sanitization mechanism per §6
  reusing #105's value sanitizer + the property allowlist; confirm the minimal property set + the img
  `width`/`height` decision; record the allowlist + re-argued X4 threat model in `docs/ARCHITECTURE.md`, or
  invoke the documented fallback (keep inline `style` fully stripped, record why). The ACs here stay
  mechanism-agnostic.
- **UX / Design:** produce the design contract for the recovered inline-`style` subset — the faithful
  montage tiling target (grid + uniform crop, the responsive contained/wrapped fallback for AC11), the
  per-cell color and taxon-band treatment, the **AA** contrast + no-color-alone rule (AC10, the darken-to-
  pass policy), and the explicit "no Indigo bleed" boundary (AC11). The #105 contract is the starting point
  to generalize, not re-derive.
- **Development:** implement against the UX contract and AC1–AC13 once the spike fixes the mechanism; reuse
  `lib/wiki/cssScope.ts`'s value sanitizer for inline-`style` values; add the montage/color/band fidelity
  tests (AC1–AC3) and the inline-`style` X4 regression tests (AC5–AC9); and **revise** the existing
  "style fully dropped" assertions to the new boundary (§8).
- **QA & Review:** verify each AC, with **AC5–AC9 (the inline-`style` X4 re-proof) as a hard, non-author
  security-review release gate** — this is the **Heavy lane**, the heaviest security surface in the project.
  Verify **AC1 live** on the deployed `Cat` and `San Francisco` pages at desktop and narrow widths (not only
  a unit fixture), confirm AC10 AA on recovered colors, and confirm AC13 (no #105 regression) on the
  previously-verified articles. The **Docker build CI** must be green (host build is not a substitute).
