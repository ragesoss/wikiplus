import { describe, expect, it } from "vitest";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// QA security re-confirmation (#105, fix round 2) — adversarial re-attack on the NEW
// `.mw-parser-output` translation (3a) added in cssScope.ts. The X4 invariant: EVERY emitted
// top-level selector must be confined under `.wiki-body` (begin with the `.wiki-body` scope
// token), and the translation must not strand a leading combinator or shift the subject so a
// rule could match wiki+ chrome (`body`, `html`, `:root`, the projector header) outside the
// article column. This battery is independent of Dev's committed tests.

// Split a scoped stylesheet into its individual TOP-LEVEL selectors (across comma lists),
// ignoring @-rule preludes' braces by only taking the text before the FIRST `{` of each block.
// For nested @media we still see the inner rule selectors as their own blocks.
function emittedSelectors(scoped: string): string[] {
  const out: string[] = [];
  // Strip @media/@supports wrappers' opening braces so inner rules surface as blocks.
  const flattened = scoped.replace(/@[a-z-]+[^{]*\{/gi, "");
  for (const block of flattened.split("}")) {
    const head = block.split("{")[0]?.trim();
    if (!head) continue;
    for (const sel of head.split(",")) {
      const s = sel.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// A top-level selector is CONFINED iff it begins with the `.wiki-body` scope token. The only
// exception the scoper allows is a relative selector beginning with a combinator (`> …`) which
// only appears INSIDE :has()/:is() argument lists, never as a top-level rule selector — so any
// top-level selector that does not start with `.wiki-body` is a scope escape.
function isConfined(sel: string): boolean {
  return /^\.wiki-body(\s|\.|:|>|~|\+|$)/.test(sel.trim());
}

// Returns the list of NON-confined emitted selectors (empty = all confined).
function escapes(scoped: string): string[] {
  return emittedSelectors(scoped).filter((s) => !isConfined(s));
}

// Inputs crafted so removing `.mw-parser-output` could change the subject, strand a combinator,
// empty an inner branch, or otherwise un-confine the emitted rule. Each must stay confined.
const ATTACKS: Array<[string, string]> = [
  // relative / :has edges Dev flagged
  [":has(> .mw-parser-output)", ":has(> .mw-parser-output){color:red}"],
  [":has(.mw-parser-output)", ":has(.mw-parser-output){color:red}"],
  [".mw-parser-output:has(.x)", ".mw-parser-output:has(.x){color:red}"],
  [".x:has(> .mw-parser-output)", ".x:has(> .mw-parser-output){color:red}"],
  // :is / :where / :not / nesting
  [":not(.mw-parser-output)", ":not(.mw-parser-output){color:red}"],
  [":is(.mw-parser-output)", ":is(.mw-parser-output){color:red}"],
  [":where(.mw-parser-output, body)", ":where(.mw-parser-output, body){color:red}"],
  ["nesting &", ".mw-parser-output{& .x{color:red}}"],
  // subject-shift / combinator-strand attempts
  [".mw-parser-output > body", ".mw-parser-output > body{color:red}"],
  ["body .mw-parser-output", "body .mw-parser-output{color:red}"],
  [".mw-parser-output, body", ".mw-parser-output, body{color:red}"],
  ["* .mw-parser-output", "* .mw-parser-output{color:red}"],
  [".mw-parser-output *", ".mw-parser-output *{color:red}"],
  [".mw-parser-output html", ".mw-parser-output html{color:red}"],
  ["html .mw-parser-output", "html .mw-parser-output{color:red}"],
  [":root .mw-parser-output", ":root .mw-parser-output{color:red}"],
  [".mw-parser-output:root", ".mw-parser-output:root{color:red}"],
  [".mw-parser-output ~ body", ".mw-parser-output ~ body{color:red}"],
  ["body ~ .mw-parser-output", "body ~ .mw-parser-output{color:red}"],
  [".mw-parser-output + body", ".mw-parser-output + body{color:red}"],
  // escaped / obfuscated content-root names
  ["escaped \\2d", ".mw-parser\\2d output{color:red}"],
  ["escaped \\2d + descendant", ".mw-parser\\2d output table.clade{color:red}"],
  ["case-folded .MW-parser-output", ".MW-parser-output table{color:red}"],
  ["escaped full \\6d w...", "\\6d w-parser-output table{color:red}"],
  // alone → must become exactly `.wiki-body`
  [".mw-parser-output alone", ".mw-parser-output{font-size:100%}"],
  // repeated / mixed
  ["repeated content-root", ".mw-parser-output .mw-parser-output body{color:red}"],
  [".mw-parser-output.foo body", ".mw-parser-output.foo body{color:red}"],
  // inside @media
  ["@media + content-root + body", "@media screen{.mw-parser-output body{color:red}}"],
];

describe("QA X4 re-attack — .mw-parser-output translation keeps every selector confined", () => {
  for (const [label, css] of ATTACKS) {
    it(`stays confined under .wiki-body: ${label}`, async () => {
      const scoped = await scopeArticleCss(css);
      const bad = escapes(scoped);
      // No emitted top-level selector may escape the .wiki-body scope.
      expect(bad, `non-confined selector(s) emitted for ${label}: ${JSON.stringify(bad)}\nfull: ${scoped}`).toEqual([]);
      // And no `.mw-parser-output` token should survive anywhere.
      expect(scoped).not.toContain("mw-parser-output");
    });
  }

  it("comment-split `.mw-parser-out/**/put` — confirm whether the split name survives (informational)", async () => {
    // A CSS comment inside an identifier ENDS the identifier per the tokenizer, so
    // `.mw-parser-out/**/put` is NOT a single `.mw-parser-output` class. Whatever the scoper
    // emits, it must STILL be confined under .wiki-body.
    const scoped = await scopeArticleCss(".mw-parser-out/**/put body{color:red}");
    expect(escapes(scoped)).toEqual([]);
  });

  it("a `.mw-parser-output`-only selector becomes EXACTLY `.wiki-body` (never empty/unscoped)", async () => {
    const out = await scopeArticleCss(".mw-parser-output{color:red}");
    expect(out).toMatch(/^\.wiki-body\s*\{/);
    // there is no bare `{…}` (empty selector) that would apply globally
    expect(out).not.toMatch(/(^|})\s*\{/);
  });

  // Concrete DOM proof: a crafted `body`/chrome rule that the attacker tried to smuggle in via
  // the content-root must NOT match a chrome element after translation+scoping.
  it("a smuggled body/chrome rule stays inert against an out-of-column element", async () => {
    const scoped = await scopeArticleCss(
      ".mw-parser-output > body{display:none} .mw-parser-output, body{color:red} :is(.mw-parser-output, body){color:red}"
    );
    const selectors = emittedSelectors(scoped);
    // Build a page where a chrome <body> child sits OUTSIDE any .wiki-body.
    document.documentElement.innerHTML =
      '<body><header class="site-header">chrome</header><div class="wiki-body"><div class="x">in</div></div></body>';
    const chrome = document.querySelector("header.site-header")!;
    const bodyEl = document.body;
    for (const sel of selectors) {
      let m = false;
      try {
        m = chrome.matches(sel) || bodyEl.matches(sel);
      } catch {
        m = false;
      }
      expect(m, `selector "${sel}" matched a chrome/body element — scope escape`).toBe(false);
    }
  });
});
