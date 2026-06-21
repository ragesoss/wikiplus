// Sanitize + scope the page's own `<style>`/TemplateStyles CSS so the article column
// (`.wiki-body`) renders faithful Wikipedia layout — cladograms, multi-image montages,
// hlists, and the long tail of TemplateStyles tables — with NO per-template CSS authored
// by wiki+. See docs/ARCHITECTURE.md ("TemplateStyles reuse mechanism") and the spike
// docs/design/templatestyles-reuse-spike.md §4.
//
// This module is the X4 anti-XSS gate for the CSS-block boundary. It walks the CSS as a
// css-tree AST and returns ONE scoped, stripped stylesheet string that:
//   (scope)  prefixes every selector with a `.wiki-body ` descendant combinator — across
//            comma lists and inside @media/@supports/:is()/:where()/:has()/CSS-nesting —
//            so a bare `body`/`:root`/`html`/`*` or a crafted breakout selector is confined
//            to descendants of the article column and cannot match wiki+ chrome.
//   (strip)  drops network/script at-rules (@import/@font-face/@document/…), off-column
//            `position` (fixed/absolute/sticky), legacy script-binding properties
//            (behavior/-moz-binding), and any declaration whose comment-stripped,
//            whitespace-collapsed value carries a url()/image-set()/expression()/
//            -moz-element() function token (network exfiltration).
//
// The returned string is applied ONLY via a `<style>` element's `textContent` (never
// `dangerouslySetInnerHTML`), so a `</style>`-injection fragment that survives tolerant
// CSS parsing is inert text, never markup. That application contract is what makes the
// tolerant parse (empty-string-on-throw) safe; do not pair it with an innerHTML apply.
//
// A conformant browser DECODES CSS escape sequences during tokenization, so the strip must
// compare against the DECODED token — never the raw literal css-tree leaves on `node.name`/
// `node.property`/the generated value. Otherwise `@imp\ort`, `po\73 ition:f\69xed`, and
// `\75 rl(` read as benign literals to the strip while the browser sees the live banned
// token. (jsdom does not decode these like a real browser, which is why a raw-literal scan
// looks safe under test but is wide open in production; there is no CSP backstop.) Every
// strip comparison below runs on the decoded form via `css-tree/utils`' `ident.decode`
// (the CSS Syntax tokenizer's identifier decoder) and a token-level scan of the value.
//
// css-tree is lazy-loaded (`await import`) like dompurify in `fetchFullArticle`, so it
// stays off the initial bundle and out of the no-article paths. Only `parse`/`walk`/
// `generate`, plus the lexer-free `tokenize`/`ident.decode`, are used — imported from
// css-tree's lexer-free SUBPATH entries (`css-tree/parser`, `css-tree/generator`,
// `css-tree/walker`, `css-tree/tokenizer`, `css-tree/utils`) — NOT the `css-tree` main
// entry, which builds its default syntax WITH the lexer config at module init and so pulls
// ~0.8 MB of `mdn-data` into the bundle. The subpaths ship only the parser/generator/walker
// /tokenizer/utils; the lexer/validation API and its `mdn-data` table are never reached.

// Type-only import (erased at build, pulls no runtime `css-tree` / `mdn-data` into the
// bundle) — for the AST `List`/`ListItem` shapes used when translating `.mw-parser-output`.
import type { CssNode, List, ListItem } from "css-tree";

// At-rules that fetch the network or re-target outside the article column are dropped
// wholesale. @media/@supports/@keyframes are KEPT (their inner rules are scoped by the
// selector pass — except @keyframes keyframe selectors, see `keyframeRules`).
const DROP_AT_RULES = new Set([
  "import", // remote-CSS fetch
  "namespace",
  "charset",
  "font-face", // remote-font fetch
  "page",
  "document", // legacy selection-scoping that could re-target chrome
  "-moz-document",
  "apply",
]);

// Properties that are legacy script-execution / XBL-binding vectors.
const DROP_PROPERTIES = new Set(["behavior", "-moz-binding", "binding"]);

