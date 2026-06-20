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
// css-tree is lazy-loaded (`await import`) like dompurify in `fetchFullArticle`, so it
// stays off the initial bundle and out of the no-article paths. Only `parse`/`walk`/
// `generate` are used, imported from css-tree's lexer-free SUBPATH entries
// (`css-tree/parser`, `css-tree/generator`, `css-tree/walker`) — NOT the `css-tree` main
// entry, which builds its default syntax WITH the lexer config at module init and so pulls
// ~0.8 MB of `mdn-data` into the bundle. The subpaths ship only the parser/generator/
// walker; the lexer/validation API and its `mdn-data` table are never reached.

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

// A declaration whose value contains any of these function tokens is dropped. The scan
// is TEXTUAL on the comment-stripped, whitespace-collapsed value — NOT an AST `Url`-node
// check — because the browser tokenizer strips comments before recognizing function
// tokens, so `u/**/rl(…)` is a real `url()` to the browser that css-tree does not emit a
// `Url` node for. The textual scan closes that gap (spike §4.3).
const BAD_VALUE_FN = /(?:url|image-set|-webkit-image-set|expression|-moz-element)\s*\(/i;
const BAD_VALUE_BEHAVIOR = /behaviou?r\s*:/i;

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
  const [parse, generate, walk] = await Promise.all([
    import("css-tree/parser").then((m) => m.default),
    import("css-tree/generator").then((m) => m.default),
    import("css-tree/walker").then((m) => m.default),
  ]);
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
        const name = (node.name || "").toLowerCase();
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
        const prop = (node.property || "").toLowerCase();
        if (DROP_PROPERTIES.has(prop)) {
          if (list) list.remove(item);
          return;
        }
        // Serialize the value, then strip CSS comments and collapse whitespace before the
        // textual scan (defeats `u/**/rl(` / `exp ression(` style obfuscation).
        const value = generate(node.value)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\s+/g, "");
        if (prop === "position" && DROP_POSITION_VALUES.has(value.toLowerCase())) {
          if (list) list.remove(item);
          return;
        }
        if (BAD_VALUE_FN.test(value) || BAD_VALUE_BEHAVIOR.test(value)) {
          if (list) list.remove(item);
        }
      },
    });

    // Pass 3 — selectors. Prepend `.wiki-body ` (descendant combinator) to every selector
    // in every `SelectorList` — which covers a rule's top-level selectors (across comma
    // lists and CSS nesting) AND the inner selectors of :is()/:where()/:has()/:not() (each
    // parses its argument as a SelectorList), so every branch is confined, not just the
    // outer subject. The leading descendant prefix — not specificity — is what makes scope
    // escape structurally impossible: the matched subject must descend from `.wiki-body`.
    //
    // Two selectors are NOT prefixed:
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
          const first = selector.children.first;
          if (first && first.type === "Combinator") return; // relative selector (:has(> …))
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
