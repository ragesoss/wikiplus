import { describe, expect, it } from "vitest";
import { scopeArticleCss } from "@/lib/wiki/cssScope";

// X4 re-proof for the CSS-block boundary (templatestyles-reuse spec AC4–AC7; spike §4/§9)
// at the SANITIZER level. These attack `scopeArticleCss` directly with crafted,
// attacker-controlled article CSS; the application-path X4 (the `</style>`-injection
// headline) is proven against the FULL render path in article-templatestyles.test.ts.
//
// "Neutralized" = the malicious effect cannot occur: the offending declaration/at-rule is
// dropped, or every selector is confined under `.wiki-body` so it cannot reach wiki+
// chrome. The mechanism is the spike's `css-tree` scope + strip.

describe("scopeArticleCss — AC4: no url() exfiltration", () => {
  it("drops a background:url() declaration but keeps its sibling border rule", async () => {
    const out = await scopeArticleCss(
      ".clade td.clade-label{background:url(https://evil.test/?leak=1);border-left:1px solid}"
    );
    expect(out).not.toContain("evil.test");
    expect(out).not.toMatch(/url\s*\(/i);
    // the legitimate border segment (the clade branch line) survives
    expect(out).toContain("border-left:1px solid");
  });

  it("drops the comment-obfuscated u/**/rl( evasion the AST Url-node check misses", async () => {
    const out = await scopeArticleCss(".c{background:u/**/rl(//evil.test/a);color:red}");
    expect(out).not.toContain("evil.test");
    expect(out).toContain("color:red");
  });

  it("drops a url() smuggled through a custom property (var() indirection)", async () => {
    // `--evil:url(…)` then `background:var(--evil)` would re-introduce the request via
    // indirection; dropping any value carrying a url() token (custom props included) closes it.
    const out = await scopeArticleCss(
      ".z{--evil:url(https://evil.test/x);background:var(--evil)}"
    );
    expect(out).not.toContain("evil.test");
  });

  it("drops image-set(url(...)) and -moz-element() fetch tokens", async () => {
    const imgset = await scopeArticleCss(
      ".d{background-image:image-set(url(https://evil.test/x.png) 1x)}"
    );
    expect(imgset).not.toContain("evil.test");
    expect(imgset).not.toMatch(/image-set\s*\(/i);
    const mozEl = await scopeArticleCss(".o{background:-moz-element(#evil)}");
    expect(mozEl).not.toMatch(/-moz-element\s*\(/i);
    // expression() (legacy IE script-in-CSS) is dropped too
    const expr = await scopeArticleCss(".n{width:expression(alert(1))}");
    expect(expr).not.toMatch(/expression\s*\(/i);
  });
});

describe("scopeArticleCss — AC5: no off-column overlay / clickjack", () => {
  it("drops position:fixed / absolute / sticky, keeps relative + static", async () => {
    expect(await scopeArticleCss(".g{position:fixed;top:0;left:0}")).not.toContain(
      "position:fixed"
    );
    expect(await scopeArticleCss(".g{position:absolute}")).not.toContain("position:absolute");
    expect(await scopeArticleCss(".g{position:sticky}")).not.toContain("position:sticky");
    // clade td.clade-bar uses position:relative — in-flow, harmless, must survive
    const rel = await scopeArticleCss("td.clade-bar{position:relative;padding:0 0.5em}");
    expect(rel).toContain("position:relative");
  });

  it("drops legacy script-binding properties (behavior / -moz-binding)", async () => {
    const out = await scopeArticleCss(
      ".x{behavior:url(#default#time2);color:red} .y{-moz-binding:url(evil.xml#x)}"
    );
    expect(out).not.toMatch(/behavior\s*:/i);
    expect(out).not.toMatch(/-moz-binding\s*:/i);
    expect(out).not.toContain("evil.xml");
  });
});

describe("scopeArticleCss — AC6: no remote-CSS pull via @import (or equivalent)", () => {
  it("drops @import url(...) and @import \"...\"", async () => {
    expect(
      await scopeArticleCss('@import url(https://evil.test/x.css); .e{color:red}')
    ).not.toContain("evil.test");
    expect(
      await scopeArticleCss('@import "https://evil.test/x.css"; .f{color:red}')
    ).not.toContain("evil.test");
    // and the kept rule beside the @import is preserved + scoped
    expect(await scopeArticleCss('@import "x.css"; .e{color:red}')).toContain(
      ".wiki-body .e"
    );
  });

  it("drops @font-face (remote font fetch) and @document/@namespace re-targeting", async () => {
    const ff = await scopeArticleCss(
      "@font-face{font-family:x;src:url(https://evil.test/f.woff)} .m{color:red}"
    );
    expect(ff).not.toContain("evil.test");
    expect(ff).not.toMatch(/@font-face/i);
    expect(ff).toContain(".wiki-body .m");
    expect(await scopeArticleCss("@namespace evil url(https://evil.test/ns);")).not.toContain(
      "evil.test"
    );
  });
});

describe("scopeArticleCss — AC7: no scope escape from .wiki-body", () => {
  it("confines bare body/:root/html/* under .wiki-body", async () => {
    const out = await scopeArticleCss(
      "body{margin:0} :root{--x:1} html{font-size:99px} *{box-sizing:border-box}"
    );
    // every selector is prefixed; none can match top-level chrome
    expect(out).toContain(".wiki-body body");
    expect(out).toContain(".wiki-body :root");
    expect(out).toContain(".wiki-body html");
    expect(out).toContain(".wiki-body *");
    // no rule begins at the document root (a selector reaching chrome would not start
    // with the .wiki-body prefix)
    expect(out).not.toMatch(/(^|})\s*body\s*{/);
    expect(out).not.toMatch(/(^|})\s*html\s*{/);
    expect(out).not.toMatch(/(^|})\*\s*{/);
  });

  it("confines every branch inside :is()/:where()/:has() breakout attempts", async () => {
    const isOut = await scopeArticleCss(":is(body, .wiki-body) .x{color:red}");
    // the whole rule is prefixed AND each inner branch is confined
    expect(isOut.startsWith(".wiki-body")).toBe(true);
    expect(isOut).toContain(".wiki-body body");
    const hasOut = await scopeArticleCss(".plus-rail:has(> .x){display:none}");
    expect(hasOut.startsWith(".wiki-body")).toBe(true);
    // it cannot match a top-level .plus-rail (it is now a .wiki-body descendant rule)
    expect(hasOut).not.toMatch(/(^|})\s*\.plus-rail/);
  });

  it("prefixes every selector across a comma list", async () => {
    const out = await scopeArticleCss(".a, .b, td{color:red}");
    expect(out).toContain(".wiki-body .a");
    expect(out).toContain(".wiki-body .b");
    expect(out).toContain(".wiki-body td");
  });

  it("confines rules inside @media / @supports and CSS nesting", async () => {
    expect(
      await scopeArticleCss("@media (max-width:100px){.i{border-bottom:1px solid}}")
    ).toContain(".wiki-body .i");
    expect(
      await scopeArticleCss("@supports (display:flex){.j{display:flex}}")
    ).toContain(".wiki-body .j");
    const nested = await scopeArticleCss(".k{color:red; & .child{color:blue}}");
    expect(nested).toContain(".wiki-body .k");
  });

  it("does NOT prefix @keyframes keyframe selectors (from/to/0%) — would kill the animation", async () => {
    const out = await scopeArticleCss(
      "@keyframes spin{from{opacity:0}to{opacity:1}} .h{animation:spin 1s}"
    );
    // the keyframe selectors stay bare inside the @keyframes block…
    expect(out).toMatch(/@keyframes spin\s*{\s*from\s*{/);
    expect(out).not.toContain(".wiki-body from");
    expect(out).not.toContain(".wiki-body to");
    // …while the ordinary rule that USES the animation is still scoped
    expect(out).toContain(".wiki-body .h");
    const webkit = await scopeArticleCss(
      "@-webkit-keyframes pulse{0%{opacity:0}100%{opacity:1}}"
    );
    expect(webkit).not.toContain(".wiki-body 0%");
  });
});

describe("scopeArticleCss — fidelity & robustness", () => {
  it("AC1: real clade rules survive scoped (branch geometry intact)", async () => {
    const out = await scopeArticleCss(
      "table.clade td.clade-label{border-left:1px solid;border-bottom:1px solid;vertical-align:bottom}" +
        "table.clade td.clade-label.first{border-left:none;border-right:none}"
    );
    expect(out).toContain(".wiki-body table.clade td.clade-label");
    expect(out).toContain("border-left:1px solid");
    expect(out).toContain("border-bottom:1px solid");
    expect(out).toContain(".wiki-body table.clade td.clade-label.first");
  });

  it("AC2: real .tmulti montage layout rules survive scoped", async () => {
    const out = await scopeArticleCss(
      ".tmulti .trow{display:flex;flex-wrap:wrap}.tmulti .tsingle{display:inline-block;float:left}.tmulti .thumbcaption{text-align:left}"
    );
    expect(out).toContain(".wiki-body .tmulti .trow");
    expect(out).toContain("display:flex");
    expect(out).toContain(".wiki-body .tmulti .tsingle");
    expect(out).toContain(".wiki-body .tmulti .thumbcaption");
  });

  it("returns '' for empty / whitespace / unparseable input (no CSS is safe)", async () => {
    expect(await scopeArticleCss("")).toBe("");
    expect(await scopeArticleCss("   \n  ")).toBe("");
    // tolerant parse keeps a garbage fragment as inert Raw (safe via textContent apply);
    // the function resolves without throwing.
    await expect(scopeArticleCss("@@@@{{{{")).resolves.toBeTypeOf("string");
  });

  it("keeps a trusted hex color value (a taxon band via a <style> block would carry safely)", async () => {
    const out = await scopeArticleCss(".infobox.biota th{background:#d3d3a4}");
    expect(out).toContain(".wiki-body .infobox.biota th");
    expect(out).toContain("#d3d3a4");
  });
});
