import { afterEach, describe, expect, it, vi } from "vitest";
import DOMPurify from "dompurify";
import { fetchFullArticle } from "@/lib/wiki/article";
import {
  sanitizeInlineStyle,
  parseColor,
  contrastRatio,
  aaTextColor,
} from "@/lib/wiki/inlineStyle";

// Recovered layout-only inline-`style` subset (#106) — fidelity (AC1–AC4), the inline-`style`
// X4 re-proof (AC5–AC9, the security gate), the carrier-hijack vector, and AA on recovered
// colors (AC10). Mechanism (spike): a pre-DOMPurify encode of an allowlisted, value-sanitized
// subset onto an inert `data-wikiplus-style` carrier, the unchanged DOMPurify pass with an
// IMG-gated width/height rescue, then a post-DOMPurify decode back to `style`.
//
// Assertions are made against a LIVE parsed DOM (or the produced string) so an attribute that
// survives in a parsed tree cannot hide. The X4 cases assert the DECODED outcome (the
// jsdom-vs-real-browser gap the spike calls out) — escapes/comments are decoded by css-tree
// before the property/value comparison, exactly as a real browser tokenizes.

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
/** Every surviving inline `style` declaration string anywhere in the tree, lowercased. */
function allStyles(div: HTMLElement): string[] {
  return Array.from(div.querySelectorAll<HTMLElement>("[style]")).map((el) =>
    (el.getAttribute("style") || "").toLowerCase()
  );
}

// A `.tmulti` montage, structurally faithful to the live Cat/San Francisco markup: the
// `.multiimageinner` overall width, a `.trow`, two `.tsingle` columns each wrapping a crop
// `<div style="height:…;overflow:hidden">` around an `<img>` carrying its scaled width/height.
const MONTAGE = `
<div class="tmulti"><div class="multiimageinner" style="width:267px;max-width:267px;border:none">
  <div class="trow">
    <div class="tsingle" style="width:183px;max-width:183px">
      <div class="thumbimage" style="height:110px;overflow:hidden"><span typeof="mw:File"><a href="./File:A">
        <img src="//up.example/a.jpg" alt="a cat" height="111" width="181" class="mw-file-element"/></a></span></div>
      <div class="thumbcaption">A</div>
    </div>
    <div class="tsingle" style="width:80px;max-width:80px">
      <div class="thumbimage" style="height:110px;overflow:hidden"><span typeof="mw:File"><a href="./File:B">
        <img src="//up.example/b.jpg" alt="another cat" height="111" width="78" class="mw-file-element"/></a></span></div>
      <div class="thumbcaption">B</div>
    </div>
  </div>
</div></div>`;