// `position` values that take an element out of normal flow (overlay / clickjack).
// `relative`/`static` are kept (clade `td.clade-bar` uses `position: relative`).
const DROP_POSITION_VALUES = new Set(["fixed", "absolute", "sticky"]);

// A declaration whose value carries any of these fetch/script function tokens is dropped.
// Two complementary scans run against the value, EITHER firing the drop:
//   1. a TEXTUAL scan on the comment-stripped, whitespace-collapsed value — NOT an AST
//      `Url`-node check — because the browser tokenizer strips comments before recognizing
//      function tokens, so `u/**/rl(…)` is a real `url()` the browser honors but css-tree
//      emits no `Url` node for. The textual scan closes that gap (spike §4.3).
//   2. a TOKEN-level scan (`valueHasBadFnToken`) that tokenizes the value and decodes each
//      function-name token before comparing — so an escaped function name (`\75 rl(`,
//      `ur\6c(`, `\000075rl(`) is caught even though its raw literal is not `url(`. The
//      token scan reads only function/url TOKENS, never string contents, so a harmless
//      `content:"\75rl("` string literal is not mistaken for a real `url(`.
const BAD_VALUE_FN = /(?:url|image-set|-webkit-image-set|expression|-moz-element)\s*\(/i;
const BAD_VALUE_BEHAVIOR = /behaviou?r\s*:/i;
// Decoded function names that fetch the network or run script. `url` also covers the
// `<url-token>` grammar form (`url(unquoted)`), handled separately as a token type.
const BAD_FN_NAMES = new Set([
  "url",
  "image-set",
  "-webkit-image-set",
  "expression",
  "-moz-element",
]);

/**
 * Sanitize + scope a stylesheet so every rule is confined under `.wiki-body` and every
 * network/script/off-column vector is stripped. Returns ONE scoped stylesheet string, or
 * `""` on any parse/transform failure (no CSS is safe; partial/garbage CSS is not). The
 * result MUST be applied via `textContent`/`CSSStyleSheet`, never `dangerouslySetInnerHTML`.
 *
 * Async because css-tree is lazy-imported (kept off the initial bundle / no-article paths).
 */
export async function scopeArticleCss(css: string): Promise<string> {
  if (!css || !css.trim()) return "";
  const [parse, generate, walk, tokenizer, decodeIdent] = await Promise.all([
    import("css-tree/parser").then((m) => m.default),
    import("css-tree/generator").then((m) => m.default),
    import("css-tree/walker").then((m) => m.default),
    import("css-tree/tokenizer"),
    import("css-tree/utils").then((m) => m.ident.decode),
  ]);
  const { tokenize, tokenTypes } = tokenizer;

  // Decode CSS escape sequences in an identifier, then lowercase — the form a browser
  // compares against. `@imp\ort` → `import`, `po\73 ition` → `position`, `f\69xed` → `fixed`.
  const normIdent = (s: string | undefined | null) =>
    decodeIdent(s || "").toLowerCase();

  // Token-level scan: tokenize the value and decode each function-name token before
  // comparing to the banned set, so an ESCAPED function name (`\75 rl(`, `ur\6c(`,
  // `\000075rl(`) is caught. A bare `<url-token>` (`url(unquoted)`) is always a fetch.
  // Reads only function/url TOKENS — never string-token contents — so a benign
  // `content:"\75rl("` string literal is not mistaken for a real `url(`.
  const valueHasBadFnToken = (value: string): boolean => {
    let hit = false;
    try {
      tokenize(value, (type, start, end) => {
        if (hit) return;
        if (type === tokenTypes.Url) {
          hit = true; // `<url-token>`: url( unquoted ) — always a network fetch
          return;
        }
        if (type === tokenTypes.Function) {
          // function-token raw is `name(`; drop the trailing `(`, then decode the name.
          const raw = value.slice(start, end).replace(/\($/, "");
          if (BAD_FN_NAMES.has(normIdent(raw))) hit = true;
        }
      });
    } catch {
      return true; // un-tokenizable value is not safe — fail closed
    }
    return hit;
  };

  // Translate Wikipedia's content-root scope away from a single selector's child list, in
  // place. Removes every `.mw-parser-output` ClassSelector (decoded + case-folded, so an
  // escaped `.mw-parser\2d output` is still recognized). When the removed class was the ONLY
  // simple selector in its compound (its neighbors on both sides are combinators or list
  // ends), its joining combinator is removed too — the FOLLOWING one if present, else the
  // PRECEDING one — so no dangling `table >` / `> table` is left. A compound that keeps
  // another simple selector (`.mw-parser-output.foo`, `div.mw-parser-output`) keeps all its
  // combinators. This only ever makes a selector LESS specific; it cannot add an ancestor or
  // reach outside what `.wiki-body ` (added next) confines.
  const stripParserOutput = (children: List<CssNode>) => {
    const targets: ListItem<CssNode>[] = [];
    children.forEach((data, item) => {
      if (data.type === "ClassSelector" && normIdent(data.name) === "mw-parser-output") {
        targets.push(item);
      }
    });
    for (const item of targets) {
      const prev = item.prev;
      const next = item.next;
      const aloneInCompound =
        (!prev || prev.data.type === "Combinator") &&
        (!next || next.data.type === "Combinator");
      children.remove(item);
      if (aloneInCompound) {
        if (next && next.data.type === "Combinator") children.remove(next);
        else if (prev && prev.data.type === "Combinator") children.remove(prev);
      }
    }
  };

  try {
    // Tolerant parse: a malformed fragment becomes an inert `Raw` node rather than
    // throwing. Acceptable ONLY because application is via `textContent` (a `Raw` fragment
    // can never become markup). The whole pass is wrapped so any throw yields `""`.
    const ast = parse(css, {
      parseValue: true,
      parseAtrulePrelude: true,
      onParseError() {},
    });

    // Pass 1 — at-rules. Drop network/script/re-targeting at-rules; collect the keyframe
    // `SelectorList`s of every kept @keyframes block so the selector pass can skip them (a
    // prefixed `from`/`to`/`0%` selector is invalid and silently kills the animation).
    const keyframeSelectorLists = new WeakSet<object>();
    walk(ast, {
      visit: "Atrule",
      enter(node, item, list) {
        // Decode escapes before comparing: `@imp\ort`/`@\69mport` → `import` is dropped.
        const name = normIdent(node.name);
        if (DROP_AT_RULES.has(name)) {
          if (list) list.remove(item);
          return;
        }
        if (name === "keyframes" || name === "-webkit-keyframes") {
          node.block?.children.forEach((child) => {
            if (
              child.type === "Rule" &&
              child.prelude?.type === "SelectorList"
            ) {
              keyframeSelectorLists.add(child.prelude);
            }
          });
        }
      },
    });

    // Pass 2 — declarations. Drop script-binding properties, off-column `position`, and
    // any value carrying a fetch/script function token.
    walk(ast, {
      visit: "Declaration",
      enter(node, item, list) {
        // Decode escapes before comparing: `po\73 ition` → `position`, `\62 ehavior` →
        // `behavior` is dropped.
        const prop = normIdent(node.property);
        if (DROP_PROPERTIES.has(prop)) {
          if (list) list.remove(item);
          return;
        }
        // Serialize the value once, then strip CSS comments and collapse whitespace for the
        // textual scan (defeats `u/**/rl(` / `exp ression(` style obfuscation).
        const rawValue = generate(node.value);
        const value = rawValue
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\s+/g, "");
        // Decode the whole value for the keyword check (position values are keywords, never
        // strings, so a whole-value decode cannot mis-read a string literal): `f\69xed`
        // and `\66ixed` both decode to `fixed`.
        if (prop === "position" && DROP_POSITION_VALUES.has(decodeIdent(value).toLowerCase())) {
          if (list) list.remove(item);
          return;
        }
        // Two scans, either fires the drop: the textual scan on the comment-stripped value
        // (catches `u/**/rl(`), and the token-level decoded scan (catches escaped function
        // names like `\75 rl(` / `ur\6c(` / `\000075rl(`). Run the token scan on the raw
        // serialized value so its tokenizer sees comments/whitespace as the browser does.
        if (
          BAD_VALUE_FN.test(value) ||
          BAD_VALUE_BEHAVIOR.test(value) ||
          valueHasBadFnToken(rawValue)
        ) {
          if (list) list.remove(item);
        }
      },
    });

    // Pass 3 — selectors. Two steps per selector, in order: (3a) translate Wikipedia's
    // content-root scope `.mw-parser-output` away, then (3b) prepend the `.wiki-body `
    // descendant prefix that is the X4 scope gate.
    //
    // (3a) Wikipedia keys EVERY TemplateStyles rule under its content-root class
    //   `.mw-parser-output` (e.g. `.mw-parser-output table.clade td.clade-label`). The
    //   sanitize/section-split path drops that wrapper, so the rendered article DOM has ZERO
    //   `.mw-parser-output` elements — a rule still demanding that ancestor matches nothing
    //   and is inert. We remove the `.mw-parser-output` class token from each selector so the
    //   reused rule resolves against the sanitized `.wiki-body` DOM as-is (ARCHITECTURE
    //   "TemplateStyles reuse mechanism"; the comment on `prepClades` in article.ts):
    //     `.mw-parser-output table.clade td.clade-label` → `table.clade td.clade-label`
    //     `.mw-parser-output.foo .bar` (compound) → `.foo .bar` (drop only the class token)
    //     `div.mw-parser-output` (compound) → `div`
    //     `.mw-parser-output` alone → "" (then 3b makes it `.wiki-body`, never empty)
    //   When the dropped class was the ONLY simple selector in its compound, its joining
    //   combinator is dropped too (the following one, else the preceding) so no dangling
    //   `table >`/`> table` survives. This only makes a selector LESS specific — it can never
    //   add an ancestor or let a selector escape, and 3b's prefix still runs after it.
    //
    // (3b) Prepend `.wiki-body ` (descendant combinator) to every selector in every
    //   `SelectorList` — which covers a rule's top-level selectors (across comma lists and
    //   CSS nesting) AND the inner selectors of :is()/:where()/:has()/:not() (each parses its
    //   argument as a SelectorList), so every branch is confined, not just the outer subject.
    //   The leading descendant prefix — not specificity — is what makes scope escape
    //   structurally impossible: the matched subject must descend from `.wiki-body`. A
    //   selector emptied by 3a becomes exactly `.wiki-body` (one class, no trailing
    //   combinator) — still scoped, never empty/unscoped.
    //
    // Two selectors are NOT prefixed by 3b:
    //   - @keyframes keyframe selectors (`from`/`to`/`0%`) — a prefixed keyframe selector
    //     is invalid and silently kills the animation (skipped via `keyframeSelectorLists`).
    //   - a relative selector that begins with a combinator (e.g. the `> .x` inside
    //     `:has(> .x)`) — prepending a descendant combinator there yields invalid
    //     `.wiki-body > .x`; it is left as-is and stays confined by the OUTER selector's
    //     prefix anyway (its subject is already inside the confined element's subtree).
    walk(ast, {
      visit: "SelectorList",
      enter(selectorList) {
        if (keyframeSelectorLists.has(selectorList)) return;
        selectorList.children.forEach((selector) => {
          if (selector.type !== "Selector") return;
          stripParserOutput(selector.children);
          const first = selector.children.first;
          if (first && first.type === "Combinator") return; // relative selector (:has(> …))
          if (selector.children.isEmpty) {
            // 3a emptied a selector that was solely `.mw-parser-output` → make it exactly
            // `.wiki-body` (still scoped; never empty/unscoped — X4).
            selector.children.prependData({ type: "ClassSelector", name: "wiki-body" });
            return;
          }
          selector.children.prependData({ type: "Combinator", name: " " });
          selector.children.prependData({ type: "ClassSelector", name: "wiki-body" });
        });
      },
    });

    return generate(ast);
  } catch {
    return "";
  }
}
