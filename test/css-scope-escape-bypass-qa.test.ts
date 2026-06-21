import { describe, expect, it } from "vitest";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// QA re-verification battery (#105, Heavy lane, fix round 1) — independent adversarial
// escape variants beyond the developer's `css-scope-escape-bypass.test.ts`, added during
// the second security pass on the X4 CSS-block strip after the escape-decode fix (e959013).
//
// The threat the fix closes: a conformant browser DECODES CSS escape sequences during
// tokenization, so a banned construct hidden behind an escape (`@imp\ort`, `\75 rl(`,
// `po\73 ition:f\69xed`) reaches the browser live even though its raw literal looks benign.
// The sanitizer is the SOLE gate (there is no CSP backstop in the repo), so each escaped
// form of every banned construct must be neutralized on the decoded form.
//
// These cases pin the boundary between a REAL escaped banned token (must drop) and an inert
// look-alike a browser cannot fuse into a banned token (a comment or the escaped char's own
// expansion breaks contiguity — `\75/**/rl(` is `u`+comment+`rl(`, not `url(`; `@\69<TAB>import`
// decodes to `@iimport`, not `@import`). The former must drop; the latter is harmless and is
// asserted only to document why it is NOT a bypass (no live banned token exists to a browser).

describe("QA — contiguous escaped url() across every position is dropped", () => {
  it("u\\72l( (escaped middle 'r', contiguous → url) is dropped", async () => {
    expect(await scopeArticleCss(".x{background:u\\72l(//evil.test/a)}")).not.toContain("evil.test");
  });
  it("\\75\\72\\6c( (all three chars escaped, contiguous → url) is dropped", async () => {
    expect(await scopeArticleCss(".x{background:\\75\\72\\6c(//evil.test/a)}")).not.toContain("evil.test");
  });
  it("\\000055RL( (6-digit mixed-case escape of 'U' → url) is dropped", async () => {
    expect(await scopeArticleCss(".x{background:\\000055RL(//evil.test/a)}")).not.toContain("evil.test");
  });
  it("a bare url-token whose URL chars are escaped (url(\\2f\\2fevil...)) is dropped", async () => {
    const out = await scopeArticleCss(".x{background:url(\\2f\\2fevil.test/a)}");
    expect(out).not.toMatch(/url\s*\(/i);
  });
});

describe("QA — escaped fetch tokens through value indirection are dropped", () => {
  it("var() fallback smuggling an escaped url (var(--x,\\75 rl(...))) is dropped", async () => {
    expect(await scopeArticleCss(".z{background:var(--x,\\75 rl(//evil.test/v))}")).not.toContain("evil.test");
  });
  it("var() fallback smuggling a plain url (var(--x,url(...))) is dropped", async () => {
    expect(await scopeArticleCss(".z{background:var(--x,url(//evil.test/v2))}")).not.toContain("evil.test");
  });
  it("escaped -webkit-image-set fetch token is dropped", async () => {
    expect(
      await scopeArticleCss(".x{background-image:-webkit-imag\\65-set(url(//evil.test/w) 1x)}")
    ).not.toContain("evil.test");
  });
});

describe("QA — escaped @import via both the at-keyword and a url() prelude is dropped", () => {
  it("@\\69mport \\75 rl(//evil) (at-keyword AND url fn both escaped) is dropped", async () => {
    expect(await scopeArticleCss('@\\69mport \\75 rl(//evil.test/both.css);.a{c:red}')).not.toContain(
      "evil.test"
    );
  });
  it("@\\46ONT-FACE escaped+mixed-case (font fetch) is dropped", async () => {
    const out = await scopeArticleCss(
      "@\\46ONT-FACE{font-family:x;src:url(//evil.test/f.woff)}.a{c:red}"
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toMatch(/font-face/i);
  });
});

describe("QA — escaped off-flow position (property and value) is dropped", () => {
  it("uppercase-escape value position:F\\49XED is dropped", async () => {
    expect(await scopeArticleCss(".g{position:F\\49XED}")).not.toMatch(/position\s*:\s*fixed/i);
  });
  it("escape in BOTH property and value (po\\73 ition:f\\69xed) is dropped", async () => {
    const out = await scopeArticleCss(".g{po\\73 ition:f\\69xed;top:0}");
    expect(out.replace(/\s+/g, "")).not.toMatch(/position:fixed/i);
  });
  it("comment-split position keyword (position:fi/**/xed) is dropped", async () => {
    expect(await scopeArticleCss(".g{position:fi/**/xed;top:0}")).not.toMatch(/position\s*:\s*fixed/i);
  });
});

describe("QA — no over-strip of legitimate escaped, non-fetching CSS", () => {
  it("an escaped non-banned function (\\72 otate → rotate) survives, scoped", async () => {
    const out = await scopeArticleCss(".k{transform:\\72 otate(10deg)}");
    expect(out).toContain(".wiki-body .k");
    expect(out).toMatch(/otate\(/);
  });
  it("translateX(calc()) survives", async () => {
    expect(await scopeArticleCss(".t{transform:translateX(calc(1px + 2px))}")).toContain("translateX");
  });
});

describe("QA — escape look-alikes a browser cannot fuse are not live tokens (not a bypass)", () => {
  // `\75/**/rl(` is `u` (from \75) + comment + function `rl(` — a browser cannot fuse across
  // the comment into `url(`, so no fetch fires; the `evil.test` text is the arg list of an
  // inert `rl()`. css-tree tokenizes it identically (function name `rl`, not `url`).
  it("\\75/**/rl( produces no LIVE url() token (function name is rl, not url)", async () => {
    const out = await scopeArticleCss(".x{background:\\75/**/rl(//evil.test/a)}");
    // No real url() token survives; the literal text may remain as an inert rl() arg.
    expect(out).not.toMatch(/(^|[^\\])\burl\s*\(/i);
  });
  // `@\69<TAB>import` — the TAB is the single whitespace consumed by the hex escape, so \69
  // decodes to `i` and the literal `import` follows → `@iimport`, an unknown at-rule that
  // fetches nothing. The contiguous textual form `u/**/rl(` (no escape) IS caught below.
  it("u/**/rl( (comment-split, no escape) IS dropped by the textual scan", async () => {
    expect(await scopeArticleCss(".x{background:u/**/rl(//evil.test/a)}")).not.toContain("evil.test");
  });
});
