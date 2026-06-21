import { afterEach, describe, expect, it, vi } from "vitest";
import DOMPurify from "dompurify";
import { fetchFullArticle } from "@/lib/wiki/article";
import { sanitizeInlineStyle } from "@/lib/wiki/inlineStyle";

// QA independent (non-author) adversarial re-proof of the recovered inline-`style` boundary
// (#106). This file does NOT trust the author's test set; it attacks the new surfaces hardest:
// the `data-wikiplus-style` CARRIER-HIJACK vector (the new attack surface this mechanism
// introduces), the value gate under additional obfuscation, and the singleton no-leak. Every
// assertion is made against the produced output string AND a parsed live DOM, so an attribute
// that survives anywhere cannot hide. The DECODED outcome is asserted (the jsdom-vs-browser
// gap): css-tree decodes escapes/comments before the property/value comparison.

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}
afterEach(() => vi.restoreAllMocks());

async function out(body: string): Promise<string> {
  mockArticleHtml(body);
  const a = await fetchFullArticle("X");
  return a.lead.leadHtml + "\n" + a.sections.map((s) => s.html).join("\n");
}
function live(html: string): HTMLDivElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}
/** Assert the produced output carries no live threat token anywhere, in any casing. */
function assertNoThreatTokens(o: string): void {
  const lo = o.toLowerCase();
  expect(lo).not.toMatch(/url\s*\(/);
  expect(lo).not.toContain("position:fixed");
  expect(lo).not.toContain("position:absolute");
  expect(lo).not.toContain("position:sticky");
  expect(lo).not.toContain("behavior");
  expect(lo).not.toContain("expression");
  expect(lo).not.toContain("-moz-binding");
  expect(lo).not.toContain("image-set");
  expect(lo).not.toContain("-moz-element");
  expect(lo).not.toContain("javascript:");
  // The carrier name must NEVER appear in output (it is renamed back to `style` or dropped).
  expect(lo).not.toContain("data-wikiplus-style");
}

describe("#106 QA — CARRIER-HIJACK attack matrix (the new attack surface)", () => {
  it("forged carrier alone (position/url) is never promoted to a live style", async () => {
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="t" data-wikiplus-style="position:fixed;background-color:url(//evil/?x=1)">a</div>` +
        `</section>`
    );
    const d = live(o);
    const el = d.querySelector("#t")!;
    expect(el.hasAttribute("style")).toBe(false);
    expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    assertNoThreatTokens(o);
  });

  it("forged carrier whose value is allowlisted-AND-safe (width:9px) is STILL dropped (it was source-supplied)", async () => {
    // The strongest hijack: a value that WOULD pass the gate if honored. It must die anyway,
    // because the carrier may only ever hold OUR re-derived output, never a source value.
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="t" data-wikiplus-style="width:9px;background-color:#abc">a</div>` +
        `</section>`
    );
    const d = live(o);
    const el = d.querySelector("#t")!;
    expect(el.hasAttribute("style")).toBe(false);
    expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    expect(o).not.toContain("width:9px");
    expect(o).not.toContain("background-color:#abc");
    assertNoThreatTokens(o);
  });

  it("element with BOTH a real style and a forged carrier — the real style wins (sanitized), the forged carrier loses", async () => {
    // real style has an allowlisted+safe decl (kept) and a threat (dropped); the forged
    // carrier tries to inject position/url — it must be stripped before re-derivation.
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="t" data-wikiplus-style="position:fixed;background-color:url(//evil)" ` +
        `style="background-color:#cfe8cf;position:absolute">a</div>` +
        `</section>`
    );
    const d = live(o);
    const el = d.querySelector("#t")!;
    const s = (el.getAttribute("style") || "").toLowerCase();
    // The real, allowlisted, safe declaration survives…
    expect(s).toContain("background-color:#cfe8cf");
    // …the real `position:absolute` is dropped, and NONE of the forged carrier's content
    // (position:fixed / url) is present.
    expect(s).not.toContain("position");
    expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    assertNoThreatTokens(o);
  });

  it("CASE-VARIANT forged carrier names (DATA-WIKIPLUS-STYLE, data-WikiPlus-Style) cannot slip past the strip", async () => {
    // HTML attribute names are case-insensitive; the parser normalizes them to lowercase, so
    // a `querySelectorAll("[data-wikiplus-style]")` strip catches every casing. Prove it.
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="a" DATA-WIKIPLUS-STYLE="position:fixed">x</div>` +
        `<div id="b" data-WikiPlus-Style="background-color:url(//evil)">y</div>` +
        `<div id="c" Data-Wikiplus-Style="width:5px">z</div>` +
        `</section>`
    );
    const d = live(o);
    for (const id of ["a", "b", "c"]) {
      const el = d.querySelector(`#${id}`)!;
      expect(el.hasAttribute("style")).toBe(false);
      expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    }
    expect(o).not.toContain("width:5px");
    assertNoThreatTokens(o);
  });

  it("forged carrier on a STRIPPED-chrome element does not resurrect a style (decode runs after stripChrome)", async () => {
    // A navbox is removed by stripChrome BEFORE decodeInlineStyles runs; even if it carried a
    // forged carrier, it is gone. (Also: the carrier was already stripped at encode time.)
    const o = await out(
      `<section><h2>S</h2>` +
        `<div role="navigation" class="navbox" data-wikiplus-style="position:fixed">nav</div>` +
        `<p>body</p></section>`
    );
    assertNoThreatTokens(o);
    expect(o).not.toContain("navbox");
  });

  it("forged carrier whose value uses a NON-allowlisted property (z-index/content) is dropped wholesale", async () => {
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="t" data-wikiplus-style="z-index:99;content:'x';display:flex">a</div>` +
        `</section>`
    );
    const el = live(o).querySelector("#t")!;
    expect(el.hasAttribute("style")).toBe(false);
    expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    assertNoThreatTokens(o);
  });

  it("forged carrier value containing literal `</style>`/markup cannot break out (inert data through DOMPurify)", async () => {
    const o = await out(
      `<section><h2>S</h2>` +
        `<div id="t" data-wikiplus-style="x:&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;">a</div>` +
        `</section>`
    );
    const el = live(o).querySelector("#t")!;
    expect(el.hasAttribute("style")).toBe(false);
    expect(el.hasAttribute("data-wikiplus-style")).toBe(false);
    expect(o.toLowerCase()).not.toContain("onerror");
    assertNoThreatTokens(o);
  });
});

describe("#106 QA — value gate under additional obfuscation (X4 AC6/AC8/AC9)", () => {
  it("CSS-escaped url with 6-hex form (\\000075rl) and trailing-space form is decoded + dropped", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="background-color:\\000075rl(//evil)">a</td></tr>` +
        `<tr><td style="background-color:\\75 rl(//evil)">b</td></tr>` +
        `<tr><td style="width:\\75rl(//evil)">c</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    for (const td of Array.from(d.querySelectorAll("td"))) {
      expect(td.hasAttribute("style")).toBe(false);
    }
    assertNoThreatTokens(o);
  });

  it("nested comment + whitespace split inside a url token is caught (u/* */r/* */l( )", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="background-color:u/* */r/* */l(//evil)">a</td></tr>` +
        `<tr><td style="background-color: u r l (//evil)">b</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    // Cell a (comment-split url) must die. Cell b is "u r l (" with real spaces — that is NOT
    // a valid url-token to a browser (spaces between letters), so its inertness is acceptable;
    // we only require that no live url() leaks.
    expect(d.querySelectorAll("td")[0].hasAttribute("style")).toBe(false);
    assertNoThreatTokens(o);
  });

  it("expression() with comment/case obfuscation inside an allowlisted property is dropped", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="width:expr/**/ession(alert(1))">a</td></tr>` +
        `<tr><td style="color:EXPRESSION(alert(1))">b</td></tr>` +
        `<tr><td style="height:\\65 xpression(alert(1))">c</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    for (const td of Array.from(d.querySelectorAll("td"))) {
      expect(td.hasAttribute("style")).toBe(false);
    }
    assertNoThreatTokens(o);
  });

  it("a CSS custom property / var() does not exfiltrate and is harmless (no banned token)", async () => {
    // `color:var(--x)` survives (no banned token) but resolves to nothing in the browser; the
    // `--x:url(...)` custom-property DECLARATION is non-allowlisted and dropped, so the url()
    // never reaches the DOM. The surviving `var()` is inert — a var() cannot fetch (spike §5
    // risk note). The security requirement is only that the url-carrying custom prop is gone
    // and no live request vector survives.
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="color:var(--evil);--evil:url(//evil)">a</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const s = (d.querySelector("td")?.getAttribute("style") || "").toLowerCase();
    // the `--evil:url(...)` custom-prop DECLARATION (carrying url) is non-allowlisted → dropped.
    expect(s).not.toContain("--evil:");
    // no url() leaks anywhere; the surviving `var()` reference is inert.
    assertNoThreatTokens(o);
  });
});

describe("#106 QA — sanitizeInlineStyle pure-function adversarial cases", () => {
  it("background SHORTHAND (not background-color) is never allowlisted, even with a plain color", async () => {
    expect(await sanitizeInlineStyle("background:#abc")).toBe("");
    expect(await sanitizeInlineStyle("background:red url(//evil)")).toBe("");
  });
  it("position is dropped for every value while a co-located allowlisted decl survives", async () => {
    expect(await sanitizeInlineStyle("position:relative;width:5px")).toBe("width:5px");
    expect(await sanitizeInlineStyle("position:static;color:#111")).toBe("color:#111");
  });
  it("border carrying a url() drops the whole border declaration", async () => {
    expect(await sanitizeInlineStyle("border:1px solid url(//evil)")).toBe("");
  });
  it("a !important hack on an allowlisted prop does not re-admit a threat", async () => {
    // !important is harmless on a layout prop; a url value still dies.
    expect(await sanitizeInlineStyle("background-color:url(//evil) !important")).toBe("");
  });
  it("empty / whitespace / garbage fails closed to empty string", async () => {
    expect(await sanitizeInlineStyle("   ")).toBe("");
    expect(await sanitizeInlineStyle(";;;;")).toBe("");
    expect(await sanitizeInlineStyle("not valid css at all {{{")).toBe("");
  });
});

describe("#106 QA — singleton no-leak after a real fetchFullArticle", () => {
  it("the IMG width/height rescue + carrier handling leave no forceKeepAttr leak on the shared singleton", async () => {
    // Run a real article fetch (adds + removes the hook in finally), then an INDEPENDENT
    // sanitize WITHOUT the hook. If the hook leaked, img width/height (URI-validated away by
    // the custom regexp) would survive; and style/onclick must always drop.
    await out(
      `<section><h2>S</h2><table class="wikitable"><tbody><tr>` +
        `<td style="background-color:#cfe8cf">c</td></tr></tbody></table></section>`
    );
    const leaked = DOMPurify.sanitize(
      `<table><tbody><tr><th colspan="2" scope="col" style="background:red" onclick="evil()">` +
        `<img src="//x/a.jpg" width="50" height="50"></th></tr></tbody></table>`,
      {
        ALLOWED_TAGS: ["table", "tbody", "tr", "th", "img"],
        ALLOWED_ATTR: ["colspan", "scope", "src", "width", "height"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
      }
    ).toLowerCase();
    expect(leaked).not.toContain("colspan");
    expect(leaked).not.toContain("scope");
    expect(leaked).not.toMatch(/width="50"/);
    expect(leaked).not.toMatch(/height="50"/);
    expect(leaked).not.toContain("onclick");
    expect(leaked).not.toContain("style");
  });
});
