// Shared CSS declaration-VALUE safety gate — the ONE audited copy of the X4 value logic
// used by BOTH the `<style>`-block path (`scopeArticleCss`, lib/wiki/cssScope.ts) and the
// inline-`style` path (`sanitizeInlineStyle`, lib/wiki/inlineStyle.ts). See
// docs/ARCHITECTURE.md ("DOMPurify allowlist") and docs/design/inline-style-subset-spike.md §6.
//
// A declaration's value is UNSAFE when it can fetch the network or run script: a
// url()/image-set()/-webkit-image-set()/-moz-element()/expression() function token, or a
// `behavior:` re-declaration smuggled inside another value. Two complementary scans run
// against the value, EITHER firing the drop:
//   1. a TEXTUAL scan on the comment-stripped, whitespace-collapsed value — NOT an AST
//      `Url`-node check — because the browser tokenizer strips comments before recognizing
//      function tokens, so `u/**/rl(…)` is a real `url()` the browser honors but css-tree
//      emits no `Url` node for. The textual scan closes that gap.
//   2. a TOKEN-level scan (`valueHasBadFnToken`) that tokenizes the value and DECODES each
//      function-name token before comparing — so an escaped function name (`\75 rl(`,
//      `ur\6c(`, `\000075rl(`) is caught even though its raw literal is not `url(`. The
//      token scan reads only function/url TOKENS, never string contents, so a harmless
//      `content:"\75rl("` string literal is not mistaken for a real `url(`.
//
// A conformant browser DECODES CSS escape sequences during tokenization, so every property-
// name and value comparison must run on the DECODED token — never the raw css-tree literal.
// (jsdom does not decode these like a real browser, which is why a raw-literal scan looks
// safe under test but is wide open in production; there is no CSP backstop.) The block path
// reads `<style>` text and the inline path reads `getAttribute("style")` raw bytes — both
// feed `css-tree`, which sees the same bytes the browser tokenizes.
//
// css-tree is lazy-loaded (`await import`) so it stays off the initial bundle and out of the
// no-article paths. Only the lexer-free SUBPATH entries are imported (`css-tree/generator`,
// `css-tree/tokenizer`, `css-tree/utils`) — NOT the `css-tree` main entry, which builds its
// default syntax WITH the lexer config at module init and so pulls ~0.8 MB of `mdn-data` into
// the bundle. The generator/tokenizer/utils subpaths ship none of that; the lexer/validation
// API and its `mdn-data` table are never reached.

import type { CssNode } from "css-tree";

// A declaration whose value carries any of these fetch/script function tokens is dropped.
export const BAD_VALUE_FN = /(?:url|image-set|-webkit-image-set|expression|-moz-element)\s*\(/i;
export const BAD_VALUE_BEHAVIOR = /behaviou?r\s*:/i;
// Decoded function names that fetch the network or run script. `url` also covers the
// `<url-token>` grammar form (`url(unquoted)`), handled separately as a token type.
export const BAD_FN_NAMES = new Set([
  "url",
  "image-set",
  "-webkit-image-set",
  "expression",
  "-moz-element",
]);

/**
 * The shared declaration-value sanitizer, bound to the lazy-imported css-tree primitives it
 * needs. Both CSS paths build this ONCE (after their own `Promise.all` of subpath imports)
 * and call its members, so the X4 value logic has exactly one implementation.
 */
export interface DeclSafety {
  /** Decode CSS escape sequences in an identifier, then lowercase — the form a browser
   *  compares against. `@imp\ort` → `import`, `po\73 ition` → `position`, `f\69xed` → `fixed`. */
  normIdent(s: string | undefined | null): string;
  /** The raw identifier-escape decoder (`css-tree/utils` `ident.decode`), un-lowercased —
   *  for a whole-value keyword decode where case must be folded by the caller. */
  decodeIdent(s: string): string;
  /** Serialize a parsed value node to its CSS source string (`css-tree/generator`). */
  generate(node: CssNode): string;
  /** Token-level scan: tokenize the value and DECODE each function-name token before
   *  comparing to the banned set, catching escaped names (`\75 rl(`, `ur\6c(`). A bare
   *  `<url-token>` is always a fetch. Reads only function/url tokens, never string contents,
   *  so a benign `content:"\75rl("` literal is not mistaken for a real `url(`. */
  valueHasBadFnToken(value: string): boolean;
  /**
   * The combined VALUE-drop predicate shared by both paths: `true` when a declaration's
   * value is SAFE to keep, `false` when it must be dropped. Runs the comment-stripped,
   * whitespace-collapsed textual scan (`BAD_VALUE_FN`/`BAD_VALUE_BEHAVIOR`) AND the
   * token-level decoded scan (`valueHasBadFnToken`); fails closed (`false`) on an
   * un-tokenizable value. This is the exact value-drop condition both paths apply — the
   * block path layers its own `position`/property drop-list around it; the inline path
   * layers the property ALLOWLIST + total `position` drop around it.
   */
  valueIsDeclarationSafe(rawValue: string): boolean;
}

/**
 * Build the shared declaration-value sanitizer from css-tree's lexer-free subpaths. Async
 * because css-tree is lazy-imported (kept off the initial bundle / no-article paths). Both
 * `scopeArticleCss` and `sanitizeInlineStyle` call this and use the returned members so the
 * X4 value logic stays in one audited copy.
 */
export async function loadDeclSafety(): Promise<DeclSafety> {
  const [generate, tokenizer, decodeIdent] = await Promise.all([
    import("css-tree/generator").then((m) => m.default),
    import("css-tree/tokenizer"),
    import("css-tree/utils").then((m) => m.ident.decode),
  ]);
  const { tokenize, tokenTypes } = tokenizer;

  const normIdent = (s: string | undefined | null) =>
    decodeIdent(s || "").toLowerCase();

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

  const valueIsDeclarationSafe = (rawValue: string): boolean => {
    // Strip CSS comments and collapse whitespace for the textual scan (defeats `u/**/rl(`
    // / `exp ression(` obfuscation), then run BOTH scans; either firing means drop.
    const value = rawValue.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
    if (BAD_VALUE_FN.test(value) || BAD_VALUE_BEHAVIOR.test(value)) return false;
    if (valueHasBadFnToken(rawValue)) return false;
    return true;
  };

  return {
    normIdent,
    decodeIdent,
    generate,
    valueHasBadFnToken,
    valueIsDeclarationSafe,
  };
}