describe("#106 fidelity — montage tiling (AC1, resolves #91)", () => {
  it("recovers the .multiimageinner / .tsingle widths + the crop height/overflow (the side-by-side geometry)", async () => {
    const o = await out(`<section><h2>S</h2>${MONTAGE}</section>`);
    const d = live(o);
    // The overall montage width + the `border:none` survive (sanitized).
    const inner = d.querySelector(".multiimageinner")!;
    const innerStyle = (inner.getAttribute("style") || "").toLowerCase();
    expect(innerStyle).toContain("width:267px");
    expect(innerStyle).toContain("max-width:267px");
    expect(innerStyle).toContain("border:none");
    // Each column cell keeps its width — the #105 `.trow{display:flex}` scaffold sizes
    // against these instead of collapsing to a full-width stack.
    const cells = Array.from(d.querySelectorAll<HTMLElement>(".tsingle"));
    expect(cells).toHaveLength(2);
    expect((cells[0].getAttribute("style") || "").toLowerCase()).toContain("width:183px");
    expect((cells[1].getAttribute("style") || "").toLowerCase()).toContain("width:80px");
    // The crop band height + overflow survive (the uniform crop).
    const crops = Array.from(d.querySelectorAll<HTMLElement>(".thumbimage"));
    expect(crops).toHaveLength(2);
    for (const c of crops) {
      const s = (c.getAttribute("style") || "").toLowerCase();
      expect(s).toContain("height:110px");
      expect(s).toContain("overflow:hidden");
    }
  });

  it("keeps the img width/height PRESENTATIONAL attributes (scaled image size inside the crop)", async () => {
    const o = await out(`<section><h2>S</h2>${MONTAGE}</section>`);
    const d = live(o);
    const imgs = Array.from(d.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute("width")).toBe("181");
    expect(imgs[0].getAttribute("height")).toBe("111");
    expect(imgs[1].getAttribute("width")).toBe("78");
    expect(imgs[1].getAttribute("height")).toBe("111");
    // alt text is preserved through the recovery (a11y, UX §8).
    expect(imgs[0].getAttribute("alt")).toBe("a cat");
  });

  it("the recovered montage style carries NO banned token (X4 holds through the geometry)", async () => {
    const o = await out(`<section><h2>S</h2>${MONTAGE}</section>`);
    const d = live(o);
    for (const s of allStyles(d)) {
      expect(s).not.toMatch(/url\s*\(/);
      expect(s).not.toContain("position");
      expect(s).not.toContain("behavior");
      expect(s).not.toContain("expression");
    }
  });
});

describe("#106 fidelity — per-cell color (AC2, #93) + taxon band (AC3, #74)", () => {
  it("a per-cell background-color longhand survives scoped to its own cell", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody><tr>` +
        `<td style="background-color:#cfe8cf;color:#202020">green</td>` +
        `<td style="background-color:#f7d7d7">pink</td>` +
        `<td>plain</td>` +
        `</tr></tbody></table></section>`
    );
    const d = live(o);
    const cells = Array.from(d.querySelectorAll("td"));
    expect((cells[0].getAttribute("style") || "").toLowerCase()).toContain("background-color:#cfe8cf");
    expect((cells[0].getAttribute("style") || "").toLowerCase()).toContain("color:#202020");
    expect((cells[1].getAttribute("style") || "").toLowerCase()).toContain("background-color:#f7d7d7");
    // No bleed: the plain cell stays uncolored.
    expect(cells[2].hasAttribute("style")).toBe(false);
  });

  it("the taxon band background-color survives on the banner th (recovers #74's grey)", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" style="text-align:center;background-color:rgb(180,250,180)">Scientific classification</th></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const band = d.querySelector("th[colspan]")!;
    const s = (band.getAttribute("style") || "").toLowerCase();
    expect(s).toContain("background-color:rgb(180,250,180)");
    expect(s).toContain("text-align:center"); // band stays centered (structural signal)
  });
});

describe("#106 fidelity — no-op where style is fully dropped (AC4)", () => {
  it("an element whose inline style is entirely non-allowlisted/sanitized-away has NO style and NO carrier artifact", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="z-index:5;content:'x';display:flex;margin:4px">a</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    expect(d.querySelector("td")?.hasAttribute("style")).toBe(false);
    expect(o).not.toContain("data-wikiplus-style"); // the carrier never leaks to the output
  });

  it("an article with no recoverable inline style produces no data-wikiplus-style anywhere", async () => {
    const o = await out(`<section><h2>S</h2><p>plain prose, no inline style.</p></section>`);
    expect(o).not.toContain("data-wikiplus-style");
    expect(o).not.toMatch(/style=/i);
  });
});

describe("#106 X4 re-proof for inline style (AC5–AC9 — the security gate)", () => {
  it("AC5 — property allowlist: only layout-only props survive; all-non-allowlisted → no style", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="background-color:#eee;behavior:url(x);content:'…';z-index:99;position:fixed">a</td></tr>` +
        `<tr><td style="z-index:5;content:'x'">b</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const cells = Array.from(d.querySelectorAll("td"));
    // only the allowlisted background-color survives on the first cell
    expect((cells[0].getAttribute("style") || "").toLowerCase()).toBe("background-color:#eee");
    // an all-non-allowlisted style leaves NO style attribute
    expect(cells[1].hasAttribute("style")).toBe(false);
  });

  it("AC6 — url()/image-set() in ANY allowlisted property's value drops the declaration", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="background-color:url(https://evil/?leak=1)">a</td></tr>` +
        `<tr><td style="width:image-set(url(//evil/a) 1x)">b</td></tr>` +
        `<tr><td style="border:1px solid url(//evil)">c</td></tr>` +
        `<tr><td style="background-color:-webkit-image-set(url(//evil) 1x)">d</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    for (const td of Array.from(d.querySelectorAll("td"))) {
      expect(td.hasAttribute("style")).toBe(false);
    }
    expect(o.toLowerCase()).not.toMatch(/url\s*\(/);
    expect(o.toLowerCase()).not.toContain("image-set");
  });

  it("AC7 — position (fixed/absolute/sticky/relative/static) is never allowlisted inline → all dropped", async () => {
    for (const val of ["fixed", "absolute", "sticky", "relative", "static"]) {
      const o = await out(
        `<section><h2>S</h2><table class="wikitable"><tbody>` +
          `<tr><td style="position:${val};background-color:#abc">x</td></tr>` +
          `</tbody></table></section>`
      );
      const d = live(o);
      const s = (d.querySelector("td")?.getAttribute("style") || "").toLowerCase();
      expect(s).not.toContain("position");
      // the co-located allowlisted declaration still survives — only `position` is dropped
      expect(s).toContain("background-color:#abc");
    }
  });

  it("AC8 — behavior/expression()/-moz-binding are dropped (no script execution)", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="behavior:url(#x)">a</td></tr>` +
        `<tr><td style="-moz-binding:url(evil.xml)">b</td></tr>` +
        `<tr><td style="width:expression(alert(1))">c</td></tr>` +
        `<tr><td style="width: EXPRESSION (alert(1))">d</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    for (const td of Array.from(d.querySelectorAll("td"))) {
      expect(td.hasAttribute("style")).toBe(false);
    }
    expect(o.toLowerCase()).not.toContain("behavior");
    expect(o.toLowerCase()).not.toContain("expression");
    expect(o.toLowerCase()).not.toContain("binding");
  });

  it("AC9 — escape/comment/whitespace obfuscation is DECODED, not smuggled", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        // escaped property name `position` co-located with a benign background-color
        `<tr><td style="po\\73 ition:fixed;background-color:#abc">a</td></tr>` +
        // escaped function name `url(`
        `<tr><td style="background-color:\\75 rl(//evil)">b</td></tr>` +
        // comment-split `url(`
        `<tr><td style="background-color:u/**/rl(//evil)">c</td></tr>` +
        // escaped function name mid-token
        `<tr><td style="width:ur\\6c(//evil)">d</td></tr>` +
        // escaped-but-BENIGN property name decodes to background-color and is re-emitted canonical
        `<tr><td style="\\62 ackground-color:#abc">e</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const cells = Array.from(d.querySelectorAll("td"));
    // a: `position` decoded + dropped; the co-located benign color is kept
    const sa = (cells[0].getAttribute("style") || "").toLowerCase();
    expect(sa).not.toContain("position");
    expect(sa).not.toContain("fixed");
    expect(sa).toContain("background-color:#abc");
    // b/c/d: the obfuscated url() is decoded + the declaration dropped
    expect(cells[1].hasAttribute("style")).toBe(false);
    expect(cells[2].hasAttribute("style")).toBe(false);
    expect(cells[3].hasAttribute("style")).toBe(false);
    // e: the escaped-benign name decodes to the CANONICAL `background-color` (no hidden meaning)
    expect((cells[4].getAttribute("style") || "").toLowerCase()).toBe("background-color:#abc");
    // global: no url()/position/escape literal anywhere
    expect(o.toLowerCase()).not.toMatch(/url\s*\(/);
    expect(o).not.toContain("\\73"); // no surviving escape sequence
    expect(o).not.toContain("\\75");
    expect(o).not.toContain("\\62");
  });
});

describe("#106 carrier-hijack — source-supplied data-wikiplus-style is stripped before re-derivation", () => {
  it("a source data-wikiplus-style (with position/url) is NOT promoted to a live style", async () => {
    const o = await out(
      `<section><h2>S</h2>` +
        `<div data-wikiplus-style="position:fixed;background-color:url(//evil)">a</div>` +
        `<div data-wikiplus-style="width:9px" style="position:fixed">b</div>` +
        `</section>`
    );
    const d = live(o);
    const divs = Array.from(d.querySelectorAll("div"));
    // The forged carrier is stripped first, then re-derived from REAL style only.
    expect(divs[0].hasAttribute("style")).toBe(false); // no `style` at all on the forged-only div
    expect(divs[0].hasAttribute("data-wikiplus-style")).toBe(false);
    // The second div had a real `style="position:fixed"` (dropped) + a forged carrier
    // (`width:9px`, which would be allowlisted IF honored) — the forged value must NOT win.
    expect(divs[1].hasAttribute("style")).toBe(false);
    expect(divs[1].hasAttribute("data-wikiplus-style")).toBe(false);
    expect(o).not.toContain("position:fixed");
    expect(o).not.toContain("width:9px");
    expect(o.toLowerCase()).not.toMatch(/url\s*\(/);
  });
});

describe("#106 AA darken-to-pass on recovered colors (AC10)", () => {
  it("a recovered background-color+color pair that FAILS AA gets a passing text color, keeping the bg hue", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        // dark fill paired with dark text → fails 4.5:1 → text adjusted to pass
        `<tr><td style="background-color:#222222;color:#333333">dark</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const cell = d.querySelector("td")!;
    const s = (cell.getAttribute("style") || "").toLowerCase();
    // The recovered background hue is KEPT…
    expect(s).toContain("background-color:#222222");
    // …and the text color now clears AA against it (the failing #333 is replaced).
    const bg = parseColor("#222222")!;
    const fgMatch = s.match(/(?:^|;)\s*color:\s*([^;]+)/);
    expect(fgMatch).not.toBeNull();
    const fg = parseColor(fgMatch![1].trim())!;
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
  });

  it("a recovered background-color with NO recovered color (vs the article ink) that fails AA gets a passing text color", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="wikitable"><tbody>` +
        `<tr><td style="background-color:#1a1a1a">darkdefault</td></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const s = (d.querySelector("td")?.getAttribute("style") || "").toLowerCase();
    expect(s).toContain("background-color:#1a1a1a");
    const bg = parseColor("#1a1a1a")!;
    const fgMatch = s.match(/(?:^|;)\s*color:\s*([^;]+)/);
    expect(fgMatch).not.toBeNull();
    expect(contrastRatio(bg, parseColor(fgMatch![1].trim())!)).toBeGreaterThanOrEqual(4.5);
  });

  it("a light recovered band under the dark article ink already passes AA → no text color added", async () => {
    const o = await out(
      `<section><h2>S</h2><table class="infobox biota"><tbody>` +
        `<tr><th colspan="2" style="background-color:rgb(180,250,180)">band</th></tr>` +
        `</tbody></table></section>`
    );
    const d = live(o);
    const s = (d.querySelector("th[colspan]")?.getAttribute("style") || "").toLowerCase();
    expect(s).toContain("background-color:rgb(180,250,180)");
    // The light pastel under the #2c2c2c ink already clears 4.5:1, so we add no standalone
    // `color` declaration (the only `color:` here is the tail of `background-color:`).
    expect(s).not.toMatch(/(?:^|;)\s*color:/);
  });
});

describe("#106 sanitizeInlineStyle — pure-function unit coverage", () => {
  it("keeps allowlisted, value-safe declarations and drops everything else", async () => {
    expect(await sanitizeInlineStyle("width:183px;max-width:183px;border:none")).toBe(
      "width:183px; max-width:183px; border:none"
    );
    expect(await sanitizeInlineStyle("background-color:#eee;z-index:9;display:flex")).toBe(
      "background-color:#eee"
    );
    expect(await sanitizeInlineStyle("position:fixed;content:'x'")).toBe("");
    expect(await sanitizeInlineStyle("")).toBe("");
    expect(await sanitizeInlineStyle("background-color:url(//evil)")).toBe("");
  });

  it("contrast helpers compute WCAG ratios and parse hex/rgb", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("#222222")).toEqual([34, 34, 34]);
    expect(parseColor("rgb(180, 250, 180)")).toEqual([180, 250, 180]);
    expect(parseColor("notacolor")).toBeNull();
    // black-on-white is the canonical 21:1.
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    // a failing pair yields an adjusted text color that passes; a passing pair → null.
    expect(aaTextColor("#222222", "#333333")).not.toBeNull();
    expect(aaTextColor("rgb(180,250,180)", null)).toBeNull(); // light bg, dark ink already passes
    expect(aaTextColor("notacolor", null)).toBeNull(); // unreadable bg → leave untouched
  });
});

describe("#106 singleton no-leak — the IMG width/height rescue does not persist", () => {
  it("after a fetchFullArticle call, an independent sanitize still drops img width/height (no hook leak)", async () => {
    await out(`<section><h2>S</h2>${MONTAGE}</section>`);
    const leaked = DOMPurify.sanitize(
      `<img src="//x/a.jpg" width="50" height="50">`,
      {
        ALLOWED_TAGS: ["img"],
        ALLOWED_ATTR: ["src", "width", "height"],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\.{0,2}\/|#)/i,
      }
    ).toLowerCase();
    expect(leaked).not.toMatch(/width="50"/);
    expect(leaked).not.toMatch(/height="50"/);
  });
});
